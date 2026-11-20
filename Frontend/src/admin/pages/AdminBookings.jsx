// src/admin/pages/AdminBookings.jsx
import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Eye,
  XCircle,
  Trash2,
  Ticket,
  RotateCcw,
  Download,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import api from "../../services/api";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import PageHeader from "../components/PageHeader";
import ConfirmDialog from "../components/ConfirmDialog";
import Toast from "../components/Toast";
import OperatorBadge from "../components/OperatorBadge";

function fmt(n) {
  return (n || 0).toLocaleString("en-IN");
}

export default function AdminBookings() {
  const [searchParams] = useSearchParams();
  const [toast, setToast] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const showToast = (msg, type = "success") => setToast({ message: msg, type });

  const fetchData = useCallback(async (params) => {
    const res = await api.admin.bookings.getAll({
      page: params.page,
      limit: params.limit,
      search: params.q,
      status: params.status,
      refundStatus: params.refundStatus,
      vertical: params.vertical,
      sort: params.sort,
      tripId: searchParams.get("tripId") || "",
    });
    return {
      data: res.data || [],
      total: res.total || 0,
      totalPages: res.totalPages || 1,
      currentPage: res.currentPage || 1,
    };
  }, [searchParams]);

  const openRefundModal = (booking, reload) => {
    const total = Number(booking.totalAmount || booking.amount || 0);
    setRefundTarget({ booking, reload });
    setRefundAmount(String(total));
    setRefundReason("Customer requested cancellation");
  };

  const handleProcessRefund = async () => {
    if (!refundTarget || isSubmittingRefund) return;
    const b = refundTarget.booking;
    const amountNum = Number(refundAmount);
    const maxAmount = Number(b.totalAmount || b.amount || 0);

    if (isNaN(amountNum) || amountNum <= 0 || amountNum > maxAmount) {
      showToast(`Please enter a valid refund amount between ₹1 and ₹${maxAmount}`, "error");
      return;
    }

    if (!refundReason.trim()) {
      showToast("Please provide a reason for the refund", "error");
      return;
    }

    try {
      setIsSubmittingRefund(true);
      const res = await api.admin.bookings.refund(b._id, {
        amount: amountNum,
        reason: refundReason.trim(),
      });

      showToast(
        `Refund of ₹${amountNum.toLocaleString("en-IN")} processed successfully! (Ref ID: ${
          res.refundId || "Completed"
        })`,
        "success"
      );
      setRefundTarget(null);
      refundTarget.reload();
    } catch (err) {
      showToast(err.message || "Failed to process refund with gateway.", "error");
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  const handleDownloadTicket = async (b) => {
    try {
      showToast(`Generating official PDF ticket for ${b.bookingId || "Booking"}...`, "info");
      await api.bookings.downloadTicketPdf(b._id, b.bookingId);
      showToast("Ticket PDF downloaded successfully.", "success");
    } catch (err) {
      showToast(err.message || "Could not download ticket PDF.", "error");
    }
  };

  const columns = [
    {
      key: "bookingId",
      label: "Booking ID",
      sortable: false,
      render: (b) => (
        <span className="font-mono text-xs text-red-600 font-bold">
          {b.bookingId || b._id?.slice(-6)}
        </span>
      ),
      exportValue: (b) => b.bookingId || "",
    },
    {
      key: "userName",
      label: "Customer",
      render: (b) => (
        <div>
          <p className="font-semibold text-gray-900 text-xs">
            {b.userName || b.userId?.name || "—"}
          </p>
          <p className="text-[10px] text-gray-400">
            {b.userEmail || b.userId?.email || "—"}
          </p>
        </div>
      ),
      exportValue: (b) => b.userName || "",
    },
    {
      key: "route",
      label: "Route / Service",
      render: (b) => (
        <div>
          <p className="text-xs font-medium text-gray-800">
            {b.fromCity && b.toCity ? `${b.fromCity} → ${b.toCity}` : b.title || "—"}
          </p>
          <OperatorBadge name={b.operator || b.vertical || "Unknown"} />
        </div>
      ),
      exportValue: (b) => (b.fromCity && b.toCity ? `${b.fromCity} → ${b.toCity}` : b.title || ""),
    },
    {
      key: "date",
      label: "Date",
      render: (b) => <span className="text-xs text-gray-600">{b.date || b.journeyDate || "—"}</span>,
      exportValue: (b) => b.date || "",
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      render: (b) => (
        <div>
          <span className="font-bold text-gray-900 text-xs">₹{fmt(b.totalAmount || b.amount)}</span>
          {b.refundedAmount > 0 && (
            <span className="block text-[10px] text-purple-700 font-medium">
              Refunded: ₹{fmt(b.refundedAmount)}
            </span>
          )}
        </div>
      ),
      exportValue: (b) => b.totalAmount || b.amount || 0,
    },
    {
      key: "status",
      label: "Status",
      render: (b) => <StatusBadge status={b.status} />,
      exportValue: (b) => b.status || "",
    },
    {
      key: "paymentStatus",
      label: "Payment",
      render: (b) => <StatusBadge status={b.paymentStatus} />,
      exportValue: (b) => b.paymentStatus || "",
    },
    {
      key: "refundStatus",
      label: "Refund Status",
      render: (b) => {
        const status = b.refundStatus || "NOT_APPLICABLE";
        return (
          <div>
            <StatusBadge status={status} />
            {b.refundId && (
              <span className="block font-mono text-[9px] text-gray-400 truncate max-w-[90px]" title={b.refundId}>
                {b.refundId}
              </span>
            )}
          </div>
        );
      },
      exportValue: (b) => b.refundStatus || "NOT_APPLICABLE",
    },
    {
      key: "createdAt",
      label: "Booked",
      sortable: true,
      render: (b) => (b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN") : "—"),
      exportValue: (b) => (b.createdAt ? new Date(b.createdAt).toLocaleDateString() : ""),
    },
  ];

  const rowActionsFixed = (b, reload, setDeleteTarget) => {
    const isPaid = b.paymentStatus === "PAID" || b.paymentStatus === "REFUNDED";
    const isRefundable =
      isPaid && b.refundStatus !== "PROCESSED" && b.refundStatus !== "REFUNDED";

    return (
      <div className="flex items-center justify-end gap-1">
        {/* PDF Download Action */}
        <button
          onClick={() => handleDownloadTicket(b)}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition cursor-pointer"
          title="Download PDF Ticket"
        >
          <Download size={14} />
        </button>

        {/* Refund Action */}
        {isRefundable && (
          <button
            onClick={() => openRefundModal(b, reload)}
            className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 transition cursor-pointer"
            title="Process Gateway Refund"
          >
            <RotateCcw size={14} />
          </button>
        )}

        {/* Cancel Action */}
        {b.status !== "CANCELLED" && (
          <button
            onClick={() => setCancelTarget({ booking: b, reload })}
            className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-50 transition cursor-pointer"
            title="Cancel Booking"
          >
            <XCircle size={14} />
          </button>
        )}

        {/* Delete Action */}
        <button
          onClick={() =>
            setDeleteTarget({
              confirmMessage: `Delete booking "${b.bookingId || b._id}"? This cannot be undone.`,
              onConfirm: async () => {
                await api.admin.bookings.delete(b._id);
                showToast("Booking deleted.");
              },
            })
          }
          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
          title="Delete Booking"
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Bookings & Refunds"
        subtitle="Manage platform bookings, seat allocations, and payment gateway refunds"
      />

      <DataTable
        key={reloadKey}
        columns={columns}
        fetchData={fetchData}
        searchPlaceholder="Search by PNR, customer, operator, route…"
        colorBy="operator"
        filters={[
          {
            key: "status",
            label: "Status",
            options: ["CONFIRMED", "PENDING", "CANCELLED", "EXPIRED"].map((s) => ({
              value: s,
              label: s,
            })),
          },
          {
            key: "refundStatus",
            label: "Refund",
            options: [
              { value: "PROCESSED", label: "Processed" },
              { value: "PARTIALLY_REFUNDED", label: "Partially Refunded" },
              { value: "INITIATED", label: "Initiated" },
              { value: "NOT_APPLICABLE", label: "Not Applicable" },
            ],
          },
          {
            key: "vertical",
            label: "Type",
            options: ["Bus", "Hotel", "Train"].map((v) => ({ value: v, label: v })),
          },
        ]}
        rowActions={rowActionsFixed}
        emptyIcon={<Ticket size={40} className="text-gray-200" />}
        emptyMessage="No bookings found."
        filename="redbus_bookings"
      />

      {/* ADMIN REFUND MODAL */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="modal-enter bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Process Gateway Refund</h3>
                <p className="text-xs text-gray-500">
                  Refund payment to customer's original source via Razorpay
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200/80 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Booking PNR:</span>
                <span className="font-mono font-bold text-red-600">
                  {refundTarget.booking.bookingId || refundTarget.booking._id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-medium text-gray-900">
                  {refundTarget.booking.userName || "Passenger"} ({refundTarget.booking.userEmail || "—"})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Route / Service:</span>
                <span className="font-medium text-gray-900">
                  {refundTarget.booking.fromCity} → {refundTarget.booking.toCity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Seats to Release:</span>
                <span className="font-bold text-gray-900">
                  {refundTarget.booking.seats || refundTarget.booking.seatNumbers?.join(", ")}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
                <span className="text-gray-700">Total Paid Amount:</span>
                <span className="text-sm font-extrabold text-emerald-700">
                  ₹{fmt(refundTarget.booking.totalAmount || refundTarget.booking.amount)}
                </span>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Refund Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  max={refundTarget.booking.totalAmount || refundTarget.booking.amount}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full text-sm font-semibold border border-gray-300 rounded-xl px-3 py-2 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                  placeholder="Enter amount in INR"
                />
                <span className="text-[11px] text-gray-400 mt-0.5 block">
                  Defaults to 100% full refund. Partial refund allowed.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Refund Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full text-xs border border-gray-300 rounded-xl p-2.5 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
                  placeholder="e.g. Bus breakdown, passenger cancelled, duplicate charge..."
                />
              </div>

              <div className="flex items-start gap-2 bg-amber-50 text-amber-900 p-3 rounded-xl text-[11px] border border-amber-200">
                <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Confirming this action will release reserved seats back to inventory and dispatch a real refund request to the payment gateway.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                disabled={isSubmittingRefund}
                onClick={() => setRefundTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingRefund}
                onClick={handleProcessRefund}
                className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingRefund ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Processing with Gateway...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    Confirm & Refund ₹{refundAmount || 0}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM CANCELLATION DIALOG */}
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Booking"
        message={`Cancel booking "${cancelTarget?.booking?.bookingId}"? Seats will be released back to inventory.`}
        confirmLabel="Cancel Booking"
        danger={false}
        onConfirm={async () => {
          try {
            await api.admin.bookings.cancel(cancelTarget.booking._id, "Cancelled by Admin");
            showToast("Booking cancelled.");
            cancelTarget.reload();
          } catch (e) {
            showToast(e.message || "Failed.", "error");
          }
          setCancelTarget(null);
        }}
        onCancel={() => setCancelTarget(null)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
