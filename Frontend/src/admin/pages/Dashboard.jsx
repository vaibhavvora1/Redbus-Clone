// src/admin/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import {
  Users, Ticket, CreditCard, Bus, TrainFront, Hotel, TrendingUp,
  CheckCircle, XCircle, CalendarDays,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import api from "../../services/api";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import PageHeader from "../components/PageHeader";

function fmt(n) { return (n || 0).toLocaleString("en-IN"); }
function fmtCurrency(n) { return `₹${fmt(n)}`; }

const DONUT_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6b7280"];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.admin.getStats()
      .then(res => setData(res.data))
      .catch(e => setError(e.message || "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  const statCards = data ? [
    { icon: Users, label: "Total Users", value: fmt(data.totalUsers), color: "blue" },
    { icon: Ticket, label: "Total Bookings", value: fmt(data.totalBookings), color: "indigo" },
    { icon: TrendingUp, label: "Total Revenue", value: fmtCurrency(data.totalRevenue), color: "green" },
    { icon: CalendarDays, label: "Today's Bookings", value: fmt(data.todayBookings), color: "amber" },
    { icon: CheckCircle, label: "Confirmed", value: fmt(data.confirmedTickets), color: "green" },
    { icon: XCircle, label: "Cancelled", value: fmt(data.cancelledTickets), color: "red" },
    { icon: Bus, label: "Buses", value: fmt(data.totalBuses), color: "gray" },
    { icon: TrainFront, label: "Trains", value: fmt(data.totalTrains), color: "gray" },
    { icon: Hotel, label: "Hotels", value: fmt(data.totalHotels), color: "gray" },
    { icon: CreditCard, label: "Trips", value: fmt(data.totalTrips), color: "gray" },
  ] : Array(10).fill({});

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Platform overview and analytics" />

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} loading={loading} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Bookings & Revenue Line Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Bookings & Revenue (Last 30 Days)</h3>
          {loading ? (
            <div className="h-56 bg-gray-100 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data?.dailyBookings || []}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bkg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={40} />
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" stroke="#dc2626" strokeWidth={2} fill="url(#rev)" name="Revenue (₹)" />
                <Area type="monotone" dataKey="bookings" stroke="#3b82f6" strokeWidth={2} fill="url(#bkg)" name="Bookings" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Donut */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Booking Status</h3>
          {loading ? (
            <div className="h-56 bg-gray-100 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data?.statusBreakdown || []}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {(data?.statusBreakdown || []).map((entry, i) => (
                    <Cell key={i} fill={entry.color || DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} formatter={(v, n) => [fmt(v), n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Routes + Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Routes Bar Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Top Routes</h3>
          {loading ? (
            <div className="h-44 bg-gray-100 rounded-xl animate-pulse" />
          ) : (data?.topRoutes?.length ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.topRoutes} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis dataKey="route" type="category" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} width={110} />
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="count" fill="#dc2626" radius={[0, 4, 4, 0]} name="Bookings" maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">No route data yet.</p>
          ))}
        </div>

        {/* Recent Bookings Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Recent Bookings</h3>
          {loading ? (
            <div className="space-y-2">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (data?.recentBookings?.length ? (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-semibold">Booking ID</th>
                    <th className="text-left pb-2 font-semibold">Customer</th>
                    <th className="text-left pb-2 font-semibold">Amount</th>
                    <th className="text-left pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recentBookings || []).map(b => (
                    <tr key={b._id} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 font-mono text-red-600 font-bold">{b.bookingId || b._id?.slice(-6)}</td>
                      <td className="py-2 text-gray-700 max-w-[120px] truncate">{b.userName || b.userId?.name || "User"}</td>
                      <td className="py-2 font-semibold text-gray-900">₹{fmt(b.amount)}</td>
                      <td className="py-2"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-10">No bookings yet.</p>
          ))}
        </div>
      </div>
    </div>
  );
}
