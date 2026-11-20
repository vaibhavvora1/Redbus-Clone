import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: false,
      index: true,
    },
    bookingType: { type: String, enum: ["bus", "train", "hotel"], default: "bus", index: true },
    holdId: { type: mongoose.Schema.Types.ObjectId, ref: "BookingHold", default: null, index: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", index: true },
    seatNumbers: { type: [String], default: [] },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    razorpayOrderId: {
      type: String,
      required: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      index: true,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    method: {
      type: String,
      default: "razorpay", // razorpay | sandbox
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    errorReason: {
      type: String,
      default: null,
    },
    refundDetails: {
      refundId: String,
      refundAmount: Number,
      refundStatus: String,
      refundedAt: Date,
    },
  },
  { timestamps: true }
);

const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

export default Payment;
