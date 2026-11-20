import { z } from "zod";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Bus from "../models/Bus.js";
import Train from "../models/Train.js";
import Hotel from "../models/Hotel.js";
import TrainSchedule from "../models/TrainSchedule.js";
import Station from "../models/Station.js";
import RoomType from "../models/RoomType.js";
import RoomInventory from "../models/RoomInventory.js";
import Operator from "../models/Operator.js";
import Promotion from "../models/Promotion.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import City from "../models/City.js";
import Route from "../models/Route.js";
import Trip from "../models/Trip.js";
import Payment from "../models/Payment.js";
import AuditLog from "../models/AuditLog.js";
import Razorpay from "razorpay";
import { getTodayInAppTZ, combineDateAndTime, addDaysToAppDate } from "../utils/timeZone.js";
import { generateDefaultSeatLayout } from "./busController.js";
import asyncHandler from "../utils/asyncHandler.js";
import { resolveCityInput, resolveStationInput } from "../utils/locationSearch.js";
import { createPaymentRefund } from "../services/razorpayService.js";
import { processTravelRefund } from "../services/travelCancellation.js";

// Helper: build daily series for last N days from a raw array of docs
function buildDailySeries(docs, days = 30) {
  const now = new Date();
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata" }).format(d);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dayItems = docs.filter((b) => {
      const bDate = new Intl.DateTimeFormat("en-CA", { timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata" }).format(new Date(b.createdAt));
      return bDate === dateKey;
    });
    const revenue = dayItems
      .filter((b) => b.status !== "CANCELLED")
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    series.push({ date: dateKey, label, bookings: dayItems.length, revenue });
  }
  return series;
}

// ==================== ZOD SCHEMAS ====================
const createBusSchema = z.object({
  operator: z.string().trim().min(2, "Operator name is required"),
  busNumber: z.string().trim().optional(),
  from: z.string().trim().min(2, "Departure city is required"),
  to: z.string().trim().min(2, "Destination city is required"),
  busType: z.string().trim().optional(),
  type: z.string().trim().optional(),
  totalSeats: z.coerce.number().min(1, "Total seats must be at least 1").max(100).default(36),
  fare: z.coerce.number().min(1, "Fare must be greater than 0"),
  price: z.coerce.number().optional(),
  journeyDate: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  runningDays: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  active: z.boolean().optional(),
  isGovernment: z.boolean().optional(),
  departureTime: z.string().optional(),
  arrivalTime: z.string().optional(),
  rating: z.string().optional(),
  amenities: z.array(z.string()).optional(),
});

const createTripSchema = z.object({
  operator: z.string().trim().min(2, "Operator is required"),
  busNumber: z.string().trim().optional(),
  fromCity: z.string().trim().min(2, "Source city is required"),
  toCity: z.string().trim().min(2, "Destination city is required"),
  journeyDate: z.string().trim().min(10, "Journey date (YYYY-MM-DD) is required"),
  departureTime: z.string().trim().default("21:00"),
  arrivalTime: z.string().trim().default("06:00"),
  busType: z.string().trim().default("AC Sleeper"),
  fare: z.coerce.number().min(1, "Fare must be greater than 0"),
  totalSeats: z.coerce.number().min(1).max(100).default(36),
  duration: z.string().optional(),
  rating: z.string().optional(),
  amenities: z.array(z.string()).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

const adminHotelSchema = z.object({
  name: z.string().trim().min(2, "Hotel name is required").max(120),
  city: z.string().trim().min(1, "Select a city from the suggestions."),
  type: z.string().trim().min(1, "Hotel category is required").max(80),
  price: z.coerce.number().positive("Price must be greater than zero."),
  address: z.string().trim().max(300).optional().default(""),
  rating: z.string().trim().max(10).optional().default("4.20"),
  starRating: z.coerce.number().int().min(1).max(5).optional(),
  isAc: z.boolean().optional().default(true),
  amenities: z.array(z.string().trim().min(1)).optional(),
  cancellationPolicy: z.string().trim().max(500).optional(),
  active: z.boolean().optional().default(true),
  isDemo: z.boolean().optional().default(false),
  roomType: z.object({
    id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid room type.").optional(),
    name: z.string().trim().min(2, "Room type name is required.").max(80),
    description: z.string().trim().max(500).optional().default(""),
    maxGuests: z.coerce.number().int().min(1, "Capacity must be at least one guest.").max(30),
    totalRooms: z.coerce.number().int().min(1, "At least one room is required.").max(10000),
    pricePerNight: z.coerce.number().positive("Room price must be greater than zero."),
  }),
});

const adminTrainSchema = z.object({
  operator: z.string().trim().min(2, "Train name is required.").max(120),
  trainNumber: z.string().trim().min(1, "Train number is required.").max(20),
  from: z.string().trim().min(1, "Select a departure station from the suggestions."),
  to: z.string().trim().min(1, "Select a destination station from the suggestions."),
  type: z.string().trim().min(1, "Class name is required.").max(40),
  classCode: z.string().trim().regex(/^[A-Za-z0-9]{1,10}$/, "Class code must be 1-10 letters or digits."),
  price: z.coerce.number().positive("Fare must be greater than zero."),
  departure: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Departure must use HH:mm."),
  arrival: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Arrival must use HH:mm."),
  duration: z.string().trim().max(30).optional().default(""),
  seatsLeft: z.coerce.number().int().min(1, "Seat count must be at least one.").max(10000).default(42),
  rating: z.string().trim().max(10).optional().default("4.10"),
  runningDays: z.array(z.coerce.number().int().min(0).max(6))
    .min(1, "Select at least one running day.")
    .default([0, 1, 2, 3, 4, 5, 6]),
  validFrom: z.string().trim().optional().default(""),
  validTo: z.string().trim().optional().default(""),
  active: z.boolean().optional().default(true),
  isDemo: z.boolean().optional().default(false),
}).superRefine((data, ctx) => {
  const validFrom = data.validFrom || getTodayInAppTZ();
  if (!addDaysToAppDate(validFrom, 0)) {
    ctx.addIssue({ code: "custom", path: ["validFrom"], message: "Start date must use a real YYYY-MM-DD date." });
  }
  if (data.validTo && !addDaysToAppDate(data.validTo, 0)) {
    ctx.addIssue({ code: "custom", path: ["validTo"], message: "End date must use a real YYYY-MM-DD date." });
  } else if (data.validTo && data.validTo < validFrom) {
    ctx.addIssue({ code: "custom", path: ["validTo"], message: "End date must be on or after the start date." });
  }
  if (data.departure === data.arrival) {
    ctx.addIssue({ code: "custom", path: ["arrival"], message: "Arrival and departure times must differ." });
  }
}).transform((data) => ({ ...data, validFrom: data.validFrom || getTodayInAppTZ() }));

function sendAdminValidationError(res, issues) {
  return res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: issues.map((issue) => ({
      field: issue.path.join(".") || "request",
      message: issue.message,
    })),
  });
}

function makeAdminValidationError(field, message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.validationErrors = [{ field, message }];
  return error;
}

async function resolveAdminCity(value) {
  const canonicalName = await resolveCityInput(value, "Destination");
  const city = await City.findOne({
    active: true,
    nameNormalized: canonicalName.toLocaleLowerCase("en"),
  }).select("_id name slug state").lean();
  if (!city) throw makeAdminValidationError("city", "Select an imported city from the suggestions.");
  return city;
}

async function resolveAdminStation(value, field) {
  const resolved = await resolveStationInput(value, field);
  if (!resolved || resolved.type !== "station" || !resolved.stationCode) {
    throw makeAdminValidationError(field.toLocaleLowerCase("en"), "Select a station, not a city.");
  }
  const station = await Station.findOne({
    code: resolved.stationCode,
    active: true,
  }).lean();
  if (!station || !station.cityId) {
    throw makeAdminValidationError(field.toLocaleLowerCase("en"), "The selected station is not linked to an imported city.");
  }
  const city = await City.findOne({ _id: station.cityId, active: true }).select("_id name slug").lean();
  if (!city) {
    throw makeAdminValidationError(field.toLocaleLowerCase("en"), "The selected station has no active linked city.");
  }
  return { station, city };
}

// ==================== 1. DASHBOARD STATS ====================
export const getAdminStats = asyncHandler(async (req, res) => {
  const todayStart = combineDateAndTime(getTodayInAppTZ(), "00:00");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalBookings,
    confirmedTickets,
    cancelledTickets,
    pendingBookings,
    todayBookings,
    totalBuses,
    totalTrips,
    totalTrains,
    totalHotels,
    totalOperators,
    totalRoutes,
    totalPromotions,
    revenueAgg,
    recentBookings,
    last30DaysBookings,
    bookingsByVertical,
    topRoutes,
  ] = await Promise.all([
    User.countDocuments(),
    Booking.countDocuments(),
    Booking.countDocuments({ status: "CONFIRMED" }),
    Booking.countDocuments({ status: "CANCELLED" }),
    Booking.countDocuments({ status: "PENDING" }),
    Booking.countDocuments({ createdAt: { $gte: todayStart } }),
    Bus.countDocuments(),
    Trip.countDocuments(),
    Train.countDocuments(),
    Hotel.countDocuments(),
    Operator.countDocuments(),
    Route.countDocuments(),
    Promotion.countDocuments(),
    Booking.aggregate([
      { $match: { status: { $ne: "CANCELLED" } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Booking.find()
      .populate("userId", "name email phone")
      .populate("tripId", "operator busNumber fromCity toCity departureTime arrivalTime")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Booking.find({ createdAt: { $gte: thirtyDaysAgo } })
      .select("amount status createdAt vertical")
      .lean(),
    Booking.aggregate([
      { $group: { _id: "$vertical", count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { fromCity: { $exists: true, $ne: "" }, toCity: { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: { from: "$fromCity", to: "$toCity" },
          count: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $ne: ["$status", "CANCELLED"] }, "$amount", 0] } },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          route: { $concat: ["$_id.from", " → ", "$_id.to"] },
          count: 1,
          revenue: 1,
        },
      },
    ]),
  ]);

  const totalRevenue = revenueAgg[0]?.total || 0;
  const dailyBookings = buildDailySeries(last30DaysBookings, 30);

  // Booking status breakdown for donut chart
  const statusBreakdown = [
    { name: "Confirmed", value: confirmedTickets, color: "#10b981" },
    { name: "Cancelled", value: cancelledTickets, color: "#ef4444" },
    { name: "Pending", value: pendingBookings, color: "#f59e0b" },
    { name: "Other", value: Math.max(0, totalBookings - confirmedTickets - cancelledTickets - pendingBookings), color: "#6b7280" },
  ].filter((s) => s.value > 0);

  const verticalMap = {};
  bookingsByVertical.forEach((v) => { verticalMap[v._id] = v.count; });

  return res.status(200).json({
    success: true,
    data: {
      totalUsers,
      totalBookings,
      confirmedTickets,
      cancelledTickets,
      pendingBookings,
      totalRevenue,
      todayBookings,
      totalBuses,
      totalTrips,
      totalTrains,
      totalHotels,
      totalOperators,
      totalRoutes,
      totalPromotions,
      dailyBookings,
      recentBookings,
      statusBreakdown,
      topRoutes,
      bookingsByVertical: verticalMap,
    },
  });
});

// ==================== 2. USERS MANAGEMENT ====================
export const getAdminUsers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  if (search && String(search).trim()) {
    const term = String(search).trim();
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { email: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { mobile: { $regex: term, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    User.countDocuments(filter),
  ]);

  // Aggregate total bookings & total spent per user
  const userIds = users.map((u) => u._id);
  const bookingAgg = await Booking.aggregate([
    { $match: { userId: { $in: userIds } } },
    {
      $group: {
        _id: "$userId",
        totalBookings: { $sum: 1 },
        totalSpent: {
          $sum: { $cond: [{ $ne: ["$status", "CANCELLED"] }, "$amount", 0] },
        },
      },
    },
  ]);

  const statsMap = {};
  bookingAgg.forEach((agg) => {
    statsMap[agg._id.toString()] = {
      totalBookings: agg.totalBookings,
      totalSpent: agg.totalSpent,
    };
  });

  const enrichedUsers = users.map((u) => ({
    ...u,
    totalBookings: statsMap[u._id.toString()]?.totalBookings || 0,
    totalSpent: statsMap[u._id.toString()]?.totalSpent || 0,
  }));

  return res.status(200).json({
    success: true,
    count: enrichedUsers.length,
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    currentPage: pageNum,
    limit: limitNum,
    data: enrichedUsers,
  });
});

export const getAdminUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password").lean();
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  // Get full booking history for this user
  const bookings = await Booking.find({
    $or: [
      { userId: user._id },
      ...(user.email ? [{ userEmail: user.email }] : []),
      ...(user.phone ? [{ userPhone: user.phone }, { userPhone: user.mobile }] : []),
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  const totalSpent = bookings
    .filter((b) => b.status !== "CANCELLED")
    .reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  return res.status(200).json({
    success: true,
    data: {
      ...user,
      totalBookings: bookings.length,
      totalSpent,
      bookings,
    },
  });
});

export const updateAdminUserBlock = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  // Prevent blocking an admin
  if (String(user.role).toLowerCase() === "admin") {
    return res.status(400).json({
      success: false,
      message: "Admin accounts cannot be blocked.",
    });
  }

  const newStatus = typeof req.body.isBlocked === "boolean" ? req.body.isBlocked : !user.isBlocked;
  user.isBlocked = newStatus;
  await user.save();

  return res.status(200).json({
    success: true,
    message: `User successfully ${newStatus ? "blocked" : "unblocked"}.`,
    data: {
      id: user._id,
      name: user.name,
      isBlocked: user.isBlocked,
    },
  });
});

export const updateAdminUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!role || !["USER", "ADMIN", "user", "admin"].includes(role)) {
    return res.status(400).json({
      success: false,
      message: "Role must be USER or ADMIN.",
    });
  }

  const normalized = role.toUpperCase();
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role: normalized },
    { returnDocument: "after" }
  ).select("-password");

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  return res.status(200).json({
    success: true,
    message: `User role updated to ${normalized}.`,
    data: user,
  });
});

export const deleteAdminUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: "User not found." });
  if (String(user.role).toLowerCase() === "admin") {
    return res.status(400).json({ success: false, message: "Admin accounts cannot be deleted via this endpoint." });
  }
  await User.findByIdAndDelete(req.params.id);
  return res.status(200).json({ success: true, message: "User deleted successfully." });
});

// ==================== 3. BUS BOOKINGS ====================
export const getAdminBookings = asyncHandler(async (req, res) => {
  const {
    search,
    status,
    refundStatus,
    vertical,
    startDate,
    endDate,
    route,
    tripId,
    page = 1,
    limit = 10,
  } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  if (tripId) filter.tripId = tripId;

  if (status && status !== "all") {
    filter.status = status.toUpperCase();
  }

  if (refundStatus && refundStatus !== "all") {
    filter.refundStatus = refundStatus.toUpperCase();
  }

  if (vertical && vertical !== "all") {
    filter.vertical = vertical;
  }

  if (route && String(route).trim()) {
    const term = String(route).trim();
    filter.$or = [
      { fromCity: { $regex: term, $options: "i" } },
      { toCity: { $regex: term, $options: "i" } },
    ];
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (search && String(search).trim()) {
    const term = String(search).trim();
    const searchFilter = [
      { bookingId: { $regex: term, $options: "i" } },
      { userName: { $regex: term, $options: "i" } },
      { userEmail: { $regex: term, $options: "i" } },
      { userPhone: { $regex: term, $options: "i" } },
      { operator: { $regex: term, $options: "i" } },
      { fromCity: { $regex: term, $options: "i" } },
      { toCity: { $regex: term, $options: "i" } },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchFilter }];
      delete filter.$or;
    } else {
      filter.$or = searchFilter;
    }
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate("userId", "name email phone")
      .populate("tripId", "operator busNumber fromCity toCity busType duration")
      .populate("paymentId", "razorpayPaymentId method status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Booking.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    count: bookings.length,
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    currentPage: pageNum,
    limit: limitNum,
    data: bookings,
  });
});

export const getAdminBookingById = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("userId", "name email phone")
    .populate("tripId", "operator busNumber fromCity toCity busType duration departureTime arrivalTime boardingPoints droppingPoints")
    .populate("paymentId")
    .lean();

  if (!booking) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }

  return res.status(200).json({ success: true, data: booking });
});

export const cancelAdminBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }

  if (booking.status === "CANCELLED") {
    return res.status(400).json({
      success: false,
      message: "This booking is already cancelled.",
    });
  }

  booking.status = "CANCELLED";
  booking.cancelledAt = new Date();
  booking.refundStatus = "INITIATED";
  booking.cancellationReason = req.body?.reason || "Cancelled by Admin";
  await booking.save();

  // Release seats on Trip if applicable
  if (booking.tripId) {
    const trip = await Trip.findById(booking.tripId);
    if (trip && trip.seats) {
      const seatsToRelease = booking.seatNumbers?.length
        ? booking.seatNumbers
        : String(booking.seats).split(",").map((s) => s.trim());

      trip.seats.forEach((seat) => {
        if (seatsToRelease.includes(seat.seatNumber)) {
          seat.isBooked = false;
          seat.isLocked = false;
          seat.lockedBy = null;
          seat.lockedAt = null;
        }
      });
      const bookedCount = trip.seats.filter((s) => s.isBooked).length;
      trip.availableSeats = Math.max(0, trip.totalSeats - bookedCount);
      await trip.save();
    }
  }

  return res.status(200).json({
    success: true,
    message: "Booking cancelled and seats released successfully.",
    data: booking,
  });
});

export const refundAdminBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, amount } = req.body;

  let booking = await Booking.findById(id);
  if (!booking) {
    booking = await Booking.findOne({ bookingId: id });
  }

  if (!booking) {
    return res.status(404).json({ success: false, message: "Booking not found." });
  }
  if (["train", "hotel"].includes(booking.bookingType)) {
    const result = await processTravelRefund({
      id,
      user: req.user,
      isAdmin: true,
      amount,
      reason: typeof reason === "string" ? reason.trim().slice(0, 500) : "",
      ipAddress: req.ip || "",
    });
    return res.status(200).json({
      success: true,
      message: result.alreadyProcessed
        ? "This booking refund has already been processed."
        : `Refund of ₹${result.refundedAmount} processed for ${result.booking.bookingId || result.booking._id}.`,
      alreadyRefunded: result.alreadyProcessed,
      refundId: result.booking.refundId,
      refundedAmount: result.refundedAmount,
      data: result.booking,
    });
  }

  // Idempotency check: if already processed, return existing refund state
  if (["INITIATED", "PROCESSED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(booking.refundStatus)) {
    return res.status(200).json({
      success: true,
      message: booking.refundStatus === "INITIATED"
        ? "A refund is already in progress."
        : "This booking refund has already been processed.",
      alreadyRefunded: booking.refundStatus !== "INITIATED",
      refundId: booking.refundId,
      refundedAmount: booking.refundedAmount,
      data: booking,
    });
  }

  // Only paid bookings can be refunded
  if (booking.paymentStatus !== "PAID" && booking.paymentStatus !== "REFUNDED") {
    return res.status(400).json({
      success: false,
      message: `Cannot refund booking with payment status '${booking.paymentStatus}'. Only PAID bookings can be refunded.`,
    });
  }

  // Determine refund amount (default to 100% full amount)
  const maxRefundable = Number(booking.totalAmount || booking.amount || 0);
  const refundAmount =
    amount !== undefined && amount !== null && amount !== ""
      ? Number(amount)
      : maxRefundable;

  if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > maxRefundable) {
    return res.status(400).json({
      success: false,
      message: "Valid refund amount greater than 0 is required.",
    });
  }

  // Find linked Payment record
  let payment = null;
  if (booking.paymentId) {
    payment = await Payment.findById(booking.paymentId);
  }
  if (!payment) {
    payment = await Payment.findOne({
      $or: [{ bookingId: booking._id }, { razorpayOrderId: booking.idempotencyKey }],
    });
  }

  let gatewayRefundId = "";
  let gatewayResponse = null;

  // 1. Gateway call OUTSIDE the DB transaction
  if (!payment) {
    return res.status(409).json({ success: false, message: "Verified payment record is missing; manual review is required." });
  }
  const claimedBooking = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      paymentStatus: { $in: ["PAID", "REFUNDED"] },
      refundStatus: { $nin: ["INITIATED", "PROCESSED", "PARTIALLY_REFUNDED", "REFUNDED"] },
    },
    { $set: { refundStatus: "INITIATED" } },
    { returnDocument: "after" }
  );
  if (!claimedBooking) {
    return res.status(409).json({ success: false, message: "A refund is already in progress or has been processed." });
  }
  booking = claimedBooking;
  try {
    gatewayResponse = await createPaymentRefund(payment, refundAmount, {
      bookingId: booking.bookingId || String(booking._id),
      reason: reason || "Admin Initiated Refund",
      adminUserId: String(req.user._id),
    });
    gatewayRefundId = gatewayResponse.id || "";
  } catch (gatewayErr) {
    if (gatewayErr.statusCode === 503) {
      await Booking.updateOne(
        { _id: booking._id, refundStatus: "INITIATED" },
        { $set: { refundStatus: "FAILED" } }
      );
    }
    console.error("Payment gateway refund failed:", gatewayErr.message);
    return res.status(gatewayErr.statusCode || 502).json({
      success: false,
      message: gatewayErr.statusCode === 503
        ? gatewayErr.message
        : "Refund status could not be confirmed. Review the gateway before attempting another refund.",
    });
  }

  // 2. Database update
  const now = new Date();
  const refundComplete = gatewayResponse.status === "processed";
  const fullRefund = refundAmount >= maxRefundable;
  booking.status = "CANCELLED";
  booking.paymentStatus = fullRefund && refundComplete ? "REFUNDED" : "PAID";
  booking.refundStatus = refundComplete
    ? (fullRefund ? "PROCESSED" : "PARTIALLY_REFUNDED")
    : "INITIATED";
  booking.refundId = gatewayRefundId;
  booking.refundedAmount = refundAmount;
  booking.refundedAt = now;
  booking.refundReason = reason || "Refund processed by Administrator";
  booking.refundedBy = req.user._id;
  booking.cancelledAt = booking.cancelledAt || now;
  booking.cancellationReason = booking.cancellationReason || `Admin refund: ${reason || "No reason specified"}`;

  await booking.save();

  // Update Payment record
  if (payment) {
    payment.status = fullRefund && refundComplete ? "REFUNDED" : "SUCCESS";
    payment.refundDetails = {
      refundId: gatewayRefundId,
      refundAmount,
      refundStatus: gatewayResponse.status || "PENDING",
      refundedAt: refundComplete ? now : null,
    };
    await payment.save();
  }

  // 3. Atomically release seats on Trip so other users can book them
  if (booking.tripId && claimedBooking.status !== "CANCELLED") {
    const seatsToRelease = booking.seatNumbers?.length
      ? booking.seatNumbers
      : String(booking.seats || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    if (seatsToRelease.length > 0) {
      await Trip.updateOne(
        { _id: booking.tripId },
        {
          $set: {
            "seats.$[elem].isBooked": false,
            "seats.$[elem].isLocked": false,
            "seats.$[elem].lockedBy": null,
            "seats.$[elem].lockedAt": null,
            "seats.$[elem].holdExpiresAt": null,
          },
          $inc: { availableSeats: seatsToRelease.length },
        },
        {
          arrayFilters: [{ "elem.seatNumber": { $in: seatsToRelease } }],
        }
      );
    }
  }

  // 4. Audit Log Entry
  try {
    await AuditLog.create({
      action: "ADMIN_REFUND_BOOKING",
      performedBy: req.user._id,
      targetType: "Booking",
      targetId: String(booking._id),
      details: {
        bookingId: booking.bookingId,
        refundId: gatewayRefundId,
        refundedAmount: refundAmount,
        originalAmount: maxRefundable,
        reason: reason || "Admin Refund",
        gatewayResponse,
      },
      ipAddress: req.ip || "",
    });
  } catch (auditErr) {
    console.warn("Failed to create audit log for refund:", auditErr.message);
  }

  return res.status(200).json({
    success: true,
    message: refundComplete
      ? `Refund of ₹${refundAmount} processed for booking ${booking.bookingId || booking._id}.`
      : `Refund of ₹${refundAmount} was initiated for booking ${booking.bookingId || booking._id}.`,
    refundId: gatewayRefundId,
    refundedAmount: refundAmount,
    data: booking,
  });
});

export const deleteAdminBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findByIdAndDelete(req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
  return res.status(200).json({ success: true, message: "Booking deleted successfully." });
});

// ==================== 4. TICKETS ====================
export const getAdminTickets = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const matchFilter = {};
  if (status && status !== "all") {
    matchFilter.status = status.toUpperCase();
  }

  if (search && String(search).trim()) {
    const term = String(search).trim();
    matchFilter.$or = [
      { bookingId: { $regex: term, $options: "i" } },
      { "passengers.name": { $regex: term, $options: "i" } },
      { userPhone: { $regex: term, $options: "i" } },
      { operator: { $regex: term, $options: "i" } },
    ];
  }

  // Aggregate bookings unwinding passengers to produce atomic ticket items
  const pipeline = [
    { $match: matchFilter },
    { $unwind: { path: "$passengers", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        ticketId: {
          $concat: [
            { $ifNull: ["$bookingId", "TKT"] },
            "-",
            { $ifNull: ["$passengers.seatNumber", "01"] },
          ],
        },
        pnr: "$bookingId",
        bookingId: "$_id",
        passengerName: { $ifNull: ["$passengers.name", "$userName"] },
        age: { $ifNull: ["$passengers.age", 25] },
        gender: { $ifNull: ["$passengers.gender", "Male"] },
        seatNumber: { $ifNull: ["$passengers.seatNumber", "$seats"] },
        bus: "$operator",
        busNumber: "$busNumber",
        fromCity: "$fromCity",
        toCity: "$toCity",
        journeyDate: "$date",
        time: "$time",
        amount: "$amount",
        status: "$status",
        userPhone: "$userPhone",
        boardingPoint: "$boardingPoint",
        droppingPoint: "$droppingPoint",
        createdAt: "$createdAt",
      },
    },
    { $sort: { createdAt: -1 } },
  ];

  const [countResult, tickets] = await Promise.all([
    Booking.aggregate([...pipeline, { $count: "total" }]),
    Booking.aggregate([...pipeline, { $skip: skip }, { $limit: limitNum }]),
  ]);

  const total = countResult[0]?.total || 0;

  return res.status(200).json({
    success: true,
    count: tickets.length,
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    currentPage: pageNum,
    limit: limitNum,
    data: tickets,
  });
});

export const getAdminTicketById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const booking = await Booking.findById(id).lean();
  if (!booking) {
    return res.status(404).json({ success: false, message: "Ticket / Booking not found." });
  }

  return res.status(200).json({ success: true, data: booking });
});

// ==================== 5. BUSES AND TRIPS ====================
// --- Buses CRUD ---
export const getAdminBuses = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  if (search && String(search).trim()) {
    const term = String(search).trim();
    filter.$or = [
      { operator: { $regex: term, $options: "i" } },
      { busNumber: { $regex: term, $options: "i" } },
      { from: { $regex: term, $options: "i" } },
      { to: { $regex: term, $options: "i" } },
      { busType: { $regex: term, $options: "i" } },
    ];
  }

  const [buses, total] = await Promise.all([
    Bus.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    Bus.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    count: buses.length,
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    currentPage: pageNum,
    limit: limitNum,
    data: buses,
  });
});

export const getAdminBusById = asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (!bus) return res.status(404).json({ success: false, message: "Bus not found." });
  return res.status(200).json({ success: true, data: bus });
});

export const createAdminBus = asyncHandler(async (req, res) => {
  const parseResult = createBusSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      message: parseResult.error.issues[0]?.message || "Invalid bus details.",
    });
  }

  const data = parseResult.data;
  const busNumber = (data.busNumber || `BUS-${Math.random().toString(36).substring(2, 6)}`).toUpperCase();

  const bus = await Bus.create({
    operator: data.operator,
    busNumber,
    from: data.from,
    to: data.to,
    busType: data.busType || data.type || "AC Sleeper",
    type: data.busType || data.type || "AC Sleeper",
    totalSeats: data.totalSeats,
    fare: data.fare,
    price: data.fare,
    journeyDate: data.journeyDate || getTodayInAppTZ(),
    validFrom: data.validFrom || data.journeyDate || getTodayInAppTZ(),
    validTo: data.validTo || "",
    runningDays: data.runningDays || [0, 1, 2, 3, 4, 5, 6],
    active: data.active ?? true,
    isGovernment: data.isGovernment ?? false,
    departureTime: data.departureTime || "22:00",
    arrivalTime: data.arrivalTime || "06:00",
    rating: data.rating || "4.5",
    amenities: data.amenities || ["Charging Point", "Water Bottle", "Blanket", "Live Tracking"],
  });

  return res.status(201).json({
    success: true,
    message: "Bus created successfully.",
    data: bus,
  });
});

export const updateAdminBus = asyncHandler(async (req, res) => {
  const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after" });
  if (!bus) return res.status(404).json({ success: false, message: "Bus not found." });
  return res.status(200).json({ success: true, message: "Bus updated successfully.", data: bus });
});

export const deleteAdminBus = asyncHandler(async (req, res) => {
  const bus = await Bus.findByIdAndDelete(req.params.id);
  if (!bus) return res.status(404).json({ success: false, message: "Bus not found." });
  return res.status(200).json({ success: true, message: "Bus deleted successfully." });
});

// --- Trips CRUD ---
export const getAdminTrips = asyncHandler(async (req, res) => {
  const { search, date, operator, page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  if (date) filter.journeyDate = date;
  if (operator) filter.operator = { $regex: operator, $options: "i" };

  if (search && String(search).trim()) {
    const term = String(search).trim();
    filter.$or = [
      { fromCity: { $regex: term, $options: "i" } },
      { toCity: { $regex: term, $options: "i" } },
      { operator: { $regex: term, $options: "i" } },
      { busNumber: { $regex: term, $options: "i" } },
    ];
  }

  const [trips, total] = await Promise.all([
    Trip.find(filter)
      .sort({ journeyDate: 1, departureTime: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Trip.countDocuments(filter),
  ]);

  const bookingCounts = trips.length
    ? await Booking.aggregate([
        { $match: { tripId: { $in: trips.map((trip) => trip._id) } } },
        { $group: { _id: "$tripId", count: { $sum: 1 } } },
      ])
    : [];
  const bookingCountByTrip = new Map(bookingCounts.map((item) => [String(item._id), item.count]));
  const tripsWithBookingCounts = trips.map((trip) => ({
    ...trip,
    travelDate: trip.travelDate || trip.journeyDate,
    bookingCount: bookingCountByTrip.get(String(trip._id)) || 0,
  }));

  return res.status(200).json({
    success: true,
    count: trips.length,
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    currentPage: pageNum,
    limit: limitNum,
    data: tripsWithBookingCounts,
  });
});

export const getAdminTripById = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: "Trip not found." });
  return res.status(200).json({ success: true, data: trip });
});

export const createAdminTrip = asyncHandler(async (req, res) => {
  const parseResult = createTripSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      message: parseResult.error.issues[0]?.message || "Invalid trip details.",
    });
  }

  const data = parseResult.data;
  const numSeats = data.totalSeats;
  const numFare = data.fare;
  const layout = generateDefaultSeatLayout(numSeats, numFare, data.busType);

  const trip = await Trip.create({
    operator: data.operator,
    busNumber: (data.busNumber || `GJ-${Math.random().toString(36).substring(2, 6)}`).toUpperCase(),
    fromCity: data.fromCity,
    toCity: data.toCity,
    journeyDate: data.journeyDate,
    travelDate: data.journeyDate,
    departureAt: combineDateAndTime(data.journeyDate, data.departureTime),
    status: "scheduled",
    departureTime: data.departureTime,
    arrivalTime: data.arrivalTime,
    busType: data.busType,
    fare: numFare,
    price: numFare,
    totalSeats: numSeats,
    availableSeats: numSeats,
    duration: data.duration || "8h 30m",
    rating: data.rating || "4.5",
    amenities: data.amenities || ["Water Bottle", "Blanket", "Charging Point", "Reading Light", "Live Tracking"],
    seats: layout,
    boardingPoints: [{ name: `${data.fromCity} Main Stand`, time: data.departureTime }],
    droppingPoints: [{ name: `${data.toCity} Central Stop`, time: data.arrivalTime }],
    active: true,
  });

  return res.status(201).json({
    success: true,
    message: "Trip schedule created successfully.",
    data: trip,
  });
});

export const updateAdminTrip = asyncHandler(async (req, res) => {
  const update = { ...req.body };
  if (update.journeyDate) {
    update.travelDate = update.journeyDate;
    update.departureAt = combineDateAndTime(update.journeyDate, update.departureTime || "21:00");
  }
  const trip = await Trip.findByIdAndUpdate(req.params.id, update, { returnDocument: "after", runValidators: true });
  if (!trip) return res.status(404).json({ success: false, message: "Trip not found." });
  return res.status(200).json({ success: true, message: "Trip updated successfully.", data: trip });
});

export const deleteAdminTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findByIdAndDelete(req.params.id);
  if (!trip) return res.status(404).json({ success: false, message: "Trip not found." });
  return res.status(200).json({ success: true, message: "Trip deleted successfully." });
});

export const cancelAdminTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) return res.status(404).json({ success: false, code: "TRIP_NOT_FOUND", message: "Trip not found." });
  if (trip.status !== "cancelled") {
    trip.status = "cancelled";
    trip.active = false;
    await trip.save();
  }

  const bookings = await Booking.find({
    tripId: trip._id,
    status: { $in: ["CONFIRMED", "PENDING"] },
  });
  let refunded = 0;
  let manualRefunds = 0;
  for (const booking of bookings) {
    let refund = null;
    let payment = booking.paymentId ? await Payment.findById(booking.paymentId) : null;
    if (!payment) payment = await Payment.findOne({ bookingId: booking._id });

    if (booking.paymentStatus === "PAID" && payment?.method === "razorpay" && payment.razorpayPaymentId) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (keyId && keySecret) {
        try {
          const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
          refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
            amount: Math.round(Number(booking.totalAmount || booking.amount || 0) * 100),
            notes: { bookingId: booking.bookingId || String(booking._id), reason: "Trip cancelled by administrator", tripId: String(trip._id) },
          });
        } catch (gatewayError) {
          console.error("Razorpay trip-cancellation refund failed:", gatewayError.message);
        }
      }
    }

    const now = new Date();
    booking.status = "CANCELLED";
    booking.cancelledAt = now;
    booking.cancellationReason = `Trip cancelled by administrator on ${trip.travelDate || trip.journeyDate}.`;
    if (booking.paymentStatus === "PAID") {
      if (refund) {
        booking.paymentStatus = "REFUNDED";
        booking.refundStatus = "PROCESSED";
        booking.refundId = refund.id || "";
        booking.refundedAmount = Number(booking.totalAmount || booking.amount || 0);
        booking.refundedAt = now;
        booking.refundReason = "Trip cancelled by administrator";
        if (payment) {
          payment.status = "REFUNDED";
          payment.refundDetails = {
            refundId: refund.id || "",
            refundAmount: booking.refundedAmount,
            refundStatus: "SUCCESS",
            refundedAt: now,
          };
          await payment.save();
        }
        refunded += 1;
      } else {
        booking.refundStatus = "MANUAL_REQUIRED";
        booking.refundReason = "Trip cancelled; gateway refund requires manual review.";
        manualRefunds += 1;
      }
    } else {
      booking.refundStatus = "NOT_APPLICABLE";
    }
    await booking.save();
  }

  trip.seats = (trip.seats || []).map((seat) => ({
    ...seat.toObject?.() || seat,
    isBooked: false,
    isLocked: false,
    lockedBy: null,
    lockedAt: null,
    holdExpiresAt: null,
  }));
  trip.availableSeats = trip.totalSeats;
  await trip.save();

  return res.status(200).json({
    success: true,
    message: `Trip on ${trip.travelDate || trip.journeyDate} cancelled. ${refunded} refunds processed; ${manualRefunds} require manual review.`,
    date: trip.travelDate || trip.journeyDate,
    refunded,
    manualRefunds,
  });
});

export const getAdminTripSeatMap = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id).select("operator busNumber fromCity toCity journeyDate totalSeats availableSeats seats").lean();
  if (!trip) return res.status(404).json({ success: false, message: "Trip not found." });

  const bookedCount = (trip.seats || []).filter((s) => s.isBooked).length;
  const lockedCount = (trip.seats || []).filter((s) => s.isLocked && !s.isBooked).length;
  const availableCount = Math.max(0, trip.totalSeats - bookedCount);

  return res.status(200).json({
    success: true,
    data: {
      tripId: trip._id,
      operator: trip.operator,
      busNumber: trip.busNumber,
      fromCity: trip.fromCity,
      toCity: trip.toCity,
      journeyDate: trip.journeyDate,
      totalSeats: trip.totalSeats,
      availableSeats: availableCount,
      bookedSeatsCount: bookedCount,
      lockedSeatsCount: lockedCount,
      seats: trip.seats || [],
    },
  });
});

// ==================== 6. PAYMENTS ====================
export const getAdminPayments = asyncHandler(async (req, res) => {
  const { status, startDate, endDate, search, page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const filter = {};
  if (status && status !== "all") {
    filter.status = status.toUpperCase();
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (search && String(search).trim()) {
    const term = String(search).trim();
    filter.$or = [
      { razorpayOrderId: { $regex: term, $options: "i" } },
      { razorpayPaymentId: { $regex: term, $options: "i" } },
      { method: { $regex: term, $options: "i" } },
    ];
  }

  const [payments, total, collectedAgg] = await Promise.all([
    Payment.find(filter)
      .populate("user", "name email phone")
      .populate("bookingId", "bookingId title fromCity toCity date")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Payment.countDocuments(filter),
    Payment.aggregate([
      { $match: { status: "SUCCESS" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const totalCollected = collectedAgg[0]?.total || 0;

  return res.status(200).json({
    success: true,
    count: payments.length,
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    currentPage: pageNum,
    limit: limitNum,
    totalCollected,
    data: payments,
  });
});

export const getAdminPaymentById = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate("user", "name email phone")
    .populate("bookingId")
    .lean();
  if (!payment) return res.status(404).json({ success: false, message: "Payment not found." });
  return res.status(200).json({ success: true, data: payment });
});

// ==================== 7. SETTINGS & PROFILE ====================
export const getAdminProfile = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone || req.user.mobile,
      role: req.user.role,
      createdAt: req.user.createdAt,
    },
  });
});

export const changeAdminPassword = asyncHandler(async (req, res) => {
  const parseResult = changePasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      message: parseResult.error.issues[0]?.message || "Invalid input.",
    });
  }

  const { currentPassword, newPassword } = parseResult.data;
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found." });
  }

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return res.status(400).json({
      success: false,
      message: "Current password does not match.",
    });
  }

  user.password = newPassword;
  await user.save();

  return res.status(200).json({
    success: true,
    message: "Admin password updated successfully.",
  });
});

// ==================== CITIES, ROUTES, OPERATORS, PROMOTIONS ====================
export const getAdminCities = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { state: { $regex: search, $options: "i" } },
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [cities, count] = await Promise.all([
    City.find(filter).sort({ name: 1 }).skip(skip).limit(Number(limit)),
    City.countDocuments(filter),
  ]);
  return res.status(200).json({ success: true, count, data: cities });
});

export const createAdminCity = asyncHandler(async (req, res) => {
  const { name, state, code, isPopular, aliases } = req.body;
  if (!name || !state) {
    return res.status(400).json({ success: false, message: "City name and State are required." });
  }
  const city = await City.create({
    name: name.trim(),
    state: state.trim(),
    code: (code || "").trim().toUpperCase(),
    isPopular: Boolean(isPopular),
    aliases: Array.isArray(aliases) ? aliases : [],
  });
  return res.status(201).json({ success: true, message: "City added successfully", data: city });
});

export const updateAdminCity = asyncHandler(async (req, res) => {
  const city = await City.findById(req.params.id);
  if (!city) return res.status(404).json({ success: false, message: "City not found" });
  Object.assign(city, req.body);
  await city.save();
  return res.status(200).json({ success: true, message: "City updated successfully", data: city });
});

export const deleteAdminCity = asyncHandler(async (req, res) => {
  const city = await City.findByIdAndDelete(req.params.id);
  if (!city) return res.status(404).json({ success: false, message: "City not found" });
  return res.status(200).json({ success: true, message: "City deleted successfully" });
});

export const getAdminRoutes = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = {};
  if (search) {
    filter.$or = [
      { fromCity: { $regex: search, $options: "i" } },
      { toCity: { $regex: search, $options: "i" } },
    ];
  }
  const routes = await Route.find(filter).sort({ fromCity: 1, toCity: 1 });
  return res.status(200).json({ success: true, count: routes.length, data: routes });
});

export const createAdminRoute = asyncHandler(async (req, res) => {
  const { fromCity, toCity, distanceKm, estimatedDuration } = req.body;
  if (!fromCity || !toCity) {
    return res.status(400).json({ success: false, message: "Source and Destination cities are required." });
  }
  const route = await Route.create({
    fromCity: fromCity.trim(),
    toCity: toCity.trim(),
    distanceKm: Number(distanceKm || 250),
    estimatedDuration: estimatedDuration || "5h 30m",
    boardingPoints: [{ name: `${fromCity} Main Stand`, timeOffsetMinutes: 0 }],
    droppingPoints: [{ name: `${toCity} Central Stop`, timeOffsetMinutes: 0 }],
  });
  return res.status(201).json({ success: true, message: "Route created successfully", data: route });
});

export const updateAdminRoute = asyncHandler(async (req, res) => {
  const route = await Route.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after" });
  if (!route) return res.status(404).json({ success: false, message: "Route not found" });
  return res.status(200).json({ success: true, message: "Route updated successfully", data: route });
});

export const deleteAdminRoute = asyncHandler(async (req, res) => {
  const route = await Route.findByIdAndDelete(req.params.id);
  if (!route) return res.status(404).json({ success: false, message: "Route not found" });
  return res.status(200).json({ success: true, message: "Route deleted successfully" });
});

export const getAdminTrains = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));
  const filter = {};
  if (typeof search === "string" && search.trim()) {
    const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { operator: { $regex: term, $options: "i" } },
      { trainNumber: { $regex: term, $options: "i" } },
      { from: { $regex: term, $options: "i" } },
      { to: { $regex: term, $options: "i" } },
    ];
  }
  const [trains, total] = await Promise.all([
    Train.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    Train.countDocuments(filter),
  ]);
  const schedules = trains.length
    ? await TrainSchedule.find({ trainId: { $in: trains.map((train) => train._id) }, active: true })
      .sort({ createdAt: -1 }).lean()
    : [];
  const scheduleByTrain = new Map();
  for (const schedule of schedules) {
    if (!scheduleByTrain.has(String(schedule.trainId))) scheduleByTrain.set(String(schedule.trainId), schedule);
  }
  const stationIds = schedules.flatMap((schedule) => schedule.stops.map((stop) => stop.stationId));
  const linkedStationIds = new Set(
    (stationIds.length ? await Station.find({ _id: { $in: stationIds }, active: true }).select("_id").lean() : [])
      .map((station) => String(station._id))
  );
  const data = trains.map((train) => {
    const schedule = scheduleByTrain.get(String(train._id));
    let reason = "";
    if (train.active === false) reason = "Train is inactive.";
    else if (!schedule) reason = "No active train schedule.";
    else if ((schedule.stops || []).length < 2) reason = "Schedule needs at least two ordered stations.";
    else if (schedule.stops.some((stop) => !linkedStationIds.has(String(stop.stationId)))) reason = "A schedule station is missing or inactive.";
    else if (!(schedule.runningDays || []).length) reason = "No running days are configured.";
    else if (!(schedule.classes || []).some((trainClass) => trainClass.fare > 0 && trainClass.seatCount > 0)) reason = "No class has a valid fare and seat inventory.";
    else if (schedule.validFrom && schedule.validFrom > getTodayInAppTZ()) reason = `Schedule starts on ${schedule.validFrom}.`;
    else if (schedule.validTo && schedule.validTo < getTodayInAppTZ()) reason = "Schedule validity has ended.";
    return {
      ...train,
      schedule: schedule ? {
        runningDays: schedule.runningDays,
        validFrom: schedule.validFrom,
        validTo: schedule.validTo,
        stops: schedule.stops,
        classes: schedule.classes,
      } : null,
      searchVisibility: { visible: !reason, reason: reason || "Published and searchable." },
    };
  });
  return res.status(200).json({
    success: true,
    count: data.length,
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    currentPage: pageNum,
    limit: limitNum,
    data,
  });
});

async function saveAdminTrain(id, input) {
  const from = await resolveAdminStation(input.from, "From");
  const to = await resolveAdminStation(input.to, "To");
  if (from.station._id.equals(to.station._id) || from.city._id.equals(to.city._id)) {
    throw makeAdminValidationError("to", "Departure and destination must be different stations in different cities.");
  }

  const session = await mongoose.startSession();
  let savedTrain;
  try {
    await session.withTransaction(async () => {
      const train = id ? await Train.findById(id).session(session) : new Train();
      if (!train) throw makeAdminValidationError("id", "Train not found.", 404);
      train.set({
        operator: input.operator,
        trainName: input.operator,
        trainNumber: input.trainNumber,
        from: from.station.code,
        to: to.station.code,
        type: input.type,
        price: input.price,
        rating: input.rating,
        departure: input.departure,
        arrival: input.arrival,
        duration: input.duration || "",
        seatsLeft: input.seatsLeft,
        active: input.active,
        isDemo: input.isDemo,
      });
      await train.save({ session });

      await TrainSchedule.updateMany(
        { trainId: train._id, active: true },
        { $set: { active: false } },
        { session }
      );
      if (input.active) {
        const [schedule] = await TrainSchedule.create([{
          trainId: train._id,
          trainNumber: input.trainNumber,
          trainName: input.operator,
          stops: [
            {
              stationId: from.station._id,
              stationCode: from.station.code,
              stationName: from.station.name,
              city: from.city.name,
              departureTime: input.departure,
              arrivalTime: "",
              dayOffset: 0,
            },
            {
              stationId: to.station._id,
              stationCode: to.station.code,
              stationName: to.station.name,
              city: to.city.name,
              departureTime: "",
              arrivalTime: input.arrival,
              dayOffset: input.arrival <= input.departure ? 1 : 0,
            },
          ],
          runningDays: [...new Set(input.runningDays)].sort(),
          validFrom: input.validFrom,
          validTo: input.validTo,
          classes: [{
            code: input.classCode.toUpperCase(),
            name: input.type,
            fare: input.price,
            seatCount: input.seatsLeft,
          }],
          active: true,
          isDemo: input.isDemo,
        }], { session });
        savedTrain = {
          ...train.toObject(),
          searchVisibility: { visible: true, reason: "Published and searchable." },
          scheduleId: schedule._id,
        };
      } else {
        savedTrain = {
          ...train.toObject(),
          searchVisibility: { visible: false, reason: "Train is inactive." },
        };
      }
    });
  } finally {
    await session.endSession();
  }
  return savedTrain;
}

export const createAdminTrain = asyncHandler(async (req, res) => {
  const parsed = adminTrainSchema.safeParse(req.body || {});
  if (!parsed.success) return sendAdminValidationError(res, parsed.error.issues);
  const train = await saveAdminTrain(null, parsed.data);
  return res.status(201).json({ success: true, message: "Train created successfully", data: train });
});

export const updateAdminTrain = asyncHandler(async (req, res) => {
  const parsed = adminTrainSchema.safeParse(req.body || {});
  if (!parsed.success) return sendAdminValidationError(res, parsed.error.issues);
  const train = await saveAdminTrain(req.params.id, parsed.data);
  return res.status(200).json({ success: true, message: "Train updated successfully", data: train });
});

export const deleteAdminTrain = asyncHandler(async (req, res) => {
  const train = await Train.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { returnDocument: "after" });
  if (!train) return res.status(404).json({ success: false, message: "Train not found" });
  await TrainSchedule.updateMany({ trainId: train._id, active: true }, { $set: { active: false } });
  return res.status(200).json({ success: true, message: "Train deactivated successfully", data: train });
});

export const getAdminHotels = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));
  const filter = {};
  if (typeof search === "string" && search.trim()) {
    const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { city: { $regex: term, $options: "i" } },
      { type: { $regex: term, $options: "i" } },
    ];
  }
  const [hotels, total] = await Promise.all([
    Hotel.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    Hotel.countDocuments(filter),
  ]);
  const roomTypes = hotels.length
    ? await RoomType.find({ hotelId: { $in: hotels.map((hotel) => hotel._id) } }).sort({ createdAt: 1 }).lean()
    : [];
  const roomsByHotel = new Map();
  for (const roomType of roomTypes) {
    const key = String(roomType.hotelId);
    roomsByHotel.set(key, [...(roomsByHotel.get(key) || []), roomType]);
  }
  const data = hotels.map((hotel) => {
    const hotelRooms = roomsByHotel.get(String(hotel._id)) || [];
    const availableRoomType = hotelRooms.find((room) =>
      room.active && room.maxGuests >= 1 && room.pricePerNight > 0 && room.totalRooms > 0
    );
    const reason = hotel.active === false
      ? "Hotel is inactive."
      : !availableRoomType
        ? hotelRooms.length ? "No active room type has capacity, price, and rooms configured." : "No room types are configured."
        : "";
    return {
      ...hotel,
      roomTypes: hotelRooms,
      searchVisibility: { visible: !reason, reason: reason || "Published and searchable." },
    };
  });
  return res.status(200).json({
    success: true,
    count: data.length,
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
    currentPage: pageNum,
    limit: limitNum,
    data,
  });
});

async function saveAdminHotel(id, input) {
  const city = await resolveAdminCity(input.city);
  const session = await mongoose.startSession();
  let savedHotel;
  try {
    await session.withTransaction(async () => {
      const hotel = id ? await Hotel.findById(id).session(session) : new Hotel();
      if (!hotel) throw makeAdminValidationError("id", "Hotel not found.", 404);
      hotel.set({
        name: input.name,
        city: city.name,
        cityId: city._id,
        citySlug: city.slug,
        address: input.address,
        type: input.type,
        price: input.price,
        rating: input.rating,
        isAc: input.isAc,
        active: input.active,
        isDemo: input.isDemo,
        ...(input.starRating === undefined ? {} : { starRating: input.starRating }),
        ...(input.amenities === undefined ? {} : { amenities: input.amenities }),
        ...(input.cancellationPolicy === undefined ? {} : { cancellationPolicy: input.cancellationPolicy }),
      });
      await hotel.save({ session });

      let roomType;
      if (input.roomType.id) {
        roomType = await RoomType.findOne({ _id: input.roomType.id, hotelId: hotel._id }).session(session);
        if (!roomType) throw makeAdminValidationError("roomType.id", "Room type does not belong to this hotel.");
      } else {
        roomType = await RoomType.findOne({ hotelId: hotel._id }).sort({ createdAt: 1 }).session(session);
      }
      if (roomType) {
        const overbooked = await RoomInventory.exists({
          roomTypeId: roomType._id,
          bookedRooms: { $gt: input.roomType.totalRooms },
        }).session(session);
        if (overbooked) {
          throw makeAdminValidationError("roomType.totalRooms", "Room count cannot be below rooms already booked.", 409);
        }
        roomType.set({
          name: input.roomType.name,
          description: input.roomType.description,
          maxGuests: input.roomType.maxGuests,
          totalRooms: input.roomType.totalRooms,
          pricePerNight: input.roomType.pricePerNight,
          active: true,
        });
        await roomType.save({ session });
        await RoomInventory.updateMany(
          { roomTypeId: roomType._id },
          { $set: { totalRooms: input.roomType.totalRooms } },
          { session }
        );
      } else {
        [roomType] = await RoomType.create([{
          hotelId: hotel._id,
          ...input.roomType,
          active: true,
          isDemo: input.isDemo,
        }], { session });
      }
      savedHotel = {
        ...hotel.toObject(),
        roomTypes: [roomType.toObject()],
        searchVisibility: input.active
          ? { visible: true, reason: "Published and searchable." }
          : { visible: false, reason: "Hotel is inactive." },
      };
    });
  } finally {
    await session.endSession();
  }
  return savedHotel;
}

export const createAdminHotel = asyncHandler(async (req, res) => {
  const parsed = adminHotelSchema.safeParse(req.body || {});
  if (!parsed.success) return sendAdminValidationError(res, parsed.error.issues);
  const hotel = await saveAdminHotel(null, parsed.data);
  return res.status(201).json({ success: true, message: "Hotel created successfully", data: hotel });
});

export const updateAdminHotel = asyncHandler(async (req, res) => {
  const parsed = adminHotelSchema.safeParse(req.body || {});
  if (!parsed.success) return sendAdminValidationError(res, parsed.error.issues);
  const hotel = await saveAdminHotel(req.params.id, parsed.data);
  return res.status(200).json({ success: true, message: "Hotel updated successfully", data: hotel });
});

export const deleteAdminHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { returnDocument: "after" });
  if (!hotel) return res.status(404).json({ success: false, message: "Hotel not found" });
  await RoomType.updateMany({ hotelId: hotel._id, active: true }, { $set: { active: false } });
  return res.status(200).json({ success: true, message: "Hotel deactivated successfully", data: hotel });
});

export const getAdminOperators = asyncHandler(async (req, res) => {
  const operators = await Operator.find().sort({ createdAt: -1 });
  return res.status(200).json({ success: true, count: operators.length, data: operators });
});

export const createAdminOperator = asyncHandler(async (req, res) => {
  const operator = await Operator.create(req.body);
  return res.status(201).json({ success: true, message: "Operator created successfully", data: operator });
});

export const updateAdminOperator = asyncHandler(async (req, res) => {
  const operator = await Operator.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after" });
  if (!operator) return res.status(404).json({ success: false, message: "Operator not found" });
  return res.status(200).json({ success: true, message: "Operator updated successfully", data: operator });
});

export const deleteAdminOperator = asyncHandler(async (req, res) => {
  const operator = await Operator.findByIdAndDelete(req.params.id);
  if (!operator) return res.status(404).json({ success: false, message: "Operator not found" });
  return res.status(200).json({ success: true, message: "Operator deleted successfully" });
});

export const getAdminPromotions = asyncHandler(async (req, res) => {
  const promotions = await Promotion.find().sort({ createdAt: -1 });
  return res.status(200).json({ success: true, count: promotions.length, data: promotions });
});

export const createAdminPromotion = asyncHandler(async (req, res) => {
  const promo = await Promotion.create(req.body);
  return res.status(201).json({ success: true, message: "Promotion created successfully", data: promo });
});

export const updateAdminPromotion = asyncHandler(async (req, res) => {
  const promo = await Promotion.findByIdAndUpdate(req.params.id, req.body, { returnDocument: "after" });
  if (!promo) return res.status(404).json({ success: false, message: "Promotion not found" });
  return res.status(200).json({ success: true, message: "Promotion updated successfully", data: promo });
});

export const deleteAdminPromotion = asyncHandler(async (req, res) => {
  const promo = await Promotion.findByIdAndDelete(req.params.id);
  if (!promo) return res.status(404).json({ success: false, message: "Promotion not found" });
  return res.status(200).json({ success: true, message: "Promotion deleted successfully" });
});

export default {
  getAdminStats,
  getAdminUsers,
  getAdminUserById,
  updateAdminUserBlock,
  updateAdminUserRole,
  deleteAdminUser,
  getAdminBookings,
  getAdminBookingById,
  cancelAdminBooking,
  deleteAdminBooking,
  getAdminTickets,
  getAdminTicketById,
  getAdminBuses,
  getAdminBusById,
  createAdminBus,
  updateAdminBus,
  deleteAdminBus,
  getAdminTrips,
  getAdminTripById,
  createAdminTrip,
  updateAdminTrip,
  deleteAdminTrip,
  getAdminTripSeatMap,
  getAdminPayments,
  getAdminPaymentById,
  getAdminProfile,
  changeAdminPassword,
  getAdminCities,
  createAdminCity,
  updateAdminCity,
  deleteAdminCity,
  getAdminRoutes,
  createAdminRoute,
  updateAdminRoute,
  deleteAdminRoute,
  getAdminTrains,
  createAdminTrain,
  updateAdminTrain,
  deleteAdminTrain,
  getAdminHotels,
  createAdminHotel,
  updateAdminHotel,
  deleteAdminHotel,
  getAdminOperators,
  createAdminOperator,
  updateAdminOperator,
  deleteAdminOperator,
  getAdminPromotions,
  createAdminPromotion,
  updateAdminPromotion,
  deleteAdminPromotion,
};
