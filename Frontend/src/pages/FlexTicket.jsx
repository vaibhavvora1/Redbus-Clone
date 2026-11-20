// src/pages/FlexiTicket.jsx
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Repeat, CalendarCheck, Ban } from "lucide-react";

const benefits = [
  { icon: CalendarCheck, title: "Free date change", desc: "Change your travel date up to 2 hours before departure, at no extra cost." },
  { icon: Repeat, title: "Unlimited reschedules", desc: "Reschedule as many times as you need within the ticket validity." },
  { icon: Ban, title: "Zero cancellation charges", desc: "Cancel FlexiTicket bookings without paying any cancellation fee." },
];

export default function FlexiTicket() {
  const navigate = useNavigate();

  return (
    <section className="max-w-3xl mx-auto px-4 py-10">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div className="flex items-center gap-2 mb-2">
        <Repeat className="text-indigo-700" size={26} />
        <h1 className="text-2xl font-bold text-gray-900">FlexiTicket</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Amazing benefits on date change & cancellation — travel with total flexibility.
      </p>

      <div className="space-y-4">
        {benefits.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex gap-4 border border-gray-200 rounded-2xl p-5 bg-white">
            <div className="w-11 h-11 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
              <Icon size={20} className="text-indigo-700" />
            </div>
            <div>
              <p className="font-bold text-gray-900 mb-1">{title}</p>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/")}
        className="mt-8 w-full sm:w-auto bg-indigo-950 hover:bg-indigo-900 text-white text-sm font-semibold rounded-xl px-6 py-3 transition-colors"
      >
        Book with FlexiTicket
      </button>
    </section>
  );
}