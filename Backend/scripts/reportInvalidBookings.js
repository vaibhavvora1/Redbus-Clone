import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

import Booking from "../src/models/Booking.js";
import Payment from "../src/models/Payment.js";
import Trip from "../src/models/Trip.js";

async function reportInvalidBookings() {
  console.log("==================================================================");
  console.log("🔍 REDBUS CLONE — READ-ONLY BOOKING & DATA INTEGRITY AUDIT SCRIPT");
  console.log("==================================================================");

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("❌ MONGODB_URI not found in environment variables.");
    process.exit(1);
  }

  console.log("📡 Connecting to MongoDB...");
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
    console.log(" Connected to MongoDB successfully.\n");
  } catch (err) {
    console.error("❌ Could not connect to MongoDB:", err.message);
    console.log("ℹ️ In isolated environments without Atlas access, this check can be run locally using direct mongo credentials.");
    process.exit(1);
  }

  try {
    const allBookings = await Booking.find({}).lean();
    console.log(`📊 Total Bookings in Database: ${allBookings.length}`);

    const anomalies = {
      confirmedWithoutPayment: [],
      emptySeats: [],
      missingPassengers: [],
      missingTrip: [],
      seatTripMismatch: [],
    };

    for (const b of allBookings) {
      const pnr = b.bookingId || b._id.toString();

      // 1. Check for confirmed status without successful payment
      if (b.status === "CONFIRMED" || b.paymentStatus === "PAID") {
        let hasValidPayment = false;
        if (b.paymentId) {
          const p = await Payment.findById(b.paymentId).lean();
          if (p && (p.status === "SUCCESS" || p.method === "sandbox")) {
            hasValidPayment = true;
          }
        }
        if (!hasValidPayment) {
          // Check if there is any payment matching bookingId
          const pByBooking = await Payment.findOne({
            $or: [{ bookingId: b._id }, { razorpayOrderId: b.idempotencyKey }],
            status: "SUCCESS",
          }).lean();
          if (pByBooking) {
            hasValidPayment = true;
          }
        }

        if (!hasValidPayment) {
          anomalies.confirmedWithoutPayment.push({
            pnr,
            title: b.title,
            amount: b.amount,
            createdAt: b.createdAt,
          });
        }
      }

      // 2. Check for empty seats
      const seats = b.seatNumbers?.length
        ? b.seatNumbers
        : String(b.seats || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

      if (seats.length === 0) {
        anomalies.emptySeats.push({ pnr, title: b.title });
      }

      // 3. Check for passenger validation
      const passengers = Array.isArray(b.passengers) ? b.passengers : [];
      if (b.status === "CONFIRMED" && passengers.length !== seats.length) {
        anomalies.missingPassengers.push({
          pnr,
          seatCount: seats.length,
          passengerCount: passengers.length,
        });
      }

      // 4. Check trip existence & seat synchronization
      if (b.tripId) {
        const trip = await Trip.findById(b.tripId).lean();
        if (!trip) {
          anomalies.missingTrip.push({ pnr, tripId: b.tripId });
        } else if (b.status === "CONFIRMED") {
          // Check if seats are marked booked in trip
          const tripBookedSeats = (trip.seats || [])
            .filter((s) => s.isBooked)
            .map((s) => s.seatNumber);

          const unbookedInTrip = seats.filter((s) => !tripBookedSeats.includes(s));
          if (unbookedInTrip.length > 0) {
            anomalies.seatTripMismatch.push({
              pnr,
              tripId: trip._id,
              mismatchedSeats: unbookedInTrip,
            });
          }
        }
      }
    }

    console.log("\n---------------- AUDIT RESULTS ----------------");
    console.log(`1. Confirmed/Paid bookings without Payment record: ${anomalies.confirmedWithoutPayment.length}`);
    if (anomalies.confirmedWithoutPayment.length > 0) {
      console.table(anomalies.confirmedWithoutPayment);
    }

    console.log(`2. Bookings with empty seats: ${anomalies.emptySeats.length}`);
    if (anomalies.emptySeats.length > 0) {
      console.table(anomalies.emptySeats);
    }

    console.log(`3. Bookings with passenger/seat count mismatch: ${anomalies.missingPassengers.length}`);
    if (anomalies.missingPassengers.length > 0) {
      console.table(anomalies.missingPassengers);
    }

    console.log(`4. Bookings referencing non-existent trips: ${anomalies.missingTrip.length}`);
    if (anomalies.missingTrip.length > 0) {
      console.table(anomalies.missingTrip);
    }

    console.log(`5. Confirmed seats not marked booked in Trip document: ${anomalies.seatTripMismatch.length}`);
    if (anomalies.seatTripMismatch.length > 0) {
      console.table(anomalies.seatTripMismatch);
    }

    console.log("-----------------------------------------------");
    console.log("✅ Audit completed. No data was modified (Read-Only).\n");
  } catch (err) {
    console.error("Audit error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

reportInvalidBookings();
