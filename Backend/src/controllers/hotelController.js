import { z } from "zod";
import mongoose from "mongoose";
import City from "../models/City.js";
import BookingHold from "../models/BookingHold.js";
import Hotel from "../models/Hotel.js";
import RoomInventory from "../models/RoomInventory.js";
import RoomType from "../models/RoomType.js";
import { HOLD_DURATION_MINUTES, MAX_HOTEL_ROOMS, MAX_HOTEL_STAY_NIGHTS } from "../config/travelBooking.js";
import asyncHandler from "../utils/asyncHandler.js";
import { resolveCityInput } from "../utils/locationSearch.js";
import {
  calculateHotelFare,
  getIdempotencyKey,
  getNights,
  makeBookingError,
  requestHash,
  withBookingTransaction,
} from "../utils/travelBooking.js";
import { addDaysToAppDate, getTodayInAppTZ } from "../utils/timeZone.js";

function addFieldIssue(ctx, field, message) {
  ctx.addIssue({ code: "custom", path: [field], message });
}

export const hotelSearchSchema = z.object({
  city: z.string({ error: "City is required." }).trim().min(1, "City is required.").max(80, "City must be at most 80 characters."),
  checkIn: z.string({ error: "Check-in date must use YYYY-MM-DD." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Check-in date must use YYYY-MM-DD.")
    .optional(),
  checkOut: z.string({ error: "Check-out date must use YYYY-MM-DD." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Check-out date must use YYYY-MM-DD.")
    .optional(),
  guests: z.coerce.number({ error: "Guests must be a positive integer." })
    .int("Guests must be a positive integer.")
    .min(1, "Guests must be a positive integer.")
    .max(30, "Guests cannot exceed 30.")
    .default(2),
  rooms: z.coerce.number({ error: "Rooms must be a positive integer." })
    .int("Rooms must be a positive integer.")
    .min(1, "Rooms must be a positive integer.")
    .max(MAX_HOTEL_ROOMS, `Rooms cannot exceed ${MAX_HOTEL_ROOMS}.`)
    .default(1),
  page: z.coerce.number().int("Page must be a positive integer.").positive("Page must be a positive integer.").default(1),
  limit: z.coerce.number().int("Limit must be between 1 and 50.").min(1, "Limit must be between 1 and 50.").max(50, "Limit must be between 1 and 50.").default(10),
}).superRefine((data, ctx) => {
  const checkIn = data.checkIn || getTodayInAppTZ();
  const validCheckIn = Boolean(addDaysToAppDate(checkIn, 0));
  if (!validCheckIn) {
    addFieldIssue(ctx, "checkIn", "Check-in date is not a valid calendar date.");
    return;
  }
  if (checkIn < getTodayInAppTZ()) {
    addFieldIssue(ctx, "checkIn", "Check-in must be today or later.");
  }

  const checkOut = data.checkOut || addDaysToAppDate(checkIn, 1);
  if (!checkOut || !addDaysToAppDate(checkOut, 0)) {
    addFieldIssue(ctx, "checkOut", "Check-out date is not a valid calendar date.");
    return;
  }
  if (checkOut <= checkIn) {
    addFieldIssue(ctx, "checkOut", "Check-out must be after check-in.");
    return;
  }

  let nights = 0;
  let current = checkIn;
  while (current < checkOut && nights <= MAX_HOTEL_STAY_NIGHTS) {
    current = addDaysToAppDate(current, 1);
    nights += 1;
  }
  if (current !== checkOut || nights > MAX_HOTEL_STAY_NIGHTS) {
    addFieldIssue(ctx, "checkOut", `Stay cannot exceed ${MAX_HOTEL_STAY_NIGHTS} nights.`);
  }
}).transform((data) => {
  const checkIn = data.checkIn || getTodayInAppTZ();
  return {
    ...data,
    checkIn,
    checkOut: data.checkOut || addDaysToAppDate(checkIn, 1),
  };
});

export const holdSchema = z.object({
  roomTypeId: z.string().refine(mongoose.isValidObjectId, "Invalid room type."),
  checkIn: z.string().min(10).max(10),
  checkOut: z.string().min(10).max(10),
  guests: z.coerce.number().int().min(1).max(30),
  rooms: z.coerce.number().int().min(1).max(MAX_HOTEL_ROOMS),
});

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function getRoomAvailability(roomTypes, dates) {
  if (!roomTypes.length) return new Map();
  const inventory = await RoomInventory.find({
    roomTypeId: { $in: roomTypes.map((room) => room._id) },
    date: { $in: dates },
  }).lean();
  const inventoryMap = new Map(inventory.map((item) => [`${item.roomTypeId}:${item.date}`, item]));
  return new Map(roomTypes.map((room) => {
    const nights = dates.map((date) => {
      const entry = inventoryMap.get(`${room._id}:${date}`);
      const totalRooms = entry?.totalRooms ?? room.totalRooms;
      const bookedRooms = entry?.bookedRooms ?? 0;
      return { date, totalRooms, bookedRooms, availableRooms: Math.max(0, totalRooms - bookedRooms) };
    });
    return [String(room._id), nights];
  }));
}

async function findExistingHold(userId, key, hash) {
  const existing = await BookingHold.findOne({ userId, idempotencyKey: key }).lean();
  if (!existing) return null;
  if (existing.requestHash !== hash) {
    throw makeBookingError("This Idempotency-Key was already used for a different request.", 409, "IDEMPOTENCY_CONFLICT");
  }
  if (existing.status !== "HELD" || existing.expiresAt <= new Date()) {
    throw makeBookingError("This hold has expired or is no longer active. Start a new booking.", 409, "HOLD_EXPIRED");
  }
  return existing;
}

function holdResponse(hold) {
  return {
    success: true,
    data: {
      holdId: hold._id,
      bookingType: hold.bookingType,
      expiresAt: hold.expiresAt,
      baseFare: hold.baseFare,
      tax: hold.tax,
      charges: hold.charges,
      totalAmount: hold.totalAmount,
      snapshot: hold.snapshot,
    },
  };
}

async function getHotelResults(filters, id = null) {
  const { city, checkIn, checkOut, guests, rooms, page, limit } = filters;
  const dates = getNights(checkIn, checkOut, MAX_HOTEL_STAY_NIGHTS);
  const resolvedCity = await resolveCityInput(city, "Destination");
  const cityRecord = await City.findOne({
    active: true,
    name: new RegExp(`^${escapeRegex(resolvedCity)}$`, "i"),
  }).select("_id slug").lean();
  const hotelFilter = {
    active: { $ne: false },
    $or: [
      { city: { $regex: new RegExp(`^${escapeRegex(resolvedCity)}$`, "i") } },
      ...(cityRecord ? [{ cityId: cityRecord._id }, { citySlug: cityRecord.slug }] : []),
    ],
  };
  if (id) hotelFilter._id = id;
  const hotels = await Hotel.find(hotelFilter).sort({ name: 1 }).limit(id ? 1 : 500).lean();
  const hotelIds = hotels.map((hotel) => hotel._id);
  const roomTypes = await RoomType.find({ hotelId: { $in: hotelIds }, active: true }).sort({ pricePerNight: 1 }).lean();
  const roomsByHotel = new Map();
  for (const room of roomTypes) {
    const list = roomsByHotel.get(String(room.hotelId)) || [];
    list.push(room);
    roomsByHotel.set(String(room.hotelId), list);
  }
  const availability = await getRoomAvailability(roomTypes, dates);
  const results = hotels.map((hotel) => {
    const availableRooms = (roomsByHotel.get(String(hotel._id)) || [])
      .filter((room) => room.maxGuests * rooms >= guests)
      .map((room) => {
        const nightly = availability.get(String(room._id)) || [];
        const minimumAvailable = nightly.length ? Math.min(...nightly.map((night) => night.availableRooms)) : 0;
        const fare = calculateHotelFare(room.pricePerNight, dates.length, rooms);
        return {
          ...room,
          availableRooms: minimumAvailable,
          nights: nightly,
          pricePerNight: room.pricePerNight,
          fareBreakdown: fare,
          soldOut: minimumAvailable < rooms,
        };
      })
      .filter((room) => !room.soldOut);
    return {
      ...hotel,
      rooms: availableRooms,
      lowestTotal: availableRooms.length
        ? Math.min(...availableRooms.map((room) => room.fareBreakdown.totalAmount))
        : null,
    };
  }).filter((hotel) => hotel.rooms.length);
  const total = results.length;
  return {
    dates,
    city: resolvedCity,
    search: { city: resolvedCity, checkIn, checkOut, guests, rooms },
    hotels: id ? results : results.slice((page - 1) * limit, page * limit),
    total,
    page,
    limit,
  };
}

export const getHotels = asyncHandler(async (req, res) => {
  const filters = req.validated.query;
  const result = await getHotelResults(filters);
  return res.status(200).json({
    success: true,
    count: result.hotels.length,
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: Math.ceil(result.total / result.limit),
    dates: result.dates,
    search: result.search,
    data: result.hotels,
    ...(result.total === 0 ? { message: `No hotels found in ${result.city}.` } : {}),
  });
});

export const getHotelById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw makeBookingError("Invalid hotel identifier.", 400, "INVALID_ID");
  const filters = req.validated.query;
  const result = await getHotelResults(filters, req.params.id);
  if (!result.hotels.length) return res.status(404).json({ success: false, message: "No available rooms found for this hotel and date range." });
  return res.status(200).json({
    success: true,
    data: result.hotels[0],
    dates: result.dates,
    search: result.search,
  });
});

export const holdHotelRoom = asyncHandler(async (req, res) => {
  const { roomTypeId, checkIn, checkOut, guests, rooms } = req.validated.body;
  const idempotencyKey = getIdempotencyKey(req);
  const dates = getNights(checkIn, checkOut, MAX_HOTEL_STAY_NIGHTS);
  const hash = requestHash({ roomTypeId, checkIn, checkOut, guests, rooms });
  const oldHold = await findExistingHold(req.user._id, idempotencyKey, hash);
  if (oldHold) return res.status(200).json(holdResponse(oldHold));

  const roomType = await RoomType.findOne({ _id: roomTypeId, active: true }).lean();
  if (!roomType) throw makeBookingError("Room type not found.", 404, "ROOM_TYPE_NOT_FOUND");
  if (roomType.maxGuests * rooms < guests) throw makeBookingError("The selected number of rooms cannot accommodate all guests.");
  const hotel = await Hotel.findOne({ _id: roomType.hotelId, active: { $ne: false } }).lean();
  if (!hotel) throw makeBookingError("Hotel not found.", 404, "HOTEL_NOT_FOUND");

  for (const date of dates) {
    try {
      await RoomInventory.updateOne(
        { roomTypeId, date },
        { $setOnInsert: { roomTypeId, date, totalRooms: roomType.totalRooms, bookedRooms: 0 } },
        { upsert: true }
      );
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  const fare = calculateHotelFare(roomType.pricePerNight, dates.length, rooms);
  const expiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60 * 1000);
  try {
    const hold = await withBookingTransaction(async (session) => {
      const [created] = await BookingHold.create([{
        bookingType: "hotel",
        userId: req.user._id,
        idempotencyKey,
        requestHash: hash,
        hotelId: hotel._id,
        roomTypeId,
        roomCount: rooms,
        checkIn,
        checkOut,
        inventoryDates: dates,
        ...fare,
        snapshot: {
          hotelName: hotel.name,
          hotelAddress: hotel.address || "",
          city: hotel.city,
          roomTypeName: roomType.name,
          checkIn,
          checkOut,
          checkInTime: "14:00",
          checkOutTime: "11:00",
          nights: dates.length,
          rooms,
          guests,
          cancellationPolicy: hotel.cancellationPolicy,
        },
        expiresAt,
      }], { session });
      for (const date of [...dates].sort()) {
        const result = await RoomInventory.updateOne(
          {
            roomTypeId,
            date,
            $expr: {
              $lte: [
                { $add: [{ $ifNull: ["$bookedRooms", 0] }, rooms] },
                "$totalRooms",
              ],
            },
          },
          { $inc: { bookedRooms: rooms } },
          { session }
        );
        if (result.modifiedCount !== 1) {
          throw makeBookingError(`The selected room is no longer available for ${date}.`, 409, "ROOMS_UNAVAILABLE");
        }
      }
      return created;
    });
    return res.status(201).json(holdResponse(hold));
  } catch (error) {
    if (error.code === 11000) {
      const existing = await findExistingHold(req.user._id, idempotencyKey, hash);
      if (existing) return res.status(200).json(holdResponse(existing));
    }
    throw error;
  }
});

export default { getHotels, getHotelById, holdHotelRoom };
