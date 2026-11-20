import mongoose from "mongoose";

const classInventorySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true },
    name: { type: String, required: true },
    fare: { type: Number, required: true, min: 0 },
    totalSeats: { type: Number, required: true, min: 0 },
    availableSeats: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const trainRunSchema = new mongoose.Schema(
  {
    scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "TrainSchedule", required: true },
    travelDate: { type: String, required: true },
    departureAt: { type: Date, required: true },
    arrivalAt: { type: Date, required: true },
    status: { type: String, enum: ["SCHEDULED", "CANCELLED", "DEPARTED"], default: "SCHEDULED" },
    classInventory: { type: [classInventorySchema], required: true },
  },
  { timestamps: true }
);

trainRunSchema.index({ scheduleId: 1, travelDate: 1 }, { unique: true, name: "unique_schedule_travel_date" });
trainRunSchema.index({ travelDate: 1, status: 1 });

export default mongoose.models.TrainRun || mongoose.model("TrainRun", trainRunSchema);
