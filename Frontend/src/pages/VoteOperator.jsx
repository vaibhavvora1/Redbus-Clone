// src/pages/VoteOperator.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Star, Loader2, AlertCircle } from "lucide-react";
import api from "../services/api";

export default function VoteOperator() {
  const navigate = useNavigate();
  const [operators, setOperators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;
    api.operators.getAll()
      .then((res) => {
        if (isMounted) setOperators(res.data || []);
      })
      .catch((err) => {
        if (isMounted) setLoadError(err.message || "Could not load operators.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  return (
    <section className="max-w-3xl mx-auto px-4 py-10">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="text-yellow-500" size={24} />
        <h1 className="text-2xl font-bold text-gray-900">Vote for your favourite BUS OPERATOR</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8">Government bus operators currently available.</p>

      {isLoading ? (
        <p className="py-10 text-center text-sm text-gray-500"><Loader2 size={18} className="inline mr-2 animate-spin" />Loading operators...</p>
      ) : loadError ? (
        <p className="py-10 text-center text-sm text-red-600" role="alert"><AlertCircle size={18} className="inline mr-2" />{loadError}</p>
      ) : operators.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">No operators available.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {operators.map((operator) => (
            <div key={operator._id} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5">
              <div>
                <p className="font-bold text-gray-900">{operator.name}</p>
                <p className="text-xs text-gray-500">{operator.state}</p>
              </div>
              {operator.rating != null && <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700"><Star size={14} className="text-amber-500" />{operator.rating}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}