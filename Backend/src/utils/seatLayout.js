/** Generate the standard seat inventory used when a dated trip is created. */
export const generateDefaultSeatLayout = (totalSeats = 36, fare = 799, busType = "AC Sleeper") => {
  const seats = [];
  const isSleeper = String(busType).toLowerCase().includes("sleeper");
  const isHybrid = String(busType).toLowerCase().includes("seater") && isSleeper;

  if (isSleeper && !isHybrid) {
    const perDeck = Math.ceil(totalSeats / 2);
    for (let i = 1; i <= perDeck; i++) {
      const row = Math.ceil(i / 3);
      const col = ((i - 1) % 3) + 1;
      seats.push({
        seatNumber: `L${i}`,
        deck: "lower",
        row,
        col: col === 3 ? 4 : col,
        type: "sleeper",
        fare,
        isBooked: false,
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
      });
    }
    for (let i = 1; i <= totalSeats - perDeck; i++) {
      const row = Math.ceil(i / 3);
      const col = ((i - 1) % 3) + 1;
      seats.push({
        seatNumber: `U${i}`,
        deck: "upper",
        row,
        col: col === 3 ? 4 : col,
        type: "sleeper",
        fare: fare + 50,
        isBooked: false,
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
      });
    }
  } else {
    for (let i = 1; i <= totalSeats; i++) {
      const row = Math.ceil(i / 4);
      const col = ((i - 1) % 4) + 1;
      seats.push({
        seatNumber: `${i}`,
        deck: "lower",
        row,
        col: col > 2 ? col + 1 : col,
        type: "seater",
        fare,
        isBooked: false,
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
      });
    }
  }
  return seats;
};

export default generateDefaultSeatLayout;
