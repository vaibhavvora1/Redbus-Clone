// src/pages/Profile.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Edit2,
  KeyRound,
  X,
  Check,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  validateName,
  validateEmail,
  validateMobile,
  validatePassword,
} from "../utils/validation";

export default function Profile() {
  const { currentUser, logout, updateProfile, updatePassword } = useAuth();
  const navigate = useNavigate();

  // Mode toggles
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Edit Profile Form State
  const [editForm, setEditForm] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    mobile: currentUser?.mobile || "",
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [profileSuccess, setProfileSuccess] = useState("");

  // Change Password Form State
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!currentUser) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-gray-100">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-500 mb-6">
            Please log in to view your profile and manage your account details.
          </p>
          <Link
            to="/login"
            className="block w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const handleEditSubmit = (e) => {
    e.preventDefault();
    setProfileSuccess("");

    const nameRes = validateName(editForm.name);
    const emailRes = validateEmail(editForm.email);
    const mobileRes = validateMobile(editForm.mobile);

    const errors = {
      name: nameRes.isValid ? "" : nameRes.error,
      email: emailRes.isValid ? "" : emailRes.error,
      mobile: mobileRes.isValid ? "" : mobileRes.error,
    };

    setProfileErrors(errors);

    if (!nameRes.isValid || !emailRes.isValid || !mobileRes.isValid) {
      return;
    }

    updateProfile({
      name: editForm.name,
      email: editForm.email,
      mobile: editForm.mobile,
    });

    setProfileSuccess("Profile updated successfully!");
    setIsEditing(false);
    setTimeout(() => setProfileSuccess(""), 3000);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setPasswordSuccess("");

    const passRes = validatePassword(passwordForm.newPassword);
    const errors = {
      newPassword: passRes.isValid ? "" : passRes.error,
      confirmPassword:
        passwordForm.newPassword !== passwordForm.confirmPassword
          ? "Passwords do not match."
          : "",
    };

    setPasswordErrors(errors);

    if (!passRes.isValid || errors.confirmPassword) {
      return;
    }

    updatePassword(currentUser.email, passwordForm.newPassword);
    setPasswordSuccess("Password changed successfully!");
    setPasswordForm({ newPassword: "", confirmPassword: "" });
    setIsChangingPassword(false);
    setTimeout(() => setPasswordSuccess(""), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Profile Card Header */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-red-600 to-red-500 h-28 px-6 flex items-end">
            <div className="translate-y-8 flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-white p-1 shadow-lg flex-shrink-0">
                <div className="w-full h-full rounded-full bg-red-600 text-white flex items-center justify-center text-2xl font-black">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-10 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {currentUser.name || "RedBus Traveler"}
                </h1>
                <p className="text-sm text-gray-500">{currentUser.email}</p>
              </div>

              <div className="flex items-center gap-2">
                {currentUser.isVerified !== false && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 border border-green-200 text-xs font-semibold rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    Verified Account
                  </span>
                )}
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </button>
              </div>
            </div>

            {/* Success Notifications */}
            {profileSuccess && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                {profileSuccess}
              </div>
            )}
            {passwordSuccess && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                {passwordSuccess}
              </div>
            )}

            {/* Profile Information View or Edit Mode */}
            {!isEditing ? (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                    Personal Information
                  </h2>
                  <button
                    onClick={() => {
                      setEditForm({
                        name: currentUser.name || "",
                        email: currentUser.email || "",
                        mobile: currentUser.mobile || "",
                      });
                      setIsEditing(true);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Profile
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <span className="text-[11px] text-gray-400 uppercase font-semibold block">
                        Full Name
                      </span>
                      <span className="text-sm font-bold text-gray-800">
                        {currentUser.name || "Not provided"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div className="min-w-0">
                      <span className="text-[11px] text-gray-400 uppercase font-semibold block">
                        Email Address
                      </span>
                      <span className="text-sm font-bold text-gray-800 truncate block">
                        {currentUser.email}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <span className="text-[11px] text-gray-400 uppercase font-semibold block">
                        Mobile Number
                      </span>
                      <span className="text-sm font-bold text-gray-800">
                        {currentUser.mobile ? `+91 ${currentUser.mobile}` : "Not provided"}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-gray-400" />
                    <div>
                      <span className="text-[11px] text-gray-400 uppercase font-semibold block">
                        Account Status
                      </span>
                      <span className="text-sm font-bold text-green-700">
                        Active & Verified
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Edit Profile Form */
              <form onSubmit={handleEditSubmit} className="mt-6 space-y-4 border rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">Edit Profile Details</h3>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full bg-white px-3.5 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-red-500"
                  />
                  {profileErrors.name && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {profileErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="w-full bg-white px-3.5 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-red-500"
                  />
                  {profileErrors.email && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {profileErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Indian Mobile Number
                  </label>
                  <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-gray-200 focus-within:border-red-500">
                    <span className="text-xs font-bold text-gray-500">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={editForm.mobile}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                        }))
                      }
                      className="w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                  {profileErrors.mobile && (
                    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {profileErrors.mobile}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-100 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Change Password Section */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
                    Security & Password
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Keep your account secure with a strong password
                  </p>
                </div>

                {!isChangingPassword && (
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 transition cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Change Password
                  </button>
                )}
              </div>

              {isChangingPassword && (
                <form
                  onSubmit={handlePasswordSubmit}
                  className="mt-4 space-y-4 border rounded-xl p-4 bg-gray-50/50"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <h3 className="text-sm font-bold text-gray-800">
                      Update Password
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsChangingPassword(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      New Password
                    </label>
                    <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-gray-200 focus-within:border-red-500">
                      <Lock className="w-4 h-4 text-gray-400" />
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            newPassword: e.target.value,
                          }))
                        }
                        placeholder="Min 8 chars, 1 uppercase, 1 lowercase, 1 number & 1 special"
                        className="w-full bg-transparent text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.newPassword && (
                      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{passwordErrors.newPassword}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-gray-200 focus-within:border-red-500">
                      <Lock className="w-4 h-4 text-gray-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                        placeholder="Re-enter new password"
                        className="w-full bg-transparent text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {passwordErrors.confirmPassword && (
                      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {passwordErrors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Update Password
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsChangingPassword(false)}
                      className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-gray-100 text-xs font-bold rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
