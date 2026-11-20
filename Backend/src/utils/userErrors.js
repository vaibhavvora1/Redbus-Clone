export function getDuplicateUserConflict(error) {
  if (error?.code !== 11000) return null;
  const fields = Object.keys(error.keyPattern || error.keyValue || {});
  const indexedField = fields[0] || "";

  if (indexedField === "phone" || indexedField === "mobile" || error.message?.includes("phone_1")) {
    return {
      code: "PHONE_ALREADY_REGISTERED",
      message: "This phone number is already registered.",
    };
  }
  if (indexedField === "email" || error.message?.includes("email_1")) {
    return {
      code: "EMAIL_ALREADY_REGISTERED",
      message: "This email address is already registered.",
    };
  }
  if (indexedField === "googleId" || error.message?.includes("googleId_1")) {
    return {
      code: "GOOGLE_ACCOUNT_ALREADY_REGISTERED",
      message: "This Google account is already linked to another user.",
    };
  }
  return {
    code: "DUPLICATE_USER_VALUE",
    message: "A user with one of these details already exists.",
  };
}

export function sendUserError(res, error, fallbackMessage) {
  const conflict = getDuplicateUserConflict(error);
  if (conflict) {
    return res.status(409).json({ success: false, ...conflict });
  }

  const status = error?.name === "ValidationError"
    ? 400
    : Number.isInteger(error?.statusCode) && error.statusCode < 500
      ? error.statusCode
      : 500;
  if (status >= 500) {
    console.error(fallbackMessage, error);
  }
  return res.status(status).json({
    success: false,
    message: status >= 500 ? fallbackMessage : error.message || fallbackMessage,
  });
}
