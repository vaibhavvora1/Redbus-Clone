import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { isValidIndianPhone, normalizeEmail, normalizeGoogleId, normalizePhone } from "../utils/userFields.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      set: normalizeEmail,
      default: undefined,
      validate: {
        validator: (value) => value === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
        message: "Please provide a valid email address.",
      },
    },
    googleId: {
      type: String,
      set: normalizeGoogleId,
      default: undefined,
    },
    avatar: {
      type: String,
      trim: true,
    },
    // Kept for passenger contact, booking reservations and backward compatibility
    phone: {
      type: String,
      set: normalizePhone,
      default: undefined,
      validate: {
        validator: isValidIndianPhone,
        message: "Phone must be a valid 10-digit Indian number.",
      },
    },
    mobile: {
      type: String,
      set: normalizePhone,
      default: undefined,
      validate: {
        validator: isValidIndianPhone,
        message: "Mobile must be a valid 10-digit Indian number.",
      },
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN", "user", "admin"],
      default: "USER",
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    // Preserved for existing user accounts
    isVerified: {
      type: Boolean,
      default: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    savedPassengers: [
      {
        name: { type: String, trim: true },
        age: { type: Number },
        gender: { type: String, enum: ["Male", "Female", "Other"], default: "Male" },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Partial unique indexes: uniqueness only enforced when the field actually has a string value.
// This correctly handles null, undefined, and omitted fields — MongoDB sparse/unique alone
// treats null as a real value and causes E11000 duplicate key errors on the second null.
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
    name: "email_partial_unique",
  }
);

userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: { phone: { $type: "string" } },
    name: "phone_partial_unique",
  }
);

userSchema.index(
  { googleId: 1 },
  {
    unique: true,
    partialFilterExpression: { googleId: { $type: "string" } },
    name: "googleId_partial_unique",
  }
);

userSchema.pre("save", async function () {
  if (!this.password || !this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.pre("validate", function () {
  this.email = normalizeEmail(this.email);
  this.googleId = normalizeGoogleId(this.googleId);
  this.phone = normalizePhone(this.phone);
  this.mobile = normalizePhone(this.mobile);
  if (this.phone && !this.mobile) this.mobile = this.phone;
  else if (this.mobile && !this.phone) this.phone = this.mobile;
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
