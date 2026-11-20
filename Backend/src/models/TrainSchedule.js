import mongoose from "mongoose";

const stopSchema = new mongoose.Schema(
  {
    stationId: { type: mongoose.Schema.Types.ObjectId, ref: "Station", required: true },
    stationCode: { type: String, required: true, uppercase: true, trim: true },
    stationName: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    arrivalTime: { type: String, default: "" },
    departureTime: { type: String, default: "" },
    dayOffset: { type: Number, default: 0, min: 0, max: 3 },
  },
  { _id: false }
);

const classSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    fare: { type: Number, required: true, min: 0 },
    seatCount: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const trainScheduleSchema = new mongoose.Schema(
  {
    trainId: { type: mongoose.Schema.Types.ObjectId, ref: "Train", required: true },
    trainNumber: { type: String, required: true, trim: true, index: true },
    trainName: { type: String, required: true, trim: true },
    stops: { type: [stopSchema], required: true, validate: (stops) => stops.length >= 2 },
    runningDays: {
      type: [Number],
      default: [0, 1, 2, 3, 4, 5, 6],
      validate: {
        validator: (days) => days.length > 0 && days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6),
        message: "Running days must contain weekday numbers from 0 to 6.",
      },
    },
    validFrom: { type: String, trim: true, default: "" },
    validTo: { type: String, trim: true, default: "" },
    classes: { type: [classSchema], required: true, validate: (classes) => classes.length > 0 },
    active: { type: Boolean, default: true, index: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

trainScheduleSchema.index({ trainId: 1, active: 1 });
trainScheduleSchema.index({ "stops.stationCode": 1, active: 1 });

export default mongoose.models.TrainSchedule || mongoose.model("TrainSchedule", trainScheduleSchema);
