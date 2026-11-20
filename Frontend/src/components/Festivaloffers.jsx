import { useEffect, useState } from "react";
import { Sparkles, Calendar, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import api from "../services/api";

const CARD_STYLES = [
  { bg: "bg-orange-50", accent: "text-orange-600" },
  { bg: "bg-pink-50", accent: "text-pink-600" },
  { bg: "bg-amber-50", accent: "text-amber-600" },
  { bg: "bg-purple-50", accent: "text-purple-600" },
];

export default function FestivalOffers() {
  const [promotions, setPromotions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;
    api.promotions.getAll()
      .then((res) => {
        if (isMounted) setPromotions(res.data || []);
      })
      .catch((err) => {
        if (isMounted) setLoadError(err.message || "Could not load promotions.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-red-600 text-sm font-semibold mb-1">
            <Sparkles size={16} />
            <span>FESTIVAL BANNERS</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            Book bus tickets for upcoming festivals
          </h2>
          <p className="text-gray-500 mt-1 text-sm md:text-base">
            Popular festival routes — book early to lock in the best fares
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" />Loading promotions...</div>
      ) : loadError ? (
        <div className="py-10 text-center text-sm text-red-600" role="alert"><AlertCircle size={18} className="inline mr-2" />{loadError}</div>
      ) : promotions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Sparkles size={32} className="text-gray-300" />
          <p className="text-sm text-gray-500 font-medium">
            No festival offers available right now — check back soon!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {promotions.map((promo, idx) => {
            const style = CARD_STYLES[idx % CARD_STYLES.length];
            const bg = promo.bg || style.bg;
            const accent = promo.accent || style.accent;
            return (
              <div
                key={promo._id}
                className={`${bg} rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all cursor-pointer relative overflow-hidden group`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/30 rounded-full blur-xl transform translate-x-8 -translate-y-8 group-hover:scale-150 transition-transform" />
                <div className={`text-xs font-bold ${accent} uppercase tracking-wider mb-2 flex items-center gap-1`}>
                  <Calendar size={12} />
                  <span>{promo.cta}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-red-600 transition-colors">
                  {promo.title}
                </h3>
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {promo.subtitle}
                </p>
                <div className="flex items-center justify-between text-sm font-semibold text-gray-800 border-t border-gray-200/80 pt-3">
                  <span>{promo.cta}</span>
                  <ArrowRight
                    size={16}
                    className="text-gray-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}