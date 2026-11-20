import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, MapPin, Star } from "lucide-react";
import api from "../services/api";
import { getHotelSearchValues } from "../utils/hotelSearch";
import { formatDate } from "../utils/timeZone";

export default function HotelDetail() {
  const { hotelId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const search = useMemo(
    () => getHotelSearchValues({ ...Object.fromEntries(params), city: params.get("city") || "" }),
    [params],
  );
  const [hotel, setHotel] = useState(null);
  const [roomTypeId, setRoomTypeId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.hotels.getById(hotelId, search)
      .then((response) => {
        if (!active) return;
        setHotel(response.data);
        setRoomTypeId(response.data.rooms?.[0]?._id || "");
      })
      .catch((err) => active && setError(err.message || "Could not load hotel details."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [hotelId, search]);

  if (loading) return (
    <main className="min-h-screen bg-gray-50 px-4 py-10" role="status" aria-label="Loading hotel">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="skeleton h-64 rounded-3xl" />
        <div className="skeleton h-10 w-2/3 rounded-xl" />
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    </main>
  );
  if (error || !hotel) return <div className="mx-auto my-12 max-w-xl rounded-2xl bg-red-50 p-6 text-red-700" role="alert"><AlertCircle className="mb-2" />{error || "Hotel not found."}</div>;

  const selectedRoom = hotel.rooms.find((room) => String(room._id) === String(roomTypeId));
  const continueBooking = () => {
    const next = new URLSearchParams(params);
    next.set("roomTypeId", roomTypeId);
    navigate(`/hotel-booking/${hotelId}?${next.toString()}`);
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <section className="mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="bg-gray-900 p-8 text-white">
          <div className="flex items-center gap-2 text-sm text-gray-300"><MapPin size={16} />{hotel.city}</div>
          <h1 className="mt-2 text-3xl font-extrabold">{hotel.name}</h1>
          <div className="mt-2 flex items-center gap-1 text-amber-300"><Star size={15} fill="currentColor" />{hotel.starRating || "—"} star</div>
          <p className="mt-4 text-sm text-gray-300">{formatDate(search.checkIn)} to {formatDate(search.checkOut)} · {search.guests} guest(s) · {search.rooms} room(s)</p>
          <p className="mt-2 text-sm text-gray-300">{hotel.address}</p>
        </div>
        <div className="space-y-4 p-6">
          <h2 className="text-xl font-bold">Available room types</h2>
          {hotel.rooms.map((room) => (
            <label key={room._id} className={`block cursor-pointer rounded-2xl border p-5 ${roomTypeId === room._id ? "border-red-600 bg-red-50" : "border-gray-200"}`}>
              <div className="flex items-start gap-3">
                <input type="radio" name="roomType" value={room._id} checked={roomTypeId === room._id} onChange={() => setRoomTypeId(room._id)} className="mt-1 accent-red-600" />
                <div className="flex-1">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-bold">{room.name}</span>
                    <span className="font-extrabold">₹{room.pricePerNight} / night</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Up to {room.maxGuests} guests per room · {room.availableRooms} available</p>
                </div>
              </div>
            </label>
          ))}
          {selectedRoom && <p className="text-sm text-gray-600">Estimated total: ₹{selectedRoom.fareBreakdown?.totalAmount ?? selectedRoom.pricePerNight * Number(search.rooms)}</p>}
          <button type="button" disabled={!roomTypeId} onClick={continueBooking}
            className="w-full rounded-full bg-red-600 px-5 py-3 font-bold text-white disabled:bg-gray-400">
            Continue with this room
          </button>
        </div>
      </section>
    </main>
  );
}
