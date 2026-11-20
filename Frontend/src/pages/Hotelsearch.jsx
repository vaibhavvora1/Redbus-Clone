import { useRef, useState } from "react";
import { Search, Calendar, Users, Hotel as HotelIcon } from "lucide-react";
import Footer from "../components/Footer";
import { useNavigate, useSearchParams } from "react-router-dom";
import CitySearchInput from "../components/CitySearchInput";
import { addDaysToAppDate, getTodayInAppTZ } from "../utils/timeZone";
import { getHotelSearchValues } from "../utils/hotelSearch";

const fieldBox =
  "flex flex-col min-w-0 border border-gray-200 rounded-xl px-4 py-2 focus-within:border-red-500 transition";
const fieldBoxError =
  "flex flex-col min-w-0 border border-red-500 rounded-xl px-4 py-2 transition";
const labelClass =
  "text-xs text-gray-400 flex items-center gap-1 font-medium";
const inputClass =
  "w-full min-w-0 bg-transparent outline-none text-sm font-medium text-gray-800";

export default function HotelSearch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchDefaults = getHotelSearchValues(Object.fromEntries(searchParams));
  const [location, setLocation] = useState(searchParams.get("cityLabel") || searchDefaults.city);
  const [checkIn, setCheckIn] = useState(searchDefaults.checkIn);
  const [checkOut, setCheckOut] = useState(searchDefaults.checkOut);
  const [guests, setGuests] = useState(searchDefaults.guests);
  const [rooms, setRooms] = useState(searchDefaults.rooms);
  const [locationError, setLocationError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const locationRef = useRef(null);

  const handleSearch = async () => {
    setLocationError("");
    const errors = {};
    if (checkIn < getTodayInAppTZ()) errors.checkIn = "Check-in must be today or later.";
    if (checkOut <= checkIn) errors.checkOut = "Check-out must be after check-in.";
    if (!Number.isInteger(Number(guests)) || Number(guests) < 1) errors.guests = "Guests must be a positive integer.";
    if (!Number.isInteger(Number(rooms)) || Number(rooms) < 1) errors.rooms = "Rooms must be a positive integer.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const selected = await locationRef.current.validate();
    if (!selected) return;
    const values = getHotelSearchValues({
      city: selected.slug,
      checkIn,
      checkOut,
      guests,
      rooms,
    });
    const params = new URLSearchParams({ ...values, cityLabel: selected.name });
    navigate(`/hotelListing?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Search Section */}
      <div className="bg-linear-to-r from-red-600 to-red-500 pb-16 pt-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center gap-2 text-white mb-6">
            <HotelIcon size={28} />
            <h1 className="text-2xl font-bold">Hotels & Stays</h1>
          </div>

          <div className="relative z-20 bg-white rounded-2xl shadow-xl p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.7fr_0.7fr_auto] gap-3 items-start">
              <CitySearchInput
                ref={locationRef}
                id="hotel-destination"
                label="City or Destination"
                variant="city"
                value={location}
                onChange={setLocation}
                onSelect={() => setLocationError("")}
                error={locationError}
                placeholder="Where are you going?"
                required
                className={`relative sm:col-span-2 lg:col-span-1 ${
                  locationError ? fieldBoxError : fieldBox
                }`}
                inputClassName="w-full min-w-0 bg-transparent outline-none text-sm font-medium text-gray-800 placeholder:text-gray-400"
              />

              <div className={fieldErrors.checkIn ? fieldBoxError : fieldBox}>
                <label htmlFor="hotel-check-in" className={labelClass}>
                  <Calendar size={12} className="text-red-500" /> Check-in
                </label>
                <input
                  id="hotel-check-in"
                  type="date"
                  value={checkIn}
                  min={getTodayInAppTZ()}
                  onChange={(e) => {
                    setCheckIn(e.target.value);
                    setFieldErrors((previous) => ({ ...previous, checkIn: "", checkOut: "" }));
                    if (checkOut <= e.target.value) setCheckOut(addDaysToAppDate(e.target.value, 1));
                  }}
                  className={`${inputClass} cursor-pointer`}
                />
                {fieldErrors.checkIn && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.checkIn}</p>}
              </div>

              <div className={fieldErrors.checkOut ? fieldBoxError : fieldBox}>
                <label htmlFor="hotel-check-out" className={labelClass}>
                  <Calendar size={12} className="text-red-500" /> Check-out
                </label>
                <input
                  id="hotel-check-out"
                  type="date"
                  value={checkOut}
                  min={addDaysToAppDate(checkIn, 1)}
                  onChange={(e) => {
                    setCheckOut(e.target.value);
                    setFieldErrors((previous) => ({ ...previous, checkOut: "" }));
                  }}
                  className={`${inputClass} cursor-pointer`}
                />
                {fieldErrors.checkOut && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.checkOut}</p>}
              </div>

              <div className={fieldErrors.guests ? fieldBoxError : fieldBox}>
                <label htmlFor="hotel-guests" className={labelClass}>
                  <Users size={12} className="text-red-500" /> Guests
                </label>
                <input
                  id="hotel-guests"
                  type="number"
                  min={1}
                  value={guests}
                  onChange={(e) => {
                    setGuests(e.target.value);
                    setFieldErrors((previous) => ({ ...previous, guests: "" }));
                  }}
                  className={inputClass}
                />
                {fieldErrors.guests && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.guests}</p>}
              </div>

              <div className={fieldErrors.rooms ? fieldBoxError : fieldBox}>
                <label htmlFor="hotel-rooms" className={labelClass}>
                  Rooms
                </label>
                <input
                  id="hotel-rooms"
                  type="number"
                  min={1}
                  value={rooms}
                  onChange={(e) => {
                    setRooms(e.target.value);
                    setFieldErrors((previous) => ({ ...previous, rooms: "" }));
                  }}
                  className={inputClass}
                />
                {fieldErrors.rooms && <p className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.rooms}</p>}
              </div>

              <button
                type="button"
                onClick={handleSearch}
                className="sm:col-span-2 lg:col-span-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 h-13.5 rounded-xl shadow-md transition"
              >
                <Search size={18} />
                Search
              </button>
            </div>
            {locationError && <p className="mt-3 text-xs text-red-600" role="alert">{locationError}</p>}
          </div>
        </div>
      </div>

      <div className="flex-1" />
      <Footer />
    </div>
  );
}