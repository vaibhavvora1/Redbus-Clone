import City from "../models/City.js";
import Station from "../models/Station.js";
import asyncHandler from "../utils/asyncHandler.js";
import { cleanLocationTerm } from "../utils/locationSearch.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getLimit(value) {
  if (value === undefined || value === "") return 8;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    const error = new Error("Limit must be a number between 1 and 20.");
    error.statusCode = 400;
    throw error;
  }
  return Math.min(20, Math.max(1, Number(value)));
}

function getPlaceType(value) {
  if (value !== "train" && value !== "hotel") {
    const error = new Error("Type must be either train or hotel.");
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase("en");
}

function cityMatchRank(city, query) {
  const name = normalize(city.name);
  const slug = normalize(city.slug);
  const aliases = (city.aliases || []).map(normalize);
  if (name === query || slug === query) return 0;
  if (name.startsWith(query) || slug.startsWith(query)) return 1;
  if (aliases.some((alias) => alias.startsWith(query))) return 2;
  if (name.includes(query) || slug.includes(query) || aliases.some((alias) => alias.includes(query))) return 3;
  return Number.POSITIVE_INFINITY;
}

function stationMatchRank(station, city, query) {
  const name = normalize(station.name);
  const code = normalize(station.code);
  const stationAliases = (station.aliases || []).map(normalize);
  const cityNames = city ? [city.name, city.slug, ...(city.aliases || [])].map(normalize) : [normalize(station.city)];
  if (name === query || code === query) return 0;
  if (name.startsWith(query) || code.startsWith(query)) return 1;
  if (stationAliases.some((alias) => alias.startsWith(query)) ||
      cityNames.some((cityName) => cityName.startsWith(query))) return 2;
  if (name.includes(query) || code.includes(query) ||
      stationAliases.some((alias) => alias.includes(query)) ||
      cityNames.some((cityName) => cityName.includes(query))) return 3;
  return Number.POSITIVE_INFINITY;
}

function sortCities(cities, query) {
  return cities.sort((left, right) => {
    if (query) {
      const rankDifference = cityMatchRank(left, query) - cityMatchRank(right, query);
      if (rankDifference) return rankDifference;
    }
    return Number(right.isPopular) - Number(left.isPopular) ||
      (right.population || 0) - (left.population || 0) ||
      left.name.localeCompare(right.name);
  });
}

function sortStations(stations, cityById, query) {
  return stations.sort((left, right) => {
    if (query) {
      const rankDifference = stationMatchRank(left, cityById.get(String(left.cityId)), query) -
        stationMatchRank(right, cityById.get(String(right.cityId)), query);
      if (rankDifference) return rankDifference;
    }
    const leftCity = cityById.get(String(left.cityId));
    const rightCity = cityById.get(String(right.cityId));
    return Number(right.isPopular) - Number(left.isPopular) ||
      (rightCity?.population || 0) - (leftCity?.population || 0) ||
      left.name.localeCompare(right.name);
  });
}

function cityIsExact(city, query) {
  return normalize(city.name) === query ||
    normalize(city.slug) === query ||
    (city.aliases || []).some((alias) => normalize(alias) === query);
}

async function findCities(query, limit, exactOnly = false) {
  const filter = { active: true };
  if (!query) {
    filter.isPopular = true;
  } else {
    const escaped = escapeRegex(query);
    filter.$or = [
      { nameNormalized: { $regex: escaped } },
      { aliasesNormalized: { $regex: escaped } },
      { slug: { $regex: escaped } },
    ];
  }
  let cities = await City.find(filter)
    .select("name state slug aliases isPopular population +nameNormalized +aliasesNormalized")
    .limit(query ? 500 : 100)
    .lean();
  if (exactOnly) cities = cities.filter((city) => cityIsExact(city, query));
  return sortCities(cities, query).slice(0, limit);
}

function stationIsExact(station, query) {
  const parsedCode = query.match(/^.+\(([a-z0-9]{2,6})\)$/i)?.[1]?.toLocaleLowerCase("en");
  return normalize(station.name) === query ||
    normalize(station.code) === query ||
    normalize(station.city) === query ||
    (parsedCode && normalize(station.code) === parsedCode) ||
    (station.aliases || []).some((alias) => normalize(alias) === query);
}

async function findStations(query, limit, relatedCities = [], exactOnly = false) {
  const filter = { active: true };
  if (!query) {
    filter.isPopular = true;
  } else {
    const escaped = escapeRegex(query);
    const parsedCode = query.match(/^.+\(([a-z0-9]{2,6})\)$/i)?.[1];
    filter.$or = [
      { nameNormalized: { $regex: escaped } },
      { codeNormalized: { $regex: escaped } },
      ...(parsedCode ? [{ codeNormalized: parsedCode }] : []),
      { cityNormalized: { $regex: escaped } },
      { aliasesNormalized: { $regex: escaped } },
      ...(relatedCities.length
        ? [
            { cityId: { $in: relatedCities.map((city) => city._id) } },
            { citySlug: { $in: relatedCities.map((city) => city.slug) } },
          ]
        : []),
    ];
  }
  const [stations, allCities] = await Promise.all([
    Station.find(filter)
      .select("code name city cityId citySlug aliases isPopular +nameNormalized +codeNormalized +cityNormalized +aliasesNormalized")
      .limit(query ? 500 : 100)
      .lean(),
    City.find({ active: true }).select("name state slug aliases isPopular population").lean(),
  ]);
  const cityById = new Map(allCities.map((city) => [String(city._id), city]));
  const cityByName = new Map();
  for (const city of allCities) {
    for (const name of [city.name, city.slug, ...(city.aliases || [])]) {
      cityByName.set(normalize(name), city);
    }
  }
  for (const station of stations) {
    if (!station.cityId) {
      const city = cityByName.get(normalize(station.citySlug || station.city));
      if (city) station.cityId = city._id;
    }
  }
  const filteredStations = exactOnly ? stations.filter((station) => stationIsExact(station, query)) : stations;
  sortStations(filteredStations, cityById, query);
  return { stations: filteredStations.slice(0, limit), cityById, cityByName };
}

function cityResponse(city) {
  return { name: city.name, state: city.state, slug: city.slug };
}

export const getCities = asyncHandler(async (req, res) => {
  const query = normalize(cleanLocationTerm(req.query.q, "Search query"));
  const limit = getLimit(req.query.limit);
  const cities = await findCities(query, limit, req.query.exact === "true");
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  return res.status(200).json({
    success: true,
    count: cities.length,
    data: cities.map(cityResponse),
  });
});

export const getStations = asyncHandler(async (req, res) => {
  const query = normalize(cleanLocationTerm(req.query.q, "Search query"));
  const limit = getLimit(req.query.limit);
  const relatedCities = query ? await findCities(query, 100, req.query.exact === "true") : [];
  const { stations, cityById, cityByName } = await findStations(query, limit, relatedCities, req.query.exact === "true");
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  return res.status(200).json({
    success: true,
    count: stations.length,
    data: stations.map((station) => {
      const cityInfo = cityById.get(String(station.cityId)) ||
        cityByName.get(normalize(station.citySlug || station.city));
      return {
        code: station.code,
        name: station.name,
        city: cityInfo?.name || station.city,
        state: cityInfo?.state || "",
        slug: cityInfo?.slug || station.citySlug || "",
      };
    }),
  });
});

export const getPlaces = asyncHandler(async (req, res) => {
  const type = getPlaceType(req.query.type);
  const query = normalize(cleanLocationTerm(req.query.q, "Search query"));
  if (query.length < 1) {
    const error = new Error("Search query must contain at least one character.");
    error.statusCode = 400;
    throw error;
  }
  const limit = getLimit(req.query.limit);
  if (type === "hotel") {
    const cities = await findCities(query, limit);
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    return res.status(200).json({
      success: true,
      count: cities.length,
      data: cities.map(cityResponse),
    });
  }
  const cities = await findCities(query, 100);
  const cityResults = await findCities(query, limit);
  const { stations, cityById, cityByName } = await findStations(query, 100, cities);
  const results = cityResults.map((city) => ({
    type: "city",
    name: city.name,
    city: city.name,
    state: city.state,
    slug: city.slug,
    isPopular: city.isPopular,
    population: city.population || 0,
    rank: cityMatchRank(city, query),
  }));
  if (type === "train") {
    for (const station of stations) {
      const city = cityById.get(String(station.cityId)) || cityByName.get(normalize(station.citySlug || station.city));
      results.push({
        type: "station",
        name: station.name,
        code: station.code,
        city: city?.name || station.city,
        state: city?.state || "",
        slug: city?.slug || station.citySlug || "",
        isPopular: station.isPopular,
        population: city?.population || 0,
        rank: stationMatchRank(station, city, query),
      });
    }
  }
  results.sort((left, right) =>
    left.rank - right.rank ||
    Number(right.isPopular) - Number(left.isPopular) ||
    right.population - left.population ||
    (left.type === right.type ? 0 : left.type === "station" ? -1 : 1) ||
    left.name.localeCompare(right.name)
  );
  const data = results.slice(0, limit).map((result) => {
    const item = { ...result };
    delete item.rank;
    delete item.isPopular;
    delete item.population;
    return item;
  });
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
  return res.status(200).json({ success: true, count: data.length, data });
});
