import mongoose from "mongoose";

const busSchema = new mongoose.Schema(
  {
    operator: {
      type: String,
      required: [true, "Bus operator is required"],
      trim: true,
    },
    busNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    from: {
      type: String,
      required: [true, "Departure city is required"],
      trim: true,
    },
    to: {
      type: String,
      required: [true, "Destination city is required"],
      trim: true,
    },
    journeyDate: {
      type: String,
      default: "",
    },
    runningDays: {
      type: [Number],
      default: () => [0, 1, 2, 3, 4, 5, 6],
      validate: {
        validator: (days) => days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6),
        message: "Running days must use weekday numbers from 0 (Sunday) to 6 (Saturday).",
      },
    },
    validFrom: { type: String, default: "" },
    validTo: { type: String, default: "" },
    active: { type: Boolean, default: true },
    isGovernment: { type: Boolean, default: false },
    departureTime: {
      type: String,
      default: "22:00",
    },
    arrivalTime: {
      type: String,
      default: "06:00",
    },
    busType: {
      type: String,
      default: "AC Sleeper",
      trim: true,
    },
    type: {
      type: String,
      default: function () {
        return this.busType || "AC Sleeper";
      },
    },
    totalSeats: {
      type: Number,
      default: 36,
      min: [1, "Total seats must be at least 1"],
    },
    fare: {
      type: Number,
      required: [true, "Fare is required"],
      min: [0, "Fare cannot be negative"],
    },
    price: {
      type: Number,
      default: function () {
        return this.fare;
      },
    },
    rating: {
      type: String,
      default: "4.5",
    },
    amenities: {
      type: [String],
      default: [
        "Charging Point",
        "Water Bottle",
        "Blanket",
        "Reading Light",
        "Live Tracking",
      ],
    },
    stops: { type: [mongoose.Schema.Types.Mixed], default: [] },
    boardingPoints: [
      { name: { type: String, required: true }, time: { type: String, default: "" }, address: { type: String, default: "" } },
    ],
    droppingPoints: [
      { name: { type: String, required: true }, time: { type: String, default: "" }, address: { type: String, default: "" } },
    ],
  },
  {
    timestamps: true,
  }
);

// Ensure price and fare, and busType and type stay consistent
busSchema.pre("save", function () {
  if (this.fare && !this.price) this.price = this.fare;
  if (this.price && !this.fare) this.fare = this.price;
  if (this.busType && !this.type) this.type = this.busType;
  if (this.type && !this.busType) this.busType = this.type;
});

const Bus = mongoose.model("Bus", busSchema);

export default Bus;
