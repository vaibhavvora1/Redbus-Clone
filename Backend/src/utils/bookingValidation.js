import { z } from "zod";

export const passengerSchema = z.object({
  seatNumber: z.string().trim().min(1, "Seat number is required for each passenger"),
  name: z.string().trim().min(2, "Passenger name must be at least 2 characters"),
  age: z.coerce
    .number()
    .int()
    .min(1, "Passenger age must be at least 1")
    .max(120, "Passenger age must be 120 or less"),
  gender: z.enum(["Male", "Female", "Other"], {
    errorMap: () => ({ message: "Gender must be Male, Female, or Other" }),
  }),
});

export const passengersListSchema = z
  .array(passengerSchema)
  .min(1, "At least one passenger is required");

/**
 * Validates a list of passengers against a canonical sorted list of seat numbers.
 * Enforces:
 * 1. Zod schema validation on every passenger (name, age, gender, seatNumber)
 * 2. Passenger count strictly equals seat count
 * 3. Every seat number is covered exactly once
 */
export function validatePassengersForSeats(passengers, sortedSeatNumbers) {
  if (!Array.isArray(passengers) || passengers.length === 0) {
    return {
      isValid: false,
      message: `Passenger details are required for all ${sortedSeatNumbers.length} seat(s).`,
    };
  }

  if (passengers.length !== sortedSeatNumbers.length) {
    return {
      isValid: false,
      message: `Number of passengers (${passengers.length}) must match number of selected seats (${sortedSeatNumbers.length}).`,
    };
  }

  const parseResult = passengersListSchema.safeParse(passengers);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    return {
      isValid: false,
      message: `Passenger validation error: ${firstIssue?.path?.join(".")} - ${firstIssue?.message}`,
      errors: parseResult.error.issues,
    };
  }

  // Ensure every seat number has a corresponding passenger
  const passengerSeatSet = new Set(passengers.map((p) => String(p.seatNumber).trim()));
  for (const seatNum of sortedSeatNumbers) {
    if (!passengerSeatSet.has(String(seatNum).trim())) {
      return {
        isValid: false,
        message: `Missing passenger details for seat ${seatNum}.`,
      };
    }
  }

  return {
    isValid: true,
    data: parseResult.data,
  };
}

/**
 * Authoritative server-side fare recalculation directly from Trip document.
 * Client-submitted fares are never trusted.
 */
export function calculateServerFares(tripDoc, sortedSeatNumbers) {
  const matchingSeats = (tripDoc.seats || []).filter((s) =>
    sortedSeatNumbers.includes(s.seatNumber)
  );

  const baseFare = matchingSeats.reduce(
    (sum, s) => sum + Number(s.fare || tripDoc.fareOverride || tripDoc.fare || 0),
    0
  );
  const tax = Math.round(baseFare * 0.05); // 5% standard GST
  const totalAmount = baseFare + tax;

  return {
    baseFare,
    tax,
    totalAmount,
  };
}
