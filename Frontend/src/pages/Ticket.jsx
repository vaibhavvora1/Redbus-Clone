import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CheckCircle2,
  Calendar,
  MapPin,
  Download,
  Printer,
  ArrowLeft,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Bus,
  RotateCcw,
} from "lucide-react";
import api from "../services/api";
import { useBooking } from "../context/BookingContext";
import BookingStepper from "../components/BookingStepper";

export default function Ticket() {
  const { bookingId } = useParams();
  const { confirmedBooking } = useBooking();
  const printRef = useRef(null);

  const [booking, setBooking] = useState(confirmedBooking || null);
  const [loading, setLoading] = useState(!confirmedBooking);
  const [error, setError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchBooking = async () => {
      if (!bookingId) {
        setError("Invalid booking ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await api.bookings.getById(bookingId);
        if (isMounted && res && (res.data || res.booking)) {
          setBooking(res.data || res.booking);
        }
      } catch (err) {
        // Fallback: search user bookings for this ID
        try {
          const listRes = await api.bookings.getMyBookings();
          const found = (listRes.data || []).find(
            (b) => b.bookingId === bookingId || b._id === bookingId
          );
          if (isMounted && found) {
            setBooking(found);
          } else if (isMounted && !booking) {
            setError(err.message || "Could not retrieve ticket details.");
          }
        } catch {
          if (isMounted && !booking) {
            setError("Unable to find booking details. Please check My Bookings.");
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (!booking || (booking.bookingId !== bookingId && booking._id !== bookingId)) {
      fetchBooking();
    }

    return () => {
      isMounted = false;
    };
  }, [booking, bookingId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!booking || isDownloading) return;
    setIsDownloading(true);
    setDownloadError("");

    try {
      await api.bookings.downloadTicketPdf(booking._id, booking.bookingId);
    } catch (err) {
      setDownloadError(err.message || "Could not generate ticket PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10" role="status" aria-label="Loading ticket">
        <div className="mx-auto max-w-4xl space-y-4 rounded-3xl bg-white p-8">
          <div className="skeleton h-16 rounded-xl" />
          <div className="skeleton h-32 rounded-2xl" />
          <div className="skeleton h-52 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Ticket Not Found</h2>
          <p className="text-sm text-gray-600 mb-6">
            {error || `No booking found with reference ID "${bookingId}".`}
          </p>
          <div className="space-y-3">
            <Link
              to="/mybookings"
              className="block w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-full transition shadow-sm text-sm"
            >
              View My Bookings
            </Link>
            <Link
              to="/"
              className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-full transition text-sm"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isCancelled = booking.status === "CANCELLED";
  const isRefunded =
    booking.refundStatus === "PROCESSED" ||
    booking.refundStatus === "REFUNDED" ||
    booking.refundStatus === "PARTIALLY_REFUNDED";

  const displayId = booking.bookingId || `RDB-${String(booking._id).slice(-6).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Stepper */}
      <BookingStepper currentStep={5} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Top Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
          <Link
            to="/mybookings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-red-600 transition"
          >
            <ArrowLeft size={14} /> Back to My Bookings
          </Link>

          <div className="flex items-center flex-wrap gap-3">
            {/* Real Selectable Vector PDF Download */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              {isDownloading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <span>{isDownloading ? "Generating PDF..." : "Download Ticket (PDF)"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
            >
              <Printer size={14} /> Print
            </button>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition"
            >
              Book Another Bus
            </Link>
          </div>
        </div>

        {downloadError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{downloadError}</span>
          </div>
        )}

        {/* Refund Status Notice */}
        {isRefunded && (
          <div className="mb-6 bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
            <RotateCcw className="text-purple-600 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-sm font-bold text-purple-900">
                Booking Cancelled & Refund Processed
              </h4>
              <p className="text-xs text-purple-700 mt-0.5">
                A refund of ₹{(booking.refundedAmount || booking.totalAmount || booking.amount).toLocaleString("en-IN")}{" "}
                has been processed back to your original payment method
                {booking.refundedAt
                  ? ` on ${new Date(booking.refundedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}`
                  : ""}
                .
                {booking.refundId && (
                  <span className="block font-mono text-[11px] text-purple-800 mt-1 font-semibold">
                    Refund Transaction ID: {booking.refundId}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Printable Ticket Container */}
        <div
          ref={printRef}
          className="bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden print:shadow-none print:border-none"
        >
          {/* Header Banner */}
          <div
            className={`p-6 sm:p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              isCancelled
                ? "bg-gradient-to-r from-gray-700 to-gray-800"
                : "bg-gradient-to-r from-red-600 to-red-700"
            }`}
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <img src="/redbuslogo.png" alt="redBus" className="h-7 w-auto object-contain bg-white/20 p-1 rounded" />
                {!isCancelled && <CheckCircle2 size={16} className="confirmation-enter" aria-hidden="true" />}
                <span className="text-xs font-extrabold tracking-widest uppercase opacity-90">
                  Official E-Ticket Confirmation
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {isRefunded
                  ? "Booking Cancelled & Refunded"
                  : isCancelled
                  ? "Booking Cancelled"
                  : "Booking Confirmed!"}
              </h1>
              <p className="text-xs text-white/80 mt-1">
                A copy has been sent to {booking.userPhone || booking.userEmail || "your registered contact"}.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 text-right border border-white/20">
              <div className="text-[10px] font-bold tracking-wider uppercase opacity-80">
                Ticket PNR / Booking ID
              </div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-wider">
                {displayId}
              </div>
              <div className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white text-gray-900 uppercase">
                {isRefunded ? "REFUNDED" : booking.status}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 sm:p-8 space-y-8">
            {/* Route & Timing Card */}
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col md:flex-row justify-between gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-red-600 uppercase tracking-wider">
                  <Bus size={14} />
                  <span>{booking.operator || "Bus Service"}</span>
                  {booking.busNumber && <span className="text-gray-400">• {booking.busNumber}</span>}
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-2xl font-extrabold text-gray-900">
                      {booking.time || "21:00"}
                    </span>
                    <span className="block text-xs font-bold text-gray-500">
                      {booking.fromCity || booking.title?.split(" to ")[0] || "Origin"}
                    </span>
                  </div>

                  <div className="text-center px-4 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-600 shadow-xs">
                    Direct Journey
                  </div>

                  <div>
                    <span className="text-2xl font-extrabold text-gray-900">
                      {booking.time ? "Next Day" : "—"}
                    </span>
                    <span className="block text-xs font-bold text-gray-500">
                      {booking.toCity || booking.title?.split(" to ")[1]?.split(" - ")[0] || "Destination"}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-600 flex items-center gap-2 pt-2">
                  <Calendar size={14} className="text-gray-400" />
                  <span className="font-semibold">Date of Journey:</span>
                  <span>{booking.date}</span>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-gray-200 shrink-0">
                {booking.qrCode ? (
                  <img
                    src={booking.qrCode}
                    alt="Booking QR Code"
                    loading="lazy"
                    decoding="async"
                    width="128"
                    height="128"
                    className="w-32 h-32 object-contain"
                  />
                ) : (
                  <div className="w-32 h-32 bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-400">
                    QR Code
                  </div>
                )}
                <span className="text-[10px] font-bold text-gray-400 mt-1 uppercase">
                  Scan to Verify
                </span>
              </div>
            </div>

            {/* Passenger List & Seat Allocation */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">
                Passenger & Seat Details
              </h3>
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-600 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4">Seat No.</th>
                      <th className="py-3 px-4">Passenger Name</th>
                      <th className="py-3 px-4">Age</th>
                      <th className="py-3 px-4">Gender</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {Array.isArray(booking.passengers) && booking.passengers.length > 0 ? (
                      booking.passengers.map((p, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/80 transition">
                          <td className="py-3.5 px-4 font-extrabold text-red-600">
                            {p.seatNumber}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-gray-900">
                            {p.name}
                          </td>
                          <td className="py-3.5 px-4">{p.age || "—"}</td>
                          <td className="py-3.5 px-4">{p.gender || "—"}</td>
                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isCancelled
                                  ? "bg-red-100 text-red-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {isCancelled ? "Cancelled" : "Confirmed"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-3.5 px-4 font-extrabold text-red-600">
                          {booking.seats}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          {booking.userName || "Passenger"}
                        </td>
                        <td className="py-3.5 px-4">—</td>
                        <td className="py-3.5 px-4">—</td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isCancelled
                                ? "bg-red-100 text-red-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isCancelled ? "Cancelled" : "Confirmed"}
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Boarding and Dropping Points */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MapPin size={12} className="text-red-500" /> Boarding Point
                </div>
                <div className="text-sm font-bold text-gray-900">{booking.boardingPoint || "Main City Terminal"}</div>
                <div className="text-xs text-gray-500 mt-1">Please report 15 minutes before departure.</div>
              </div>

              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <MapPin size={12} className="text-emerald-500" /> Dropping Point
                </div>
                <div className="text-sm font-bold text-gray-900">{booking.droppingPoint || "Central Station Junction"}</div>
                <div className="text-xs text-gray-500 mt-1">Subject to traffic and highway conditions.</div>
              </div>
            </div>

            {/* Fare Breakdown & Payment Guarantee */}
            <div className="border-t border-gray-200 pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ShieldCheck size={18} className="text-emerald-600" />
                <span>
                  Payment Verified via Razorpay Secure Gateway • Standard 5% GST Included
                </span>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-gray-400 block font-medium">Total Paid Amount</span>
                <span className="text-2xl font-black text-gray-900">₹{booking.totalAmount || booking.amount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
