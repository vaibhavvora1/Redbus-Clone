import "dotenv/config";
import mongoose from "mongoose";
import City from "../src/models/City.js";
import Station from "../src/models/Station.js";
import Hotel from "../src/models/Hotel.js";
import RoomType from "../src/models/RoomType.js";
import Train from "../src/models/Train.js";
import TrainSchedule from "../src/models/TrainSchedule.js";
import { getTodayInAppTZ } from "../src/utils/timeZone.js";

const applyChanges = process.argv.includes("--apply");
const summary = {
  database: "",
  mode: applyChanges ? "apply" : "dry-run",
  hotelsChecked: 0,
  hotelUpdates: 0,
  hotelUnfixed: [],
  stationsChecked: 0,
  stationLinks: 0,
  stationsWithoutCity: [],
  trainsChecked: 0,
  trainUpdates: 0,
  trainUnfixed: [],
};

function normalize(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("en") : "";
}

async function findCity(name) {
  const term = normalize(name);
  if (!term) return null;
  return City.findOne({
    active: true,
    $or: [
      { nameNormalized: term },
      { slug: term },
      { aliasesNormalized: term },
    ],
  }).select("_id name slug").lean();
}

async function repairHotels() {
  const hotels = await Hotel.find().lean();
  summary.hotelsChecked = hotels.length;
  for (const hotel of hotels) {
    const city = await findCity(hotel.city);
    if (!city) {
      summary.hotelUnfixed.push({ id: String(hotel._id), name: hotel.name, reason: `City "${hotel.city || ""}" is not in the active City list.` });
      continue;
    }

    const update = {};
    if (hotel.city !== city.name) update.city = city.name;
    if (String(hotel.cityId || "") !== String(city._id)) update.cityId = city._id;
    if (hotel.citySlug !== city.slug) update.citySlug = city.slug;
    if (hotel.active === undefined) update.active = true;
    if (Object.keys(update).length) {
      if (applyChanges) await Hotel.updateOne({ _id: hotel._id }, { $set: update });
      summary.hotelUpdates += 1;
    }

    const roomTypes = await RoomType.find({ hotelId: hotel._id }).select("active maxGuests pricePerNight totalRooms").lean();
    const usableRoomType = roomTypes.some((room) =>
      room.active && room.maxGuests > 0 && room.pricePerNight > 0 && room.totalRooms > 0
    );
    if (!usableRoomType) {
      summary.hotelUnfixed.push({
        id: String(hotel._id),
        name: hotel.name,
        reason: roomTypes.length
          ? "No active room type has positive capacity, price, and totalRooms."
          : "No room type exists; capacity, price, and inventory need an admin decision.",
      });
    }
  }
}

async function repairStations() {
  const stations = await Station.find().lean();
  summary.stationsChecked = stations.length;
  for (const station of stations) {
    const city = await findCity(station.city);
    if (!city) {
      summary.stationsWithoutCity.push({ code: station.code, name: station.name, city: station.city });
      continue;
    }
    const update = {};
    if (String(station.cityId || "") !== String(city._id)) update.cityId = city._id;
    if (station.citySlug !== city.slug) update.citySlug = city.slug;
    if (station.city !== city.name) update.city = city.name;
    if (station.active === undefined) update.active = true;
    if (Object.keys(update).length) {
      if (applyChanges) await Station.updateOne({ _id: station._id }, { $set: update });
      summary.stationLinks += 1;
    }
  }
}

async function repairTrains() {
  const trains = await Train.find().lean();
  summary.trainsChecked = trains.length;
  for (const train of trains) {
    const update = {};
    if (train.active === undefined) update.active = true;
    if (Object.keys(update).length) {
      if (applyChanges) await Train.updateOne({ _id: train._id }, { $set: update });
      summary.trainUpdates += 1;
    }

    const schedule = await TrainSchedule.findOne({ trainId: train._id, active: true }).sort({ createdAt: -1 }).lean();
    if (!schedule) {
      summary.trainUnfixed.push({
        id: String(train._id),
        train: train.operator,
        reason: "No active TrainSchedule exists; route stations, train number, running days, and class inventory need admin confirmation.",
      });
      continue;
    }

    const scheduleUpdate = {};
    if (!Array.isArray(schedule.runningDays) || schedule.runningDays.length === 0) {
      scheduleUpdate.runningDays = [0, 1, 2, 3, 4, 5, 6];
    }
    if (!schedule.validFrom) scheduleUpdate.validFrom = getTodayInAppTZ();
    if (schedule.validTo === undefined || schedule.validTo === null) scheduleUpdate.validTo = "";

    const stations = await Station.find({
      code: { $in: (schedule.stops || []).map((stop) => String(stop.stationCode || "").toUpperCase()) },
      active: true,
    }).select("_id code name city cityId citySlug").lean();
    const stationByCode = new Map(stations.map((station) => [station.code, station]));
    let hasUnlinkedStop = false;
    const repairedStops = (schedule.stops || []).map((stop) => {
      const station = stationByCode.get(String(stop.stationCode || "").toUpperCase());
      if (!station || !station.cityId) {
        hasUnlinkedStop = true;
        return stop;
      }
      if (String(stop.stationId || "") !== String(station._id) ||
          stop.stationName !== station.name || stop.city !== station.city) {
        return {
          ...stop,
          stationId: station._id,
          stationCode: station.code,
          stationName: station.name,
          city: station.city,
        };
      }
      return stop;
    });
    if (repairedStops.some((stop, index) => stop !== schedule.stops[index])) scheduleUpdate.stops = repairedStops;

    if (hasUnlinkedStop) {
      summary.trainUnfixed.push({ id: String(train._id), train: train.operator, reason: "One or more schedule stops have no active Station linked to a City." });
    }
    if (!(schedule.classes || []).length) {
      summary.trainUnfixed.push({ id: String(train._id), train: train.operator, reason: "Schedule has no class fare and seat inventory; values cannot be inferred safely." });
    }
    if (Object.keys(scheduleUpdate).length) {
      if (applyChanges) await TrainSchedule.updateOne({ _id: schedule._id }, { $set: scheduleUpdate });
      summary.trainUpdates += 1;
    }
  }
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  summary.database = mongoose.connection.name;
  await repairHotels();
  await repairStations();
  await repairTrains();
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  console.error(`Admin search repair failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
