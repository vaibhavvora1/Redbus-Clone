import { addDaysToAppDate, getTodayInAppTZ } from "./timeZone";

function isMissing(value) {
  return value === undefined || value === null || value === "";
}

export function getHotelSearchValues(input = {}) {
  const today = getTodayInAppTZ();
  const checkIn = isMissing(input.checkIn) ? today : String(input.checkIn);
  const checkOut = isMissing(input.checkOut)
    ? addDaysToAppDate(checkIn, 1) || addDaysToAppDate(today, 1)
    : String(input.checkOut);
  return {
    city: isMissing(input.city) ? "" : String(input.city),
    checkIn,
    checkOut,
    guests: isMissing(input.guests) ? "2" : String(input.guests),
    rooms: isMissing(input.rooms) ? "1" : String(input.rooms),
  };
}

export function buildHotelSearchQuery(input = {}) {
  const values = getHotelSearchValues(input);
  const params = new URLSearchParams();
  if (values.city) params.set("city", values.city);
  params.set("checkIn", values.checkIn);
  params.set("checkOut", values.checkOut);
  params.set("guests", values.guests);
  params.set("rooms", values.rooms);
  return `?${params.toString()}`;
}
