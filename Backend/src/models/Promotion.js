import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Promotion title is required"],
      trim: true,
    },
    subtitle: {
      type: String,
      required: [true, "Promotion subtitle is required"],
      trim: true,
    },
    cta: {
      type: String,
      default: "Know more",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

promotionSchema.index({ isActive: 1, createdAt: -1 });

const Promotion = mongoose.model("Promotion", promotionSchema);

export default Promotion;
