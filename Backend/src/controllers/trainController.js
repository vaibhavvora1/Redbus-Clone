import { z } from "zod";
import mongoose from "mongoose";
import BookingHold from "../models/BookingHold.js";
import Train from "../models/Train.js";
import TrainRun from "../models/TrainRun.js";
import TrainSchedule from "../models/TrainSchedule.js";
import { HOLD_DURATION_MINUTES, MAX_TRAIN_PASSENGERS } from "../config/travelBooking.js";
import { ensureTrainRun, getTrainStopDateTime } from "../services/trainService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { validateBookingDate } from "../utils/timeZone.js";
import { resolveStationInput } from "../utils/locationSearch.js";
import {
  calculateTrainFare,
  getIdempotencyKey,
  makeBookingError,
  requestHash,
  withBookingTransaction,
} from "../utils/travelBooking.js";

export const trainSearchSchema = z.object({
  from: z.string({ error: "From station or city is required." }).trim().min(1, "From station or city is required.").max(80, "From must be at most 80 characters."),
  to: z.string({ error: "To station or city is required." }).trim().min(1, "To station or city is required.").max(80, "To must be at most 80 characters."),
  date: z.string({ error: "Travel date must use YYYY-MM-DD." }).regex(/^\d{4}-\d{2}-\d{2}$/, "Travel date must use YYYY-MM-DD."),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
}).superRefine((data, ctx) => {
  const validation = validateBookingDate(data.date);
  if (!validation.valid) {
    ctx.addIssue({
      code: "custom",
      path: ["date"],
      message: validation.message,
    });
  }
});

export const holdSchema = z.object({
  trainRunId: z.string().refine(mongoose.isValidObjectId, "Invalid train run."),
  classCode: z.string().trim().min(1).max(10).transform((value) => value.toUpperCase()),
  passengerCount: z.coerce.number().int().min(1).max(MAX_TRAIN_PASSENGERS),
  fromStationCode: z.string().trim().toUpperCase().min(2).max(8).optional(),
  toStationCode: z.string().trim().toUpperCase().min(2).max(8).optional(),
});

const lower = (value) => String(value || "").trim().toLocaleLowerCase("en");

function stopMatches(stop, station) {
  const candidates = [
    stop.stationCode,
    stop.stationName,
    stop.city,
    `${stop.stationName} (${stop.stationCode})`,
    `${stop.city} (${stop.stationCode})`,
  ].map(lower);
  return station.values.some((value) => candidates.includes(lower(value)));
}

function pagedQuery(req) {
  return req.validated.query;
}

async function findExistingHold(userId, key, hash) {
  const existing = await BookingHold.findOne({ userId, idempotencyKey: key }).lean();
  if (!existing) return null;
  if (existing.requestHash !== hash) {
    throw makeBookingError("This Idempotency-Key was already used for a different request.", 409, "IDEMPOTENCY_CONFLICT");
  }
  if (existing.status !== "HELD" || existing.expiresAt <= new Date()) {
    throw makeBookingError("This hold has expired or is no longer active. Start a new booking.", 409, "HOLD_EXPIRED");
  }
  return existing;
}

function holdResponse(hold) {
  return {
    success: true,
    data: {
      holdId: hold._id,
      bookingType: hold.bookingType,
      expiresAt: hold.expiresAt,
      baseFare: hold.baseFare,
      tax: hold.tax,
      charges: hold.charges,
      totalAmount: hold.totalAmount,
      snapshot: hold.snapshot,
    },
  };
}

export const getTrains = asyncHandler(async (req, res) => {
  const { from, to, date, page, limit } = pagedQuery(req);
  const [fromStation, toStation] = await Promise.all([
    resolveStationInput(from, "From"),
    resolveStationInput(to, "To"),
  ]);
  if ((fromStation.citySlug && fromStation.citySlug === toStation.citySlug) ||
      lower(fromStation.city) === lower(toStation.city)) {
    throw makeBookingError("Departure and destination must be in different cities.", 400, "SAME_CITY");
  }

  const activeTrainIds = await Train.find({ active: { $ne: false } }).distinct("_id");
  const schedules = await TrainSchedule.find({ active: true, trainId: { $in: activeTrainIds } })
    .sort({ trainNumber: 1 })
    .limit(500)
    .lean();
  const matchingSchedules = schedules.flatMap((schedule) => {
    let fromIndex = -1;
    let toIndex = -1;
    schedule.stops.forEach((stop, index) => {
      if (fromIndex === -1 && stopMatches(stop, fromStation)) fromIndex = index;
      if (toIndex === -1 && stopMatches(stop, toStation)) toIndex = index;
    });
    return fromIndex >= 0 && toIndex > fromIndex ? [{ schedule, fromIndex, toIndex }] : [];
  });
  const matching = [];
  for (const route of matchingSchedules) {
    try {
      const run = await ensureTrainRun(route.schedule, date);
      if (run.status === "SCHEDULED") matching.push({ ...route, run });
    } catch (error) {
      if (error.code !== "NOT_RUNNING_ON_DATE") throw error;
    }
  }

  matching.sort((a, b) => a.run.departureAt - b.run.departureAt);
  const total = matching.length;
  const pageItems = matching.slice((page - 1) * limit, page * limit);
  const data = await Promise.all(pageItems.map(async ({ schedule, run, fromIndex, toIndex }) => {
    const train = await Train.findById(schedule.trainId).select("operator trainNumber trainName rating amenities isDemo").lean();
    return {
      trainRunId: run._id,
      scheduleId: schedule._id,
      trainNumber: schedule.trainNumber,
      trainName: schedule.trainName || train?.trainName || train?.operator,
      operator: train?.operator || schedule.trainName,
      rating: train?.rating,
      from: schedule.stops[fromIndex],
      to: schedule.stops[toIndex],
      travelDate: run.travelDate,
      departureAt: getTrainStopDateTime(run.travelDate, schedule.stops[fromIndex], "departureTime"),
      arrivalAt: getTrainStopDateTime(run.travelDate, schedule.stops[toIndex], "arrivalTime"),
      durationMinutes: Math.max(0, Math.round((
        getTrainStopDateTime(run.travelDate, schedule.stops[toIndex], "arrivalTime") -
        getTrainStopDateTime(run.travelDate, schedule.stops[fromIndex], "departureTime")
      ) / 60000)),
      classes: run.classInventory.map((item) => ({
        code: item.code,
        name: item.name,
        fare: item.fare,
        availableSeats: item.availableSeats,
        soldOut: item.availableSeats === 0,
        fareBreakdown: calculateTrainFare(item.fare, 1),
      })),
      amenities: train?.amenities || [],
      isDemo: Boolean(schedule.isDemo || train?.isDemo),
    };
  }));
  return res.status(200).json({
    success: true,
    count: data.length,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    data,
    ...(total === 0 ? { message: `No trains found from ${fromStation.city} to ${toStation.city}.` } : {}),
  });
});

export const getTrainRun = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw makeBookingError("Invalid train run identifier.", 400, "INVALID_ID");
  }
  const run = await TrainRun.findById(req.params.id).lean();
  if (!run) return res.status(404).json({ success: false, message: "Train run not found." });
  const schedule = await TrainSchedule.findOne({ _id: run.scheduleId, active: true }).lean();
  const train = schedule ? await Train.findOne({ _id: schedule.trainId, active: { $ne: false } }).lean() : null;
  if (!schedule || !train) return res.status(404).json({ success: false, message: "Train schedule not found." });
  return res.status(200).json({
    success: true,
    data: {
      ...run,
      trainNumber: schedule.trainNumber,
      trainName: schedule.trainName || train.trainName || train.operator,
      operator: train.operator,
      stops: schedule.stops,
      classes: run.classInventory,
      isDemo: Boolean(schedule.isDemo || train.isDemo),
    },
  });
});

export const holdTrain = asyncHandler(async (req, res) => {
  const { trainRunId, classCode, passengerCount } = req.validated.body;
  const idempotencyKey = getIdempotencyKey(req);
  const hash = requestHash(req.validated.body);
  const oldHold = await findExistingHold(req.user._id, idempotencyKey, hash);
  if (oldHold) return res.status(200).json(holdResponse(oldHold));

  const run = await TrainRun.findById(trainRunId).lean();
  if (!run || run.status !== "SCHEDULED" || run.departureAt <= new Date()) {
    throw makeBookingError("This train run is no longer available for booking.", 409, "TRAIN_RUN_UNAVAILABLE");
  }
  const classInfo = run.classInventory.find((item) => item.code === classCode);
  if (!classInfo) throw makeBookingError("This class is not offered on the selected train.", 400, "CLASS_NOT_FOUND");
  const fare = calculateTrainFare(classInfo.fare, passengerCount);
  const schedule = await TrainSchedule.findOne({ _id: run.scheduleId, active: true }).lean();
  const train = schedule ? await Train.findOne({ _id: schedule.trainId, active: { $ne: false } }).lean() : null;
  if (!schedule || !train) throw makeBookingError("Train schedule was not found or is inactive.", 404, "SCHEDULE_NOT_FOUND");
  const fromIndex = req.validated.body.fromStationCode
    ? schedule.stops.findIndex((stop) => stop.stationCode === req.validated.body.fromStationCode)
    : 0;
  const toIndex = req.validated.body.toStationCode
    ? schedule.stops.findIndex((stop) => stop.stationCode === req.validated.body.toStationCode)
    : schedule.stops.length - 1;
  if (fromIndex < 0 || toIndex <= fromIndex) {
    throw makeBookingError("The selected train stations are not in route order.", 400, "INVALID_TRAIN_SEGMENT");
  }
  const fromStop = schedule.stops[fromIndex];
  const toStop = schedule.stops[toIndex];
  if (lower(fromStop.city) === lower(toStop.city)) {
    throw makeBookingError("Departure and destination must be in different cities.", 400, "SAME_CITY");
  }
  const expiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60 * 1000);
  try {
    const hold = await withBookingTransaction(async (session) => {
      const [created] = await BookingHold.create([{
        bookingType: "train",
        userId: req.user._id,
        idempotencyKey,
        requestHash: hash,
        trainRunId: run._id,
        classCode,
        passengerCount,
        travelDate: run.travelDate,
        ...fare,
        snapshot: {
          trainNumber: schedule.trainNumber,
          trainName: schedule.trainName || train.trainName || train.operator,
          fromStation: fromStop.stationName,
          toStation: toStop.stationName,
          fromStationCode: fromStop.stationCode,
          toStationCode: toStop.stationCode,
          fromCity: fromStop.city,
          toCity: toStop.city,
          departureAt: getTrainStopDateTime(run.travelDate, fromStop, "departureTime"),
          arrivalAt: getTrainStopDateTime(run.travelDate, toStop, "arrivalTime"),
          classCode,
          className: classInfo.name,
        },
        expiresAt,
      }], { session });
      const result = await TrainRun.updateOne(
        {
          _id: run._id,
          status: "SCHEDULED",
          classInventory: { $elemMatch: { code: classCode, availableSeats: { $gte: passengerCount } } },
        },
        { $inc: { "classInventory.$.availableSeats": -passengerCount } },
        { session }
      );
      if (result.modifiedCount !== 1) {
        throw makeBookingError("Those seats are no longer available in this class.", 409, "SOLD_OUT");
      }
      return created;
    });
    return res.status(201).json(holdResponse(hold));
  } catch (error) {
    if (error.code === 11000) {
      const existing = await findExistingHold(req.user._id, idempotencyKey, hash);
      if (existing) return res.status(200).json(holdResponse(existing));
    }
    throw error;
  }
});

export default { getTrains, getTrainRun, holdTrain };
