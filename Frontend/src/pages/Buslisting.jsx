import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Star, Clock, Bus, SlidersHorizontal, ArrowUpDown, AlertCircle, Calendar } from "lucide-react";
import api from "../services/api";
import CitySearchInput from "../components/CitySearchInput";

/**
 * BusListing
 *
 * Presentational and storage-connected bus search results page.
 * Reads admin-created schedules from localStorage ('busSchedules')
 * and merges with any provided `buses` prop.
 */
export default function BusListing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get("from") || searchParams.get("source") || "";
  const to = searchParams.get("to") || searchParams.get("destination") || "";
  const date = searchParams.get("date") || "";
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifiedFrom, setModifiedFrom] = useState(from);
  const [modifiedTo, setModifiedTo] = useState(to);
  const [modifiedDate, setModifiedDate] = useState(date);
  const [modifyError, setModifyError] = useState("");
  const fromRef = useRef(null);
  const toRef = useRef(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Mirror URL values into the editable search draft.
    setModifiedFrom(from);
    setModifiedTo(to);
    setModifiedDate(date);
  }, [from, to, date]);

  const submitModifiedSearch = async () => {
    setModifyError("");
    const [selectedFrom, selectedTo] = await Promise.all([
      fromRef.current.validate(),
      toRef.current.validate(),
    ]);
    if (!selectedFrom || !selectedTo) return;
    if (selectedFrom.name.toLocaleLowerCase() === selectedTo.name.toLocaleLowerCase()) {
      setModifyError("Departure and destination cannot be the same city.");
      return;
    }
    const params = new URLSearchParams(searchParams);
    params.set("from", selectedFrom.name);
    params.set("to", selectedTo.name);
    if (modifiedDate) params.set("date", modifiedDate);
    setSearchParams(params);
    setModifyOpen(false);
  };

  const formattedDate = date
    ? new Date(date).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  const [acFilter, setAcFilter] = useState("ALL"); // ALL | AC | NON_AC
  const [typeFilter, setTypeFilter] = useState("ALL"); // ALL | SLEEPER | SEATER
  const [sortBy, setSortBy] = useState("PRICE_LOW"); // PRICE_LOW | PRICE_HIGH | RATING

  // Fetch bus schedules from MongoDB backend (filtered by route + date)
  const [scheduledBuses, setScheduledBuses] = useState([]);
  const [busLoading, setBusLoading] = useState(false);
  const [busError, setBusError] = useState("");

  useEffect(() => {
    let isMounted = true;
    const loadBuses = async () => {
      setBusLoading(true);
      setBusError("");
      try {
        const res = await api.buses.getAll({ from, to, date });
        if (!isMounted) return;
        const list = res.data || [];

        const mapped = list.map((s) => {
          const busTypeStr = (s.busType || s.type || "").toLowerCase();
          const isAc = busTypeStr.includes("ac") && !busTypeStr.includes("non-ac");
          const isSleeper = busTypeStr.includes("sleeper");

          const dep = s.departureTime || "";
          const arr = s.arrivalTime || "";
          let duration = "—";
          if (dep && arr) {
            const [dh, dm] = dep.split(":").map(Number);
            const [ah, am] = arr.split(":").map(Number);
            let diff = ah * 60 + am - (dh * 60 + dm);
            if (diff <= 0) diff += 24 * 60;
            const h = Math.floor(diff / 60);
            const m = diff % 60;
            duration = `${h}h ${m > 0 ? `${m}m` : "00m"}`;
          }

          return {
            id: s._id,
            name: s.operator + (s.busNumber ? ` (${s.busNumber})` : ""),
            type: s.busType || s.type || "—",
            departure: s.departureTime || "—",
            arrival: s.arrivalTime || "—",
            duration,
            rating: s.rating,
            price: Number(s.fare ?? s.price),
            seats: s.totalSeats,
            amenities: Array.isArray(s.amenities) ? s.amenities : [],
            isAc,
            isSleeper,
          };
        });

        setScheduledBuses(mapped);
      } catch {
        if (isMounted) {
          setBusError("Could not load buses from server. Please try again.");
          setScheduledBuses([]);
        }
      } finally {
        if (isMounted) setBusLoading(false);
      }
    };

    loadBuses();
    return () => { isMounted = false; };
  }, [from, to, date]);

  const filteredBuses = scheduledBuses
    .filter((b) => {
      if (acFilter === "AC" && !b.isAc) return false;
      if (acFilter === "NON_AC" && b.isAc) return false;
      if (typeFilter === "SLEEPER" && !b.isSleeper) return false;
      if (typeFilter === "SEATER" && b.isSleeper) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "PRICE_LOW") return a.price - b.price;
      if (sortBy === "PRICE_HIGH") return b.price - a.price;
      if (sortBy === "RATING") return b.rating - a.rating;
      return 0;
    });

  return (
    <>
      {/* Route Header Banner */}
      <div className="bg-gray-900 text-white py-8 px-4 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 text-2xl md:text-3xl font-extrabold tracking-tight">
              <span>{from}</span>
              <span className="text-red-500">→</span>
              <span>{to}</span>
            </div>
            <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
              <Clock size={14} /> Journey Date: <span className="text-white font-semibold">{formattedDate}</span> | {busLoading ? "Loading buses..." : `${filteredBuses.length} Buses Available`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModifyOpen((open) => !open)}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition shadow-md w-fit"
          >
            {modifyOpen ? "Close Search" : "Modify Search"}
          </button>
        </div>
        {modifyOpen && (
          <div className="max-w-6xl mx-auto mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
            <CitySearchInput ref={fromRef} id="bus-modify-from" variant="city" label="From" value={modifiedFrom}
              onChange={setModifiedFrom} required placeholder="Departure city"
              className="rounded-xl bg-white px-4 py-2 text-gray-800"
              inputClassName="w-full outline-none" />
            <CitySearchInput ref={toRef} id="bus-modify-to" variant="city" label="To" value={modifiedTo}
              onChange={setModifiedTo} required placeholder="Destination city"
              className="rounded-xl bg-white px-4 py-2 text-gray-800"
              inputClassName="w-full outline-none" />
            <label className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs text-gray-500">
              <Calendar size={15} className="text-red-500" />
              <span>Date</span>
              <input type="date" value={modifiedDate} onChange={(event) => setModifiedDate(event.target.value)}
                className="min-w-0 text-sm text-gray-800 outline-none" aria-label="Journey date" />
            </label>
            <button type="button" onClick={submitModifiedSearch}
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-50">
              Search
            </button>
            {modifyError && <p className="sm:col-span-2 lg:col-span-4 text-sm text-red-300" role="alert">{modifyError}</p>}
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8 items-start">
        {/* Filter Sidebar */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2 font-bold text-gray-900 text-lg">
                <SlidersHorizontal size={18} className="text-red-600" />
                <span>Filters</span>
              </div>
              <button
                onClick={() => {
                  setAcFilter("ALL");
                  setTypeFilter("ALL");
                  setSortBy("PRICE_LOW");
                }}
                className="text-xs text-red-600 hover:underline font-semibold"
              >
                Reset All
              </button>
            </div>

            {/* AC / Non-AC */}
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">Bus Type</label>
              <div className="flex flex-col gap-2">
                {[
                  { label: "All Buses", value: "ALL" },
                  { label: "A/C Buses", value: "AC" },
                  { label: "Non-A/C Buses", value: "NON_AC" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAcFilter(opt.value)}
                    className={`text-left text-sm px-3.5 py-2 rounded-xl border transition-all ${
                      acFilter === opt.value
                        ? "bg-red-50 border-red-500 text-red-700 font-bold"
                        : "bg-gray-50/50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Seater / Sleeper */}
            <div className="mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">Seat Class</label>
              <div className="flex flex-col gap-2">
                {[
                  { label: "All Classes", value: "ALL" },
                  { label: "Sleeper Berths", value: "SLEEPER" },
                  { label: "Seater Seats", value: "SEATER" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTypeFilter(opt.value)}
                    className={`text-left text-sm px-3.5 py-2 rounded-xl border transition-all ${
                      typeFilter === opt.value
                        ? "bg-red-50 border-red-500 text-red-700 font-bold"
                        : "bg-gray-50/50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bus List & Sorting */}
        <div className="flex-1 w-full min-h-[600px]">
          {/* Sorting Header */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <ArrowUpDown size={16} className="text-red-500" />
              <span>Sort By:</span>
            </div>
            <div className="flex gap-2">
              {[
                { label: "Price: Low to High", value: "PRICE_LOW" },
                { label: "Price: High to Low", value: "PRICE_HIGH" },
                { label: "Customer Rating", value: "RATING" },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSortBy(s.value)}
                  className={`text-xs md:text-sm px-3.5 py-1.5 rounded-full border transition-all ${
                    sortBy === s.value
                      ? "bg-red-600 border-red-600 text-white font-semibold"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Empty State */}
          {busLoading ? (
            <div className="space-y-4" role="status" aria-label="Loading buses">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="skeleton h-32 rounded-2xl" />
              ))}
            </div>
          ) : busError ? (
            <div className="bg-white rounded-2xl border border-red-200 p-8 text-center text-sm text-red-600" role="alert">
              <AlertCircle size={20} className="inline mr-2" />{busError}
            </div>
          ) : filteredBuses.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center flex flex-col items-center gap-3">
              <Bus size={48} className="text-gray-300" />
              <h3 className="text-xl font-bold text-gray-800">No buses available</h3>
                <p className="text-sm text-gray-500 max-w-md">
                We couldn't find any buses running between <span className="font-semibold text-gray-700">{from}</span> and <span className="font-semibold text-gray-700">{to}</span> on {formattedDate}. Try modifying your search route or date.
              </p>
              <button
                onClick={() => navigate("/")}
                className="mt-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-full text-sm transition shadow-sm"
              >
                Search Another Route
              </button>
            </div>
          )}

          {/* Bus List */}
          {!busLoading && !busError && filteredBuses.length > 0 && (
            <div className="result-list space-y-4">
              {filteredBuses.map((bus) => (
                <div
                  key={bus.id}
                  className="result-card motion-lift bg-white rounded-2xl border border-gray-200 p-6 shadow-xs hover:border-red-200 flex flex-col md:flex-row justify-between gap-6 group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-red-600 transition-colors">
                        {bus.name}
                      </h3>
                      {bus.rating != null && <span className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        <Star size={10} fill="white" /> {bus.rating}
                      </span>}
                    </div>
                    <p className="text-xs font-medium text-gray-500 mb-4">{bus.type}</p>

                    <div className="flex items-center gap-6 text-gray-800 mb-4">
                      <div>
                        <span className="text-xl font-extrabold">{bus.departure}</span>
                        <span className="block text-xs text-gray-400">Departure</span>
                      </div>
                      <div className="text-center px-4 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                        {bus.duration}
                      </div>
                      <div>
                        <span className="text-xl font-extrabold">{bus.arrival}</span>
                        <span className="block text-xs text-gray-400">Arrival</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {bus.amenities.map((item) => (
                        <span key={item} className="text-[11px] font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-start md:items-end border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                    <div>
                      <div className="text-xs text-gray-400 font-medium">Starts from</div>
                      <div className="text-3xl font-extrabold text-gray-900">{Number.isFinite(bus.price) ? `₹${bus.price}` : "—"}</div>
                      {bus.seats != null && <div className="text-xs text-amber-600 font-semibold mt-1">{bus.seats} total seats</div>}
                    </div>

                    <button
                      onClick={() => {
                        navigate(`/booking/${bus.id}`);
                      }}
                      className="mt-4 w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-7 py-3 rounded-full shadow-sm hover:shadow-md transition cursor-pointer"
                    >
                      SELECT SEATS
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}