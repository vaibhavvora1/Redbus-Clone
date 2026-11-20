// src/admin/pages/AdminTrains.jsx
import { useCallback, useRef, useState } from "react";
import { Plus, Pencil, Trash2, TrainFront } from "lucide-react";
import api from "../../services/api";
import DataTable from "../components/DataTable";
import PageHeader from "../components/PageHeader";
import Drawer from "../components/Drawer";
import Toast from "../components/Toast";
import CitySearchInput from "../../components/CitySearchInput";

const FIELDS = [
  { key: "operator", label: "Train Name *", type: "text", required: true },
  { key: "trainNumber", label: "Train Number *", type: "text", required: true },
  { key: "from", label: "From Station *", type: "text", required: true },
  { key: "to", label: "To Station *", type: "text", required: true },
  { key: "type", label: "Class Name *", type: "text", required: true, placeholder: "Sleeper, 3A, Chair Car…" },
  { key: "classCode", label: "Class Code *", type: "text", required: true, placeholder: "SL, 3A, CC…" },
  { key: "price", label: "Fare (₹) *", type: "number", required: true, min: 1 },
  { key: "departure", label: "Departure *", type: "time", required: true },
  { key: "arrival", label: "Arrival *", type: "time", required: true },
  { key: "duration", label: "Duration", type: "text", placeholder: "8h 00m" },
  { key: "seatsLeft", label: "Seats Available *", type: "number", required: true, min: 1 },
  { key: "validFrom", label: "Valid From", type: "date" },
  { key: "validTo", label: "Valid To", type: "date" },
  { key: "rating", label: "Rating", type: "text", placeholder: "4.1" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function empty() {
  return {
    ...Object.fromEntries(FIELDS.map((field) => [field.key, ""])),
    classCode: "SL",
    departure: "08:00",
    arrival: "16:00",
    seatsLeft: "42",
    runningDays: [0, 1, 2, 3, 4, 5, 6],
    active: true,
  };
}

export default function AdminTrains() {
  const [drawer, setDrawer] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const fromRef = useRef(null);
  const toRef = useRef(null);
  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  const fetchData = useCallback(async (params) => {
    const res = await api.admin.trains.getAll({ page: params.page, limit: params.limit, search: params.q });
    return { data: res.data, total: res.total || res.count, totalPages: res.totalPages || 1 };
  }, []);

  function openAdd() {
    setForm(empty());
    setFormError("");
    setFieldErrors({});
    setDrawer({ mode: "add" });
  }

  function openEdit(train) {
    const trainClass = train.schedule?.classes?.[0];
    setForm({
      ...empty(),
      ...train,
      from: train.from || "",
      to: train.to || "",
      type: trainClass?.name || train.type || "",
      classCode: trainClass?.code || "SL",
      price: String(trainClass?.fare ?? train.price ?? ""),
      seatsLeft: String(trainClass?.seatCount ?? train.seatsLeft ?? 42),
      runningDays: train.schedule?.runningDays || [0, 1, 2, 3, 4, 5, 6],
      validFrom: train.schedule?.validFrom || "",
      validTo: train.schedule?.validTo || "",
      active: train.active !== false,
    });
    setFormError("");
    setFieldErrors({});
    setDrawer({ mode: "edit", record: train });
  }

  async function handleSave() {
    if (!form.operator?.trim() || !form.trainNumber?.trim() || !form.from?.trim() ||
        !form.to?.trim() || !form.type?.trim() || !form.classCode?.trim() || !form.price) {
      setFormError("Complete the required train, station, class, and fare details.");
      return;
    }
    const [from, to] = await Promise.all([fromRef.current.validate(), toRef.current.validate()]);
    if (!from || !to) return;
    if (from.type !== "station" || to.type !== "station") {
      setFormError("Choose a station suggestion for both ends of the route.");
      return;
    }
    if (from.code === to.code || from.city.toLocaleLowerCase() === to.city.toLocaleLowerCase()) {
      setFormError("From and To stations must be in different cities.");
      return;
    }
    setSaving(true);
    setFormError("");
    setFieldErrors({});
    try {
      const payload = {
        ...form,
        from: from.searchValue,
        to: to.searchValue,
        price: Number(form.price),
        seatsLeft: Number(form.seatsLeft),
      };
      if (drawer.mode === "add") {
        await api.admin.trains.create(payload);
        showToast("Train created.");
      } else {
        await api.admin.trains.update(drawer.record._id, payload);
        showToast("Train updated.");
      }
      setDrawer(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      const errors = error.data?.errors;
      if (Array.isArray(errors)) {
        setFieldErrors(Object.fromEntries(errors.map(({ field, message }) => [field, message])));
      }
      setFormError(error.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "operator", label: "Train", sortable: true, render: train => <span className="font-semibold text-xs text-gray-900">{train.operator}</span> },
    { key: "route", label: "Route", render: train => <span className="text-xs">{train.from} → {train.to}</span>, exportValue: train => `${train.from} → ${train.to}` },
    { key: "type", label: "Class", render: train => <span className="text-xs text-red-600 font-medium">{train.schedule?.classes?.map(item => item.name).join(", ") || train.type}</span> },
    { key: "departure", label: "Dep.", render: train => <span className="text-xs font-mono">{train.departure || "—"}</span> },
    { key: "seatsLeft", label: "Seats", render: train => <span className="text-xs font-bold">{train.seatsLeft ?? "—"}</span> },
    { key: "price", label: "Price", sortable: true, render: train => <span className="text-xs font-bold">₹{(train.price || 0).toLocaleString("en-IN")}</span> },
    { key: "visibility", label: "Visible in search", render: train => <span title={train.searchVisibility?.reason} className={`text-xs font-semibold ${train.searchVisibility?.visible ? "text-green-700" : "text-amber-700"}`}>{train.searchVisibility?.visible ? "Yes" : `No (${train.searchVisibility?.reason || "Not published"})`}</span> },
  ];

  const rowActions = (train, reload, setDeleteTarget) => (
    <div className="flex items-center justify-end gap-1">
      <button onClick={() => openEdit(train)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Pencil size={14} /></button>
      <button title="Deactivate train" onClick={() => setDeleteTarget({ confirmMessage: `Deactivate train "${train.operator}"? Existing runs and bookings will be preserved.`, onConfirm: async () => { await api.admin.trains.delete(train._id); showToast("Train deactivated."); } })} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Trains" subtitle="Manage train schedules"
        actions={<button onClick={openAdd} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl px-4 py-2"><Plus size={15} /> Add Train</button>}
      />
      <DataTable key={reloadKey} columns={columns} fetchData={fetchData} searchPlaceholder="Search trains…"
        colorBy="operator" rowActions={rowActions} emptyIcon={<TrainFront size={40} className="text-gray-200" />} emptyMessage="No trains yet." filename="trains" />
      <Drawer open={!!drawer} title={drawer?.mode === "add" ? "Add Train" : "Edit Train"} onClose={() => setDrawer(null)}>
        <div className="space-y-3">
          {FIELDS.map((field) => (
            <div key={field.key}>
              {field.key === "from" || field.key === "to" ? (
                <CitySearchInput ref={field.key === "from" ? fromRef : toRef} id={`admin-train-${field.key}`} label={field.label} variant="train" required
                  value={form[field.key] || ""} onChange={value => setForm(current => ({ ...current, [field.key]: value }))}
                  error={fieldErrors[field.key]}
                  className="flex flex-col" inputClassName="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
              ) : (
                <>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{field.label}</label>
                  <input type={field.type} value={form[field.key] || ""}
                    onChange={event => {
                      setForm(current => ({ ...current, [field.key]: event.target.value }));
                      setFieldErrors(current => ({ ...current, [field.key]: "" }));
                    }}
                    placeholder={field.placeholder || ""} min={field.min}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
                  {fieldErrors[field.key] && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors[field.key]}</p>}
                </>
              )}
            </div>
          ))}
          <fieldset>
            <legend className="block text-xs font-semibold text-gray-700 mb-1">Running days *</legend>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((day, index) => (
                <label key={day} className="flex items-center gap-1 text-xs text-gray-700">
                  <input type="checkbox" checked={form.runningDays.includes(index)}
                    onChange={event => setForm(current => ({
                      ...current,
                      runningDays: event.target.checked
                        ? [...current.runningDays, index].sort()
                        : current.runningDays.filter(value => value !== index),
                    }))} />
                  {day}
                </label>
              ))}
            </div>
            {fieldErrors.runningDays && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.runningDays}</p>}
          </fieldset>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.active !== false} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} />
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
