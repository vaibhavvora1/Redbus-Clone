import assert from "node:assert/strict";
import "dotenv/config";
import mongoose from "mongoose";
import Bus from "../src/models/Bus.js";
import Trip from "../src/models/Trip.js";
import { ensureTripForSchedule, holdSeatsAtomic, scheduleRunsOnDate, assertTravelDate } from "../src/services/tripService.js";
import { generateDefaultSeatLayout } from "../src/utils/seatLayout.js";
import {
  addDaysToAppDate,
  getTodayInAppTZ,
  getWeekdayForAppDate,
  validateBookingDate,
} from "../src/utils/timeZone.js";

const runUnit = process.argv.includes("--unit");
const runIntegration = process.argv.includes("--integration");

async function expectCode(action, expectedCode) {
  try {
    await action();
    assert.fail(`Expected ${expectedCode} but the operation succeeded.`);
  } catch (error) {
    assert.equal(error.code, expectedCode, error.message);
  }
}

function verifyDateRules() {
  const now = new Date("2026-11-19T18:30:00.000Z");
  const today = getTodayInAppTZ(now);
  const tomorrow = addDaysToAppDate(today, 1);
  const maxDate = addDaysToAppDate(today, Number(process.env.BOOKING_WINDOW_DAYS || 30));
  assert.equal(addDaysToAppDate("2024-02-28", 1), "2024-02-29");
  assert.equal(getWeekdayForAppDate("2026-11-19"), 4);
  assert.equal(validateBookingDate(today, now).valid, true);
  assert.equal(validateBookingDate(tomorrow, now).valid, true);
  assert.equal(validateBookingDate(addDaysToAppDate(today, -1), now).code, "DATE_OUT_OF_RANGE");
  assert.equal(validateBookingDate(addDaysToAppDate(maxDate, 1), now).code, "DATE_OUT_OF_RANGE");
  assert.equal(scheduleRunsOnDate({ active: true, runningDays: [getWeekdayForAppDate(today)], validFrom: today }, today), true);
  assert.equal(scheduleRunsOnDate({ active: true, runningDays: [getWeekdayForAppDate(today)], validFrom: today }, tomorrow), false);
  assert.throws(() => assertTravelDate(addDaysToAppDate(today, -1), now), { code: "DATE_OUT_OF_RANGE" });
  console.log(`PASS date validation (${process.env.TZ || "host timezone"}); today=${today}, max=${maxDate}`);
}

async function verifyMongoConcurrency() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured for --integration.");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
  await Trip.collection.createIndex(
    { scheduleId: 1, travelDate: 1 },
    {
      unique: true,
      partialFilterExpression: {
        scheduleId: { $type: "objectId" },
        travelDate: { $type: "string" },
      },
      name: "unique_schedule_travel_date",
    }
  );

  const today = getTodayInAppTZ();
  const dayA = today;
  const dayB = addDaysToAppDate(today, 1);
  const dayC = addDaysToAppDate(today, 2);
  const schedule = await Bus.create({
    operator: "Date-wise verification fixture",
    busNumber: `VERIFY-${Date.now()}`,
    from: "Test Origin",
    to: "Test Destination",
    journeyDate: today,
    validFrom: today,
    validTo: dayB,
    runningDays: [getWeekdayForAppDate(dayA), getWeekdayForAppDate(dayB)],
    departureTime: "23:59",
    arrivalTime: "05:00",
    busType: "AC Seater",
    totalSeats: 36,
    fare: 100,
    active: true,
  });

  try {
    const templateWithLegacyStatus = {
      ...schedule.toObject(),
      seats: generateDefaultSeatLayout(36, 100, "AC Seater").map((seat, index) =>
        index === 0 ? { ...seat, isBooked: true, isLocked: true, lockedBy: "legacy" } : seat
      ),
    };
    const results = await Promise.all(Array.from({ length: 50 }, () => ensureTripForSchedule(templateWithLegacyStatus, dayA)));
    const uniqueTripIds = new Set(results.map((trip) => String(trip._id)));
    assert.equal(uniqueTripIds.size, 1, "Concurrent upserts must return a single dated Trip.");
    assert.equal(await Trip.countDocuments({ scheduleId: schedule._id, travelDate: dayA }), 1);
    assert.equal(results[0].seats.find((seat) => seat.seatNumber === "1").isBooked, false, "A schedule template's seat status must not leak to a new date.");
    console.log("PASS 50 concurrent trip upserts created one (schedule, date) Trip");

    const tripA = results[0];
    const tripB = await ensureTripForSchedule(schedule.toObject(), dayB);
    const now = new Date();
    const expiry = new Date(now.getTime() + 10 * 60 * 1000);
    const sameDateResults = await Promise.all(
      Array.from({ length: 50 }, (_, index) => holdSeatsAtomic(tripA._id, ["1"], `verify-session-${index}`, expiry, now))
    );
    assert.equal(sameDateResults.filter(Boolean).length, 1, "Exactly one concurrent hold may win on the same dated Trip.");
    const otherDateHold = await holdSeatsAtomic(tripB._id, ["1"], "verify-other-date", expiry, now);
    assert.equal(otherDateHold, 1, "The same seat should be independently holdable on another date.");

    const heldA = await Trip.findById(tripA._id).lean();
    const winningHold = heldA.seats.find((seat) => seat.seatNumber === "1");
    await Trip.updateOne(
      { _id: tripB._id, seats: { $elemMatch: { seatNumber: "1", lockedBy: "verify-other-date", isBooked: false } } },
      { $set: { "seats.$[seat].isLocked": false, "seats.$[seat].lockedBy": null, "seats.$[seat].lockedAt": null, "seats.$[seat].holdExpiresAt": null } },
      { arrayFilters: [{ "seat.seatNumber": "1" }] }
    );
    const bookedA = await Trip.updateOne(
      {
        _id: tripA._id,
        seats: { $elemMatch: { seatNumber: "1", isLocked: true, isBooked: false, lockedBy: winningHold.lockedBy, holdExpiresAt: { $gt: now } } },
      },
      {
        $set: { "seats.$[seat].isBooked": true, "seats.$[seat].isLocked": false, "seats.$[seat].lockedBy": null, "seats.$[seat].lockedAt": null, "seats.$[seat].holdExpiresAt": null },
        $inc: { availableSeats: -1 },
      },
      { arrayFilters: [{ "seat.seatNumber": "1" }] }
    );
    assert.equal(bookedA.matchedCount, 1);
    const afterA = await Trip.findById(tripA._id).lean();
    const afterB = await Trip.findById(tripB._id).lean();
    assert.equal(afterA.seats.find((seat) => seat.seatNumber === "1").isBooked, true);
    assert.equal(afterB.seats.find((seat) => seat.seatNumber === "1").isBooked, false);
    assert.equal(afterB.availableSeats, afterB.totalSeats);
    console.log("PASS same seat holds on different dates; booking date A leaves it available on date B; exactly one of 50 same-date holds wins");

    await expectCode(() => ensureTripForSchedule(schedule.toObject(), dayC), "NOT_RUNNING_ON_DATE");
    console.log("PASS a non-running date is rejected with NOT_RUNNING_ON_DATE");
  } finally {
    await Trip.deleteMany({ scheduleId: schedule._id });
    await Bus.deleteOne({ _id: schedule._id });
    await mongoose.disconnect();
  }
}

async function main() {
  if (runUnit || (!runUnit && !runIntegration)) verifyDateRules();
  if (runIntegration) await verifyMongoConcurrency();
}

main().catch(async (error) => {
  console.error(`FAIL: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
