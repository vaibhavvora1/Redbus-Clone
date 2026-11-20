const PHONE_E164_PATTERN = /^\+91[6-9]\d{9}$/;

export function normalizePhone(value) {
  if (value === undefined || value === null) return undefined;
  const input = String(value).trim();
  if (!input) return undefined;

  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : input;
}

export function isValidIndianPhone(value) {
  return value === undefined || value === null || value === "" || PHONE_E164_PATTERN.test(value);
}

export function normalizeEmail(value) {
  if (value === undefined || value === null) return undefined;
  const email = String(value).trim().toLowerCase();
  return email || undefined;
}

export function normalizeGoogleId(value) {
  if (value === undefined || value === null) return undefined;
  const googleId = String(value).trim();
  return googleId || undefined;
}

