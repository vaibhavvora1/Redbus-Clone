import mongoose from "mongoose";

const pointSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  timeOffsetMinutes: { type: Number, default: 0 },
  address: { type: String, default: "", trim: true },
  landmark: { type: String, default: "", trim: true },
});

const routeSchema = new mongoose.Schema(
  {
    fromCity: {
      type: String,
      required: [true, "Source city is required"],
      trim: true,
    },
    toCity: {
      type: String,
      required: [true, "Destination city is required"],
      trim: true,
    },
    distanceKm: {
      type: Number,
      default: 250,
      min: 0,
    },
    estimatedDuration: {
      type: String,
      default: "5h 30m",
      trim: true,
    },
    boardingPoints: {
      type: [pointSchema],
      default: [],
    },
    droppingPoints: {
      type: [pointSchema],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

routeSchema.index({ fromCity: 1, toCity: 1 });

const Route = mongoose.model("Route", routeSchema);

export default Route;
