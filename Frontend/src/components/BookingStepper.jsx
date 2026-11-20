import { Check } from "lucide-react";
import { Link } from "react-router-dom";

const steps = [
  { step: 1, label: "Search Results", path: "/busListing" },
  { step: 2, label: "Select Seats", path: "/seats" },
  { step: 3, label: "Passenger Details", path: "/passenger-details" },
  { step: 4, label: "Payment", path: "/payment" },
  { step: 5, label: "Confirmation", path: null },
];

export default function BookingStepper({ currentStep = 2 }) {
  return (
    <div className="bg-white border-b border-gray-200 py-4 px-4 sm:px-6 shadow-xs sticky top-20 z-40">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {steps.map((item, index) => {
          const isCompleted = item.step < currentStep;
          const isCurrent = item.step === currentStep;

          return (
            <div key={item.step} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isCompleted
                      ? "bg-emerald-600 text-white shadow-xs"
                      : isCurrent
                      ? "bg-red-600 text-white ring-4 ring-red-100 shadow-xs"
                      : "bg-gray-100 text-gray-400 border border-gray-200"
                  }`}
                >
                  {isCompleted ? <Check size={16} strokeWidth={3} /> : item.step}
                </div>
                <span
                  className={`hidden sm:inline text-xs font-semibold ${
                    isCurrent
                      ? "text-red-600"
                      : isCompleted
                      ? "text-gray-800"
                      : "text-gray-400"
                  }`}
                >
                  {item.label}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div
                  className={`flex-1 mx-2 sm:mx-4 h-0.5 transition-all ${
                    isCompleted ? "bg-emerald-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

