import { Link } from "react-router-dom";

export default function InfoSection() {
  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-lg font-bold text-gray-800 mb-4">
        redBus: India's Leading Online Bus Booking and Train Ticket Booking Platform
      </h1>

      <div className="text-sm text-gray-500 space-y-3 mb-6">
        <p>
          Search bus and train options and review the schedules currently available through the platform.
        </p>
        <p>
          Available routes, operators, prices, and promotions are shown from the current listings.
        </p>
      </div>

      <h2 className="text-base font-bold text-orange-700 mb-2">
        Why Choose redBus for Bus Booking?
      </h2>
      <p className="text-sm text-gray-500 mb-3">
        Below are some reasons to choose redBus for booking bus tickets.
      </p>
      <ul className="list-disc list-outside pl-5 text-sm text-gray-500 space-y-2 mb-8">
        <li>
          <strong className="text-gray-700">Free Cancellation</strong> - Cancel bus
          tickets without paying cancellation charges.
        </li>
        <li>
          <strong className="text-gray-700">Flexi Ticket</strong> - Select a Flexi
          ticket to modify your travel date at least 8 hours before departure.
        </li>
        <li>
          <strong className="text-gray-700">Earn Rewards</strong> - Refer your friend
          and get INR 100 in your redBus wallet after they complete their first trip.
        </li>
        <li>
          <strong className="text-gray-700">Booking for Women</strong> - Access
          exclusive deals for women travellers, view the number of women on your bus,
          enjoy priority helplines, and find buses preferred by women.
        </li>
        <li>
          <strong className="text-gray-700">Primo Services</strong> - Select top-rated
          bus operators that offer timely and customer-friendly Primo services.
        </li>
        <li>
          <strong className="text-gray-700">24/7 Customer Support</strong> - Receive
          24/7 customer service for any assistance related to bookings.
        </li>
        <li>
          <strong className="text-gray-700">Instant Refund</strong> - Get an instant
          refund for cancellation or booking-related issues.
        </li>
        <li>
          <strong className="text-gray-700">Live Bus Tracking</strong> - Track your bus
          in real-time and plan your journey more efficiently.
        </li>
      </ul>

      <h2 className="text-base font-bold text-orange-700 mb-2">
        Why Choose redRail for Train Ticket Booking?
      </h2>
      <p className="text-sm text-gray-500 mb-3">
        Below are some of the reasons for{" "}
        <Link to="/trains" className="underline text-red-600 font-semibold">
          train ticket booking
        </Link>{" "}
        on redRail.
      </p>
      <ul className="list-disc list-outside pl-5 text-sm text-gray-500 space-y-2 mb-8">
        <li>
          <strong className="text-gray-700">An authorised partner of IRCTC</strong> -
          redRail is an authorised IRCTC partner, providing authentic information.
        </li>
        <li>
          <strong className="text-gray-700">Free cancellation</strong> - Get the
          freedom to cancel train tickets without paying cancellation charges.
        </li>
        <li>
          <strong className="text-gray-700">Alternate Trip</strong> - Waitlist train
          ticket will get confirmed, or you will get a 3X refund to book an alternate
          train or bus.
        </li>
        <li>
          <strong className="text-gray-700">24/7 customer support</strong> - Customer
          support for redRail is available 24/7 to help you with train bookings.
        </li>
      </ul>

    
      <h2 className="text-base font-bold text-orange-700 mb-2">
        How to Book Bus Tickets and Train Tickets Online on redBus?
      </h2>
      <p className="text-sm text-gray-500 mb-3">
        Below are some simple steps that you can follow when booking train or bus
        tickets online on redBus.
      </p>
      <ul className="list-disc list-outside pl-5 text-sm text-gray-500 space-y-2 mb-8">
        <li>
          <strong className="text-gray-700">Step 1:</strong> Visit the redBus website
          or app.
        </li>
        <li>
          <strong className="text-gray-700">Step 2:</strong> Select your preferred mode
          of transport, either bus or train.
        </li>
        <li>
          <strong className="text-gray-700">Step 3:</strong> Select your travel date
          and journey details.
        </li>
        <li>
          <strong className="text-gray-700">Step 4:</strong> Search for your preferred
          bus or train available on your chosen travel date and route.
        </li>
        <li>
          <strong className="text-gray-700">Step 5:</strong> Select your preferred
          boarding or dropping points and enter your contact details.
        </li>
        <li>
          <strong className="text-gray-700">Step 7:</strong> Choose from multiple
          payment options to proceed with the payment process.
        </li>
        <li>
          <strong className="text-gray-700">Step 8:</strong> After the successful
          payment, you will receive a confirmation of your train or bus bookings on
          your registered email ID or mobile number.
        </li>
      </ul>

      <h2 className="text-base font-bold text-gray-800 mb-2">
        Exclusive Offers on redBus
      </h2>
      <p className="text-sm text-gray-500 mb-8">
        redBus provides exclusive offers and deals on bus and train ticket booking for
        travellers. Additionally, you can also get festive offers on apps or specific
        to bus operators. All you need to do is check train and bus bookings offers on
        redBus and apply the coupon code mentioned on the website or app to avail the
        discount. redBus keeps adding new discounts and offers depending on the
        seasonality, festivals, and other events.
      </p>

      <h2 className="text-base font-bold text-gray-800 mb-2">
        Bus Booking redDeals on redBus
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Don't miss out on these incredible offers, book your bus tickets now and travel
        with convenience and affordability. Hurry, grab the best bus booking deals
        before they're gone!
      </p>

    </section>
  );
}