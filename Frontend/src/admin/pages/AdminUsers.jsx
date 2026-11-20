// src/admin/pages/AdminUsers.jsx
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, ShieldCheck, ShieldOff, User, Lock, Unlock } from "lucide-react";
import api from "../../services/api";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";
import Toast from "../components/Toast";
import PageHeader from "../components/PageHeader";

function fmt(n) { return (n || 0).toLocaleString("en-IN"); }

export default function AdminUsers() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const showToast = (message, type = "success") => setToast({ message, type });

  const fetchData = useCallback(async (params) => {
    const res = await api.admin.users.getAll({ ...params, q: params.q, search: params.q });
    return { data: res.data, total: res.total, totalPages: res.totalPages, currentPage: res.currentPage };
  }, []);

  async function toggleBlock(user, reload) {
    try {
      await api.admin.users.updateBlock(user._id, !user.isBlocked);
      showToast(`User ${user.isBlocked ? "unblocked" : "blocked"} successfully.`);
      reload();
    } catch (e) { showToast(e.message || "Failed.", "error"); }
  }

  async function toggleRole(user, reload) {
    const newRole = String(user.role).toUpperCase() === "ADMIN" ? "USER" : "ADMIN";
    try {
      await api.admin.users.updateRole(user._id, newRole);
      showToast(`Role changed to ${newRole}.`);
      reload();
    } catch (e) { showToast(e.message || "Failed.", "error"); }
  }

  const columns = [
    {
      key: "name", label: "Name", sortable: true,
      render: u => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold shrink-0">
            {(u.name || u.email || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-xs">{u.name || "—"}</p>
            <p className="text-[10px] text-gray-400">{u.email || "—"}</p>
          </div>
        </div>
      ),
      exportValue: u => u.name || "",
    },
    { key: "phone", label: "Phone", render: u => u.phone || u.mobile || "—", exportValue: u => u.phone || "" },
    { key: "role", label: "Role", render: u => <StatusBadge status={u.role} />, exportValue: u => u.role },
    {
      key: "isBlocked", label: "Status",
      render: u => u.isBlocked
        ? <StatusBadge status="BLOCKED" label="Blocked" />
        : <StatusBadge status="ACTIVE" label="Active" />,
      exportValue: u => u.isBlocked ? "Blocked" : "Active",
    },
    {
      key: "totalBookings", label: "Bookings",
      render: u => <span className="font-semibold text-gray-700">{fmt(u.totalBookings)}</span>,
      exportValue: u => u.totalBookings || 0,
    },
    {
      key: "createdAt", label: "Joined", sortable: true,
      render: u => u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "—",
      exportValue: u => u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "",
    },
  ];

  const rowActions = (u, reload) => (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => navigate(`/admin/users/${u._id}`)}
        className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        title="View"
      >
        <User size={14} />
      </button>
      <button
        onClick={() => toggleRole(u, reload)}
        className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600"
        title={String(u.role).toUpperCase() === "ADMIN" ? "Demote to User" : "Promote to Admin"}
      >
        {String(u.role).toUpperCase() === "ADMIN" ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
      </button>
      <button
        onClick={() => toggleBlock(u, reload)}
        className={`p-1.5 rounded-lg hover:opacity-80 ${u.isBlocked ? "text-emerald-600 hover:bg-emerald-50" : "text-amber-500 hover:bg-amber-50"}`}
        title={u.isBlocked ? "Unblock" : "Block"}
      >
        {u.isBlocked ? <Unlock size={14} /> : <Lock size={14} />}
      </button>
      {String(u.role).toUpperCase() !== "ADMIN" && (
        <button
          onClick={() => setConfirm({ user: u, reload })}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader title="Users" subtitle="All registered accounts" />
      <DataTable
        key={reloadKey}
        columns={columns}
        fetchData={fetchData}
        searchPlaceholder="Search by name, email, or phone…"
        filters={[
          { key: "role", label: "Role", options: [{ value: "USER", label: "User" }, { value: "ADMIN", label: "Admin" }] },
        ]}
        rowActions={rowActions}
        emptyIcon={<User size={40} className="text-gray-200" />}
        emptyMessage="No users found."
        filename="users"
      />
      <ConfirmDialog
        open={!!confirm}
        title="Delete User"
        message={`Are you sure you want to delete user "${confirm?.user?.name || confirm?.user?.email}"? This cannot be undone.`}
        onConfirm={async () => {
          try {
            await api.admin.users.delete(confirm.user._id);
            showToast("User deleted.");
            setReloadKey(k => k + 1);
          } catch (e) { showToast(e.message || "Failed.", "error"); }
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
