/**
 * Frontend API Service
 * Centralized API client for public and admin operations.
 */
import { buildHotelSearchQuery } from "../utils/hotelSearch";

const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_BASE_URL = rawApiUrl.replace(/\/$/, "");

const REMOVED_PUBLIC_OPERATORS = new Set([]);

async function request(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
    credentials: "include", // Send and receive HTTP-only authentication cookies
  };

  try {
    const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data.message || `Request failed with status ${response.status}`,
      );
      error.status = response.status;
      error.data = data;
      error.code = data.code;
      throw error;
    }

    return data;
  } catch (err) {
    // Handle network drops or CORS origin rejections gracefully
    if (err.name === "TypeError" && err.message === "Failed to fetch") {
      const networkError = new Error(
        "Unable to connect to the RedBus server. Please verify that the backend is running and cross-origin access is permitted."
      );
      networkError.status = 0;
      networkError.isNetworkError = true;
      throw networkError;
    }

    // In dev mode, log only non-sensitive operational error summary
    if (import.meta.env.DEV && !err.isNetworkError) {
      console.warn(`[API] ${options.method || "GET"} ${endpoint} -> ${err.message}`);
    }

    throw err;
  }
}

function qs(params = {}) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
  const str = new URLSearchParams(filtered).toString();
  return str ? `?${str}` : "";
}

export const api = {
  // Auth
  auth: {
    sendOtp: (data) =>
      request("/api/auth/send-otp", { method: "POST", body: JSON.stringify(data) }),
    resendOtp: (data) =>
      request("/api/auth/resend-otp", { method: "POST", body: JSON.stringify(data) }),
    verifyOtp: (data) =>
      request("/api/auth/verify-otp", { method: "POST", body: JSON.stringify(data) }),
    login: (credentials, password) => {
      const payload =
        typeof credentials === "object" && credentials !== null
          ? credentials
          : { identifier: credentials, password };
      return request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
    },
    googleLogin: (data) =>
      request("/api/auth/google", { method: "POST", body: JSON.stringify(data) }),
    logout: () => request("/api/auth/logout", { method: "POST" }),
    forgotPassword: (data) =>
      request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(data) }),
    resetPassword: (data) =>
      request("/api/auth/reset-password", { method: "POST", body: JSON.stringify(data) }),
    getMe: () => request("/api/auth/me"),
  },

  // Public Search & Data
  buses: {
    getAll: (params = {}) => request(`/api/buses${qs(params)}`),
    getById: (id) => request(`/api/buses/${id}`),
    getSeats: (tripId) => request(`/api/buses/${tripId}/seats`),
    lockSeats: (tripId, data) =>
      request(`/api/buses/${tripId}/lock-seats`, { method: "POST", body: JSON.stringify(data) }),
    unlockSeats: (tripId, data) =>
      request(`/api/buses/${tripId}/unlock-seats`, { method: "POST", body: JSON.stringify(data) }),
  },

  governmentBuses: {
    getAll: (params = {}) => request(`/api/government-buses${qs(params)}`),
  },

  locations: {
    getCities: (params = {}, options = {}) =>
      request(`/api/cities${qs(params)}`, { signal: options.signal }),
    getStations: (params = {}, options = {}) =>
      request(`/api/stations${qs(params)}`, { signal: options.signal }),
    getPlaces: (params = {}, options = {}) =>
      request(`/api/places${qs(params)}`, { signal: options.signal }),
  },

  trips: {
    getById: (id) => request(`/api/trips/${id}`),
  },

  trains: {
    getAll: (params = {}) => request(`/api/trains${qs(params)}`),
    getById: (id) => request(`/api/trains/${id}`),
    hold: (data, headers = {}) =>
      request("/api/trains/hold", {
        method: "POST",
        body: JSON.stringify(data),
        headers,
      }),
  },

  hotels: {
    getAll: (params = {}) => request(`/api/hotels${buildHotelSearchQuery(params)}`),
    getById: (id, params = {}) => request(`/api/hotels/${id}${buildHotelSearchQuery(params)}`),
    hold: (data, headers = {}) =>
      request("/api/hotels/hold", {
        method: "POST",
        body: JSON.stringify(data),
        headers,
      }),
  },

  operators: {
    getAll: async () => {
      const response = await request("/api/operators");
      return {
        ...response,
        data: (response.data || []).filter(
          (operator) => !REMOVED_PUBLIC_OPERATORS.has(operator.name?.trim().toUpperCase()),
        ),
      };
    },
  },

  promotions: {
    getAll: () => request("/api/promotions"),
  },

  bookings: {
    getAll: (params = {}) => request(`/api/bookings${qs(params)}`),
    getMyBookings: () => request("/api/bookings"),
    getById: (id) => request(`/api/bookings/${id}`),
    getTicketPdfUrl: (id) => `${API_BASE_URL}/api/bookings/${id}/ticket.pdf`,
    downloadTicketPdf: async (id, bookingId) => {
      const response = await fetch(`${API_BASE_URL}/api/bookings/${id}/ticket.pdf`, {
        credentials: "include",
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to download ticket PDF.");
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `redBus_Ticket_${bookingId || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    },
    hold: (data, headers = {}) =>
      request("/api/bookings/hold", {
        method: "POST",
        body: JSON.stringify(data),
        headers,
      }),
    createTravel: (data) =>
      request("/api/bookings/travel", { method: "POST", body: JSON.stringify(data) }),
    create: (data) =>
      request("/api/bookings", { method: "POST", body: JSON.stringify(data) }),
    cancel: (id) =>
      request(`/api/bookings/${id}/cancel`, { method: "PATCH" }),
  },

  // Payments & Razorpay
  payments: {
    createOrder: (data) =>
      request("/api/payment/create-order", { method: "POST", body: JSON.stringify(data) }),
    verify: (data) =>
      request("/api/payment/verify", { method: "POST", body: JSON.stringify(data) }),
  },

  // Protected Admin APIs (RBAC enforced on backend)
  admin: {
    getStats: () => request("/api/admin/stats"),

    users: {
      getAll: (params = {}) => request(`/api/admin/users${qs(params)}`),
      getById: (id) => request(`/api/admin/users/${id}`),
      updateRole: (id, role) =>
        request(`/api/admin/users/${id}/role`, {
          method: "PATCH",
          body: JSON.stringify({ role }),
        }),
      updateBlock: (id, isBlocked) =>
        request(`/api/admin/users/${id}/block`, {
          method: "PATCH",
          body: JSON.stringify({ isBlocked }),
        }),
      delete: (id) => request(`/api/admin/users/${id}`, { method: "DELETE" }),
    },

    bookings: {
      getAll: (params = {}) => request(`/api/admin/bookings${qs(params)}`),
      getById: (id) => request(`/api/admin/bookings/${id}`),
      refund: (id, data = {}) =>
        request(`/api/admin/bookings/${id}/refund`, {
          method: "POST",
          body: JSON.stringify(data),
        }),
      cancel: (id, reason) =>
        request(`/api/admin/bookings/${id}/cancel`, {
          method: "PATCH",
          body: JSON.stringify({ reason }),
        }),
      delete: (id) => request(`/api/admin/bookings/${id}`, { method: "DELETE" }),
    },

    payments: {
      getAll: (params = {}) => request(`/api/admin/payments${qs(params)}`),
      getById: (id) => request(`/api/admin/payments/${id}`),
    },

    buses: {
      getAll: (params = {}) => request(`/api/admin/buses${qs(params)}`),
      getById: (id) => request(`/api/admin/buses/${id}`),
      create: (data) =>
        request("/api/admin/buses", { method: "POST", body: JSON.stringify(data) }),
      update: (id, data) =>
        request(`/api/admin/buses/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id) => request(`/api/admin/buses/${id}`, { method: "DELETE" }),
    },

    trips: {
      getAll: (params = {}) => request(`/api/admin/trips${qs(params)}`),
      getById: (id) => request(`/api/admin/trips/${id}`),
      getSeatMap: (id) => request(`/api/admin/trips/${id}/seat-map`),
      create: (data) =>
        request("/api/admin/trips", { method: "POST", body: JSON.stringify(data) }),
      update: (id, data) =>
        request(`/api/admin/trips/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      cancel: (id) => request(`/api/admin/trips/${id}/cancel`, { method: "PATCH" }),
      delete: (id) => request(`/api/admin/trips/${id}`, { method: "DELETE" }),
    },

    trains: {
      getAll: (params = {}) => request(`/api/admin/trains${qs(params)}`),
      create: (data) =>
        request("/api/admin/trains", { method: "POST", body: JSON.stringify(data) }),
      update: (id, data) =>
        request(`/api/admin/trains/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id) => request(`/api/admin/trains/${id}`, { method: "DELETE" }),
    },

    hotels: {
      getAll: (params = {}) => request(`/api/admin/hotels${qs(params)}`),
      create: (data) =>
        request("/api/admin/hotels", { method: "POST", body: JSON.stringify(data) }),
      update: (id, data) =>
        request(`/api/admin/hotels/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id) => request(`/api/admin/hotels/${id}`, { method: "DELETE" }),
    },

    routes: {
      getAll: (params = {}) => request(`/api/admin/routes${qs(params)}`),
      create: (data) =>
        request("/api/admin/routes", { method: "POST", body: JSON.stringify(data) }),
      update: (id, data) =>
        request(`/api/admin/routes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id) => request(`/api/admin/routes/${id}`, { method: "DELETE" }),
    },

    operators: {
      getAll: (params = {}) => request(`/api/admin/operators${qs(params)}`),
      create: (data) =>
        request("/api/admin/operators", { method: "POST", body: JSON.stringify(data) }),
      update: (id, data) =>
        request(`/api/admin/operators/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id) => request(`/api/admin/operators/${id}`, { method: "DELETE" }),
    },

    promotions: {
      getAll: (params = {}) => request(`/api/admin/promotions${qs(params)}`),
      create: (data) =>
        request("/api/admin/promotions", { method: "POST", body: JSON.stringify(data) }),
      update: (id, data) =>
        request(`/api/admin/promotions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id) => request(`/api/admin/promotions/${id}`, { method: "DELETE" }),
    },

    cities: {
      getAll: (params = {}) => request(`/api/admin/cities${qs(params)}`),
      create: (data) =>
        request("/api/admin/cities", { method: "POST", body: JSON.stringify(data) }),
      update: (id, data) =>
        request(`/api/admin/cities/${id}`, { method: "PUT", body: JSON.stringify(data) }),
      delete: (id) => request(`/api/admin/cities/${id}`, { method: "DELETE" }),
    },

    settings: {
      getProfile: () => request("/api/admin/settings/profile"),
      changePassword: (data) =>
        request("/api/admin/settings/change-password", {
          method: "PUT",
          body: JSON.stringify(data),
        }),
    },
  },
};

export default api;
