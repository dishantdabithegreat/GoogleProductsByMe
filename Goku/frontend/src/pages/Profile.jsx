
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  UserCircle,
  Mail,
  Calendar,
  Edit3,
  Save,
  X,
  LogOut,
  ArrowLeft,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

import {
  getCurrentUser,
  updateCurrentUser,
} from "../services/auth";

export default function Profile() {
  const navigate = useNavigate();

  const { token, user, saveSession, logout } = useAuth();

  const [profile, setProfile] = useState(user);
  const [name, setName] = useState(user?.name || "");

  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(Boolean(token));
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        setLoading(true);
        setError("");

        const currentUser = await getCurrentUser(token);

        if (!active) return;

        setProfile(currentUser);
        setName(currentUser.name || "");

        saveSession(token, currentUser);
      } catch (err) {
        if (!active) return;

        setError(err.message || "Unable to load profile.");

        logout();
        navigate("/login", { replace: true });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [token]);

  async function handleSave(event) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (trimmedName.length < 2 || trimmedName.length > 50) {
      setError("Name must contain 2 to 50 characters.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const updatedUser = await updateCurrentUser(token, {
        name: trimmedName,
      });

      setProfile(updatedUser);
      setName(updatedUser.name || "");
      saveSession(token, updatedUser);

      setEditing(false);
      setSuccess("Profile updated successfully!");
    } catch (err) {
      setError(err.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setName(profile?.name || "");
    setEditing(false);
    setError("");
    setSuccess("");
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (loading) {
    return (
      <div className="profile-loading">
        Loading your profile...
      </div>
    );
  }

  return (
    <main className="profile-page">
      <section className="profile-card">

        <button
          className="profile-back"
          onClick={() => navigate("/")}
          type="button"
        >
          <ArrowLeft size={17} />
          Back to Goku
        </button>

        <div className="profile-heading">
          <div className="profile-avatar">
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt="Profile avatar"
              />
            ) : (
              <UserCircle size={65} />
            )}
          </div>

          <h1>My Profile</h1>
          <p>Manage your Goku account</p>
        </div>

        {error && (
          <div className="profile-error">
            {error}
          </div>
        )}

        {success && (
          <div className="profile-success">
            {success}
          </div>
        )}

        {!editing ? (
          <>
            <div className="profile-information">

              <div className="profile-info-row">
                <UserCircle size={20} />

                <div>
                  <span>Full Name</span>
                  <strong>{profile?.name || "Not available"}</strong>
                </div>
              </div>

              <div className="profile-info-row">
                <Mail size={20} />

                <div>
                  <span>Email Address</span>
                  <strong>{profile?.email || "Not available"}</strong>
                </div>
              </div>

              <div className="profile-info-row">
                <Calendar size={20} />

                <div>
                  <span>Member Since</span>
                  <strong>
                    {profile?.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString()
                      : "Unavailable"}
                  </strong>
                </div>
              </div>

            </div>

            <button
              className="profile-edit-button"
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setEditing(true);
              }}
            >
              <Edit3 size={18} />
              Edit Profile
            </button>
          </>
        ) : (
          <form
            className="profile-edit-form"
            onSubmit={handleSave}
          >
            <label htmlFor="profile-name">
              Full Name
            </label>

            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={50}
              required
            />

            <label htmlFor="profile-email">
              Email Address
            </label>

            <input
              id="profile-email"
              type="email"
              value={profile?.email || ""}
              disabled
              readOnly
            />

            <div className="profile-form-actions">

              <button
                type="submit"
                className="profile-edit-button"
                disabled={saving}
              >
                <Save size={17} />
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                className="profile-cancel-button"
                onClick={handleCancel}
                disabled={saving}
              >
                <X size={17} />
                Cancel
              </button>

            </div>
          </form>
        )}

        <button
          className="profile-logout"
          onClick={handleLogout}
          type="button"
        >
          <LogOut size={18} />
          Logout
        </button>

      </section>
    </main>
  );
}
