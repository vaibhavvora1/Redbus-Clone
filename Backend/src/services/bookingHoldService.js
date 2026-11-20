import Booking from "../models/Booking.js";
import BookingHold from "../models/BookingHold.js";
import RoomInventory from "../models/RoomInventory.js";
import TrainRun from "../models/TrainRun.js";
import { withBookingTransaction } from "../utils/travelBooking.js";

export async function changeHoldInventory(hold, session, allowedStatuses, nextStatus, now = new Date()) {
  const updated = await BookingHold.findOneAndUpdate(
    {
      _id: hold._id,
      status: { $in: allowedStatuses },
      ...(nextStatus === "EXPIRED" ? { expiresAt: { $lte: now } } : {}),
      ...(nextStatus === "CONFIRMED" ? { expiresAt: { $gt: now } } : {}),
    },
    { $set: { status: nextStatus } },
    { session, returnDocument: "after" }
  );
  if (!updated) return false;

  if (nextStatus !== "CONFIRMED" && hold.bookingType === "train") {
    const result = await TrainRun.updateOne(
      { _id: hold.trainRunId, "classInventory.code": hold.classCode },
      { $inc: { "classInventory.$.availableSeats": hold.passengerCount } },
      { session }
    );
    if (result.modifiedCount !== 1) throw new Error("Could not release held train inventory.");
  } else if (nextStatus !== "CONFIRMED") {
    for (const date of [...hold.inventoryDates].sort()) {
      const filter = { roomTypeId: hold.roomTypeId, date };
      const update = nextStatus === "CONFIRMED"
        ? { $inc: { bookedRooms: 0 } }
        : { $inc: { bookedRooms: -hold.roomCount } };
      if (nextStatus !== "CONFIRMED") filter.bookedRooms = { $gte: hold.roomCount };
      const result = await RoomInventory.updateOne(filter, update, { session });
      if (result.modifiedCount !== 1) throw new Error(`Could not release hotel inventory for ${date}.`);
    }
  }

  if (nextStatus === "CONFIRMED") {
    await Booking.updateOne(
      { holdId: hold._id, status: "PENDING" },
      { $set: { status: "CONFIRMED", paymentStatus: "PAID" } },
      { session }
    );
  } else if (nextStatus === "EXPIRED") {
    await Booking.updateOne(
      { holdId: hold._id, status: "PENDING" },
      { $set: { status: "EXPIRED", paymentStatus: "FAILED" } },
      { session }
    );
  } else if (nextStatus === "RELEASED") {
    await Booking.updateOne(
      { holdId: hold._id, status: { $in: ["PENDING", "CONFIRMED"] } },
      {
        $set: {
          status: "CANCELLED",
          ...(hold.status === "HELD" ? { paymentStatus: "FAILED" } : {}),
        },
      },
      { session }
    );
  }
  return true;
}

export async function releaseBookingHold(holdId, userId, targetStatus = "RELEASED") {
  return withBookingTransaction(async (session) => {
    const hold = await BookingHold.findOne({ _id: holdId, userId }).session(session);
    if (!hold || hold.status !== "HELD") return false;
    return changeHoldInventory(hold, session, ["HELD"], targetStatus);
  });
}

export async function cleanupExpiredBookingHolds(now = new Date(), batchSize = 100) {
  const expired = await BookingHold.find({ status: "HELD", expiresAt: { $lte: now } })
    .sort({ expiresAt: 1 })
    .limit(batchSize)
    .lean();
  let released = 0;
  for (const hold of expired) {
    const didRelease = await withBookingTransaction((session) =>
      changeHoldInventory(hold, session, ["HELD"], "EXPIRED", now)
    );
    if (didRelease) released += 1;
  }
  return released;
}

export async function confirmBookingHold(hold, session) {
  return changeHoldInventory(hold, session, ["HELD"], "CONFIRMED");
}

export async function releaseConfirmedBooking(booking, session) {
  if (!booking.holdId) return false;
  const hold = await BookingHold.findOne({ _id: booking.holdId }).session(session);
  if (!hold || hold.status !== "CONFIRMED") return false;
  return changeHoldInventory(hold, session, ["CONFIRMED"], "RELEASED");
}
