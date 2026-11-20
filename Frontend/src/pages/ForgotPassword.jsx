// src/pages/ForgotPassword.jsx
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Mail,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Send,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { forgotPassword, resetPassword } = useAuth();

  // Step 1: "email", Step 2: "verify_reset", Step 3: "success"
  const [step, setStep] = useState("email");

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const [otpBoxes, setOtpBoxes] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const inputRefs = useRef([]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [serverError, setServerError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 60s resend cooldown
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    let timer = null;
    if (step === "verify_reset" && countdown > 0) {
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

  // Step 1: Send Email OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setEmailError("");
    setServerError("");

    const trimmed = (email || "").trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await forgotPassword({ email: trimmed });
      setStep("verify_reset");
      setCountdown(response?.cooldown || 60);
      setCanResend(false);
      setOtpBoxes(["", "", "", "", "", ""]);
      setOtpError("");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setServerError(err.message || "Could not find an account with this email address.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setServerError("");
    setOtpError("");
    setCanResend(false);
    setCountdown(60);
    setIsSubmitting(true);

    try {
      const response = await api.auth.resendOtp({
        email: email.trim().toLowerCase(),
        purpose: "forgot-password",
      });
      setCountdown(response?.cooldown || 60);
    } catch (err) {
      setServerError(err.message || "Failed to resend verification code.");
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

  // 6-box OTP handlers
  const handleOtpChange = (index, value) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const newBoxes = [...otpBoxes];
    newBoxes[index] = char;
    setOtpBoxes(newBoxes);
    setOtpError("");

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpBoxes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split("");
      setOtpBoxes(digits);
      inputRefs.current[5]?.focus();
    }
  };

  // Step 2: Verify OTP & Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setOtpError("");
    setPasswordError("");
    setServerError("");

    const otpCode = otpBoxes.join("");
    if (otpCode.length !== 6) {
      setOtpError("Please enter the complete 6-digit verification code.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match. Please re-enter.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword({
        email: email.trim().toLowerCase(),
        otp: otpCode,
        newPassword,
      });

      setStep("success");
    } catch (err) {
      setServerError(err.message || "Failed to reset password. Please check your OTP code.");
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
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Reset Password</h1>
          <p className="text-xs text-white/80 mt-1">
            {step === "email"
              ? "Enter your registered email to receive a verification code"
              : step === "verify_reset"
              ? "Verify code & choose a secure new password"
              : "Password updated successfully"}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {serverError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* STEP 1: Enter Email */}
          {step === "email" && (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Registered Email Address
                </label>
                <div
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border transition-all ${
                    emailError
                      ? "border-red-400 bg-red-50/30"
                      : "border-gray-200 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100 bg-gray-50/50"
                  }`}
                >
                  <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="email"
                    placeholder="e.g. name@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    className="w-full bg-transparent text-xs text-gray-900 placeholder-gray-400 outline-none font-medium"
                  />
                </div>
                {emailError && (
                  <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {emailError}
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
                    <RefreshCw size={16} className="animate-spin" /> Sending Code...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Send Verification Code
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 transition"
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Verify OTP & Set New Password */}
          {step === "verify_reset" && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="text-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <p className="text-xs text-gray-500">
                  Verification code sent to <span className="font-bold text-gray-800">{email}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-[11px] text-red-600 font-bold hover:underline mt-1"
                >
                  Change email address
                </button>
              </div>

              {/* 6-box OTP */}
              <div>
                <label className="block text-xs font-bold text-gray-700 text-center mb-2">
                  Enter 6-Digit Email Code
                </label>
                <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
                  {otpBoxes.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (inputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-10 h-12 sm:w-11 sm:h-12 text-center text-lg font-black border-2 border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                    />
                  ))}
                </div>
                {otpError && (
                  <p className="text-[11px] text-red-500 text-center mt-1.5 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {otpError}
                  </p>
                )}

                {/* Resend Countdown */}
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

              {/* New Password Inputs */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-red-500 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-red-500 outline-none transition"
                  />
                  {passwordError && (
                    <p className="text-[11px] text-red-500 mt-1">{passwordError}</p>
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
                    <RefreshCw size={16} className="animate-spin" /> Resetting Password...
                  </>
                ) : (
                  "Reset Password"
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition"
                >
                  Change Email Address
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Success State */}
          {step === "success" && (
            <div className="text-center py-4 space-y-5">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Password Updated!</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Your password has been changed successfully. You can now sign in with your new password.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-full text-xs shadow-md transition"
              >
                Sign In to RedBus
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
