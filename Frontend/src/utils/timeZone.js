/**
 * Frontend Timezone Utilities (Asia/Kolkata default)
 * Single source of truth for all calendar dates, min-date constraints, and display formatters.
 */

export const APP_TIMEZONE =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_APP_TIMEZONE) ||
  "Asia/Kolkata";
export const BOOKING_WINDOW_DAYS = Math.max(
  1,
  parseInt(import.meta.env.VITE_BOOKING_WINDOW_DAYS || "30", 10)
);

export function addDaysToAppDate(dateStr, days) {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function getMaxBookingDateInAppTZ(now = new Date()) {
  return addDaysToAppDate(getTodayInAppTZ(now), BOOKING_WINDOW_DAYS);
}

/**
 * Returns 'YYYY-MM-DD' representing the current calendar date in APP_TIMEZONE.
 * Never use new Date().toISOString().split('T')[0]!
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
 * Combines date string ('YYYY-MM-DD') and time string ('HH:mm') into the exact
 * absolute UTC Date instant in APP_TIMEZONE.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} [timeStr="23:59"] - 'HH:mm'
 * @param {string} [timeZone=APP_TIMEZONE]
 * @returns {Date|null}
 */
export function combineDateAndTime(dateStr, timeStr = "23:59", timeZone = APP_TIMEZONE) {
  if (!dateStr || typeof dateStr !== "string") return null;

  const cleanDate = dateStr.trim();
  const cleanTime = (timeStr || "23:59").trim();

  const [y, m, d] = cleanDate.split("-").map(Number);
  const [h, min] = cleanTime.split(":").map(Number);

  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;

  const guessUtc = new Date(Date.UTC(y, m - 1, d, h || 0, min || 0, 0));

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
  return new Date(guessUtc.getTime() - offsetMs);
}

/**
 * Checks whether a trip has already departed.
 * Used on the client purely for UI visual indicators (e.g. greying out past trips).
 * Blocking is always enforced authoritatively by the backend server.
 *
 * @param {Object} trip - Trip object with journeyDate and departureTime
 * @param {Date|number} [now=new Date()]
 * @param {number} [cutoffMinutes=0]
 * @returns {boolean}
 */
export function hasDeparted(trip, now = new Date(), cutoffMinutes = 0) {
  if (!trip) return false;

  const dateStr = trip.journeyDate || trip.date;
  const timeStr = trip.departureTime || trip.time;

  if (!dateStr) return false;

  const departureDate = combineDateAndTime(dateStr, timeStr);
  if (!departureDate || isNaN(departureDate.getTime())) return false;

  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const cutoffMs = (Number(cutoffMinutes) || 0) * 60 * 1000;

  return nowMs >= departureDate.getTime() - cutoffMs;
}

/**
 * Formats a calendar date in APP_TIMEZONE for consistent user display.
 * Prevents UTC day-shifting when formatting a 'YYYY-MM-DD' string.
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
 * Formats a time in APP_TIMEZONE.
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
  getTodayInAppTZ,
  getTomorrowInAppTZ,
  combineDateAndTime,
  hasDeparted,
  formatDate,
  formatTime,
};
