// src/pages/BusTimetable.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarClock, Search, Loader2, AlertCircle } from "lucide-react";
import api from "../services/api";
import CitySearchInput from "../components/CitySearchInput";

export default function BusTimetable() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [buses, setBuses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;
    api.buses.getAll()
      .then((res) => {
        if (isMounted) setBuses(res.data || []);
      })
      .catch((err) => {
        if (isMounted) setLoadError(err.message || "Could not load bus schedules.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const routeMap = buses.reduce((routes, bus) => {
    if (!bus.from || !bus.to) return routes;
    const key = `${bus.from}-${bus.to}`;
    routes[key] ||= { from: bus.from, to: bus.to, departures: [] };
    if (bus.departureTime && !routes[key].departures.includes(bus.departureTime)) {
      routes[key].departures.push(bus.departureTime);
    }
    return routes;
  }, {});

  const filtered = Object.values(routeMap).filter((t) =>
    `${t.from} ${t.to}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section className="max-w-4xl mx-auto px-4 py-10">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="flex items-center gap-2 mb-2">
        <CalendarClock className="text-orange-600" size={26} />
        <h1 className="text-2xl font-bold text-gray-900">Bus Timetable</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Local bus timings between cities in your state.
      </p>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
        <CitySearchInput id="timetable-city" variant="city" value={query} onChange={setQuery}
          placeholder="Search route by city, e.g. Ahmedabad"
          className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 focus-within:border-orange-400 focus-within:ring-1 focus-within:ring-orange-400"
          inputClassName="w-full text-sm outline-none" />
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 text-center py-10"><Loader2 size={18} className="inline mr-2 animate-spin" />Loading schedules...</p>
      ) : loadError ? (
        <p className="text-sm text-red-600 text-center py-10" role="alert"><AlertCircle size={18} className="inline mr-2" />{loadError}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">No routes match your search.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <div key={`${t.from}-${t.to}`} className="border border-gray-200 rounded-2xl p-5 bg-white">
              <p className="font-bold text-gray-900 mb-3">
                {t.from} <span className="text-gray-400 font-normal">→</span> {t.to}
              </p>
              <div className="flex flex-wrap gap-2">
                {t.departures.map((d) => (
                  <span
                    key={d}
                    className="text-xs font-semibold bg-orange-50 text-orange-700 rounded-full px-3 py-1.5"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}