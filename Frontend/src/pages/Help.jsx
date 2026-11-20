import { useState } from "react";
import {
  Search,
  Phone,
  Mail,
  MessageCircle,
  ChevronDown,
  Ticket,
  RefreshCcw,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import Footer from "../components/Footer";

const categories = [
  { id: "booking", label: "Bookings", icon: Ticket },
  { id: "cancellation", label: "Cancellation & Refund", icon: RefreshCcw },
  { id: "payment", label: "Payments", icon: CreditCard },
  { id: "account", label: "Account & Safety", icon: ShieldCheck },
];

const faqs = [
  {
    id: 1,
    category: "booking",
    question: "How do I book a ticket?",
    answer:
      "Search for your source and destination, pick a date, choose from the available options, select your seats, and complete the payment. Your ticket will be sent to your email and shown under My Bookings.",
  },
  {
    id: 2,
    category: "booking",
    question: "Can I modify my booking after payment?",
    answer:
      "Once a booking is confirmed, travel date and seat changes are not supported directly. You can cancel the current booking and create a new one, subject to the cancellation policy of that booking.",
  },
  {
    id: 3,
    category: "cancellation",
    question: "How do I cancel my ticket?",
    answer:
      "Go to My Bookings, select the ticket you want to cancel, and click Cancel Ticket. Refund amount depends on how close to the departure time you cancel.",
  },
  {
    id: 4,
    category: "cancellation",
    question: "When will I get my refund?",
    answer:
      "Refunds are usually processed within 5 to 7 business days and credited back to your original payment method.",
  },
  {
    id: 5,
    category: "payment",
    question: "What payment methods are supported?",
    answer:
      "We support UPI, debit and credit cards, net banking, and select wallets. All payments are processed through a secure, encrypted gateway.",
  },
  {
    id: 6,
    category: "payment",
    question: "My payment failed but money was deducted. What now?",
    answer:
      "If a payment fails after deduction, the amount is automatically refunded within 5 to 7 business days. If it isn't, please reach out to our support team with your transaction ID.",
  },
  {
    id: 7,
    category: "account",
    question: "Is my personal information safe?",
    answer:
      "Yes. All personal and payment data is encrypted and we never share your information with third parties without consent.",
  },
  {
    id: 8,
    category: "account",
    question: "How do I update my phone number or email?",
    answer:
      "Go to your Profile settings, tap on Edit, update your details, and verify the new phone number or email via the OTP sent to you.",
  },
];

const supportOptions = [
  {
    id: "call",
    icon: Phone,
    title: "Call us",
    desc: "Talk to our support team",
    action: "+91 1800 123 4567",
  },
  {
    id: "email",
    icon: Mail,
    title: "Email us",
    desc: "We usually reply within 24 hours",
    action: "support@redbusclone.com",
  },
  {
    id: "chat",
    icon: MessageCircle,
    title: "Live chat",
    desc: "Chat with us, available 9 AM to 9 PM",
    action: "Start chat",
  },
];

export default function Help() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("booking");
  const [openFaq, setOpenFaq] = useState(null);

  const filteredFaqs = faqs.filter((faq) => {
    const matchesCategory = faq.category === activeCategory;
    const matchesSearch =
      search.trim() === "" ||
      faq.question.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleFaq = (id) => {
    setOpenFaq(openFaq === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-linear-to-r from-red-600 to-red-500 py-14">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            Help & Support
          </h1>
          <p className="text-red-100 mt-2 text-sm">
            Find answers to common questions or reach out to our team
          </p>

          <div className="mt-6 bg-white rounded-xl shadow-lg flex items-center gap-3 px-4 py-3 max-w-xl mx-auto">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for a topic or question"
              className="w-full outline-none text-sm text-gray-800"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
          <div className="space-y-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setOpenFaq(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition ${
                    active
                      ? "bg-red-50 text-red-600 border border-red-200"
                      : "text-gray-600 hover:bg-gray-100 border border-transparent"
                  }`}
                >
                  <Icon size={18} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div>
            <div className="bg-white rounded-2xl shadow p-5">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                {categories.find((c) => c.id === activeCategory)?.label}
              </h2>

              {filteredFaqs.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No questions match your search in this category.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredFaqs.map((faq) => (
                    <div key={faq.id} className="py-3">
                      <button
                        onClick={() => toggleFaq(faq.id)}
                        className="w-full flex items-center justify-between text-left"
                      >
                        <span className="text-sm font-medium text-gray-800">
                          {faq.question}
                        </span>
                        <ChevronDown
                          size={18}
                          className={`text-gray-400 shrink-0 ml-3 transition-transform ${
                            openFaq === faq.id ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {openFaq === faq.id && (
                        <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                          {faq.answer}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Still need help?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {supportOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <div
                      key={option.id}
                      className="bg-white rounded-xl shadow p-4 flex flex-col items-start"
                    >
                      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center mb-3">
                        <Icon size={18} className="text-red-600" />
                      </div>
                      <h3 className="text-sm font-semibold text-gray-800">
                        {option.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {option.desc}
                      </p>
                      <span className="text-xs font-medium text-red-600 mt-3">
                        {option.action}
                      </span>
                    </div>
                  );
                })}
               
              </div>
            </div>
          </div>
        </div>
      </div>
       <Footer/>
    </div>
  );
}