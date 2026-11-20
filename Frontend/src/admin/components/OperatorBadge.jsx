import { getOperatorColor } from "../../utils/operatorColor";

export default function OperatorBadge({ name, className = "" }) {
  const label = String(name || "").trim() || "Unknown";
  return (
    <span
      className={`operator-badge ${className}`}
      style={getOperatorColor(label)}
      title={label}
    >
      <span className="operator-dot" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
