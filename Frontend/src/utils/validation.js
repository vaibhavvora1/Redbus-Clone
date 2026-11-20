// src/utils/validation.js

/**
 * Validates full name: letters, spaces, minimum 2 characters.
 * Regex: /^[A-Za-z ]{2,}$/
 */
export const validateName = (name) => {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "Full Name is required.",
    };
  }

  const nameRegex = /^[A-Za-z ]{2,}$/;
  if (!nameRegex.test(trimmed)) {
    return {
      isValid: false,
      error: "Please enter a valid name.",
    };
  }

  return { isValid: true, error: "" };
};

/**
 * Validates email format.
 * Regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
 */
export const validateEmail = (email) => {
  const trimmed = (email || "").trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: "Email address is required.",
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return {
      isValid: false,
      error: "Please enter a valid email address.",
    };
  }

  return { isValid: true, error: "" };
};

export const validateOptionalEmail = (email) => {
  const trimmed = (email || "").trim();
  if (!trimmed) {
    return { isValid: true, error: "" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return {
      isValid: false,
      error: "Please enter a valid email address.",
    };
  }

  return { isValid: true, error: "" };
};

/**
 * Validates password:
 * Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character.
 * Regex: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
 */
export const validatePassword = (password) => {
  if (!password) {
    return {
      isValid: false,
      error: "Password is required.",
    };
  }

  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  if (!passwordRegex.test(password)) {
    return {
      isValid: false,
      error:
        "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number and one special character.",
    };
  }

  return { isValid: true, error: "" };
};

/**
 * Validates Indian 10-digit mobile number starting with 6-9.
 * Regex: /^[6-9]\d{9}$/
 */
export const validateMobile = (mobile) => {
  const cleaned = (mobile || "").toString().trim().replace(/\D/g, "");
  if (!cleaned) {
    return {
      isValid: false,
      error: "Mobile number is required.",
    };
  }

  const mobileRegex = /^[6-9]\d{9}$/;
  if (!mobileRegex.test(cleaned)) {
    return {
      isValid: false,
      error: "Please enter a valid 10-digit Indian mobile number.",
    };
  }

  return { isValid: true, error: "" };
};

/**
 * Validates 6-digit OTP.
 * Regex: /^\d{6}$/
 */
export const validateOTP = (otp) => {
  const cleaned = (otp || "").toString().trim();
  if (!cleaned) {
    return {
      isValid: false,
      error: "Please enter the 6-digit OTP.",
    };
  }

  const otpRegex = /^\d{6}$/;
  if (!otpRegex.test(cleaned)) {
    return {
      isValid: false,
      error: "Please enter a valid 6-digit OTP.",
    };
  }

  return { isValid: true, error: "" };
};
