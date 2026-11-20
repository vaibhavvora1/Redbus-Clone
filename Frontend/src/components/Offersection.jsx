import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Tag, Percent, Loader2, AlertCircle } from "lucide-react";
import api from "../services/api";

const FILTERS = ["All", "BUS", "HOTEL", "TRAIN"];

export default function OffersSection() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [offers, setOffers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;
    api.promotions.getAll()
      .then((res) => {
        if (isMounted) setOffers(res.data || []);
      })
      .catch((err) => {
        if (isMounted) setLoadError(err.message || "Could not load offers.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const filtered = offers.filter(
    (o) => activeFilter === "All" || o.category === activeFilter
  );

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Percent className="text-red-600" size={24} />
          <h2 className="text-2xl font-bold text-gray-900">Offers for you</h2>
        </div>
        <Link to="/free-cancellation" className="text-sm font-semibold text-red-600 hover:underline flex items-center gap-1">
          View more <ChevronRight size={16} />
        </Link>
      </div>

      <div className="flex gap-3 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-5 py-2 rounded-full text-sm font-semibold border transition-all hover:scale-105 active:scale-95 ${
              activeFilter === f
                ? "bg-red-600 border-red-600 text-white shadow-md"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-gray-500"><Loader2 size={18} className="inline mr-2 animate-spin" />Loading offers...</div>
      ) : loadError ? (
        <div className="py-10 text-center text-sm text-red-600" role="alert"><AlertCircle size={18} className="inline mr-2" />{loadError}</div>
      ) : filtered.length === 0 && (
        <div className="py-10 text-center text-sm text-gray-500 font-medium">
          No {activeFilter} offers available right now.
        </div>
      )}

      {/* Cards */}
      {!isLoading && !loadError && filtered.length > 0 && (
        <div className="relative overflow-hidden">
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 pt-1">
            {filtered.map((offer, i) => (
              <div
                key={offer.id || i}
                className="min-w-[280px] max-w-[300px] bg-gradient-to-br from-red-50/70 via-pink-50/50 to-orange-50/70 border border-red-100 rounded-2xl p-5 relative shrink-0 shadow-sm hover:shadow-md hover:-translate-y-1 hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {offer.category && <span className="inline-block bg-gray-900 text-white text-xs font-semibold px-2.5 py-1 rounded-full mb-3 shadow-xs">{offer.category}</span>}
                  <h3 className="font-bold text-gray-900 leading-snug mb-2 pr-4 text-base">
                    {offer.title}
                  </h3>
                  <p className="text-xs text-gray-500 mb-4 font-medium">{offer.subtitle}</p>
                </div>
                {offer.cta && <div className="inline-flex items-center gap-2 bg-white/90 border border-dashed border-red-300 rounded-xl px-3 py-1.5 shadow-xs w-fit"><Tag size={14} className="text-red-500" /><span className="text-sm font-bold text-red-600 tracking-wide">{offer.cta}</span></div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}