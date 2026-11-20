import mongoose from "mongoose";

const hotelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Hotel name is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      index: true,
    },
    citySlug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    type: {
      type: String,
      required: [true, "Hotel category/type is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price per night is required"],
      min: [0, "Price cannot be negative"],
    },
    rating: {
      type: String,
      default: "4.20",
    },
    starRating: {
      type: Number,
      default: function () {
        if (this.type && this.type.includes("5")) return 5;
        if (this.type && this.type.includes("4")) return 4;
        return 3;
      },
    },
    isAc: {
      type: Boolean,
      default: true,
    },
    amenities: {
      type: [String],
      default: ["Free WiFi", "Swimming Pool", "Complimentary Breakfast", "AC Rooms", "Room Service"],
    },
    cancellationPolicy: {
      type: String,
      trim: true,
      default: "Free cancellation up to 24 hours before check-in.",
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

hotelSchema.index({ city: 1, active: 1 });

const Hotel = mongoose.models.Hotel || mongoose.model("Hotel", hotelSchema);

export default Hotel;
