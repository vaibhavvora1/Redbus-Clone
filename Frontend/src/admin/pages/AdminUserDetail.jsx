// src/admin/pages/AdminUserDetail.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Phone, ShieldCheck, User, CalendarDays, Ticket } from "lucide-react";
import api from "../../services/api";
import StatusBadge from "../components/StatusBadge";

function fmt(n) { return (n || 0).toLocaleString("en-IN"); }

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.admin.users.getById(id)
      .then(res => setData(res.data))
      .catch(e => setError(e.message || "Failed to load user"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="space-y-4">
      <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
      <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
    </div>
  );

  if (error) return (
    <div className="text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">{error}</div>
  );

  const user = data;
  return (
    <div>
      <button onClick={() => navigate("/admin/users")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 mb-5">
        <ArrowLeft size={15} /> Back to Users
      </button>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 flex flex-col sm:flex-row gap-4 items-start">
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center text-xl font-extrabold shrink-0">
          {(user.name || user.email || "U").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900">{user.name || "Unknown"}</h2>
            <StatusBadge status={user.role} />
            {user.isBlocked && <StatusBadge status="BLOCKED" label="Blocked" />}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
            {user.email && <span className="flex items-center gap-1"><Mail size={13} />{user.email}</span>}
            {(user.phone || user.mobile) && <span className="flex items-center gap-1"><Phone size={13} />{user.phone || user.mobile}</span>}
            {user.createdAt && <span className="flex items-center gap-1"><CalendarDays size={13} />Joined {new Date(user.createdAt).toLocaleDateString("en-IN")}</span>}
          </div>
        </div>
        <div className="flex gap-3 text-center shrink-0">
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-lg font-extrabold text-gray-900">{fmt(user.totalBookings)}</p>
            <p className="text-[10px] text-gray-500">Bookings</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-lg font-extrabold text-emerald-700">₹{fmt(user.totalSpent)}</p>
            <p className="text-[10px] text-gray-500">Spent</p>
          </div>
        </div>
      </div>

      {/* Bookings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2"><Ticket size={15} />Booking History ({(user.bookings || []).length})</h3>
        {!user.bookings?.length ? (
          <p className="text-sm text-gray-400 text-center py-8">No bookings found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-100">
                  <th className="text-left px-3 py-2 font-semibold">Booking ID</th>
                  <th className="text-left px-3 py-2 font-semibold">Route</th>
                  <th className="text-left px-3 py-2 font-semibold">Date</th>
                  <th className="text-left px-3 py-2 font-semibold">Amount</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {user.bookings.map(b => (
                  <tr key={b._id} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2 font-mono text-red-600 font-bold">{b.bookingId || b._id?.slice(-6)}</td>
                    <td className="px-3 py-2 text-gray-700">
                      {b.fromCity && b.toCity ? `${b.fromCity} → ${b.toCity}` : b.title || "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{b.date || b.journeyDate || "—"}</td>
                    <td className="px-3 py-2 font-semibold text-gray-900">₹{fmt(b.amount)}</td>
                    <td className="px-3 py-2"><StatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
