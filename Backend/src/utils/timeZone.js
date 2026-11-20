/**
 * Backend Timezone Utilities (Asia/Kolkata default)
 * Single source of truth for all calendar date, departure moment, and comparison operations.
 */

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";
export const BOOKING_CUTOFF_MINUTES = parseInt(process.env.BOOKING_CUTOFF_MINUTES || "0", 10);
export const BOOKING_WINDOW_DAYS = Math.max(1, parseInt(process.env.BOOKING_WINDOW_DAYS || "30", 10));

function isValidCalendarDate(dateStr) {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Add calendar days without relying on the host machine's timezone. */
export function addDaysToAppDate(dateStr, days) {
  if (!isValidCalendarDate(dateStr)) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function getMaxBookingDateInAppTZ(now = new Date(), windowDays = BOOKING_WINDOW_DAYS) {
  return addDaysToAppDate(getTodayInAppTZ(now), windowDays);
}

export function getWeekdayForAppDate(dateStr) {
  if (!isValidCalendarDate(dateStr)) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function validateBookingDate(dateStr, now = new Date()) {
  const today = getTodayInAppTZ(now);
  const maxDate = getMaxBookingDateInAppTZ(now);
  if (!isValidCalendarDate(dateStr) || dateStr < today || dateStr > maxDate) {
    return {
      valid: false,
      code: "DATE_OUT_OF_RANGE",
      message: `Travel date must be between ${today} and ${maxDate}.`,
    };
  }
  return { valid: true, today, maxDate };
}

/**
 * Returns 'YYYY-MM-DD' representing the current calendar date in APP_TIMEZONE.
 * Never use toISOString().split('T')[0] for calendar dates!
 *
 * @param {Date|number|string} [now=new Date()]
 * @param {string} [timeZone=APP_TIMEZONE]
 * @returns {string} e.g. "2026-11-19"
 */
export function getTodayInAppTZ(now = new Date(), timeZone = APP_TIMEZONE) {
  const d = now instanceof Date ? now : new Date(now);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

/**
 * Returns 'YYYY-MM-DD' representing tomorrow's calendar date in APP_TIMEZONE.
 *
 * @param {Date|number|string} [now=new Date()]
 * @param {string} [timeZone=APP_TIMEZONE]
 * @returns {string} e.g. "2026-11-20"
 */
export function getTomorrowInAppTZ(now = new Date(), timeZone = APP_TIMEZONE) {
  return addDaysToAppDate(getTodayInAppTZ(now, timeZone), 1);
}

/**
 * Combines a date string ('YYYY-MM-DD') and time string ('HH:mm') into the exact
 * absolute UTC Date instant in APP_TIMEZONE.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} [timeStr="23:59"] - 'HH:mm'
 * @param {string} [timeZone=APP_TIMEZONE]
 * @returns {Date|null}
 */
export function combineDateAndTime(dateStr, timeStr = "23:59", timeZone = APP_TIMEZONE) {
  if (!isValidCalendarDate(dateStr)) return null;

  const cleanDate = dateStr.trim();
  const cleanTime = (timeStr || "23:59").trim();

  const [y, m, d] = cleanDate.split("-").map(Number);
  const [h, min] = cleanTime.split(":").map(Number);

  if ([y, m, d, h, min].some((value) => !Number.isFinite(value))) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;

  // 1. Initial UTC guess
  const guessUtc = new Date(Date.UTC(y, m - 1, d, h || 0, min || 0, 0));

  // 2. Measure offset of APP_TIMEZONE at this moment using standard Intl
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(guessUtc).map((p) => [p.type, p.value])
  );

  const tzHour = parts.hour === "24" ? 0 : Number(parts.hour);
  const tzAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    tzHour,
    Number(parts.minute),
    Number(parts.second)
  );

  const offsetMs = tzAsUtc - guessUtc.getTime();

  // 3. Absolute moment in UTC
  return new Date(guessUtc.getTime() - offsetMs);
}

/**
 * Single authoritative function deciding whether a trip has already departed.
 * Compares absolute timestamps only (server decides, never client).
 *
 * @param {Object} trip - Trip or bus object containing journeyDate and departureTime (or date & time)
 * @param {Date|number} [now=new Date()] - Reference point in time
 * @param {number} [cutoffMinutes=BOOKING_CUTOFF_MINUTES] - Cutoff window before departure
 * @returns {boolean} true if trip has departed or booking is closed
 */
export function hasDeparted(trip, now = new Date(), cutoffMinutes = BOOKING_CUTOFF_MINUTES) {
  if (!trip) return false;

  if (trip.departureAt) {
    const departureAt = new Date(trip.departureAt).getTime();
    if (Number.isFinite(departureAt)) {
      const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
      const cutoffMs = (Number(cutoffMinutes) || 0) * 60 * 1000;
      return nowMs >= departureAt - cutoffMs;
    }
  }

  const dateStr = trip.travelDate || trip.journeyDate || trip.date;
  const timeStr = trip.departureTime || trip.time;

  if (!dateStr) return false;

  const departureDate = combineDateAndTime(dateStr, timeStr);
  if (!departureDate || isNaN(departureDate.getTime())) return false;

  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const cutoffMs = (Number(cutoffMinutes) || 0) * 60 * 1000;

  return nowMs >= departureDate.getTime() - cutoffMs;
}

/**
 * Format a Date or date string for display in APP_TIMEZONE.
 *
 * @param {Date|string|number} date
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string} e.g. "19 Nov 2026"
 */
export function formatDate(date, options = {}) {
  if (!date) return "";
  let d;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
    d = combineDateAndTime(date.trim(), "12:00");
  } else {
    d = date instanceof Date ? date : new Date(date);
  }
  if (!d || isNaN(d.getTime())) return String(date || "");

  const defaultOpts = {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...options,
  };

  return new Intl.DateTimeFormat("en-IN", defaultOpts).format(d);
}

/**
 * Format a time in APP_TIMEZONE.
 *
 * @param {Date|string|number} date
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string} e.g. "09:30 PM"
 */
export function formatTime(date, options = {}) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date || "");

  const defaultOpts = {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...options,
  };

  return new Intl.DateTimeFormat("en-IN", defaultOpts).format(d);
}

export default {
  APP_TIMEZONE,
  BOOKING_CUTOFF_MINUTES,
  BOOKING_WINDOW_DAYS,
  addDaysToAppDate,
  getMaxBookingDateInAppTZ,
  getWeekdayForAppDate,
  validateBookingDate,
  getTodayInAppTZ,
  getTomorrowInAppTZ,
  combineDateAndTime,
  hasDeparted,
  formatDate,
  formatTime,
};
