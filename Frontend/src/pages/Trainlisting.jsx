import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Star, Clock, Train as TrainIcon, SlidersHorizontal, ArrowUpDown, AlertCircle, Calendar } from "lucide-react";
import api from "../services/api";
import CitySearchInput from "../components/CitySearchInput";
import { formatDate, formatTime } from "../utils/timeZone";

export default function TrainListing() {
  const [searchParams] = useSearchParams();
  return <TrainListingContent key={searchParams.toString()} />;
}

function TrainListingContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get("from") || searchParams.get("source") || "";
  const to = searchParams.get("to") || searchParams.get("destination") || "";
  const fromLabel = searchParams.get("fromLabel") || from;
  const toLabel = searchParams.get("toLabel") || to;
  const date = searchParams.get("date") || "";
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifiedFrom, setModifiedFrom] = useState(fromLabel);
  const [modifiedTo, setModifiedTo] = useState(toLabel);
  const [modifiedDate, setModifiedDate] = useState(date);
  const [modifyError, setModifyError] = useState("");
  const fromRef = useRef(null);
  const toRef = useRef(null);

  const submitModifiedSearch = async () => {
    setModifyError("");
    const [selectedFrom, selectedTo] = await Promise.all([
      fromRef.current.validate(),
      toRef.current.validate(),
    ]);
    if (!selectedFrom || !selectedTo) return;
    if ((selectedFrom.slug && selectedFrom.slug === selectedTo.slug) ||
        selectedFrom.city.toLocaleLowerCase() === selectedTo.city.toLocaleLowerCase()) {
      setModifyError("Departure and destination must be in different cities.");
      return;
    }
    const params = new URLSearchParams(searchParams);
    params.set("from", selectedFrom.searchValue);
    params.set("to", selectedTo.searchValue);
    params.set("fromLabel", selectedFrom.label);
    params.set("toLabel", selectedTo.label);
    params.set("fromType", selectedFrom.type);
    params.set("toType", selectedTo.type);
    if (modifiedDate) params.set("date", modifiedDate);
    else params.delete("date");
    setSearchParams(params);
    setModifyOpen(false);
  };

  const formattedDate = date
    ? formatDate(date, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  const [acFilter, setAcFilter] = useState("ALL"); // ALL | AC | NON_AC
  const [classFilter, setClassFilter] = useState("ALL"); // ALL | SLEEPER | AC3 | AC2 | AC1
  const [sortBy, setSortBy] = useState("PRICE_LOW"); // PRICE_LOW | PRICE_HIGH | RATING

  const [fetchedTrains, setFetchedTrains] = useState([]);
  const [loadedSearchKey, setLoadedSearchKey] = useState("");
  const [loadErrorState, setLoadErrorState] = useState({ key: "", message: "" });
  const searchKey = `${from}|${to}|${date}`;
  const isLoading = loadedSearchKey !== searchKey;
  const loadError = loadErrorState.key === searchKey ? loadErrorState.message : "";

  useEffect(() => {
    let isMounted = true;
    const requestKey = searchKey;
    api.trains.getAll({ from, to, date })
      .then((res) => {
        if (!isMounted) return;
        const list = (res.data || []).map((t) => {
          const typeStr = (t.type || (t.classes || []).map((trainClass) => trainClass.name).join(" ")).toLowerCase();
          const isAc = typeStr.includes("ac") || typeStr.includes("chair car") || typeStr.includes("3-tier");
          return {
            id: t.trainRunId || t._id,
            name: t.trainName || t.operator,
            classType: (t.classes || []).map((trainClass) => trainClass.name).join(", ") || t.type,
            departure: t.departureAt ? formatTime(t.departureAt) : t.departure,
            arrival: t.arrivalAt ? formatTime(t.arrivalAt) : t.arrival,
            duration: t.durationMinutes != null
              ? `${Math.floor(t.durationMinutes / 60)}h ${String(t.durationMinutes % 60).padStart(2, "0")}m`
              : t.duration,
            rating: t.rating,
            price: Number((t.classes || []).reduce((best, trainClass) =>
              Number(trainClass.fare) < Number(best?.fare ?? Infinity) ? trainClass : best, null)?.fare ?? t.price),
            seatsLeft: (t.classes || []).reduce((best, trainClass) =>
              Number(trainClass.fare) < Number(best?.fare ?? Infinity) ? trainClass : best, null)?.availableSeats ?? t.seatsLeft,
            cheapestClass: (t.classes || []).reduce((best, trainClass) =>
              Number(trainClass.fare) < Number(best?.fare ?? Infinity) ? trainClass : best, null),
            classes: t.classes || [],
            fromStop: t.from,
            toStop: t.to,
            fromStationCode: t.from?.stationCode || "",
            toStationCode: t.to?.stationCode || "",
            amenities: Array.isArray(t.amenities) ? t.amenities : [],
            isAc,
          };
        });
        setFetchedTrains(list);
        setLoadErrorState({ key: requestKey, message: "" });
      })
      .catch((err) => {
        if (isMounted) {
          setLoadErrorState({
            key: requestKey,
            message: err.message || "Could not load trains. Please try again.",
          });
          setFetchedTrains([]);
        }
      })
      .finally(() => {
        if (isMounted) setLoadedSearchKey(requestKey);
      });
    return () => { isMounted = false; };
  }, [from, to, date, searchKey]);

  const filteredTrains = fetchedTrains
    .filter((t) => {
      if (acFilter === "AC" && !t.isAc) return false;
      if (acFilter === "NON_AC" && t.isAc) return false;
      if (classFilter !== "ALL" && t.classType !== classFilter) return false;
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
              <span>{fromLabel}</span>
              <span className="text-red-500">→</span>
              <span>{toLabel}</span>
            </div>
            <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
              <Clock size={14} /> Journey Date: <span className="text-white font-semibold">{formattedDate}</span> | {isLoading ? "Loading trains..." : `${filteredTrains.length} Trains Available`}
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
          <div className="max-w-6xl mx-auto mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto_auto] gap-3 items-end">
            <CitySearchInput ref={fromRef} id="train-modify-from" variant="train" label="From"
              value={modifiedFrom} onChange={setModifiedFrom} required placeholder="Station or city"
              className="rounded-xl bg-white px-4 py-2 text-gray-800"
              inputClassName="w-full outline-none" />
              <button type="button" onClick={() => {
                setModifiedFrom(modifiedTo);
                setModifiedTo(modifiedFrom);
                setModifyError("");
              }} className="hidden h-10 w-10 items-center justify-center rounded-full bg-white text-red-600 lg:flex"
                aria-label="Swap train stations">
                <ArrowUpDown size={16} />
              </button>
            <CitySearchInput ref={toRef} id="train-modify-to" variant="train" label="To"
              value={modifiedTo} onChange={setModifiedTo} required placeholder="Station or city"
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
                  setClassFilter("ALL");
                  setSortBy("PRICE_LOW");
                }}
                className="text-xs text-red-600 hover:underline font-semibold"
              >
                Reset All
              </button>
            </div>

            {/* AC / Non-AC */}
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">Train Type</label>
              <div className="flex flex-col gap-2">
                {[
                  { label: "All Trains", value: "ALL" },
                  { label: "A/C Trains", value: "AC" },
                  { label: "Non-A/C Trains", value: "NON_AC" },
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

            {/* Class */}
            <div className="mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">Class</label>
              <div className="flex flex-col gap-2">
                {[
                  { label: "All Classes", value: "ALL" },
                  { label: "Sleeper (SL)", value: "SLEEPER" },
                  { label: "AC 3 Tier", value: "AC3" },
                  { label: "AC 2 Tier", value: "AC2" },
                  { label: "AC 1st Class", value: "AC1" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setClassFilter(opt.value)}
                    className={`text-left text-sm px-3.5 py-2 rounded-xl border transition-all ${
                      classFilter === opt.value
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

        {/* Train List & Sorting */}
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
          {isLoading ? (
            <div className="space-y-4" role="status" aria-label="Loading trains">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="skeleton h-32 rounded-2xl" />
              ))}
            </div>
          ) : loadError ? (
            <div className="bg-white rounded-2xl border border-red-200 p-8 text-center text-sm text-red-600" role="alert">
              <AlertCircle size={20} className="inline mr-2" />{loadError}
            </div>
          ) : filteredTrains.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center flex flex-col items-center gap-3">
              <TrainIcon size={48} className="text-gray-300" />
              <h3 className="text-xl font-bold text-gray-800">No trains found</h3>
              <p className="text-sm text-gray-500 max-w-md">
                We couldn't find any trains running between <span className="font-semibold text-gray-700">{fromLabel}</span> and <span className="font-semibold text-gray-700">{toLabel}</span> on {formattedDate}. Try modifying your search route or date.
              </p>
              <button
                onClick={() => navigate("/")}
                className="mt-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-full text-sm transition shadow-sm"
              >
                Search Another Route
              </button>
            </div>
          )}

          {/* Train List */}
          {!isLoading && !loadError && filteredTrains.length > 0 && (
            <div className="result-list space-y-4">
              {filteredTrains.map((train) => (
                <div
                  key={train.id}
                  className="result-card motion-lift bg-white rounded-2xl border border-gray-200 p-6 shadow-xs hover:border-red-200 flex flex-col md:flex-row justify-between gap-6 group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-red-600 transition-colors">
                        {train.name}
                      </h3>
                      {train.rating != null && <span className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        <Star size={10} fill="white" /> {train.rating}
                      </span>}
                    </div>
                    <p className="text-xs font-medium text-gray-500 mb-4">
                      {train.classType}
                    </p>
                    <p className="text-xs text-gray-500 mb-4">
                      {train.fromStop?.stationName || train.fromStop?.city}
                      {train.fromStop?.stationCode ? ` (${train.fromStop.stationCode})` : ""}
                      {" → "}
                      {train.toStop?.stationName || train.toStop?.city}
                      {train.toStop?.stationCode ? ` (${train.toStop.stationCode})` : ""}
                    </p>

                    <div className="flex items-center gap-6 text-gray-800 mb-4">
                      <div>
                        <span className="text-xl font-extrabold">{train.departure}</span>
                        <span className="block text-xs text-gray-400">Departure</span>
                      </div>
                      <div className="text-center px-4 py-1 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                        {train.duration}
                      </div>
                      <div>
                        <span className="text-xl font-extrabold">{train.arrival}</span>
                        <span className="block text-xs text-gray-400">Arrival</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {train.amenities.map((item) => (
                        <span key={item} className="text-[11px] font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-start md:items-end border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                    <div>
                      <div className="text-xs text-gray-400 font-medium">Starts from</div>
                      <div className="text-3xl font-extrabold text-gray-900">{Number.isFinite(train.price) ? `₹${train.price}` : "—"}</div>
                      {train.seatsLeft != null && <div className="text-xs text-amber-600 font-semibold mt-1">{train.seatsLeft} seats left</div>}
                    </div>

                    <button
                      onClick={() => {
                        const params = new URLSearchParams({
                          class: train.cheapestClass?.code || "",
                          fromStationCode: train.fromStationCode,
                          toStationCode: train.toStationCode,
                          date,
                        });
                        navigate(`/train-booking/${train.id}?${params.toString()}`);
                      }}
                      className="mt-4 w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-7 py-3 rounded-full shadow-sm hover:shadow-md transition"
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