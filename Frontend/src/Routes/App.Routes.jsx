// src/routes/AppRoutes.jsx
import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";

const Error = lazy(() => import("../pages/Error"));
const BusTicket = lazy(() => import("../pages/BusTicket"));
const TrainTickets = lazy(() => import("../pages/TrainTicket"));
const HotelSearch = lazy(() => import("../pages/Hotelsearch"));
const MyBookings = lazy(() => import("../pages/MyBookings"));
const Help = lazy(() => import("../pages/Help"));
const BusListing = lazy(() => import("../pages/Buslisting"));
const TrainListing = lazy(() => import("../pages/Trainlisting"));
const HotelListing = lazy(() => import("../pages/Hotellisting"));
const GovernmentBusesPage = lazy(() => import("../pages/Governmentbusespage"));
const VoteOperator = lazy(() => import("../pages/VoteOperator"));
const FreeCancellation = lazy(() => import("../pages/FreeCancellation"));
const BusTimetable = lazy(() => import("../pages/BusTimetable"));
const FlexiTicket = lazy(() => import("../pages/FlexTicket"));
const MyDetails = lazy(() => import("../pages/MyDetails"));
const Payment = lazy(() => import("../pages/Payment"));
const Seats = lazy(() => import("../pages/Seats"));
const PassengerDetails = lazy(() => import("../pages/PassengerDetails"));
const Ticket = lazy(() => import("../pages/Ticket"));
const TrainBooking = lazy(() => import("../pages/TrainBooking"));
const HotelDetail = lazy(() => import("../pages/HotelDetail"));
const HotelBooking = lazy(() => import("../pages/HotelBooking"));
const TravelPayment = lazy(() => import("../pages/TravelPayment"));
const TravelConfirmation = lazy(() => import("../pages/TravelConfirmation"));
const SignUp = lazy(() => import("../pages/SignUp"));
const Login = lazy(() => import("../pages/Login"));
const ForgotPassword = lazy(() => import("../pages/ForgotPassword"));
const Profile = lazy(() => import("../pages/Profile"));
const AdminLayout = lazy(() => import("../admin/AdminLayout"));
const Dashboard = lazy(() => import("../admin/pages/Dashboard"));
const AdminUsers = lazy(() => import("../admin/pages/AdminUsers"));
const AdminUserDetail = lazy(() => import("../admin/pages/AdminUserDetail"));
const AdminBookings = lazy(() => import("../admin/pages/AdminBookings"));
const AdminPayments = lazy(() => import("../admin/pages/AdminPayments"));
const AdminBuses = lazy(() => import("../admin/pages/AdminBuses"));
const AdminTrips = lazy(() => import("../admin/pages/AdminTrips"));
const AdminTrains = lazy(() => import("../admin/pages/AdminTrains"));
const AdminHotels = lazy(() => import("../admin/pages/AdminHotels"));
const AdminRoutes = lazy(() => import("../admin/pages/AdminRoutes"));
const AdminOperators = lazy(() => import("../admin/pages/AdminOperators"));
const AdminCities = lazy(() => import("../admin/pages/AdminCities"));
const AdminPromotions = lazy(() => import("../admin/pages/AdminPromotions"));
const AdminSettings = lazy(() => import("../admin/pages/AdminSettings"));

export default function AppRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="route-transition">
      <Suspense
        fallback={
          <div
            className="min-h-[40vh] animate-pulse bg-gray-100"
            role="status"
            aria-label="Loading page"
          />
        }
      >
    <Routes>
      <Route path="/" element={<BusTicket />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/trains" element={<TrainTickets />} />
      <Route path="/hotels" element={<HotelSearch />} />
      <Route path="/hotels/:hotelId" element={<ProtectedRoute><HotelDetail /></ProtectedRoute>} />
      <Route path="/hotel-booking/:hotelId" element={<ProtectedRoute><HotelBooking /></ProtectedRoute>} />
      <Route path="/train-booking/:trainRunId" element={<ProtectedRoute><TrainBooking /></ProtectedRoute>} />
      <Route path="/travel-payment/:bookingId" element={<ProtectedRoute><TravelPayment /></ProtectedRoute>} />
      <Route path="/travel-booking/confirmation/:bookingId" element={<ProtectedRoute><TravelConfirmation /></ProtectedRoute>} />
      <Route path="/mybookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
      <Route path="/my-details" element={<ProtectedRoute><MyDetails /></ProtectedRoute>} />

      {/* Dynamic and Unified Bus Booking Funnel (Protected: Requires Authenticated User) */}
      <Route
        path="/booking/:tripId"
        element={
          <ProtectedRoute>
            <Seats />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seats"
        element={
          <ProtectedRoute>
            <Seats />
          </ProtectedRoute>
        }
      />
      <Route
        path="/passenger-details"
        element={
          <ProtectedRoute>
            <PassengerDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment"
        element={
          <ProtectedRoute>
            <Payment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking/confirmation/:bookingId"
        element={
          <ProtectedRoute>
            <Ticket />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ticket/:bookingId"
        element={
          <ProtectedRoute>
            <Ticket />
          </ProtectedRoute>
        }
      />

      <Route path="/help" element={<Help />} />
      <Route path="/busListing" element={<BusListing />} />
      <Route path="/buslisting" element={<BusListing />} />
      <Route path="/trainListing" element={<TrainListing />} />
      <Route path="/trainlisting" element={<TrainListing />} />
      <Route path="/hotelListing" element={<HotelListing />} />
      <Route path="/hotellisting" element={<HotelListing />} />
      <Route path="/government-buses" element={<GovernmentBusesPage />} />
      <Route path="/vote-operator" element={<VoteOperator />} />
      <Route path="/free-cancellation" element={<FreeCancellation />} />
      <Route path="/bus-timetable" element={<BusTimetable />} />
      <Route path="/flexi-ticket" element={<FlexiTicket />} />

      {/* Admin Panel Nested Routes — Protected: ADMIN role required */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:id" element={<AdminUserDetail />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="buses" element={<AdminBuses />} />
        <Route path="trips" element={<AdminTrips />} />
        <Route path="trains" element={<AdminTrains />} />
        <Route path="hotels" element={<AdminHotels />} />
        <Route path="routes" element={<AdminRoutes />} />
        <Route path="operators" element={<AdminOperators />} />
        <Route path="cities" element={<AdminCities />} />
        <Route path="promotions" element={<AdminPromotions />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<Error />} />
    </Routes>
      </Suspense>
    </div>
  );
}
