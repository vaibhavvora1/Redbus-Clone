import TrainRun from "../models/TrainRun.js";
import {
  combineDateAndTime,
  getWeekdayForAppDate,
} from "../utils/timeZone.js";
import { makeBookingError } from "../utils/travelBooking.js";

export function getTrainStopDateTime(travelDate, stop, timeField) {
  const time = stop?.[timeField];
  if (!time) return null;
  const date = new Date(`${travelDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Number(stop.dayOffset || 0));
  const dateString = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return combineDateAndTime(dateString, time);
}

export function scheduleRunsOnDate(schedule, travelDate) {
  const weekday = getWeekdayForAppDate(travelDate);
  return schedule.active &&
    weekday !== null &&
    (!schedule.validFrom || travelDate >= schedule.validFrom) &&
    (!schedule.validTo || travelDate <= schedule.validTo) &&
    (schedule.runningDays || []).includes(weekday);
}

export async function ensureTrainRun(schedule, travelDate) {
  if (!scheduleRunsOnDate(schedule, travelDate)) {
    throw makeBookingError("This train does not run on the selected date.", 409, "NOT_RUNNING_ON_DATE");
  }
  const firstStop = schedule.stops[0];
  const lastStop = schedule.stops[schedule.stops.length - 1];
  const departureAt = getTrainStopDateTime(travelDate, firstStop, "departureTime");
  const arrivalAt = getTrainStopDateTime(travelDate, lastStop, "arrivalTime");
  if (!departureAt || !arrivalAt || arrivalAt <= departureAt) {
    throw makeBookingError("The train schedule has invalid departure or arrival times.", 500, "INVALID_SCHEDULE");
  }

  const filter = { scheduleId: schedule._id, travelDate };
  try {
    return await TrainRun.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          ...filter,
          departureAt,
          arrivalAt,
          status: "SCHEDULED",
          classInventory: schedule.classes.map((item) => ({
            code: item.code,
            name: item.name,
            fare: item.fare,
            totalSeats: item.seatCount,
            availableSeats: item.seatCount,
          })),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    ).lean();
  } catch (error) {
    if (error.code !== 11000) throw error;
    const run = await TrainRun.findOne(filter).lean();
    if (run) return run;
    throw error;
  }
}
