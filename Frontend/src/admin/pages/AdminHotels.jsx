// src/admin/pages/AdminHotels.jsx
import { useCallback, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Hotel } from "lucide-react";
import api from "../../services/api";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import Drawer from "../components/Drawer";
import Toast from "../components/Toast";
import CitySearchInput from "../../components/CitySearchInput";

const FIELDS = [
  { key: "name", label: "Hotel Name *", type: "text", required: true },
  { key: "city", label: "City *", type: "text", required: true },
  { key: "type", label: "Category *", type: "text", required: true, placeholder: "3 Star, 5 Star Luxury…" },
  { key: "price", label: "Price / Night (₹) *", type: "number", required: true, min: 1 },
  { key: "rating", label: "Rating", type: "text", placeholder: "4.20" },
  { key: "roomName", label: "Room Type *", type: "text", required: true, placeholder: "Standard Room" },
  { key: "maxGuests", label: "Guests per Room *", type: "number", required: true, min: 1 },
  { key: "totalRooms", label: "Total Rooms *", type: "number", required: true, min: 1 },
  { key: "roomPrice", label: "Room Price / Night (₹) *", type: "number", required: true, min: 1 },
];

function empty() {
  return {
    ...Object.fromEntries(FIELDS.map((field) => [field.key, ""])),
    roomName: "Standard Room",
    maxGuests: "2",
    totalRooms: "1",
    active: true,
  };
}

export default function AdminHotels() {
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const cityRef = useRef(null);
  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  const fetchData = useCallback(async (params) => {
    const res = await api.admin.hotels.getAll({ page: params.page, limit: params.limit, search: params.q });
    return { data: res.data, total: res.total || res.count, totalPages: res.totalPages || 1 };
  }, []);

  function openAdd() { setForm(empty()); setFormError(""); setFieldErrors({}); setDrawer({ mode: "add" }); }
  function openEdit(h) {
    const room = h.roomTypes?.find(item => item.active) || h.roomTypes?.[0];
    setForm({
      ...empty(),
      ...h,
      roomTypeId: room?._id || "",
      roomName: room?.name || "Standard Room",
      maxGuests: String(room?.maxGuests ?? 2),
      totalRooms: String(room?.totalRooms ?? 1),
      roomPrice: String(room?.pricePerNight ?? h.price ?? ""),
      active: h.active !== false,
    });
    setFormError("");
    setFieldErrors({});
    setDrawer({ mode: "edit", record: h });
  }

  async function handleSave() {
    if (!form.name?.trim() || !form.city?.trim() || !form.type?.trim() ||
        !form.price || !form.roomName?.trim() || !form.maxGuests || !form.totalRooms || !form.roomPrice) {
      setFormError("Complete the required hotel and room details.");
      return;
    }
    const city = await cityRef.current.validate();
    if (!city) return;
    setSaving(true); setFormError(""); setFieldErrors({});
    try {
      const payload = {
        ...form,
        city: city.name,
        price: Number(form.price),
        roomType: {
          ...(form.roomTypeId ? { id: form.roomTypeId } : {}),
          name: form.roomName,
          maxGuests: Number(form.maxGuests),
          totalRooms: Number(form.totalRooms),
          pricePerNight: Number(form.roomPrice),
        },
      };
      if (drawer.mode === "add") { await api.admin.hotels.create(payload); showToast("Hotel created."); }
      else { await api.admin.hotels.update(drawer.record._id, payload); showToast("Hotel updated."); }
      setDrawer(null); setReloadKey(k => k + 1);
    } catch (e) {
      const errors = e.data?.errors;
      if (Array.isArray(errors)) {
        const fieldMap = { "roomType.name": "roomName", "roomType.pricePerNight": "roomPrice" };
        setFieldErrors(Object.fromEntries(errors.map(({ field, message }) => [fieldMap[field] || field.replace(/^roomType\./, ""), message])));
      }
      setFormError(e.message || "Save failed.");
    }
    finally { setSaving(false); }
  }

  const columns = [
    { key: "name", label: "Hotel", sortable: true, render: h => <span className="font-semibold text-xs text-gray-900">{h.name}</span> },
    { key: "city", label: "City", sortable: true, render: h => <span className="text-xs text-gray-600">{h.city}</span> },
    { key: "type", label: "Category", render: h => <span className="text-xs text-red-600 font-medium">{h.type}</span> },
    { key: "rating", label: "Rating", render: h => <span className="text-xs font-semibold text-amber-600">⭐ {h.rating || "—"}</span> },
    { key: "price", label: "Price/Night", sortable: true, render: h => <span className="text-xs font-bold">₹{(h.price || 0).toLocaleString("en-IN")}</span> },
    { key: "visibility", label: "Visible in search", render: h => <span title={h.searchVisibility?.reason} className={`text-xs font-semibold ${h.searchVisibility?.visible ? "text-green-700" : "text-amber-700"}`}>{h.searchVisibility?.visible ? "Yes" : `No (${h.searchVisibility?.reason || "Not published"})`}</span> },
  ];

  const rowActions = (h, reload, setDeleteTarget) => (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => openEdit(h)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={14} /></button>
      <button title="Deactivate hotel" onClick={() => setDeleteTarget({ confirmMessage: `Deactivate hotel "${h.name}"? Existing booking data will be preserved.`, onConfirm: async () => { await api.admin.hotels.delete(h._id); showToast("Hotel deactivated."); } })} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Hotels" subtitle="Manage hotel listings"
        actions={<button onClick={openAdd} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl px-4 py-2"><Plus size={15} /> Add Hotel</button>}
      />
      <DataTable key={reloadKey} columns={columns} fetchData={fetchData} searchPlaceholder="Search hotels…"
        colorBy="name" rowActions={rowActions} emptyIcon={<Hotel size={40} className="text-gray-200" />} emptyMessage="No hotels yet." filename="hotels" />
      <Drawer open={!!drawer} title={drawer?.mode === "add" ? "Add Hotel" : "Edit Hotel"} onClose={() => setDrawer(null)}>
        <div className="space-y-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              {f.key === "city" ? (
                <CitySearchInput ref={cityRef} id="admin-hotel-city" label={f.label} variant="city" required
                  value={form.city || ""} onChange={value => {
                    setForm(p => ({ ...p, city: value }));
                    setFieldErrors(p => ({ ...p, city: "" }));
                  }}
                  error={fieldErrors.city}
                  className="flex flex-col" inputClassName="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
              ) : (
                <>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type === "number" ? "number" : "text"} value={form[f.key] || ""}
                    onChange={e => {
                      setForm(p => ({ ...p, [f.key]: e.target.value }));
                      setFieldErrors(p => ({ ...p, [f.key]: "" }));
                    }}
                    placeholder={f.placeholder || ""} min={f.min}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
                  {fieldErrors[f.key] && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors[f.key]}</p>}
                </>
              )}
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.active !== false} onChange={e => setForm(p => ({ ...p, active: e.target.checked }))} />
            Published / visible in search
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
