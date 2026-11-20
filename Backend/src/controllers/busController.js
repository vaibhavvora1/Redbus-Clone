import Trip from "../models/Trip.js";
import Bus from "../models/Bus.js";
import asyncHandler from "../utils/asyncHandler.js";
import { generateDefaultSeatLayout } from "../utils/seatLayout.js";
import { ensureTripForSchedule, scheduleRunsOnDate, assertTravelDate, assertTripCanBeBooked } from "../services/tripService.js";
import {
  getTodayInAppTZ,
  hasDeparted,
} from "../utils/timeZone.js";
import { resolveCityPair } from "../utils/locationSearch.js";

const LOCK_DURATION_MS = parseInt(process.env.SEAT_LOCK_MINUTES || "10", 10) * 60 * 1000;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export { generateDefaultSeatLayout };

/**
 * Release expired locks on a trip
 */
export const cleanExpiredLocks = async (trip) => {
  if (!trip || !trip.seats || trip.seats.length === 0) return false;
  const now = new Date();
  let modified = false;

  trip.seats.forEach((seat) => {
    if (seat.isLocked && !seat.isBooked) {
      const isExpired = seat.holdExpiresAt
        ? new Date(seat.holdExpiresAt) <= now
        : seat.lockedAt && now.getTime() - new Date(seat.lockedAt).getTime() > LOCK_DURATION_MS;

      if (isExpired) {
        seat.isLocked = false;
        seat.lockedBy = null;
        seat.lockedAt = null;
        seat.holdExpiresAt = null;
        modified = true;
      }
    }
  });

  if (modified) {
    const bookedOrLocked = trip.seats.filter(
      (s) => s.isBooked || (s.isLocked && (!s.holdExpiresAt || new Date(s.holdExpiresAt) > now))
    ).length;
    trip.availableSeats = Math.max(0, trip.totalSeats - bookedOrLocked);
    await trip.save();
  }

  return modified;
};

/**
 * Helper to calculate trip duration in minutes for sorting
 */
const getDurationMinutes = (departure, arrival) => {
  if (!departure || !arrival) return 480;
  const [dh, dm] = departure.split(":").map(Number);
  const [ah, am] = arrival.split(":").map(Number);
  let diff = ah * 60 + am - (dh * 60 + dm);
  if (diff <= 0) diff += 24 * 60;
  return diff;
};

/**
 * Public: Search buses / scheduled trips with full filtering & sorting
 * GET /api/buses
 */
export const getBuses = asyncHandler(async (req, res) => {
  const {
    from,
    to,
    date,
    source,
    destination,
    busType,
    ac,
    sleeper,
    departureTime,
    minPrice,
    maxPrice,
    sortBy,
  } = req.query;

  const { from: cleanFrom, to: cleanTo } = await resolveCityPair(from || source, to || destination);
  const cleanDate = (date || "").trim();

  if (cleanDate) {
    assertTravelDate(cleanDate);
    const scheduleFilter = { active: { $ne: false } };
    if (cleanFrom) scheduleFilter.from = { $regex: new RegExp(`^${escapeRegex(cleanFrom)}$`, "i") };
    if (cleanTo) scheduleFilter.to = { $regex: new RegExp(`^${escapeRegex(cleanTo)}$`, "i") };
    const schedules = await Bus.find(scheduleFilter).lean();
    const runningSchedules = schedules.filter((schedule) => scheduleRunsOnDate(schedule, cleanDate));
    if (!runningSchedules.length && schedules.length) {
      return res.status(409).json({ success: false, code: "NOT_RUNNING_ON_DATE", message: "No bus schedule runs on the selected date." });
    }
    await Promise.all(runningSchedules.map((schedule) => ensureTripForSchedule(schedule, cleanDate)));
  }

  // 1. First, search Trips
  const tripFilter = { active: { $ne: false }, status: { $ne: "cancelled" } };

  if (cleanFrom) {
    tripFilter.fromCity = { $regex: new RegExp(`^${cleanFrom}$`, "i") };
  }
  if (cleanTo) {
    tripFilter.toCity = { $regex: new RegExp(`^${cleanTo}$`, "i") };
  }
  if (cleanDate) tripFilter.$or = [{ travelDate: cleanDate }, { journeyDate: cleanDate }];

  // Also search legacy Bus documents if trips don't yield or as fallback
  let trips = await Trip.find(tripFilter).lean();

  // If no exact match on date, match route with any date or today
  if (!cleanDate && trips.length === 0 && (cleanFrom || cleanTo)) {
    const looseFilter = { active: { $ne: false } };
    if (cleanFrom) looseFilter.fromCity = { $regex: new RegExp(cleanFrom, "i") };
    if (cleanTo) looseFilter.toCity = { $regex: new RegExp(cleanTo, "i") };
    trips = await Trip.find(looseFilter).lean();
  }

  // Convert trips into unified format
  let unifiedResults = trips.map((t) => {
    const isAc = !t.busType.toLowerCase().includes("non-ac") && t.busType.toLowerCase().includes("ac");
    const isSleeper = t.busType.toLowerCase().includes("sleeper");

    // Clean expired locks in memory view
    const now = Date.now();
    let bookedCount = 0;
    const cleanSeats = (t.seats || []).map((s) => {
      let isLocked = s.isLocked;
      if (isLocked && !s.isBooked) {
        const expiresAt = s.holdExpiresAt ? new Date(s.holdExpiresAt).getTime() : null;
        const isExpired = expiresAt ? expiresAt <= now : s.lockedAt && now - new Date(s.lockedAt).getTime() > LOCK_DURATION_MS;
        if (isExpired) {
          isLocked = false;
        }
      }
      if (s.isBooked || isLocked) bookedCount++;
      return {
        ...s,
        isLocked,
        isAvailable: !s.isBooked && !isLocked,
      };
    });

    const durationMinutes = getDurationMinutes(t.departureTime, t.arrivalTime);
    const h = Math.floor(durationMinutes / 60);
    const m = durationMinutes % 60;
    const isDeparted = hasDeparted(t);
    const availableSeats = Math.max(0, (t.totalSeats || 36) - bookedCount);
    const isSoldOut = availableSeats === 0;

    return {
      _id: t._id,
      id: t._id,
      tripId: t._id,
      operator: t.operator,
      busNumber: t.busNumber || "",
      from: t.fromCity,
      to: t.toCity,
      journeyDate: t.travelDate || t.journeyDate,
      travelDate: t.travelDate || t.journeyDate,
      departureTime: t.departureTime,
      arrivalTime: t.arrivalTime,
      duration: t.duration || `${h}h ${m > 0 ? `${m}m` : "00m"}`,
      durationMinutes,
      busType: t.busType,
      type: t.busType,
      fare: t.fare,
      price: t.price || t.fare,
      totalSeats: t.totalSeats || 36,
      availableSeats,
      isDeparted,
      hasDeparted: isDeparted,
      isSoldOut,
      departureStatus: isDeparted ? "DEPARTED" : isSoldOut ? "SOLD_OUT" : "ON_SCHEDULE",
      rating: t.rating || "4.5",
      amenities: t.amenities || [],
      boardingPoints: t.boardingPoints || [],
      droppingPoints: t.droppingPoints || [],
      seats: cleanSeats,
      isAc,
      isSleeper,
      source: "trip",
    };
  });

  // If trips are empty, load from Bus model
  if (unifiedResults.length === 0 && !cleanDate) {
    const busFilter = {};
    if (cleanFrom) busFilter.from = { $regex: new RegExp(cleanFrom, "i") };
    if (cleanTo) busFilter.to = { $regex: new RegExp(cleanTo, "i") };
    if (cleanDate) {
      busFilter.$or = [
        { journeyDate: { $regex: new RegExp(cleanDate, "i") } },
        { journeyDate: "" },
        { journeyDate: { $exists: false } },
      ];
    }

    const buses = await Bus.find(busFilter).lean();
    unifiedResults = buses.map((b) => {
      const typeStr = (b.busType || b.type || "").toLowerCase();
      const isAc = typeStr.includes("ac") && !typeStr.includes("non-ac");
      const isSleeper = typeStr.includes("sleeper");
      const durationMinutes = getDurationMinutes(b.departureTime, b.arrivalTime);
      const h = Math.floor(durationMinutes / 60);
      const m = durationMinutes % 60;
      const tripDateStr = b.journeyDate || cleanDate || getTodayInAppTZ();
      const virtualTrip = { journeyDate: tripDateStr, departureTime: b.departureTime || "21:00" };
      const isDeparted = hasDeparted(virtualTrip);

      return {
        _id: b._id,
        id: b._id,
        tripId: b._id,
        operator: b.operator,
        busNumber: b.busNumber || "",
        from: b.from,
        to: b.to,
        journeyDate: tripDateStr,
        departureTime: b.departureTime || "21:00",
        arrivalTime: b.arrivalTime || "06:00",
        duration: `${h}h ${m > 0 ? `${m}m` : "00m"}`,
        durationMinutes,
        busType: b.busType || b.type || "AC Sleeper",
        type: b.busType || b.type || "AC Sleeper",
        fare: b.fare || b.price || 699,
        price: b.price || b.fare || 699,
        totalSeats: b.totalSeats || 36,
        availableSeats: b.totalSeats || 36,
        isDeparted,
        hasDeparted: isDeparted,
        isSoldOut: false,
        departureStatus: isDeparted ? "DEPARTED" : "ON_SCHEDULE",
        rating: b.rating || "4.5",
        amenities: b.amenities || ["Charging Point", "Water Bottle", "Blanket"],
        boardingPoints: [{ name: `${b.from} Main Terminal`, time: b.departureTime || "21:00" }],
        droppingPoints: [{ name: `${b.to} Central Station`, time: b.arrivalTime || "06:00" }],
        seats: generateDefaultSeatLayout(b.totalSeats || 36, b.fare || 699, b.busType),
        isAc,
        isSleeper,
        source: "bus",
      };
    });
  }

  // 2. Apply In-Memory Filters
  let filtered = unifiedResults.filter((b) => {
    // AC filter: 'ac' | 'non_ac'
    if (ac === "ac" || ac === "true" || ac === "AC") {
      if (!b.isAc) return false;
    } else if (ac === "non_ac" || ac === "false" || ac === "NON_AC") {
      if (b.isAc) return false;
    }

    // Sleeper / Seater filter
    if (sleeper === "sleeper" || sleeper === "true" || sleeper === "SLEEPER") {
      if (!b.isSleeper) return false;
    } else if (sleeper === "seater" || sleeper === "false" || sleeper === "SEATER") {
      if (b.isSleeper) return false;
    }

    // Specific busType
    if (busType && busType !== "ALL") {
      if (!b.busType.toLowerCase().includes(busType.toLowerCase())) return false;
    }

    // Min / Max Price
    if (minPrice && b.price < Number(minPrice)) return false;
    if (maxPrice && b.price > Number(maxPrice)) return false;

    // Departure Time filter (morning: 06-12, afternoon: 12-18, evening: 18-24, night: 00-06)
    if (departureTime && departureTime !== "ALL") {
      const hour = parseInt((b.departureTime || "0").split(":")[0], 10);
      if (departureTime === "morning" && (hour < 6 || hour >= 12)) return false;
      if (departureTime === "afternoon" && (hour < 12 || hour >= 18)) return false;
      if (departureTime === "evening" && (hour < 18 || hour >= 24)) return false;
      if (departureTime === "night" && hour >= 6) return false;
    }

    return true;
  });

  // 3. Apply Sorting
  filtered.sort((a, b) => {
    if (sortBy === "PRICE_LOW" || sortBy === "price_asc") return a.price - b.price;
    if (sortBy === "PRICE_HIGH" || sortBy === "price_desc") return b.price - a.price;
    if (sortBy === "DEPARTURE_EARLY" || sortBy === "departure_asc") {
      return (a.departureTime || "").localeCompare(b.departureTime || "");
    }
    if (sortBy === "DURATION" || sortBy === "duration_asc") {
      return a.durationMinutes - b.durationMinutes;
    }
    if (sortBy === "RATING" || sortBy === "rating_desc") {
      return parseFloat(b.rating || "0") - parseFloat(a.rating || "0");
    }
    return a.price - b.price; // Default: lowest price first
  });

  return res.status(200).json({
    success: true,
    count: filtered.length,
    data: filtered,
    ...(filtered.length === 0 && cleanFrom && cleanTo
      ? { message: `No buses found from ${cleanFrom} to ${cleanTo}.` }
      : {}),
  });
});

/**
 * Public: Get single bus / trip with live seat layout & auto lock cleanup
 * GET /api/buses/:id
 */
export const getBusById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let trip = await Trip.findById(id);

  if (trip) {
    await cleanExpiredLocks(trip);
    const isDeparted = hasDeparted(trip);
    const tripObj = trip.toObject();

    return res.status(200).json({
      success: true,
      isDeparted,
      hasDeparted: isDeparted,
      data: {
        ...tripObj,
        isDeparted,
        hasDeparted: isDeparted,
      },
      trip: {
        ...tripObj,
        isDeparted,
        hasDeparted: isDeparted,
      },
    });
  }
  return res.status(404).json({ success: false, code: "TRIP_NOT_FOUND", message: "Trip not found." });
});

/**
 * Public: Get Seat Availability for a Trip
 * GET /api/buses/:id/seats
 */
export const getTripSeats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const trip = await Trip.findById(id);

  if (!trip) {
    return res.status(404).json({ success: false, code: "TRIP_NOT_FOUND", message: "Trip not found." });
  }

  if (trip.status === "cancelled") {
    return res.status(410).json({ success: false, code: "TRIP_CANCELLED", message: "This trip has been cancelled." });
  }

  // Authoritative departure check
  if (hasDeparted(trip)) {
    return res.status(410).json({
      success: false,
      code: "TRIP_DEPARTED",
      isDeparted: true,
      message: `This bus service departed on ${trip.journeyDate} at ${trip.departureTime}. Online seat selection is closed.`,
    });
  }

  await cleanExpiredLocks(trip);

  const now = new Date();
  const seatsWithStatus = trip.seats.map((s) => {
    const isHoldActive = s.isLocked && !s.isBooked && (s.holdExpiresAt ? new Date(s.holdExpiresAt) > now : true);
    return {
      seatNumber: s.seatNumber,
      deck: s.deck,
      row: s.row,
      col: s.col,
      type: s.type,
      fare: s.fare,
      isBooked: s.isBooked,
      isLocked: isHoldActive,
      isAvailable: !s.isBooked && !isHoldActive,
      lockedBy: isHoldActive ? s.lockedBy : null,
      holdExpiresAt: isHoldActive ? s.holdExpiresAt : null,
    };
  });

  const availableCount = seatsWithStatus.filter((s) => s.isAvailable).length;
  const isSoldOut = availableCount === 0;

  return res.status(200).json({
    success: true,
    seats: seatsWithStatus,
    totalSeats: trip.totalSeats,
    availableSeats: availableCount,
    isSoldOut,
    code: isSoldOut ? "SOLD_OUT" : undefined,
    lockDurationMinutes: parseInt(process.env.SEAT_LOCK_MINUTES || "10", 10),
  });
});

/**
 * Lock Selected Seats Atomically for 10 Minutes
 * Eliminates check-then-update race conditions using single guarded atomic update.
 * POST /api/buses/:id/lock-seats
 */
export const lockSeats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { seatNumbers, sessionId } = req.body;

  if (!Array.isArray(seatNumbers) || seatNumbers.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Please provide an array of seat numbers to lock.",
    });
  }

  // Canonical sorted unique order to prevent deadlocks
  const sortedSeats = [...new Set(seatNumbers.map((s) => String(s).trim()))].sort();
  const lockerId = req.user?._id?.toString() || sessionId || req.ip;

  const trip = await Trip.findById(id);
  if (!trip) return res.status(404).json({ success: false, code: "TRIP_NOT_FOUND", message: "Trip not found." });
  await assertTripCanBeBooked(trip);

  // Authoritative departure check
  if (hasDeparted(trip)) {
    return res.status(400).json({
      success: false,
      code: "TRIP_DEPARTED",
      message: "Cannot hold seats on a trip that has already departed.",
    });
  }

  const now = new Date();
  const holdExpiresAt = new Date(now.getTime() + LOCK_DURATION_MS);

  // Single Atomic Guarded Update:
  // Updates ONLY if NONE of the target seats are booked, and none are actively locked by another user
  const lockResult = await Trip.updateOne(
    {
      _id: trip._id,
      seats: {
        $not: {
          $elemMatch: {
            seatNumber: { $in: sortedSeats },
            $or: [
              { isBooked: true },
              {
                isLocked: true,
                lockedBy: { $ne: lockerId },
                $or: [
                  { holdExpiresAt: { $gt: now } },
                  { holdExpiresAt: null, lockedAt: { $gt: new Date(now.getTime() - LOCK_DURATION_MS) } },
                ],
              },
            ],
          },
        },
      },
    },
    {
      $set: {
        "seats.$[elem].isLocked": true,
        "seats.$[elem].lockedBy": lockerId,
        "seats.$[elem].lockedAt": now,
        "seats.$[elem].holdExpiresAt": holdExpiresAt,
      },
    },
    {
      arrayFilters: [{ "elem.seatNumber": { $in: sortedSeats } }],
    }
  );

  // If matchedCount is 0, at least one seat was unavailable
  if (lockResult.matchedCount === 0) {
    const currentTrip = await Trip.findById(trip._id).lean();
    const unavailableSeats = [];

    sortedSeats.forEach((seatNum) => {
      const seat = currentTrip?.seats?.find((s) => s.seatNumber === seatNum);
      if (!seat) {
        unavailableSeats.push(`${seatNum} (not found)`);
      } else if (seat.isBooked) {
        unavailableSeats.push(`${seatNum} (already booked)`);
      } else if (
        seat.isLocked &&
        seat.lockedBy !== lockerId &&
        (seat.holdExpiresAt ? new Date(seat.holdExpiresAt) > now : true)
      ) {
        unavailableSeats.push(`${seatNum} (held by another user)`);
      }
    });

    return res.status(409).json({
      success: false,
      message: `The following seat(s) are no longer available: ${unavailableSeats.join(", ")}`,
      unavailableSeats,
    });
  }

  // Update total available seats count atomically
  const updatedTrip = await Trip.findById(trip._id);
  if (updatedTrip) {
    const bookedOrLocked = updatedTrip.seats.filter(
      (s) => s.isBooked || (s.isLocked && (!s.holdExpiresAt || new Date(s.holdExpiresAt) > now))
    ).length;
    updatedTrip.availableSeats = Math.max(0, updatedTrip.totalSeats - bookedOrLocked);
    await updatedTrip.save();
  }

  return res.status(200).json({
    success: true,
    message: `Seats ${sortedSeats.join(", ")} locked successfully for 10 minutes.`,
    lockedSeats: sortedSeats,
    expiresAt: holdExpiresAt,
  });
});

/**
 * Release / Unlock Seats (User cancelled or timed out)
 * POST /api/buses/:id/unlock-seats
 */
export const unlockSeats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { seatNumbers, sessionId } = req.body;

  const lockerId = req.user?._id?.toString() || sessionId || req.ip;
  const trip = await Trip.findById(id);

  if (!trip) {
    return res.status(404).json({ success: false, message: "Trip not found." });
  }

  const targetSeats = Array.isArray(seatNumbers) && seatNumbers.length > 0
    ? seatNumbers.map((s) => String(s).trim())
    : null;

  const filter = {
    _id: trip._id,
  };

  const arrayFilter = {
    "elem.isLocked": true,
    "elem.isBooked": false,
  };

  if (targetSeats) {
    arrayFilter["elem.seatNumber"] = { $in: targetSeats };
  }

  if (req.user?.role !== "ADMIN" && lockerId) {
    arrayFilter["elem.lockedBy"] = lockerId;
  }

  const unlockResult = await Trip.updateOne(
    filter,
    {
      $set: {
        "seats.$[elem].isLocked": false,
        "seats.$[elem].lockedBy": null,
        "seats.$[elem].lockedAt": null,
        "seats.$[elem].holdExpiresAt": null,
      },
    },
    {
      arrayFilters: [arrayFilter],
    }
  );

  const updatedTrip = await Trip.findById(trip._id);
  if (updatedTrip) {
    const now = new Date();
    const bookedOrLocked = updatedTrip.seats.filter(
      (s) => s.isBooked || (s.isLocked && (!s.holdExpiresAt || new Date(s.holdExpiresAt) > now))
    ).length;
    updatedTrip.availableSeats = Math.max(0, updatedTrip.totalSeats - bookedOrLocked);
    await updatedTrip.save();
  }

  return res.status(200).json({
    success: true,
    message: `Released ${unlockResult.modifiedCount || 0} locked seat(s).`,
  });
});

export default {
  getBuses,
  getBusById,
  getTripSeats,
  lockSeats,
  unlockSeats,
};
