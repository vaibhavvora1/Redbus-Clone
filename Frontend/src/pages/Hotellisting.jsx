import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Star, MapPin, Hotel as HotelIcon, SlidersHorizontal, ArrowUpDown, AlertCircle, Calendar } from "lucide-react";
import api from "../services/api";
import CitySearchInput from "../components/CitySearchInput";
import { addDaysToAppDate, formatDate, getTodayInAppTZ } from "../utils/timeZone";
import { getHotelSearchValues } from "../utils/hotelSearch";

export default function HotelListing() {
  const [searchParams] = useSearchParams();
  return <HotelListingContent key={searchParams.toString()} />;
}

function HotelListingContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const searchValues = getHotelSearchValues({
    ...Object.fromEntries(searchParams),
    city: searchParams.get("city") || searchParams.get("destination") || "",
  });
  const city = searchValues.city;
  const cityLabel = searchParams.get("cityLabel") || city;
  const { checkIn, checkOut, guests, rooms } = searchValues;
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifiedCity, setModifiedCity] = useState(cityLabel);
  const [modifiedCheckIn, setModifiedCheckIn] = useState(checkIn);
  const [modifiedCheckOut, setModifiedCheckOut] = useState(checkOut);
  const [modifiedGuests, setModifiedGuests] = useState(guests || "2");
  const [modifiedRooms, setModifiedRooms] = useState(rooms || "1");
  const [modifyError, setModifyError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [emptyMessage, setEmptyMessage] = useState("");
  const cityRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    let changed = false;
    for (const [key, value] of Object.entries({ checkIn, checkOut, guests, rooms })) {
      if (!params.get(key)) {
        params.set(key, value);
        changed = true;
      }
    }
    if (changed) setSearchParams(params, { replace: true });
  }, [checkIn, checkOut, guests, rooms, searchParams, setSearchParams]);

  const submitModifiedSearch = async () => {
    setModifyError("");
    const selectedCity = await cityRef.current.validate();
    if (!selectedCity) return;
    const errors = {};
    if (modifiedCheckIn < getTodayInAppTZ()) errors.checkIn = "Check-in must be today or later.";
    if (modifiedCheckOut <= modifiedCheckIn) errors.checkOut = "Check-out must be after check-in.";
    if (!Number.isInteger(Number(modifiedGuests)) || Number(modifiedGuests) < 1) {
      errors.guests = "Guests must be a positive integer.";
    }
    if (!Number.isInteger(Number(modifiedRooms)) || Number(modifiedRooms) < 1) {
      errors.rooms = "Rooms must be a positive integer.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const params = new URLSearchParams(searchParams);
    params.set("city", selectedCity.slug);
    params.set("cityLabel", selectedCity.name);
    params.set("checkIn", modifiedCheckIn);
    params.set("checkOut", modifiedCheckOut);
    params.set("guests", modifiedGuests);
    params.set("rooms", modifiedRooms);
    setSearchParams(params);
    setModifyOpen(false);
  };

  const [acFilter, setAcFilter] = useState("ALL"); // ALL | AC | NON_AC
  const [starFilter, setStarFilter] = useState("ALL"); // ALL | 3 | 4 | 5
  const [sortBy, setSortBy] = useState("PRICE_LOW"); // PRICE_LOW | PRICE_HIGH | RATING

  const [fetchedHotels, setFetchedHotels] = useState([]);
  const [loadedSearchKey, setLoadedSearchKey] = useState("");
  const [loadErrorState, setLoadErrorState] = useState({ key: "", message: "" });
  const searchKey = `${city}|${checkIn}|${checkOut}|${guests}|${rooms}`;
  const isLoading = loadedSearchKey !== searchKey;
  const loadError = loadErrorState.key === searchKey ? loadErrorState.message : "";

  useEffect(() => {
    let isMounted = true;
    const requestKey = searchKey;
    api.hotels.getAll({ city, checkIn, checkOut, guests, rooms })
      .then((res) => {
        if (!isMounted) return;
        setEmptyMessage(res.message || "");
        setFieldErrors({});
        const list = (res.data || []).map((h) => {
          return {
            id: h._id,
            name: h.name,
            city: h.city,
            type: h.type,
            starRating: h.starRating,
            rating: h.rating,
            price: Number(h.rooms?.[0]?.pricePerNight ?? h.price),
            roomTypeName: h.rooms?.[0]?.name || "",
            availableRooms: Number(h.rooms?.[0]?.availableRooms ?? 0),
            amenities: Array.isArray(h.amenities) ? h.amenities : [],
            isAc: h.isAc,
          };
        });
        setFetchedHotels(list);
      })
      .catch((err) => {
        if (isMounted) {
          const errors = err.data?.errors;
          if (Array.isArray(errors) && errors.length) {
            setFieldErrors(Object.fromEntries(errors.map(({ field, message }) => [field, message])));
            setModifyOpen(true);
            setLoadErrorState({ key: requestKey, message: "" });
          } else {
            setLoadErrorState({
              key: requestKey,
              message: err.message || "Could not load hotels. Please try again.",
            });
          }
          setFetchedHotels([]);
        }
      })
      .finally(() => {
        if (isMounted) setLoadedSearchKey(requestKey);
      });
    return () => { isMounted = false; };
  }, [city, checkIn, checkOut, guests, rooms, searchKey]);

  const filteredHotels = fetchedHotels
    .filter((h) => {
      if (acFilter === "AC" && !h.isAc) return false;
      if (acFilter === "NON_AC" && h.isAc) return false;
      if (starFilter !== "ALL" && h.starRating !== Number(starFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "PRICE_LOW") return a.price - b.price;
      if (sortBy === "PRICE_HIGH") return b.price - a.price;
      if (sortBy === "RATING") return b.rating - a.rating;
      return 0;
    });

  return (
    <>
      {/* Search Header Banner */}
      <div className="bg-gray-900 text-white py-8 px-4 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 text-2xl md:text-3xl font-extrabold tracking-tight">
              <MapPin className="text-red-500" size={24} />
              <span>{cityLabel}</span>
            </div>
            <p className="text-gray-400 text-sm mt-1 flex items-center gap-2 flex-wrap">
              {checkIn && checkOut && (
                <>
                  <span className="text-white font-semibold">{formatDate(checkIn)}</span>
                  <span>→</span>
                  <span className="text-white font-semibold">{formatDate(checkOut)}</span>
                  <span>|</span>
                </>
              )}
              {guests && <span>{guests} Guests |</span>}
              {isLoading ? "Loading hotels..." : `${filteredHotels.length} Hotels Available`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModifyOpen((open) => !open)}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition shadow-md w-fit"
          >
            {modifyOpen ? "Close Search" : "Modify Search"}
          </button>
        </div>
        {modifyOpen && (
          <div className="max-w-6xl mx-auto mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.7fr_0.7fr_auto] gap-3 items-end">
            <CitySearchInput ref={cityRef} id="hotel-modify-city" variant="city" label="City or Destination"
              value={modifiedCity} onChange={setModifiedCity} required placeholder="Where are you going?"
              error={fieldErrors.city}
              className="rounded-xl bg-white px-4 py-2 text-gray-800"
              inputClassName="w-full outline-none" />
            <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-xs text-gray-500">
              <Calendar size={15} className="text-red-500" />
              <input aria-label="Check-in date" type="date" value={modifiedCheckIn}
                min={getTodayInAppTZ()}
                onChange={(event) => {
                  setModifiedCheckIn(event.target.value);
                  setFieldErrors((previous) => ({ ...previous, checkIn: "" }));
                  if (modifiedCheckOut <= event.target.value) setModifiedCheckOut(addDaysToAppDate(event.target.value, 1));
                }} className="min-w-0 text-sm text-gray-800 outline-none" />
              {fieldErrors.checkIn && <span className="text-xs text-red-600" role="alert">{fieldErrors.checkIn}</span>}
            </label>
            <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-3 text-xs text-gray-500">
              <Calendar size={15} className="text-red-500" />
              <input aria-label="Check-out date" type="date" value={modifiedCheckOut}
                min={addDaysToAppDate(modifiedCheckIn, 1)}
                onChange={(event) => {
                  setModifiedCheckOut(event.target.value);
                  setFieldErrors((previous) => ({ ...previous, checkOut: "" }));
                }} className="min-w-0 text-sm text-gray-800 outline-none" />
              {fieldErrors.checkOut && <span className="text-xs text-red-600" role="alert">{fieldErrors.checkOut}</span>}
            </label>
            <label className="rounded-xl bg-white px-3 py-2 text-xs text-gray-500">
              Guests
              <input aria-label="Guests" type="number" min="1" value={modifiedGuests}
                onChange={(event) => {
                  setModifiedGuests(event.target.value);
                  setFieldErrors((previous) => ({ ...previous, guests: "" }));
                }} className="w-full text-sm text-gray-800 outline-none" />
              {fieldErrors.guests && <span className="text-xs text-red-600" role="alert">{fieldErrors.guests}</span>}
            </label>
            <label className="rounded-xl bg-white px-3 py-2 text-xs text-gray-500">
              Rooms
              <input aria-label="Rooms" type="number" min="1" value={modifiedRooms}
                onChange={(event) => {
                  setModifiedRooms(event.target.value);
                  setFieldErrors((previous) => ({ ...previous, rooms: "" }));
                }} className="w-full text-sm text-gray-800 outline-none" />
              {fieldErrors.rooms && <span className="text-xs text-red-600" role="alert">{fieldErrors.rooms}</span>}
            </label>
            <button type="button" onClick={submitModifiedSearch}
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-50">
              Search
            </button>
            {modifyError && <p className="sm:col-span-2 lg:col-span-6 text-sm text-red-300" role="alert">{modifyError}</p>}
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8 items-start">
        {/* Filter Sidebar */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2 font-bold text-gray-900 text-lg">
                <SlidersHorizontal size={18} className="text-red-600" />
                <span>Filters</span>
              </div>
              <button
                onClick={() => {
                  setAcFilter("ALL");
                  setStarFilter("ALL");
                  setSortBy("PRICE_LOW");
                }}
                className="text-xs text-red-600 hover:underline font-semibold"
              >
                Reset All
              </button>
            </div>

            {/* AC / Non-AC */}
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">Room Type</label>
              <div className="flex flex-col gap-2">
                {[
                  { label: "All Rooms", value: "ALL" },
                  { label: "A/C Rooms", value: "AC" },
                  { label: "Non-A/C Rooms", value: "NON_AC" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAcFilter(opt.value)}
                    className={`text-left text-sm px-3.5 py-2 rounded-xl border transition-all ${
                      acFilter === opt.value
                        ? "bg-red-50 border-red-500 text-red-700 font-bold"
                        : "bg-gray-50/50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Star Rating */}
            <div className="mb-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">Star Rating</label>
              <div className="flex flex-col gap-2">
                {[
                  { label: "All Ratings", value: "ALL" },
                  { label: "5 Star", value: "5" },
                  { label: "4 Star", value: "4" },
                  { label: "3 Star", value: "3" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStarFilter(opt.value)}
                    className={`text-left text-sm px-3.5 py-2 rounded-xl border transition-all ${
                      starFilter === opt.value
                        ? "bg-red-50 border-red-500 text-red-700 font-bold"
                        : "bg-gray-50/50 border-gray-200 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Hotel List & Sorting */}
        <div className="flex-1 w-full min-h-[600px]">
          {/* Sorting Header */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <ArrowUpDown size={16} className="text-red-500" />
              <span>Sort By:</span>
            </div>
            <div className="flex gap-2">
              {[
                { label: "Price: Low to High", value: "PRICE_LOW" },
                { label: "Price: High to Low", value: "PRICE_HIGH" },
                { label: "Customer Rating", value: "RATING" },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSortBy(s.value)}
                  className={`text-xs md:text-sm px-3.5 py-1.5 rounded-full border transition-all ${
                    sortBy === s.value
                      ? "bg-red-600 border-red-600 text-white font-semibold"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Empty State */}
          {isLoading ? (
            <div className="space-y-4" role="status" aria-label="Loading hotels">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="skeleton h-32 rounded-2xl" />
              ))}
            </div>
          ) : loadError ? (
            <div className="bg-white rounded-2xl border border-red-200 p-8 text-center text-sm text-red-600" role="alert">
              <AlertCircle size={20} className="inline mr-2" />{loadError}
            </div>
          ) : filteredHotels.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center flex flex-col items-center gap-3">
              <HotelIcon size={48} className="text-gray-300" />
              <h3 className="text-xl font-bold text-gray-800">{emptyMessage || `No hotels found in ${cityLabel}.`}</h3>
              <p className="text-sm text-gray-500 max-w-md">
                We couldn't find any hotels in <span className="font-semibold text-gray-700">{city}</span> for your selected dates. Try modifying your search or dates.
              </p>
              <button
                onClick={() => navigate("/")}
                className="mt-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-full text-sm transition shadow-sm"
              >
                Search Another City
              </button>
            </div>
          )}

          {/* Hotel List */}
          {!isLoading && !loadError && filteredHotels.length > 0 && (
            <div className="result-list space-y-4">
              {filteredHotels.map((hotel) => (
                <div
                  key={hotel.id}
                  className="result-card motion-lift bg-white rounded-2xl border border-gray-200 p-6 shadow-xs hover:border-red-200 flex flex-col md:flex-row justify-between gap-6 group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-red-600 transition-colors">
                        {hotel.name}
                      </h3>
                      {Number.isFinite(hotel.starRating) && <span className="text-xs text-amber-500 font-bold">{"★".repeat(hotel.starRating)}</span>}
                      {hotel.rating != null && <span className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        <Star size={10} fill="white" /> {hotel.rating}
                      </span>}
                    </div>
                    <p className="text-xs font-medium text-gray-500 mb-4 flex items-center gap-1">
                      <MapPin size={12} /> {hotel.city}
                    </p>
                    <p className="text-xs font-semibold text-emerald-700 mb-4">
                      {hotel.availableRooms} {hotel.availableRooms === 1 ? "room" : "rooms"} available
                      {hotel.roomTypeName ? ` · ${hotel.roomTypeName}` : ""}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {hotel.amenities.map((item) => (
                        <span key={item} className="text-[11px] font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-start md:items-end border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                    <div>
                      <div className="text-xs text-gray-400 font-medium">Per night</div>
                      <div className="text-3xl font-extrabold text-gray-900">{Number.isFinite(hotel.price) ? `₹${hotel.price}` : "—"}</div>
                    </div>

                    <button
                      onClick={() => {
                        const params = new URLSearchParams({
                          city,
                          checkIn,
                          checkOut,
                          guests,
                          rooms,
                        });
                        navigate(`/hotels/${hotel.id}?${params.toString()}`);
                      }}
                      className="mt-4 w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-7 py-3 rounded-full shadow-sm hover:shadow-md transition"
                    >
                      SELECT ROOM
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}