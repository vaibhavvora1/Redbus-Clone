import { MessageSquareQuote } from "lucide-react";

export default function Testimonials() {
  return (
    <section className="max-w-6xl mx-auto px-4 py-10 pb-16">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-red-600 text-sm font-semibold mb-1">
            <MessageSquareQuote size={18} />
            <span>REAL REVIEWS</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Testimonials</h2>
          <p className="text-gray-500 text-sm mt-1">
            Hear from our satisfied customers in their own words
          </p>
        </div>
      </div>

      <div className="py-10 text-center text-sm text-gray-500">No testimonials available.</div>
    </section>
  );
}