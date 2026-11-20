import { z } from "zod";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import BookingHold from "../models/BookingHold.js";
import TrainRun from "../models/TrainRun.js";
import asyncHandler from "../utils/asyncHandler.js";
import { normalizePhone, isValidIndianPhone } from "../utils/userFields.js";
import { makeBookingError, withBookingTransaction } from "../utils/travelBooking.js";
import { MAX_HOTEL_ROOMS, MAX_TRAIN_PASSENGERS } from "../config/travelBooking.js";

const guestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  age: z.coerce.number().int().min(0).max(120).optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
});

const passengerSchema = guestSchema.extend({
  age: z.coerce.number().int().min(1).max(120),
  gender: z.enum(["Male", "Female", "Other"]),
  berthPreference: z.enum(["No preference", "Lower", "Middle", "Upper", "Side lower", "Side upper"]).default("No preference"),
});

export const travelBookingSchema = z.discriminatedUnion("bookingType", [
  z.object({
    bookingType: z.literal("train"),
    holdId: z.string().refine(mongoose.isValidObjectId, "Invalid booking hold."),
    passengers: z.array(passengerSchema).min(1).max(MAX_TRAIN_PASSENGERS),
    contact: z.object({ email: z.string().trim().email().max(254), phone: z.string().trim().min(1).max(32) }),
  }),
  z.object({
    bookingType: z.literal("hotel"),
    holdId: z.string().refine(mongoose.isValidObjectId, "Invalid booking hold."),
    leadGuest: guestSchema,
    guests: z.array(guestSchema).min(1).max(MAX_HOTEL_ROOMS * 6),
    contact: z.object({ email: z.string().trim().email().max(254), phone: z.string().trim().min(1).max(32) }),
    specialRequest: z.string().trim().max(500).optional().default(""),
  }),
]);

function validateContact(contact) {
  const phone = normalizePhone(contact.phone);
  if (!phone || !isValidIndianPhone(phone)) {
    throw makeBookingError("Enter a valid 10-digit Indian contact number.");
  }
  return { email: contact.email.toLowerCase(), phone };
}

function bookingResponse(booking, created) {
  return {
    success: true,
    message: created ? "Booking reservation created. Complete payment to confirm." : "Existing booking reservation returned.",
    data: booking,
    booking,
    requiresPayment: booking.status !== "CONFIRMED",
    paymentEndpoint: "/api/payment/create-order",
  };
}

export const createTravelBooking = asyncHandler(async (req, res) => {
  if (!req.user?._id) throw makeBookingError("Login is required to book a train or hotel.", 401, "AUTH_REQUIRED");
  const data = req.validated.body;
  const contact = validateContact(data.contact);

  const hold = await BookingHold.findOne({
    _id: data.holdId,
    userId: req.user._id,
    bookingType: data.bookingType,
  }).lean();
  if (!hold) throw makeBookingError("A valid hold is required before creating a booking.", 409, "HOLD_REQUIRED");
  if (hold.status !== "HELD" || hold.expiresAt <= new Date()) {
    throw makeBookingError("The booking hold has expired. Select availability again.", 409, "HOLD_EXPIRED");
  }

  if (data.bookingType === "train" && data.passengers.length !== hold.passengerCount) {
    throw makeBookingError("Passenger count must match the held train seats.");
  }
  if (data.bookingType === "hotel" &&
      (data.guests.length !== hold.snapshot.guests || data.leadGuest.name !== data.guests[0].name)) {
    throw makeBookingError("Guest details must match the held guest count and lead guest.");
  }
  const existing = await Booking.findOne({ holdId: hold._id }).lean();
  if (existing) return res.status(200).json(bookingResponse(existing, false));

  let trainRun = null;
  if (data.bookingType === "train") {
    trainRun = await TrainRun.findOne({ _id: hold.trainRunId, status: "SCHEDULED" }).lean();
    if (!trainRun || trainRun.departureAt <= new Date()) {
      throw makeBookingError("This train run is no longer available.", 409, "TRAIN_RUN_UNAVAILABLE");
    }
  }

  const fareBreakdown = {
    baseFare: hold.baseFare,
    tax: hold.tax,
    charges: hold.charges,
    totalAmount: hold.totalAmount,
  };
  const common = {
    bookingId: undefined,
    userId: req.user._id,
    userEmail: contact.email,
    userName: data.bookingType === "train" ? data.passengers[0].name : data.leadGuest.name,
    userPhone: contact.phone,
    bookingType: data.bookingType,
    holdId: hold._id,
    date: data.bookingType === "train" ? hold.travelDate : hold.checkIn,
    time: data.bookingType === "train" ? "Scheduled departure" : hold.snapshot.checkInTime,
    amount: hold.totalAmount,
    baseFare: hold.baseFare,
    tax: hold.tax,
    totalAmount: hold.totalAmount,
    fareBreakdown,
    status: "PENDING",
    paymentStatus: "PENDING",
    refundStatus: "NOT_APPLICABLE",
  };
  const bookingData = data.bookingType === "train"
    ? {
        ...common,
        vertical: "Train",
        trainRunId: hold.trainRunId,
        trainScheduleId: trainRun.scheduleId,
        fromStation: hold.snapshot.fromStation,
        toStation: hold.snapshot.toStation,
        fromStationCode: hold.snapshot.fromStationCode,
        toStationCode: hold.snapshot.toStationCode,
        fromCity: hold.snapshot.fromCity,
        toCity: hold.snapshot.toCity,
        departureAt: hold.snapshot.departureAt,
        arrivalAt: hold.snapshot.arrivalAt,
        trainClass: hold.classCode,
        trainNumber: hold.snapshot.trainNumber,
        operator: hold.snapshot.trainName,
        title: `${hold.snapshot.trainName} (${hold.snapshot.trainNumber})`,
        seats: `${hold.passengerCount} passenger(s) · ${hold.classCode}`,
        passengers: data.passengers.map((passenger) => ({
          ...passenger,
          seatNumber: "",
          berthPreference: passenger.berthPreference,
        })),
        fareBreakdown: { ...fareBreakdown, farePerPassenger: trainRun.classInventory.find((item) => item.code === hold.classCode)?.fare },
      }
    : {
        ...common,
        vertical: "Hotel",
        hotelId: hold.hotelId,
        roomTypeId: hold.roomTypeId,
        roomTypeName: hold.snapshot.roomTypeName,
        hotelAddress: hold.snapshot.hotelAddress,
        checkIn: hold.checkIn,
        checkOut: hold.checkOut,
        checkInTime: hold.snapshot.checkInTime,
        checkOutTime: hold.snapshot.checkOutTime,
        nights: hold.snapshot.nights,
        roomCount: hold.roomCount,
        guests: data.guests,
        specialRequest: data.specialRequest,
        cancellationPolicy: hold.snapshot.cancellationPolicy,
        fromCity: hold.snapshot.city,
        operator: hold.snapshot.hotelName,
        title: `${hold.snapshot.hotelName} · ${hold.snapshot.roomTypeName}`,
        seats: `${hold.roomCount} room(s) · ${data.guests.length} guest(s)`,
        fareBreakdown,
      };

  try {
    const booking = await withBookingTransaction(async (session) => {
      const currentHold = await BookingHold.findOne({
        _id: hold._id,
        userId: req.user._id,
        status: "HELD",
        expiresAt: { $gt: new Date() },
        bookingId: { $exists: false },
      }).session(session);
      if (!currentHold) {
        const found = await Booking.findOne({ holdId: hold._id }).session(session);
        if (found) return found;
        throw makeBookingError("The booking hold expired or was already used.", 409, "HOLD_EXPIRED");
      }
      const [created] = await Booking.create([bookingData], { session });
      currentHold.bookingId = created._id;
      await currentHold.save({ session });
      return created;
    });
    const response = bookingResponse(booking, true);
    return res.status(201).json(response);
  } catch (error) {
    if (error.code === 11000) {
      const booking = await Booking.findOne({ holdId: hold._id }).lean();
      if (booking) return res.status(200).json(bookingResponse(booking, false));
    }
    throw error;
  }
});

export default { createTravelBooking };
