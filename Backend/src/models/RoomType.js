import mongoose from "mongoose";

const roomTypeSchema = new mongoose.Schema(
  {
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    maxGuests: { type: Number, required: true, min: 1 },
    totalRooms: { type: Number, required: true, min: 0 },
    pricePerNight: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true, index: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roomTypeSchema.index({ hotelId: 1, name: 1 }, { unique: true });

export default mongoose.models.RoomType || mongoose.model("RoomType", roomTypeSchema);
