// src/admin/pages/AdminOperators.jsx
import { useCallback, useState } from "react";
import { Plus, Pencil, Trash2, Landmark } from "lucide-react";
import api from "../../services/api";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import Drawer from "../components/Drawer";
import Toast from "../components/Toast";

const FIELDS = [
  { key: "name", label: "Operator Name *", type: "text", required: true },
  { key: "state", label: "State *", type: "text", required: true },
  { key: "localName", label: "Local Name", type: "text" },
  { key: "rating", label: "Rating", type: "text", placeholder: "3.85" },
  { key: "services", label: "Services", type: "text" },
  { key: "offer", label: "Offer / Concession", type: "text" },
];

function empty() { return { ...Object.fromEntries(FIELDS.map(f => [f.key, ""])), isGovernment: true }; }

export default function AdminOperators() {
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  const fetchData = useCallback(async (params) => {
    const res = await api.admin.operators.getAll({ page: params.page, limit: params.limit, search: params.q });
    return { data: res.data, total: res.total || res.count, totalPages: res.totalPages || 1 };
  }, []);

  function openAdd() { setForm(empty()); setFormError(""); setDrawer({ mode: "add" }); }
  function openEdit(o) { setForm({ ...o }); setFormError(""); setDrawer({ mode: "edit", record: o }); }

  async function handleSave() {
    if (!form.name?.trim() || !form.state?.trim()) { setFormError("Name and State are required."); return; }
    setSaving(true); setFormError("");
    try {
      if (drawer.mode === "add") { await api.admin.operators.create(form); showToast("Operator created."); }
      else { await api.admin.operators.update(drawer.record._id, form); showToast("Operator updated."); }
      setDrawer(null); setReloadKey(k => k + 1);
    } catch (e) { setFormError(e.message || "Save failed."); }
    finally { setSaving(false); }
  }

  const columns = [
    { key: "name", label: "Operator", sortable: true, render: o => <span className="font-semibold text-xs text-gray-900">{o.emoji || "🚌"} {o.name}</span> },
    { key: "state", label: "State", render: o => <span className="text-xs text-gray-600">{o.state}</span> },
    { key: "rating", label: "Rating", render: o => <span className="text-xs font-semibold text-amber-600">⭐ {o.rating || "—"}</span> },
    { key: "isGovernment", label: "Govt.", render: o => <span className={`text-xs font-semibold ${o.isGovernment ? "text-emerald-600" : "text-gray-400"}`}>{o.isGovernment ? "Yes" : "No"}</span> },
  ];

  const rowActions = (o, reload, setDeleteTarget) => (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => openEdit(o)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={14} /></button>
      <button onClick={() => setDeleteTarget({ confirmMessage: `Delete operator "${o.name}"?`, onConfirm: async () => { await api.admin.operators.delete(o._id); showToast("Deleted."); } })} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Operators" subtitle="Government bus operators"
        actions={<button onClick={openAdd} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl px-4 py-2"><Plus size={15} /> Add Operator</button>}
      />
      <DataTable key={reloadKey} columns={columns} fetchData={fetchData} searchPlaceholder="Search operators…"
        colorBy="name" rowActions={rowActions} emptyIcon={<Landmark size={40} className="text-gray-200" />} emptyMessage="No operators yet." filename="operators" />
      <Drawer open={!!drawer} title={drawer?.mode === "add" ? "Add Operator" : "Edit Operator"} onClose={() => setDrawer(null)}>
        <div className="space-y-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
              <input type="text" value={form[f.key] || ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder || ""} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
            </div>
          ))}
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
            <input type="checkbox" checked={!!form.isGovernment} onChange={e => setForm(p => ({ ...p, isGovernment: e.target.checked }))} className="w-4 h-4 rounded accent-red-600" />
            Government Operator
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
