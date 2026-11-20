import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config(); // fallback
import dns from "node:dns";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import Trip from "../src/models/Trip.js";
import Booking from "../src/models/Booking.js";
import Payment from "../src/models/Payment.js";
import User from "../src/models/User.js";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // ignore
}

async function runConcurrencyAudit() {
  console.log("==========================================================");
  console.log("🚀 PHASE 4: HIGH-CONCURRENCY SEAT BOOKING RACE-CONDITION TEST");
  console.log("==========================================================");

  await connectDB();

  const testTripId = new mongoose.Types.ObjectId();
  const testUserId = new mongoose.Types.ObjectId();

  console.log(`\n📋 Initializing isolated test trip (ID: ${testTripId})...`);

  // Build 36 test seats: L1 to L36
  const testSeats = Array.from({ length: 36 }, (_, i) => ({
    seatNumber: `L${i + 1}`,
    deck: "lower",
    row: Math.floor(i / 4) + 1,
    col: (i % 4) + 1,
    type: "seater",
    fare: 500,
    isBooked: false,
    isLocked: false,
    lockedBy: null,
    lockedAt: null,
    holdExpiresAt: null,
  }));

  const testTrip = await Trip.create({
    _id: testTripId,
    operator: "Concurrency Audit Express",
    busNumber: "CONC-9999",
    fromCity: "Mumbai",
    toCity: "Pune",
    journeyDate: "2026-12-01",
    departureTime: "10:00",
    arrivalTime: "14:00",
    duration: "4h 00m",
    busType: "AC Seater",
    fare: 500,
    price: 500,
    totalSeats: 36,
    availableSeats: 36,
    seats: testSeats,
  });

  console.log(`✅ Test trip created with ${testTrip.totalSeats} available seats.`);

  // =========================================================================
  // TEST 1: 120 Concurrent Requests Firing at the EXACT SAME SEAT (Seat L1)
  // =========================================================================
  console.log("\n----------------------------------------------------------");
  console.log("🧪 TEST 1: 120 Concurrent Requests for the EXACT SAME SEAT (L1)");
  console.log("----------------------------------------------------------");

  const CONCURRENT_USERS_TEST1 = 120;
  const targetSeat = "L1";

  // Simulate atomic lock request as implemented in busController.lockSeats
  const executeLockAttempt = async (userIndex) => {
    const sessionId = `session_sim_${userIndex}_${Date.now()}`;
    const now = new Date();

    const startTime = Date.now();
    try {
      const updateResult = await Trip.updateOne(
        {
          _id: testTripId,
          availableSeats: { $gte: 1 },
          seats: {
            $elemMatch: {
              seatNumber: targetSeat,
              isBooked: false,
              $or: [
                { isLocked: false },
                { holdExpiresAt: { $lt: now } },
                { lockedBy: sessionId },
              ],
            },
          },
        },
        {
          $set: {
            "seats.$[elem].isLocked": true,
            "seats.$[elem].lockedBy": sessionId,
            "seats.$[elem].lockedAt": now,
            "seats.$[elem].holdExpiresAt": new Date(now.getTime() + 10 * 60 * 1000),
          },
        },
        {
          arrayFilters: [{ "elem.seatNumber": targetSeat }],
        }
      );

      const durationMs = Date.now() - startTime;

      if (updateResult.matchedCount > 0 && updateResult.modifiedCount > 0) {
        return { success: true, userIndex, durationMs, sessionId };
      } else {
        return { success: false, conflict: true, userIndex, durationMs };
      }
    } catch (err) {
      return { success: false, error: err.message, userIndex, durationMs: Date.now() - startTime };
    }
  };

  const startTime1 = Date.now();
  console.log(`⚡ Firing ${CONCURRENT_USERS_TEST1} simultaneous requests via Promise.all...`);

  const resultsTest1 = await Promise.all(
    Array.from({ length: CONCURRENT_USERS_TEST1 }, (_, i) => executeLockAttempt(i + 1))
  );

  const totalTime1 = Date.now() - startTime1;

  const successes1 = resultsTest1.filter((r) => r.success);
  const conflicts1 = resultsTest1.filter((r) => r.conflict);
  const errors1 = resultsTest1.filter((r) => r.error);

  console.log(`\n📊 TEST 1 RESULTS:`);
  console.log(`- Total Requests:      ${resultsTest1.length}`);
  console.log(`- Successful Locks:    ${successes1.length} (Expected: EXACTLY 1)`);
  console.log(`- Blocked / 409s:      ${conflicts1.length} (Expected: ${CONCURRENT_USERS_TEST1 - 1})`);
  console.log(`- Errors / Exceptions: ${errors1.length} (Expected: 0)`);
  console.log(`- Total Wall Time:     ${totalTime1}ms`);
  console.log(`- Avg Request Latency: ${(resultsTest1.reduce((acc, r) => acc + r.durationMs, 0) / resultsTest1.length).toFixed(1)}ms`);

  // Verify DB state
  const updatedTrip1 = await Trip.findById(testTripId);
  const seatL1 = updatedTrip1.seats.find((s) => s.seatNumber === targetSeat);
  const allLockedSeatsCount = updatedTrip1.seats.filter((s) => s.isLocked).length;

  console.log(`\n🔍 DATABASE VERIFICATION (TEST 1):`);
  console.log(`- Seat L1 isLocked:       ${seatL1.isLocked}`);
  console.log(`- Seat L1 lockedBy:       ${seatL1.lockedBy}`);
  console.log(`- Total seats locked:     ${allLockedSeatsCount} (Expected: 1)`);
  console.log(`- Winner Session:         ${successes1[0]?.sessionId}`);

  const test1Passed =
    successes1.length === 1 &&
    conflicts1.length === CONCURRENT_USERS_TEST1 - 1 &&
    errors1.length === 0 &&
    allLockedSeatsCount === 1;

  console.log(`\n>>> TEST 1 RESULT: ${test1Passed ? "✅ PASSED (NO RACE CONDITION)" : "❌ FAILED"}`);

  // =========================================================================
  // TEST 2: 100 Concurrent Booking Confirmations with Mixed & Overlapping Seats
  // =========================================================================
  console.log("\n----------------------------------------------------------");
  console.log("🧪 TEST 2: 100 Concurrent Booking Confirmations (Multi-Seat & Overlapping)");
  console.log("----------------------------------------------------------");

  // Reset seats for trip
  await Trip.updateOne(
    { _id: testTripId },
    {
      $set: {
        availableSeats: 36,
        "seats.$[].isBooked": false,
        "seats.$[].isLocked": false,
        "seats.$[].lockedBy": null,
        "seats.$[].lockedAt": null,
        "seats.$[].holdExpiresAt": null,
      },
    }
  );

  const CONCURRENT_BOOKERS_TEST2 = 100;
  // Each user tries to book 2 adjacent seats from a pool of seats (L1-L10 have high contention)
  const executeBookingAttempt = async (index) => {
    // Generate overlapping seat pairs: User 1 wants [L1, L2], User 2 wants [L2, L3], User 3 wants [L1, L2], etc.
    const seatA = `L${(index % 12) + 1}`;
    const seatB = `L${((index + 1) % 12) + 1}`;
    const seatsToBook = [...new Set([seatA, seatB])].sort();

    const userSimId = new mongoose.Types.ObjectId();
    const orderId = `order_sim_${index}_${Date.now()}`;
    const now = new Date();

    const start = Date.now();
    try {
      // 1. Guarded atomic decrement & reservation
      const updateResult = await Trip.updateOne(
        {
          _id: testTripId,
          availableSeats: { $gte: seatsToBook.length },
          $and: seatsToBook.map((sNum) => ({
            seats: {
              $elemMatch: {
                seatNumber: sNum,
                isBooked: false,
              },
            },
          })),
        },
        {
          $set: {
            "seats.$[elem].isBooked": true,
            "seats.$[elem].isLocked": false,
            "seats.$[elem].lockedBy": null,
            "seats.$[elem].lockedAt": null,
            "seats.$[elem].holdExpiresAt": null,
          },
          $inc: { availableSeats: -seatsToBook.length },
        },
        {
          arrayFilters: [{ "elem.seatNumber": { $in: seatsToBook } }],
        }
      );

      if (!updateResult || updateResult.matchedCount === 0) {
        return { success: false, conflict: true, index, seatsToBook, durationMs: Date.now() - start };
      }

      // 2. Create booking record
      const booking = await Booking.create({
        bookingId: `RDB-SIM-${index}-${Date.now().toString().slice(-4)}`,
        userId: userSimId,
        userEmail: `tester${index}@redbusconcurrency.local`,
        userName: `Tester ${index}`,
        userPhone: `98765432${index.toString().padStart(2, "0")}`,
        tripId: testTripId,
        vertical: "Bus",
        title: "Mumbai to Pune Concurrency Run",
        operator: "Concurrency Audit Express",
        busNumber: "CONC-9999",
        fromCity: "Mumbai",
        toCity: "Pune",
        date: "2026-12-01",
        time: "10:00",
        seats: seatsToBook.join(", "),
        seatNumbers: seatsToBook,
        passengers: seatsToBook.map((s) => ({ seatNumber: s, name: `Passenger ${s}`, age: 25, gender: "Male" })),
        amount: seatsToBook.length * 500,
        totalAmount: seatsToBook.length * 500,
        paymentStatus: "PAID",
        status: "CONFIRMED",
      });

      return { success: true, index, seatsToBook, bookingId: booking.bookingId, durationMs: Date.now() - start };
    } catch (err) {
      return { success: false, error: err.message, index, seatsToBook, durationMs: Date.now() - start };
    }
  };

  console.log(`⚡ Firing ${CONCURRENT_BOOKERS_TEST2} simultaneous booking transactions across contentious seats...`);
  const resultsTest2 = await Promise.all(
    Array.from({ length: CONCURRENT_BOOKERS_TEST2 }, (_, i) => executeBookingAttempt(i + 1))
  );

  const successes2 = resultsTest2.filter((r) => r.success);
  const conflicts2 = resultsTest2.filter((r) => r.conflict);
  const errors2 = resultsTest2.filter((r) => r.error);

  console.log(`\n📊 TEST 2 RESULTS:`);
  console.log(`- Total Concurrent Attempts: ${resultsTest2.length}`);
  console.log(`- Confirmed Bookings:        ${successes2.length}`);
  console.log(`- Conflict Rejections (409): ${conflicts2.length}`);
  console.log(`- Unexpected Errors:         ${errors2.length} (Expected: 0)`);

  // Verify database consistency and constraint invariants
  const finalTripState = await Trip.findById(testTripId);
  const createdBookings = await Booking.find({ tripId: testTripId, status: "CONFIRMED" });

  const allBookedSeatsInBookings = createdBookings.flatMap((b) => b.seatNumbers);
  const uniqueBookedSeatsInBookings = new Set(allBookedSeatsInBookings);
  const seatsMarkedBookedOnTrip = finalTripState.seats.filter((s) => s.isBooked).map((s) => s.seatNumber);

  console.log(`\n🔍 INVARIANT AUDIT (TEST 2):`);
  console.log(`- Total Seats in Trip:          ${finalTripState.totalSeats}`);
  console.log(`- Available Seats Remaining:     ${finalTripState.availableSeats}`);
  console.log(`- Seats marked booked in Trip:   ${seatsMarkedBookedOnTrip.length}`);
  console.log(`- Total booked seats in tickets: ${allBookedSeatsInBookings.length}`);
  console.log(`- Unique booked seats:           ${uniqueBookedSeatsInBookings.size}`);

  const hasNoDuplicateSeatsInTickets = allBookedSeatsInBookings.length === uniqueBookedSeatsInBookings.size;
  const availableSeatsConsistent = finalTripState.availableSeats === finalTripState.totalSeats - seatsMarkedBookedOnTrip.length;
  const noNegativeAvailableSeats = finalTripState.availableSeats >= 0;
  const totalBookingsWithinCapacity = seatsMarkedBookedOnTrip.length <= finalTripState.totalSeats;

  console.log(`- Check 1: No duplicate seats across tickets:   ${hasNoDuplicateSeatsInTickets ? "PASS ✅" : "FAIL ❌"}`);
  console.log(`- Check 2: availableSeats arithmetic matches:    ${availableSeatsConsistent ? "PASS ✅" : "FAIL ❌"}`);
  console.log(`- Check 3: availableSeats never went negative:   ${noNegativeAvailableSeats ? "PASS ✅" : "FAIL ❌"}`);
  console.log(`- Check 4: Booked seats <= total trip capacity:  ${totalBookingsWithinCapacity ? "PASS ✅" : "FAIL ❌"}`);

  const test2Passed =
    hasNoDuplicateSeatsInTickets &&
    availableSeatsConsistent &&
    noNegativeAvailableSeats &&
    totalBookingsWithinCapacity &&
    errors2.length === 0;

  console.log(`\n>>> TEST 2 RESULT: ${test2Passed ? "✅ PASSED (PERFECT INTEGRITY)" : "❌ FAILED"}`);

  // =========================================================================
  // CLEANUP TEST DATA
  // =========================================================================
  console.log("\n🧹 Cleaning up test artifacts...");
  await Trip.deleteOne({ _id: testTripId });
  await Booking.deleteMany({ tripId: testTripId });
  console.log("✅ Cleanup complete.");

  console.log("\n==========================================================");
  if (test1Passed && test2Passed) {
    console.log("🎉 ALL CONCURRENCY INVARIANTS SATISFIED! ZERO RACE CONDITIONS!");
  } else {
    console.log("❌ ONE OR MORE CONCURRENCY CHECKS FAILED!");
  }
  console.log("==========================================================");

  await mongoose.disconnect();
}

runConcurrencyAudit().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
