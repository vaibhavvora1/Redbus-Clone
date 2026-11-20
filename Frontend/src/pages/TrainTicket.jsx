import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, ArrowLeftRight, Calendar, Train, Bell, Clock } from "lucide-react";
import Footer from "../components/Footer";
import CitySearchInput from "../components/CitySearchInput";
import { getTodayInAppTZ } from "../utils/timeZone";

export default function TrainTickets() {
  const [searchParams] = useSearchParams();
  const [from, setFrom] = useState(searchParams.get("fromLabel") || searchParams.get("from") || "");
  const [to, setTo] = useState(searchParams.get("toLabel") || searchParams.get("to") || "");
  const [date, setDate] = useState(searchParams.get("date") || getTodayInAppTZ());
  const [routeError, setRouteError] = useState("");
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const navigate = useNavigate();

  const swapStations = () => {
    setFrom(to);
    setTo(from);
    setRouteError("");
  };

  const handleSearch = async () => {
    setRouteError("");
    const [selectedFrom, selectedTo] = await Promise.all([
      fromRef.current.validate(),
      toRef.current.validate(),
    ]);
    if (!selectedFrom || !selectedTo) return;
    if ((selectedFrom.slug && selectedFrom.slug === selectedTo.slug) ||
        selectedFrom.city.toLocaleLowerCase() === selectedTo.city.toLocaleLowerCase()) {
      setRouteError("Departure and destination must be in different cities.");
      return;
    }
    const params = new URLSearchParams({
      from: selectedFrom.searchValue,
      to: selectedTo.searchValue,
      fromLabel: selectedFrom.label,
      toLabel: selectedTo.label,
      fromType: selectedFrom.type,
      toType: selectedTo.type,
      date,
    });
    navigate(`/trainListing?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="bg-gradient-to-r from-red-600 to-red-500 pb-16 pt-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center gap-2 text-white mb-6">
            <Train size={28} />
            <h1 className="text-2xl font-bold">IRCTC Authorized Train Tickets</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr_auto] gap-3 items-center">
              <CitySearchInput
                ref={fromRef}
                id="train-from"
                label="From Station"
                variant="train"
                value={from}
                onChange={setFrom}
                onSelect={() => setRouteError("")}
                placeholder="Enter station or city"
                required
                className="flex flex-col border border-gray-200 rounded-xl px-4 py-2 focus-within:border-red-500 transition"
                inputClassName="outline-none text-sm font-medium text-gray-800"
              />
              <button type="button" onClick={swapStations}
                className="hidden md:flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 hover:bg-gray-100 transition shadow-xs"
                aria-label="Swap stations">
                <ArrowLeftRight size={16} className="text-red-600" />
              </button>
              <CitySearchInput
                ref={toRef}
                id="train-to"
                label="To Station"
                variant="train"
                value={to}
                onChange={setTo}
                onSelect={() => setRouteError("")}
                placeholder="Enter station or city"
                required
                className="flex flex-col border border-gray-200 rounded-xl px-4 py-2 focus-within:border-red-500 transition"
                inputClassName="outline-none text-sm font-medium text-gray-800"
              />
              <div className="flex flex-col border border-gray-200 rounded-xl px-4 py-2 focus-within:border-red-500 transition">
                <label htmlFor="train-date" className="text-xs text-gray-400 flex items-center gap-1 font-medium">
                  <Calendar size={12} className="text-red-500" /> Date
                </label>
                <input id="train-date" type="date" value={date} min={getTodayInAppTZ()} onChange={(event) => setDate(event.target.value)}
                  className="outline-none text-sm font-medium text-gray-800 cursor-pointer" />
              </div>
              <button type="button" onClick={handleSearch}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition">
                <Search size={18} />
                Search Trains
              </button>
            </div>
            <button type="button" onClick={swapStations}
              className="mt-3 flex md:hidden items-center gap-2 text-sm text-red-600 font-semibold"
              aria-label="Swap stations">
              <ArrowLeftRight size={15} /> Swap stations
            </button>
            {routeError && <p className="mt-3 text-xs text-red-600" role="alert">{routeError}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mb-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={18} className="text-red-500" />
            <h2 className="text-lg font-bold text-gray-800">IRCTC Updates</h2>
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className={`flex items-start gap-3 ${item < 2 ? "border-b border-gray-100 pb-3" : ""}`}>
                <Clock size={16} className="text-gray-400 mt-1 shrink-0" />
                <p className="text-sm text-gray-400">Announcement placeholder</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
