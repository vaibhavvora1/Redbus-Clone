import Bus from "../models/Bus.js";
import Trip from "../models/Trip.js";
import Operator from "../models/Operator.js";
import asyncHandler from "../utils/asyncHandler.js";
import { hasDeparted, getWeekdayForAppDate } from "../utils/timeZone.js";
import { assertTravelDate, ensureTripForSchedule, scheduleRunsOnDate } from "../services/tripService.js";
import { resolveCityPair } from "../utils/locationSearch.js";

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const getGovernmentBuses = asyncHandler(async (req, res) => {
  const { from = "", to = "", date, page = "1", limit = "10" } = req.query;
  if (!date) {
    return res.status(400).json({ success: false, code: "DATE_OUT_OF_RANGE", message: "A travel date in YYYY-MM-DD format is required." });
  }
  assertTravelDate(String(date));
  const cleanRoute = await resolveCityPair(from, to);

  const operatorDocs = await Operator.find({ isGovernment: true }).select("name").lean();
  const governmentNames = operatorDocs.map((operator) => operator.name).filter(Boolean);
  const filter = {
    active: { $ne: false },
    $or: [
      { isGovernment: true },
      ...(governmentNames.length ? [{ operator: { $in: governmentNames } }] : []),
    ],
  };
  if (cleanRoute.from) filter.from = { $regex: new RegExp(`^${escapeRegex(cleanRoute.from)}$`, "i") };
  if (cleanRoute.to) filter.to = { $regex: new RegExp(`^${escapeRegex(cleanRoute.to)}$`, "i") };

  const schedules = await Bus.find(filter)
    .select("operator busNumber from to departureTime arrivalTime busType type fare price totalSeats rating amenities boardingPoints droppingPoints stops runningDays validFrom validTo active journeyDate isGovernment")
    .sort({ departureTime: 1, operator: 1 })
    .lean();
  const runningSchedules = schedules.filter((schedule) => scheduleRunsOnDate(schedule, String(date)));

  if (!runningSchedules.length && schedules.length) {
    const weekday = getWeekdayForAppDate(String(date));
    return res.status(409).json({
      success: false,
      code: "NOT_RUNNING_ON_DATE",
      message: `No government schedule on this route runs on ${date} (weekday ${weekday}).`,
    });
  }

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, Number.parseInt(limit, 10) || 10));
  const pageSchedules = runningSchedules.slice((pageNum - 1) * limitNum, pageNum * limitNum);
  const trips = await Promise.all(pageSchedules.map((schedule) => ensureTripForSchedule(schedule, String(date))));
  const now = new Date();
  const ids = trips.map((trip) => trip._id);
  const availability = ids.length
    ? await Trip.aggregate([
        { $match: { _id: { $in: ids } } },
        {
          $project: {
            availableSeats: {
              $max: [
                0,
                {
                  $subtract: [
                    { $ifNull: ["$totalSeats", 36] },
                    {
                      $size: {
                        $filter: {
                          input: { $ifNull: ["$seats", []] },
                          as: "seat",
                          cond: {
                            $or: [
                              { $eq: ["$$seat.isBooked", true] },
                              {
                                $and: [
                                  { $eq: ["$$seat.isLocked", true] },
                                  {
                                    $or: [
                                      { $gt: ["$$seat.holdExpiresAt", now] },
                                      {
                                        $and: [
                                          { $eq: [{ $ifNull: ["$$seat.holdExpiresAt", null] }, null] },
                                          { $gt: ["$$seat.lockedAt", new Date(now.getTime() - 10 * 60 * 1000)] },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      ])
    : [];
  const availableById = new Map(availability.map((item) => [String(item._id), item.availableSeats]));

  const data = trips.map((trip) => {
    const availableSeats = availableById.get(String(trip._id)) ?? trip.availableSeats ?? trip.totalSeats;
    return {
      id: trip._id,
      _id: trip._id,
      tripId: trip._id,
      scheduleId: trip.scheduleId,
      operator: trip.operator,
      busNumber: trip.busNumber,
      from: trip.fromCity,
      to: trip.toCity,
      travelDate: trip.travelDate || trip.journeyDate,
      journeyDate: trip.travelDate || trip.journeyDate,
      departureTime: trip.departureTime,
      arrivalTime: trip.arrivalTime,
      duration: trip.duration,
      busType: trip.busType,
      fare: trip.fareOverride ?? trip.fare,
      price: trip.fareOverride ?? trip.price ?? trip.fare,
      totalSeats: trip.totalSeats,
      availableSeats,
      isDeparted: hasDeparted(trip),
      status: trip.status,
      rating: trip.rating,
      amenities: trip.amenities,
      boardingPoints: trip.boardingPoints,
      droppingPoints: trip.droppingPoints,
    };
  });

  return res.status(200).json({
    success: true,
    count: data.length,
    total: runningSchedules.length,
    totalPages: Math.ceil(runningSchedules.length / limitNum) || 1,
    currentPage: pageNum,
    limit: limitNum,
    data,
    ...(data.length === 0 && cleanRoute.from && cleanRoute.to
      ? { message: `No government buses found from ${cleanRoute.from} to ${cleanRoute.to}.` }
      : {}),
  });
});

export const getTripDetail = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.tripId)
    .populate("scheduleId", "runningDays validFrom validTo active from to")
    .lean();
  if (!trip) return res.status(404).json({ success: false, code: "TRIP_NOT_FOUND", message: "Trip not found." });

  const now = new Date();
  const seats = (trip.seats || []).map((seat) => {
    const holdExpiresAt = seat.holdExpiresAt ? new Date(seat.holdExpiresAt) : null;
    const lockedAt = seat.lockedAt ? new Date(seat.lockedAt) : null;
    const activeHold = seat.isLocked && !seat.isBooked &&
      (holdExpiresAt ? holdExpiresAt > now : lockedAt && now - lockedAt < 10 * 60 * 1000);
    return { ...seat, isLocked: Boolean(activeHold), isAvailable: !seat.isBooked && !activeHold };
  });
  const availableSeats = seats.filter((seat) => seat.isAvailable).length;
  const isDeparted = hasDeparted(trip);
  if (isDeparted && trip.status === "scheduled") {
    await Trip.updateOne({ _id: trip._id, status: "scheduled" }, { $set: { status: "departed" } });
    trip.status = "departed";
  }
  const cleanTrip = {
    ...trip,
    travelDate: trip.travelDate || trip.journeyDate,
    journeyDate: trip.travelDate || trip.journeyDate,
    seats,
    availableSeats,
    isSoldOut: availableSeats === 0,
    code: trip.status === "cancelled" ? "TRIP_CANCELLED" : isDeparted ? "TRIP_DEPARTED" : availableSeats === 0 ? "SOLD_OUT" : undefined,
    isDeparted,
    hasDeparted: isDeparted,
  };
  return res.status(200).json({ success: true, data: cleanTrip, trip: cleanTrip });
});
