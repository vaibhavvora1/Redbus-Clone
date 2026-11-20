// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  /**
   * Check current user session on mount via /api/auth/me
   */
  const checkAuth = useCallback(() =>
    api.auth.getMe()
      .then((res) => {
      if (res && res.success && res.user) {
        setCurrentUser(res.user);
      } else {
        setCurrentUser(null);
      }
      })
      .catch(() => {
        setCurrentUser(null);
      })
      .finally(() => {
        setAuthLoading(false);
      }), []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  /**
   * Login with email or phone + password
   * Supports both login(identifier, password) and login({ identifier, password })
   */
  const login = useCallback(async (arg1, arg2) => {
    try {
      setAuthLoading(true);
      let payload;
      if (typeof arg1 === "object" && arg1 !== null) {
        payload = arg1;
      } else {
        payload = { identifier: arg1, password: arg2 };
      }

      const res = await api.auth.login(payload);
      if (res && res.success && res.user) {
        setCurrentUser(res.user);
        return { success: true, user: res.user };
      }
      return { success: false, error: res?.message || "Login failed" };
    } catch (err) {
      return { success: false, error: err?.message || "Login failed" };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  /**
   * Forgot password: send Email OTP
   */
  const forgotPassword = useCallback(async ({ email, phone, mobile }) => {
    return api.auth.forgotPassword({
      email: email || phone || mobile,
    });
  }, []);

  /**
   * Reset password: verify OTP & set new password
   */
  const resetPassword = useCallback(
    async ({ email, phone, mobile, otp, newPassword }) => {
      return api.auth.resetPassword({
        email: email || phone || mobile,
        otp,
        newPassword,
      });
    },
    []
  );

  /**
   * Send / Generate Email OTP for registration / login
   */
  const sendRegistrationOtp = useCallback(({ email, mobile, phone, purpose = "register" }) =>
    api.auth.sendOtp({ email: email || mobile, phone: phone || mobile, purpose }),
    []);

  const resendRegistrationOtp = useCallback(({ email, mobile, phone, purpose = "register" }) =>
    api.auth.resendOtp({ email: email || mobile, phone: phone || mobile, purpose }),
    []);

  /**
   * Verify OTP and complete registration / login
   */
  const verifyOtpAndRegister = useCallback(async ({ email, otp, name, password, phone, purpose }) => {
    const data = await api.auth.verifyOtp({
      email,
      otp,
      name,
      password,
      phone,
      purpose,
    });
    if (data && data.success && data.user) {
      if (purpose !== "register") setCurrentUser(data.user);
      return data.user;
    }
    throw new Error(data?.message || "Verification failed");
  }, []);

  /**
   * Logout
   */
  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.error("Logout API call failed:", err);
    } finally {
      setCurrentUser(null);
    }
  }, []);

  /**
   * Google OAuth Login / Register
   */
  const loginWithGoogle = useCallback(async (credential) => {
    try {
      setAuthLoading(true);
      const res = await api.auth.googleLogin({ credential });
      if (res && res.success && res.user) {
        setCurrentUser(res.user);
        return { success: true, user: res.user };
      }
      return { success: false, error: res?.message || "Google sign-in failed." };
    } catch (err) {
      return { success: false, error: err.message || "Google sign-in failed." };
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const value = {
    currentUser,
    authLoading,
    checkAuth,
    login,
    sendRegistrationOtp,
    resendRegistrationOtp,
    verifyOtpAndRegister,
    forgotPassword,
    resetPassword,
    logout,
    loginWithGoogle,
    saveVerifiedUser: (user) => verifyOtpAndRegister(user),
    findUserByEmail: (email) => (email ? { email } : null),
    findUserByMobile: (mobile) => (mobile ? { email: mobile } : null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
