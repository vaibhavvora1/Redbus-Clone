import mongoose from "mongoose";

const stationSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
    },
    citySlug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    aliases: {
      type: [String],
      default: [],
    },
    nameNormalized: { type: String, select: false },
    codeNormalized: { type: String, select: false },
    cityNormalized: { type: String, select: false },
    aliasesNormalized: { type: [String], select: false },
    isPopular: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, autoIndex: false }
);

stationSchema.index({ code: 1 }, { unique: true });
stationSchema.index({ nameNormalized: 1 });
stationSchema.index({ codeNormalized: 1 });
stationSchema.index({ cityNormalized: 1 });
stationSchema.index({ cityId: 1 });
stationSchema.index({ citySlug: 1 });
stationSchema.index({ aliasesNormalized: 1 });

stationSchema.pre("validate", function () {
  this.code = this.code.trim().toUpperCase();
  this.nameNormalized = this.name.trim().toLocaleLowerCase("en");
  this.codeNormalized = this.code.toLocaleLowerCase("en");
  this.cityNormalized = this.city.trim().toLocaleLowerCase("en");
  this.aliases = [...new Set((this.aliases || []).map((alias) => alias.trim()).filter(Boolean))];
  this.aliasesNormalized = this.aliases.map((alias) => alias.toLocaleLowerCase("en"));
});

export default mongoose.model("Station", stationSchema);
