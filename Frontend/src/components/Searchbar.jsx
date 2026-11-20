import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, Calendar, Search } from "lucide-react";
import CitySearchInput from "./CitySearchInput";
import { addDaysToAppDate, getMaxBookingDateInAppTZ, getTodayInAppTZ } from "../utils/timeZone";

export default function SearchBar() {
  const [searchParams] = useSearchParams();
  const [from, setFrom] = useState(searchParams.get("from") || "");
  const [to, setTo] = useState(searchParams.get("to") || "");
  const [date, setDate] = useState(searchParams.get("date") || getTodayInAppTZ());
  const [womenOnly, setWomenOnly] = useState(false);
  const [routeError, setRouteError] = useState("");
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const navigate = useNavigate();

  const handleSearch = async () => {
    setRouteError("");
    const [selectedFrom, selectedTo] = await Promise.all([
      fromRef.current.validate(),
      toRef.current.validate(),
    ]);
    if (!selectedFrom || !selectedTo) return;
    if (selectedFrom.name.toLocaleLowerCase() === selectedTo.name.toLocaleLowerCase()) {
      setRouteError("Departure and destination cannot be the same city.");
      return;
    }

    const params = new URLSearchParams({ from: selectedFrom.name, to: selectedTo.name, date });
    navigate(`/BusListing?${params.toString()}`);
  };

  const todayStr = getTodayInAppTZ();
  const tomorrowStr = addDaysToAppDate(todayStr, 1);
  const maxDate = getMaxBookingDateInAppTZ();

  return (
    <div className="relative w-full pb-12">
      <div className="bg-white rounded-t-2xl shadow-lg flex flex-col lg:flex-row lg:items-stretch lg:divide-x divide-gray-200">
        <div className="flex-1 flex items-center gap-3 px-5 py-4 lg:px-6 lg:py-6 min-w-0">
          <BusOutline />
          <CitySearchInput
            ref={fromRef}
            id="home-bus-from"
            variant="city"
            label="From"
            value={from}
            onChange={setFrom}
            onSelect={() => setRouteError("")}
            required
            placeholder="Departure city"
            className="flex-1"
            inputClassName="w-full text-lg font-medium text-gray-700 placeholder-gray-400 outline-none"
          />
        </div>

        <div className="relative flex-1 flex items-center gap-3 px-5 py-4 lg:px-6 lg:py-6 min-w-0">
          <button
            type="button"
            onClick={() => {
              setFrom(to);
              setTo(from);
              setRouteError("");
            }}
            className="absolute -left-4 top-1/2 -translate-y-1/2 bg-white border border-gray-200 rounded-full p-1.5 shadow hover:shadow-md transition-shadow z-10 hidden lg:block"
            aria-label="Swap cities"
          >
            <ArrowLeftRight size={14} className="text-red-600" />
          </button>
          <BusOutline />
          <CitySearchInput
            ref={toRef}
            id="home-bus-to"
            variant="city"
            label="To"
            value={to}
            onChange={setTo}
            onSelect={() => setRouteError("")}
            required
            placeholder="Destination city"
            className="flex-1"
            inputClassName="w-full text-lg font-medium text-gray-700 placeholder-gray-400 outline-none"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setFrom(to);
            setTo(from);
            setRouteError("");
          }}
          className="self-center lg:hidden flex items-center gap-2 text-sm text-red-600 font-semibold"
          aria-label="Swap cities"
        >
          <ArrowLeftRight size={14} /> Swap cities
        </button>

        <div className="flex flex-wrap items-center gap-3 px-5 py-4 lg:px-6 lg:py-6 shrink-0">
          <Calendar size={18} className="text-gray-400 shrink-0" />
          <div>
            <label htmlFor="home-bus-date" className="text-xs text-gray-400 block">Date of Journey</label>
            <input
              id="home-bus-date"
              type="date"
              value={date}
              min={todayStr}
              max={maxDate}
              onChange={(event) => setDate(event.target.value)}
              className="text-lg font-semibold text-gray-800 outline-none"
            />
          </div>
          <div className="flex gap-2 ml-2">
            <button type="button" onClick={() => setDate(todayStr)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                date === todayStr ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}>
              Today
            </button>
            <button type="button" onClick={() => setDate(tomorrowStr)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                date === tomorrowStr ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}>
              Tomorrow
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-4 lg:px-6 lg:py-6 shrink-0 ml-auto">
          <div className="w-9 h-9 rounded-full bg-pink-100 flex items-center justify-center text-lg shrink-0">👩</div>
          <div className="whitespace-nowrap">
            <div className="text-sm font-semibold text-gray-800">Booking for women</div>
            <button type="button" className="text-xs text-blue-600 underline">Know more</button>
          </div>
          <button
            type="button"
            onClick={() => setWomenOnly(!womenOnly)}
            className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${
              womenOnly ? "bg-red-500" : "bg-gray-300"
            }`}
            aria-label="Toggle booking for women"
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              womenOnly ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>
      </div>

      {routeError && (
        <p className="absolute left-1/2 -translate-x-1/2 bottom-12 text-xs text-red-600" role="alert">
          {routeError}
        </p>
      )}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2">
        <button
          type="button"
          onClick={handleSearch}
          className="bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-12 py-4 rounded-full shadow-lg flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <Search size={20} />
          Search buses
        </button>
      </div>
    </div>
  );
}

function BusOutline() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" className="text-gray-400 shrink-0" aria-hidden="true">
      <path d="M4 17h1a2 2 0 1 0 4 0h6a2 2 0 1 0 4 0h1V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11Z" />
      <path d="M4 11h16" />
      <circle cx="7" cy="17" r="1" fill="currentColor" />
      <circle cx="17" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}
