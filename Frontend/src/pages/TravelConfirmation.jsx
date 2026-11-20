import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Download, Loader2, XCircle } from "lucide-react";
import api from "../services/api";

export default function TravelConfirmation() {
  const { bookingId } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const response = await api.bookings.getById(bookingId);
    setBooking(response.data || response.booking);
  };

  useEffect(() => {
    let active = true;
    api.bookings.getById(bookingId)
      .then((response) => active && setBooking(response.data || response.booking))
      .catch((err) => active && setError(err.message || "Could not load booking confirmation."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [bookingId]);

  const cancel = async () => {
    setBusy(true);
    setError("");
    try {
      await api.bookings.cancel(booking._id);
      await refresh();
    } catch (err) {
      setError(err.message || "Could not cancel this booking.");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      await api.bookings.downloadTicketPdf(booking._id, booking.bookingId);
    } catch (err) {
      setError(err.message || "Could not download the booking PDF.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return (
    <main className="min-h-screen bg-gray-50 px-4 py-12" role="status" aria-label="Loading confirmation">
      <div className="mx-auto max-w-3xl space-y-4 rounded-3xl border bg-white p-8">
        <div className="skeleton mx-auto h-16 w-16 rounded-full" />
        <div className="skeleton mx-auto h-8 w-2/3 rounded-xl" />
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    </main>
  );
  if (!booking) return <div className="mx-auto my-12 max-w-xl rounded-2xl bg-red-50 p-6 text-red-700" role="alert"><AlertCircle className="mb-2" />{error || "Booking not found."}</div>;

  const confirmed = booking.status === "CONFIRMED";
  const hotel = booking.bookingType === "hotel";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <section className="mx-auto max-w-3xl rounded-3xl border bg-white p-7 shadow-sm sm:p-10">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${confirmed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {confirmed ? <CheckCircle2 className="confirmation-enter" size={34} /> : <AlertCircle size={34} />}
        </div>
        <h1 className="mt-4 text-center text-2xl font-extrabold">{confirmed ? "Booking confirmed" : "Booking status: " + booking.status}</h1>
        <p className="mt-2 text-center text-sm text-gray-500">{confirmed ? "Your payment was verified and your reservation is confirmed." : "Payment has not been confirmed. You can retry from the payment step."}</p>
        <div className="mt-7 rounded-2xl bg-gray-50 p-5">
          <p className="text-xs font-bold uppercase text-gray-500">Booking reference</p>
          <p className="mt-1 font-mono text-lg font-bold">{booking.bookingId}</p>
          <h2 className="mt-4 font-bold">{booking.title}</h2>
          <p className="mt-1 text-sm text-gray-600">{hotel
            ? `${booking.checkIn} to ${booking.checkOut} · ${booking.roomCount} room(s)`
            : `${booking.fromStation} (${booking.fromStationCode}) to ${booking.toStation} (${booking.toStationCode}) · ${booking.date}`}</p>
          <p className="mt-3 text-xl font-extrabold">₹{Number(booking.totalAmount || booking.amount).toLocaleString("en-IN")}</p>
        </div>
        {error && <p className="mt-4 flex gap-2 text-sm text-red-700" role="alert"><AlertCircle size={18} />{error}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {confirmed && booking.status === "CONFIRMED" &&
            !["PROCESSED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(booking.refundStatus) && (
              <button type="button" disabled={busy} onClick={download} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 font-bold text-white disabled:bg-gray-400">
                <Download size={16} /> Download {hotel ? "voucher" : "ticket"} PDF
              </button>
          )}
          {confirmed && (
            <button type="button" disabled={busy} onClick={cancel} className="inline-flex items-center gap-2 rounded-full border border-red-200 px-5 py-3 font-bold text-red-700 disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Cancel booking
            </button>
          )}
          {!confirmed && booking.status === "PENDING" && <Link to={`/travel-payment/${booking._id}`} className="rounded-full bg-red-600 px-5 py-3 font-bold text-white">Continue payment</Link>}
          <Link to="/mybookings" className="rounded-full border px-5 py-3 font-bold text-gray-700">My bookings</Link>
        </div>
      </section>
    </main>
  );
}
