import mongoose from "mongoose";

const bookingHoldSchema = new mongoose.Schema(
  {
    bookingType: { type: String, enum: ["train", "hotel"], required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    idempotencyKey: { type: String, required: true, trim: true },
    requestHash: { type: String, required: true },
    trainRunId: { type: mongoose.Schema.Types.ObjectId, ref: "TrainRun" },
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "RoomType" },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel" },
    classCode: { type: String, uppercase: true, trim: true },
    passengerCount: { type: Number, min: 1 },
    roomCount: { type: Number, min: 1 },
    travelDate: { type: String },
    checkIn: { type: String },
    checkOut: { type: String },
    inventoryDates: { type: [String], default: [] },
    baseFare: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    charges: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["HELD", "CONFIRMED", "RELEASED", "EXPIRED"], default: "HELD" },
    expiresAt: { type: Date, required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
  },
  { timestamps: true }
);

bookingHoldSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, name: "unique_user_hold_idempotency" });
bookingHoldSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.models.BookingHold || mongoose.model("BookingHold", bookingHoldSchema);
