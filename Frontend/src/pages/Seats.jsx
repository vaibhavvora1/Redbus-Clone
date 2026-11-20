import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  Bus,
  Clock,
  MapPin,
  Star,
  ShieldCheck,
  AlertCircle,
  Loader2,
  ArrowRight,
  Landmark,
  RotateCcw,
  Calendar,
} from "lucide-react";
import api from "../services/api";
import { useBooking } from "../context/BookingContext";
import BookingStepper from "../components/BookingStepper";
import { getMaxBookingDateInAppTZ, getTodayInAppTZ } from "../utils/timeZone";

export default function Seats() {
  const { tripId: paramTripId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    trip,
    initTrip,
    selectedSeats,
    toggleSeat,
    clearSeats,
    setHoldExpiresAt,
    setServerTotals,
    boardingPoint,
    droppingPoint,
    setBoardingAndDropping,
    fareSummary,
    setStep,
  } = useBooking();

  // Trip ID priority: dynamic route parameter (/booking/:tripId) -> URL query param -> stored context ID
  const tripId = paramTripId || searchParams.get("tripId") || searchParams.get("busId") || trip?._id || trip?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tripData, setTripData] = useState(trip);
  const [seatsList, setSeatsList] = useState([]);
  const [activeDeck, setActiveDeck] = useState("lower");
  const [lockError, setLockError] = useState("");
  const [locking, setLocking] = useState(false);

  // Fetch live trip details and seat availability by ID
  const loadTripAndSeats = useCallback(async () => {
    if (!tripId) {
      setError("No bus trip specified. Please select a valid bus from the search results.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Fetch trip metadata from backend
      const tripRes = await api.trips.getById(tripId);
      const data = tripRes.data || tripRes;
      if (!data || !data._id) {
        throw new Error("Trip not found. The requested schedule is unavailable.");
      }
      setTripData(data);
      initTrip(data);

      setSeatsList(Array.isArray(data.seats) ? data.seats : []);
    } catch (err) {
      console.error("Failed to load seats:", err);
      setError(err.message || "Failed to load bus seat availability. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [tripId, initTrip]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Start the route's live seat-data request.
    loadTripAndSeats();
  }, [loadTripAndSeats]);

  // Identify Government / State Transport Corporation buses
  const isGovernmentBus = useMemo(() => {
    if (!tripData) return false;
    const op = (tripData.operator || "").toUpperCase();
    const govKeywords = [
      "GSRTC",
      "TGSRTC",
      "MSRTC",
      "UPSRTC",
      "HRTC",
      "KSRTC",
      "RSRTC",
      "STATE",
      "TRANSPORT",
      "GOVERNMENT",
      "ROADWAYS",
      "CORP",
    ];
    return Boolean(tripData.isGovernment || govKeywords.some((k) => op.includes(k)));
  }, [tripData]);

  // Check if journey has already departed
  const isTripDeparted = Boolean(tripData?.isDeparted || tripData?.hasDeparted || tripData?.status === "departed");
  const isTripCancelled = tripData?.status === "cancelled";

  // Check if all seats are sold out
  const isSoldOut = useMemo(() => {
    if (!tripData) return false;
    return Number(tripData.availableSeats) === 0;
  }, [tripData]);

  // Split seats into lower and upper decks
  const lowerDeckSeats = useMemo(() => {
    return seatsList.filter((s) => (s.deck || "lower").toLowerCase() === "lower");
  }, [seatsList]);

  const upperDeckSeats = useMemo(() => {
    return seatsList.filter((s) => (s.deck || "").toLowerCase() === "upper");
  }, [seatsList]);

  const hasUpperDeck = upperDeckSeats.length > 0;

  // Handle seat click
  const handleSeatClick = async (seat) => {
    if (seat.isBooked) return;
    if (seat.isLocked && !selectedSeats.includes(seat.seatNumber)) {
      setLockError(`Seat ${seat.seatNumber} is temporarily held by another passenger.`);
      setTimeout(() => setLockError(""), 3500);
      return;
    }

    setLockError("");
    toggleSeat(seat);
  };

  const handleTravelDateChange = (nextDate) => {
    if (!nextDate || nextDate === (tripData?.travelDate || tripData?.journeyDate)) return;
    clearSeats?.();
    const params = new URLSearchParams({
      from: tripData?.fromCity || tripData?.from || "",
      to: tripData?.toCity || tripData?.to || "",
      date: nextDate,
    });
    navigate(`${isGovernmentBus ? "/government-buses" : "/buslisting"}?${params.toString()}`);
  };

  // Proceed to passenger details
  const handleProceed = async () => {
    if (selectedSeats.length === 0) {
      setLockError("Please select at least 1 seat to continue.");
      return;
    }

    setLocking(true);
    setLockError("");

    try {
      const sessionId =
        sessionStorage.getItem("redbus_session_id") ||
        `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem("redbus_session_id", sessionId);

      // Generate idempotency key for this hold attempt
      const idempotencyKey = `hold_${tripId}_${[...selectedSeats].sort().join("-")}_${sessionId}`;

      // Call POST /api/bookings/hold with tripId, sorted seat numbers, and Idempotency-Key
      const res = await api.bookings.hold(
        {
          tripId,
          seatNumbers: selectedSeats,
          sessionId,
        },
        {
          "Idempotency-Key": idempotencyKey,
        }
      );

      // Store server-recalculated totals and hold expiration time
      if (res.holdExpiresAt && setHoldExpiresAt) {
        setHoldExpiresAt(res.holdExpiresAt);
      }
      if (res.totalAmount && setServerTotals) {
        setServerTotals({
          baseFare: res.baseFare,
          tax: res.tax,
          totalAmount: res.totalAmount,
        });
      }

      setStep(3);
      navigate("/passenger-details");
    } catch (err) {
      console.error("Seat holding error:", err);
      const isConflict =
        err.status === 409 ||
        err.message?.toLowerCase().includes("conflict") ||
        err.message?.toLowerCase().includes("unavailable") ||
        err.message?.toLowerCase().includes("already");

      const errorMessage = isConflict
        ? `⚠️ ${err.message || "One or more selected seats were just taken by another passenger."} We have refreshed the live seat map.`
        : err.message || "Failed to hold seats. Please try again.";

      setLockError(errorMessage);
      if (clearSeats) clearSeats();
      await loadTripAndSeats();
    } finally {
      setLocking(false);
    }
  };

  // 1. Loading Skeleton State
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <BookingStepper currentStep={2} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          {/* Header Skeleton */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
            <div className="skeleton h-6 rounded-md w-1/3 mb-3"></div>
            <div className="skeleton h-4 rounded-md w-1/2"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Seat Map Skeleton */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 h-96 flex flex-col justify-between">
              <div className="skeleton h-5 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-4 gap-4 p-8 bg-gray-50 rounded-2xl">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="skeleton h-10 rounded-lg"></div>
                ))}
              </div>
              <div className="skeleton h-4 rounded w-full"></div>
            </div>

            {/* Fare Summary Skeleton */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 h-80 flex flex-col justify-between">
              <div className="h-5 bg-gray-200 rounded w-1/2"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-100 rounded w-full"></div>
                <div className="h-4 bg-gray-100 rounded w-full"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
              </div>
              <div className="h-12 bg-gray-200 rounded-full w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error / 404 Trip Not Found State
  if (error || !tripData) {
    const is404 =
      error?.toLowerCase().includes("not found") ||
      error?.toLowerCase().includes("unavailable") ||
      !tripId;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {is404 ? "Trip Not Found (404)" : "Unable to Load Seats"}
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            {error || "The bus trip you requested does not exist or may have been cancelled."}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={loadTripAndSeats}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-full transition shadow-sm text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw size={15} />
              Retry Loading
            </button>
            <button
              onClick={() => navigate("/buslisting")}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-full transition text-sm cursor-pointer"
            >
              Browse Available Buses
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Departed Notice
  if (isTripCancelled) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Trip Cancelled</h2>
          <p className="text-sm text-gray-600 mb-6">This service on {tripData.travelDate || tripData.journeyDate} has been cancelled. Check My Bookings for refund status.</p>
          <button onClick={() => navigate(`/government-buses?date=${tripData.travelDate || tripData.journeyDate}`)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-full">Find another bus</button>
        </div>
      </div>
    );
  }

  // 3. Departed Notice
  if (isTripDeparted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full text-center">
          <Clock size={48} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Trip Already Departed</h2>
          <p className="text-sm text-gray-600 mb-6">
            This bus service departed on {tripData.travelDate || tripData.journeyDate} at {tripData.departureTime}. Online bookings for this schedule are closed.
          </p>
          <button
            onClick={() => navigate("/buslisting")}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-full transition shadow-sm text-sm cursor-pointer"
          >
            Find Upcoming Buses
          </button>
        </div>
      </div>
    );
  }

  // 4. Sold Out Notice
  if (isSoldOut) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full text-center">
          <Bus size={48} className="text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Bus Fully Booked</h2>
          <p className="text-sm text-gray-600 mb-6">
            All seats on this {tripData.operator} ({tripData.departureTime}) bus have already been reserved.
          </p>
          <button
            onClick={() => navigate("/buslisting")}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-full transition shadow-sm text-sm cursor-pointer"
          >
            Find Other Available Buses
          </button>
        </div>
      </div>
    );
  }

  const currentDeckSeats = activeDeck === "upper" ? upperDeckSeats : lowerDeckSeats;
  const maxRow = Math.max(...currentDeckSeats.map((s) => s.row || 1), 1);
  const rows = Array.from({ length: maxRow }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Stepper */}
      <BookingStepper currentStep={2} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Government Bus Policy Badge */}
        {isGovernmentBus && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                <Landmark size={20} />
              </div>
              <div>
                <span className="font-bold text-sm block text-emerald-950">
                  Official State Transport Corporation Bus ({tripData.operator})
                </span>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Regulated state transport fare tariff. Valid state concession & luggage guidelines apply.
                </p>
              </div>
            </div>
            <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full w-fit">
              Govt Verified
            </span>
          </div>
        )}

        {/* Bus Info Banner */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-extrabold text-gray-900">{tripData.operator}</h1>
                {tripData.rating && (
                  <span className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    <Star size={10} fill="white" /> {tripData.rating}
                  </span>
                )}
                <span className="bg-gray-100 text-gray-600 text-xs px-2.5 py-0.5 rounded-full font-medium">
                  {tripData.busType || tripData.type || "AC Sleeper"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {tripData.busNumber ? `Bus No: ${tripData.busNumber} • ` : ""}
                {tripData.fromCity || tripData.from} → {tripData.toCity || tripData.to} • {tripData.travelDate || tripData.journeyDate}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
                <Calendar size={15} className="text-red-600" /> Travel date
                <input
                  type="date"
                  value={tripData.travelDate || tripData.journeyDate}
                  min={getTodayInAppTZ()}
                  max={getMaxBookingDateInAppTZ()}
                  onChange={(event) => handleTravelDateChange(event.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1 text-sm text-gray-800"
                  aria-label="Change travel date"
                />
              </label>
              <div className="text-left md:text-right">
                <div className="text-lg font-bold text-gray-900">
                  {tripData.departureTime} — {tripData.arrivalTime}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1 md:justify-end">
                  <Clock size={12} /> {tripData.duration || "Overnight"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {lockError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertCircle size={18} />
            <span>{lockError}</span>
          </div>
        )}

        {/* Main Grid: Seat Layout + Booking Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Seat Layout (Left 2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
              {/* Deck Tabs */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Select Seats</h2>
                  <p className="text-xs text-gray-500">Click on available seats to select (Max 6 seats)</p>
                </div>

                {hasUpperDeck && (
                  <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setActiveDeck("lower")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeDeck === "lower"
                          ? "bg-white text-gray-900 shadow-xs"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      Lower Deck
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDeck("upper")}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                        activeDeck === "upper"
                          ? "bg-white text-gray-900 shadow-xs"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      Upper Deck
                    </button>
                  </div>
                )}
              </div>

              {/* Seat Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 mb-8 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded border border-gray-300 bg-white" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-red-600 text-white font-bold text-[9px] flex items-center justify-center">
                    ✓
                  </div>
                  <span className="font-semibold text-red-600">Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-amber-400" />
                  <span>Held</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded bg-gray-300" />
                  <span>Booked</span>
                </div>
              </div>

              {/* Bus Interior Layout Container */}
              <div className="border-2 border-dashed border-gray-200 rounded-3xl p-6 bg-gray-50/50 max-w-lg mx-auto">
                {/* Front of Bus (Steering Wheel) */}
                <div className="flex justify-between items-center pb-4 mb-4 border-b border-gray-200 text-xs font-semibold text-gray-400">
                  <span>FRONT / DRIVER</span>
                  <div className="w-8 h-8 rounded-full border-2 border-gray-400 flex items-center justify-center">
                    <div className="w-2 h-2 bg-gray-500 rounded-full" />
                  </div>
                </div>

                {/* Seat Rows */}
                <div className="space-y-4">
                  {rows.map((rowNum) => {
                    const rowSeats = currentDeckSeats.filter((s) => s.row === rowNum);
                    if (rowSeats.length === 0) return null;

                    return (
                      <div key={rowNum} className="flex items-center justify-between gap-3">
                        {/* Left Side Seats (col 1, 2) */}
                        <div className="flex items-center gap-2">
                          {rowSeats
                            .filter((s) => s.col <= 2)
                            .map((seat) => {
                              const isSelected = selectedSeats.includes(seat.seatNumber);
                              const isLocked = seat.isLocked && !isSelected;
                              const isBooked = seat.isBooked;
                              const isSleeper = seat.type === "sleeper";

                              return (
                                <button
                                  key={seat.seatNumber}
                                  type="button"
                                  disabled={isBooked || isLocked}
                                  onClick={() => handleSeatClick(seat)}
                                  className={`seat-option relative font-bold text-xs flex flex-col items-center justify-center rounded-lg shadow-xs select-none ${
                                    isSleeper ? "w-14 h-20" : "w-11 h-11"
                                  } ${
                                    isSelected
                                      ? "seat-selected bg-red-600 text-white ring-2 ring-red-400 ring-offset-1"
                                      : isBooked
                                      ? "bg-gray-300 text-gray-500 cursor-not-allowed border border-gray-300"
                                      : isLocked
                                      ? "bg-amber-300 text-amber-900 cursor-not-allowed border border-amber-400"
                                      : "bg-white text-gray-800 border-2 border-gray-300 hover:border-red-500 hover:text-red-600 cursor-pointer"
                                  }`}
                                  title={`Seat ${seat.seatNumber} - ₹${seat.fare}`}
                                >
                                  <span>{seat.seatNumber}</span>
                                  <span className="text-[10px] opacity-80">₹{seat.fare}</span>
                                </button>
                              );
                            })}
                        </div>

                        {/* Aisle Spacer */}
                        <div className="w-8 text-center text-[10px] font-bold text-gray-300">
                          |
                        </div>

                        {/* Right Side Seats (col 3, 4) */}
                        <div className="flex items-center gap-2">
                          {rowSeats
                            .filter((s) => s.col > 2)
                            .map((seat) => {
                              const isSelected = selectedSeats.includes(seat.seatNumber);
                              const isLocked = seat.isLocked && !isSelected;
                              const isBooked = seat.isBooked;
                              const isSleeper = seat.type === "sleeper";

                              return (
                                <button
                                  key={seat.seatNumber}
                                  type="button"
                                  disabled={isBooked || isLocked}
                                  onClick={() => handleSeatClick(seat)}
                                  className={`seat-option relative font-bold text-xs flex flex-col items-center justify-center rounded-lg shadow-xs select-none ${
                                    isSleeper ? "w-14 h-20" : "w-11 h-11"
                                  } ${
                                    isSelected
                                      ? "seat-selected bg-red-600 text-white ring-2 ring-red-400 ring-offset-1"
                                      : isBooked
                                      ? "bg-gray-300 text-gray-500 cursor-not-allowed border border-gray-300"
                                      : isLocked
                                      ? "bg-amber-300 text-amber-900 cursor-not-allowed border border-amber-400"
                                      : "bg-white text-gray-800 border-2 border-gray-300 hover:border-red-500 hover:text-red-600 cursor-pointer"
                                  }`}
                                  title={`Seat ${seat.seatNumber} - ₹${seat.fare}`}
                                >
                                  <span>{seat.seatNumber}</span>
                                  <span className="text-[10px] opacity-80">₹{seat.fare}</span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Rear of Bus */}
                <div className="text-center pt-6 mt-6 border-t border-gray-200 text-xs font-semibold text-gray-400">
                  REAR
                </div>
              </div>
            </div>

            {/* Boarding & Dropping Points Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin size={16} className="text-red-600" />
                Select Boarding & Dropping Points
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Boarding Point */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Boarding Point ({tripData.fromCity || tripData.from})
                  </label>
                  <select
                    value={boardingPoint}
                    onChange={(e) => setBoardingAndDropping(e.target.value, droppingPoint)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    {(tripData.boardingPoints || []).map((bp, i) => (
                      <option key={i} value={bp.name}>
                        {bp.name} {bp.time ? `(${bp.time})` : ""}
                      </option>
                    ))}
                    {!tripData.boardingPoints?.length && (
                      <option value={`${tripData.fromCity || tripData.from} Main Terminal`}>
                        {tripData.fromCity || tripData.from} Main Terminal ({tripData.departureTime})
                      </option>
                    )}
                  </select>
                </div>

                {/* Dropping Point */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Dropping Point ({tripData.toCity || tripData.to})
                  </label>
                  <select
                    value={droppingPoint}
                    onChange={(e) => setBoardingAndDropping(boardingPoint, e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs text-gray-800 focus:ring-2 focus:ring-red-500 outline-none"
                  >
                    {(tripData.droppingPoints || []).map((dp, i) => (
                      <option key={i} value={dp.name}>
                        {dp.name} {dp.time ? `(${dp.time})` : ""}
                      </option>
                    ))}
                    {!tripData.droppingPoints?.length && (
                      <option value={`${tripData.toCity || tripData.to} Central Station`}>
                        {tripData.toCity || tripData.to} Central Station ({tripData.arrivalTime})
                      </option>
                    )}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Fare Summary & Sticky Checkout */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs sticky top-40">
              <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4">
                Fare Summary
              </h3>

              {/* Selected Seats List */}
              <div className="mb-4">
                <div className="text-xs text-gray-500 font-medium mb-1.5">Selected Seats</div>
                {selectedSeats.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedSeats.map((s) => (
                      <span
                        key={s}
                        className="bg-red-50 text-red-600 border border-red-200 text-xs font-bold px-2.5 py-1 rounded-lg"
                      >
                        Seat {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No seats selected yet</p>
                )}
              </div>

              {/* Cost Breakdown */}
              <div className="space-y-2.5 text-xs border-t border-gray-100 pt-4 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Base Fare ({fareSummary.seatCount} seats)</span>
                  <span className="font-semibold text-gray-900">₹{fareSummary.baseFare}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>GST & Service Taxes (5%)</span>
                  <span className="font-semibold text-gray-900">₹{fareSummary.tax}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-gray-900 border-t border-gray-200 pt-3">
                  <span>Total Amount</span>
                  <span className="text-red-600">₹{fareSummary.totalAmount}</span>
                </div>
              </div>

              {/* Guarantee Note */}
              <div className="flex items-start gap-2 bg-emerald-50 text-emerald-800 p-3 rounded-xl text-xs mb-6 border border-emerald-100">
                <ShieldCheck size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                <span>
                  Seats are held for 10 minutes upon proceeding to guarantee zero double bookings.
                </span>
              </div>

              {/* Proceed Button */}
              <button
                type="button"
                disabled={selectedSeats.length === 0 || locking}
                onClick={handleProceed}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {locking ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Holding Seats...
                  </>
                ) : (
                  <>
                    Proceed to Passenger Details <ArrowRight size={16} />
                  </>
                )}
              </button>

              {selectedSeats.length === 0 && (
                <p className="text-[11px] text-center text-gray-400 mt-2">
                  Select at least 1 seat on the layout to proceed
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
