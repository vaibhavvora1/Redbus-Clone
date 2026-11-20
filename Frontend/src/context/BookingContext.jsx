import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

const BookingContext = createContext(null);

const STORAGE_KEY = "redbus_booking_session";

const initialBookingState = {
  trip: null,
  selectedSeats: [], // Array of seatNumber strings, e.g. ["L1", "L2"]
  seatsDetails: [], // Array of seat objects { seatNumber, deck, type, fare }
  passengers: [], // Array of { seatNumber, name, age, gender }
  contact: { phone: "", email: "" },
  boardingPoint: "",
  droppingPoint: "",
  currentStep: 2, // 1: Search, 2: Seats, 3: Passenger Details, 4: Payment, 5: Ticket
  bookingId: null,
  confirmedBooking: null,
  holdExpiresAt: null,
  serverTotals: null, // { baseFare, tax, totalAmount } recalculated by server
};

export function BookingProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...initialBookingState, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("Failed to load booking session from sessionStorage:", e);
    }
    return initialBookingState;
  });

  // Sync state to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to persist booking session:", e);
    }
  }, [state]);

  const initTrip = useCallback((tripData) => {
    setState((prev) => {
      // If switching to a new trip, reset seats and passengers
      const isSameTrip =
        prev.trip && (prev.trip._id === tripData._id || prev.trip.id === tripData.id);
      return {
        ...prev,
        trip: tripData,
        selectedSeats: isSameTrip ? prev.selectedSeats : [],
        seatsDetails: isSameTrip ? prev.seatsDetails : [],
        passengers: isSameTrip ? prev.passengers : [],
        boardingPoint: tripData.boardingPoints?.[0]?.name || prev.boardingPoint || "",
        droppingPoint: tripData.droppingPoints?.[0]?.name || prev.droppingPoint || "",
        currentStep: 2,
        holdExpiresAt: isSameTrip ? prev.holdExpiresAt : null,
      };
    });
  }, []);

  const toggleSeat = useCallback((seat) => {
    setState((prev) => {
      const isSelected = prev.selectedSeats.includes(seat.seatNumber);
      let updatedSeats;
      let updatedDetails;
      let updatedPassengers;

      if (isSelected) {
        updatedSeats = prev.selectedSeats.filter((s) => s !== seat.seatNumber);
        updatedDetails = prev.seatsDetails.filter((s) => s.seatNumber !== seat.seatNumber);
        updatedPassengers = prev.passengers.filter((p) => p.seatNumber !== seat.seatNumber);
      } else {
        // Max 6 seats per booking
        if (prev.selectedSeats.length >= 6) {
          return prev;
        }
        updatedSeats = [...prev.selectedSeats, seat.seatNumber];
        updatedDetails = [
          ...prev.seatsDetails,
          {
            seatNumber: seat.seatNumber,
            deck: seat.deck || "lower",
            type: seat.type || "seater",
            fare: Number(seat.fare || prev.trip?.fare || prev.trip?.price || 799),
          },
        ];
        // Create initial passenger entry for this seat
        const existingPassenger = prev.passengers.find((p) => p.seatNumber === seat.seatNumber);
        updatedPassengers = [
          ...prev.passengers,
          existingPassenger || {
            seatNumber: seat.seatNumber,
            name: "",
            age: "",
            gender: "Male",
          },
        ];
      }

      return {
        ...prev,
        selectedSeats: updatedSeats,
        seatsDetails: updatedDetails,
        passengers: updatedPassengers,
      };
    });
  }, []);

  const clearSeats = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedSeats: [],
      seatsDetails: [],
      passengers: [],
      holdExpiresAt: null,
      serverTotals: null,
    }));
  }, []);

  const setHoldExpiresAt = useCallback((expiresAt) => {
    setState((prev) => ({
      ...prev,
      holdExpiresAt: expiresAt,
    }));
  }, []);

  const setServerTotals = useCallback((totals) => {
    setState((prev) => ({
      ...prev,
      serverTotals: totals,
    }));
  }, []);

  const setPassengers = useCallback((passengersList) => {
    setState((prev) => ({
      ...prev,
      passengers: passengersList,
    }));
  }, []);

  const updatePassenger = useCallback((index, field, value) => {
    setState((prev) => {
      const list = [...prev.passengers];
      if (list[index]) {
        list[index] = { ...list[index], [field]: value };
      }
      return { ...prev, passengers: list };
    });
  }, []);

  const setContact = useCallback((contactObj) => {
    setState((prev) => ({
      ...prev,
      contact: { ...prev.contact, ...contactObj },
    }));
  }, []);

  const setBoardingAndDropping = useCallback((boarding, dropping) => {
    setState((prev) => ({
      ...prev,
      boardingPoint: boarding || prev.boardingPoint,
      droppingPoint: dropping || prev.droppingPoint,
    }));
  }, []);

  const setStep = useCallback((stepNumber) => {
    setState((prev) => ({
      ...prev,
      currentStep: stepNumber,
    }));
  }, []);

  const setConfirmedBooking = useCallback((bookingData) => {
    setState((prev) => ({
      ...prev,
      currentStep: 5,
      bookingId: bookingData.bookingId || bookingData._id,
      confirmedBooking: bookingData,
    }));
  }, []);

  const clearBooking = useCallback(() => {
    setState(initialBookingState);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Compute live client fare summary (for display only; server recalculated values take precedence)
  const fareSummary = useMemo(() => {
    if (state.serverTotals) {
      return {
        baseFare: state.serverTotals.baseFare,
        tax: state.serverTotals.tax,
        totalAmount: state.serverTotals.totalAmount,
        seatCount: state.selectedSeats.length,
      };
    }
    const baseFare = state.seatsDetails.reduce((sum, s) => sum + Number(s.fare || 0), 0);
    // GST 5% on passenger bus transport
    const gstRate = 0.05;
    const tax = Math.round(baseFare * gstRate);
    const totalAmount = baseFare + tax;
    return {
      baseFare,
      tax,
      totalAmount,
      seatCount: state.selectedSeats.length,
    };
  }, [state.seatsDetails, state.selectedSeats, state.serverTotals]);

  const value = {
    ...state,
    fareSummary,
    initTrip,
    toggleSeat,
    clearSeats,
    setHoldExpiresAt,
    setServerTotals,
    setPassengers,
    updatePassenger,
    setContact,
    setBoardingAndDropping,
    setStep,
    setConfirmedBooking,
    clearBooking,
  };

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error("useBooking must be used within a BookingProvider");
  }
  return context;
}

export default BookingContext;
