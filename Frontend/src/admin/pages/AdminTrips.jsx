// src/admin/pages/AdminTrips.jsx
import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, RouteIcon, CircleX, Ticket } from "lucide-react";
import api from "../../services/api";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import Drawer from "../components/Drawer";
import Toast from "../components/Toast";
import StatusBadge from "../components/StatusBadge";
import CitySearchInput from "../../components/CitySearchInput";

const FIELDS = [
  { key: "operator", label: "Operator *", type: "text", required: true },
  { key: "busNumber", label: "Bus Number", type: "text" },
  { key: "fromCity", label: "From City *", type: "text", required: true },
  { key: "toCity", label: "To City *", type: "text", required: true },
  { key: "journeyDate", label: "Journey Date *", type: "date", required: true },
  { key: "departureTime", label: "Departure Time", type: "text", placeholder: "21:00" },
  { key: "arrivalTime", label: "Arrival Time", type: "text", placeholder: "06:00" },
  { key: "busType", label: "Bus Type", type: "text", placeholder: "AC Sleeper" },
  { key: "fare", label: "Fare (₹) *", type: "number", required: true, min: 1 },
  { key: "totalSeats", label: "Total Seats", type: "number", min: 1, max: 100 },
  { key: "duration", label: "Duration", type: "text", placeholder: "8h 30m" },
];

function empty() { return Object.fromEntries(FIELDS.map(f => [f.key, ""])); }

export default function AdminTrips() {
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
    const res = await api.admin.trips.getAll({ page: params.page, limit: params.limit, search: params.q });
    return { data: res.data, total: res.total, totalPages: res.totalPages, currentPage: res.currentPage };
  }, []);

  function openAdd() { setForm(empty()); setFormError(""); setDrawer({ mode: "add" }); }
  function openEdit(t) { setForm({ ...t, journeyDate: t.journeyDate || "" }); setFormError(""); setDrawer({ mode: "edit", record: t }); }

  async function handleSave() {
    if (!form.operator?.trim() || !form.fromCity?.trim() || !form.toCity?.trim() || !form.journeyDate || !form.fare) {
      setFormError("Operator, From, To, Journey Date, and Fare are required.");
      return;
    }
    const [fromCity, toCity] = await Promise.all([fromRef.current.validate(), toRef.current.validate()]);
    if (!fromCity || !toCity) return;
    if (fromCity.name.toLocaleLowerCase() === toCity.name.toLocaleLowerCase()) {
      setFormError("From and To cities must be different.");
      return;
    }
    setSaving(true); setFormError("");
    try {
      const payload = {
        ...form,
        fromCity: fromCity.name,
        toCity: toCity.name,
        fare: Number(form.fare),
        totalSeats: Number(form.totalSeats) || 36,
      };
      if (drawer.mode === "add") {
        await api.admin.trips.create(payload);
        showToast("Trip created.");
      } else {
        await api.admin.trips.update(drawer.record._id, payload);
        showToast("Trip updated.");
      }
      setDrawer(null);
      setReloadKey(k => k + 1);
    } catch (e) { setFormError(e.message || "Save failed."); }
    finally { setSaving(false); }
  }

  const columns = [
    { key: "operator", label: "Operator", sortable: true, render: t => <span className="font-semibold text-xs text-gray-900">{t.operator}</span> },
    { key: "route", label: "Route", render: t => <span className="text-xs">{t.fromCity} → {t.toCity}</span>, exportValue: t => `${t.fromCity} → ${t.toCity}` },
    { key: "journeyDate", label: "Date", sortable: true, render: t => <span className="text-xs text-gray-600">{t.travelDate || t.journeyDate}</span> },
    { key: "departureTime", label: "Dep.", render: t => <span className="text-xs font-mono">{t.departureTime}</span> },
    { key: "busType", label: "Type", render: t => <span className="text-xs text-red-600 font-medium">{t.busType}</span> },
    { key: "availableSeats", label: "Avail.", render: t => <span className="text-xs font-bold">{t.availableSeats}/{t.totalSeats}</span> },
    { key: "fare", label: "Fare", sortable: true, render: t => <span className="text-xs font-bold">₹{(t.fare || t.price || 0).toLocaleString("en-IN")}</span> },
    { key: "active", label: "Status", render: t => <StatusBadge status={t.status === "cancelled" ? "CANCELLED" : t.active ? "ACTIVE" : "INACTIVE"} label={t.status === "cancelled" ? "Cancelled" : t.active ? "Scheduled" : "Inactive"} /> },
  ];

  const rowActions = (t, reload, setDeleteTarget) => (
    <div className="flex items-center justify-end gap-1">
      <Link to={`/admin/bookings?tripId=${t._id}`} title={`View ${t.bookingCount || 0} bookings for this date`}
        className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><Ticket size={14} /></Link>
      {t.status !== "cancelled" && (
        <button title="Cancel this trip date" onClick={async () => {
          const travelDate = t.travelDate || t.journeyDate;
          if (!window.confirm(`Cancel ${t.fromCity} → ${t.toCity} on ${travelDate}?`)) return;
          try {
            const result = await api.admin.trips.cancel(t._id);
            showToast(result.message || "Trip cancelled.");
            reload();
          } catch (error) {
            showToast(error.message || "Could not cancel trip.", "error");
          }
        }} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"><CircleX size={14} /></button>
      )}
      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={14} /></button>
      <button
        onClick={() => setDeleteTarget({
          confirmMessage: `Delete trip "${t.fromCity} → ${t.toCity}" on ${t.journeyDate}?`,
          onConfirm: async () => { await api.admin.trips.delete(t._id); showToast("Trip deleted."); },
        })}
        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
      ><Trash2 size={14} /></button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Trips / Schedules" subtitle="Manage bus trip schedules"
        actions={
          <button onClick={openAdd} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl px-4 py-2">
            <Plus size={15} /> Add Trip
          </button>
        }
      />
      <DataTable key={reloadKey} columns={columns} fetchData={fetchData} searchPlaceholder="Search trips…"
        colorBy="operator" rowActions={rowActions} emptyIcon={<RouteIcon size={40} className="text-gray-200" />} emptyMessage="No trips yet." filename="trips" />
      <Drawer open={!!drawer} title={drawer?.mode === "add" ? "Add Trip" : "Edit Trip"} onClose={() => setDrawer(null)}>
        <div className="space-y-3">
          {FIELDS.map(f => (
            <div key={f.key}>
              {f.key === "fromCity" || f.key === "toCity" ? (
                <CitySearchInput ref={f.key === "fromCity" ? fromRef : toRef} id={`admin-trip-${f.key}`} label={f.label} variant="city" required
                  value={form[f.key] || ""} onChange={value => setForm(p => ({ ...p, [f.key]: value }))}
                  className="flex flex-col" inputClassName="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
              ) : (
                <>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{f.label}</label>
                  <input type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                    value={form[f.key] || ""} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder || ""} min={f.min} max={f.max}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
                </>
              )}
            </div>
          ))}
          {formError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDrawer(null)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl py-2 text-sm font-semibold text-white">{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </Drawer>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
