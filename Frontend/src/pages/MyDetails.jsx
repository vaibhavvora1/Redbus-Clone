import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Clock,
  MapPin,
  Sparkles,
  Info,
  ChevronRight,
  UserCheck,
} from "lucide-react";

export default function MyDetails() {
  const navigate = useNavigate();
  const location = useLocation();

  // Try to prefill from state or sessionStorage if previously entered
  const existingPassenger =
    location.state?.passenger ||
    (() => {
      try {
        const saved = sessionStorage.getItem("redbus_passenger_details");
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    })();

  const [formData, setFormData] = useState({
    fullName: existingPassenger?.fullName || "",
    age: existingPassenger?.age || "",
    gender: existingPassenger?.gender || "Male",
    mobile: existingPassenger?.mobile || "",
    email: existingPassenger?.email || "",
    whatsappUpdates: true,
    saveDetails: true,
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const tripInfo = location.state?.trip || null;

  if (!tripInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-bold text-gray-900">Trip details unavailable</h1>
          <p className="text-sm text-gray-500 mt-2">Select a trip before entering passenger details.</p>
          <Link to="/" className="inline-block mt-5 bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl">Back to search</Link>
        </div>
      </div>
    );
  }

  const validateField = (field, value) => {
    let err = "";
    if (field === "fullName") {
      if (!value.trim()) {
        err = "Full name is required";
      } else if (value.trim().length < 3) {
        err = "Name must be at least 3 characters";
      }
    } else if (field === "age") {
      const num = Number(value);
      if (!value) {
        err = "Age is required";
      } else if (isNaN(num) || num < 1 || num > 120) {
        err = "Please enter a valid age (1 - 120)";
      }
    } else if (field === "gender") {
      if (!value) {
        err = "Please select gender";
      }
    } else if (field === "mobile") {
      const clean = value.replace(/\D/g, "");
      if (!clean) {
        err = "Mobile number is required";
      } else if (clean.length !== 10) {
        err = "Enter a valid 10-digit mobile number";
      }
    } else if (field === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!value.trim()) {
        err = "Email address is required";
      } else if (!emailRegex.test(value.trim())) {
        err = "Please enter a valid email address";
      }
    }
    return err;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newVal = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: newVal }));

    if (touched[name]) {
      const err = validateField(name, newVal);
      setErrors((prev) => ({ ...prev, [name]: err }));
    }
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const err = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: err }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const newErrors = {
      fullName: validateField("fullName", formData.fullName),
      age: validateField("age", formData.age),
      gender: validateField("gender", formData.gender),
      mobile: validateField("mobile", formData.mobile),
      email: validateField("email", formData.email),
    };

    setErrors(newErrors);
    setTouched({
      fullName: true,
      age: true,
      gender: true,
      mobile: true,
      email: true,
    });

    const hasError = Object.values(newErrors).some((msg) => msg !== "");
    if (hasError) return;

    // Save to sessionStorage for persistence across pages
    try {
      sessionStorage.setItem(
        "redbus_passenger_details",
        JSON.stringify(formData)
      );
    } catch (e) {
      console.error(e);
    }

    // Navigate to payment with state
    navigate("/payment", {
      state: {
        passenger: formData,
        trip: tripInfo,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      {/* Container */}
      <div className="max-w-6xl mx-auto">
        {/* Step Indicator & Breadcrumb */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 mb-3">
            <Link to="/" className="hover:text-red-600 transition">
              Home
            </Link>
            <ChevronRight size={14} />
            <span className="text-red-600 font-bold">1. My Details</span>
            <ChevronRight size={14} />
            <span className="text-gray-400">2. Payment</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                My Details
                <span className="text-xs font-semibold px-2.5 py-1 bg-red-100 text-red-700 rounded-full">
                  Step 1 of 2
                </span>
              </h1>
              <p className="text-sm text-gray-500 mt-1.5 max-w-xl">
                Please enter your passenger details to complete your bus booking
                and receive instant ticket confirmation via Email.
              </p>
            </div>

            {/* Progress pill */}
            <div className="bg-white border border-gray-200 rounded-2xl px-5 py-3 shadow-xs flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-red-600 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                1
              </div>
              <div className="text-xs">
                <div className="font-bold text-gray-900">Passenger Info</div>
                <div className="text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                  <Sparkles size={12} /> Next: Payment
                </div>
              </div>
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden ml-2">
                <div className="w-1/2 h-full bg-red-600 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Passenger Form (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <form
              onSubmit={handleSubmit}
              className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-xs hover:shadow-md transition-shadow"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between pb-6 border-b border-gray-100 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">
                      Primary Passenger Details
                    </h2>
                    <p className="text-xs text-gray-400">
                      Enter details as per your Government-issued photo ID
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-gray-400">
                  * Required fields
                </span>
              </div>

              <div className="space-y-6">
                {/* Full Name */}
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      onBlur={() => handleBlur("fullName")}
                      placeholder="e.g. Rahul Sharma"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium transition outline-none ${
                        errors.fullName && touched.fullName
                          ? "border-red-500 bg-red-50/30 text-gray-900 focus:ring-2 focus:ring-red-300"
                          : "border-gray-200 hover:border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-100 text-gray-800"
                      }`}
                    />
                  </div>
                  {errors.fullName && touched.fullName && (
                    <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                      <Info size={13} /> {errors.fullName}
                    </p>
                  )}
                </div>

                {/* Age & Gender Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Age */}
                  <div>
                    <label
                      htmlFor="age"
                      className="block text-sm font-semibold text-gray-700 mb-2"
                    >
                      Age (Years) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Calendar size={18} />
                      </div>
                      <input
                        type="number"
                        id="age"
                        name="age"
                        min="1"
                        max="120"
                        value={formData.age}
                        onChange={handleChange}
                        onBlur={() => handleBlur("age")}
                        placeholder="e.g. 28"
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium transition outline-none ${
                          errors.age && touched.age
                            ? "border-red-500 bg-red-50/30 text-gray-900 focus:ring-2 focus:ring-red-300"
                            : "border-gray-200 hover:border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-100 text-gray-800"
                        }`}
                      />
                    </div>
                    {errors.age && touched.age && (
                      <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                        <Info size={13} /> {errors.age}
                      </p>
                    )}
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Gender <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {["Male", "Female", "Other"].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, gender: g }));
                            setErrors((prev) => ({ ...prev, gender: "" }));
                          }}
                          className={`py-3 px-3 rounded-xl text-sm font-bold border transition text-center ${
                            formData.gender === g
                              ? "bg-red-600 text-white border-red-600 shadow-xs"
                              : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                    {errors.gender && touched.gender && (
                      <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                        <Info size={13} /> {errors.gender}
                      </p>
                    )}
                  </div>
                </div>

                {/* Mobile Number */}
                <div>
                  <label
                    htmlFor="mobile"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div
                    className={`flex items-center rounded-xl border transition overflow-hidden ${
                      errors.mobile && touched.mobile
                        ? "border-red-500 bg-red-50/30 ring-2 ring-red-300"
                        : "border-gray-200 hover:border-gray-300 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100"
                    }`}
                  >
                    <div className="bg-gray-100 px-3.5 py-3 border-r border-gray-200 text-gray-700 font-semibold text-sm flex items-center gap-1.5 shrink-0">
                      <Phone size={15} className="text-gray-500" />
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      id="mobile"
                      name="mobile"
                      maxLength={10}
                      value={formData.mobile}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setFormData((prev) => ({ ...prev, mobile: val }));
                        if (touched.mobile) {
                          setErrors((prev) => ({
                            ...prev,
                            mobile: validateField("mobile", val),
                          }));
                        }
                      }}
                      onBlur={() => handleBlur("mobile")}
                      placeholder="9876543210"
                      className="w-full px-4 py-3 text-sm font-medium outline-none text-gray-800 bg-transparent"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Your m-ticket and driver tracking link will be sent to this
                    number.
                  </p>
                  {errors.mobile && touched.mobile && (
                    <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                      <Info size={13} /> {errors.mobile}
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold text-gray-700 mb-2"
                  >
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Mail size={18} />
                    </div>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={() => handleBlur("email")}
                      placeholder="rahul.sharma@example.com"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border text-sm font-medium transition outline-none ${
                        errors.email && touched.email
                          ? "border-red-500 bg-red-50/30 text-gray-900 focus:ring-2 focus:ring-red-300"
                          : "border-gray-200 hover:border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-100 text-gray-800"
                      }`}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Your invoice and printable PDF ticket will be emailed here.
                  </p>
                  {errors.email && touched.email && (
                    <p className="text-xs text-red-600 font-medium mt-1.5 flex items-center gap-1">
                      <Info size={13} /> {errors.email}
                    </p>
                  )}
                </div>

                {/* Toggles */}
                <div className="pt-2 border-t border-gray-100 space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="whatsappUpdates"
                      checked={formData.whatsappUpdates}
                      onChange={handleChange}
                      className="mt-0.5 w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500 accent-red-600"
                    />
                    <span className="text-xs text-gray-600">
                      Send booking confirmation, boarding point map, and bus
                      tracking updates on{" "}
                      <strong className="text-emerald-700">WhatsApp</strong>.
                    </span>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="saveDetails"
                      checked={formData.saveDetails}
                      onChange={handleChange}
                      className="mt-0.5 w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500 accent-red-600"
                    />
                    <span className="text-xs text-gray-600">
                      Save passenger details for faster 1-click booking next
                      time.
                    </span>
                  </label>
                </div>

                {/* Submit / Continue Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-4 px-6 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 text-base cursor-pointer group"
                  >
                    <span>Continue to Payment</span>
                    <ArrowRight
                      size={18}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </button>
                  <p className="text-center text-[11px] text-gray-400 mt-2.5">
                    By continuing, you agree to the RedBus Terms of Service and
                    Privacy Policy.
                  </p>
                </div>
              </div>
            </form>
          </div>

          {/* Right: Booking Trip Summary & Perks (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* Trip Preview Card */}
            <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                    Journey Details
                  </span>
                  <h3 className="font-extrabold text-gray-900 mt-1.5 text-base">
                    {tripInfo.busName}
                  </h3>
                </div>
                <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full">
                  ★ {tripInfo.operatorRating}
                </div>
              </div>

              {/* Route */}
              <div className="py-4 border-b border-gray-100">
                <div className="flex items-center justify-between text-sm font-bold text-gray-900 mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={15} className="text-red-500" />
                    <span>{tripInfo.from}</span>
                  </div>
                  <span className="text-gray-300">→</span>
                  <div className="flex items-center gap-2">
                    <MapPin size={15} className="text-emerald-500" />
                    <span>{tripInfo.to}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 mt-3 bg-gray-50 p-2.5 rounded-xl">
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} />
                    <span>
                      {tripInfo.departureTime} → {tripInfo.arrivalTime}
                    </span>
                  </div>
                  <span className="font-semibold text-gray-600">
                    {tripInfo.duration}
                  </span>
                </div>
              </div>

              {/* Date & Seats */}
              <div className="py-3 text-xs space-y-2 border-b border-gray-100">
                <div className="flex justify-between">
                  <span className="text-gray-500">Journey Date:</span>
                  <span className="font-bold text-gray-800">
                    {tripInfo.date}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Selected Seats:</span>
                  <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                    {tripInfo.seats.join(", ")}
                  </span>
                </div>
              </div>

              {/* Fare total quick peek */}
              <div className="pt-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400">Total Payable</span>
                  <div className="text-2xl font-black text-gray-900">
                    ₹{tripInfo.totalFare}
                  </div>
                </div>
                <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">
                  All taxes included
                </span>
              </div>
            </div>

            {/* RedBus Assurances */}
            <div className="bg-gradient-to-br from-red-50/60 to-orange-50/60 rounded-3xl border border-red-100 p-5 space-y-3.5">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <ShieldCheck size={18} className="text-red-600" />
                <span>RedBus Booking Assurance</span>
              </div>
              <ul className="text-xs text-gray-600 space-y-2.5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Free cancellation up to 6 hrs before departure</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Instant refund directly to payment source</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>24x7 Customer support on call & chat</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>100% Verified GPS-tracked buses</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
