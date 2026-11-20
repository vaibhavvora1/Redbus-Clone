import mongoose from "mongoose";

const operatorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Operator name is required"],
      trim: true,
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
    },
    rating: {
      type: String,
      default: "3.85",
    },
    isGovernment: {
      type: Boolean,
      default: true,
    },
    localName: {
      type: String,
      default: "",
    },
    services: {
      type: String,
      default: "Services including Express, Deluxe, and AC Sleeper",
    },
    offer: {
      type: String,
      default: "Special concessions available",
    },
    emoji: {
      type: String,
      default: "🚌",
    },
    ringColor: {
      type: String,
      default: "border-red-500",
    },
    routes: [
      {
        label: { type: String, required: true },
        price: { type: Number, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Operator = mongoose.model("Operator", operatorSchema);

export default Operator;
