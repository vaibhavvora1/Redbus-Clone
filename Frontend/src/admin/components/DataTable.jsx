// src/admin/components/DataTable.jsx
// Reusable table with server-side pagination, search debounce, sort, filters, CSV export, confirm-delete
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import OperatorBadge from "./OperatorBadge";
import { getOperatorColor, getOperatorLabel } from "../../utils/operatorColor";

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <ChevronsUpDown size={13} className="text-gray-300" />;
  return sortDir === "asc"
    ? <ChevronUp size={13} className="text-red-500" />
    : <ChevronDown size={13} className="text-red-500" />;
}

function exportCSV(columns, rows, filename) {
  const header = columns.filter(c => !c.noExport).map(c => `"${c.label}"`).join(",");
  const body = rows.map(row =>
    columns.filter(c => !c.noExport).map(c => {
      const val = c.exportValue ? c.exportValue(row) : (typeof c.render === "function" ? "" : row[c.key] ?? "");
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename || "export"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DataTable({
  columns = [],          // { key, label, render, sortable, noExport, exportValue }
  fetchData,             // async (params) => { data, total, totalPages, currentPage }
  params: extraParams,   // extra query params (filters) from parent — triggers refetch on change
  searchPlaceholder,
  filters,               // [{ key, label, options: [{value,label}] }]
  actions,               // rendered top-right (e.g. Add button)
  rowActions,            // (row, reload) => JSX
  emptyIcon,
  emptyMessage,
  filename,
  pageSize = 10,
  colorBy = "",
}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortDir, setSortDir] = useState("desc");
  const [filterValues, setFilterValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [operatorFilter, setOperatorFilter] = useState("");
  const debounceRef = useRef(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const load = useCallback(async () => {
    if (!fetchData) return;
    setLoading(true);
    setError("");
    try {
      const sort = sortField ? `${sortDir === "desc" ? "-" : ""}${sortField}` : undefined;
      const res = await fetchData({
        page,
        limit: pageSize,
        q: debouncedSearch || undefined,
        sort,
        ...filterValues,
        ...extraParams,
      });
      setRows(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (e) {
      setError(e.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [fetchData, page, pageSize, debouncedSearch, sortField, sortDir, filterValues, extraParams]);

  useEffect(() => {
    const timeout = window.setTimeout(load, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  // Reset page when extra params (filters from parent) change
  const previousExtraParams = useRef(extraParams);
  useEffect(() => {
    if (previousExtraParams.current === extraParams) return undefined;
    previousExtraParams.current = extraParams;
    const timeout = window.setTimeout(() => setPage(1), 0);
    return () => window.clearTimeout(timeout);
  }, [extraParams]);

  function handleSort(key) {
    if (sortField === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(key); setSortDir("desc"); }
    setPage(1);
  }

  function handleFilterChange(key, value) {
    setFilterValues(prev => ({ ...prev, [key]: value || undefined }));
    setPage(1);
  }

  const operatorOptions = colorBy
    ? [...new Set(rows.map((row) => getOperatorLabel(row, colorBy)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
    : [];
  const displayedRows = operatorFilter
    ? rows.filter((row) => getOperatorLabel(row, colorBy) === operatorFilter)
    : rows;

  return (
    <div className="admin-table bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-4 py-3 border-b border-gray-100">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={searchPlaceholder || "Search…"}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-red-400 bg-gray-50/50"
          />
        </div>
        {/* Filters */}
        {filters?.map(f => (
          <select
            key={f.key}
            value={filterValues[f.key] || ""}
            onChange={e => handleFilterChange(f.key, e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-red-400 bg-gray-50/50 text-gray-700"
          >
            <option value="">{f.label}: All</option>
            {f.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}
        {/* Spacer */}
        <div className="flex-1" />
        {/* Count + CSV + Refresh */}
        <div className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
          {!loading && <span>{total} record{total !== 1 ? "s" : ""}</span>}
          <button
            onClick={() => exportCSV(columns, displayedRows, filename)}
            title="Export CSV"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
          >
            <Download size={15} />
          </button>
          <button
            onClick={load}
            disabled={loading}
            title="Refresh"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        {/* Actions (e.g. Add button) */}
        {actions}
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {error}
        </div>
      )}

      {colorBy && operatorOptions.length > 0 && (
        <div className="operator-legend flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
          <span className="mr-1 text-xs font-semibold text-gray-500">Operator colours:</span>
          <button
            type="button"
            aria-pressed={!operatorFilter}
            onClick={() => setOperatorFilter("")}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            All
          </button>
          {operatorOptions.map((name) => (
            <button
              key={name}
              type="button"
              aria-pressed={operatorFilter === name}
              onClick={() => setOperatorFilter((current) => current === name ? "" : name)}
              className={`rounded-full border px-3 py-1.5 hover:bg-gray-50 ${operatorFilter === name ? "border-gray-700 bg-gray-50" : "border-gray-200"}`}
            >
              <OperatorBadge name={name} />
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`text-left font-semibold px-4 py-3 whitespace-nowrap select-none ${col.sortable ? "cursor-pointer hover:text-gray-800" : ""}`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />}
                  </span>
                </th>
              ))}
              {rowActions && <th className="text-right font-semibold px-4 py-3 whitespace-nowrap">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: Math.min(pageSize, 6) }, (_, index) => (
                <tr key={`skeleton-${index}`} aria-hidden="true" className="border-b border-gray-50">
                  <td colSpan={columns.length + (rowActions ? 1 : 0)} className="px-4 py-3">
                    <div className="skeleton h-5 rounded-lg" />
                  </td>
                </tr>
              ))
            ) : displayedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    {emptyIcon && <span className="text-4xl">{emptyIcon}</span>}
                    <p className="text-sm font-medium">
                      {operatorFilter
                        ? `No ${operatorFilter} records on this page.`
                        : emptyMessage || "No records found."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : displayedRows.map((row, i) => {
              const operatorName = colorBy ? getOperatorLabel(row, colorBy) : "";
              return (
                <tr
                  key={row._id || i}
                  style={operatorName ? getOperatorColor(operatorName) : undefined}
                  className={`admin-table-row border-b border-gray-50 last:border-0 hover:bg-gray-50/60 ${operatorName ? "admin-operator-row" : ""}`}
                >
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {colorBy && col.key === colorBy
                        ? <OperatorBadge name={operatorName} />
                        : col.render ? col.render(row) : (row[col.key] ?? "—")}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {rowActions(row, load, setDeleteTarget)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pg = i + 1;
              if (totalPages > 5) {
                if (page <= 3) pg = i + 1;
                else if (page >= totalPages - 2) pg = totalPages - 4 + i;
                else pg = page - 2 + i;
              }
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold ${pg === page ? "bg-red-600 text-white" : "hover:bg-gray-100 text-gray-600"}`}
                >
                  {pg}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Built-in confirm dialog for row delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Confirm Delete"
        message={deleteTarget?.confirmMessage || "Are you sure you want to delete this record? This action cannot be undone."}
        onConfirm={async () => {
          if (deleteTarget?.onConfirm) await deleteTarget.onConfirm();
          setDeleteTarget(null);
          load();
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
