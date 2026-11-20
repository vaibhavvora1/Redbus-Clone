import { Link } from "react-router-dom";
import { ArrowUpRight, BusFront, Hotel, Landmark, TrainFront } from "lucide-react";

const services = [
  { title: "Bus tickets", description: "Search intercity bus routes", path: "/", icon: BusFront, tone: "bus" },
  { title: "Government buses", description: "Browse state transport services", path: "/government-buses", icon: Landmark, tone: "government" },
  { title: "Train tickets", description: "Find trains and available classes", path: "/trains", icon: TrainFront, tone: "train" },
  { title: "Hotels", description: "Explore stays at your destination", path: "/hotels", icon: Hotel, tone: "hotel" },
];

export default function TravelServiceCards() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-5">
        <p className="text-sm font-bold uppercase tracking-wider text-red-600">Travel your way</p>
        <h2 className="mt-1 text-2xl font-extrabold text-gray-900">Explore our services</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {services.map(({ title, description, path, icon: Icon, tone }) => (
          <Link
            key={tone}
            to={path}
            className={`service-card service-card-${tone} motion-lift rounded-2xl border p-5`}
          >
            <div className="flex items-start justify-between">
              <span className="service-icon"><Icon size={22} /></span>
              <ArrowUpRight size={17} className="service-arrow" aria-hidden="true" />
            </div>
            <h3 className="mt-6 font-bold">{title}</h3>
            <p className="mt-1 text-sm opacity-75">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
