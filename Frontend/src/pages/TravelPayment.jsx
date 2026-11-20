import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, Clock, Loader2, Lock, ShieldCheck } from "lucide-react";
import api from "../services/api";
import { formatTime } from "../utils/timeZone";

function readPaymentContext(bookingId) {
  try {
    const value = sessionStorage.getItem(`travel-payment:${bookingId}`);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

export default function TravelPayment() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const stored = useMemo(() => readPaymentContext(bookingId), [bookingId]);
  const [booking, setBooking] = useState(null);
  const [order, setOrder] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(() => stored.holdExpiresAt
    ? Math.max(0, Math.floor((new Date(stored.holdExpiresAt).getTime() - Date.now()) / 1000))
    : 0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [sandboxPrompt, setSandboxPrompt] = useState(false);
  useEffect(() => {
    let active = true;
    api.bookings.getById(bookingId)
      .then((response) => active && setBooking(response.data || response.booking))
      .catch((err) => active && setError(err.message || "Could not load booking details."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [bookingId]);

  useEffect(() => {
    if (window.Razorpay) {
      return undefined;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onerror = () => setError("Razorpay Checkout could not be loaded. Check your connection and retry.");
    document.body.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!stored.holdExpiresAt) return undefined;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(stored.holdExpiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [stored.holdExpiresAt]);

  const verify = async (result) => {
    setProcessing(true);
    setError("");
    try {
      const response = await api.payments.verify({
        ...result,
        bookingType: booking.bookingType,
        bookingId: booking._id,
      });
      if (response.pending) {
        setError(response.message || "Payment is still processing. Retry in a moment.");
        return;
      }
      sessionStorage.removeItem(`travel-payment:${bookingId}`);
      navigate(`/travel-booking/confirmation/${booking.bookingId || booking._id}`, { replace: true });
    } catch (err) {
      setError(err.message || "Could not verify payment. Retry without closing this page.");
    } finally {
      setProcessing(false);
    }
  };

  const pay = async () => {
    if (!booking || processing) return;
    if (secondsLeft === 0 && stored.holdExpiresAt) {
      setError("The booking hold has expired. Return to search and reserve again.");
      return;
    }
    setProcessing(true);
    setError("");
    try {
      const response = await api.payments.createOrder({
        bookingType: booking.bookingType,
        bookingId: booking._id,
        holdId: booking.holdId || stored.holdId,
      });
      setOrder(response);
      if (response.sandbox) {
        setSandboxPrompt(true);
        setProcessing(false);
        return;
      }
      if (!window.Razorpay) {
        throw new Error("Razorpay Checkout is not ready. Retry in a moment.");
      }
      const checkout = new window.Razorpay({
        key: response.keyId,
        amount: response.amount,
        currency: response.currency || "INR",
        name: "RedBus Clone",
        description: booking.title || `${booking.bookingType} booking`,
        order_id: response.orderId,
        prefill: {
          name: booking.userName || "",
          email: booking.userEmail || "",
          contact: booking.userPhone || "",
        },
        theme: { color: "#dc2626" },
        handler: (result) => verify(result),
        modal: {
          ondismiss: () => setError("Payment window closed. Your hold remains active until it expires."),
        },
      });
      checkout.on("payment.failed", (result) => {
        setError(result.error?.description || "Payment failed. Retry while the hold is active.");
        setProcessing(false);
      });
      setProcessing(false);
      checkout.open();
    } catch (err) {
      setProcessing(false);
      setError(err.message || "Could not create a payment order.");
    }
  };

  if (loading) return (
    <main className="min-h-screen bg-gray-50 px-4 py-10" role="status" aria-label="Loading payment">
      <div className="mx-auto max-w-3xl space-y-4 rounded-3xl border bg-white p-8">
        <div className="skeleton h-8 w-2/3 rounded-xl" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-12 rounded-full" />
      </div>
    </main>
  );
  if (!booking) return <div className="mx-auto my-12 max-w-xl rounded-2xl bg-red-50 p-6 text-red-700" role="alert">{error || "Booking not found."}</div>;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isHotel = booking.bookingType === "hotel";
  const title = isHotel ? booking.operator : booking.title;
  const dateDescription = isHotel
    ? `${booking.checkIn} to ${booking.checkOut}`
    : `${booking.date} · ${booking.departureAt ? formatTime(booking.departureAt) : booking.time}`;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-3xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-red-600">Secure payment</p>
            <h1 className="mt-1 text-2xl font-extrabold">Complete your {booking.bookingType} booking</h1>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-bold ${secondsLeft < 60 ? "countdown-urgent bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
            <Clock size={16} /> Hold: {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
        </div>
        <div className="mt-6 rounded-2xl bg-gray-50 p-5">
          <p className="font-bold">{title}</p>
          <p className="mt-1 text-sm text-gray-600">{dateDescription}</p>
          <p className="mt-4 text-3xl font-extrabold">₹{Number(booking.totalAmount || booking.amount).toLocaleString("en-IN")}</p>
          <p className="mt-1 text-xs text-gray-500">The server-calculated amount is authoritative.</p>
        </div>
        {error && <p className="mt-5 flex gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert"><AlertCircle size={18} />{error}</p>}
        <button type="button" disabled={processing}
          onClick={pay} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3.5 font-bold text-white disabled:bg-gray-400">
          {processing ? <><Loader2 size={18} className="animate-spin" />Processing...</> : <><Lock size={16} />Pay securely with Razorpay</>}
        </button>
        <p className="mt-3 text-center text-xs text-gray-500"><ShieldCheck size={14} className="mr-1 inline" /> Payment is confirmed only after server-side gateway verification.</p>

        {sandboxPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-xl">
              <ShieldCheck className="mx-auto text-amber-600" size={36} />
              <h2 className="mt-3 text-xl font-bold">Sandbox payment enabled</h2>
              <p className="mt-2 text-sm text-gray-500">This is a non-production test payment for ₹{Number(booking.totalAmount || booking.amount).toLocaleString("en-IN")}.</p>
              <button type="button" disabled={processing} onClick={() => verify({
                razorpay_order_id: order.orderId,
                razorpay_payment_id: `sandbox_pay_${Date.now()}`,
                sandbox: true,
              })} className="mt-6 w-full rounded-full bg-emerald-600 px-5 py-3 font-bold text-white disabled:bg-gray-400">
                {processing ? "Verifying..." : "Simulate successful payment"}
              </button>
              <button type="button" onClick={() => setSandboxPrompt(false)} className="mt-3 text-sm text-gray-500">Cancel</button>
            </div>
          </div>
        )}
        <Link to={isHotel ? "/hotels" : "/trains"} className="mt-6 block text-center text-sm font-semibold text-gray-500 hover:text-red-600">Return to search</Link>
      </section>
    </main>
  );
}
