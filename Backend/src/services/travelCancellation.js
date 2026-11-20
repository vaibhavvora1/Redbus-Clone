import AuditLog from "../models/AuditLog.js";
import Booking from "../models/Booking.js";
import BookingHold from "../models/BookingHold.js";
import Payment from "../models/Payment.js";
import TrainRun from "../models/TrainRun.js";
import {
  CANCELLATION_CUTOFF_HOURS,
  REFUND_SLABS,
} from "../config/travelBooking.js";
import { changeHoldInventory, releaseConfirmedBooking } from "./bookingHoldService.js";
import { createPaymentRefund } from "./razorpayService.js";
import { combineDateAndTime } from "../utils/timeZone.js";
import { makeBookingError, withBookingTransaction } from "../utils/travelBooking.js";

async function findBooking(id, session) {
  let booking = null;
  if (/^[a-f\d]{24}$/i.test(id)) {
    booking = await Booking.findById(id).session(session || null);
  }
  if (!booking) booking = await Booking.findOne({ bookingId: id }).session(session || null);
  return booking;
}

async function getCancellationTime(booking) {
  if (booking.bookingType === "train") {
    const run = booking.trainRunId ? await TrainRun.findById(booking.trainRunId).select("departureAt").lean() : null;
    return run?.departureAt || booking.departureAt || null;
  }
  return combineDateAndTime(booking.checkIn, "14:00");
}

function getUserRefundAmount(totalAmount, hoursBefore) {
  const slab = REFUND_SLABS
    .slice()
    .sort((a, b) => b.minimumHoursBefore - a.minimumHoursBefore)
    .find((item) => hoursBefore >= item.minimumHoursBefore);
  return slab ? Math.floor(totalAmount * slab.percentage / 100) : 0;
}

async function cancelUnpaidTravelBooking(booking, userId, reason) {
  return withBookingTransaction(async (session) => {
    const current = await Booking.findOne({
      _id: booking._id,
      userId,
      bookingType: { $in: ["train", "hotel"] },
      status: { $in: ["PENDING", "EXPIRED"] },
    }).session(session);
    if (!current) throw makeBookingError("This unpaid booking can no longer be cancelled.", 409, "BOOKING_NOT_PENDING");

    if (current.status === "PENDING" && current.holdId) {
      const hold = await BookingHold.findById(current.holdId).session(session);
      if (hold?.status === "HELD") {
        await changeHoldInventory(hold, session, ["HELD"], "RELEASED");
      }
    }

    current.status = "CANCELLED";
    current.paymentStatus = current.paymentStatus === "PAID" ? "PAID" : "FAILED";
    current.refundStatus = "NOT_APPLICABLE";
    current.cancelledAt = new Date();
    current.cancellationReason = reason;
    await current.save({ session });
    return current;
  });
}

export async function processTravelRefund({
  id,
  user,
  isAdmin = false,
  amount,
  reason = "",
  ipAddress = "",
}) {
  const booking = await findBooking(id);
  if (!booking) throw makeBookingError("Booking not found.", 404, "BOOKING_NOT_FOUND");
  if (!["train", "hotel"].includes(booking.bookingType)) {
    throw makeBookingError("This refund helper only handles train and hotel bookings.", 400, "INVALID_BOOKING_TYPE");
  }
  if (!isAdmin && String(booking.userId) !== String(user?._id)) {
    throw makeBookingError("You can only cancel your own booking.", 403, "BOOKING_FORBIDDEN");
  }

  if (booking.status === "CANCELLED" &&
      ["PROCESSED", "PARTIALLY_REFUNDED", "REFUNDED", "NOT_APPLICABLE"].includes(booking.refundStatus)) {
    return { booking, alreadyProcessed: true, refundedAmount: booking.refundedAmount || 0 };
  }

  if (booking.status === "PENDING" || booking.status === "EXPIRED") {
    const cancelled = await cancelUnpaidTravelBooking(booking, booking.userId, reason || "Cancelled before payment.");
    return { booking: cancelled, alreadyProcessed: false, refundedAmount: 0 };
  }
  const retryingFailedRefund = isAdmin && booking.status === "CANCELLED" && booking.refundStatus === "FAILED";
  if ((!retryingFailedRefund && booking.status !== "CONFIRMED") || booking.paymentStatus !== "PAID") {
    throw makeBookingError("Only confirmed, paid bookings can be refunded.", 409, "BOOKING_NOT_REFUNDABLE");
  }
  if (["INITIATED", "PROCESSED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(booking.refundStatus)) {
    throw makeBookingError("A refund is already in progress or has been processed.", 409, "REFUND_ALREADY_PROCESSED");
  }

  const originalAmount = Number(booking.totalAmount || booking.amount || 0);
  let refundAmount;
  if (isAdmin) {
    refundAmount = amount === undefined || amount === null || amount === ""
      ? originalAmount
      : Number(amount);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > originalAmount) {
      throw makeBookingError("Refund amount must be greater than 0 and no more than the paid amount.", 400, "INVALID_REFUND_AMOUNT");
    }
  } else {
    const cancellationTime = await getCancellationTime(booking);
    const hoursBefore = cancellationTime
      ? (new Date(cancellationTime).getTime() - Date.now()) / 3_600_000
      : -1;
    if (hoursBefore < CANCELLATION_CUTOFF_HOURS) {
      throw makeBookingError(
        `This booking can only be cancelled at least ${CANCELLATION_CUTOFF_HOURS} hours before the scheduled start.`,
        409,
        "CANCELLATION_CUTOFF_PASSED"
      );
    }
    refundAmount = getUserRefundAmount(originalAmount, hoursBefore);
    if (refundAmount <= 0) {
      throw makeBookingError("This booking is outside the refundable cancellation window.", 409, "REFUND_NOT_AVAILABLE");
    }
  }

  const payment = booking.paymentId
    ? await Payment.findById(booking.paymentId)
    : await Payment.findOne({ bookingId: booking._id, status: "SUCCESS" });
  if (!payment || payment.status !== "SUCCESS" || !payment.razorpayPaymentId) {
    throw makeBookingError("The verified payment record is missing; support must review this booking.", 409, "PAYMENT_NOT_REFUNDABLE");
  }

  const claimed = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      status: retryingFailedRefund ? "CANCELLED" : "CONFIRMED",
      paymentStatus: "PAID",
      refundStatus: { $nin: ["INITIATED", "PROCESSED", "PARTIALLY_REFUNDED", "REFUNDED"] },
    },
    { $set: { refundStatus: "INITIATED" } },
    { returnDocument: "after" }
  );
  if (!claimed) throw makeBookingError("A refund is already in progress for this booking.", 409, "REFUND_IN_PROGRESS");

  let gatewayRefund;
  try {
    gatewayRefund = await createPaymentRefund(payment, refundAmount, {
      bookingId: booking.bookingId || String(booking._id),
      reason: reason || (isAdmin ? "Admin initiated refund" : "Customer cancellation"),
      requestedBy: String(user?._id || ""),
    });
  } catch (error) {
    if (error.statusCode === 503) {
      await Booking.updateOne(
        { _id: booking._id, refundStatus: "INITIATED" },
        { $set: { refundStatus: "FAILED" } }
      );
    }
    throw error;
  }

  const now = new Date();
  const fullRefund = refundAmount >= originalAmount;
  const refundComplete = gatewayRefund.status === "processed";
  let updatedBooking;
  updatedBooking = await withBookingTransaction(async (session) => {
      const current = await Booking.findById(booking._id).session(session);
      if (!current) throw makeBookingError("Booking not found.", 404, "BOOKING_NOT_FOUND");
      if (current.status === "CANCELLED" &&
          ["PROCESSED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(current.refundStatus)) {
        return current;
      }

      if (current.holdId) {
        const hold = await BookingHold.findById(current.holdId).session(session);
        if (hold?.status === "CONFIRMED") await releaseConfirmedBooking(current, session);
        else if (hold?.status === "HELD") {
          await changeHoldInventory(hold, session, ["HELD"], "RELEASED");
        }
      }

      current.status = "CANCELLED";
      current.paymentStatus = fullRefund && refundComplete ? "REFUNDED" : "PAID";
      current.refundStatus = refundComplete
        ? (fullRefund ? "PROCESSED" : "PARTIALLY_REFUNDED")
        : "INITIATED";
      current.refundId = gatewayRefund.id || "";
      current.refundedAmount = refundAmount;
      current.refundedAt = now;
      current.refundedBy = isAdmin ? user?._id : null;
      current.refundReason = reason || (isAdmin ? "Refund processed by Administrator" : "Customer cancellation");
      current.cancelledAt = current.cancelledAt || now;
      current.cancellationReason = reason || current.refundReason;
      await current.save({ session });

      payment.status = fullRefund && refundComplete ? "REFUNDED" : "SUCCESS";
      payment.refundDetails = {
        refundId: gatewayRefund.id || "",
        refundAmount,
        refundStatus: gatewayRefund.status || "PENDING",
        refundedAt: refundComplete ? now : null,
      };
      await payment.save({ session });
      return current;
  });

  if (isAdmin) {
    try {
      await AuditLog.create({
        action: "ADMIN_REFUND_BOOKING",
        performedBy: user?._id,
        targetType: "Booking",
        targetId: String(booking._id),
        details: {
          bookingId: booking.bookingId,
          bookingType: booking.bookingType,
          refundId: gatewayRefund.id || "",
          refundedAmount: refundAmount,
          originalAmount,
          reason: reason || "Admin refund",
        },
        ipAddress,
      });
    } catch (error) {
      console.error("Travel refund audit log failed:", error.message);
    }
  }

  return { booking: updatedBooking, alreadyProcessed: false, refundedAmount: refundAmount };
}

export async function finalizeTravelRefundWebhook(payment, refundEntity) {
  if (!payment?.bookingId) return;
  await withBookingTransaction(async (session) => {
    const booking = await Booking.findById(payment.bookingId).session(session);
    if (!booking) return;
    if (booking.holdId) {
      const hold = await BookingHold.findById(booking.holdId).session(session);
      if (hold?.status === "CONFIRMED") await releaseConfirmedBooking(booking, session);
      else if (hold?.status === "HELD") {
        await changeHoldInventory(hold, session, ["HELD"], "RELEASED");
      }
    }
    booking.status = "CANCELLED";
    const refundedAmount = Number(refundEntity.amount || 0) / 100;
    const fullRefund = refundedAmount >= Number(booking.totalAmount || booking.amount || 0);
    booking.paymentStatus = fullRefund ? "REFUNDED" : "PAID";
    booking.refundStatus = fullRefund ? "PROCESSED" : "PARTIALLY_REFUNDED";
    booking.refundId = refundEntity.id || "";
    booking.refundedAmount = refundedAmount;
    booking.refundedAt = new Date((refundEntity.created_at || Date.now() / 1000) * 1000);
    booking.cancelledAt = booking.cancelledAt || new Date();
    await booking.save({ session });

    payment.status = fullRefund ? "REFUNDED" : "SUCCESS";
    payment.refundDetails = {
      refundId: refundEntity.id || "",
      refundAmount: booking.refundedAmount,
      refundStatus: "SUCCESS",
      refundedAt: booking.refundedAt,
    };
    await payment.save({ session });
  });
}
