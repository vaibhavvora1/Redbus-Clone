import crypto from "crypto";
import mongoose from "mongoose";
import {
  HOTEL_BOOKING_FEE,
  HOTEL_TAX_RATE,
  TRAIN_TAX_RATE,
} from "../config/travelBooking.js";
import { addDaysToAppDate, getTodayInAppTZ } from "./timeZone.js";

export async function withBookingTransaction(work) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export function getIdempotencyKey(req) {
  const raw = req.get("Idempotency-Key") || req.body?.idempotencyKey;
  if (typeof raw !== "string" || raw.trim().length < 8 || raw.trim().length > 160) {
    const error = new Error("Provide an Idempotency-Key between 8 and 160 characters.");
    error.statusCode = 400;
    error.code = "IDEMPOTENCY_KEY_REQUIRED";
    throw error;
  }
  return raw.trim();
}

export function requestHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function makeBookingError(message, statusCode = 400, code = "VALIDATION_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function getNights(checkIn, checkOut, maxNights) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    throw makeBookingError("Check-in and check-out must use YYYY-MM-DD.");
  }
  if (checkIn < getTodayInAppTZ()) {
    throw makeBookingError("Check-in must be today or a future date.");
  }

  const dates = [];
  let current = checkIn;
  while (current < checkOut && dates.length <= maxNights) {
    dates.push(current);
    current = addDaysToAppDate(current, 1);
    if (!current) throw makeBookingError("Check-in or check-out is not a valid calendar date.");
  }
  if (current !== checkOut || dates.length === 0 || dates.length > maxNights) {
    throw makeBookingError(`Stay must be between 1 and ${maxNights} nights.`);
  }
  return dates;
}

export function calculateTrainFare(farePerPassenger, passengerCount) {
  const baseFare = Math.round(Number(farePerPassenger) * passengerCount);
  const tax = Math.round(baseFare * TRAIN_TAX_RATE);
  const charges = 0;
  return { baseFare, tax, charges, totalAmount: baseFare + tax + charges };
}

export function calculateHotelFare(pricePerNight, nights, roomCount) {
  const baseFare = Math.round(Number(pricePerNight) * nights * roomCount);
  const tax = Math.round(baseFare * HOTEL_TAX_RATE);
  const charges = HOTEL_BOOKING_FEE;
  return { baseFare, tax, charges, totalAmount: baseFare + tax + charges };
}
