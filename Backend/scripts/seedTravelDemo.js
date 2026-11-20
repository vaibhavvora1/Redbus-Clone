import "dotenv/config";
import mongoose from "mongoose";
import Station from "../src/models/Station.js";
import Train from "../src/models/Train.js";
import TrainSchedule from "../src/models/TrainSchedule.js";
import Hotel from "../src/models/Hotel.js";
import RoomType from "../src/models/RoomType.js";
import RoomInventory from "../src/models/RoomInventory.js";
import { getTodayInAppTZ, addDaysToAppDate } from "../src/utils/timeZone.js";

const demoStations = [
  { code: "NDLS", name: "New Delhi", city: "Delhi", aliases: ["Delhi"] },
  { code: "JP", name: "Jaipur Junction", city: "Jaipur", aliases: ["Jaipur"] },
];

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not configured.");
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([Train.init(), TrainSchedule.init(), RoomType.init(), RoomInventory.init()]);

  const stations = new Map();
  for (const stationData of demoStations) {
    const station = await Station.findOneAndUpdate(
      { code: stationData.code },
      {
        $setOnInsert: {
          ...stationData,
          isPopular: true,
          active: true,
          nameNormalized: stationData.name.toLocaleLowerCase("en"),
          codeNormalized: stationData.code.toLocaleLowerCase("en"),
          cityNormalized: stationData.city.toLocaleLowerCase("en"),
          aliasesNormalized: stationData.aliases.map((alias) => alias.toLocaleLowerCase("en")),
        },
      },
      { upsert: true, returnDocument: "after" }
    ).lean();
    stations.set(station.code, station);
  }

  const train = await Train.findOneAndUpdate(
    { trainNumber: "DEMO-1001" },
    {
      $setOnInsert: {
        operator: "Demo Intercity",
        trainNumber: "DEMO-1001",
        trainName: "Demo Intercity Express",
        from: "Delhi",
        to: "Jaipur",
        type: "Demo schedule",
        price: 650,
        isDemo: true,
        amenities: ["Demo service", "Reserved seating"],
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  await TrainSchedule.findOneAndUpdate(
    { trainNumber: "DEMO-1001" },
    {
      $setOnInsert: {
        trainId: train._id,
        trainNumber: "DEMO-1001",
        trainName: "Demo Intercity Express",
        stops: [
          {
            stationId: stations.get("NDLS")._id,
            stationCode: "NDLS",
            stationName: "New Delhi",
            city: "Delhi",
            departureTime: "08:00",
          },
          {
            stationId: stations.get("JP")._id,
            stationCode: "JP",
            stationName: "Jaipur Junction",
            city: "Jaipur",
            arrivalTime: "12:30",
            dayOffset: 0,
          },
        ],
        runningDays: [0, 1, 2, 3, 4, 5, 6],
        classes: [
          { code: "SL", name: "Demo Sleeper", fare: 650, seatCount: 48 },
          { code: "AC3", name: "Demo AC 3 Tier", fare: 1200, seatCount: 32 },
        ],
        active: true,
        isDemo: true,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const hotel = await Hotel.findOneAndUpdate(
    { name: "Demo Sample Stay", city: "Jaipur" },
    {
      $setOnInsert: {
        name: "Demo Sample Stay",
        city: "Jaipur",
        address: "Sample address for development demonstrations",
        type: "Demo",
        price: 2500,
        rating: "4.00",
        starRating: 3,
        isAc: true,
        isDemo: true,
        cancellationPolicy: "Demo policy: free cancellation at least 24 hours before check-in.",
        amenities: ["Demo listing", "WiFi"],
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
  const roomType = await RoomType.findOneAndUpdate(
    { hotelId: hotel._id, name: "Demo Standard Room" },
    {
      $setOnInsert: {
        hotelId: hotel._id,
        name: "Demo Standard Room",
        description: "Sample room inventory for development and payment testing only.",
        maxGuests: 2,
        totalRooms: 5,
        pricePerNight: 2500,
        active: true,
        isDemo: true,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const today = getTodayInAppTZ();
  const inventoryOperations = [];
  for (let offset = 0; offset <= 90; offset += 1) {
    const date = addDaysToAppDate(today, offset);
    inventoryOperations.push({
      updateOne: {
        filter: { roomTypeId: roomType._id, date },
        update: {
          $setOnInsert: {
            roomTypeId: roomType._id,
            date,
            totalRooms: roomType.totalRooms,
            bookedRooms: 0,
          },
        },
        upsert: true,
      },
    });
  }
  if (inventoryOperations.length) {
    await RoomInventory.bulkWrite(inventoryOperations, { ordered: false });
  }

  console.log(JSON.stringify({
    database: mongoose.connection.name,
    demoDataOnly: true,
    trainNumber: "DEMO-1001",
    hotel: "Demo Sample Stay",
    seededInventoryDays: inventoryOperations.length,
  }, null, 2));
}

seed()
  .catch((error) => {
    console.error("Travel demo seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
