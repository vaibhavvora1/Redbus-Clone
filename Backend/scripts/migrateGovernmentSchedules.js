import "dotenv/config";
import mongoose from "mongoose";
import Bus from "../src/models/Bus.js";
import Booking from "../src/models/Booking.js";
import Operator from "../src/models/Operator.js";
import Trip from "../src/models/Trip.js";
import { generateDefaultSeatLayout } from "../src/utils/seatLayout.js";
import { combineDateAndTime, getTodayInAppTZ, hasDeparted } from "../src/utils/timeZone.js";

const applyChanges = process.argv.includes("--apply");
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function getBookingDate(booking, fallback) {
  return datePattern.test(String(booking.date || "")) ? booking.date : fallback;
}

function mergeSeatStatus(targetSeats, sourceSeats = []) {
  const byNumber = new Map((targetSeats || []).map((seat) => [String(seat.seatNumber), seat]));
  for (const source of sourceSeats) {
    const target = byNumber.get(String(source.seatNumber));
    if (!target) {
      byNumber.set(String(source.seatNumber), { ...source });
      continue;
    }
    if (source.isBooked) {
      target.isBooked = true;
      target.isLocked = false;
      target.lockedBy = null;
      target.lockedAt = null;
      target.holdExpiresAt = null;
    }
  }
  return [...byNumber.values()];
}

async function createMigrationTrip(schedule, travelDate) {
  const existing = await Trip.findOne({ scheduleId: schedule._id, travelDate }).lean();
  if (existing) return existing;

  const departureTime = schedule.departureTime || "21:00";
  const fare = Number(schedule.fare ?? schedule.price ?? 0);
  const totalSeats = Number(schedule.totalSeats || 36);
  const busType = schedule.busType || schedule.type || "AC Sleeper";
  const trip = new Trip({
    bus: schedule._id,
    scheduleId: schedule._id,
    operator: schedule.operator,
    busNumber: schedule.busNumber || "",
    fromCity: schedule.fromCity || schedule.from,
    toCity: schedule.toCity || schedule.to,
    journeyDate: travelDate,
    travelDate,
    departureAt: combineDateAndTime(travelDate, departureTime),
    departureTime,
    arrivalTime: schedule.arrivalTime || "06:00",
    duration: schedule.duration || "8h 30m",
    busType,
    fare,
    price: fare,
    totalSeats,
    availableSeats: totalSeats,
    rating: schedule.rating || "4.5",
    amenities: schedule.amenities || [],
    boardingPoints: schedule.boardingPoints?.length
      ? schedule.boardingPoints
      : [{ name: `${schedule.fromCity || schedule.from} Main Terminal`, time: departureTime }],
    droppingPoints: schedule.droppingPoints?.length
      ? schedule.droppingPoints
      : [{ name: `${schedule.toCity || schedule.to} Central Station`, time: schedule.arrivalTime || "06:00" }],
    seats: generateDefaultSeatLayout(totalSeats, fare, busType),
    status: hasDeparted({ travelDate, departureTime }) ? "departed" : "scheduled",
    isGovernment: true,
    active: true,
  });
  return trip.save();
}

async function main() {
  console.log(`Mode: ${applyChanges ? "APPLY" : "DRY RUN (read only)"}`);
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured. Set it in Backend/.env or the process environment.");
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });

  const governmentOperators = await Operator.find({ isGovernment: true }).select("name").lean();
  const names = new Set(governmentOperators.map((operator) => String(operator.name || "").toLowerCase()));
  const allBuses = await Bus.collection.find({}).toArray();
  const governmentBuses = allBuses.filter((bus) => bus.isGovernment || names.has(String(bus.operator || "").toLowerCase()));

  const plans = [];
  for (const bus of governmentBuses) {
    const originalDate = datePattern.test(String(bus.journeyDate || "")) ? bus.journeyDate : getTodayInAppTZ();
    const trips = await Trip.collection.find({
      $or: [{ bus: bus._id }, { scheduleId: bus._id }],
      migrationDuplicateOf: { $exists: false },
    }).toArray();
    const directBookings = await Booking.find({ tripId: bus._id }).lean();
    const travelDates = new Set([originalDate]);
    for (const trip of trips) {
      const date = trip.travelDate || trip.journeyDate;
      if (datePattern.test(String(date || ""))) travelDates.add(date);
    }
    for (const booking of directBookings) travelDates.add(getBookingDate(booking, originalDate));
    plans.push({ bus, originalDate, trips, directBookings, dates: [...travelDates].sort() });
  }

  console.log(`Government operators recognized: ${names.size}`);
  console.log(`Government buses found: ${plans.length}`);
  console.log(`Trips already linked to government buses: ${plans.reduce((sum, plan) => sum + plan.trips.length, 0)}`);
  console.log(`Bookings still linked directly to Bus documents: ${plans.reduce((sum, plan) => sum + plan.directBookings.length, 0)}`);
  for (const plan of plans) {
    const existingByDate = new Map();
    for (const trip of plan.trips) {
      const date = trip.travelDate || trip.journeyDate;
      existingByDate.set(date, (existingByDate.get(date) || 0) + 1);
    }
    console.log(
      `- ${plan.bus.operator} ${plan.bus.busNumber || "(no bus number)"}: schedule valid from ${plan.bus.validFrom || plan.originalDate}; dates [${plan.dates.join(", " )}]; existing trip records ${plan.trips.length}; direct bookings ${plan.directBookings.length}; root seat array ${Array.isArray(plan.bus.seats) ? plan.bus.seats.length : 0}; duplicate trip dates ${[...existingByDate.values()].filter((count) => count > 1).length}`
    );
  }

  if (applyChanges) {
    let createdTrips = 0;
    let movedBookings = 0;
    let mergedDuplicates = 0;
    for (const plan of plans) {
      const runningDays = Array.isArray(plan.bus.runningDays)
        ? plan.bus.runningDays
        : [0, 1, 2, 3, 4, 5, 6];
      const validFrom = plan.bus.validFrom || plan.originalDate;
      await Bus.collection.updateOne(
        { _id: plan.bus._id },
        {
          $set: {
            isGovernment: true,
            runningDays,
            validFrom,
            validTo: plan.bus.validTo || "",
            active: plan.bus.active !== false,
          },
        }
      );

      const grouped = new Map();
      for (const oldTrip of plan.trips) {
        const date = oldTrip.travelDate || oldTrip.journeyDate;
        if (!datePattern.test(String(date || ""))) continue;
        if (!grouped.has(date)) grouped.set(date, []);
        grouped.get(date).push(oldTrip);
      }

      const schedule = await Bus.findById(plan.bus._id).lean();
      for (const date of plan.dates) {
        const candidates = grouped.get(date) || [];
        candidates.sort((a, b) => Number(String(b.scheduleId) === String(plan.bus._id)) - Number(String(a.scheduleId) === String(plan.bus._id)));
        const canonical = candidates[0] || null;
        let combinedSeats = canonical?.seats || [];
        for (const duplicate of candidates.slice(1)) {
          combinedSeats = mergeSeatStatus(combinedSeats, duplicate.seats || []);
          await Booking.collection.updateMany({ tripId: duplicate._id }, { $set: { tripId: canonical._id } });
          await Trip.collection.updateOne(
            { _id: duplicate._id },
            { $unset: { scheduleId: "" }, $set: { migrationDuplicateOf: canonical._id, status: "cancelled", active: false } }
          );
          mergedDuplicates += 1;
        }

        let trip = canonical
          ? await Trip.findByIdAndUpdate(
              canonical._id,
              {
                $set: {
                  bus: plan.bus._id,
                  scheduleId: plan.bus._id,
                  travelDate: date,
                  journeyDate: date,
                  departureAt: combineDateAndTime(date, schedule.departureTime || "21:00"),
                  status: canonical.status || "scheduled",
                  isGovernment: true,
                  seats: combinedSeats,
                },
              },
              { new: true }
            )
          : null;

        if (!trip) {
          trip = await createMigrationTrip(schedule, date);
          createdTrips += 1;
        }

        if (date === plan.originalDate && Array.isArray(plan.bus.seats) && plan.bus.seats.length) {
          trip.seats = mergeSeatStatus(trip.seats || [], plan.bus.seats);
        }

        const directForDate = plan.directBookings.filter((booking) => getBookingDate(booking, plan.originalDate) === date);
        for (const booking of directForDate) {
          await Booking.collection.updateOne({ _id: booking._id, tripId: plan.bus._id }, { $set: { tripId: trip._id } });
          movedBookings += 1;
        }

        const allTripBookings = await Booking.find({ tripId: trip._id }).select("status seatNumbers seats").lean();
        for (const booking of allTripBookings) {
          if (!["CONFIRMED", "PENDING"].includes(booking.status)) continue;
          const seatNumbers = booking.seatNumbers?.length
            ? booking.seatNumbers
            : String(booking.seats || "").split(",").map((seat) => seat.trim()).filter(Boolean);
          for (const seat of trip.seats) {
            if (seatNumbers.includes(seat.seatNumber)) {
              seat.isBooked = true;
              seat.isLocked = false;
              seat.lockedBy = null;
              seat.lockedAt = null;
              seat.holdExpiresAt = null;
            }
          }
        }
        trip.availableSeats = Math.max(0, trip.totalSeats - trip.seats.filter((seat) => seat.isBooked).length);
        await trip.save();
      }
    }

    await Trip.collection.createIndex(
      { scheduleId: 1, travelDate: 1 },
      {
        unique: true,
        partialFilterExpression: {
          scheduleId: { $exists: true, $type: "objectId" },
          travelDate: { $type: "string" },
        },
        name: "unique_schedule_travel_date",
      }
    );
    await Trip.collection.createIndex({ fromCity: 1, toCity: 1, travelDate: 1, status: 1 });
    await Booking.collection.createIndex({ tripId: 1, status: 1 });
    await Booking.collection.createIndex({ userId: 1, date: -1 });
    console.log(`Applied: created ${createdTrips} trips, moved ${movedBookings} direct Bus bookings, retained and de-duplicated ${mergedDuplicates} duplicate Trip records without deleting them.`);
  } else {
    console.log("No database writes were made. Re-run with --apply only after reviewing this report.");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(`Migration stopped: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
