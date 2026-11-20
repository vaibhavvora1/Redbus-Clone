import mongoose from "mongoose";

export function slugifyCityName(name) {
  return String(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "City name is required"],
      trim: true,
    },
    nameNormalized: {
      type: String,
      select: false,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    aliases: {
      type: [String],
      default: [],
    },
    aliasesNormalized: {
      type: [String],
      select: false,
    },
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    population: {
      type: Number,
      default: 0,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, autoIndex: false }
);

citySchema.index({ slug: 1 }, { unique: true });
citySchema.index({ nameNormalized: 1 });
citySchema.index({ aliasesNormalized: 1 });

citySchema.pre("validate", function () {
  this.nameNormalized = this.name.trim().toLocaleLowerCase("en");
  this.aliases = [...new Set((this.aliases || []).map((alias) => alias.trim()).filter(Boolean))];
  this.aliasesNormalized = this.aliases.map((alias) => alias.toLocaleLowerCase("en"));
  if (!this.slug || this.isModified("name")) this.slug = slugifyCityName(this.name);
});

const City = mongoose.model("City", citySchema);

export default City;
