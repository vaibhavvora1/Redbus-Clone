import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Trip from "../models/Trip.js";
import Payment from "../models/Payment.js";
import IdempotencyKey from "../models/IdempotencyKey.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  validatePassengersForSeats,
  calculateServerFares,
} from "../utils/bookingValidation.js";
import { generateTicketPdf } from "../utils/pdfGenerator.js";
import { getTodayInAppTZ } from "../utils/timeZone.js";
import { assertTripCanBeBooked, holdSeatsAtomic } from "../services/tripService.js";
import { processTravelRefund } from "../services/travelCancellation.js";

/**
 * Execute work inside a MongoDB transaction session when replica set is enabled;
 * gracefully falls back to direct execution if running on a standalone instance.
 */
async function withOptionalTransaction(workFn) {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch {
    session = null;
  }

  try {
    const result = await workFn(session);
    if (session) {
      await session.commitTransaction();
    }
    return result;
  } catch (err) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch {
        // ignore
      }
    }
    throw err;
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

/**
 * 1. GET ALL BOOKINGS (For current user or by email query)
 * GET /api/bookings
 */
export const getBookings = asyncHandler(async (req, res) => {
  const filter = req.user.role === "ADMIN"
    ? (req.query.userEmail ? { userEmail: String(req.query.userEmail).toLowerCase() } : {})
    : { userId: req.user._id };
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate("tripId", "travelDate journeyDate")
      .populate("paymentId", "razorpayOrderId razorpayPaymentId status")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);
  const data = bookings.map((booking) => {
    const tripDate = booking.tripId?.travelDate || booking.tripId?.journeyDate;
    return tripDate ? { ...booking, date: tripDate } : booking;
  });
  return res.status(200).json({
    success: true,
    count: data.length,
    total,
    page,
    limit,
    data,
  });
});

/**
 * 2. GET SINGLE BOOKING BY ID (by Mongo ObjectId or bookingId like RDB-XXXXXX)
 * GET /api/bookings/:id
 */
export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let booking = null;
  if (/^[0-9a-fA-F]{24}$/.test(id)) {
    booking = await Booking.findById(id).populate("tripId", "travelDate journeyDate").populate("paymentId", "razorpayOrderId razorpayPaymentId status");
  }

  if (!booking) {
    booking = await Booking.findOne({ bookingId: id }).populate("tripId", "travelDate journeyDate").populate("paymentId", "razorpayOrderId razorpayPaymentId status");
  }

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking not found.",
    });
  }

  // Ownership check: users can only access their own confirmed booking details
  if (req.user && req.user.role !== "ADMIN") {
    const isOwner =
      (booking.userId && String(booking.userId) === String(req.user._id)) ||
      (booking.userEmail && booking.userEmail.toLowerCase() === (req.user.email || "").toLowerCase()) ||
      (booking.userPhone && (booking.userPhone === req.user.phone || booking.userPhone === req.user.mobile));

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own booking confirmations.",
      });
    }
  }

  const responseBooking = booking.toObject();
  const tripDate = booking.tripId?.travelDate || booking.tripId?.journeyDate;
  if (tripDate) responseBooking.date = tripDate;

  return res.status(200).json({
    success: true,
    data: responseBooking,
    booking: responseBooking,
  });
});

/**
 * 3. CREATE BOOKING (STRICT VALIDATION & PAYMENT REPAIR/ENFORCEMENT)
 * POST /api/bookings
 *
 * Enforces:
 * - tripId is required and must exist
 * - seatNumbers are required, non-empty, and currently HELD by this user/session with non-expired hold
 * - passenger details are validated for every seat via Zod
 * - fare/total is recalculated on the server directly from the Trip
 * - STATUS CAN NEVER BECOME CONFIRMED/PAID without verified payment
 */
export const createBooking = asyncHandler(async (req, res) => {
  const idempotencyKey =
    req.headers["idempotency-key"] ||
    req.headers["x-idempotency-key"] ||
    req.body.idempotencyKey ||
    null;

  // 1. Idempotency Check
  if (idempotencyKey) {
    const cached = await IdempotencyKey.findOne({ key: idempotencyKey });
    if (cached) {
      return res.status(cached.statusCode).json(cached.responseBody);
    }
  }

  const {
    tripId,
    seatNumbers = [],
    seats,
    passengers = [],
    boardingPoint,
    droppingPoint,
    paymentId,
    sessionId,
  } = req.body;

  // Enforce tripId requirement
  if (!tripId) {
    return res.status(400).json({
      success: false,
      message: "Valid trip ID is strictly required to create a booking reservation.",
    });
  }

  // Parse and sort seat numbers canonically
  const rawSeats =
    Array.isArray(seatNumbers) && seatNumbers.length > 0
      ? seatNumbers
      : String(seats || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  const sortedSeats = [...new Set(rawSeats)].sort();

  if (sortedSeats.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one valid seat number is required.",
    });
  }

  // Verify trip exists
  const trip = await Trip.findById(tripId);
  if (!trip) {
    return res.status(404).json({
      success: false,
      code: "TRIP_NOT_FOUND",
      message: "Trip schedule not found in system.",
    });
  }
  await assertTripCanBeBooked(trip);

  // Validate passenger details for every seat using Zod schema
  const passengerValidation = validatePassengersForSeats(passengers, sortedSeats);
  if (!passengerValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: passengerValidation.message,
      errors: passengerValidation.errors || [],
    });
  }

  // Check active unexpired hold by this user / session
  const now = new Date();
  const userIdStr = req.user?._id ? String(req.user._id) : null;
  const effectiveIdentifier = userIdStr || sessionId || req.headers["x-session-id"] || null;

  for (const sNum of sortedSeats) {
    const seatDoc = (trip.seats || []).find((s) => s.seatNumber === sNum);
    if (!seatDoc) {
      return res.status(400).json({
        success: false,
        message: `Seat ${sNum} does not exist on this bus schedule.`,
      });
    }

    if (seatDoc.isBooked) {
      return res.status(409).json({
        success: false,
        code: "SOLD_OUT",
        message: `Seat ${sNum} has already been booked by another passenger.`,
      });
    }

    const isHoldValid =
      seatDoc.isLocked &&
      seatDoc.holdExpiresAt &&
      new Date(seatDoc.holdExpiresAt) > now &&
      Boolean(effectiveIdentifier) && seatDoc.lockedBy === effectiveIdentifier;

    if (!isHoldValid) {
      return res.status(409).json({
        success: false,
        code: "HOLD_EXPIRED",
        message: `Reservation hold for seat ${sNum} has expired or does not belong to your session. Please hold your seats first.`,
      });
    }
  }

  // Recalculate authoritative server totals from Trip document
  const { baseFare, tax, totalAmount } = calculateServerFares(trip, sortedSeats);

  // Check if verified payment is attached
  let verifiedPayment = null;
  if (paymentId) {
    verifiedPayment = await Payment.findOne({
      _id: paymentId,
      status: "SUCCESS",
      amount: totalAmount,
      tripId,
    });
    const paidSeats = verifiedPayment?.seatNumbers || [];
    if (verifiedPayment && (paidSeats.length !== sortedSeats.length || paidSeats.some((seat, index) => seat !== sortedSeats[index]))) {
      return res.status(409).json({ success: false, code: "PAYMENT_ORDER_MISMATCH", message: "Verified payment does not match this trip and seat selection." });
    }
    if (!verifiedPayment) {
      return res.status(409).json({ success: false, code: "PAYMENT_NOT_VERIFIED", message: "Payment has not been verified for this trip and fare." });
    }
  }

  // Status must NEVER become CONFIRMED without verified payment
  const isConfirmed = Boolean(verifiedPayment);
  const bookingStatus = isConfirmed ? "CONFIRMED" : "PENDING";
  const paymentStatus = isConfirmed ? "PAID" : "PENDING";

  try {
    const booking = await withOptionalTransaction(async (session) => {
      // One user, one journey check
      if (req.user?._id && tripId) {
        const existingActiveBooking = await Booking.findOne({
          userId: req.user._id,
          tripId,
          status: { $in: ["CONFIRMED", "PENDING"] },
          seatNumbers: { $in: sortedSeats },
        }).session(session || null);

        if (existingActiveBooking) {
          const err = new Error("You already have an active booking for these seat(s) on this journey.");
          err.statusCode = 409;
          throw err;
        }
      }

      // If payment is verified, execute atomic guarded seat reservation
      if (isConfirmed) {
        const tripUpdateResult = await Trip.updateOne(
          {
            _id: tripId,
            availableSeats: { $gte: sortedSeats.length },
            $and: sortedSeats.map((sNum) => ({
              seats: {
                $elemMatch: {
                  seatNumber: sNum,
                  isBooked: false,
                  isLocked: true,
                  lockedBy: String(effectiveIdentifier),
                  holdExpiresAt: { $gt: now },
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
            $inc: { availableSeats: -sortedSeats.length },
          },
          {
            arrayFilters: [{ "elem.seatNumber": { $in: sortedSeats } }],
            session: session || undefined,
          }
        );

        if (!tripUpdateResult || tripUpdateResult.matchedCount === 0) {
          const err = new Error(
            "One or more selected seats are no longer available or hold has expired. Please choose different seats."
          );
          err.statusCode = 409;
          err.code = "SOLD_OUT";
          throw err;
        }
      }

      const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
      const generatedBookingId = `RDB-${randomHex}`;

      const [createdBooking] = await Booking.create(
        [
          {
            bookingId: generatedBookingId,
            userId: req.user?._id,
            userEmail: req.user?.email || req.body.userEmail || "",
            userName: req.user?.name || passengers[0]?.name || "Passenger",
            userPhone: req.user?.phone || req.body.userPhone || "",
            tripId,
            vertical: "Bus",
            title: `${trip.fromCity} to ${trip.toCity} - ${trip.operator}`,
            operator: trip.operator,
            busNumber: trip.busNumber || "",
            fromCity: trip.fromCity,
            toCity: trip.toCity,
            date: trip.travelDate || trip.journeyDate || trip.date || getTodayInAppTZ(),
            time: trip.departureTime || trip.time || "21:00",
            amount: totalAmount,
            baseFare,
            tax,
            totalAmount,
            seats: sortedSeats.join(", "),
            seatNumbers: sortedSeats,
            passengers: passengerValidation.data,
            boardingPoint: boardingPoint || trip.boardingPoints?.[0]?.name || "Main Bus Station",
            droppingPoint: droppingPoint || trip.droppingPoints?.[0]?.name || "Central Junction",
            paymentId: verifiedPayment?._id || undefined,
            status: bookingStatus,
            paymentStatus,
            idempotencyKey: idempotencyKey || undefined,
          },
        ],
        { session: session || undefined }
      );

      if (verifiedPayment) {
        await Payment.updateOne(
          { _id: verifiedPayment._id },
          { $set: { bookingId: createdBooking._id } },
          { session: session || undefined }
        );
      }

      return createdBooking;
    });

    const responsePayload = {
      success: true,
      message: isConfirmed
        ? "Booking confirmed successfully"
        : "Booking reservation created. Please complete payment to confirm your seats.",
      data: booking,
      booking,
      requiresPayment: !isConfirmed,
      paymentEndpoint: "/api/payment/create-order",
    };

    if (idempotencyKey) {
      try {
        await IdempotencyKey.create({
          key: idempotencyKey,
          endpoint: req.originalUrl || "/api/bookings",
          userId: req.user?._id,
          statusCode: 201,
          responseBody: responsePayload,
        });
      } catch {
        // Ignore duplicate insert
      }
    }

    return res.status(201).json(responsePayload);
  } catch (error) {
    if (error.statusCode === 409 || error.code === 11000) {
      return res.status(409).json({
        success: false,
        code: error.code === 11000 ? "SEAT_UNAVAILABLE" : error.code || "SEAT_UNAVAILABLE",
        message:
          error.message ||
          "Seat booking conflict: one or more selected seats have already been booked by another user.",
      });
    }
    throw error;
  }
});

/**
 * 4. CANCEL BOOKING & RELEASE SEATS ATOMICALLY
 * PATCH /api/bookings/:id/cancel
 */
export const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let booking = null;
  if (/^[0-9a-fA-F]{24}$/.test(id)) {
    booking = await Booking.findById(id);
  }
  if (!booking) {
    booking = await Booking.findOne({ bookingId: id });
  }

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking not found.",
    });
  }

  if (["train", "hotel"].includes(booking.bookingType)) {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: "Authentication required to cancel this booking." });
    }
    const result = await processTravelRefund({
      id,
      user: req.user,
      reason: typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 200) : "",
    });
    return res.status(200).json({
      success: true,
      message: result.refundedAmount
        ? `Booking cancelled; ₹${result.refundedAmount} refund initiated.`
        : "Booking cancelled and held inventory released.",
      alreadyProcessed: result.alreadyProcessed,
      data: result.booking,
      booking: result.booking,
    });
  }

  if (booking.status === "CANCELLED") {
    return res.status(400).json({
      success: false,
      message: "This booking is already cancelled.",
    });
  }

  await withOptionalTransaction(async (session) => {
    // Update booking status
    booking.status = "CANCELLED";
    booking.cancelledAt = new Date();
    booking.refundStatus = booking.paymentStatus === "PAID" ? "MANUAL_REQUIRED" : "NOT_APPLICABLE";
    booking.cancellationReason = req.body?.reason || "Cancelled by passenger";
    await booking.save({ session: session || undefined });

    // Release seats atomically on the Trip if applicable
    if (booking.tripId) {
      const seatsToRelease = booking.seatNumbers?.length
        ? booking.seatNumbers
        : String(booking.seats)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

      if (seatsToRelease.length > 0) {
        const trip = await Trip.findById(booking.tripId).session(session || null);
        const bookedSeatCount = (trip?.seats || []).filter(
          (seat) => seatsToRelease.includes(seat.seatNumber) && seat.isBooked
        ).length;
        const tripUpdate = {
          $set: {
            "seats.$[elem].isBooked": false,
            "seats.$[elem].isLocked": false,
            "seats.$[elem].lockedBy": null,
            "seats.$[elem].lockedAt": null,
            "seats.$[elem].holdExpiresAt": null,
          },
        };
        if (bookedSeatCount > 0) tripUpdate.$inc = { availableSeats: bookedSeatCount };
        await Trip.updateOne(
          { _id: booking.tripId },
          tripUpdate,
          {
            arrayFilters: [{ "elem.seatNumber": { $in: seatsToRelease } }],
            session: session || undefined,
          }
        );
      }
    }
  });

  return res.status(200).json({
    success: true,
    message: booking.refundStatus === "MANUAL_REQUIRED"
      ? "Booking cancelled. A manual refund is required; contact support with your booking ID."
      : "Booking cancelled successfully.",
    data: booking,
    booking,
  });
});

/**
 * 5. HOLD SEATS ATOMICALLY WITH EXPIRY & IDEMPOTENCY
 * POST /api/bookings/hold
 */
export const holdSeats = asyncHandler(async (req, res) => {
  const idempotencyKey =
    req.headers["idempotency-key"] ||
    req.headers["x-idempotency-key"] ||
    req.body.idempotencyKey ||
    null;

  // 1. Idempotency Check
  if (idempotencyKey) {
    const cached = await IdempotencyKey.findOne({ key: idempotencyKey });
    if (cached) {
      return res.status(cached.statusCode).json(cached.responseBody);
    }
  }

  const { tripId, seatNumbers = [], sessionId } = req.body;

  if (!tripId) {
    return res.status(400).json({
      success: false,
      message: "Trip ID is required to hold seats.",
    });
  }

  const rawSeats = Array.isArray(seatNumbers) ? seatNumbers : [seatNumbers].filter(Boolean);
  const sortedSeats = [...new Set(rawSeats)].sort();

  if (sortedSeats.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one valid seat number is required.",
    });
  }

  // Maximum 6 seats allowed per booking
  if (sortedSeats.length > 6) {
    return res.status(400).json({
      success: false,
      message: "A maximum of 6 seats can be held in a single booking.",
    });
  }

  const now = new Date();
  const HOLD_DURATION_MINUTES = Number(process.env.SEAT_LOCK_MINUTES) || 10;
  const holdExpiresAt = new Date(now.getTime() + HOLD_DURATION_MINUTES * 60 * 1000);
  const userIdStr = req.user?._id ? String(req.user._id) : null;
  const effectiveIdentifier = userIdStr || sessionId || "anon_hold_session";

  const tripDoc = await Trip.findById(tripId);
  if (!tripDoc) {
    return res.status(404).json({
      success: false,
      code: "TRIP_NOT_FOUND",
      message: "Trip schedule not found.",
    });
  }
  await assertTripCanBeBooked(tripDoc, now);

  const matchedCount = await holdSeatsAtomic(tripId, sortedSeats, effectiveIdentifier, holdExpiresAt, now);

  // Check affected documents count: 0 indicates seat contention or lock conflict
  if (!matchedCount) {
    const availableCount = (tripDoc.seats || []).filter((seat) => {
      if (seat.isBooked) return false;
      if (!seat.isLocked) return true;
      return seat.holdExpiresAt ? new Date(seat.holdExpiresAt) <= now : true;
    }).length;
    return res.status(409).json({
      success: false,
      code: availableCount === 0 ? "SOLD_OUT" : "SEAT_UNAVAILABLE",
      message:
        "One or more of your selected seats are no longer available or currently held by another passenger.",
    });
  }

  // Authoritative server calculation directly from Trip
  const { baseFare, tax, totalAmount } = calculateServerFares(tripDoc, sortedSeats);

  const responsePayload = {
    success: true,
    message: `Successfully held ${sortedSeats.length} seat(s) for ${HOLD_DURATION_MINUTES} minutes.`,
    tripId,
    seats: sortedSeats,
    seatCount: sortedSeats.length,
    holdExpiresAt,
    expiresAt: holdExpiresAt,
    baseFare,
    tax,
    totalAmount,
  };

  if (idempotencyKey) {
    try {
      await IdempotencyKey.create({
        key: idempotencyKey,
        endpoint: "/api/bookings/hold",
        userId: req.user?._id,
        statusCode: 200,
        responseBody: responsePayload,
      });
    } catch {
      // Ignore duplicate key collision for idempotency caching
    }
  }

  return res.status(200).json(responsePayload);
});

/**
 * 6. DOWNLOAD OFFICIAL TICKET PDF
 * GET /api/bookings/:id/ticket.pdf
 */
export const downloadTicketPdf = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let booking = null;
  if (/^[0-9a-fA-F]{24}$/.test(id)) {
    booking = await Booking.findById(id).populate("tripId").populate("paymentId", "razorpayOrderId razorpayPaymentId status");
  }
  if (!booking) {
    booking = await Booking.findOne({ bookingId: id }).populate("tripId").populate("paymentId", "razorpayOrderId razorpayPaymentId status");
  }

  if (booking.status !== "CONFIRMED" || booking.paymentStatus === "REFUNDED" ||
      booking.refundStatus === "PROCESSED" || booking.refundStatus === "PARTIALLY_REFUNDED" ||
      booking.refundStatus === "REFUNDED") {
    return res.status(409).json({
      success: false,
      code: "TICKET_UNAVAILABLE",
      message: "PDF downloads are available only for confirmed, non-refunded bookings.",
    });
  }

  if (!booking) {
    return res.status(404).json({
      success: false,
      message: "Booking ticket not found.",
    });
  }

  // Authorization check: User must own the booking or be ADMIN
  if (req.user && req.user.role !== "ADMIN") {
    const isOwner =
      (booking.userId && String(booking.userId) === String(req.user._id)) ||
      (booking.userEmail && booking.userEmail.toLowerCase() === (req.user.email || "").toLowerCase()) ||
      (booking.userPhone && (booking.userPhone === req.user.phone || booking.userPhone === req.user.mobile));

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized. You may only download tickets for your own bookings.",
      });
    }
  }

  // Set response headers for PDF stream download
  const sanitizedPnr = (booking.bookingId || "ticket").replace(/[^a-zA-Z0-9_-]/g, "");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="redBus_Ticket_${sanitizedPnr}.pdf"`
  );

  await generateTicketPdf(booking, res);
});

export default {
  getBookings,
  getBookingById,
  createBooking,
  cancelBooking,
  holdSeats,
  downloadTicketPdf,
};
