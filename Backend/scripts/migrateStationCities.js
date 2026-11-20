import "dotenv/config";
import mongoose from "mongoose";
import City from "../src/models/City.js";
import Station from "../src/models/Station.js";

const applyChanges = process.argv.includes("--apply");
const normalize = (value) => String(value || "").trim().toLocaleLowerCase("en");

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  const [cities, stations] = await Promise.all([
    City.find({ active: true }).select("name slug aliases").lean(),
    Station.find({}).select("code name city cityId citySlug").lean(),
  ]);
  const citiesByName = new Map();
  for (const city of cities) {
    for (const name of [city.name, city.slug, ...(city.aliases || [])]) {
      citiesByName.set(normalize(name), city);
    }
  }

  const unmatched = [];
  const updates = [];
  for (const station of stations) {
    const city = citiesByName.get(normalize(station.city));
    if (!city) {
      unmatched.push({ code: station.code, name: station.name, city: station.city });
      continue;
    }
    if (String(station.cityId || "") !== String(city._id) || station.citySlug !== city.slug) {
      updates.push({ stationId: station._id, cityId: city._id, citySlug: city.slug });
    }
  }

  console.log(JSON.stringify({
    database: mongoose.connection.name,
    mode: applyChanges ? "apply" : "dry-run",
    stationsChecked: stations.length,
    stationsNeedingLink: updates.length,
    stationsWithoutMatchingCity: unmatched.length,
    unmatched,
  }, null, 2));

  if (applyChanges && updates.length) {
    const result = await Station.bulkWrite(updates.map(({ stationId, cityId, citySlug }) => ({
      updateOne: {
        filter: { _id: stationId },
        update: { $set: { cityId, citySlug } },
      },
    })));
    console.log(`Linked ${result.modifiedCount} stations.`);
  }

  if (applyChanges) {
    await Station.collection.createIndex({ cityId: 1 });
    await Station.collection.createIndex({ citySlug: 1 });
  }
}

migrate()
  .catch((error) => {
    console.error("Station-city migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
