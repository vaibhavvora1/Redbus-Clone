import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2, Train as TrainIcon } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatTime } from "../utils/timeZone";

const EMPTY_PASSENGER = { name: "", age: "", gender: "Male", berthPreference: "No preference" };

function getIdempotencyKey(key) {
  const storageKey = `travel-hold:${key}`;
  let value = sessionStorage.getItem(storageKey);
  if (!value) {
    value = `train-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem(storageKey, value);
  }
  return value;
}

export default function TrainBooking() {
  const { trainRunId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [run, setRun] = useState(null);
  const [classCode, setClassCode] = useState(params.get("class") || "");
  const [passengerCount, setPassengerCount] = useState(1);
  const [passengers, setPassengers] = useState([{ ...EMPTY_PASSENGER }]);
  const [email, setEmail] = useState(currentUser?.email || "");
  const [phone, setPhone] = useState(currentUser?.phone || currentUser?.mobile || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api.trains.getById(trainRunId)
      .then((response) => {
        if (!active) return;
        const data = response.data;
        setRun(data);
        const preferred = params.get("class");
        const selected = data.classes?.find((item) => item.code === preferred && item.availableSeats > 0) ||
          data.classes?.find((item) => item.availableSeats > 0);
        setClassCode(selected?.code || "");
      })
      .catch((err) => active && setError(err.message || "Could not load this train."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [trainRunId, params]);

  const selectedClass = useMemo(
    () => run?.classes?.find((item) => item.code === classCode),
    [run, classCode],
  );

  const updatePassenger = (index, field, value) => {
    setPassengers((current) => current.map((passenger, itemIndex) =>
      itemIndex === index ? { ...passenger, [field]: value } : passenger,
    ));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!selectedClass || selectedClass.availableSeats < passengerCount) {
      setError("This class does not have enough seats. Refresh availability and choose another class.");
      return;
    }
    if (!email.trim() || !phone.trim() || passengers.some((passenger) =>
      passenger.name.trim().length < 2 || !Number.isInteger(Number(passenger.age)) ||
      Number(passenger.age) < 1 || Number(passenger.age) > 120,
    )) {
      setError("Enter each passenger's name and age, plus a valid contact email and phone.");
      return;
    }

    setSubmitting(true);
    try {
      const fromStationCode = params.get("fromStationCode") || undefined;
      const toStationCode = params.get("toStationCode") || undefined;
      const holdResponse = await api.trains.hold({
        trainRunId,
        classCode,
        passengerCount,
        fromStationCode,
        toStationCode,
      }, { "Idempotency-Key": getIdempotencyKey(`${trainRunId}:${classCode}:${passengerCount}`) });
      const hold = holdResponse.data;
      const bookingResponse = await api.bookings.createTravel({
        bookingType: "train",
        holdId: hold.holdId,
        passengers: passengers.map((passenger) => ({
          ...passenger,
          age: Number(passenger.age),
        })),
        contact: { email: email.trim(), phone: phone.trim() },
      });
      const booking = bookingResponse.data || bookingResponse.booking;
      sessionStorage.setItem(`travel-payment:${booking._id}`, JSON.stringify({
        holdId: hold.holdId,
        holdExpiresAt: hold.expiresAt,
      }));
      navigate(`/travel-payment/${booking._id}`);
    } catch (err) {
      setError(err.message || "Could not reserve this train. Please retry.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <main className="min-h-screen bg-gray-50 px-4 py-10" role="status" aria-label="Loading train">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="skeleton h-10 w-2/3 rounded-xl" />
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    </main>
  );
  if (error && !run) return <div className="mx-auto my-12 max-w-xl rounded-2xl bg-red-50 p-6 text-red-700">{error}</div>;
  if (!run) return null;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-5">
          <div className="rounded-2xl bg-gray-900 p-6 text-white">
            <div className="flex items-center gap-3"><TrainIcon className="text-red-400" /><h1 className="text-2xl font-bold">{run.trainName} ({run.trainNumber})</h1></div>
            <p className="mt-3 text-sm text-gray-300">{params.get("fromStationCode") || "Route start"} to {params.get("toStationCode") || "Route end"} · {run.travelDate}</p>
            <p className="mt-1 text-sm text-gray-300">{run.departureAt ? formatTime(run.departureAt) : ""} departure</p>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-bold">Choose class and passenger count</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(run.classes || []).map((item) => (
                <button key={item.code} type="button" disabled={!item.availableSeats}
                  onClick={() => setClassCode(item.code)}
                  className={`rounded-xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${classCode === item.code ? "border-red-600 bg-red-50" : "border-gray-200"}`}>
                  <span className="block font-bold">{item.name} ({item.code})</span>
                  <span className="text-sm text-gray-500">{item.availableSeats} available · ₹{item.fare} per passenger</span>
                </button>
              ))}
            </div>
            <label className="mt-5 block text-sm font-semibold">Passengers
              <select value={passengerCount} onChange={(event) => {
                const count = Number(event.target.value);
                setPassengerCount(count);
                setPassengers((current) => Array.from(
                  { length: count },
                  (_, index) => current[index] || { ...EMPTY_PASSENGER },
                ));
              }}
                className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-2">
                {Array.from({ length: Math.min(6, selectedClass?.availableSeats || 1) }, (_, index) => index + 1)
                  .map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
          </div>

          <div className="rounded-2xl border bg-white p-6">
            <h2 className="mb-4 text-lg font-bold">Passenger details</h2>
            <div className="space-y-4">
              {passengers.map((passenger, index) => (
                <div key={index} className="grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
                  <label className="text-sm">Full name
                    <input required minLength="2" value={passenger.name} onChange={(event) => updatePassenger(index, "name", event.target.value)}
                      className="mt-1 w-full rounded-lg border px-3 py-2" />
                  </label>
                  <label className="text-sm">Age
                    <input required type="number" min="1" max="120" value={passenger.age} onChange={(event) => updatePassenger(index, "age", event.target.value)}
                      className="mt-1 w-full rounded-lg border px-3 py-2" />
                  </label>
                  <label className="text-sm">Gender
                    <select value={passenger.gender} onChange={(event) => updatePassenger(index, "gender", event.target.value)}
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
                      {["Male", "Female", "Other"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">Berth preference
                    <select value={passenger.berthPreference} onChange={(event) => updatePassenger(index, "berthPreference", event.target.value)}
                      className="mt-1 w-full rounded-lg border bg-white px-3 py-2">
                      {["No preference", "Lower", "Middle", "Upper", "Side lower", "Side upper"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">Contact email
                <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2" />
              </label>
              <label className="text-sm">Contact phone
                <input required type="tel" value={phone} onChange={(event) => setPhone(event.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2" />
              </label>
            </div>
            {error && <p className="mt-4 flex gap-2 text-sm text-red-700" role="alert"><AlertCircle size={18} />{error}</p>}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border bg-white p-6 lg:sticky lg:top-6">
          <h2 className="font-bold">Fare summary</h2>
          <p className="mt-3 text-sm text-gray-600">{selectedClass?.name || "Select a class"} × {passengerCount}</p>
          <p className="mt-2 text-2xl font-extrabold">₹{selectedClass ? selectedClass.fare * passengerCount : 0}</p>
          <p className="mt-2 text-xs text-gray-500">Final fare and charges are calculated by the server when seats are held.</p>
          <button type="submit" disabled={submitting || !selectedClass}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-3 font-bold text-white disabled:bg-gray-400">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Reserving seats...</> : "Continue to payment"}
          </button>
        </aside>
      </form>
    </main>
  );
}
