import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Phone,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useBooking } from "../context/BookingContext";
import { useAuth } from "../context/AuthContext";
import BookingStepper from "../components/BookingStepper";

export default function PassengerDetails() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    trip,
    selectedSeats,
    passengers,
    updatePassenger,
    contact,
    setContact,
    fareSummary,
    setStep,
  } = useBooking();

  const [contactPhone, setContactPhone] = useState(
    contact?.phone || currentUser?.phone || currentUser?.mobile || ""
  );
  const [contactEmail, setContactEmail] = useState(
    contact?.email || currentUser?.email || ""
  );
  const [errors, setErrors] = useState({});

  // If no trip or no selected seats, redirect to bus search
  useEffect(() => {
    if (!trip || !selectedSeats || selectedSeats.length === 0) {
      navigate("/busListing");
    }
  }, [trip, selectedSeats, navigate]);

  const validateForm = () => {
    const errs = {};

    // Validate Contact
    const rawPhone = String(contactPhone).replace(/[\s()-]/g, "");
    if (!rawPhone || !/^(?:\+91|91|0)?[6-9]\d{9}$/.test(rawPhone)) {
      errs.contactPhone = "Please enter a valid 10-digit Indian mobile number";
    }

    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      errs.contactEmail = "Please enter a valid email address";
    }

    // Validate Passengers
    passengers.forEach((p, idx) => {
      if (!p.name || p.name.trim().length < 2) {
        errs[`passenger_${idx}_name`] = "Name must be at least 2 characters";
      }
      const ageNum = parseInt(p.age, 10);
      if (!ageNum || ageNum < 1 || ageNum > 120) {
        errs[`passenger_${idx}_age`] = "Enter a valid age (1-120)";
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleProceedToPayment = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setContact({ phone: contactPhone, email: contactEmail });
    setStep(4);
    navigate("/payment");
  };

  if (!trip || !selectedSeats || selectedSeats.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Stepper */}
      <BookingStepper currentStep={3} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Navigation / Back link */}
        <button
          type="button"
          onClick={() => navigate(trip?._id ? `/booking/${trip._id}` : "/seats")}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 transition mb-6 cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Seat Selection
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Form */}
          <div className="lg:col-span-2 space-y-6">
            <form onSubmit={handleProceedToPayment} className="space-y-6">
              {/* Passenger Cards */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
                <div className="border-b border-gray-100 pb-4 mb-6">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <User size={18} className="text-red-600" />
                    Passenger Information
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Please provide passenger details as per official Government ID
                  </p>
                </div>

                <div className="space-y-6">
                  {passengers.map((passenger, idx) => (
                    <div
                      key={passenger.seatNumber}
                      className="bg-gray-50 p-5 rounded-2xl border border-gray-200/80 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-red-600 bg-red-100 px-3 py-1 rounded-full">
                          Seat {passenger.seatNumber}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">Passenger {idx + 1}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Name */}
                        <div className="md:col-span-1">
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Rahul Sharma"
                            value={passenger.name || ""}
                            onChange={(e) => updatePassenger(idx, "name", e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
                          />
                          {errors[`passenger_${idx}_name`] && (
                            <p className="text-[11px] text-red-500 mt-1">
                              {errors[`passenger_${idx}_name`]}
                            </p>
                          )}
                        </div>

                        {/* Age */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Age <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            placeholder="e.g. 28"
                            min="1"
                            max="120"
                            value={passenger.age || ""}
                            onChange={(e) => updatePassenger(idx, "age", e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
                          />
                          {errors[`passenger_${idx}_age`] && (
                            <p className="text-[11px] text-red-500 mt-1">
                              {errors[`passenger_${idx}_age`]}
                            </p>
                          )}
                        </div>

                        {/* Gender */}
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Gender
                          </label>
                          <div className="flex gap-2">
                            {["Male", "Female", "Other"].map((g) => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => updatePassenger(idx, "gender", g)}
                                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition ${
                                  (passenger.gender || "Male") === g
                                    ? "bg-red-600 text-white border-red-600 shadow-xs"
                                    : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                                }`}
                              >
                                {g}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs">
                <div className="border-b border-gray-100 pb-4 mb-6">
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Phone size={18} className="text-red-600" />
                    Contact Information
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Your ticket and journey updates will be sent to your email address
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-500">
                        +91
                      </span>
                      <input
                        type="tel"
                        maxLength="10"
                        placeholder="9876543210"
                        value={contactPhone.replace(/^\+91/, "")}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-xl pl-11 pr-3 py-2 text-xs text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
                      />
                    </div>
                    {errors.contactPhone && (
                      <p className="text-[11px] text-red-500 mt-1">{errors.contactPhone}</p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. passenger@gmail.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:ring-2 focus:ring-red-500 outline-none"
                    />
                    {errors.contactEmail && (
                      <p className="text-[11px] text-red-500 mt-1">{errors.contactEmail}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button (Mobile) */}
              <div className="block lg:hidden">
                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-full shadow-md transition flex items-center justify-center gap-2 text-sm"
                >
                  Proceed to Payment <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>

          {/* Right Col: Trip & Fare Summary */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs sticky top-40">
              <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 mb-4">
                Booking Summary
              </h3>

              {/* Trip Highlights */}
              <div className="bg-gray-50 rounded-xl p-3.5 mb-4 text-xs space-y-1.5 border border-gray-100">
                <div className="font-extrabold text-gray-900">{trip.operator}</div>
                <div className="text-gray-600">
                  {trip.fromCity || trip.from} → {trip.toCity || trip.to}
                </div>
                <div className="text-gray-500 font-medium">
                  Travel date: {trip.travelDate || trip.journeyDate} • {trip.departureTime}
                </div>
                <div className="text-red-600 font-bold pt-1">
                  Seats: {selectedSeats.join(", ")}
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="space-y-2.5 text-xs border-t border-gray-100 pt-4 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Base Fare ({fareSummary.seatCount} seats)</span>
                  <span className="font-semibold text-gray-900">₹{fareSummary.baseFare}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>GST & Service Taxes (5%)</span>
                  <span className="font-semibold text-gray-900">₹{fareSummary.tax}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-gray-900 border-t border-gray-200 pt-3">
                  <span>Total Amount</span>
                  <span className="text-red-600">₹{fareSummary.totalAmount}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleProceedToPayment}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-full shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 text-sm"
              >
                Proceed to Payment <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

