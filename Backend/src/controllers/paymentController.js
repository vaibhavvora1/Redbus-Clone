import crypto from "crypto";
import Razorpay from "razorpay";
import QRCode from "qrcode";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Booking from "../models/Booking.js";
import BookingHold from "../models/BookingHold.js";
import Trip from "../models/Trip.js";
import IdempotencyKey from "../models/IdempotencyKey.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getTodayInAppTZ } from "../utils/timeZone.js";
import { validatePassengersForSeats } from "../utils/bookingValidation.js";
import { assertTripCanBeBooked } from "../services/tripService.js";
import { calculateServerFares } from "../utils/bookingValidation.js";
import {
  createPaymentRefund,
  getRazorpayClient,
  isMockPaymentAllowed,
  isValidHmac,
} from "../services/razorpayService.js";
import { confirmTravelPayment } from "../services/travelPaymentService.js";
import { finalizeTravelRefundWebhook } from "../services/travelCancellation.js";
import { releaseBookingHold } from "../services/bookingHoldService.js";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const razorpayClient = getRazorpayClient();

/**
 * Execute work inside a MongoDB transaction session when replica set is enabled;
 * gracefully falls back to direct execution if running on a standalone instance.
 */
async function withOptionalTransaction(workFn) {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (err) {
    // Standalone MongoDB without replica set does not support transactions
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
      } catch (abortErr) {
        // ignore abort errors
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
 * Helper: Releases holds for a trip and specific seats
 */
async function releaseSeatsHold(tripId, seatsToRelease, identifier) {
  if (!tripId || !seatsToRelease || seatsToRelease.length === 0) return;
  try {
    await Trip.updateOne(
      { _id: tripId },
      {
        $set: {
          "seats.$[elem].isLocked": false,
          "seats.$[elem].lockedBy": null,
          "seats.$[elem].lockedAt": null,
          "seats.$[elem].holdExpiresAt": null,
        },
      },
      {
        arrayFilters: [
          {
            "elem.seatNumber": { $in: seatsToRelease },
            "elem.isBooked": false,
            ...(identifier ? { "elem.lockedBy": identifier } : {}),
          },
        ],
      }
    );
  } catch (err) {
    console.warn("Failed to release seats hold:", err.message);
  }
}

async function createTravelOrder(req, res) {
  const { bookingType, holdId, bookingId } = req.body;
  if (!req.user?._id) {
    return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Login is required to pay for a train or hotel booking." });
  }
  if (!["train", "hotel"].includes(bookingType) ||
      !mongoose.isValidObjectId(holdId) || !mongoose.isValidObjectId(bookingId)) {
    return res.status(400).json({ success: false, message: "A valid travel booking and hold are required." });
  }

  const [hold, booking] = await Promise.all([
    BookingHold.findOne({
      _id: holdId,
      bookingId,
      userId: req.user._id,
      bookingType,
      status: "HELD",
      expiresAt: { $gt: new Date() },
    }).lean(),
    Booking.findOne({
      _id: bookingId,
      holdId,
      userId: req.user._id,
      bookingType,
      status: "PENDING",
      paymentStatus: "PENDING",
    }).lean(),
  ]);
  if (!hold || !booking) {
    return res.status(409).json({
      success: false,
      code: "HOLD_EXPIRED",
      message: "A valid, unexpired hold owned by this user is required before creating a payment order.",
    });
  }
  if (Number(booking.totalAmount) !== Number(hold.totalAmount)) {
    return res.status(409).json({ success: false, code: "PAYMENT_AMOUNT_MISMATCH", message: "Booking amount does not match the held fare." });
  }

  const existingPayment = await Payment.findOne({
    holdId: hold._id,
    bookingId: booking._id,
    user: req.user._id,
    bookingType,
    status: "PENDING",
  }).sort({ createdAt: -1 }).lean();
  if (existingPayment) {
    return res.status(200).json({
      success: true,
      sandbox: existingPayment.method === "sandbox",
      orderId: existingPayment.razorpayOrderId,
      amount: Math.round(existingPayment.amount * 100),
      currency: existingPayment.currency,
      keyId: existingPayment.method === "sandbox" ? "sandbox_mode" : keyId,
      bookingId: booking._id,
      holdExpiresAt: hold.expiresAt,
    });
  }

  const amount = Number(hold.totalAmount);
  const makeSandboxOrder = async () => {
    const orderId = `order_sandbox_${crypto.randomBytes(10).toString("hex")}`;
    const payment = await Payment.create({
      bookingId: booking._id,
      bookingType,
      holdId: hold._id,
      user: req.user._id,
      amount,
      currency: "INR",
      razorpayOrderId: orderId,
      method: "sandbox",
      status: "PENDING",
    });
    await Booking.updateOne(
      { _id: booking._id, status: "PENDING" },
      { $set: { paymentId: payment._id, paymentOrderId: orderId } }
    );
    return res.status(200).json({
      success: true,
      sandbox: true,
      orderId,
      amount: Math.round(amount * 100),
      currency: "INR",
      keyId: "sandbox_mode",
      bookingId: booking._id,
      holdExpiresAt: hold.expiresAt,
    });
  };

  if (!razorpayClient || !keyId || !keySecret) {
    if (!isMockPaymentAllowed()) {
      return res.status(503).json({
        success: false,
        message: "Razorpay credentials are not configured and explicit non-production sandbox payment is disabled.",
      });
    }
    return makeSandboxOrder();
  }

  try {
    const order = await razorpayClient.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `travel_${String(hold._id).slice(-20)}`,
      notes: { bookingId: String(booking._id), bookingType, holdId: String(hold._id), userId: String(req.user._id) },
    });
    const payment = await Payment.create({
      bookingId: booking._id,
      bookingType,
      holdId: hold._id,
      user: req.user._id,
      amount,
      currency: "INR",
      razorpayOrderId: order.id,
      method: "razorpay",
      status: "PENDING",
    });
    await Booking.updateOne(
      { _id: booking._id, status: "PENDING" },
      { $set: { paymentId: payment._id, paymentOrderId: order.id } }
    );
    return res.status(200).json({
      success: true,
      sandbox: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      bookingId: booking._id,
      holdExpiresAt: hold.expiresAt,
    });
  } catch (error) {
    if (isMockPaymentAllowed()) return makeSandboxOrder();
    console.error("Razorpay travel order creation failed:", error.message);
    return res.status(502).json({ success: false, message: "Razorpay could not create the payment order. Please retry while the hold is active." });
  }
}

/**
 * 1. CREATE PAYMENT ORDER (SERVER-VERIFIED FARES & HOLD VALIDATION)
 * POST /api/payment/create-order
 */
export const createOrder = asyncHandler(async (req, res) => {
  if (["train", "hotel"].includes(req.body?.bookingType)) {
    return createTravelOrder(req, res);
  }

  const { tripId, seats, sessionId } = req.body;

  if (!tripId) {
    return res.status(400).json({
      success: false,
      message: "Valid trip ID is required to create a payment order.",
    });
  }

  const rawSeats = Array.isArray(seats)
    ? seats
    : String(seats || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  const seatNumberList = [...new Set(rawSeats)].sort();

  if (seatNumberList.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one held seat is required to initialize payment.",
    });
  }

  // 1. Fetch trip and verify active hold on every requested seat
  const trip = await Trip.findById(tripId);
  if (!trip) {
    return res.status(404).json({
      success: false,
      code: "TRIP_NOT_FOUND",
      message: "Bus trip schedule not found.",
    });
  }
  await assertTripCanBeBooked(trip);

  const now = new Date();
  const userIdStr = req.user?._id ? String(req.user._id) : null;
  const effectiveIdentifier = userIdStr || sessionId || req.headers["x-session-id"] || null;

  for (const sNum of seatNumberList) {
    const seatDoc = (trip.seats || []).find((s) => s.seatNumber === sNum);
    if (!seatDoc) {
      return res.status(400).json({
        success: false,
        message: `Seat ${sNum} does not exist on this bus.`,
      });
    }

    if (seatDoc.isBooked) {
      return res.status(409).json({
        success: false,
        code: "SOLD_OUT",
        message: `Seat ${sNum} has already been booked by another passenger.`,
      });
    }

    // Verify unexpired hold
    const isHoldValid =
      seatDoc.isLocked &&
      seatDoc.holdExpiresAt &&
      new Date(seatDoc.holdExpiresAt) > now &&
      Boolean(effectiveIdentifier) && seatDoc.lockedBy === effectiveIdentifier;

    if (!isHoldValid) {
      return res.status(409).json({
        success: false,
        code: "HOLD_EXPIRED",
        message: `Reservation hold for seat ${sNum} has expired or does not belong to your session. Please re-select seats.`,
      });
    }
  }

  // 2. Server recalculated total amount from primary database (authoritative source of truth)
  const { baseFare: serverBaseFare, tax: serverTax, totalAmount: calculatedTotalAmount } =
    calculateServerFares(trip, seatNumberList);

  // Amount mismatch guard: if client submitted an amount that differs from server calculation, reject
  if (req.body.amount && Math.abs(Number(req.body.amount) - calculatedTotalAmount) > 2) {
    return res.status(400).json({
      success: false,
      message: `Fare mismatch detected: submitted ₹${req.body.amount} does not match server verified fare ₹${calculatedTotalAmount}.`,
    });
  }

  const finalPayableAmount = calculatedTotalAmount;

  const isMockAllowed =
    process.env.NODE_ENV !== "production" &&
    (process.env.ALLOW_SANDBOX_PAYMENT === "true" || process.env.ENABLE_MOCK_PAYMENT === "true");

  // 3. Fallback to Sandbox Mode if Razorpay client or keys are unconfigured
  if (!razorpayClient || !keyId || !keySecret) {
    if (!isMockAllowed) {
      return res.status(503).json({
        success: false,
        message: "Live payment gateway credentials are not configured and sandbox payments are disabled.",
      });
    }

    const sandboxOrderId = `order_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await Payment.create({
      user: req.user?._id,
      amount: finalPayableAmount,
      currency: "INR",
      razorpayOrderId: sandboxOrderId,
      tripId: trip._id,
      seatNumbers: seatNumberList,
      method: "sandbox",
      status: "PENDING",
    });

    return res.status(200).json({
      success: true,
      sandbox: true,
      orderId: sandboxOrderId,
      amount: Math.round(finalPayableAmount * 100),
      currency: "INR",
      keyId: "sandbox_mode",
      message: "Sandbox payment order generated successfully.",
    });
  }

  // 4. Create official Razorpay Order (executed outside DB transactions)
  try {
    const options = {
      amount: Math.round(finalPayableAmount * 100), // amount in paise
      currency: "INR",
      receipt: `rcpt_${Date.now().toString().slice(-8)}`,
      notes: {
        tripId: String(tripId),
        seats: seatNumberList.join(","),
        userId: userIdStr || "",
      },
    };

    const order = await razorpayClient.orders.create(options);

    await Payment.create({
      user: req.user?._id,
      amount: finalPayableAmount,
      currency: "INR",
      razorpayOrderId: order.id,
      tripId: trip._id,
      seatNumbers: seatNumberList,
      method: "razorpay",
      status: "PENDING",
    });

    return res.status(200).json({
      success: true,
      sandbox: false,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    if (!isMockAllowed) {
      return res.status(502).json({
        success: false,
        message: "Payment gateway error during order creation. Please try again.",
      });
    }

    // Fall back to sandbox only if allowed in development environment
    const sandboxOrderId = `order_sandbox_fallback_${Date.now()}`;
    await Payment.create({
      user: req.user?._id,
      amount: finalPayableAmount,
      currency: "INR",
      razorpayOrderId: sandboxOrderId,
      tripId: trip._id,
      seatNumbers: seatNumberList,
      method: "sandbox",
      status: "PENDING",
    });

    return res.status(200).json({
      success: true,
      sandbox: true,
      orderId: sandboxOrderId,
      amount: Math.round(finalPayableAmount * 100),
      currency: "INR",
      keyId: "sandbox_mode",
      message: "Switched to Sandbox mode due to Razorpay API issue.",
    });
  }
});

async function verifyTravelPayment(req, res) {
  const { bookingType, bookingId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  if (!req.user?._id) {
    return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Login is required to verify this payment." });
  }
  if (!["train", "hotel"].includes(bookingType) || !mongoose.isValidObjectId(bookingId) || !orderId) {
    return res.status(400).json({ success: false, message: "Booking type, booking ID, and order ID are required." });
  }

  const payment = await Payment.findOne({
    razorpayOrderId: orderId,
    bookingId,
    bookingType,
    user: req.user._id,
  });
  if (!payment) {
    return res.status(404).json({ success: false, code: "PAYMENT_ORDER_NOT_FOUND", message: "No payment order was found for this booking and user." });
  }

  const existingBooking = await Booking.findOne({
    _id: bookingId,
    userId: req.user._id,
    bookingType,
  }).lean();
  if (!existingBooking) {
    return res.status(404).json({ success: false, code: "BOOKING_NOT_FOUND", message: "Travel booking not found." });
  }
  if (payment.status === "SUCCESS" && existingBooking.status === "CONFIRMED") {
    return res.status(200).json({ success: true, message: "Booking already confirmed.", booking: existingBooking });
  }
  if (payment.status !== "PENDING" || existingBooking.status !== "PENDING") {
    return res.status(409).json({ success: false, code: "BOOKING_NOT_PENDING", message: "This payment or booking is no longer pending." });
  }

  let gatewayPaymentId = paymentId;
  let gatewaySignature = signature;
  let amountPaise;
  let currency;
  if (payment.method === "sandbox") {
    if (!isMockPaymentAllowed() || req.body.sandbox !== true) {
      return res.status(403).json({ success: false, message: "Sandbox payment verification is disabled." });
    }
    gatewayPaymentId = paymentId || `sandbox_pay_${String(payment._id).slice(-12)}`;
    amountPaise = Math.round(payment.amount * 100);
    currency = payment.currency;
  } else {
    if (!paymentId || !signature || !keySecret ||
        !isValidHmac(`${orderId}|${paymentId}`, signature, keySecret)) {
      await Payment.updateOne(
        { _id: payment._id, status: "PENDING" },
        { $set: { status: "FAILED", razorpayPaymentId: paymentId || null, errorReason: "Payment signature verification failed." } }
      );
      await releaseBookingHold(payment.holdId, req.user._id, "RELEASED");
      return res.status(400).json({ success: false, code: "INVALID_PAYMENT_SIGNATURE", message: "Payment verification failed. Invalid signature." });
    }

    if (!razorpayClient) {
      return res.status(503).json({ success: false, message: "Razorpay credentials are unavailable for server verification." });
    }
    let fetchedPayment;
    try {
      fetchedPayment = await razorpayClient.payments.fetch(paymentId);
    } catch (error) {
      console.error("Razorpay payment lookup failed:", error.message);
      return res.status(502).json({ success: false, message: "Could not verify the payment status with Razorpay. Retry shortly." });
    }
    if (fetchedPayment.order_id !== orderId || Number(fetchedPayment.amount) !== Math.round(payment.amount * 100) ||
        fetchedPayment.currency !== payment.currency) {
      await Payment.updateOne(
        { _id: payment._id, status: "PENDING" },
        { $set: { status: "FAILED", razorpayPaymentId: paymentId, errorReason: "Gateway order, amount, or currency mismatch." } }
      );
      await releaseBookingHold(payment.holdId, req.user._id, "RELEASED");
      return res.status(400).json({ success: false, code: "PAYMENT_AMOUNT_MISMATCH", message: "Gateway payment does not match the server order." });
    }
    if (fetchedPayment.status !== "captured") {
      return res.status(202).json({
        success: true,
        pending: true,
        message: "Payment is not captured yet. Your hold remains active while the gateway completes payment.",
      });
    }
    amountPaise = Number(fetchedPayment.amount);
    currency = fetchedPayment.currency;
  }

  const booking = await confirmTravelPayment({
    orderId,
    paymentId: gatewayPaymentId,
    signature: gatewaySignature,
    gatewayAmountPaise: amountPaise,
    currency,
  });
  return res.status(200).json({
    success: true,
    message: "Payment verified and travel booking confirmed.",
    booking,
  });
}

/**
 * 2. VERIFY PAYMENT AND CONFIRM BOOKING (ATOMIC)
 * POST /api/payment/verify
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  if (["train", "hotel"].includes(req.body?.bookingType)) {
    return verifyTravelPayment(req, res);
  }

  const idempotencyKey =
    req.headers["idempotency-key"] ||
    req.headers["x-idempotency-key"] ||
    req.body.idempotencyKey ||
    null;

  // 1. Idempotency Check: return cached response if key was already processed
  if (idempotencyKey) {
    const cached = await IdempotencyKey.findOne({ key: idempotencyKey });
    if (cached) {
      return res.status(cached.statusCode).json(cached.responseBody);
    }
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    sandbox = false,
    tripId,
    selectedSeats = [],
    passengers = [],
    contact = {},
    boardingPoint,
    droppingPoint,
    sessionId,
  } = req.body;

  if (!razorpay_order_id) {
    return res.status(400).json({
      success: false,
      message: "Order ID is required for verification.",
    });
  }

  // 2. Prevent Duplicate Tickets on Refresh/Retry: If this order was already verified, return existing booking
  const existingSuccessfulPayment = await Payment.findOne({
    razorpayOrderId: razorpay_order_id,
    status: "SUCCESS",
  });

  if (existingSuccessfulPayment && existingSuccessfulPayment.bookingId) {
    const existingBooking = await Booking.findById(existingSuccessfulPayment.bookingId);
    if (existingBooking) {
      return res.status(200).json({
        success: true,
        message: "Booking already verified and confirmed.",
        booking: existingBooking,
      });
    }
  }

  const rawSeats = Array.isArray(selectedSeats) ? selectedSeats : [selectedSeats].filter(Boolean);
  // Sort canonical seat numbers to prevent cross-seat locking deadlocks
  const sortedSeats = [...new Set(rawSeats)].sort();

  if (sortedSeats.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one seat must be selected to verify booking.",
    });
  }

  // Validate passenger details for every seat using Zod schema
  const passengerValidation = validatePassengersForSeats(passengers, sortedSeats);
  if (!passengerValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: passengerValidation.message,
      errors: passengerValidation.errors || [],
    });
  }

  const isSandbox = Boolean(sandbox || razorpay_order_id.startsWith("order_sandbox_"));

  if (isSandbox) {
    const isMockAllowed =
      process.env.NODE_ENV !== "production" &&
      (process.env.ALLOW_SANDBOX_PAYMENT === "true" || process.env.ENABLE_MOCK_PAYMENT === "true");

    if (!isMockAllowed) {
      return res.status(403).json({
        success: false,
        message: "Sandbox/mock payment verification is disabled in this environment.",
      });
    }
  }

  const tripForPayment = tripId ? await Trip.findById(tripId) : null;
  if (!tripForPayment) {
    return res.status(404).json({ success: false, code: "TRIP_NOT_FOUND", message: "Trip not found." });
  }
  await assertTripCanBeBooked(tripForPayment);
  const paymentOrder = await Payment.findOne({ razorpayOrderId: razorpay_order_id, status: { $in: ["PENDING", "SUCCESS"] } });
  if (!paymentOrder) {
    return res.status(404).json({ success: false, code: "PAYMENT_ORDER_NOT_FOUND", message: "Payment order not found or already processed." });
  }
  if (paymentOrder.tripId && String(paymentOrder.tripId) !== String(tripForPayment._id)) {
    return res.status(400).json({ success: false, code: "PAYMENT_ORDER_MISMATCH", message: "Payment order does not belong to this trip." });
  }
  if (!paymentOrder.tripId || !paymentOrder.seatNumbers?.length) {
    return res.status(400).json({ success: false, code: "PAYMENT_ORDER_MISMATCH", message: "Payment order has no server-side trip and seat record." });
  }
  if (paymentOrder.seatNumbers?.length &&
      (paymentOrder.seatNumbers.length !== sortedSeats.length || paymentOrder.seatNumbers.some((seat, index) => seat !== sortedSeats[index]))) {
    return res.status(400).json({ success: false, code: "PAYMENT_ORDER_MISMATCH", message: "Payment order does not match the selected seats." });
  }
  const { baseFare: serverBaseFare, tax: serverTax, totalAmount: serverTotalAmount } =
    calculateServerFares(tripForPayment, sortedSeats);
  if (Number(paymentOrder.amount) !== serverTotalAmount) {
    return res.status(400).json({ success: false, code: "PAYMENT_AMOUNT_MISMATCH", message: "Payment order amount does not match the trip fare." });
  }
  const holdIdentifiers = [
    req.user?._id ? String(req.user._id) : null,
    sessionId ? String(sessionId) : null,
    req.headers["x-session-id"] ? String(req.headers["x-session-id"]) : null,
  ].filter(Boolean);
  const verifyNow = new Date();
  for (const seatNumber of sortedSeats) {
    const seat = (tripForPayment.seats || []).find((candidate) => candidate.seatNumber === seatNumber);
    if (!seat) {
      return res.status(400).json({ success: false, code: "SOLD_OUT", message: `Seat ${seatNumber} is not on this trip.` });
    }
    const heldByCaller = seat.isLocked && seat.holdExpiresAt && new Date(seat.holdExpiresAt) > verifyNow && holdIdentifiers.includes(String(seat.lockedBy));
    if (seat.isBooked || !heldByCaller) {
      return res.status(409).json({ success: false, code: seat.isBooked ? "SOLD_OUT" : "HOLD_EXPIRED", message: `Seat ${seatNumber} is no longer held by this booking.` });
    }
  }

  // 3. Verify Razorpay HMAC SHA256 signature if not in Sandbox mode
  if (!isSandbox) {
    if (!razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment ID and signature are required.",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      // Mark payment failed
      await Payment.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        {
          $set: {
            status: "FAILED",
            razorpayPaymentId: razorpay_payment_id,
            errorReason: "Signature mismatch verification failed",
          },
        }
      );

      // Release seat holds on payment failure
      const identifier = req.user?._id
        ? String(req.user._id)
        : sessionId
        ? String(sessionId)
        : null;
      await releaseSeatsHold(tripId, sortedSeats, identifier);

      return res.status(400).json({
        success: false,
        message: "Payment verification failed. Invalid signature.",
      });
    }
  }

  // 4. Atomically confirm booking within a transaction
  try {
    const result = await withOptionalTransaction(async (session) => {
      // Check for one-user-one-journey duplicate booking on retry
      if (req.user?._id && tripId) {
        const existingActiveBooking = await Booking.findOne({
          userId: req.user._id,
          tripId,
          status: { $in: ["CONFIRMED", "PENDING"] },
          seatNumbers: { $in: sortedSeats },
        }).session(session || null);

        if (existingActiveBooking) {
          return existingActiveBooking;
        }
      }

      const now = new Date();
      const userIdStr = req.user?._id ? String(req.user._id) : null;
      const effectiveSessionId = sessionId || req.headers["x-session-id"] || null;
      const holdOwners = [userIdStr, effectiveSessionId ? String(effectiveSessionId) : null].filter(Boolean);

      // Single atomic guarded update: decrement availableSeats and mark seats booked
      // Only the still-held, unexpired seats belonging to this user/session can be booked.
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
                lockedBy: { $in: holdOwners },
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

      // Check affected documents count (matchedCount)
      if (!tripUpdateResult || tripUpdateResult.matchedCount === 0) {
        const err = new Error(
          "One or more selected seats are no longer available or your hold has expired. Please select new seats."
        );
        err.statusCode = 409;
        throw err;
      }

      // Fetch the updated trip to extract journey metadata & check for overbooking
      const trip = await Trip.findById(tripId).session(session || null);
      if (trip) {
        const bookedCount = trip.seats.filter((s) => s.isBooked).length;
        if (bookedCount > trip.totalSeats) {
          console.error(
            `🚨 [CRITICAL OVERBOOKING ALERT] Trip ${trip._id} (${trip.operator}) has ${bookedCount} booked seats exceeding total capacity ${trip.totalSeats}!`
          );
        }
      }

      // Generate Booking ID and QR Code
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const generatedBookingId = `RDB-${randomSuffix}`;

      const qrData = JSON.stringify({
        bookingId: generatedBookingId,
        tripId: trip?._id || tripId,
        operator: trip?.operator || "RedBus Partner",
        route: `${trip?.fromCity || ""} -> ${trip?.toCity || ""}`,
        date: trip?.travelDate || trip?.journeyDate || getTodayInAppTZ(),
        seats: sortedSeats,
        passengers: passengers.map((p) => p.name).join(", "),
        totalAmount: serverTotalAmount,
        verifiedAt: new Date().toISOString(),
      });

      let qrCodeDataUrl = "";
      try {
        qrCodeDataUrl = await QRCode.toDataURL(qrData, {
          margin: 2,
          width: 250,
          color: {
            dark: "#1e293b",
            light: "#ffffff",
          },
        });
      } catch (err) {
        console.warn("Failed to generate QR Code:", err.message);
      }

      // Create Booking record
      const [booking] = await Booking.create(
        [
          {
            bookingId: generatedBookingId,
            userId: req.user?._id,
            userEmail: contact.email || req.user?.email || "",
            userName: passengers[0]?.name || req.user?.name || "Passenger",
            userPhone: contact.phone || req.user?.phone || req.user?.mobile || "",
            tripId: trip?._id || tripId,
            vertical: "Bus",
            title: `${trip?.fromCity || "Departure"} to ${trip?.toCity || "Destination"} - ${
              trip?.operator || "Bus Service"
            }`,
            operator: trip?.operator || "RedBus Express",
            busNumber: trip?.busNumber || "",
            fromCity: trip?.fromCity || "",
            toCity: trip?.toCity || "",
            date: trip?.travelDate || trip?.journeyDate || getTodayInAppTZ(),
            time: trip?.departureTime || "21:00",
            seats: sortedSeats.join(", "),
            seatNumbers: sortedSeats,
            passengers: passengers.map((p) => ({
              seatNumber: p.seatNumber,
              name: p.name,
              age: Number(p.age || 25),
              gender: p.gender || "Male",
            })),
            amount: serverTotalAmount,
            baseFare: serverBaseFare,
            tax: serverTax,
            totalAmount: serverTotalAmount,
            boardingPoint: boardingPoint || `${trip?.fromCity || "Origin"} Main Terminal`,
            droppingPoint: droppingPoint || `${trip?.toCity || "Destination"} Central Station`,
            qrCode: qrCodeDataUrl,
            paymentStatus: "PAID",
            status: "CONFIRMED",
            idempotencyKey: idempotencyKey || undefined,
          },
        ],
        { session: session || undefined }
      );

      // Update Payment record
      await Payment.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        {
          $set: {
            bookingId: booking._id,
            tripId: tripForPayment._id,
            seatNumbers: sortedSeats,
            user: req.user?._id,
            razorpayPaymentId: razorpay_payment_id || `sandbox_pay_${Date.now()}`,
            razorpaySignature: razorpay_signature || null,
            status: "SUCCESS",
            method: isSandbox ? "sandbox" : "razorpay",
          },
        },
        { upsert: true, returnDocument: "after", session: session || undefined }
      );

      return booking;
    });

    const responsePayload = {
      success: true,
      message: "Payment verified and booking confirmed successfully!",
      booking: result,
    };

    // Save response in IdempotencyKey store if key was provided
    if (idempotencyKey) {
      try {
        await IdempotencyKey.create({
          key: idempotencyKey,
          endpoint: req.originalUrl || "/api/payment/verify",
          userId: req.user?._id,
          statusCode: 200,
          responseBody: responsePayload,
        });
      } catch (e) {
        // Ignore duplicate insert for idempotency record
      }
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    if (error.statusCode === 409 || error.code === 11000) {
      return res.status(409).json({
        success: false,
        code: "SOLD_OUT",
        message:
          error.message ||
          "Seat booking conflict: one or more selected seats have already been booked by another user.",
      });
    }
    throw error;
  }
});

/**
 * 3. RAZORPAY WEBHOOK HANDLER
 * POST /api/payment/webhook
 */
async function processRazorpayWebhook(req, res, webhookSecret) {
  if (!webhookSecret) {
    return res.status(503).json({ success: false, message: "Razorpay webhook secret is not configured." });
  }
  if (!Buffer.isBuffer(req.rawBody) || !isValidHmac(req.rawBody, req.headers["x-razorpay-signature"], webhookSecret)) {
    return res.status(400).json({ success: false, message: "Invalid webhook signature." });
  }

  const event = req.body?.event;
  const paymentEntity = req.body?.payload?.payment?.entity;
  const releaseAndRefundCapturedPayment = async (payment, entity, reason) => {
    const claimed = await Payment.updateOne(
      {
        _id: payment._id,
        status: { $in: ["PENDING", "FAILED"] },
        "refundDetails.refundStatus": { $nin: ["INITIATED", "PENDING", "SUCCESS"] },
      },
      {
        $set: {
          status: "FAILED",
          razorpayPaymentId: entity.id,
          errorReason: reason,
          refundDetails: { refundStatus: "INITIATED", refundAmount: Number(entity.amount) / 100 },
        },
      }
    );
    if (claimed.modifiedCount !== 1) return;
    if (["train", "hotel"].includes(payment.bookingType)) {
      if (payment.holdId && payment.user) await releaseBookingHold(payment.holdId, payment.user, "RELEASED");
    } else {
      const notes = entity.notes || {};
      if (notes.tripId && notes.seats) {
        await releaseSeatsHold(
          notes.tripId,
          String(notes.seats).split(",").map((seat) => seat.trim()).filter(Boolean),
          notes.userId || null
        );
      }
    }

    try {
      const refund = await createPaymentRefund(
        { ...payment.toObject(), razorpayPaymentId: entity.id },
        Number(entity.amount) / 100,
        { reason: "Automatic refund: payment could not be matched to an active booking." }
      );
      await Payment.updateOne(
        { _id: payment._id },
        {
          $set: {
            ...(refund.status === "processed" ? { status: "REFUNDED" } : {}),
            refundDetails: {
              refundId: refund.id || "",
              refundAmount: Number(entity.amount) / 100,
              refundStatus: refund.status || "PENDING",
              refundedAt: refund.status === "processed" ? new Date() : null,
            },
          },
        }
      );
    } catch (error) {
      console.error("Could not automatically refund an unmatched captured payment:", error.message);
    }
  };

  if (event === "payment.captured" && paymentEntity?.order_id) {
    const payment = await Payment.findOne({ razorpayOrderId: paymentEntity.order_id });
    if (!payment || payment.status === "SUCCESS") return res.status(200).json({ status: "ok" });
    if (Number(paymentEntity.amount) !== Math.round(payment.amount * 100) || paymentEntity.currency !== payment.currency) {
      await releaseAndRefundCapturedPayment(
        payment,
        paymentEntity,
        "Captured gateway amount or currency did not match the stored order."
      );
      console.error("Razorpay captured payment did not match its stored order.");
      return res.status(200).json({ status: "rejected_mismatch" });
    }

    if (["train", "hotel"].includes(payment.bookingType)) {
      try {
        await confirmTravelPayment({
          orderId: payment.razorpayOrderId,
          paymentId: paymentEntity.id,
          gatewayAmountPaise: Number(paymentEntity.amount),
          currency: paymentEntity.currency,
        });
      } catch (error) {
        console.error("Captured travel payment could not confirm its booking:", error.code || error.message);
        if (["HOLD_EXPIRED", "BOOKING_NOT_PENDING", "PAYMENT_AMOUNT_MISMATCH", "HOLD_REQUIRED"].includes(error.code)) {
          await releaseAndRefundCapturedPayment(
            payment,
            paymentEntity,
            "Captured payment could not be linked to an active booking."
          );
        } else {
          throw error;
        }
      }
    } else {
      await Payment.updateOne(
        { _id: payment._id, status: "PENDING" },
        { $set: { status: "SUCCESS", razorpayPaymentId: paymentEntity.id } }
      );
    }
  } else if (event === "payment.failed" && paymentEntity?.order_id) {
    const payment = await Payment.findOneAndUpdate(
      { razorpayOrderId: paymentEntity.order_id, status: "PENDING" },
      {
        $set: {
          status: "FAILED",
          razorpayPaymentId: paymentEntity.id,
          errorReason: paymentEntity.error_description || "Payment failed at the gateway.",
        },
      },
      { returnDocument: "after" }
    );
    if (payment && ["train", "hotel"].includes(payment.bookingType) && payment.holdId && payment.user) {
      await releaseBookingHold(payment.holdId, payment.user, "RELEASED");
    } else {
      const notes = paymentEntity.notes || {};
      if (notes.tripId && notes.seats) {
        const seats = String(notes.seats).split(",").map((seat) => seat.trim()).filter(Boolean);
        await releaseSeatsHold(notes.tripId, seats, notes.userId || null);
      }
    }
  } else if (event === "refund.processed") {
    const refundEntity = req.body?.payload?.refund?.entity;
    if (refundEntity?.payment_id) {
      const payment = await Payment.findOne({ razorpayPaymentId: refundEntity.payment_id });
      if (payment && ["train", "hotel"].includes(payment.bookingType)) {
        await finalizeTravelRefundWebhook(payment, refundEntity);
      } else if (payment) {
        const refundedAmount = Number(refundEntity.amount || 0) / 100;
        const fullRefund = refundedAmount >= Number(payment.amount || 0);
        payment.status = fullRefund ? "REFUNDED" : "SUCCESS";
        payment.refundDetails = {
          refundId: refundEntity.id,
          refundAmount: refundedAmount,
          refundStatus: "SUCCESS",
          refundedAt: new Date((refundEntity.created_at || Date.now() / 1000) * 1000),
        };
        await payment.save();
        if (payment.bookingId) {
          await Booking.updateOne(
            { _id: payment.bookingId, refundStatus: { $nin: ["PROCESSED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
            {
              $set: {
                status: "CANCELLED",
                paymentStatus: fullRefund ? "REFUNDED" : "PAID",
                refundStatus: fullRefund ? "PROCESSED" : "PARTIALLY_REFUNDED",
                refundId: refundEntity.id,
                refundedAmount,
                refundedAt: new Date((refundEntity.created_at || Date.now() / 1000) * 1000),
              },
            }
          );
        }
      }
    }
  } else if (event === "refund.failed") {
    const refundEntity = req.body?.payload?.refund?.entity;
    if (refundEntity?.payment_id) {
      const payment = await Payment.findOneAndUpdate(
        { razorpayPaymentId: refundEntity.payment_id },
        { $set: { "refundDetails.refundStatus": "FAILED" } },
        { returnDocument: "after" }
      );
      if (payment?.bookingId) {
        if (["train", "hotel"].includes(payment.bookingType)) {
          await Booking.updateOne(
            { _id: payment.bookingId, refundStatus: "INITIATED" },
            { $set: { refundStatus: "FAILED", paymentStatus: "PAID" } }
          );
          await Payment.updateOne({ _id: payment._id }, { $set: { status: "SUCCESS" } });
        } else {
          await Booking.updateOne(
            { _id: payment.bookingId, refundStatus: "INITIATED" },
            { $set: { refundStatus: "FAILED", paymentStatus: "PAID" } }
          );
          await Payment.updateOne({ _id: payment._id }, { $set: { status: "SUCCESS" } });
        }
      }
    }
  }

  return res.status(200).json({ status: "ok" });
}

export const razorpayWebhook = asyncHandler(async (req, res) =>
  processRazorpayWebhook(req, res, process.env.RAZORPAY_WEBHOOK_SECRET)
);

export const razorpayTrainWebhook = asyncHandler(async (req, res) =>
  processRazorpayWebhook(
    req,
    res,
    process.env.RAZORPAY_TRAIN_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET
  )
);

export default {
  createOrder,
  verifyPayment,
  razorpayWebhook,
  razorpayTrainWebhook,
};
