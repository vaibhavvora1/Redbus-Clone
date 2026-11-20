import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Star,
  Bus,
  Landmark,
  ArrowLeft,
  MapPin,
  Calendar,
  ArrowRight,
  Loader2,
  AlertCircle,
  Clock,
  ShieldCheck,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowLeftRight,
  Search,
} from "lucide-react";
import api from "../services/api";
import { addDaysToAppDate, getMaxBookingDateInAppTZ, getTodayInAppTZ } from "../utils/timeZone";
import CitySearchInput from "../components/CitySearchInput";

export default function GovernmentBusesPage() {
  const [operators, setOperators] = useState([]);
  const [operatorsLoading, setOperatorsLoading] = useState(true);
  const [operatorsError, setOperatorsError] = useState("");
  const [tripResult, setTripResult] = useState({ date: "", buses: [], error: "" });
  const [selectedOperator, setSelectedOperator] = useState(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const travelDate = searchParams.get("date") || getTodayInAppTZ();
  const minDate = getTodayInAppTZ();
  const maxDate = getMaxBookingDateInAppTZ();
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const [searchFrom, setSearchFrom] = useState(from);
  const [searchTo, setSearchTo] = useState(to);
  const [searchError, setSearchError] = useState("");
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const tripsLoading = tripResult.date !== travelDate;
  const governmentBuses = tripResult.date === travelDate ? tripResult.buses : [];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Mirror URL values into the editable search draft.
    setSearchFrom(from);
    setSearchTo(to);
  }, [from, to]);

  useEffect(() => {
    if (!searchParams.get("date")) {
      const next = new URLSearchParams(searchParams);
      next.set("date", getTodayInAppTZ());
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let isMounted = true;
    api.operators.getAll()
      .then((opsRes) => {
        if (isMounted) {
          setOperators((opsRes.data || []).filter((operator) => operator.isGovernment === true));
        }
      })
      .catch((err) => {
        if (isMounted) setOperatorsError(err.message || "Could not load government bus operators.");
      })
      .finally(() => { if (isMounted) setOperatorsLoading(false); });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    api.governmentBuses.getAll({ date: travelDate, from, to })
      .then((response) => {
        if (isMounted) setTripResult({ date: travelDate, buses: response.data || [], error: "" });
      })
      .catch((err) => {
        if (!isMounted) return;
        setTripResult({
          date: travelDate,
          buses: [],
          error: err.code === "NOT_RUNNING_ON_DATE" ? "" : err.message || "Could not load government bus schedules.",
        });
      })
    return () => { isMounted = false; };
  }, [travelDate, from, to]);

  function setTravelDate(date) {
    const next = new URLSearchParams(searchParams);
    next.set("date", date);
    setSearchParams(next);
  }

  async function searchGovernmentBuses() {
    setSearchError("");
    const [selectedFrom, selectedTo] = await Promise.all([
      fromRef.current.validate(),
      toRef.current.validate(),
    ]);
    if (!selectedFrom || !selectedTo) return;
    if (selectedFrom.name.toLocaleLowerCase() === selectedTo.name.toLocaleLowerCase()) {
      setSearchError("Departure and destination cannot be the same city.");
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("from", selectedFrom.name);
    next.set("to", selectedTo.name);
    next.set("date", travelDate);
    setSearchParams(next);
  }

  function swapCities() {
    setSearchFrom(searchTo);
    setSearchTo(searchFrom);
    setSearchError("");
  }

  function openOperator(op) {
    setSelectedOperator(op);
  }

  function closeModal() {
    setSelectedOperator(null);
  }

  // Get active trips for the selected operator
  const operatorTrips = selectedOperator
    ? governmentBuses.filter(
        (b) =>
          b.operator?.toLowerCase() === selectedOperator.name?.toLowerCase() ||
          b.operator?.toLowerCase().includes(selectedOperator.name?.toLowerCase())
      )
    : [];

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors mb-6 cursor-pointer"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="flex items-center gap-2 mb-2">
        <Landmark className="text-red-600" size={26} />
        <h1 className="text-2xl font-bold text-gray-900">Government Buses</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Official State Transport Corporation services across India. Regulated tariffs with zero surge pricing.
      </p>

      <div className="mb-8 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto_1fr_auto] md:items-end">
        <CitySearchInput ref={fromRef} id="government-bus-from" variant="city" label="From" value={searchFrom}
          onChange={setSearchFrom} required placeholder="Departure city"
          className="flex flex-col rounded-xl border border-gray-200 px-4 py-2 focus-within:border-red-500"
          inputClassName="w-full outline-none text-sm text-gray-800" />
        <button type="button" onClick={swapCities}
          className="hidden h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-red-600 md:flex"
          aria-label="Swap cities"><ArrowLeftRight size={16} /></button>
        <CitySearchInput ref={toRef} id="government-bus-to" variant="city" label="To" value={searchTo}
          onChange={setSearchTo} required placeholder="Destination city"
          className="flex flex-col rounded-xl border border-gray-200 px-4 py-2 focus-within:border-red-500"
          inputClassName="w-full outline-none text-sm text-gray-800" />
        <button type="button" onClick={searchGovernmentBuses}
          className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700">
          <Search size={16} /> Search
        </button>
        <button type="button" onClick={swapCities}
          className="flex items-center gap-2 text-sm font-semibold text-red-600 md:hidden"
          aria-label="Swap cities"><ArrowLeftRight size={15} /> Swap cities</button>
        {searchError && <p className="text-sm text-red-600 md:col-span-4" role="alert">{searchError}</p>}
      </div>

      {operatorsLoading ? (
        <div className="py-12 text-center text-sm text-gray-500">
          <Loader2 size={18} className="inline mr-2 animate-spin" />
          Loading government bus operators...
        </div>
      ) : operatorsError ? (
        <div className="py-12 text-center text-sm text-red-600" role="alert">
          <AlertCircle size={18} className="inline mr-2" />
          {operatorsError}
        </div>
      ) : operators.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-500 font-medium bg-white rounded-2xl border border-gray-100 p-8 shadow-xs">
          No government bus operators available right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {operators.map((op) => (
            <button
              key={op._id || op.name}
              onClick={() => openOperator(op)}
              className="text-left border border-gray-200 bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-1.5 transition-all flex flex-col justify-between group cursor-pointer"
            >
              <div className="p-5 flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-12 h-12 rounded-full border-2 ${
                      op.ringColor || "border-red-500"
                    } flex items-center justify-center text-xl bg-gray-50 shrink-0 shadow-xs`}
                  >
                    {op.emoji || "🚌"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 group-hover:text-red-600 transition-colors">
                        {op.name}
                      </span>
                      {op.rating != null && (
                        <span className="flex items-center gap-0.5 bg-emerald-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                          <Star size={10} fill="white" /> {op.rating}
                        </span>
                      )}
                    </div>
                    {op.localName && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{op.localName}</p>
                    )}
                  </div>
                </div>

                {op.services && (
                  <p className="text-xs text-gray-600 mb-4 line-clamp-2">{op.services}</p>
                )}

                <div className="inline-flex items-center gap-1.5 bg-gray-100/80 rounded-full px-3 py-1">
                  <Landmark size={12} className="text-red-500" />
                  <span className="text-[11px] font-medium text-gray-600">
                    Official State Transport • {op.state}
                  </span>
                </div>
              </div>

              {op.offer && (
                <div className="bg-red-50/80 border-t border-red-100 text-center py-2.5 px-3">
                  <p className="text-xs font-semibold text-red-700">{op.offer}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Operator Bus Schedule & Booking Modal */}
      {selectedOperator && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-full border-2 ${
                    selectedOperator.ringColor || "border-red-500"
                  } flex items-center justify-center text-xl bg-gray-50 shrink-0 shadow-xs`}
                >
                  {selectedOperator.emoji || "🚌"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-gray-900 text-xl">{selectedOperator.name}</h2>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-full">
                      Govt RTC
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={11} /> {selectedOperator.state} State Road Transport Corporation
                  </p>
                </div>
              </div>

              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Travel Date Selector */}
            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                <Calendar size={16} className="text-red-600" />
                <span>Travel Date:</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Previous day" disabled={travelDate <= minDate}
                  onClick={() => setTravelDate(addDaysToAppDate(travelDate, -1))}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-40" ><ChevronLeft size={15} /></button>
                <input
                  type="date"
                  value={travelDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => { if (e.target.value) setTravelDate(e.target.value); }}
                  className="bg-white text-xs font-semibold border border-gray-200 rounded-xl px-3 py-1.5 text-gray-800 outline-none focus:border-red-500"
                />
                <button type="button" aria-label="Next day" disabled={travelDate >= maxDate}
                  onClick={() => setTravelDate(addDaysToAppDate(travelDate, 1))}
                  className="p-2 rounded-lg border border-gray-200 disabled:opacity-40" ><ChevronRight size={15} /></button>
              </div>
            </div>

            {/* Live Scheduled Trips */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">
                  Available Scheduled Buses ({operatorTrips.length})
                </h3>
                <span className="text-xs text-gray-400">Select a bus to pick your seats</span>
              </div>

              {tripsLoading ? (
                <div className="space-y-3 mb-6" aria-label="Loading government buses">
                  {[0, 1, 2].map((item) => <div key={item} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />)}
                </div>
              ) : tripResult.date === travelDate && tripResult.error ? (
                <div className="text-center py-8 text-sm text-red-600 bg-red-50 rounded-2xl mb-6">{tripResult.error}</div>
              ) : operatorTrips.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6 mb-6">
                  <Bus size={32} className="text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-800">
                    No government buses on this date
                  </p>
                  <p className="text-xs text-gray-500 mt-1 mb-4">
                    {selectedOperator.name} has no scheduled bus for {travelDate}.
                  </p>
                  <button
                    onClick={() => {
                      closeModal();
                      navigate("/buslisting");
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-full transition shadow-xs cursor-pointer"
                  >
                    View All Bus Schedules
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1 mb-6">
                  {operatorTrips.map((bus) => (
                    <div
                      key={bus._id || bus.id}
                      className="border border-gray-200 rounded-2xl p-4 hover:border-red-300 transition-all bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-gray-900">
                          {bus.from} → {bus.to}
                          </span>
                          <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {bus.busType || "Express"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span className="flex items-center gap-1 font-semibold text-gray-800">
                            <Clock size={12} className="text-red-500" />
                            {bus.departureTime} — {bus.arrivalTime}
                          </span>
                          <span>•</span>
                          <span>{bus.duration || "Direct"}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-semibold">
                            {bus.availableSeats} seats left • {travelDate}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100">
                        <div>
                          <div className="text-[11px] text-gray-400">Fixed Tariff</div>
                          <div className="text-lg font-extrabold text-gray-900">
                            ₹{bus.fare ?? bus.price}
                          </div>
                        </div>

                        {/* Redirects to dynamic /booking/:tripId */}
                        <button
                          onClick={() => {
                            closeModal();
                            navigate(`/booking/${bus.tripId || bus.id}`);
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2.5 px-5 rounded-full shadow-xs hover:shadow-md transition flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                          Select Seats
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Concession & Policy Note */}
              <div className="flex items-start gap-2 bg-emerald-50 text-emerald-800 p-3 rounded-xl text-xs border border-emerald-100">
                <ShieldCheck size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                <span>
                  Official Government Bus booking guarantee. Guaranteed seat allocation upon payment confirmation.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
