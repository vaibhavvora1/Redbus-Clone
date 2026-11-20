// src/routes/AppRoutes.jsx
import { Routes, Route, useLocation } from "react-router-dom";
import Error from "../pages/Error";
import BusTicket from "../pages/BusTicket";
import TrainTickets from "../pages/TrainTicket";
import HotelSearch from "../pages/HotelSearch";
import MyBookings from "../pages/MyBookings";
import Help from "../pages/Help";
import BusListing from "../pages/BusListing";
import TrainListing from "../pages/Trainlisting";
import HotelListing from "../pages/Hotellisting";
import GovernmentBusesPage from "../pages/GovernmentBusesPage";
import VoteOperator from "../pages/VoteOperator";
import FreeCancellation from "../pages/FreeCancellation";
import BusTimetable from "../pages/BusTimetable";
import FlexiTicket from "../pages/FlexTicket";
import MyDetails from "../pages/MyDetails";
import Payment from "../pages/Payment";
import Seats from "../pages/Seats";
import PassengerDetails from "../pages/PassengerDetails";
import Ticket from "../pages/Ticket";
import TrainBooking from "../pages/TrainBooking";
import HotelDetail from "../pages/HotelDetail";
import HotelBooking from "../pages/HotelBooking";
import TravelPayment from "../pages/TravelPayment";
import TravelConfirmation from "../pages/TravelConfirmation";
import ProtectedRoute from "../components/ProtectedRoute";

import SignUp from "../pages/SignUp";
import Login from "../pages/Login";
import ForgotPassword from "../pages/ForgotPassword";
import Profile from "../pages/Profile";

// Admin Panel Components
import AdminLayout from "../admin/AdminLayout";
import Dashboard from "../admin/pages/Dashboard";
import AdminUsers from "../admin/pages/AdminUsers";
import AdminUserDetail from "../admin/pages/AdminUserDetail";
import AdminBookings from "../admin/pages/AdminBookings";
import AdminPayments from "../admin/pages/AdminPayments";
import AdminBuses from "../admin/pages/AdminBuses";
import AdminTrips from "../admin/pages/AdminTrips";
import AdminTrains from "../admin/pages/AdminTrains";
import AdminHotels from "../admin/pages/AdminHotels";
import AdminRoutes from "../admin/pages/AdminRoutes";
import AdminOperators from "../admin/pages/AdminOperators";
import AdminCities from "../admin/pages/AdminCities";
import AdminPromotions from "../admin/pages/AdminPromotions";
import AdminSettings from "../admin/pages/AdminSettings";

export default function AppRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="route-transition">
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
    </div>
  );
}
