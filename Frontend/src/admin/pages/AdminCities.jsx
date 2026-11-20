// src/admin/pages/AdminCities.jsx
import { useCallback, useState } from "react";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import api from "../../services/api";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import Drawer from "../components/Drawer";
import Toast from "../components/Toast";

const FIELDS = [
  { key: "name", label: "City Name *", type: "text", required: true },
  { key: "state", label: "State *", type: "text", required: true },
  { key: "code", label: "Code (e.g. MUM)", type: "text" },
  { key: "aliases", label: "Aliases (comma separated)", type: "text" },
];

function empty() { return { name: "", state: "", code: "", aliases: "", isPopular: false }; }

export default function AdminCities() {
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  const fetchData = useCallback(async (params) => {
    const res = await api.admin.cities.getAll({ page: params.page, limit: params.limit, search: params.q });
    return { data: res.data, total: res.total || res.count, totalPages: res.totalPages || 1 };
  }, []);

  function openAdd() { setForm(empty()); setFormError(""); setDrawer({ mode: "add" }); }
  function openEdit(c) {
    setForm({ ...c, aliases: Array.isArray(c.aliases) ? c.aliases.join(", ") : "" });
    setFormError("");
    setDrawer({ mode: "edit", record: c });
  }

  async function handleSave() {
    if (!form.name?.trim() || !form.state?.trim()) { setFormError("City name and State are required."); return; }
    setSaving(true); setFormError("");
    try {
      const payload = {
        ...form,
        aliases: String(form.aliases || "").split(",").map(alias => alias.trim()).filter(Boolean),
      };
      if (drawer.mode === "add") { await api.admin.cities.create(payload); showToast("City created."); }
      else { await api.admin.cities.update(drawer.record._id, payload); showToast("City updated."); }
      setDrawer(null); setReloadKey(k => k + 1);
    } catch (e) { setFormError(e.message || "Save failed."); }
    finally { setSaving(false); }
  }

  const columns = [
    { key: "name", label: "City", sortable: true, render: c => <span className="font-semibold text-xs text-gray-900">{c.name}</span> },
    { key: "state", label: "State", render: c => <span className="text-xs text-gray-600">{c.state}</span> },
    { key: "code", label: "Code", render: c => <span className="font-mono text-xs text-gray-500">{c.code || "—"}</span> },
    { key: "isPopular", label: "Popular", render: c => <span className={`text-xs font-semibold ${c.isPopular ? "text-emerald-600" : "text-gray-400"}`}>{c.isPopular ? "★ Yes" : "No"}</span> },
  ];

  const rowActions = (c, reload, setDeleteTarget) => (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={14} /></button>
      <button onClick={() => setDeleteTarget({ confirmMessage: `Delete city "${c.name}"?`, onConfirm: async () => { await api.admin.cities.delete(c._id); showToast("Deleted."); } })} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Cities" subtitle="Manage city directory"
        actions={<button onClick={openAdd} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl px-4 py-2"><Plus size={15} /> Add City</button>}
      />
      <DataTable key={reloadKey} columns={columns} fetchData={fetchData} searchPlaceholder="Search cities…"
        rowActions={rowActions} emptyIcon={<Building2 size={40} className="text-gray-200" />} emptyMessage="No cities yet." filename="cities" />
      <Drawer open={!!drawer} title={drawer?.mode === "add" ? "Add City" : "Edit City"} onClose={() => setDrawer(null)}>
        <div className="space-y-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
              <input type="text" value={form[f.key] || ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
            </div>
          ))}
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
            <input type="checkbox" checked={!!form.isPopular} onChange={e => setForm(p => ({ ...p, isPopular: e.target.checked }))} className="w-4 h-4 rounded accent-red-600" />
            Popular City (shown in quick search)
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
