// src/admin/pages/AdminPayments.jsx
import { useCallback } from "react";
import { CreditCard } from "lucide-react";
import api from "../../services/api";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import PageHeader from "../components/PageHeader";

function fmt(n) { return (n || 0).toLocaleString("en-IN"); }

export default function AdminPayments() {
  const fetchData = useCallback(async (params) => {
    const res = await api.admin.payments.getAll({
      page: params.page,
      limit: params.limit,
      search: params.q,
      status: params.status,
    });
    return { data: res.data, total: res.total, totalPages: res.totalPages, currentPage: res.currentPage };
  }, []);

  const columns = [
    {
      key: "razorpayOrderId", label: "Order ID",
      render: p => <span className="font-mono text-xs text-gray-700">{p.razorpayOrderId?.slice(-12) || "—"}</span>,
      exportValue: p => p.razorpayOrderId || "",
    },
    {
      key: "user", label: "User",
      render: p => (
        <div>
          <p className="text-xs font-semibold text-gray-900">{p.user?.name || "—"}</p>
          <p className="text-[10px] text-gray-400">{p.user?.email || "—"}</p>
        </div>
      ),
      exportValue: p => p.user?.name || "",
    },
    {
      key: "amount", label: "Amount", sortable: true,
      render: p => <span className="font-bold text-gray-900 text-xs">₹{fmt(p.amount)}</span>,
      exportValue: p => p.amount || 0,
    },
    { key: "method", label: "Method", render: p => <span className="text-xs capitalize text-gray-600">{p.method || "—"}</span> },
    { key: "status", label: "Status", render: p => <StatusBadge status={p.status} />, exportValue: p => p.status || "" },
    {
      key: "createdAt", label: "Date", sortable: true,
      render: p => p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "—",
      exportValue: p => p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "",
    },
  ];

  return (
    <div>
      <PageHeader title="Payments" subtitle="All payment transactions" />
      <DataTable
        columns={columns}
        fetchData={fetchData}
        searchPlaceholder="Search by order ID, payment ID…"
        filters={[
          {
            key: "status", label: "Status",
            options: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"].map(s => ({ value: s, label: s })),
          },
        ]}
        emptyIcon={<CreditCard size={40} className="text-gray-200" />}
        emptyMessage="No payments found."
        filename="payments"
      />
    </div>
  );
}
