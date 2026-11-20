import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  ChevronDown,
  XCircle,
  AlertTriangle,
  Bookmark,
  Download,
  Loader2,
  AlertCircle,
  Ticket,
} from "lucide-react";
import api from "../services/api";
import Footer from "../components/Footer";
import { getTodayInAppTZ } from "../utils/timeZone";

const TABS = ["All", "Upcoming", "Past", "Cancelled"];

export default function Bookings() {
  const [activeTab, setActiveTab] = useState("All");
  const [expandedId, setExpandedId] = useState(null);
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [allBookings, setAllBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchBookings = async () => {
    try {
      const res = await api.bookings.getMyBookings();
      const list = (res.data || []).map((b) => ({
        id: b._id,
        bookingId: b.bookingId || `RDB-${String(b._id).slice(-6).toUpperCase()}`,
        bookingType: b.bookingType || "bus",
        vertical: b.vertical || (b.bookingType ? b.bookingType[0].toUpperCase() + b.bookingType.slice(1) : "Bus"),
        title: b.title,
        operator: b.operator,
        date: b.date,
        time: b.time,
        amount: b.amount,
        totalAmount: b.totalAmount || b.amount,
        seats: b.seats,
        seatNumbers: b.seatNumbers || [],
        boardingPoint: b.boardingPoint,
        droppingPoint: b.droppingPoint,
        status: b.status,
        refundStatus: b.refundStatus || "NOT_APPLICABLE",
        refundedAmount: b.refundedAmount || 0,
        refundId: b.refundId || "",
        refundedAt: b.refundedAt || null,
        cancelledAt: b.cancelledAt,
        qrCode: b.qrCode,
        fromStation: b.fromStation,
        toStation: b.toStation,
        fromStationCode: b.fromStationCode,
        toStationCode: b.toStationCode,
        trainClass: b.trainClass,
        roomTypeName: b.roomTypeName,
        roomCount: b.roomCount,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        guests: b.guests || [],
      }));
      setAllBookings(list);
    } catch (err) {
      setLoadError(err.message || "Could not load bookings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Start the initial booking data request.
    fetchBookings();
  }, []);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter bookings based on activeTab
  const todayStr = getTodayInAppTZ();

  const filteredBookings = allBookings.filter((b) => {
    if (activeTab === "All") return true;
    if (activeTab === "Cancelled") return b.status === "CANCELLED";
    if (activeTab === "Upcoming") {
      return b.status === "CONFIRMED" && b.date >= todayStr;
    }
    if (activeTab === "Past") {
      return b.date < todayStr || b.status === "COMPLETED";
    }
    return true;
  });

  const handleCancelBooking = async () => {
    if (!cancelModalBooking) return;
    setIsCancelling(true);
    setActionError("");

    try {
      const res = await api.bookings.cancel(cancelModalBooking.id || cancelModalBooking.bookingId);
      const updated = res.data || res.booking;

      setAllBookings((bookings) =>
        bookings.map((b) =>
          b.id === cancelModalBooking.id
            ? {
                ...b,
                status: updated?.status || "CANCELLED",
                refundStatus: updated?.refundStatus || b.refundStatus,
                refundedAmount: updated?.refundedAmount ?? b.refundedAmount,
              }
            : b
        )
      );
      setCancelModalBooking(null);
    } catch (err) {
      setActionError(err.message || "Could not cancel this booking.");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Header Banner */}
      <div className="bg-gray-900 text-white py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-extrabold tracking-tight">My Bookings</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage your bus tickets, view QR passes, or cancel bookings
          </p>

          <div className="flex flex-wrap gap-2 mt-6">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  activeTab === tab
                    ? "bg-red-600 text-white shadow-sm"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6">
        {isLoading ? (
          <div className="space-y-4" role="status" aria-label="Loading bookings">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="skeleton h-36 rounded-2xl" />
            ))}
          </div>
        ) : loadError ? (
          <div
            className="bg-white rounded-2xl border border-red-200 p-8 text-center text-sm text-red-600 shadow-sm"
            role="alert"
          >
            <AlertCircle size={20} className="inline mr-2" />
            {loadError}
          </div>
        ) : filteredBookings.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center flex flex-col items-center gap-3 shadow-sm">
            <Bookmark size={48} className="text-gray-300" />
            <h3 className="text-xl font-bold text-gray-800">
              No {activeTab !== "All" ? activeTab : ""} Bookings Found
            </h3>
            <p className="text-sm text-gray-500 max-w-sm">
              You haven't made any {activeTab !== "All" ? activeTab.toLowerCase() : ""} reservations yet.
            </p>
            <Link
              to="/"
              className="mt-3 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-full text-xs transition shadow-sm"
            >
              Book a Bus Now
            </Link>
          </div>
        )}

        {!isLoading && !loadError && filteredBookings.length > 0 && (
          <div className="space-y-4">
            {filteredBookings.map((b) => {
              const isExpanded = expandedId === b.id;

              return (
                <div
                  key={b.id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-all"
                >
                  <div
                    onClick={() => toggleExpand(b.id)}
                    className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-xs font-bold font-mono bg-red-100 text-red-700 px-2 py-0.5 rounded">
                          {b.vertical.toUpperCase()}
                        </span>
                        <span className="text-xs font-mono font-bold bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                          {b.bookingId}
                        </span>
                        <span
                          className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                            b.status === "CONFIRMED"
                              ? "bg-emerald-100 text-emerald-800"
                              : b.status === "CANCELLED"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {b.status}
                        </span>

                        {b.status === "CANCELLED" && (
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              b.refundStatus === "PROCESSED" || b.refundStatus === "REFUNDED"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {b.refundStatus === "PROCESSED" || b.refundStatus === "REFUNDED"
                              ? `Refunded: ₹${(b.refundedAmount || b.totalAmount || b.amount).toLocaleString("en-IN")}`
                              : b.refundStatus === "MANUAL_REQUIRED"
                                ? "Refund: manual review required"
                                : `Refund: ${b.refundStatus || "Not applicable"}`}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-gray-900">{b.title}</h3>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1 font-medium">
                          <Calendar size={13} className="text-gray-400" /> {b.bookingType === "hotel" ? `${b.checkIn} to ${b.checkOut}` : b.date}
                        </span>
                        <span className="flex items-center gap-1 font-medium">
                          <Clock size={13} className="text-gray-400" /> {b.time}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100">
                      <div className="text-left md:text-right">
                        <div className="text-xl font-extrabold text-gray-900">
                          ₹{b.totalAmount || b.amount}
                        </div>
                        <span className="text-xs text-gray-500 block">
                          {b.bookingType === "hotel" ? "Rooms" : "Seats"}: <strong className="text-gray-800">{b.bookingType === "hotel" ? b.roomCount : b.seats}</strong>
                        </span>
                      </div>

                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <ChevronDown
                          size={18}
                          className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/70 px-6 py-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-700 mb-5">
                        <div>
                          <span className="text-gray-400 block font-medium">{b.bookingType === "hotel" ? "Hotel" : b.bookingType === "train" ? "Train" : "Bus Operator"}</span>
                          <span className="font-bold text-sm text-gray-900">{b.operator}</span>
                        </div>
                        {b.bookingType === "train" ? (
                          <>
                            <div><span className="text-gray-400 block font-medium">From station</span><span className="font-bold text-sm text-gray-900">{b.fromStation} ({b.fromStationCode})</span></div>
                            <div><span className="text-gray-400 block font-medium">To station</span><span className="font-bold text-sm text-gray-900">{b.toStation} ({b.toStationCode})</span></div>
                            <div><span className="text-gray-400 block font-medium">Class / passengers</span><span className="font-bold text-sm text-red-600">{b.trainClass} / {b.passengers?.length || 0}</span></div>
                          </>
                        ) : b.bookingType === "hotel" ? (
                          <>
                            <div><span className="text-gray-400 block font-medium">Stay</span><span className="font-bold text-sm text-gray-900">{b.checkIn} to {b.checkOut}</span></div>
                            <div><span className="text-gray-400 block font-medium">Room type</span><span className="font-bold text-sm text-gray-900">{b.roomTypeName}</span></div>
                            <div><span className="text-gray-400 block font-medium">Rooms / guests</span><span className="font-bold text-sm text-red-600">{b.roomCount} / {b.guests?.length || 0}</span></div>
                          </>
                        ) : (
                          <>
                            <div><span className="text-gray-400 block font-medium">Boarding Point</span><span className="font-bold text-sm text-gray-900">{b.boardingPoint || "Main Terminal"}</span></div>
                            <div><span className="text-gray-400 block font-medium">Dropping Point</span><span className="font-bold text-sm text-gray-900">{b.droppingPoint || "Central Station"}</span></div>
                            <div><span className="text-gray-400 block font-medium">Allocated Seats</span><span className="font-bold text-sm text-red-600">{b.seats}</span></div>
                          </>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2">
                          <Link
                            to={b.bookingType === "bus" ? `/ticket/${b.bookingId || b.id}` : `/travel-booking/confirmation/${b.bookingId || b.id}`}
                            className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-800 font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs"
                          >
                            <Ticket size={14} className="text-red-600" /> View Ticket
                          </Link>

                          {b.status === "CONFIRMED" && !["PROCESSED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(b.refundStatus) && <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await api.bookings.downloadTicketPdf(b.id, b.bookingId);
                              } catch (err) {
                                alert(err.message || "Failed to download ticket PDF.");
                              }
                            }}
                            className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Download size={14} /> Download PDF
                          </button>}
                        </div>

                        {b.status === "CONFIRMED" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancelModalBooking(b);
                            }}
                            className="bg-gray-100 hover:bg-red-50 border border-gray-200 hover:border-red-200 text-gray-700 hover:text-red-700 font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle size={14} /> Cancel Booking
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Cancellation Confirmation Modal */}
        {cancelModalBooking && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="modal-enter bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center">
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={28} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Cancel This Booking?</h3>
              <p className="text-xs text-gray-500 mb-4">
                Are you sure you want to cancel ticket{" "}
                <strong className="text-gray-900">{cancelModalBooking.bookingId}</strong> for{" "}
                {cancelModalBooking.title} on {cancelModalBooking.date}?
              </p>

              <div className="bg-gray-50 p-3 rounded-xl text-xs text-left mb-6 space-y-1 text-gray-700">
                <div className="flex justify-between">
                  <span>{cancelModalBooking.bookingType === "hotel" ? "Rooms Released:" : cancelModalBooking.bookingType === "train" ? "Passengers:" : "Seats Released:"}</span>
                  <span className="font-bold text-red-600">{cancelModalBooking.bookingType === "hotel" ? cancelModalBooking.roomCount : cancelModalBooking.bookingType === "train" ? cancelModalBooking.passengers?.length : cancelModalBooking.seats}</span>
                </div>
                <div className="flex justify-between">
                  <span>Refund Amount:</span>
                  <span className="font-bold text-emerald-600">
                    ₹{cancelModalBooking.totalAmount || cancelModalBooking.amount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Refund Status:</span>
                  <span className="font-semibold text-gray-900">{cancelModalBooking.bookingType === "bus" ? "Contact support for paid bus bookings" : "Refund eligibility is calculated from the cancellation policy"}</span>
                </div>
              </div>

              {actionError && (
                <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg mb-4">{actionError}</p>
              )}

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleCancelBooking}
                  className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-full text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Cancelling & Releasing Seats...
                    </>
                  ) : (
                    "Yes, Cancel Booking"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setCancelModalBooking(null)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-full text-xs transition cursor-pointer"
                >
                  No, Keep Booking
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-20">
        <Footer />
      </div>
    </div>
  );
}
