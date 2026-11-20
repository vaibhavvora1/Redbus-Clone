// src/admin/pages/AdminPromotions.jsx
import { useCallback, useState } from "react";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import api from "../../services/api";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import Drawer from "../components/Drawer";
import Toast from "../components/Toast";
import StatusBadge from "../components/StatusBadge";

const FIELDS = [
  { key: "title", label: "Title *", type: "text", required: true },
  { key: "subtitle", label: "Subtitle *", type: "text", required: true },
  { key: "cta", label: "CTA Text", type: "text", placeholder: "Know more" },
];

function empty() { return { title: "", subtitle: "", cta: "Know more", isActive: true }; }

export default function AdminPromotions() {
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  const fetchData = useCallback(async (params) => {
    const res = await api.admin.promotions.getAll({ page: params.page, limit: params.limit, search: params.q });
    return { data: res.data, total: res.total || res.count, totalPages: res.totalPages || 1 };
  }, []);

  function openAdd() { setForm(empty()); setFormError(""); setDrawer({ mode: "add" }); }
  function openEdit(p) { setForm({ ...p }); setFormError(""); setDrawer({ mode: "edit", record: p }); }

  async function handleSave() {
    if (!form.title?.trim() || !form.subtitle?.trim()) { setFormError("Title and Subtitle are required."); return; }
    setSaving(true); setFormError("");
    try {
      if (drawer.mode === "add") { await api.admin.promotions.create(form); showToast("Promotion created."); }
      else { await api.admin.promotions.update(drawer.record._id, form); showToast("Promotion updated."); }
      setDrawer(null); setReloadKey(k => k + 1);
    } catch (e) { setFormError(e.message || "Save failed."); }
    finally { setSaving(false); }
  }

  const columns = [
    { key: "title", label: "Title", sortable: true, render: p => <span className="font-semibold text-xs text-gray-900">{p.title}</span> },
    { key: "subtitle", label: "Subtitle", render: p => <span className="text-xs text-gray-600 max-w-xs truncate block">{p.subtitle}</span> },
    { key: "cta", label: "CTA", render: p => <span className="text-xs text-red-600 font-medium">{p.cta || "Know more"}</span> },
    { key: "isActive", label: "Status", render: p => <StatusBadge status={p.isActive ? "ACTIVE" : "EXPIRED"} label={p.isActive ? "Active" : "Inactive"} /> },
  ];

  const rowActions = (p, reload, setDeleteTarget) => (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={14} /></button>
      <button onClick={() => setDeleteTarget({ confirmMessage: `Delete promotion "${p.title}"?`, onConfirm: async () => { await api.admin.promotions.delete(p._id); showToast("Deleted."); } })} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Promotions" subtitle="Manage banners and promotional content"
        actions={<button onClick={openAdd} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl px-4 py-2"><Plus size={15} /> Add Promotion</button>}
      />
      <DataTable key={reloadKey} columns={columns} fetchData={fetchData} searchPlaceholder="Search promotions…"
        rowActions={rowActions} emptyIcon={<Sparkles size={40} className="text-gray-200" />} emptyMessage="No promotions yet." filename="promotions" />
      <Drawer open={!!drawer} title={drawer?.mode === "add" ? "Add Promotion" : "Edit Promotion"} onClose={() => setDrawer(null)}>
        <div className="space-y-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
              <input type="text" value={form[f.key] || ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder || ""} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
            </div>
          ))}
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
            <input type="checkbox" checked={!!form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 rounded accent-red-600" />
            Active (show to users)
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
