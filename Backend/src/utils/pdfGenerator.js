import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { formatTime } from "./timeZone.js";

function generateTravelPdf(booking, outputStream) {
  return new Promise((resolve, reject) => {
    const type = booking.bookingType;
    const isTrain = type === "train";
    const reference = booking.bookingId || String(booking._id);
    const payment = booking.paymentId && typeof booking.paymentId === "object" ? booking.paymentId : null;
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: `${isTrain ? "Train Ticket" : "Hotel Voucher"}_${reference}`,
        Author: "redBus",
        Subject: isTrain ? "Train e-ticket" : "Hotel booking voucher",
      },
    });

    doc.on("error", reject);
    outputStream.on("error", reject);
    outputStream.on("finish", resolve);
    doc.pipe(outputStream);

    const red = "#D8232A";
    const muted = "#64748B";
    const text = "#1E293B";
    const status = booking.status === "CONFIRMED" ? "CONFIRMED" : String(booking.status || "PENDING").toUpperCase();
    doc.rect(48, 48, 500, 60).fill(red);
    doc.font("Helvetica-Bold").fontSize(23).fillColor("#FFFFFF").text("redBus", 64, 59);
    doc.font("Helvetica").fontSize(10).fillColor("#FEE2E2")
      .text(isTrain ? "Train e-ticket" : "Hotel booking voucher", 64, 86);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF")
      .text(status, 430, 72, { width: 100, align: "right" });

    let y = 130;
    const heading = (value) => {
      doc.moveDown(0.7);
      doc.font("Helvetica-Bold").fontSize(13).fillColor(red).text(value, 48, doc.y);
      doc.moveDown(0.35);
    };
    const row = (label, value) => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(muted).text(label, 48, doc.y, { continued: true });
      doc.font("Helvetica").fontSize(10).fillColor(text).text(`  ${value || "—"}`, { width: 500 });
      doc.moveDown(0.15);
    };

    doc.font("Helvetica-Bold").fontSize(9).fillColor(muted).text(isTrain ? "PNR / BOOKING REFERENCE" : "BOOKING REFERENCE", 48, y);
    doc.font("Helvetica-Bold").fontSize(15).fillColor(text).text(reference, 48, y + 15);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(muted).text("BOOKING STATUS", 350, y);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(text).text(status, 350, y + 15);
    y += 52;

    if (isTrain) {
      heading("TRAIN JOURNEY");
      row("Train", `${booking.operator || "Train"} ${booking.trainNumber ? `(${booking.trainNumber})` : ""}`);
      row("From", `${booking.fromStation || "-"}${booking.fromStationCode ? ` (${booking.fromStationCode})` : ""} - ${booking.fromCity || ""}`);
      row("To", `${booking.toStation || "-"}${booking.toStationCode ? ` (${booking.toStationCode})` : ""} - ${booking.toCity || ""}`);
      row("Travel date", booking.date);
      row("Departure", booking.departureAt ? formatTime(booking.departureAt) : booking.time);
      row("Arrival", booking.arrivalAt ? formatTime(booking.arrivalAt) : "");
      row("Class", booking.trainClass);
      heading("PASSENGERS");
      (booking.passengers || []).forEach((passenger, index) => {
        row(`Passenger ${index + 1}`, `${passenger.name}, age ${passenger.age}, ${passenger.gender}; berth: ${passenger.berthPreference || "No preference"}`);
      });
    } else {
      heading("HOTEL STAY");
      row("Hotel", booking.operator || booking.title);
      row("Address", booking.hotelAddress || booking.fromCity);
      row("Room type", booking.roomTypeName);
      row("Check-in", `${booking.checkIn} at ${booking.checkInTime || "14:00"} (${booking.nights} night(s))`);
      row("Check-out", `${booking.checkOut} at ${booking.checkOutTime || "11:00"}`);
      row("Rooms / guests", `${booking.roomCount} room(s) / ${(booking.guests || []).length} guest(s)`);
      heading("GUESTS");
      (booking.guests || []).forEach((guest, index) => {
        row(`Guest ${index + 1}`, `${guest.name}${guest.age === undefined ? "" : `, age ${guest.age}`}${guest.gender ? `, ${guest.gender}` : ""}`);
      });
      if (booking.specialRequest) row("Special request", booking.specialRequest);
    }

    heading("FARE BREAKDOWN");
    const fare = booking.fareBreakdown || {};
    row("Base fare", `INR ${Number(fare.baseFare ?? booking.baseFare ?? 0).toLocaleString("en-IN")}`);
    row("Tax", `INR ${Number(fare.tax ?? booking.tax ?? 0).toLocaleString("en-IN")}`);
    row("Charges", `INR ${Number(fare.charges || 0).toLocaleString("en-IN")}`);
    row("Total paid", `INR ${Number(fare.totalAmount ?? booking.totalAmount ?? booking.amount ?? 0).toLocaleString("en-IN")}`);
    row("Payment ID", payment?.razorpayPaymentId || "—");
    row("Order ID", booking.paymentOrderId || payment?.razorpayOrderId || "—");

    if (!isTrain) {
      heading("CANCELLATION POLICY");
      row("Policy", booking.cancellationPolicy || "See the booking terms for cancellation eligibility.");
    }
    doc.end();
  });
}

/**
 * Generates an official, clean, professional A4 PDF ticket stream using PDFKit.
 * Contains selectable text, vectors, official branding, PNR, QR code, and fare breakdown.
 *
 * @param {Object} booking - Booking document (populated with tripId/userId if available)
 * @param {stream.Writable} outputStream - Stream to pipe PDF chunks to (e.g. Express res)
 * @returns {Promise<void>}
 */
export async function generateTicketPdf(booking, outputStream) {
  if (booking.bookingType === "train" || booking.bookingType === "hotel") {
    return generateTravelPdf(booking, outputStream);
  }

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: `Ticket_${booking.bookingId || "RedBus"}`,
          Author: "redBus India",
          Subject: "Bus Travel E-Ticket",
          Keywords: "redbus, ticket, bus, travel, pnr",
        },
      });

      doc.on("error", reject);
      outputStream.on("error", reject);
      outputStream.on("finish", resolve);

      doc.pipe(outputStream);

      const RED_PRIMARY = "#D8232A";
      const TEXT_MAIN = "#1E293B";
      const TEXT_MUTED = "#64748B";
      const BORDER_COLOR = "#E2E8F0";
      const BG_LIGHT = "#F8FAFC";
      const SUCCESS_GREEN = "#16A34A";

      // 1. HEADER BAR
      doc.rect(40, 40, 515, 60).fill(RED_PRIMARY);

      // Header Text: "redBus" Brand
      doc
        .font("Helvetica-Bold")
        .fontSize(24)
        .fillColor("#FFFFFF")
        .text("redBus", 55, 52);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#FEE2E2")
        .text("Official Bus Travel E-Ticket", 55, 78);

      // Status Pill on top right of header
      const isConfirmed = booking.status === "CONFIRMED";
      const isCancelled = booking.status === "CANCELLED";

      const statusText = isCancelled
        ? "CANCELLED"
        : isConfirmed
        ? "CONFIRMED"
        : String(booking.status || "PENDING").toUpperCase();

      const statusBg = isCancelled ? "#991B1B" : "#15803D";

      doc.roundedRect(430, 52, 110, 24, 6).fill(statusBg);
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#FFFFFF")
        .text(statusText, 430, 59, { width: 110, align: "center" });

      let currentY = 115;
      const travelDate = booking.tripId?.travelDate || booking.tripId?.journeyDate || booking.date || "Travel Date";

      // Watermark if Cancelled
      if (isCancelled) {
        doc.save();
        doc.rotate(-30, { origin: [297, 420] });
        doc
          .font("Helvetica-Bold")
          .fontSize(64)
          .fillColor("#EF4444", 0.15)
          .text("CANCELLED / REFUNDED", 40, 400, { align: "center", width: 515 });
        doc.restore();
      }

      // 2. PNR & BOOKING SUMMARY BOX
      doc.rect(40, currentY, 515, 65).fillAndStroke(BG_LIGHT, BORDER_COLOR);

      // PNR
      doc.font("Helvetica-Bold").fontSize(9).fillColor(TEXT_MUTED).text("TICKET PNR / BOOKING ID", 55, currentY + 12);
      doc.font("Helvetica-Bold").fontSize(14).fillColor(RED_PRIMARY).text(booking.bookingId || "—", 55, currentY + 26);

      // Booking Date
      const bookedOnDate = booking.createdAt
        ? new Date(booking.createdAt).toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—";
      doc.font("Helvetica-Bold").fontSize(9).fillColor(TEXT_MUTED).text("BOOKED ON", 240, currentY + 12);
      doc.font("Helvetica").fontSize(11).fillColor(TEXT_MAIN).text(bookedOnDate, 240, currentY + 28);

      // Total Seats
      const seatCount = booking.seatNumbers?.length || (booking.seats ? booking.seats.split(",").length : 1);
      doc.font("Helvetica-Bold").fontSize(9).fillColor(TEXT_MUTED).text("SEATS BOOKED", 400, currentY + 12);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(TEXT_MAIN).text(`${seatCount} Seat(s) (${booking.seats})`, 400, currentY + 28);

      currentY += 80;

      // 3. JOURNEY DETAILS CARD
      doc.rect(40, currentY, 515, 120).stroke(BORDER_COLOR);

      // Operator & Bus Info Header
      doc.rect(40, currentY, 515, 28).fill("#F1F5F9");
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(TEXT_MAIN)
        .text(booking.operator || "Intercity Express", 55, currentY + 8);

      const busTypeAndNum = [booking.busType || "Air Conditioned", booking.busNumber]
        .filter(Boolean)
        .join(" • ");
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(TEXT_MUTED)
        .text(busTypeAndNum, 320, currentY + 9, { width: 220, align: "right" });

      currentY += 38;

      // Origin / Departure
      doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_MUTED).text("BOARDING POINT", 55, currentY);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(TEXT_MAIN).text(booking.fromCity || "Departure Point", 55, currentY + 14);
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text(booking.boardingPoint || "Main City Bus Station", 55, currentY + 30, { width: 170 });
      doc.font("Helvetica-Bold").fontSize(10).fillColor(RED_PRIMARY).text(`Dep: ${booking.time || "21:00"}`, 55, currentY + 54);

      // Arrow in middle
      doc.font("Helvetica-Bold").fontSize(14).fillColor(TEXT_MUTED).text("➔", 270, currentY + 18, { align: "center", width: 30 });
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text(travelDate, 230, currentY + 40, { align: "center", width: 110 });

      // Destination / Arrival
      doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_MUTED).text("DROPPING POINT", 370, currentY);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(TEXT_MAIN).text(booking.toCity || "Destination Point", 370, currentY + 14);
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text(booking.droppingPoint || "Central Bus Junction", 370, currentY + 30, { width: 170 });

      currentY += 85;

      // 4. PASSENGERS TABLE
      doc.rect(40, currentY, 515, 22).fill("#F1F5F9");
      doc.font("Helvetica-Bold").fontSize(9).fillColor(TEXT_MAIN);
      doc.text("SEAT", 55, currentY + 6);
      doc.text("PASSENGER NAME", 120, currentY + 6);
      doc.text("AGE", 340, currentY + 6);
      doc.text("GENDER", 400, currentY + 6);
      doc.text("STATUS", 480, currentY + 6);

      currentY += 22;

      const passengers =
        Array.isArray(booking.passengers) && booking.passengers.length > 0
          ? booking.passengers
          : (booking.seatNumbers || []).map((sNum) => ({
              seatNumber: sNum,
              name: booking.userName || "Passenger",
              age: "—",
              gender: "—",
            }));

      passengers.forEach((p, idx) => {
        const rowBg = idx % 2 === 0 ? "#FFFFFF" : BG_LIGHT;
        doc.rect(40, currentY, 515, 22).fillAndStroke(rowBg, BORDER_COLOR);

        doc.font("Helvetica-Bold").fontSize(9).fillColor(RED_PRIMARY).text(String(p.seatNumber || "—"), 55, currentY + 6);
        doc.font("Helvetica").fontSize(9).fillColor(TEXT_MAIN).text(String(p.name || "Passenger"), 120, currentY + 6);
        doc.font("Helvetica").fontSize(9).fillColor(TEXT_MAIN).text(String(p.age || "—"), 340, currentY + 6);
        doc.font("Helvetica").fontSize(9).fillColor(TEXT_MAIN).text(String(p.gender || "—"), 400, currentY + 6);
        doc.font("Helvetica-Bold").fontSize(8).fillColor(SUCCESS_GREEN).text("Confirmed", 480, currentY + 6);

        currentY += 22;
      });

      currentY += 15;

      // 5. FARE BREAKDOWN & QR CODE CARD
      const cardHeight = 110;
      doc.rect(40, currentY, 515, cardHeight).stroke(BORDER_COLOR);

      // Fare Breakdown Column (Left)
      doc.font("Helvetica-Bold").fontSize(10).fillColor(TEXT_MAIN).text("FARE BREAKDOWN", 55, currentY + 12);

      const baseFare = Number(booking.baseFare || Math.round((booking.amount || 0) / 1.05));
      const tax = Number(booking.tax || (booking.amount || 0) - baseFare);
      const totalAmount = Number(booking.totalAmount || booking.amount || 0);

      doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text("Base Fare:", 55, currentY + 32);
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_MAIN).text(`₹${baseFare.toLocaleString("en-IN")}`, 180, currentY + 32, { align: "right", width: 80 });

      doc.font("Helvetica").fontSize(9).fillColor(TEXT_MUTED).text("GST & Operator Levies (5%):", 55, currentY + 48);
      doc.font("Helvetica").fontSize(9).fillColor(TEXT_MAIN).text(`₹${tax.toLocaleString("en-IN")}`, 180, currentY + 48, { align: "right", width: 80 });

      doc.rect(55, currentY + 64, 205, 1).fill("#CBD5E1");

      doc.font("Helvetica-Bold").fontSize(11).fillColor(TEXT_MAIN).text("Total Paid Amount:", 55, currentY + 72);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(RED_PRIMARY).text(`₹${totalAmount.toLocaleString("en-IN")}`, 180, currentY + 71, { align: "right", width: 80 });

      doc.font("Helvetica").fontSize(8).fillColor(TEXT_MUTED).text(`Payment Status: ${booking.paymentStatus || "PAID"}`, 55, currentY + 92);

      // QR Code Column (Right)
      try {
        const qrContent = JSON.stringify({
          pnr: booking.bookingId,
          operator: booking.operator,
          from: booking.fromCity,
          to: booking.toCity,
          date: travelDate,
          seats: booking.seatNumbers || [booking.seats],
          amount: totalAmount,
          verified: true,
        });

        const qrBuffer = await QRCode.toBuffer(qrContent, {
          width: 90,
          margin: 1,
          color: {
            dark: "#1E293B",
            light: "#FFFFFF",
          },
        });

        doc.image(qrBuffer, 445, currentY + 10, { width: 90 });
        doc.font("Helvetica").fontSize(7).fillColor(TEXT_MUTED).text("Scan to Verify Ticket", 440, currentY + 98, { width: 100, align: "center" });
      } catch (qrErr) {
        console.warn("Failed to generate QR Code in PDF:", qrErr.message);
      }

      currentY += cardHeight + 20;

      // 6. TERMS & SUPPORT FOOTER
      doc.rect(40, currentY, 515, 65).fill(BG_LIGHT);

      doc.font("Helvetica-Bold").fontSize(8).fillColor(TEXT_MAIN).text("IMPORTANT TRAVEL INFORMATION", 50, currentY + 10);
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(TEXT_MUTED)
        .text(
          "• Please present this e-ticket along with a valid government photo ID at the time of boarding.\n" +
          "• Please report at the boarding terminal at least 15 minutes before the scheduled departure time.\n" +
          "• For cancellations, refunds, or 24/7 customer assistance, visit redbus.in/help or call 1800-419-4287.",
          50,
          currentY + 24,
          { width: 495, lineGap: 3 }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
