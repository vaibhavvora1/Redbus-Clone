// src/admin/components/StatusBadge.jsx
const STATUS_STYLES = {
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  SUCCESS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  BLOCKED: "bg-red-50 text-red-700 border-red-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  REFUNDED: "bg-purple-50 text-purple-700 border-purple-200",
  PROCESSED: "bg-purple-50 text-purple-700 border-purple-200",
  PARTIALLY_REFUNDED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  PROCESSING: "bg-blue-50 text-blue-700 border-blue-200",
  INITIATED: "bg-blue-50 text-blue-700 border-blue-200",
  EXPIRED: "bg-gray-100 text-gray-600 border-gray-200",
  ADMIN: "bg-red-50 text-red-700 border-red-200",
  USER: "bg-blue-50 text-blue-700 border-blue-200",
  NOT_APPLICABLE: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function StatusBadge({ status, label }) {
  const key = String(status || "").toUpperCase();
  const style = STATUS_STYLES[key] || "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${style}`}>
      {label || status || "—"}
    </span>
  );
}
