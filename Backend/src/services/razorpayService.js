import crypto from "crypto";
import Razorpay from "razorpay";

let client = null;

export function isMockPaymentAllowed() {
  return process.env.NODE_ENV !== "production" &&
    (process.env.ALLOW_SANDBOX_PAYMENT === "true" || process.env.ENABLE_MOCK_PAYMENT === "true");
}

export function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  if (!client) client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

export function isValidHmac(message, signature, secret) {
  if (typeof signature !== "string" || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(message).digest();
  let actual;
  try {
    actual = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function createPaymentRefund(payment, amount, notes) {
  if (payment.method === "sandbox" && isMockPaymentAllowed()) {
    return {
      id: `rfnd_sandbox_${crypto.randomBytes(8).toString("hex")}`,
      amount: Math.round(amount * 100),
      status: "processed",
    };
  }

  const gateway = getRazorpayClient();
  if (!gateway || payment.method !== "razorpay" || !payment.razorpayPaymentId) {
    const error = new Error("A configured payment gateway transaction is required for this refund.");
    error.statusCode = 503;
    error.code = "REFUND_GATEWAY_UNAVAILABLE";
    throw error;
  }

  return gateway.payments.refund(payment.razorpayPaymentId, {
    amount: Math.round(amount * 100),
    notes,
  });
}
