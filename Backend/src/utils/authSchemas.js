import { z } from "zod";
import { normalizePhone } from "./userFields.js";

// ── Shared field schemas ────────────────────────────────────────────

export const authEmailSchema = z
  .string({ error: "Email address is required." })
  .trim()
  .toLowerCase()
  .email("Please provide a valid email address.");

/** Indian mobile: 10 digits starting with 6-9 (optional — strips +91/0 prefix) */
const indianPhoneSchema = z
  .string()
  .trim()
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    let digits = val.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return digits;
  })
  .refine(
    (val) => !val || /^[6-9]\d{9}$/.test(val),
    { message: "Please provide a valid 10-digit Indian mobile number (starting with 6-9)." }
  );

// ── Registration ────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z
    .string({ error: "Name is required." })
    .trim()
    .min(1, "Name is required."),
  email: authEmailSchema,
  password: z
    .string({ error: "Password is required." })
    .min(6, "Password must be at least 6 characters."),
  phone: indianPhoneSchema,
});

// ── Login ───────────────────────────────────────────────────────────

export const loginSchema = z
  .object({
    email: authEmailSchema.optional(),
    identifier: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    mobile: z.string().trim().optional(),
    password: z
      .string({ error: "Password is required." })
      .min(1, "Password is required."),
  })
  .superRefine((data, context) => {
    const identity = data.identifier || data.email || data.phone || data.mobile;
    if (!identity) {
      context.addIssue({
        code: "custom",
        path: ["email"],
        message: "Email address or mobile number is required.",
      });
      return;
    }

    if (identity.includes("@")) {
      const emailResult = authEmailSchema.safeParse(identity);
      if (!emailResult.success) {
        context.addIssue({
          code: "custom",
          path: ["email"],
          message:
            emailResult.error.issues[0]?.message ||
            "Please provide a valid email address.",
        });
      }
      return;
    }

    const normalizedPhone = normalizePhone(identity);
    if (!normalizedPhone || !/^\+91[6-9]\d{9}$/.test(normalizedPhone)) {
      context.addIssue({
        code: "custom",
        path: ["identifier"],
        message: "Enter a valid email address or 10-digit mobile number.",
      });
    }
  });

// ── Send OTP ────────────────────────────────────────────────────────

export const sendOtpSchema = z.object({
  email: authEmailSchema,
  phone: indianPhoneSchema,
  purpose: z.enum(["register", "login", "forgot-password"]).optional(),
});

// ── Verify OTP ──────────────────────────────────────────────────────

export const verifyOtpSchema = z
  .object({
    email: authEmailSchema,
    otp: z
      .string({ error: "OTP code is required." })
      .trim()
      .regex(/^\d{6}$/, "OTP must be exactly 6 digits."),
    name: z.string().trim().optional(),
    password: z.string().optional(),
    phone: indianPhoneSchema,
    mobile: indianPhoneSchema,
    purpose: z.enum(["register", "login"]).optional(),
  })
  .superRefine((data, context) => {
    if (data.phone && data.mobile && data.phone !== data.mobile) {
      context.addIssue({
        code: "custom",
        path: ["mobile"],
        message: "Phone and mobile numbers must match.",
      });
    }
  });
