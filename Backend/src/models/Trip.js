import mongoose from "mongoose";

const tripSeatSchema = new mongoose.Schema({
  seatNumber: { type: String, required: true },
  deck: { type: String, enum: ["lower", "upper"], default: "lower" },
  row: { type: Number, default: 1 },
  col: { type: Number, default: 1 },
  type: { type: String, enum: ["seater", "sleeper"], default: "seater" },
  fare: { type: Number, required: true },
  isBooked: { type: Boolean, default: false },
  isLocked: { type: Boolean, default: false },
  lockedBy: { type: String, default: null }, // user ID or session ID
  lockedAt: { type: Date, default: null },
  holdExpiresAt: { type: Date, default: null },
});

const tripSchema = new mongoose.Schema(
  {
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: false,
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: false,
      index: true,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      required: false,
    },
    operator: {
      type: String,
      required: [true, "Operator name is required"],
      trim: true,
    },
    busNumber: {
      type: String,
      trim: true,
      default: "",
    },
    fromCity: {
      type: String,
      required: [true, "Departure city is required"],
      trim: true,
      index: true,
    },
    toCity: {
      type: String,
      required: [true, "Destination city is required"],
      trim: true,
      index: true,
    },
    journeyDate: {
      type: String, // YYYY-MM-DD
      required: [true, "Journey date is required"],
      trim: true,
      index: true,
    },
    travelDate: {
      type: String,
      trim: true,
      index: true,
    },
    departureAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["scheduled", "cancelled", "departed"],
      default: "scheduled",
      index: true,
    },
    isGovernment: { type: Boolean, default: false },
    fareOverride: { type: Number, min: 0, default: null },
    departureTime: {
      type: String,
      required: [true, "Departure time is required"],
      default: "21:00",
    },
    arrivalTime: {
      type: String,
      required: [true, "Arrival time is required"],
      default: "06:00",
    },
    duration: {
      type: String,
      default: "9h 00m",
    },
    busType: {
      type: String,
      default: "AC Sleeper",
      trim: true,
    },
    fare: {
      type: Number,
      required: [true, "Base fare is required"],
      min: [0, "Fare cannot be negative"],
    },
    price: {
      type: Number,
      default: function () {
        return this.fare;
      },
    },
    totalSeats: {
      type: Number,
      default: 36,
    },
    availableSeats: {
      type: Number,
      default: 36,
      min: [0, "Available seats cannot be negative"],
    },
    rating: {
      type: String,
      default: "4.5",
    },
    amenities: {
      type: [String],
      default: [
        "Water Bottle",
        "Blanket",
        "Charging Point",
        "Reading Light",
        "Live Tracking",
      ],
    },
    boardingPoints: [
      {
        name: { type: String, required: true },
        time: { type: String, default: "" },
        address: { type: String, default: "" },
      },
    ],
    droppingPoints: [
      {
        name: { type: String, required: true },
        time: { type: String, default: "" },
        address: { type: String, default: "" },
      },
    ],
    seats: [tripSeatSchema],
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

tripSchema.index({ fromCity: 1, toCity: 1, journeyDate: 1 });
tripSchema.index(
  { scheduleId: 1, travelDate: 1 },
  {
    unique: true,
    partialFilterExpression: {
      scheduleId: { $exists: true, $type: "objectId" },
      travelDate: { $type: "string" },
    },
    name: "unique_schedule_travel_date",
  }
);
tripSchema.index({ fromCity: 1, toCity: 1, travelDate: 1, status: 1 });
tripSchema.index({ "seats.seatNumber": 1, "seats.isBooked": 1, "seats.isLocked": 1 });

tripSchema.pre("validate", function () {
  if (!this.travelDate && this.journeyDate) this.travelDate = this.journeyDate;
  if (!this.journeyDate && this.travelDate) this.journeyDate = this.travelDate;
  if (!this.scheduleId && this.bus) this.scheduleId = this.bus;
  if (this.scheduleId && !this.bus) this.bus = this.scheduleId;
});

const Trip = mongoose.model("Trip", tripSchema);

export default Trip;
