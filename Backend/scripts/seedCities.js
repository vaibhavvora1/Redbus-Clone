import "dotenv/config";
import mongoose from "mongoose";
import City, { slugifyCityName } from "../src/models/City.js";
import Station from "../src/models/Station.js";
import Bus from "../src/models/Bus.js";
import Trip from "../src/models/Trip.js";
import Route from "../src/models/Route.js";
import Train from "../src/models/Train.js";
import TrainSchedule from "../src/models/TrainSchedule.js";
import Hotel from "../src/models/Hotel.js";

const seedCities = [
  ["Mumbai", "Maharashtra", true, ["Bombay", "Bandra"]],
  ["Delhi", "Delhi", true, ["New Delhi"]],
  ["Bengaluru", "Karnataka", true, ["Bangalore"]],
  ["Hyderabad", "Telangana", true],
  ["Chennai", "Tamil Nadu", true, ["Madras"]],
  ["Kolkata", "West Bengal", true, ["Calcutta"]],
  ["Ahmedabad", "Gujarat", true, ["Ahmadabad"]],
  ["Pune", "Maharashtra", true],
  ["Jaipur", "Rajasthan", true],
  ["Surat", "Gujarat", true],
  ["Amaravati", "Andhra Pradesh"],
  ["Agartala", "Tripura"],
  ["Agra", "Uttar Pradesh"],
  ["Aizawl", "Mizoram"],
  ["Amritsar", "Punjab"],
  ["Aurangabad", "Maharashtra"],
  ["Bhopal", "Madhya Pradesh"],
  ["Bhubaneswar", "Odisha"],
  ["Chandigarh", "Chandigarh"],
  ["Coimbatore", "Tamil Nadu"],
  ["Dehradun", "Uttarakhand"],
  ["Dharamshala", "Himachal Pradesh"],
  ["Dibrugarh", "Assam"],
  ["Dimapur", "Nagaland"],
  ["Dispur", "Assam"],
  ["Faridabad", "Haryana"],
  ["Gangtok", "Sikkim"],
  ["Gandhinagar", "Gujarat"],
  ["Gaya", "Bihar"],
  ["Ghaziabad", "Uttar Pradesh"],
  ["Goa", "Goa"],
  ["Gurugram", "Haryana", false, ["Gurgaon"]],
  ["Guwahati", "Assam"],
  ["Gwalior", "Madhya Pradesh"],
  ["Imphal", "Manipur"],
  ["Indore", "Madhya Pradesh"],
  ["Itanagar", "Arunachal Pradesh"],
  ["Jabalpur", "Madhya Pradesh"],
  ["Jodhpur", "Rajasthan"],
  ["Kanpur", "Uttar Pradesh"],
  ["Kochi", "Kerala", false, ["Cochin"]],
  ["Kohima", "Nagaland"],
  ["Kota", "Rajasthan"],
  ["Lucknow", "Uttar Pradesh"],
  ["Ludhiana", "Punjab"],
  ["Madurai", "Tamil Nadu"],
  ["Mangaluru", "Karnataka", false, ["Mangalore"]],
  ["Meerut", "Uttar Pradesh"],
  ["Mysuru", "Karnataka", false, ["Mysore"]],
  ["Nagpur", "Maharashtra"],
  ["Nashik", "Maharashtra"],
  ["Noida", "Uttar Pradesh"],
  ["Panaji", "Goa"],
  ["Patna", "Bihar"],
  ["Prayagraj", "Uttar Pradesh", false, ["Allahabad"]],
  ["Raipur", "Chhattisgarh"],
  ["Rajkot", "Gujarat"],
  ["Ranchi", "Jharkhand"],
  ["Shillong", "Meghalaya"],
  ["Shimla", "Himachal Pradesh"],
  ["Siliguri", "West Bengal"],
  ["Thiruvananthapuram", "Kerala", false, ["Trivandrum"]],
  ["Tiruchirappalli", "Tamil Nadu", false, ["Trichy"]],
  ["Udaipur", "Rajasthan"],
  ["Vadodara", "Gujarat", false, ["Baroda"]],
  ["Varanasi", "Uttar Pradesh", false, ["Banaras"]],
  ["Vijayawada", "Andhra Pradesh"],
  ["Visakhapatnam", "Andhra Pradesh", false, ["Vizag"]],
  ["Warangal", "Telangana"],
  ["Port Blair", "Andaman and Nicobar Islands"],
  ["Kavaratti", "Lakshadweep"],
  ["Puducherry", "Puducherry"],
  ["Daman", "Dadra and Nagar Haveli and Daman and Diu"],
  ["Silvassa", "Dadra and Nagar Haveli and Daman and Diu"],
  ["Srinagar", "Jammu and Kashmir"],
  ["Jammu", "Jammu and Kashmir"],
  ["Leh", "Ladakh"],
  ["Bhavnagar", "Gujarat"],
];

const seedStations = [
  { code: "CSMT", name: "Chhatrapati Shivaji Maharaj Terminus", city: "Mumbai", aliases: ["Mumbai CSMT", "VT"] },
  { code: "BCT", name: "Mumbai Central", city: "Mumbai", aliases: ["Bombay Central"] },
  { code: "BDTS", name: "Bandra Terminus", city: "Mumbai", aliases: ["Bandra"] },
  { code: "NDLS", name: "New Delhi", city: "Delhi", aliases: ["Delhi"] },
  { code: "SBC", name: "KSR Bengaluru City Junction", city: "Bengaluru", aliases: ["Bangalore City", "Bengaluru"] },
  { code: "HYB", name: "Hyderabad Deccan", city: "Hyderabad" },
  { code: "MAS", name: "Chennai Central", city: "Chennai", aliases: ["Madras Central", "Chennai"] },
  { code: "HWH", name: "Howrah Junction", city: "Kolkata", aliases: ["Howrah", "Kolkata"] },
  { code: "ADI", name: "Ahmedabad Junction", city: "Ahmedabad", aliases: ["Ahmedabad"] },
  { code: "PUNE", name: "Pune Junction", city: "Pune", aliases: ["Pune"] },
  { code: "JP", name: "Jaipur Junction", city: "Jaipur", aliases: ["Jaipur"] },
  { code: "ST", name: "Surat", city: "Surat", aliases: ["Surat"] },
  { code: "BVC", name: "Bhavnagar Terminus", city: "Bhavnagar", aliases: ["Bhavnagar"] },
];

function cleanLocation(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function ensureIndex(collection, keys, options = {}) {
  const indexes = await collection.indexes();
  const existing = indexes.find((index) =>
    JSON.stringify(index.key) === JSON.stringify(keys)
  );
  if (existing) {
    if (options.unique && !existing.unique) {
      throw new Error(`Existing index on ${JSON.stringify(keys)} is not unique.`);
    }
    return;
  }
  await collection.createIndex(keys, options);
}

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);

  const cityData = new Map(
    seedCities.map(([name, state, isPopular = false, aliases = []]) => [
      slugifyCityName(name),
      { name, state, isPopular, aliases },
    ])
  );
  const [buses, trips, routes, trains, hotels, existingCities, existingStations, trainSchedules] = await Promise.all([
    Bus.find().select("from to").lean(),
    Trip.find().select("fromCity toCity").lean(),
    Route.find().select("fromCity toCity").lean(),
    Train.find().select("from to").lean(),
    Hotel.find().select("city").lean(),
    City.find().select("name state slug aliases isPopular population").lean(),
    Station.find().select("code name city aliases isPopular active").lean(),
    TrainSchedule.find().select("stops").lean(),
  ]);
  const existingCityInfo = new Map(
    existingCities.map((city) => [slugifyCityName(city.name), city])
  );
  for (const existingCity of existingCities) {
    const slug = existingCity.slug || slugifyCityName(existingCity.name);
    const seededCity = cityData.get(slug);
    if (seededCity) {
      seededCity.aliases = [...new Set([...seededCity.aliases, ...(existingCity.aliases || [])])];
      seededCity.isPopular = seededCity.isPopular || existingCity.isPopular;
    } else {
      cityData.set(slug, {
        name: existingCity.name,
        state: existingCity.state,
        isPopular: existingCity.isPopular,
        aliases: existingCity.aliases || [],
      });
    }
  }
  const knownAliases = new Set(
    [...cityData.values()].flatMap((city) => city.aliases.map((alias) => alias.toLocaleLowerCase("en")))
  );
  const knownStations = new Map(seedStations.map((station) => [station.code, station]));
  for (const station of existingStations) {
    if (!knownStations.has(station.code)) knownStations.set(station.code, station);
  }
  for (const schedule of trainSchedules) {
    for (const stop of schedule.stops || []) {
      const code = cleanLocation(stop.stationCode).toUpperCase();
      if (code && !knownStations.has(code)) {
        knownStations.set(code, {
          code,
          name: cleanLocation(stop.stationName) || cleanLocation(stop.city),
          city: cleanLocation(stop.city),
          aliases: [],
        });
      }
    }
  }

  const storedRouteNames = [
    ...buses.flatMap(({ from, to }) => [[from, "Unknown"], [to, "Unknown"]]),
    ...trips.flatMap(({ fromCity, toCity }) => [[fromCity, "Unknown"], [toCity, "Unknown"]]),
    ...routes.flatMap(({ fromCity, toCity }) => [[fromCity, "Unknown"], [toCity, "Unknown"]]),
    ...trains.flatMap(({ from, to }) => [[from, "Unknown"], [to, "Unknown"]]),
    ...hotels.map(({ city }) => [city, "Unknown"]),
    ...[...knownStations.values()].map(({ city }) => [city, "Unknown"]),
    ...trainSchedules.flatMap(({ stops }) => (stops || []).map(({ city }) => [city, "Unknown"])),
  ];
  for (const [name, fallbackState] of storedRouteNames) {
    const rawName = cleanLocation(name);
    const code = rawName.match(/\(([A-Z]{2,5})\)\s*$/i)?.[1]?.toUpperCase();
    const station = code ? knownStations.get(code) : null;
    const cleanName = station?.city || rawName.replace(/\s+\([A-Z]{2,5}\)\s*$/, "");
    if (!cleanName) continue;
    const slug = slugifyCityName(cleanName);
    if (!cityData.has(slug) && !knownAliases.has(cleanName.toLocaleLowerCase("en"))) {
      cityData.set(slug, {
        name: cleanName,
        state: existingCityInfo.get(slug)?.state || fallbackState,
        isPopular: false,
        aliases: [],
      });
    }

    if (code && !knownStations.has(code)) {
      knownStations.set(code, {
        code,
        name: rawName.replace(/\s+\([A-Z]{2,5}\)\s*$/, ""),
        city: cleanName,
        aliases: [],
      });
    }
  }

  const cityOps = [...cityData.values()].map(({ name, state, isPopular, aliases }) => ({
    updateOne: {
      filter: { slug: slugifyCityName(name) },
      update: {
        $setOnInsert: { name, state, active: true },
        $set: {
          slug: slugifyCityName(name),
          aliases,
          isPopular,
          population: existingCityInfo.get(slugifyCityName(name))?.population || 0,
          nameNormalized: name.toLocaleLowerCase("en"),
          aliasesNormalized: aliases.map((alias) => alias.toLocaleLowerCase("en")),
        },
      },
      upsert: true,
    },
  }));
  await City.bulkWrite(cityOps);
  await ensureIndex(City.collection, { slug: 1 }, { unique: true });
  await ensureIndex(City.collection, { nameNormalized: 1 }, { collation: { locale: "en", strength: 2 } });
  await ensureIndex(City.collection, { aliasesNormalized: 1 }, { collation: { locale: "en", strength: 2 } });

  const cityRecords = await City.find({ active: true }).select("_id name slug aliases").lean();
  const cityByName = new Map();
  for (const city of cityRecords) {
    for (const name of [city.name, city.slug, ...(city.aliases || [])]) {
      cityByName.set(name.toLocaleLowerCase("en").trim(), city);
    }
  }
  const stationOps = [...knownStations.values()].map((station) => {
    const city = cityByName.get(cleanLocation(station.city).toLocaleLowerCase("en"));
    if (!city) throw new Error(`No City record matches station ${station.code} city "${station.city}".`);
    return {
      updateOne: {
        filter: { code: station.code },
        update: {
          $setOnInsert: { ...station, isPopular: true, active: true },
          $set: {
            cityId: city._id,
            citySlug: city.slug,
            nameNormalized: station.name.toLocaleLowerCase("en"),
            codeNormalized: station.code.toLocaleLowerCase("en"),
            cityNormalized: station.city.toLocaleLowerCase("en"),
            aliasesNormalized: (station.aliases || []).map((alias) => alias.toLocaleLowerCase("en")),
          },
        },
        upsert: true,
      },
    };
  });
  await Station.bulkWrite(stationOps);
  await ensureIndex(Station.collection, { code: 1 }, { unique: true });
  await ensureIndex(Station.collection, { nameNormalized: 1 });
  await ensureIndex(Station.collection, { codeNormalized: 1 });
  await ensureIndex(Station.collection, { cityNormalized: 1 });
  await ensureIndex(Station.collection, { cityId: 1 });
  await ensureIndex(Station.collection, { citySlug: 1 });
  await ensureIndex(Station.collection, { aliasesNormalized: 1 });

  console.log(`Seeded ${cityData.size} cities and ${knownStations.size} stations.`);
  console.log("The city list is starter seed data; extend scripts/seedCities.js as needed.");
}

seed()
  .catch((error) => {
    console.error("City and station seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
