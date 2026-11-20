import mongoose from "mongoose";

const trainSchema = new mongoose.Schema(
  {
    operator: {
      type: String,
      required: [true, "Train operator/name is required"],
      trim: true,
    },
    trainNumber: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    trainName: {
      type: String,
      trim: true,
      default: "",
    },
    from: {
      type: String,
      required: [true, "Origin station is required"],
      trim: true,
    },
    to: {
      type: String,
      required: [true, "Destination station is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Train class/type is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    rating: {
      type: String,
      default: "4.10",
    },
    departure: {
      type: String,
      default: "08:00",
    },
    arrival: {
      type: String,
      default: "16:00",
    },
    duration: {
      type: String,
      default: "8h 00m",
    },
    seatsLeft: {
      type: Number,
      default: 42,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    amenities: {
      type: [String],
      default: ["Pantry Car", "Charging Socket", "Linen/Bedding", "Reading Lamp"],
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Train = mongoose.models.Train || mongoose.model("Train", trainSchema);

export default Train;
