import Trip from "../models/Trip.js";
import Bus from "../models/Bus.js";
import { generateDefaultSeatLayout } from "../utils/seatLayout.js";
import {
  BOOKING_WINDOW_DAYS,
  combineDateAndTime,
  getWeekdayForAppDate,
  validateBookingDate,
  hasDeparted,
} from "../utils/timeZone.js";

export function scheduleRunsOnDate(schedule, travelDate) {
  if (!schedule || schedule.active === false) return false;
  const validFrom = schedule.validFrom || schedule.journeyDate || "";
  if (validFrom && travelDate < validFrom) return false;
  if (schedule.validTo && travelDate > schedule.validTo) return false;
  const weekday = getWeekdayForAppDate(travelDate);
  return weekday !== null && (schedule.runningDays || [0, 1, 2, 3, 4, 5, 6]).includes(weekday);
}

export function assertTravelDate(travelDate, now = new Date()) {
  const result = validateBookingDate(travelDate, now);
  if (!result.valid) {
    const error = new Error(result.message);
    error.statusCode = 400;
    error.code = result.code;
    throw error;
  }
  return result;
}

function makeTripDocument(schedule, travelDate) {
  const fare = Number(schedule.fare || schedule.price || 0);
  const totalSeats = Number(schedule.totalSeats || 36);
  const seats = Array.isArray(schedule.seats) && schedule.seats.length
    ? schedule.seats.map((seat) => ({
        ...seat.toObject?.() || seat,
        isBooked: false,
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
        holdExpiresAt: null,
      }))
    : generateDefaultSeatLayout(totalSeats, fare, schedule.busType || schedule.type);
  const departureTime = schedule.departureTime || "21:00";
  const departureAt = combineDateAndTime(travelDate, departureTime);

  return {
    bus: schedule._id,
    scheduleId: schedule._id,
    operator: schedule.operator,
    busNumber: schedule.busNumber || "",
    fromCity: schedule.fromCity || schedule.from,
    toCity: schedule.toCity || schedule.to,
    journeyDate: travelDate,
    travelDate,
    departureAt,
    departureTime,
    arrivalTime: schedule.arrivalTime || "06:00",
    duration: schedule.duration || "8h 30m",
    busType: schedule.busType || schedule.type || "AC Sleeper",
    fare,
    price: fare,
    totalSeats,
    availableSeats: totalSeats,
    rating: schedule.rating || "4.5",
    amenities: schedule.amenities || [],
    boardingPoints: schedule.boardingPoints?.length
      ? schedule.boardingPoints
      : Array.isArray(schedule.stops) && schedule.stops.length
        ? schedule.stops
        : [{ name: `${schedule.fromCity || schedule.from} Main Terminal`, time: departureTime }],
    droppingPoints: schedule.droppingPoints?.length
      ? schedule.droppingPoints
      : [{ name: `${schedule.toCity || schedule.to} Central Station`, time: schedule.arrivalTime || "06:00" }],
    seats,
    status: "scheduled",
    isGovernment: Boolean(schedule.isGovernment),
    active: true,
  };
}

/**
 * Lazily create one seat inventory per schedule/date. The unique index is the
 * concurrency guard; a duplicate-key race reads the winner's document.
 */
export async function ensureTripForSchedule(schedule, travelDate) {
  if (!scheduleRunsOnDate(schedule, travelDate)) {
    const error = new Error("This bus schedule does not run on the selected date.");
    error.statusCode = 409;
    error.code = "NOT_RUNNING_ON_DATE";
    throw error;
  }

  const legacyTrip = await Trip.findOne({
    bus: schedule._id,
    $or: [{ travelDate }, { journeyDate: travelDate }],
    scheduleId: { $exists: false },
  }).lean();
  if (legacyTrip) {
    await Trip.updateOne(
      { _id: legacyTrip._id, scheduleId: { $exists: false } },
      {
        $set: {
          scheduleId: schedule._id,
          travelDate,
          journeyDate: travelDate,
          departureAt: combineDateAndTime(travelDate, schedule.departureTime || "21:00"),
          status: "scheduled",
        },
      }
    );
    return Trip.findById(legacyTrip._id).lean();
  }

  const filter = { scheduleId: schedule._id, travelDate };
  const update = { $setOnInsert: makeTripDocument(schedule, travelDate) };
  try {
    return await Trip.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }).lean();
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await Trip.findOne(filter).lean();
    if (existing) return existing;
    throw error;
  }
}

export function tripError(trip, now = new Date()) {
  if (!trip) return { code: "TRIP_NOT_FOUND", statusCode: 404, message: "Trip not found." };
  if (trip.status === "cancelled") {
    return { code: "TRIP_CANCELLED", statusCode: 410, message: "This trip has been cancelled." };
  }
  if (trip.status === "departed" || hasDeparted(trip, now)) {
    return { code: "TRIP_DEPARTED", statusCode: 410, message: "This trip has already departed." };
  }
  const nowMs = now.getTime();
  const lockDurationMs = Number(process.env.SEAT_LOCK_MINUTES || 10) * 60 * 1000;
  const availableSeatCount = Array.isArray(trip.seats)
    ? trip.seats.filter((seat) => {
        if (seat.isBooked) return false;
        if (!seat.isLocked) return true;
        const expires = seat.holdExpiresAt ? new Date(seat.holdExpiresAt).getTime() : null;
        if (expires !== null) return expires <= nowMs;
        const lockedAt = seat.lockedAt ? new Date(seat.lockedAt).getTime() : 0;
        return nowMs - lockedAt >= lockDurationMs;
      }).length
    : Number(trip.availableSeats);
  if (availableSeatCount <= 0) {
    return { code: "SOLD_OUT", statusCode: 409, message: "No seats remain on this trip." };
  }
  const dateCheck = validateBookingDate(trip.travelDate || trip.journeyDate, now);
  if (!dateCheck.valid) {
    return { code: dateCheck.code, statusCode: 400, message: dateCheck.message };
  }
  if (trip.scheduleId && trip.runningDays && !trip.runningDays.includes(getWeekdayForAppDate(trip.travelDate || trip.journeyDate))) {
    return { code: "NOT_RUNNING_ON_DATE", statusCode: 409, message: "This schedule does not run on the trip date." };
  }
  return null;
}

export async function assertTripCanBeBooked(trip, now = new Date()) {
  const errorDetails = tripError(trip, now);
  if (errorDetails) {
    const error = new Error(errorDetails.message);
    error.code = errorDetails.code;
    error.statusCode = errorDetails.statusCode;
    throw error;
  }
  if (trip.scheduleId) {
    const schedule = await Bus.findById(trip.scheduleId).select("runningDays validFrom validTo active journeyDate").lean();
    if (!schedule || !scheduleRunsOnDate(schedule, trip.travelDate || trip.journeyDate)) {
      const error = new Error("This bus schedule does not run on the trip date.");
      error.code = "NOT_RUNNING_ON_DATE";
      error.statusCode = 409;
      throw error;
    }
  }
  return trip;
}

export async function holdSeatsAtomic(tripId, sortedSeatNumbers, identifier, holdExpiresAt, now = new Date()) {
  const lockDurationMs = Number(process.env.SEAT_LOCK_MINUTES || 10) * 60 * 1000;
  const result = await Trip.updateOne(
    {
      _id: tripId,
      availableSeats: { $gte: sortedSeatNumbers.length },
      $and: sortedSeatNumbers.map((seatNumber) => ({
        seats: {
          $elemMatch: {
            seatNumber,
            isBooked: false,
            $or: [
              { isLocked: false },
              { holdExpiresAt: { $lt: now } },
              { holdExpiresAt: null, lockedAt: { $lt: new Date(now.getTime() - lockDurationMs) } },
              { lockedBy: identifier },
            ],
          },
        },
      })),
    },
    {
      $set: {
        "seats.$[elem].isLocked": true,
        "seats.$[elem].lockedBy": identifier,
        "seats.$[elem].lockedAt": now,
        "seats.$[elem].holdExpiresAt": holdExpiresAt,
      },
    },
    { arrayFilters: [{ "elem.seatNumber": { $in: sortedSeatNumbers } }] }
  );
  return result?.matchedCount || 0;
}

export function getBookingWindowDays() {
  return BOOKING_WINDOW_DAYS;
}
