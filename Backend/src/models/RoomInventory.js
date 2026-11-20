import mongoose from "mongoose";

const roomInventorySchema = new mongoose.Schema(
  {
    roomTypeId: { type: mongoose.Schema.Types.ObjectId, ref: "RoomType", required: true },
    date: { type: String, required: true },
    totalRooms: { type: Number, required: true, min: 0 },
    bookedRooms: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

roomInventorySchema.index({ roomTypeId: 1, date: 1 }, { unique: true, name: "unique_room_type_date" });
roomInventorySchema.index({ date: 1 });

export default mongoose.models.RoomInventory || mongoose.model("RoomInventory", roomInventorySchema);
