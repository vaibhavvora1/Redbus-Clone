// src/admin/components/StatCard.jsx
export default function StatCard({ icon: Icon, label, value, sub, color = "red", loading }) {
  const colorMap = {
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    indigo: "bg-indigo-50 text-indigo-600",
    gray: "bg-gray-100 text-gray-600",
  };
  const cls = colorMap[color] || colorMap.red;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      {Icon && (
        <div className={`rounded-xl p-3 shrink-0 ${cls}`}>
          <Icon size={20} />
        </div>
      )}
      <div className="min-w-0">
        {loading ? (
          <>
            <div className="h-6 w-20 bg-gray-200 rounded animate-pulse mb-1" />
            <div className="h-3 w-28 bg-gray-100 rounded animate-pulse" />
          </>
        ) : (
          <>
            <p className="text-xl font-extrabold text-gray-900 leading-tight truncate">{value ?? "—"}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5 truncate">{label}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
          </>
        )}
      </div>
    </div>
  );
}
