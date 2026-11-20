// src/admin/AdminLayout.jsx
import { useState, useCallback } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, Ticket, CreditCard, Bus, RouteIcon,
  TrainFront, Hotel, Landmark, Sparkles, Settings, LogOut,
  Menu, X, ChevronDown, ChevronRight, Map, RotateCcw, Building2,
} from "lucide-react";

const NAV = [
  {
    group: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    ],
  },
  {
    group: "Users",
    items: [
      { to: "/admin/users", label: "All Users", icon: Users },
    ],
  },
  {
    group: "Bookings",
    items: [
      { to: "/admin/bookings", label: "Bookings", icon: Ticket },
      { to: "/admin/payments", label: "Payments", icon: CreditCard },
    ],
  },
  {
    group: "Inventory",
    items: [
      { to: "/admin/buses", label: "Buses", icon: Bus },
      { to: "/admin/trips", label: "Trips / Schedules", icon: RouteIcon },
      { to: "/admin/trains", label: "Trains", icon: TrainFront },
      { to: "/admin/hotels", label: "Hotels", icon: Hotel },
      { to: "/admin/routes", label: "Routes", icon: Map },
      { to: "/admin/operators", label: "Operators", icon: Landmark },
      { to: "/admin/cities", label: "Cities", icon: Building2 },
    ],
  },
  {
    group: "Marketing",
    items: [
      { to: "/admin/promotions", label: "Promotions", icon: Sparkles },
    ],
  },
  {
    group: "System",
    items: [
      { to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

function SidebarGroup({ group, items, collapsed, onNav }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-1">
      {!collapsed && (
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
        >
          {group}
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
      )}
      {(open || collapsed) && items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNav}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors mb-0.5 ${
              collapsed ? "justify-center" : ""
            } ${
              isActive
                ? "bg-red-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            }`
          }
          title={collapsed ? label : undefined}
        >
          <Icon size={17} className="shrink-0" />
          {!collapsed && <span>{label}</span>}
        </NavLink>
      ))}
    </div>
  );
}

export default function AdminLayout() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate("/login");
  }, [logout, navigate]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const sidebar = (
    <div className={`flex flex-col h-full bg-white border-r border-gray-100 transition-all duration-200 ${collapsed ? "w-16" : "w-60"}`}>
      {/* Logo */}
      <div className={`flex items-center gap-2 px-4 py-4 border-b border-gray-100 shrink-0 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
          <Bus size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-extrabold text-gray-900 leading-tight">RedBus</p>
            <p className="text-[10px] text-gray-400 font-medium">Admin Console</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.map(g => (
          <SidebarGroup key={g.group} group={g.group} items={g.items} collapsed={collapsed} onNav={closeMobile} />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-gray-100 px-2 py-2 shrink-0">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          {collapsed ? <ChevronRight size={14} /> : <><RotateCcw size={12} /><span>Collapse</span></>}
        </button>
      </div>

      {/* User */}
      <div className={`border-t border-gray-100 px-2 py-3 shrink-0 flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs shrink-0">
          {(currentUser?.name || currentUser?.email || "A").charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{currentUser?.name || "Admin"}</p>
            <p className="text-[10px] text-gray-400 truncate">{currentUser?.email || ""}</p>
          </div>
        )}
        <button onClick={handleLogout} title="Logout" className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
          <LogOut size={15} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex shrink-0">{sidebar}</div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeMobile} />
          <div className="relative flex w-60 shrink-0 h-full shadow-2xl">{sidebar}</div>
          <button onClick={closeMobile} className="absolute top-3 right-3 z-50 p-1.5 rounded-lg bg-white shadow text-gray-700">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-xs">
              {(currentUser?.name || "A").charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold text-gray-800">{currentUser?.name || "Admin"}</p>
              <p className="text-[10px] text-red-600 font-bold">ADMIN</p>
            </div>
            <button
              onClick={handleLogout}
              className="ml-2 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-red-200 transition-colors"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
