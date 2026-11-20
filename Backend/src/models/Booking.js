import mongoose from "mongoose";

const passengerSchema = new mongoose.Schema({
  seatNumber: { type: String, default: "" },
  name: { type: String, required: true, trim: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ["Male", "Female", "Other"], default: "Male" },
  berthPreference: { type: String, default: "" },
});

const guestSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number, min: 0, max: 120 },
  gender: { type: String, enum: ["Male", "Female", "Other", ""] },
});

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    userEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },
    userName: {
      type: String,
      trim: true,
      default: "",
    },
    userPhone: {
      type: String,
      trim: true,
      default: "",
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: false,
    },
    vertical: {
      type: String,
      enum: ["Bus", "Hotel", "Train"],
      default: "Bus",
    },
    bookingType: {
      type: String,
      enum: ["bus", "train", "hotel"],
      default: "bus",
      index: true,
    },
    holdId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BookingHold",
      default: null,
    },
    trainRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainRun",
      default: null,
    },
    trainScheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TrainSchedule",
      default: null,
    },
    fromStation: { type: String, default: "" },
    toStation: { type: String, default: "" },
    fromStationCode: { type: String, default: "" },
    toStationCode: { type: String, default: "" },
    departureAt: { type: Date, default: null },
    arrivalAt: { type: Date, default: null },
    trainNumber: { type: String, default: "" },
    trainClass: { type: String, default: "" },
    hotelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      default: null,
    },
    roomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomType",
      default: null,
    },
    roomTypeName: { type: String, default: "" },
    hotelAddress: { type: String, default: "" },
    checkIn: { type: String, default: "" },
    checkOut: { type: String, default: "" },
    checkInTime: { type: String, default: "14:00" },
    checkOutTime: { type: String, default: "11:00" },
    nights: { type: Number, default: 0, min: 0 },
    roomCount: { type: Number, default: 0, min: 0 },
    guests: { type: [guestSchema], default: [] },
    specialRequest: { type: String, default: "" },
    cancellationPolicy: { type: String, default: "" },
    fareBreakdown: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    title: {
      type: String,
      required: [true, "Booking title is required"],
      trim: true,
    },
    operator: {
      type: String,
      required: [true, "Operator name is required"],
      trim: true,
    },
    busNumber: {
      type: String,
      default: "",
    },
    fromCity: {
      type: String,
      default: "",
    },
    toCity: {
      type: String,
      default: "",
    },
    date: {
      type: String,
      required: [true, "Date is required"],
    },
    time: {
      type: String,
      required: [true, "Time is required"],
    },
    seats: {
      type: String,
      required: [true, "Seats information is required"],
    },
    seatNumbers: {
      type: [String],
      default: [],
    },
    passengers: {
      type: [passengerSchema],
      default: [],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    baseFare: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: function () {
        return this.amount;
      },
    },
    boardingPoint: {
      type: String,
      default: "",
    },
    droppingPoint: {
      type: String,
      default: "",
    },
    qrCode: {
      type: String, // Data URL for display / print
      default: "",
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: false,
    },
    paymentOrderId: {
      type: String,
      default: "",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "REFUNDED", "FAILED"],
      default: "PENDING",
    },
    status: {
      type: String,
      enum: ["CONFIRMED", "PENDING", "CANCELLED", "EXPIRED"],
      default: "PENDING",
    },
    refundStatus: {
      type: String,
      enum: ["NOT_APPLICABLE", "INITIATED", "PROCESSED", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED", "MANUAL_REQUIRED"],
      default: "NOT_APPLICABLE",
    },
    refundId: {
      type: String,
      default: "",
    },
    refundedAmount: {
      type: Number,
      default: 0,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    refundReason: {
      type: String,
      default: "",
    },
    cancellationReason: {
      type: String,
      default: "",
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    idempotencyKey: {
      type: String,
      default: undefined,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: One seat cannot have two active (CONFIRMED/PENDING) bookings on the same trip
bookingSchema.index(
  { tripId: 1, seatNumbers: 1 },
  {
    unique: true,
    partialFilterExpression: {
      tripId: { $exists: true, $type: "objectId" },
      status: { $in: ["CONFIRMED", "PENDING"] },
    },
    name: "unique_active_trip_seat_booking",
  }
);
bookingSchema.index({ userId: 1, date: -1 });
bookingSchema.index({ tripId: 1, status: 1 });
bookingSchema.index({ bookingType: 1, userId: 1, createdAt: -1 });
bookingSchema.index(
  { holdId: 1 },
  {
    unique: true,
    partialFilterExpression: { holdId: { $type: "objectId" } },
    name: "unique_booking_hold",
  }
);

// One user, one journey rule: Prevents accidental duplicate bookings by the same user for the same seat & trip
bookingSchema.index(
  { userId: 1, tripId: 1, seatNumbers: 1 },
  {
    unique: true,
    partialFilterExpression: {
      userId: { $exists: true, $type: "objectId" },
      tripId: { $exists: true, $type: "objectId" },
      status: { $in: ["CONFIRMED", "PENDING"] },
    },
    name: "unique_user_trip_seat_booking",
  }
);

// Pre-save hook to ensure bookingId
bookingSchema.pre("save", function () {
  if (!this.bookingId) {
    this.bookingId = `RDB-${this._id.toString().toUpperCase()}`;
  }
  if (!this.totalAmount) {
    this.totalAmount = this.amount;
  }
});

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
