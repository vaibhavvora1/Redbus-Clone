import { Star } from "lucide-react";
import AnimatedCounter from "./AnimatedCounter";

export default function AppDownloadBanner() {
  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      <div
        className="relative rounded-2xl overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: "url('/appbanner.webp')" }}
      >
        {/* Dark overlay so text stays readable regardless of the photo underneath */}
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative flex flex-col md:flex-row items-center justify-between px-8 md:px-12 py-10 gap-8">
          {/* Left: offer text */}
          <div>
            <div className="text-2xl mb-2">🎁💸</div>
            <h2 className="text-white text-2xl md:text-3xl font-bold">
              Grab 10% off now
            </h2>
            <p className="text-white/90 font-semibold mt-1">
              Download App to unlock offer!
            </p>
          </div>

          {/* Right: store badges + ratings + QR */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-3">
              <StoreBadge
                platform="google"
                rating={<AnimatedCounter value={4.6} decimals={1} />}
                downloads={<><AnimatedCounter value={10} /> crore+ Downloads</>}
              />
              <StoreBadge
                platform="apple"
                rating={<AnimatedCounter value={4.7} decimals={1} />}
                downloads={<><AnimatedCounter value={1.5} decimals={1} /> crore+ Downloads</>}
              />
            </div>

            <div className="hidden sm:block bg-white p-2 rounded-lg">
              <QRPlaceholder />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StoreBadge({ platform, rating, downloads }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-black text-white rounded-lg px-4 py-2 flex items-center gap-2 min-w-[160px]">
        <span className="text-xl">{platform === "google" ? "▶" : "🍎"}</span>
        <div className="leading-tight">
          <div className="text-[10px] text-gray-300">
            {platform === "google" ? "GET IT ON" : "Download on the"}
          </div>
          <div className="text-sm font-bold -mt-0.5">
            {platform === "google" ? "Google Play" : "App Store"}
          </div>
        </div>
      </div>
      <div className="text-white">
        <div className="flex items-center gap-1 font-bold text-sm">
          <Star size={14} fill="white" /> {rating}
        </div>
        <div className="text-xs text-white/80">{downloads}</div>
      </div>
    </div>
  );
}

// Simple placeholder QR pattern - swap with a real generated QR code image later
function QRPlaceholder() {
  return (
    <svg width="90" height="90" viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">
      <rect width="90" height="90" fill="white" />

      <rect x="4" y="4" width="20" height="20" fill="black" />
      <rect x="9" y="9" width="10" height="10" fill="white" />
      <rect x="66" y="4" width="20" height="20" fill="black" />
      <rect x="71" y="9" width="10" height="10" fill="white" />
      <rect x="4" y="66" width="20" height="20" fill="black" />
      <rect x="9" y="71" width="10" height="10" fill="white" />

      {[...Array(60)].map((_, i) => {
        const x = 30 + (i % 8) * 6;
        const y = 12 + Math.floor(i / 8) * 6;
        return (i * 7) % 3 === 0 ? (
          <rect key={i} x={x} y={y} width="5" height="5" fill="black" />
        ) : null;
      })}
    </svg>
  );
}