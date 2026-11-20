// src/admin/pages/AdminRoutes.jsx
import { useCallback, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Map } from "lucide-react";
import api from "../../services/api";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import Drawer from "../components/Drawer";
import Toast from "../components/Toast";
import StatusBadge from "../components/StatusBadge";
import CitySearchInput from "../../components/CitySearchInput";

const FIELDS = [
  { key: "fromCity", label: "From City *", type: "text", required: true },
  { key: "toCity", label: "To City *", type: "text", required: true },
  { key: "distanceKm", label: "Distance (km)", type: "number", min: 1 },
  { key: "estimatedDuration", label: "Est. Duration", type: "text", placeholder: "5h 30m" },
];

function empty() { return { fromCity: "", toCity: "", distanceKm: "", estimatedDuration: "", active: true }; }

export default function AdminRoutes() {
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  const fetchData = useCallback(async (params) => {
    const res = await api.admin.routes.getAll({ page: params.page, limit: params.limit, search: params.q });
    return { data: res.data, total: res.total || res.count, totalPages: res.totalPages || 1 };
  }, []);

  function openAdd() { setForm(empty()); setFormError(""); setDrawer({ mode: "add" }); }
  function openEdit(r) { setForm({ ...r }); setFormError(""); setDrawer({ mode: "edit", record: r }); }

  async function handleSave() {
    if (!form.fromCity?.trim() || !form.toCity?.trim()) { setFormError("From and To cities are required."); return; }
    const [fromCity, toCity] = await Promise.all([fromRef.current.validate(), toRef.current.validate()]);
    if (!fromCity || !toCity) return;
    if (fromCity.name.toLocaleLowerCase() === toCity.name.toLocaleLowerCase()) {
      setFormError("From and To cities must be different.");
      return;
    }
    setSaving(true); setFormError("");
    try {
      const payload = { ...form, fromCity: fromCity.name, toCity: toCity.name, distanceKm: Number(form.distanceKm) || 250 };
      if (drawer.mode === "add") { await api.admin.routes.create(payload); showToast("Route created."); }
      else { await api.admin.routes.update(drawer.record._id, payload); showToast("Route updated."); }
      setDrawer(null); setReloadKey(k => k + 1);
    } catch (e) { setFormError(e.message || "Save failed."); }
    finally { setSaving(false); }
  }

  const columns = [
    { key: "route", label: "Route", render: r => <span className="font-semibold text-xs text-gray-900">{r.fromCity} → {r.toCity}</span>, exportValue: r => `${r.fromCity} → ${r.toCity}` },
    { key: "distanceKm", label: "Distance", render: r => <span className="text-xs text-gray-600">{r.distanceKm ? `${r.distanceKm} km` : "—"}</span> },
    { key: "estimatedDuration", label: "Duration", render: r => <span className="text-xs text-gray-600">{r.estimatedDuration || "—"}</span> },
    { key: "active", label: "Status", render: r => <StatusBadge status={r.active ? "ACTIVE" : "EXPIRED"} label={r.active ? "Active" : "Inactive"} /> },
  ];

  const rowActions = (r, reload, setDeleteTarget) => (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={14} /></button>
      <button onClick={() => setDeleteTarget({ confirmMessage: `Delete route "${r.fromCity} → ${r.toCity}"?`, onConfirm: async () => { await api.admin.routes.delete(r._id); showToast("Deleted."); } })} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Routes" subtitle="Manage bus routes"
        actions={<button onClick={openAdd} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl px-4 py-2"><Plus size={15} /> Add Route</button>}
      />
      <DataTable key={reloadKey} columns={columns} fetchData={fetchData} searchPlaceholder="Search routes…"
        rowActions={rowActions} emptyIcon={<Map size={40} className="text-gray-200" />} emptyMessage="No routes yet." filename="routes" />
      <Drawer open={!!drawer} title={drawer?.mode === "add" ? "Add Route" : "Edit Route"} onClose={() => setDrawer(null)}>
        <div className="space-y-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              {f.key === "fromCity" || f.key === "toCity" ? (
                <CitySearchInput ref={f.key === "fromCity" ? fromRef : toRef} id={`admin-route-${f.key}`} label={f.label} variant="city" required
                  value={form[f.key] || ""} onChange={value => setForm(p => ({ ...p, [f.key]: value }))}
                  className="flex flex-col" inputClassName="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
              ) : (
                <>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type === "number" ? "number" : "text"} value={form[f.key] || ""}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder || ""} min={f.min}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
                </>
              )}
            </div>
          ))}
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
            <input type="checkbox" checked={!!form.active} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} className="w-4 h-4 rounded accent-red-600" />
            Active
          </label>
          {formError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDrawer(null)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-semibold text-gray-700">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-600 disabled:opacity-60 rounded-xl py-2 text-sm font-semibold text-white">{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </Drawer>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
