const OPERATOR_HUES = [
  0, 22, 44, 66, 88, 110, 132, 154,
  176, 198, 220, 242, 264, 286, 308, 330,
];

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value).trim().toLocaleLowerCase("en")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getOperatorColor(operatorKey) {
  const key = String(operatorKey || "unknown").trim();
  const hue = OPERATOR_HUES[stableHash(key) % OPERATOR_HUES.length];
  return { "--operator-hue": hue };
}

export function getOperatorLabel(row, field = "operator") {
  const value = row?.[field] ?? row?.operatorName ?? (field === "operator" ? row?.vertical : "");
  if (typeof value === "string") return value.trim();
  return String(value?.name || value?.operator || "").trim();
}
