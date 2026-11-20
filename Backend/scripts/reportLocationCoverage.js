import "dotenv/config";
import mongoose from "mongoose";
import City from "../src/models/City.js";
import Station from "../src/models/Station.js";
import Bus from "../src/models/Bus.js";
import Trip from "../src/models/Trip.js";
import Route from "../src/models/Route.js";
import Train from "../src/models/Train.js";
import Hotel from "../src/models/Hotel.js";

const normalize = (value) => String(value || "").trim().toLocaleLowerCase("en");
const cleanStation = (value) => String(value || "").trim().replace(/\s+\([A-Z0-9]{2,6}\)\s*$/, "");

async function report() {
  await mongoose.connect(process.env.MONGODB_URI);
  const [cities, stations, buses, trips, routes, trains, hotels] = await Promise.all([
    City.find().select("name aliases").lean(),
    Station.find().select("name code city aliases").lean(),
    Bus.find().select("from to").lean(),
    Trip.find().select("fromCity toCity").lean(),
    Route.find().select("fromCity toCity").lean(),
    Train.find().select("from to").lean(),
    Hotel.find().select("city").lean(),
  ]);
  const cityNames = new Set(cities.flatMap((city) => [city.name, ...(city.aliases || [])].map(normalize)));
  const stationNames = new Set(stations.flatMap((station) => [
    station.name,
    station.code,
    station.city,
    `${station.name} (${station.code})`,
    `${station.city} (${station.code})`,
    ...(station.aliases || []),
  ].map(normalize)));
  const dbCityValues = new Set([
    ...buses.flatMap(({ from, to }) => [from, to]),
    ...trips.flatMap(({ fromCity, toCity }) => [fromCity, toCity]),
    ...routes.flatMap(({ fromCity, toCity }) => [fromCity, toCity]),
    ...hotels.map(({ city }) => city),
    ...trains.flatMap(({ from, to }) => [from, to].map(cleanStation)),
  ].map((value) => String(value || "").trim()).filter(Boolean));
  const missingCities = [...dbCityValues].filter((value) => !cityNames.has(normalize(value))).sort();
  const dbStationValues = new Set(trains.flatMap(({ from, to }) => [from, to]).map((value) => String(value || "").trim()).filter(Boolean));
  const missingStations = [...dbStationValues].filter((value) => !stationNames.has(normalize(value))).sort();

  console.log(JSON.stringify({
    readOnly: true,
    citiesInDirectory: cities.length,
    stationsInDirectory: stations.length,
    databaseCityValues: dbCityValues.size,
    missingCities,
    trainStationValues: dbStationValues.size,
    missingStations,
  }, null, 2));
}

report()
  .catch((error) => {
    console.error("Location coverage report failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
