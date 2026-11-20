// src/components/Navbar.jsx
import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  X,
  LogIn,
  LogOut,
  CreditCard,
  ChevronRight,
  ChevronDown,
  UserCheck,
  Sparkles,
  UserPlus,
  LayoutDashboard,
} from "lucide-react";
import { leftnavLinks, rightnavLinks } from "../data/navLinks";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    setSidebarOpen(false);
    navigate("/");
  };

  const handleGoogleSignIn = () => {
    setSidebarOpen(false);
    navigate("/login");
  };

  return (
    <>
      <nav className="flex items-center justify-between h-20 px-6 sm:px-12 lg:px-28 xl:px-40 bg-white w-full shadow-md sticky top-0 z-50">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center">
            <img
              className="h-10 sm:h-12 w-auto object-contain"
              src="/redbuslogo.png"
              alt="redBus"
            />
          </Link>
        </div>

        {/* Left Navigation Services */}
        <ul className="hidden md:flex gap-8 lg:gap-12 ml-6">
          {leftnavLinks.map(({ label, path, icon }) => (
            <li key={label}>
              <Link
                to={path}
                className="flex flex-col items-center text-gray-800 text-[14px] font-semibold tracking-wide pb-2 border-b-2 border-transparent hover:border-red-500 hover:text-red-600 transition-colors"
              >
                <img
                  src={icon}
                  alt={label}
                  className="h-7 w-12 mt-2 object-contain"
                />
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Right Navigation */}
        <ul className="hidden md:flex gap-6 lg:gap-8 ml-auto items-center">
          {rightnavLinks.map(({ label, path, icon }) => (
            <li key={label}>
              <Link
                to={path}
                className="flex flex-row items-center gap-2 text-gray-800 text-[14px] font-semibold tracking-wide pb-1 border-b-2 border-transparent hover:border-red-500 hover:text-red-600 transition-colors"
              >
                {icon}
                {label}
              </Link>
            </li>
          ))}

          {/* After Login: Profile Icon / Name + Dropdown */}
          {currentUser ? (
            <li className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-sm transition border border-red-200 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="max-w-[120px] truncate font-bold">
                  {currentUser.name ? currentUser.name.split(" ")[0] : "Profile"}
                </span>
                <ChevronDown
                  size={15}
                  className={`transition-transform duration-200 ${
                    dropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Profile Dropdown */}
              {dropdownOpen && (
                <div className="dropdown-enter absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-400 font-semibold">Signed in as</p>
                    <p className="text-sm font-bold text-gray-800 truncate">
                      {currentUser.name || "User"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {currentUser.email}
                    </p>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 transition"
                    >
                      <User size={16} className="text-gray-500" />
                      My Profile
                    </Link>

                    {currentUser?.role === "ADMIN" && (
                      <Link
                        to="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-red-50 hover:text-red-600 transition"
                      >
                        <LayoutDashboard size={16} className="text-gray-500" />
                        Admin Panel
                      </Link>
                    )}

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition text-left cursor-pointer"
                    >
                      <LogOut size={16} className="text-red-500" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </li>
          ) : (
            /* Before Login: Keep existing Login button */
            <li className="flex items-center gap-2">
              <Link
                to="/login"
                className="flex flex-row items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-md shadow-red-200 transition"
              >
                <LogIn size={16} />
                Login / Sign In
              </Link>
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Open Account Menu"
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition"
              >
                <User size={18} />
              </button>
            </li>
          )}
        </ul>

        {/* Mobile View */}
        <div className="flex md:hidden items-center gap-2">
          {currentUser ? (
            <Link
              to="/profile"
              className="flex items-center gap-1.5 bg-red-50 text-red-700 font-bold text-xs px-2.5 py-1.5 rounded-full border border-red-200"
            >
              <span className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px]">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
              </span>
              <span className="max-w-[70px] truncate">
                {currentUser.name ? currentUser.name.split(" ")[0] : "Profile"}
              </span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-xs font-bold bg-red-600 text-white px-3 py-1.5 rounded-lg shadow-sm"
            >
              Login
            </Link>
          )}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            <User size={20} />
          </button>
        </div>
      </nav>

      {/* Account Drawer / Sidebar */}
      {sidebarOpen && (
        <>
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity"
          />
          <div className="dropdown-enter fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white z-50 shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-base font-bold text-gray-900">
                {currentUser ? "My Profile" : "Account"}
              </h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-200/80 flex items-center justify-center text-gray-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile Info Card if logged in */}
            {currentUser && (
              <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 border-b border-red-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                    {currentUser.name
                      ? currentUser.name.charAt(0).toUpperCase()
                      : "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 truncate">
                      {currentUser.name || "RedBus Traveler"}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">
                      {currentUser.email}
                    </p>
                    {currentUser.mobile && (
                      <p className="text-xs text-gray-500">
                        +91 {currentUser.mobile}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-green-700 bg-green-100/80 px-2.5 py-1 rounded-md w-fit">
                  <UserCheck size={13} />
                  Verified Account
                </div>
              </div>
            )}

            {/* Drawer Links */}
            <div className="flex flex-col p-3 gap-1 flex-1 overflow-y-auto">
              {currentUser ? (
                /* Logged in drawer options */
                <>
                  <Link
                    to="/profile"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-red-50 transition text-left group"
                  >
                    <span className="flex items-center gap-3 text-sm font-semibold text-gray-800 group-hover:text-red-600">
                      <User size={18} className="text-red-600" />
                      My Profile
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-red-500"
                    />
                  </Link>

                  <Link
                    to="/payment"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition text-left"
                  >
                    <span className="flex items-center gap-3 text-sm font-semibold text-gray-800">
                      <CreditCard size={18} className="text-gray-600" />
                      Payment Methods
                    </span>
                    <ChevronRight size={16} className="text-gray-300" />
                  </Link>

                  <Link
                    to="/mybookings"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition text-left"
                  >
                    <span className="flex items-center gap-3 text-sm font-semibold text-gray-800">
                      <Sparkles size={18} className="text-gray-600" />
                      My Bookings
                    </span>
                    <ChevronRight size={16} className="text-gray-300" />
                  </Link>

                  <div className="h-px bg-gray-100 my-2" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-red-50 text-red-600 transition text-left font-semibold text-sm cursor-pointer"
                  >
                    <span className="flex items-center gap-3">
                      <LogOut size={18} />
                      Sign Out / Logout
                    </span>
                  </button>
                </>
              ) : (
                /* Logged out drawer options */
                <>
                  <Link
                    to="/login"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-red-50 transition text-left group"
                  >
                    <span className="flex items-center gap-3 text-sm font-semibold text-gray-800 group-hover:text-red-600">
                      <LogIn size={18} className="text-red-600" />
                      Login / Sign In
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-red-500"
                    />
                  </Link>

                  <Link
                    to="/signup"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-red-50 transition text-left group"
                  >
                    <span className="flex items-center gap-3 text-sm font-semibold text-gray-800 group-hover:text-red-600">
                      <UserPlus size={18} className="text-red-600" />
                      Create Account / Sign Up
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-red-500"
                    />
                  </Link>

                  {/* Google OAuth Quick Login */}
                  <div className="my-2 px-2">
                    <button
                      onClick={handleGoogleSignIn}
                      className="w-full flex items-center justify-center gap-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition shadow-xs cursor-pointer"
                    >
                      <svg width="16" height="16" viewBox="0 0 18 18">
                        <path
                          fill="#4285F4"
                          d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.9c1.7-1.57 2.7-3.88 2.7-6.64z"
                        />
                        <path
                          fill="#34A853"
                          d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.27c-.8.54-1.84.86-3.06.86-2.36 0-4.35-1.6-5.06-3.74H.96v2.35C2.44 15.98 5.48 18 9 18z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M3.94 10.67c-.18-.54-.28-1.11-.28-1.7s.1-1.16.28-1.7V4.92H.96A8.997 8.997 0 000 9c0 1.45.35 2.83.96 4.08l2.98-2.41z"
                        />
                        <path
                          fill="#EA4335"
                          d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.92l2.98 2.35C4.65 5.18 6.64 3.58 9 3.58z"
                        />
                      </svg>
                      Sign in with Google
                    </button>
                  </div>

                  <div className="h-px bg-gray-100 my-1" />

                  <Link
                    to="/payment"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition text-left"
                  >
                    <span className="flex items-center gap-3 text-sm font-semibold text-gray-800">
                      <CreditCard size={18} className="text-gray-600" />
                      Payment Methods
                    </span>
                    <ChevronRight size={16} className="text-gray-300" />
                  </Link>

                  <Link
                    to="/mybookings"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-gray-50 transition text-left"
                  >
                    <span className="flex items-center gap-3 text-sm font-semibold text-gray-800">
                      <Sparkles size={18} className="text-gray-600" />
                      My Bookings
                    </span>
                    <ChevronRight size={16} className="text-gray-300" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}