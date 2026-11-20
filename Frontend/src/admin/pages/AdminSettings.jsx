// src/admin/pages/AdminSettings.jsx
import { useState, useEffect } from "react";
import { Settings, Shield, User, KeyRound, CheckCircle, AlertCircle } from "lucide-react";
import api from "../../services/api";
import PageHeader from "../components/PageHeader";
import Toast from "../components/Toast";

export default function AdminSettings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => setToast({ message, type });

  useEffect(() => {
    api.admin.settings.getProfile()
      .then((res) => {
        if (res.success && res.data) {
          setProfile(res.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load profile:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (!passwordForm.currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await api.admin.settings.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      if (res.success) {
        showToast("Password updated successfully.");
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        setPasswordError(res.message || "Failed to update password.");
      }
    } catch (err) {
      setPasswordError(err.message || "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Admin Settings"
        subtitle="Manage administrator profile and credentials"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-4">
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Admin Account Profile</h2>
              <p className="text-xs text-gray-500">Your current administrator session info</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-xs text-gray-400 block font-medium">Name</span>
                <span className="font-semibold text-gray-800">{profile?.name || "Administrator"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block font-medium">Email</span>
                <span className="font-semibold text-gray-800">{profile?.email || "—"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block font-medium">Phone</span>
                <span className="font-semibold text-gray-800">{profile?.phone || "—"}</span>
              </div>
              <div>
                <span className="text-xs text-gray-400 block font-medium">Role</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 mt-0.5">
                  <Shield size={12} />
                  {profile?.role || "ADMIN"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5 border-b border-gray-100 pb-4">
            <div className="p-2.5 rounded-xl bg-gray-100 text-gray-700">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Change Password</h2>
              <p className="text-xs text-gray-500">Update your admin login password</p>
            </div>
          </div>

          {passwordError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4">
              <AlertCircle size={15} className="shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-500"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-500"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                }
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-500"
                placeholder="Repeat new password"
              />
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl py-2.5 transition-colors cursor-pointer mt-2"
            >
              {savingPassword ? "Updating Password…" : "Update Password"}
            </button>
          </form>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
