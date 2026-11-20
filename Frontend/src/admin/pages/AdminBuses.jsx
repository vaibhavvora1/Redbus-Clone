// src/admin/pages/AdminBuses.jsx
import { useCallback, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Bus } from "lucide-react";
import api from "../../services/api";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import Drawer from "../components/Drawer";
import Toast from "../components/Toast";
import CitySearchInput from "../../components/CitySearchInput";

const FIELDS = [
  { key: "operator", label: "Operator *", type: "text", required: true },
  { key: "busNumber", label: "Bus Number", type: "text" },
  { key: "from", label: "From City *", type: "text", required: true },
  { key: "to", label: "To City *", type: "text", required: true },
  { key: "busType", label: "Bus Type", type: "text", placeholder: "AC Sleeper" },
  { key: "totalSeats", label: "Total Seats *", type: "number", required: true, min: 1, max: 100 },
  { key: "fare", label: "Fare (₹) *", type: "number", required: true, min: 1 },
  { key: "departureTime", label: "Departure Time", type: "text", placeholder: "22:00" },
  { key: "arrivalTime", label: "Arrival Time", type: "text", placeholder: "06:00" },
  { key: "journeyDate", label: "Journey Date", type: "date" },
  { key: "validFrom", label: "Schedule Valid From", type: "date" },
  { key: "validTo", label: "Schedule Valid To", type: "date" },
  { key: "runningDays", label: "Running Days (0=Sun, comma separated)", type: "text", placeholder: "0,1,2,3,4,5,6" },
  { key: "isGovernment", label: "Government operator", type: "checkbox" },
  { key: "active", label: "Schedule active", type: "checkbox" },
  { key: "rating", label: "Rating", type: "text", placeholder: "4.5" },
];

function empty() {
  return Object.fromEntries(FIELDS.map(f => [f.key, f.type === "number" ? "" : ""]));
}

export default function AdminBuses() {
  const [drawer, setDrawer] = useState(null); // { mode: "add"|"edit", record? }
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const fromRef = useRef(null);
  const toRef = useRef(null);

  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  const fetchData = useCallback(async (params) => {
    const res = await api.admin.buses.getAll({ page: params.page, limit: params.limit, search: params.q });
    return { data: res.data, total: res.total, totalPages: res.totalPages, currentPage: res.currentPage };
  }, []);

  function openAdd() {
    setForm({ ...empty(), runningDays: "0,1,2,3,4,5,6", active: true, isGovernment: false });
    setFormError("");
    setDrawer({ mode: "add" });
  }
  function openEdit(b) {
    setForm({ ...b, runningDays: (b.runningDays || [0, 1, 2, 3, 4, 5, 6]).join(",") });
    setFormError("");
    setDrawer({ mode: "edit", record: b });
  }

  async function handleSave() {
    if (!form.operator?.trim() || !form.from?.trim() || !form.to?.trim() || !form.fare || !form.totalSeats) {
      setFormError("Operator, From, To, Fare, and Total Seats are required.");
      return;
    }
    const [from, to] = await Promise.all([fromRef.current.validate(), toRef.current.validate()]);
    if (!from || !to) return;
    if (from.name.toLocaleLowerCase() === to.name.toLocaleLowerCase()) {
      setFormError("From and To cities must be different.");
      return;
    }
    setSaving(true); setFormError("");
    try {
      const payload = {
        ...form,
        from: from.name,
        to: to.name,
        runningDays: String(form.runningDays || "0,1,2,3,4,5,6").split(",").map((value) => Number(value.trim())).filter(Number.isInteger),
        fare: Number(form.fare),
        totalSeats: Number(form.totalSeats),
      };
      if (drawer.mode === "add") {
        await api.admin.buses.create(payload);
        showToast("Bus created successfully.");
      } else {
        await api.admin.buses.update(drawer.record._id, payload);
        showToast("Bus updated.");
      }
      setDrawer(null);
      setReloadKey(k => k + 1);
    } catch (e) { setFormError(e.message || "Save failed."); }
    finally { setSaving(false); }
  }

  const columns = [
    { key: "operator", label: "Operator", sortable: true, render: b => <span className="font-semibold text-gray-900 text-xs">{b.operator}</span> },
    { key: "busNumber", label: "Bus No", render: b => <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{b.busNumber || "—"}</span> },
    { key: "route", label: "Route", render: b => <span className="text-xs">{b.from} → {b.to}</span>, exportValue: b => `${b.from} → ${b.to}` },
    { key: "busType", label: "Type", render: b => <span className="text-xs text-red-600 font-medium">{b.busType || b.type || "—"}</span> },
    { key: "totalSeats", label: "Seats", render: b => <span className="text-xs font-semibold">{b.totalSeats}</span> },
    { key: "fare", label: "Fare", sortable: true, render: b => <span className="text-xs font-bold">₹{(b.fare || b.price || 0).toLocaleString("en-IN")}</span> },
    { key: "journeyDate", label: "Date", render: b => <span className="text-xs text-gray-500">{b.journeyDate || "—"}</span> },
  ];

  const rowActions = (b, reload, setDeleteTarget) => (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Edit">
        <Pencil size={14} />
      </button>
      <button
        onClick={() => setDeleteTarget({
          confirmMessage: `Delete bus "${b.busNumber || b.operator}"?`,
          onConfirm: async () => { await api.admin.buses.delete(b._id); showToast("Bus deleted."); },
        })}
        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Buses"
        subtitle="Manage bus fleet"
        actions={
          <button onClick={openAdd} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl px-4 py-2">
            <Plus size={15} /> Add Bus
          </button>
        }
      />
      <DataTable key={reloadKey} columns={columns} fetchData={fetchData} searchPlaceholder="Search buses…"
        colorBy="operator" rowActions={rowActions} emptyIcon={<Bus size={40} className="text-gray-200" />} emptyMessage="No buses yet." filename="buses" />

      <Drawer open={!!drawer} title={drawer?.mode === "add" ? "Add Bus" : "Edit Bus"} onClose={() => setDrawer(null)}>
        <div className="space-y-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              {f.key === "from" || f.key === "to" ? (
                <CitySearchInput ref={f.key === "from" ? fromRef : toRef} id={`admin-bus-${f.key}`} label={f.label} variant="city" required
                  value={form[f.key] || ""} onChange={value => setForm(p => ({ ...p, [f.key]: value }))}
                  className="flex flex-col" inputClassName="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
              ) : f.type === "checkbox" ? (
                <>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
                <input
                  type="checkbox"
                  checked={Boolean(form[f.key])}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.checked }))}
                  className="h-4 w-4 accent-red-600"
                />
                </>
              ) : (
              <>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
              <input
                type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                value={form[f.key] || ""}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder || ""}
                min={f.min}
                max={f.max}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400"
              />
              </>
              )}
            </div>
          ))}
          {formError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDrawer(null)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl py-2 text-sm font-semibold text-white">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Drawer>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
