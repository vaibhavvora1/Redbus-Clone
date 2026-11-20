// src/pages/SignUp.jsx
import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  validateName,
  validateOTP,
} from "../utils/validation";
import { useAuth } from "../context/AuthContext";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser,
    authLoading,
    sendRegistrationOtp,
    resendRegistrationOtp,
    verifyOtpAndRegister,
  } = useAuth();

  // Step 1: form, Step 2: otp_verify, Step 3: success
  const [step, setStep] = useState("form");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
  });

  const [errors, setErrors] = useState({});
  const [duplicateEmail, setDuplicateEmail] = useState(false);
  const [duplicatePhone, setDuplicatePhone] = useState(false);
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  // OTP State
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otpInputRefs = useRef([]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    const destination = location.state?.from ||
      (String(currentUser.role || "").toUpperCase() === "ADMIN" ? "/admin" : "/");
    navigate(destination, { replace: true });
  }, [authLoading, currentUser, location.state, navigate]);

  // 60-second countdown timer for OTP
  useEffect(() => {
    let timer;
    if (step === "otp_verify" && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const validateEmail = (val) => {
    const trimmed = (val || "").trim();
    if (!trimmed) {
      return { isValid: false, error: "Email address is required." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { isValid: false, error: "Please enter a valid email address." };
    }
    return { isValid: true, error: "" };
  };

  const validateRegistrationPassword = (value) => {
    if (!value) {
      return { isValid: false, error: "Password is required." };
    }
    if (value.length < 6) {
      return { isValid: false, error: "Password must be at least 6 characters." };
    }
    return { isValid: true, error: "" };
  };

  const validateOptionalPhone = (value) => {
    const raw = value.trim();
    if (!raw) return { isValid: true, error: "" };
    let digits = raw.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return /^[6-9]\d{9}$/.test(digits)
      ? { isValid: true, error: "" }
      : { isValid: false, error: "Enter a valid 10-digit Indian mobile number." };
  };

  // Handle field change
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "email") setDuplicateEmail(false);
    if (field === "phone") setDuplicatePhone(false);
    if (touched[field]) {
      validateSingleField(field, value);
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateSingleField(field, formData[field]);
  };

  const validateSingleField = (field, value) => {
    let res = { isValid: true, error: "" };
    if (field === "name") res = validateName(value);
    if (field === "email") res = validateEmail(value);
    if (field === "phone") res = validateOptionalPhone(value);
    if (field === "password") res = validateRegistrationPassword(value);

    setErrors((prev) => ({ ...prev, [field]: res.isValid ? "" : res.error }));
    return res.isValid;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    setTouched({
      name: true,
      email: true,
      password: true,
      phone: true,
    });

    const nameRes = validateName(formData.name);
    const emailRes = validateEmail(formData.email);
    const phoneRes = validateOptionalPhone(formData.phone);
    const passRes = validateRegistrationPassword(formData.password);

    const newErrors = {
      name: nameRes.isValid ? "" : nameRes.error,
      email: emailRes.isValid ? "" : emailRes.error,
      phone: phoneRes.isValid ? "" : phoneRes.error,
      password: passRes.isValid ? "" : passRes.error,
    };

    setErrors(newErrors);
    setDuplicateEmail(false);
    setDuplicatePhone(false);

    if (!nameRes.isValid || !emailRes.isValid || !phoneRes.isValid || !passRes.isValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sendRegistrationOtp({
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone || undefined,
        purpose: "register",
      });
      setIsSubmitting(false);
      setCountdown(res?.cooldown || 60);
      setCanResend(false);
      setOtpError("");
      setStep("otp_verify");
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      setIsSubmitting(false);
      const emailConflict = err.status === 409 && /email/i.test(err.message || "");
      const phoneConflict = err.status === 409 && /phone/i.test(err.message || "");
      setDuplicateEmail(emailConflict);
      setDuplicatePhone(phoneConflict);
      setErrors((prev) => ({
        ...prev,
        ...(phoneConflict ? { phone: err.message } : { email: err.message || "Failed to send verification code." }),
      }));
    }
  };

  // OTP inputs handling
  const handleOtpChange = (index, value) => {
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const next = [...otpDigits];
      next[index] = "";
      setOtpDigits(next);
      return;
    }

    const char = cleaned[cleaned.length - 1];
    const next = [...otpDigits];
    next[index] = char;
    setOtpDigits(next);
    setOtpError("");

    if (index < 5 && char) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .trim()
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || "";
      }
      setOtpDigits(newDigits);
      setOtpError("");
      const focusIndex = Math.min(pasted.length, 5);
      otpInputRefs.current[focusIndex]?.focus();
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const enteredCode = otpDigits.join("");

    const validation = validateOTP(enteredCode);
    if (!validation.isValid) {
      setOtpError(validation.error);
      return;
    }

    setIsSubmitting(true);
    setOtpError("");
    try {
      await verifyOtpAndRegister({
        name: formData.name,
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone || undefined,
        otp: enteredCode,
        purpose: "register",
      });
      setIsSubmitting(false);
      setStep("success");
      setTimeout(() => {
        navigate("/login", {
          state: {
            successMessage:
              "Account registered and verified successfully! You can now sign in.",
            prefillEmail: formData.email,
          },
        });
      }, 2000);
    } catch (err) {
      setIsSubmitting(false);
      setDuplicateEmail(err.status === 409 && /email/i.test(err.message || ""));
      setDuplicatePhone(err.status === 409 && /phone/i.test(err.message || ""));
      setOtpError(err.message || "Invalid or expired OTP. Please try again.");
    }
  };

  const handleResendOTP = async () => {
    if (!canResend) return;
    setIsSubmitting(true);
    setCanResend(false);
    setCountdown(60);
    try {
      const response = await resendRegistrationOtp({
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone || undefined,
        purpose: "register",
      });
      setCountdown(response?.cooldown || 60);
      setCanResend(false);
      setOtpError("");
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      const cooldownRemaining = Number(err.data?.cooldownRemaining);
      if (cooldownRemaining > 0) {
        setCountdown(cooldownRemaining);
      } else {
        setCanResend(true);
      }
      setOtpError(err.message || "Failed to resend OTP. Please wait before retrying.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-8 text-white text-center relative">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl mb-3 shadow-inner">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Create RedBus Account</h1>
          <p className="text-red-100 text-xs mt-1">
            Sign up with your email to book tickets and get exclusive offers
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {/* STEP 1: Registration Form */}
          {step === "form" && (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Field 1: Full Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  1. Full Name <span className="text-red-500">*</span>
                </label>
                <div
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                    errors.name
                      ? "border-red-400 bg-red-50/30"
                      : "border-gray-200 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100"
                  }`}
                >
                  <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    onBlur={() => handleBlur("name")}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                  />
                </div>
                {errors.name && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Field 2: Email Address */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  2. Email Address <span className="text-red-500">*</span>
                </label>
                <div
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                    errors.email
                      ? "border-red-400 bg-red-50/30"
                      : "border-gray-200 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100"
                  }`}
                >
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    onBlur={() => handleBlur("email")}
                    placeholder="name@example.com"
                    className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.email}
                  </p>
                )}
                {duplicateEmail && (
                  <Link
                    to="/login"
                    state={{ prefillEmail: formData.email.trim().toLowerCase() }}
                    className="mt-1 inline-block text-xs font-bold text-red-600 hover:underline"
                  >
                    Go to Login
                  </Link>
                )}
              </div>

              {/* Field 3: Optional phone */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  3. Phone Number <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <div
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                    errors.phone
                      ? "border-red-400 bg-red-50/30"
                      : "border-gray-200 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100"
                  }`}
                >
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    onBlur={() => handleBlur("phone")}
                    placeholder="10-digit mobile number"
                    className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                  />
                </div>
                {errors.phone && (
                  <p className="mt-1 text-xs text-red-600 flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.phone}
                  </p>
                )}
                {duplicatePhone && (
                  <Link
                    to="/login"
                    state={{ prefillEmail: formData.email.trim().toLowerCase() }}
                    className="mt-1 inline-block text-xs font-bold text-red-600 hover:underline"
                  >
                    Go to Login
                  </Link>
                )}
              </div>

              {/* Field 4: Password */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  4. Password <span className="text-red-500">*</span>
                </label>
                <div
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all ${
                    errors.password
                      ? "border-red-400 bg-red-50/30"
                      : "border-gray-200 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100"
                  }`}
                >
                  <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={(e) => handleChange("password", e.target.value)}
                    onBlur={() => handleBlur("password")}
                    placeholder="Create a strong password"
                    className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600 flex items-start gap-1">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span>{errors.password}</span>
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md shadow-red-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending OTP to Email...
                  </span>
                ) : (
                  "Continue to Email OTP Verification"
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">OR</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Google Social OAuth button */}
              <GoogleSignInButton />

              <div className="text-center pt-2">
                <p className="text-xs text-gray-500">
                  Already have an account?{" "}
                  <Link to="/login" className="text-red-600 font-bold hover:underline">
                    Sign In
                  </Link>
                </p>
              </div>
            </form>
          )}

          {/* STEP 2: Email OTP Verification Screen */}
          {step === "otp_verify" && (
            <div className="space-y-5">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Change email or details
              </button>

              <div className="text-center">
                <h2 className="text-lg font-bold text-gray-900">Verify Your Email</h2>
                <p className="text-xs text-gray-500 mt-1">
                  We sent a 6-digit verification code to{" "}
                  <span className="font-bold text-gray-800">{formData.email}</span>
                </p>
              </div>

              {/* 6-digit OTP Boxes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 text-center">
                  Enter 6-Digit Code
                </label>
                <div className="flex justify-between gap-2 sm:gap-2.5" onPaste={handleOtpPaste}>
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border transition-all ${
                        otpError
                          ? "border-red-400 bg-red-50/40 text-red-700"
                          : digit
                          ? "border-red-500 bg-red-50/20 text-gray-900"
                          : "border-gray-200 text-gray-900 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      } outline-none`}
                    />
                  ))}
                </div>
                {otpError && (
                  <p className="mt-2 text-xs text-red-600 text-center flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{otpError}</span>
                  </p>
                )}
                {duplicateEmail && (
                  <Link
                    to="/login"
                    state={{ prefillEmail: formData.email.trim().toLowerCase() }}
                    className="block text-center text-xs font-bold text-red-600 hover:underline"
                  >
                    Go to Login
                  </Link>
                )}
              </div>

              {/* Verify OTP Button */}
              <button
                type="button"
                onClick={handleVerifyOTP}
                disabled={isSubmitting}
                className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md shadow-red-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Verifying OTP...
                  </span>
                ) : (
                  "Verify & Complete Registration"
                )}
              </button>

              {/* Countdown & Resend */}
              <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="text-gray-500 hover:text-gray-700 underline font-medium"
                >
                  Change email
                </button>

                <div>
                  {!canResend && countdown > 0 ? (
                    <span>
                      Resend OTP in{" "}
                      <span className="font-bold text-red-600 font-mono">{countdown}s</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      disabled={isSubmitting}
                      className="text-red-600 font-bold hover:text-red-700 underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Success Screen */}
          {step === "success" && (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full mb-1">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Registration Successful!</h2>
              <p className="text-sm text-gray-600 max-w-xs mx-auto">
                Your email is verified and your account is ready. Redirecting to Login...
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Please wait a moment
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
