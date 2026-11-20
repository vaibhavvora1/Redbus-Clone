import mongoose from "mongoose";

const otpSendWindowSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    purpose: {
      type: String,
      enum: ["register", "login", "forgot-password"],
      required: true,
    },
    windowStartedAt: {
      type: Date,
      required: true,
    },
    sendCount: {
      type: Number,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { versionKey: false }
);

otpSendWindowSchema.index({ email: 1, purpose: 1 }, { unique: true });
otpSendWindowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OtpSendWindow =
  mongoose.models.OtpSendWindow || mongoose.model("OtpSendWindow", otpSendWindowSchema);

export default OtpSendWindow;
