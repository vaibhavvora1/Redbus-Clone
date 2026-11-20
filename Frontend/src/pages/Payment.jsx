import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { useBooking } from "../context/BookingContext";
import { useAuth } from "../context/AuthContext";
import BookingStepper from "../components/BookingStepper";
import {
  CreditCard,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ChevronRight,
  Clock,
  AlertCircle,
  ArrowLeft,
  Smartphone,
  Loader2,
} from "lucide-react";

export default function Payment() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    trip: contextTrip,
    selectedSeats: contextSeats,
    passengers: contextPassengers,
    contact: contextContact,
    boardingPoint: contextBoarding,
    droppingPoint: contextDropping,
    fareSummary: contextFareSummary,
    holdExpiresAt,
    setConfirmedBooking,
    setStep,
  } = useBooking();

  // Retrieve passenger details from context or router state or sessionStorage fallback.
  const passenger =
    (contextPassengers && contextPassengers.length > 0 && contextPassengers[0]) ||
    location.state?.passenger ||
    (() => {
      try {
        const saved = sessionStorage.getItem("redbus_passenger_details");
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    })();

  const allPassengers =
    contextPassengers && contextPassengers.length > 0
      ? contextPassengers
      : passenger
      ? [passenger]
      : [];

  const trip = contextTrip || location.state?.trip || null;
  const tripSeatsList =
    contextSeats && contextSeats.length > 0
      ? contextSeats
      : Array.isArray(trip?.seats)
      ? trip.seats
      : trip?.seats
      ? String(trip.seats).split(",").map((s) => s.trim())
      : [];
  const tripSeats = tripSeatsList.join(", ");

  const tripTitle =
    trip?.title ||
    (trip?.fromCity && trip?.toCity
      ? `${trip.fromCity} → ${trip.toCity}`
      : trip?.from && trip?.to
      ? `${trip.from} → ${trip.to}`
      : "");
  const tripOperator = trip?.operator || trip?.busName || "";

  const totalAmount = Number(
    contextFareSummary?.totalAmount ?? trip?.totalFare ?? trip?.price ?? 0
  );

  // Selected Payment Method: "upi" | "credit" | "debit" | "netbanking"
  const [activeMethod, setActiveMethod] = useState("upi");

  // Form states
  // UPI
  const [upiId, setUpiId] = useState("");
  const [upiError, setUpiError] = useState("");
  const [selectedUpiApp, setSelectedUpiApp] = useState("gpay");

  // Card
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardErrors, setCardErrors] = useState({});

  // Net Banking
  const [selectedBank, setSelectedBank] = useState("HDFC");

  // Payment UI state: "idle" | "processing" | "success" | "sandbox_prompt"
  const [paymentStatus, setPaymentStatus] = useState("idle");
  const [paymentError, setPaymentError] = useState("");
  const [sandboxOrderData, setSandboxOrderData] = useState(null);

  // Live Seat Hold Countdown Timer (defaults to 10 minutes if no server time)
  const [holdTimeLeft, setHoldTimeLeft] = useState(() => {
    if (!holdExpiresAt) return 600;
    const diff = Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    if (!holdExpiresAt) return;
    const interval = setInterval(() => {
      const diff = Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setHoldTimeLeft(0);
        clearInterval(interval);
      } else {
        setHoldTimeLeft(diff);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [holdExpiresAt]);

  const holdMinutes = Math.floor(holdTimeLeft / 60);
  const holdSeconds = holdTimeLeft % 60;
  const isHoldExpired = holdTimeLeft <= 0 && Boolean(holdExpiresAt);

  // Dynamically load Razorpay SDK
  useEffect(() => {
    const scriptId = "razorpay-checkout-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Format Card Number (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
    setCardNumber(formatted);
    if (cardErrors.cardNumber) {
      setCardErrors((prev) => ({ ...prev, cardNumber: "" }));
    }
  };

  // Format Expiry (MM/YY)
  const handleExpiryChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      setExpiry(`${raw.slice(0, 2)}/${raw.slice(2)}`);
    } else {
      setExpiry(raw);
    }
    if (cardErrors.expiry) {
      setCardErrors((prev) => ({ ...prev, expiry: "" }));
    }
  };

  // Complete booking confirmation via backend API
  const confirmBookingWithBackend = async (verifyPayload) => {
    setPaymentStatus("processing");
    try {
      const res = await api.payments.verify({
        ...verifyPayload,
        tripId: trip?._id || trip?.id,
        selectedSeats: tripSeatsList,
        passengers: allPassengers,
        contact: {
          phone: contextContact?.phone || passenger?.phone || currentUser?.phone || currentUser?.mobile || "",
          email: contextContact?.email || passenger?.email || currentUser?.email || "",
        },
        boardingPoint: contextBoarding || trip?.boardingPoint || "",
        droppingPoint: contextDropping || trip?.droppingPoint || "",
        fareSummary: {
          totalAmount,
          baseFare: contextFareSummary?.baseFare || totalAmount,
          tax: contextFareSummary?.tax || 0,
        },
      });

      const confirmed = res.booking || res.data;
      const refId = confirmed.bookingId || `RDB-${String(confirmed._id).slice(-6).toUpperCase()}`;
      setConfirmedBooking(confirmed);
      setPaymentStatus("success");
      setStep(5);

      // Auto-navigate to ticket confirmation page after a short preview
      setTimeout(() => {
        navigate(`/booking/confirmation/${refId}`);
      }, 1500);
    } catch (err) {
      console.error("Booking verification failed:", err);
      setPaymentError(err.message || "Could not confirm booking on server.");
      setPaymentStatus("idle");
    }
  };

  // Handle Pay Now click
  const handlePayNow = async (e) => {
    e?.preventDefault();
    if (
      !trip ||
      !tripTitle ||
      !tripOperator ||
      tripSeatsList.length === 0 ||
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0
    ) {
      setPaymentError("Trip, passenger, seat, date, or fare details are missing.");
      return;
    }
    setPaymentError("");

    // Validate active method
    if (activeMethod === "upi") {
      if (!upiId && !selectedUpiApp) {
        setUpiError("Please enter a valid UPI ID or select a UPI app");
        return;
      }
      if (upiId && !upiId.includes("@")) {
        setUpiError("Enter a valid UPI ID with @ symbol (e.g. name@okaxis)");
        return;
      }
      setUpiError("");
    } else if (activeMethod === "credit" || activeMethod === "debit") {
      const errs = {};
      const rawNum = cardNumber.replace(/\s/g, "");
      if (!rawNum || rawNum.length < 15) {
        errs.cardNumber = "Enter valid 16-digit card number";
      }
      if (!cardHolder.trim()) {
        errs.cardHolder = "Enter cardholder name";
      }
      if (!expiry || expiry.length < 5) {
        errs.expiry = "Enter MM/YY";
      }
      if (!cvv || cvv.length < 3) {
        errs.cvv = "Enter CVV";
      }

      if (Object.keys(errs).length > 0) {
        setCardErrors(errs);
        return;
      }
      setCardErrors({});
    }

    setPaymentStatus("processing");

    try {
      // 1. Create order on backend
      const orderRes = await api.payments.createOrder({
        amount: totalAmount,
        tripId: trip?._id || trip?.id,
        seats: tripSeatsList,
      });

      // 2. Check if Sandbox Mode
      if (orderRes.sandbox || !window.Razorpay) {
        setSandboxOrderData(orderRes);
        setPaymentStatus("sandbox_prompt");
        return;
      }

      // 3. Launch Real Razorpay Modal
      const options = {
        key: orderRes.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderRes.amount,
        currency: orderRes.currency || "INR",
        name: "RedBus Clone",
        description: `${tripTitle} • Seats: ${tripSeats}`,
        image: "/redbuslogo.png",
        order_id: orderRes.orderId,
        prefill: {
          name: allPassengers[0]?.name || currentUser?.name || "Traveler",
          email: contextContact?.email || currentUser?.email || "traveler@redbus.com",
          contact: contextContact?.phone || currentUser?.phone || currentUser?.mobile || "9876543210",
        },
        theme: {
          color: "#dc2626",
        },
        handler: async function (response) {
          await confirmBookingWithBackend({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            sandbox: false,
          });
        },
        modal: {
          ondismiss: function () {
            setPaymentStatus("idle");
            setPaymentError("Payment was cancelled. Your seat lock is active for a few more minutes.");
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on("payment.failed", function (response) {
        setPaymentStatus("idle");
        setPaymentError(response.error?.description || "Payment failed at gateway. Please try again.");
      });
      rzpInstance.open();
    } catch (err) {
      console.error("Order creation failed:", err);
      // Fallback to sandbox simulation if Razorpay fails
      setSandboxOrderData({ orderId: `order_sandbox_${Date.now()}` });
      setPaymentStatus("sandbox_prompt");
    }
  };

  if (
    !trip ||
    !tripTitle ||
    !tripOperator ||
    tripSeatsList.length === 0 ||
    !Number.isFinite(totalAmount) ||
    totalAmount <= 0
  ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900">Booking Details Incomplete</h1>
          <p className="text-sm text-gray-500 mt-2">
            A valid trip, seats, and fare are required to continue to payment.
          </p>
          <Link
            to="/busListing"
            className="inline-block mt-5 bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-full text-sm shadow-sm transition"
          >
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Stepper */}
      <BookingStepper currentStep={4} />

      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb & Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-3">
            <Link to="/" className="hover:text-red-600 transition">
              Home
            </Link>
            <ChevronRight size={14} />
            <Link to="/seats" className="hover:text-red-600 transition">
              Seats
            </Link>
            <ChevronRight size={14} />
            <Link to="/passenger-details" className="hover:text-red-600 transition">
              Passenger Details
            </Link>
            <ChevronRight size={14} />
            <span className="text-red-600 font-bold">Payment</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                  Complete Payment
                </h1>
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                  <Lock size={12} /> 100% Secure
                </span>
                {/* Hold Countdown Pill */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    holdTimeLeft < 60
                      ? "countdown-urgent bg-red-50 text-red-700 border-red-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                  title="Time remaining before seats are released"
                >
                  <Clock size={13} className={holdTimeLeft < 60 ? "text-red-600" : "text-amber-600"} />
                  <span>
                    Seats held: {String(holdMinutes).padStart(2, "0")}:{String(holdSeconds).padStart(2, "0")}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Choose your preferred payment method via Razorpay Checkout
              </p>
            </div>

            <Link
              to="/passenger-details"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 py-2.5 px-4 rounded-xl transition w-fit cursor-pointer"
            >
              <ArrowLeft size={14} />
              Edit Passenger Details
            </Link>
          </div>
        </div>

        {/* Expired Hold Notice */}
        {isHoldExpired && (
          <div className="mb-6 p-5 bg-red-50 border border-red-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-red-800 toast-enter">
            <div className="flex items-center gap-3">
              <AlertCircle size={24} className="text-red-600 shrink-0" />
              <div>
                <span className="font-bold text-sm block">Seat Hold Expired</span>
                <p className="text-xs text-red-700 mt-0.5">
                  Your 10-minute temporary seat reservation has expired. Please re-select your seats to complete your booking.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(trip?._id ? `/booking/${trip._id}` : "/seats")}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 py-2.5 rounded-full transition shadow-xs w-fit cursor-pointer"
            >
              Re-select Seats
            </button>
          </div>
        )}

        {/* Sandbox Mode Confirmation Modal / Card */}
        {paymentStatus === "sandbox_prompt" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="modal-enter bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center">
              <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={32} />
              </div>
              <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 font-bold text-xs rounded-full uppercase tracking-wider mb-2">
                Sandbox Mode Active
              </span>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Simulated Razorpay Gateway
              </h2>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                No live payment credentials detected. You can safely simulate a successful test payment to confirm your booking and generate the official QR ticket.
              </p>

              <div className="bg-gray-50 rounded-xl p-3 text-xs mb-6 text-left space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Payable Amount:</span>
                  <span className="font-bold text-gray-900">₹{totalAmount}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Order Reference:</span>
                  <span className="font-mono text-gray-700 text-[11px]">
                    {sandboxOrderData?.orderId || "order_sandbox"}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() =>
                    confirmBookingWithBackend({
                      razorpay_order_id: sandboxOrderData?.orderId || `order_sandbox_${Date.now()}`,
                      razorpay_payment_id: `pay_sandbox_${Date.now()}`,
                      sandbox: true,
                    })
                  }
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-full text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={18} /> Simulate Successful Payment
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentStatus("idle");
                    setPaymentError("Simulated payment failed or was cancelled.");
                  }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-full text-xs transition"
                >
                  Cancel / Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {paymentError && (
            <div
              className="lg:col-span-12 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2"
              role="alert"
            >
              <AlertCircle size={18} />
              <span>{paymentError}</span>
            </div>
          )}

          {/* LEFT: Payment Methods (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 sm:p-8">
              <div className="flex items-center justify-between pb-5 border-b border-gray-100 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Choose Payment Method</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Safe, encrypted & instant checkout with Razorpay
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full">
                  <ShieldCheck size={14} />
                  <span>Razorpay Verified</span>
                </div>
              </div>

              {/* Payment Method Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
                {/* UPI Tab */}
                <button
                  type="button"
                  onClick={() => setActiveMethod("upi")}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    activeMethod === "upi"
                      ? "border-red-600 bg-red-50/50 text-red-700 font-bold shadow-xs ring-1 ring-red-600"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold"
                  }`}
                >
                  <Smartphone
                    size={22}
                    className={activeMethod === "upi" ? "text-red-600" : "text-gray-500"}
                  />
                  <span className="text-xs mt-1.5">UPI</span>
                  <span className="text-[10px] text-emerald-600 font-bold">Fastest</span>
                </button>

                {/* Credit Card Tab */}
                <button
                  type="button"
                  onClick={() => setActiveMethod("credit")}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    activeMethod === "credit"
                      ? "border-red-600 bg-red-50/50 text-red-700 font-bold shadow-xs ring-1 ring-red-600"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold"
                  }`}
                >
                  <CreditCard
                    size={22}
                    className={activeMethod === "credit" ? "text-red-600" : "text-gray-500"}
                  />
                  <span className="text-xs mt-1.5">Credit Card</span>
                  <span className="text-[10px] text-gray-400">All banks</span>
                </button>

                {/* Debit Card Tab */}
                <button
                  type="button"
                  onClick={() => setActiveMethod("debit")}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    activeMethod === "debit"
                      ? "border-red-600 bg-red-50/50 text-red-700 font-bold shadow-xs ring-1 ring-red-600"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold"
                  }`}
                >
                  <CreditCard
                    size={22}
                    className={activeMethod === "debit" ? "text-red-600" : "text-gray-500"}
                  />
                  <span className="text-xs mt-1.5">Debit Card</span>
                  <span className="text-[10px] text-gray-400">RuPay / Visa</span>
                </button>

                {/* Net Banking Tab */}
                <button
                  type="button"
                  onClick={() => setActiveMethod("netbanking")}
                  className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    activeMethod === "netbanking"
                      ? "border-red-600 bg-red-50/50 text-red-700 font-bold shadow-xs ring-1 ring-red-600"
                      : "border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold"
                  }`}
                >
                  <Building2
                    size={22}
                    className={activeMethod === "netbanking" ? "text-red-600" : "text-gray-500"}
                  />
                  <span className="text-xs mt-1.5">Net Banking</span>
                  <span className="text-[10px] text-gray-400">Popular banks</span>
                </button>
              </div>

              {/* METHOD 1: UPI */}
              {activeMethod === "upi" && (
                <div className="space-y-5">
                  <label className="block text-xs font-bold text-gray-700">Select UPI App</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: "gpay", name: "Google Pay" },
                      { id: "phonepe", name: "PhonePe" },
                      { id: "paytm", name: "Paytm UPI" },
                      { id: "other", name: "Other UPI ID" },
                    ].map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => setSelectedUpiApp(app.id)}
                        className={`p-3 rounded-xl border text-xs font-semibold text-center transition ${
                          selectedUpiApp === app.id
                            ? "border-red-600 bg-red-50/50 text-red-700 ring-1 ring-red-600"
                            : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        {app.name}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Enter UPI VPA / ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. mobile@upi or name@okaxis"
                      value={upiId}
                      onChange={(e) => {
                        setUpiId(e.target.value);
                        if (upiError) setUpiError("");
                      }}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
                    />
                    {upiError && <p className="text-[11px] text-red-500 mt-1">{upiError}</p>}
                  </div>
                </div>
              )}

              {/* METHOD 2 & 3: Credit / Debit Card */}
              {(activeMethod === "credit" || activeMethod === "debit") && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      maxLength="19"
                      placeholder="XXXX XXXX XXXX XXXX"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
                    />
                    {cardErrors.cardNumber && (
                      <p className="text-[11px] text-red-500 mt-1">{cardErrors.cardNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      placeholder="Name printed on card"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
                    />
                    {cardErrors.cardHolder && (
                      <p className="text-[11px] text-red-500 mt-1">{cardErrors.cardHolder}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Expiry Date
                      </label>
                      <input
                        type="text"
                        maxLength="5"
                        placeholder="MM/YY"
                        value={expiry}
                        onChange={handleExpiryChange}
                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
                      />
                      {cardErrors.expiry && (
                        <p className="text-[11px] text-red-500 mt-1">{cardErrors.expiry}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        CVV / CVC
                      </label>
                      <input
                        type="password"
                        maxLength="4"
                        placeholder="•••"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
                      />
                      {cardErrors.cvv && (
                        <p className="text-[11px] text-red-500 mt-1">{cardErrors.cvv}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* METHOD 4: Net Banking */}
              {activeMethod === "netbanking" && (
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-gray-700">Popular Banks</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {["HDFC", "SBI", "ICICI", "Axis"].map((bank) => (
                      <button
                        key={bank}
                        type="button"
                        onClick={() => setSelectedBank(bank)}
                        className={`p-3 rounded-xl border text-xs font-semibold text-center transition ${
                          selectedBank === bank
                            ? "border-red-600 bg-red-50/50 text-red-700 ring-1 ring-red-600"
                            : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        {bank} Bank
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pay Button */}
              <div className="mt-8 border-t border-gray-100 pt-6">
                <button
                  type="button"
                  disabled={paymentStatus === "processing" || isHoldExpired}
                  onClick={handlePayNow}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-extrabold py-4 px-6 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 text-base cursor-pointer"
                >
                  {paymentStatus === "processing" ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Securing Booking...
                    </>
                  ) : (
                    <>Pay ₹{totalAmount} with Razorpay</>
                  )}
                </button>
                <p className="text-[11px] text-center text-gray-400 mt-3 flex items-center justify-center gap-1">
                  <Lock size={12} /> By clicking Pay, you agree to RedBus terms of service
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT: Booking Summary Card (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 sm:p-7 sticky top-40">
              <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4">
                Booking Details
              </h3>

              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-gray-400 block font-medium">Bus Operator</span>
                  <span className="text-sm font-bold text-gray-900">{tripOperator}</span>
                  <span className="text-gray-500 block text-[11px]">{trip.busType || trip.type}</span>
                </div>

                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">From</span>
                    <span className="font-bold text-gray-800">{trip.fromCity || trip.from}</span>
                  </div>
                  <div className="text-gray-400 font-bold">→</div>
                  <div className="text-right">
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">To</span>
                    <span className="font-bold text-gray-800">{trip.toCity || trip.to}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-gray-700">
                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Date</span>
                    <span className="font-semibold">{trip.travelDate || trip.date || trip.journeyDate}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Departure</span>
                    <span className="font-semibold">{trip.departureTime || trip.time}</span>
                  </div>
                </div>

                <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-100 flex justify-between items-center font-bold">
                  <span>Selected Seats:</span>
                  <span>{tripSeats}</span>
                </div>

                {allPassengers.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <span className="text-gray-400 block text-[10px] font-bold uppercase mb-1">
                      Passengers
                    </span>
                    <ul className="space-y-1">
                      {allPassengers.map((p, i) => (
                        <li key={i} className="flex justify-between text-gray-700">
                          <span>{p.name || `Passenger ${i + 1}`}</span>
                          <span className="text-gray-400">
                            {p.age ? `${p.age}y` : ""} {p.gender ? `(${p.gender[0]})` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Fare Breakdown */}
              <div className="border-t border-gray-200 mt-6 pt-4 space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Base Fare</span>
                  <span className="font-semibold text-gray-900">
                    ₹{contextFareSummary?.baseFare || totalAmount}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>GST & Service Taxes (5%)</span>
                  <span className="font-semibold text-gray-900">
                    ₹{contextFareSummary?.tax || 0}
                  </span>
                </div>
                <div className="flex justify-between text-base font-black text-gray-900 border-t border-gray-200 pt-3">
                  <span>Total Payable</span>
                  <span className="text-red-600">₹{totalAmount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
