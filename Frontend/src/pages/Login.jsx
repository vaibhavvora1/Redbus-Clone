// src/pages/Login.jsx
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  LogIn,
  RefreshCw,
  Send,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser,
    authLoading,
    login,
    sendRegistrationOtp,
    resendRegistrationOtp,
    verifyOtpAndRegister,
  } = useAuth();

  const successMessage = location.state?.successMessage || "";
  const prefill = location.state?.prefillEmail || location.state?.prefillPhone || "";

  // Modes: "password" or "email_otp"
  const [loginMode, setLoginMode] = useState("password");

  // --- Password Mode State ---
  const [formData, setFormData] = useState({
    identifier: prefill,
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Email OTP Mode State ---
  // Steps: "enter_email" | "enter_otp"
  const [otpStep, setOtpStep] = useState("enter_email");
  const [otpEmail, setOtpEmail] = useState(prefill && prefill.includes("@") ? prefill : "");
  const [otpEmailError, setOtpEmailError] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const otpInputRefs = useRef([]);

  useEffect(() => {
    if (authLoading || !currentUser) return;
    const destination = location.state?.from ||
      (String(currentUser.role || "").toUpperCase() === "ADMIN" ? "/admin" : "/");
    navigate(destination, { replace: true });
  }, [authLoading, currentUser, location.state, navigate]);

  // Countdown timer for Email OTP
  useEffect(() => {
    let timer;
    if (loginMode === "email_otp" && otpStep === "enter_otp" && countdown > 0) {
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
  }, [loginMode, otpStep, countdown]);

  // Validation
  const validateIdentifier = (val) => {
    const trimmed = (val || "").trim();
    if (!trimmed) {
      return { isValid: false, error: "Email or mobile number is required." };
    }
    const cleanPhone = trimmed.replace(/[\s()-]/g, "");
    const digits = cleanPhone.startsWith("+91") ? cleanPhone.slice(3) : cleanPhone;
    const isMobile = /^[6-9]\d{9}$/.test(digits);
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

    if (!isMobile && !isEmail) {
      return {
        isValid: false,
        error: "Please enter a valid email address or 10-digit mobile number.",
      };
    }
    return { isValid: true, error: "" };
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setTouched({ identifier: true, password: true });
    setAuthError("");

    const idRes = validateIdentifier(formData.identifier);
    const passRes = formData.password.length >= 6
      ? { isValid: true, error: "" }
      : {
          isValid: false,
          error: formData.password
            ? "Password must be at least 6 characters."
            : "Password is required.",
        };

    setErrors({
      identifier: idRes.isValid ? "" : idRes.error,
      password: passRes.isValid ? "" : passRes.error,
    });

    if (!idRes.isValid || !passRes.isValid) return;

    setIsSubmitting(true);
    const result = await login(formData.identifier, formData.password);
    setIsSubmitting(false);

    if (result.success) {
      const destination = location.state?.from || (result.user?.role === "ADMIN" ? "/admin" : "/");
      navigate(destination, { replace: true });
    } else {
      setAuthError(result.error || "Invalid email/mobile or password.");
    }
  };

  // --- Email OTP Handlers ---
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setOtpEmailError("");
    setAuthError("");

    const trimmed = (otpEmail || "").trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setOtpEmailError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await sendRegistrationOtp({ email: trimmed, purpose: "login" });
      setOtpStep("enter_otp");
      setCountdown(response?.cooldown || 60);
      setCanResend(false);
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpError("");
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setAuthError(err.message || "Failed to send OTP code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setAuthError("");
    setOtpError("");
    setCanResend(false);
    setIsSubmitting(true);

    try {
      const response = await resendRegistrationOtp({ email: otpEmail.trim(), purpose: "login" });
      setCountdown(response?.cooldown || 60);
    } catch (err) {
      setAuthError(err.message || "Failed to resend code.");
      const cooldownRemaining = Number(err.data?.cooldownRemaining);
      if (cooldownRemaining > 0) {
        setCountdown(cooldownRemaining);
      } else {
        setCanResend(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpDigitChange = (index, value) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    setOtpError("");

    if (digit && index < 5) {
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
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const arr = pasted.split("");
      setOtpDigits(arr);
      otpInputRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setOtpError("Please enter all 6 digits of the OTP code.");
      return;
    }

    setIsSubmitting(true);
    setAuthError("");
    try {
      const user = await verifyOtpAndRegister({
        email: otpEmail.trim(),
        otp: code,
        purpose: "login",
      });

      const destination = location.state?.from || (user?.role === "ADMIN" ? "/admin" : "/");
      navigate(destination, { replace: true });
    } catch (err) {
      setOtpError(err.message || "Invalid or expired OTP code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-8 text-white text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl mb-3 shadow-inner">
            <LogIn className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Sign In to RedBus</h1>
          <p className="text-xs text-white/80 mt-1">
            Access your bookings, saved passengers & exclusive offers
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-100 bg-gray-50/70 p-1">
          <button
            type="button"
            onClick={() => {
              setLoginMode("password");
              setAuthError("");
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              loginMode === "password"
                ? "bg-white text-red-600 shadow-xs"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Password Login
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("email_otp");
              setAuthError("");
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 ${
              loginMode === "email_otp"
                ? "bg-white text-red-600 shadow-xs"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Email OTP Login
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {successMessage && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* MODE 1: PASSWORD LOGIN */}
          {loginMode === "password" && (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Email or Mobile Number
                </label>
                <div
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-all ${
                    errors.identifier
                      ? "border-red-400 bg-red-50/30"
                      : "border-gray-200 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100 bg-gray-50/50"
                  }`}
                >
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="text"
                    name="identifier"
                    value={formData.identifier}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, identifier: e.target.value }));
                      setAuthError("");
                      if (touched.identifier) {
                        const res = validateIdentifier(e.target.value);
                        setErrors((p) => ({ ...p, identifier: res.isValid ? "" : res.error }));
                      }
                    }}
                    onBlur={() => {
                      setTouched((p) => ({ ...p, identifier: true }));
                      const res = validateIdentifier(formData.identifier);
                      setErrors((p) => ({ ...p, identifier: res.isValid ? "" : res.error }));
                    }}
                    placeholder="e.g. name@example.com or 9876543210"
                    className="w-full bg-transparent text-xs text-gray-900 placeholder-gray-400 outline-none font-medium"
                  />
                </div>
                {errors.identifier && (
                  <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.identifier}
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-bold text-red-600 hover:text-red-700"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-all ${
                    errors.password
                      ? "border-red-400 bg-red-50/30"
                      : "border-gray-200 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100 bg-gray-50/50"
                  }`}
                >
                  <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData((p) => ({ ...p, password: e.target.value }));
                      setAuthError("");
                      if (touched.password) {
                        setErrors((p) => ({
                          ...p,
                          password: e.target.value.length >= 6
                            ? ""
                            : e.target.value
                              ? "Password must be at least 6 characters."
                              : "Password is required.",
                        }));
                      }
                    }}
                    onBlur={() => {
                      setTouched((p) => ({ ...p, password: true }));
                      setErrors((p) => ({
                        ...p,
                        password: formData.password.length >= 6
                          ? ""
                          : formData.password
                            ? "Password must be at least 6 characters."
                            : "Password is required.",
                      }));
                    }}
                    placeholder="Enter your password"
                    className="w-full bg-transparent text-xs text-gray-900 placeholder-gray-400 outline-none font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.password}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3.5 rounded-full text-xs shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Signing In...
                  </>
                ) : (
                  "Sign In with Password"
                )}
              </button>
            </form>
          )}

          {/* MODE 2: EMAIL OTP LOGIN */}
          {loginMode === "email_otp" && (
            <div>
              {otpStep === "enter_email" ? (
                <form onSubmit={handleSendOtp} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Registered Email Address
                    </label>
                    <div
                      className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-all ${
                        otpEmailError
                          ? "border-red-400 bg-red-50/30"
                          : "border-gray-200 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100 bg-gray-50/50"
                      }`}
                    >
                      <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        type="email"
                        value={otpEmail}
                        onChange={(e) => {
                          setOtpEmail(e.target.value);
                          if (otpEmailError) setOtpEmailError("");
                        }}
                        placeholder="e.g. name@example.com"
                        className="w-full bg-transparent text-xs text-gray-900 placeholder-gray-400 outline-none font-medium"
                      />
                    </div>
                    {otpEmailError && (
                      <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {otpEmailError}
                      </p>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-500">
                    We will send a 6-digit one-time code to your email inbox to verify your identity.
                  </p>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3.5 rounded-full text-xs shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Sending Code...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Send Login Code
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div className="text-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                    <p className="text-xs text-gray-500">
                      Code sent to <span className="font-bold text-gray-800">{otpEmail}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setOtpStep("enter_email")}
                      className="text-[11px] text-red-600 font-bold hover:underline mt-1"
                    >
                      Change email
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 text-center mb-2">
                      Enter 6-Digit Email Code
                    </label>
                    <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                      {otpDigits.map((digit, idx) => (
                        <input
                          key={idx}
                          ref={(el) => (otpInputRefs.current[idx] = el)}
                          type="text"
                          inputMode="numeric"
                          maxLength="1"
                          value={digit}
                          onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          className="w-10 h-12 text-center text-lg font-black border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                        />
                      ))}
                    </div>
                    {otpError && (
                      <p className="text-[11px] text-red-500 text-center mt-1.5 flex items-center justify-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {otpError}
                      </p>
                    )}

                    <div className="text-center mt-3">
                      {canResend ? (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          className="text-xs font-bold text-red-600 hover:text-red-700 transition"
                        >
                          Resend Code
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Resend code in <strong className="text-gray-700">{countdown}s</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3.5 rounded-full text-xs shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
                      </>
                    ) : (
                      "Verify & Sign In"
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">OR</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google OAuth Button */}
          <GoogleSignInButton />

          <div className="text-center pt-2">
            <p className="text-xs text-gray-500">
              Don't have an account?{" "}
              <Link to="/signup" className="text-red-600 font-bold hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
