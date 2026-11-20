import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Landmark, Loader2, AlertCircle } from "lucide-react";
import api from "../services/api";

export default function GovernmentBuses() {
  const [operators, setOperators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    api.operators.getAll()
      .then((res) => {
        if (isMounted) {
          setOperators(res.data || []);
        }
      })
      .catch((err) => {
        if (isMounted) setLoadError(err.message || "Could not load government bus operators.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Landmark className="text-red-600" size={26} />
          <h2 className="text-2xl font-bold text-gray-900">Government Buses</h2>
        </div>
        <button
          onClick={() => navigate("/government-buses")}
          className="text-sm font-semibold text-red-600 hover:text-red-700 transition-colors"
        >
          View all
        </button>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-gray-500"><Loader2 size={18} className="inline mr-2 animate-spin" />Loading operators...</div>
      ) : loadError ? (
        <div className="py-10 text-center text-sm text-red-600" role="alert"><AlertCircle size={18} className="inline mr-2" />{loadError}</div>
      ) : operators.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500 font-medium bg-white rounded-2xl border border-gray-100 p-8 shadow-xs">
          No government bus operators available right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {operators.map((op) => (
            <div
              key={op._id || op.name}
              onClick={() => navigate("/government-buses")}
              className="cursor-pointer border border-gray-200 bg-white rounded-2xl overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-1.5 transition-all flex flex-col justify-between group"
            >
              <div className="p-5 flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-12 h-12 rounded-full border-2 ${op.ringColor || "border-red-500"} flex items-center justify-center text-xl bg-gray-50 shrink-0 shadow-xs`}
                  >
                    {op.emoji || "🚌"}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-base leading-tight group-hover:text-red-600 transition-colors">
                      {op.name}
                    </h3>
                    {op.localName && (
                      <p className="text-xs text-gray-500 font-medium truncate max-w-[170px]">
                        {op.localName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mb-3">
                  <span className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    <Star size={10} fill="white" /> {op.rating}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">Rating</span>
                </div>

                {op.services && (
                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                    {op.services}
                  </p>
                )}
              </div>

              {op.offer && (
                <div className="bg-orange-50 border-t border-orange-100 px-5 py-2.5 flex items-center gap-2">
                  <span className="text-orange-500 text-xs font-bold">Offer:</span>
                  <p className="text-xs text-orange-950 font-semibold truncate">
                    {op.offer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}