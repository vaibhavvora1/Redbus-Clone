import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getHotelSearchValues } from "../utils/hotelSearch";

function getIdempotencyKey(key) {
  const storageKey = `travel-hold:${key}`;
  let value = sessionStorage.getItem(storageKey);
  if (!value) {
    value = `hotel-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem(storageKey, value);
  }
  return value;
}

export default function HotelBooking() {
  const { hotelId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const search = useMemo(
    () => getHotelSearchValues({ ...Object.fromEntries(params), city: params.get("city") || "" }),
    [params],
  );
  const roomTypeId = params.get("roomTypeId") || "";
  const guestCount = Math.max(1, Number(search.guests) || 1);
  const roomCount = Math.max(1, Number(search.rooms) || 1);
  const [hotel, setHotel] = useState(null);
  const [guests, setGuests] = useState(() => Array.from({ length: guestCount }, () => ({ name: "", age: "", gender: "" })));
  const [email, setEmail] = useState(currentUser?.email || "");
  const [phone, setPhone] = useState(currentUser?.phone || currentUser?.mobile || "");
  const [specialRequest, setSpecialRequest] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api.hotels.getById(hotelId, search)
      .then((response) => active && setHotel(response.data))
      .catch((err) => active && setError(err.message || "Could not load this hotel."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [hotelId, search]);

  const room = hotel?.rooms?.find((item) => String(item._id) === String(roomTypeId));
  const updateGuest = (index, field, value) => setGuests((current) =>
    current.map((guest, itemIndex) => itemIndex === index ? { ...guest, [field]: value } : guest),
  );

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!room || guests.some((guest) => guest.name.trim().length < 2)) {
      setError("Select an available room and enter each guest's name.");
      return;
    }
    if (!email.trim() || !phone.trim()) {
      setError("Enter a contact email and phone number.");
      return;
    }
    setSubmitting(true);
    try {
      const holdResponse = await api.hotels.hold({
        roomTypeId,
        checkIn: search.checkIn,
        checkOut: search.checkOut,
        guests: guestCount,
        rooms: roomCount,
      }, { "Idempotency-Key": getIdempotencyKey(`${hotelId}:${roomTypeId}:${search.checkIn}:${search.checkOut}:${guestCount}:${roomCount}`) });
      const hold = holdResponse.data;
      const cleanGuests = guests.map((guest) => ({
        name: guest.name,
        ...(guest.age === "" ? {} : { age: Number(guest.age) }),
        ...(guest.gender ? { gender: guest.gender } : {}),
      }));
      const bookingResponse = await api.bookings.createTravel({
        bookingType: "hotel",
        holdId: hold.holdId,
        leadGuest: cleanGuests[0],
        guests: cleanGuests,
        contact: { email: email.trim(), phone: phone.trim() },
        specialRequest,
      });
      const booking = bookingResponse.data || bookingResponse.booking;
      sessionStorage.setItem(`travel-payment:${booking._id}`, JSON.stringify({
        holdId: hold.holdId,
        holdExpiresAt: hold.expiresAt,
      }));
      navigate(`/travel-payment/${booking._id}`);
    } catch (err) {
      setError(err.message || "Could not reserve this room. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <main className="min-h-screen bg-gray-50 px-4 py-10" role="status" aria-label="Loading booking details">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="skeleton h-10 w-2/3 rounded-xl" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    </main>
  );
  if (error && !hotel) return <div className="mx-auto my-12 max-w-xl rounded-2xl bg-red-50 p-6 text-red-700" role="alert">{error}</div>;
  if (!hotel) return null;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5">
          <div className="rounded-2xl bg-gray-900 p-6 text-white">
            <h1 className="text-2xl font-bold">Guest details</h1>
            <p className="mt-2 text-sm text-gray-300">{hotel.name} · {room?.name} · {search.checkIn} to {search.checkOut}</p>
          </div>
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-bold">Guests</h2>
            <div className="space-y-3">
              {guests.map((guest, index) => (
                <div key={index} className="grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-3">
                  <label className="text-sm">Guest {index + 1} name
                    <input required minLength="2" value={guest.name} onChange={(event) => updateGuest(index, "name", event.target.value)}
                      className="mt-1 w-full rounded-lg border px-3 py-2" />
                  </label>
                  <label className="text-sm">Age (optional)
                    <input type="number" min="0" max="120" value={guest.age} onChange={(event) => updateGuest(index, "age", event.target.value)}
                      className="mt-1 w-full rounded-lg border px-3 py-2" />
                  </label>
                  <label className="text-sm">Gender (optional)
                    <select value={guest.gender} onChange={(event) => updateGuest(index, "gender", event.target.value)}
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
                      <option value="">Prefer not to say</option>
                      {["Male", "Female", "Other"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Contact email
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
              </label>
              <label className="text-sm">Contact phone
                <input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
              </label>
            </div>
            <label className="mt-4 block text-sm">Special request (optional)
              <textarea maxLength="500" value={specialRequest} onChange={(event) => setSpecialRequest(event.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2" rows="3" />
            </label>
            {error && <p className="mt-4 flex gap-2 text-sm text-red-700" role="alert"><AlertCircle size={18} />{error}</p>}
          </div>
        </section>
        <aside className="h-fit rounded-2xl border bg-white p-6 lg:sticky lg:top-6">
          <h2 className="font-bold">Stay summary</h2>
          <p className="mt-3 text-sm text-gray-600">{search.checkIn} to {search.checkOut}</p>
          <p className="text-sm text-gray-600">{guestCount} guest(s) · {roomCount} room(s)</p>
          <p className="mt-3 text-2xl font-extrabold">₹{room?.fareBreakdown?.totalAmount ?? 0}</p>
          <p className="mt-2 text-xs text-gray-500">Final price is calculated and held by the server.</p>
          <button type="submit" disabled={submitting || !room}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 font-bold text-white disabled:bg-gray-400">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Reserving room...</> : "Continue to payment"}
          </button>
        </aside>
      </form>
    </main>
  );
}
