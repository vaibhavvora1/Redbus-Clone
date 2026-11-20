import City from "../models/City.js";
import Station from "../models/Station.js";
import Bus from "../models/Bus.js";
import Trip from "../models/Trip.js";
import Route from "../models/Route.js";
import Hotel from "../models/Hotel.js";
import Train from "../models/Train.js";

const MAX_TERM_LENGTH = 80;

export function cleanLocationTerm(value, label) {
  if (value === undefined || value === null || value === "") return "";
  const field = label === "Search query" ? "q" : label === "Destination" ? "city" : label.toLocaleLowerCase("en");
  if (typeof value !== "string") {
    const error = new Error(`${label} must be a plain text value.`);
    error.statusCode = 400;
    error.validationErrors = [{ field, message: error.message }];
    throw error;
  }

  const term = value.trim();
  if (term.length > MAX_TERM_LENGTH || /[\u0000-\u001f\u007f]/.test(term)) {
    const error = new Error(`${label} must be no more than ${MAX_TERM_LENGTH} characters.`);
    error.statusCode = 400;
    error.validationErrors = [{ field, message: error.message }];
    throw error;
  }
  return term;
}

function validationError(message, code, field = "request") {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  error.validationErrors = [{ field, message }];
  return error;
}

export async function resolveCityInput(value, label) {
  const term = cleanLocationTerm(value, label);
  if (!term) return "";
  const normalized = term.toLocaleLowerCase("en");
  const exact = new RegExp(`^${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  const city = await City.findOne({
    active: true,
    $or: [
      { nameNormalized: normalized },
      { aliasesNormalized: normalized },
      { slug: normalized },
      { name: exact },
      { aliases: exact },
    ],
  }).select("name slug");
  if (city) return city.name;

  const [bus, trip, route, hotel, train] = await Promise.all([
    Bus.findOne({ $or: [{ from: exact }, { to: exact }] }).select("from to").lean(),
    Trip.findOne({ $or: [{ fromCity: exact }, { toCity: exact }] }).select("fromCity toCity").lean(),
    Route.findOne({ $or: [{ fromCity: exact }, { toCity: exact }] }).select("fromCity toCity").lean(),
    Hotel.findOne({ city: exact }).select("city").lean(),
    Train.findOne({ $or: [{ from: exact }, { to: exact }] }).select("from to").lean(),
  ]);
  const storedName = [
    bus?.from, bus?.to, trip?.fromCity, trip?.toCity, route?.fromCity,
    route?.toCity, hotel?.city, train?.from, train?.to,
  ].find((candidate) => typeof candidate === "string" && exact.test(candidate));
  if (storedName) return storedName.trim();
  throw validationError(
    `We couldn't match "${term}" to a city or an existing route. Choose a city from the suggestions.`,
    "UNKNOWN_CITY",
    label === "Destination" ? "city" : label.toLocaleLowerCase("en")
  );
}

export async function resolveCityPair(fromValue, toValue) {
  const from = await resolveCityInput(fromValue, "From");
  const to = await resolveCityInput(toValue, "To");
  if (from && to && from.toLocaleLowerCase("en") === to.toLocaleLowerCase("en")) {
    throw validationError("From and To cities must be different.", "SAME_CITY", "to");
  }
  return { from, to };
}

export async function resolveStationInput(value, label) {
  const term = cleanLocationTerm(value, label);
  if (!term) return null;
  const normalized = term.toLocaleLowerCase("en");
  const parsedCode = term.match(/^.+\(([A-Z0-9]{2,6})\)$/i)?.[1]?.toLocaleLowerCase("en");
  const city = await City.findOne({
    active: true,
    $or: [
      { slug: normalized },
      { nameNormalized: normalized },
      { aliasesNormalized: normalized },
    ],
  }).select("name slug").lean();
  if (city) {
    const relatedStations = await Station.find({
      active: true,
      $or: [
        { cityId: city._id },
        { citySlug: city.slug },
        { cityNormalized: city.name.toLocaleLowerCase("en") },
      ],
    }).select("name code city aliases").lean();
    const values = new Set([city.name]);
    for (const relatedStation of relatedStations) {
      [
        relatedStation.name,
        relatedStation.code,
        `${relatedStation.name} (${relatedStation.code})`,
        `${city.name} (${relatedStation.code})`,
        ...(relatedStation.aliases || []),
      ]
        .filter(Boolean)
        .forEach((item) => values.add(item));
    }
    return { type: "city", city: city.name, citySlug: city.slug, values: [...values] };
  }

  const station = await Station.findOne({
    active: true,
    $or: [
      { codeNormalized: normalized },
      ...(parsedCode ? [{ codeNormalized: parsedCode }] : []),
      { nameNormalized: normalized },
      { aliasesNormalized: normalized },
    ],
  })
    .select("name code city cityId citySlug aliases")
    .lean();

  if (station) {
    let city = station.cityId
      ? await City.findById(station.cityId).select("name slug").lean()
      : null;
    if (!city) {
      city = await City.findOne({
        active: true,
        $or: [
          { slug: station.citySlug || "" },
          { nameNormalized: station.city.toLocaleLowerCase("en") },
          { aliasesNormalized: station.city.toLocaleLowerCase("en") },
        ],
      }).select("name slug").lean();
    }
    const cityName = city?.name || station.city;
    const values = [
      station.name,
      station.code,
      `${station.name} (${station.code})`,
      `${cityName} (${station.code})`,
      ...(station.aliases || []),
    ].filter(Boolean);
    return {
      type: "station",
      city: cityName,
      citySlug: city?.slug || station.citySlug || "",
      stationCode: station.code,
      values: [...new Set(values)],
    };
  }

  throw validationError(`Unknown ${label.toLowerCase()} station or city: "${term}".`, "UNKNOWN_STATION", label.toLocaleLowerCase("en"));
}

export async function resolveStationPair(fromValue, toValue) {
  const from = await resolveStationInput(fromValue, "From");
  const to = await resolveStationInput(toValue, "To");
  if (from && to && (
    (from.citySlug && from.citySlug === to.citySlug) ||
    from.city.toLocaleLowerCase("en") === to.city.toLocaleLowerCase("en")
  )) {
    throw validationError("From and To stations must be in different cities.", "SAME_CITY", "to");
  }
  return { from, to };
}

export function locationMatchPatterns(resolvedStation) {
  return resolvedStation.values.map((value) => {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^${escaped}(?:\\s*\\([A-Z0-9]{2,6}\\))?$`, "i");
  });
}
