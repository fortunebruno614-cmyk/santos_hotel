"use client";

import { useState, useRef } from "react";
import { updateProfile, updateEmail, updatePassword, signOut, uploadAvatar } from "@/app/actions";

type ProfileFormProps = {
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string;
};

export default function ProfileForm({
  fullName,
  email,
  phone,
  avatarUrl,
}: ProfileFormProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "email" | "password">("profile");
  const [avatarPreview, setAvatarPreview] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setError("");
    setUploading(true);

    const result = await uploadAvatar(file);

    if (result.error) {
      setError("Upload failed: " + result.error);
    } else {
      setAvatarPreview(result.url!);
    }

    setUploading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await uploadFile(file);
          return;
        }
      }
    }
  };

  return (
    <div className="profileCard">
      <div className="profileSidebar">
        <div
          className="profileAvatar"
          onClick={() => fileInputRef.current?.click()}
          onPaste={handlePaste}
          tabIndex={0}
          style={{ cursor: "pointer", outline: "none" }}
          title="Click to upload or Ctrl+V to paste"
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="Profile" className="avatarImage" />
          ) : (
            <span className="avatarPlaceholder">
              {fullName ? fullName.charAt(0).toUpperCase() : "U"}
            </span>
          )}
          <div className="avatarOverlay">
            {uploading ? "Uploading..." : "Click or Ctrl+V"}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        <p className="profileName">{fullName || "User"}</p>
        <p className="profileEmail">{email}</p>

        {error && <div className="authError" style={{ width: "100%", marginTop: 8 }}>{error}</div>}

        <div className="profileTabs">
          <button
            className={`profileTab ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            Profile
          </button>
          <button
            className={`profileTab ${activeTab === "email" ? "active" : ""}`}
            onClick={() => setActiveTab("email")}
          >
            Email
          </button>
          <button
            className={`profileTab ${activeTab === "password" ? "active" : ""}`}
            onClick={() => setActiveTab("password")}
          >
            Password
          </button>
        </div>

        <form action={signOut} style={{ width: "100%", marginTop: 8 }}>
          <button type="submit" className="btn btnLogout" style={{ width: "100%" }}>
            Log out
          </button>
        </form>
      </div>

      <div className="profileContent">
        {activeTab === "profile" && (
          <form action={updateProfile} className="profileSection">
            <h2>Profile Information</h2>
            <p className="sectionSubtitle">Update your personal details and profile picture.</p>

            <div className="field">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Your full name"
                defaultValue={fullName}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                defaultValue={phone}
              />
            </div>

            <button type="submit" className="btn btnPrimary btnLarge" style={{ marginTop: 8 }}>
              Save Changes
            </button>
          </form>
        )}

        {activeTab === "email" && (
          <form action={updateEmail} className="profileSection">
            <h2>Change Email</h2>
            <p className="sectionSubtitle">
              Update your email address. A confirmation link will be sent to the new email.
            </p>

            <div className="field">
              <label htmlFor="currentEmail">Current Email</label>
              <input
                id="currentEmail"
                type="email"
                value={email}
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>

            <div className="field">
              <label htmlFor="email">New Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="new@email.com"
                required
              />
            </div>

            <button type="submit" className="btn btnPrimary btnLarge" style={{ marginTop: 8 }}>
              Update Email
            </button>
          </form>
        )}

        {activeTab === "password" && (
          <form action={updatePassword} className="profileSection">
            <h2>Change Password</h2>
            <p className="sectionSubtitle">
              Choose a strong password to keep your account secure.
            </p>

            <div className="field">
              <label htmlFor="password">New Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            <button type="submit" className="btn btnPrimary btnLarge" style={{ marginTop: 8 }}>
              Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
