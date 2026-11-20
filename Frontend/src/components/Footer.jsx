import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Bus } from "lucide-react";
import { FaFacebookF, FaLinkedinIn, FaXTwitter, FaInstagram } from "react-icons/fa6";
import api from "../services/api";

const linkColumns = [
  {
    heading: "About redBus",
    links: [
      { label: "Contact us", path: "/help" },
      { label: "Sitemap", path: "/busListing" },
      { label: "Offers & Promotions", path: "/free-cancellation" },
      { label: "Government Buses", path: "/government-buses" },
      { label: "Vote Favourite Operator", path: "/vote-operator" },
    ],
  },
  {
    heading: "Info & Services",
    links: [
      { label: "Bus Timetable", path: "/bus-timetable" },
      { label: "Free Cancellation", path: "/free-cancellation" },
      { label: "Flexi Ticket", path: "/flexi-ticket" },
      { label: "Help & Customer Care", path: "/help" },
      { label: "My Bookings", path: "/mybookings" },
    ],
  },
  {
    heading: "Global Sites",
    links: [
      { label: "India", path: "/" },
      { label: "Singapore", path: "/help" },
      { label: "Malaysia", path: "/help" },
      { label: "Indonesia", path: "/help" },
      { label: "Peru", path: "/help" },
    ],
  },
  {
    heading: "Travel Products",
    links: [
      { label: "Bus Tickets", path: "/" },
      { label: "Train Tickets", path: "/trains" },
      { label: "Hotel Stays", path: "/hotels" },
      { label: "Operator Portal", path: "/government-buses" },
    ],
  },
];

const accordionSections = [
  { title: "Available Bus Routes", type: "routes" },
  { title: "Available Cities", type: "cities" },
  { title: "Bus Operators", type: "operators" },
];

function FooterLink({ to, children }) {
  return (
    <Link
      to={to || "/"}
      className="text-sm text-[#3d3d99] underline decoration-[#3d3d99]/40 underline-offset-2 hover:text-[#ff5a5f] hover:decoration-[#ff5a5f]/40 transition-colors duration-200"
    >
      {children}
    </Link>
  );
}

function SocialIcon({ icon, href }) {
  return (
    <a
      href={href || "https://redbus.in"}
      target="_blank"
      rel="noopener noreferrer"
      className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-700 hover:text-red-600 hover:border-red-500 transition-colors duration-200"
    >
      {icon}
    </a>
  );
}

function RoutesGrid({ routes, isLoading, loadError }) {
  if (isLoading || loadError || routes.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {isLoading ? "Loading routes..." : loadError || "No routes available."}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
      {routes.map((r) => (
        <li key={`${r.from}-${r.to}`}>
          <FooterLink to={`/busListing?from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}`}>
            {r.from} to {r.to}
          </FooterLink>
        </li>
      ))}
    </ul>
  );
}

function CitiesGrid({ cities, isLoading, loadError }) {
  if (isLoading || loadError || cities.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {isLoading ? "Loading cities..." : loadError || "No cities available."}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
      {cities.map((city) => (
        <li key={city}>
          <FooterLink to={`/busListing?from=${encodeURIComponent(city)}`}>
            {city} Buses
          </FooterLink>
        </li>
      ))}
    </ul>
  );
}

function OperatorsGrid({ operators, isLoading, loadError }) {
  if (isLoading || loadError || operators.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {isLoading ? "Loading operators..." : loadError || "No operators available."}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
      {operators.map((op) => (
        <li key={op}>
          <FooterLink to="/government-buses">
            {op}
          </FooterLink>
        </li>
      ))}
    </ul>
  );
}

export default function Footer() {
  const [openIndex, setOpenIndex] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [cities, setCities] = useState([]);
  const [operators, setOperators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const toggle = (i) => setOpenIndex(openIndex === i ? null : i);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.buses.getAll(),
      api.locations.getCities({ limit: 20 }),
      api.operators.getAll(),
    ])
      .then(([busRes, cityRes, operatorRes]) => {
        if (!isMounted) return;
        const busRecords = busRes.data || [];
        const routeKeys = new Set();
        const busRoutes = busRecords
          .filter((bus) => bus.from && bus.to)
          .filter((bus) => {
            const key = `${bus.from}-${bus.to}`;
            if (routeKeys.has(key)) return false;
            routeKeys.add(key);
            return true;
          });
        setRoutes(busRoutes);
        setCities([
          ...new Set([
            ...busRecords.flatMap((bus) => [bus.from, bus.to]),
            ...(cityRes.data || []).map((city) => city.name),
          ].filter(Boolean)),
        ]);
        setOperators(
          (operatorRes.data || []).map((operator) => operator.name).filter(Boolean)
        );
      })
      .catch((err) => {
        if (isMounted) setLoadError(err.message || "Could not load footer data.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <footer className="bg-[#f4f4f8]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Accordion */}
        <div className="divide-y divide-gray-300 border-b border-gray-300">
          {accordionSections.map((section, i) => (
            <div key={section.title}>
              <button
                onClick={() => toggle(i)}
                className="w-full flex items-center justify-between py-5 text-left cursor-pointer"
              >
                <span className="text-base text-gray-900 font-semibold">{section.title}</span>
                <ChevronDown
                  size={18}
                  className={`text-gray-500 transition-transform duration-200 shrink-0 ${
                    openIndex === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openIndex === i && (
                <div className="pb-6">
                  {section.type === "routes" && (
                    <RoutesGrid routes={routes} isLoading={isLoading} loadError={loadError} />
                  )}
                  {section.type === "cities" && (
                    <CitiesGrid cities={cities} isLoading={isLoading} loadError={loadError} />
                  )}
                  {section.type === "operators" && (
                    <OperatorsGrid
                      operators={operators}
                      isLoading={isLoading}
                      loadError={loadError}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 py-10">
          {linkColumns.map((col) => (
            <div key={col.heading}>
              <h4 className="text-sm font-bold text-gray-900 mb-4">{col.heading}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink to={link.path}>{link.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Brand row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-t border-gray-300 pt-6">
          <Link to="/" className="flex items-center gap-2 shrink-0 border border-[#ff5a5f] rounded px-2.5 py-1 hover:bg-red-50 transition">
            <Bus size={16} className="text-[#ff5a5f]" />
            <span className="font-bold text-[#ff5a5f] text-base leading-none">redBus</span>
          </Link>
          <p className="text-sm text-gray-600 leading-relaxed flex-1">
            Book bus tickets, trains, and verified hotel stays with instant confirmation, live tracking, and easy refunds on redBus.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6">
          <p className="text-xs text-gray-500 text-center sm:text-left">
            © 2026 redBus clone. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <SocialIcon icon={<FaFacebookF size={14} />} href="https://facebook.com/redbus.in" />
            <SocialIcon icon={<FaLinkedinIn size={14} />} href="https://linkedin.com/company/redbus_in" />
            <SocialIcon icon={<FaXTwitter size={14} />} href="https://twitter.com/redbus_in" />
            <SocialIcon icon={<FaInstagram size={14} />} href="https://instagram.com/redbusindia" />
          </div>
        </div>
      </div>
    </footer>
  );
}
