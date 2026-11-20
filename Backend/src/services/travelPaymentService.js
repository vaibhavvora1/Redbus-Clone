import Booking from "../models/Booking.js";
import BookingHold from "../models/BookingHold.js";
import Payment from "../models/Payment.js";
import { confirmBookingHold } from "./bookingHoldService.js";
import { makeBookingError, withBookingTransaction } from "../utils/travelBooking.js";

export async function confirmTravelPayment({
  orderId,
  paymentId,
  signature,
  gatewayAmountPaise,
  currency,
}) {
  const payment = await Payment.findOne({
    razorpayOrderId: orderId,
    bookingType: { $in: ["train", "hotel"] },
  }).lean();
  if (!payment || !payment.bookingId || !payment.holdId) {
    throw makeBookingError("Payment order is not linked to a travel booking.", 404, "PAYMENT_ORDER_NOT_FOUND");
  }

  const booking = await Booking.findById(payment.bookingId).lean();
  if (payment.status === "SUCCESS" && booking?.status === "CONFIRMED") {
    return booking;
  }

  const expectedPaise = Math.round(Number(payment.amount) * 100);
  if (Number(gatewayAmountPaise) !== expectedPaise || currency !== payment.currency) {
    throw makeBookingError("Gateway payment amount does not match the server order.", 400, "PAYMENT_AMOUNT_MISMATCH");
  }

  return withBookingTransaction(async (session) => {
    const currentPayment = await Payment.findById(payment._id).session(session);
    const currentBooking = await Booking.findOne({
      _id: payment.bookingId,
      holdId: payment.holdId,
      bookingType: payment.bookingType,
      userId: payment.user,
    }).session(session);
    const hold = await BookingHold.findOne({
      _id: payment.holdId,
      bookingId: payment.bookingId,
      userId: payment.user,
      bookingType: payment.bookingType,
    }).session(session);

    if (!currentPayment || !currentBooking || !hold) {
      throw makeBookingError("Payment order is not linked to an active booking hold.", 409, "HOLD_REQUIRED");
    }
    if (currentPayment.status === "SUCCESS" && currentBooking.status === "CONFIRMED") {
      return currentBooking;
    }
    if (currentPayment.status !== "PENDING" || currentBooking.status !== "PENDING") {
      throw makeBookingError("This booking can no longer be confirmed with this payment.", 409, "BOOKING_NOT_PENDING");
    }
    if (hold.status !== "HELD" || hold.expiresAt <= new Date()) {
      throw makeBookingError("The booking hold expired before payment was confirmed.", 409, "HOLD_EXPIRED");
    }
    if (Number(currentBooking.totalAmount) !== Number(currentPayment.amount)) {
      throw makeBookingError("Payment order does not match the booking amount.", 409, "PAYMENT_AMOUNT_MISMATCH");
    }

    await confirmBookingHold(hold, session);
    currentBooking.status = "CONFIRMED";
    currentBooking.paymentStatus = "PAID";
    currentBooking.paymentId = currentPayment._id;
    currentBooking.paymentOrderId = currentPayment.razorpayOrderId;
    await currentBooking.save({ session });

    currentPayment.status = "SUCCESS";
    currentPayment.razorpayPaymentId = paymentId;
    currentPayment.razorpaySignature = signature || null;
    await currentPayment.save({ session });

    return currentBooking;
  });
}
