// src/components/WhatsNew.jsx
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

const featureLinks = [
  {
    title: "VOTE",
    subtitle: "For your favourite BUS OPERATOR",
    cta: "Know more",
    bg: "bg-gradient-to-br from-gray-900 to-gray-800 text-yellow-400",
    path: "/vote-operator",
  },
  {
    title: "Free Cancellation",
    subtitle: "Get 100% refund on cancellation",
    cta: "Know more",
    bg: "bg-gradient-to-br from-red-800 to-rose-900 text-white",
    path: "/free-cancellation",
  },
  {
    title: "Bus Timetable",
    subtitle: "Get local bus timings between cities in your state",
    cta: "Explore",
    bg: "bg-gradient-to-br from-red-50 to-orange-50 text-gray-900",
    path: "/bus-timetable",
  },
  {
    title: "FlexiTicket",
    subtitle: "Get amazing benefits on Date Change & Cancellation",
    cta: "Know More",
    bg: "bg-gradient-to-br from-blue-900 to-indigo-950 text-white",
    path: "/flexi-ticket",
  },
];

export default function WhatsNew() {
  const navigate = useNavigate();

  return (
    <section className="max-w-6xl mx-auto px-4 py-6 pb-16">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="text-red-600" size={24} />
        <h2 className="text-2xl font-bold text-gray-900">What's new</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {featureLinks.map((item) => (
          <div
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`${item.bg} rounded-2xl p-6 h-48 flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all relative overflow-hidden group`}
          >
            <div>
              <h3 className="font-extrabold text-lg mb-1 leading-snug">{item.title}</h3>
              <p className="text-xs opacity-90 leading-relaxed font-medium">{item.subtitle}</p>
            </div>
            {item.cta && (
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                {item.cta} <ArrowRight size={14} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}