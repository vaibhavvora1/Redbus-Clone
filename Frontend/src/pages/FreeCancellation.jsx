// src/pages/FreeCancellation.jsx
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, IndianRupee, Clock, Ban } from "lucide-react";

const points = [
  { icon: IndianRupee, title: "100% refund", desc: "Cancel up to 6 hours before departure and get your full fare back." },
  { icon: Clock, title: "Instant processing", desc: "Refunds are initiated the moment you cancel — no manual approval wait." },
  { icon: Ban, title: "No hidden fees", desc: "No cancellation charges, no convenience fee deductions." },
];

export default function FreeCancellation() {
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
        <ShieldCheck className="text-red-700" size={26} />
        <h1 className="text-2xl font-bold text-gray-900">Free Cancellation</h1>
      </div>
      <p className="text-sm text-gray-500 mb-8">
        Plans change. Get a 100% refund when you cancel within our policy window.
      </p>

      <div className="space-y-4">
        {points.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex gap-4 border border-gray-200 rounded-2xl p-5 bg-white">
            <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <Icon size={20} className="text-red-700" />
            </div>
            <div>
              <p className="font-bold text-gray-900 mb-1">{title}</p>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/mybookings")}
        className="mt-8 w-full sm:w-auto bg-red-700 hover:bg-red-800 text-white text-sm font-semibold rounded-xl px-6 py-3 transition-colors"
      >
        View my bookings
      </button>
    </section>
  );
}