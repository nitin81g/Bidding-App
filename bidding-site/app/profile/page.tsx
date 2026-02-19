"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NotificationBell from "../components/NotificationBell";
import AuthModal from "../components/AuthModal";
import { getCurrentUser, logout, updateProfile, type User } from "../lib/auth";
import { getBalance } from "../lib/wallet";
import { getCurrentUserId } from "../lib/listings";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // Editable fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");

  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setWalletBalance(getBalance(getCurrentUserId()));
    if (currentUser) {
      setFirstName(currentUser.first_name);
      setLastName(currentUser.last_name);
      setEmail(currentUser.email);
      setMobile(currentUser.mobile);
    }
  }, []);

  function handleSave() {
    if (!user) return;
    setErrors({});
    setSuccessMessage("");

    const result = updateProfile(user.id, {
      first_name: firstName,
      last_name: lastName,
      email,
      mobile,
    });

    if (!result.success) {
      setErrors(result.errors || {});
      return;
    }

    setUser(result.user || null);
    setEditing(false);
    setSuccessMessage("Profile updated successfully!");
    setTimeout(() => setSuccessMessage(""), 4000);
  }

  function handleCancel() {
    if (!user) return;
    setFirstName(user.first_name);
    setLastName(user.last_name);
    setEmail(user.email);
    setMobile(user.mobile);
    setErrors({});
    setEditing(false);
  }

  const inputClass = (field: string) =>
    `w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors ${
      errors[field]
        ? "border-accent-red bg-red-50"
        : editing
          ? "border-border bg-background focus:border-primary"
          : "border-border bg-background-page text-foreground-muted"
    }`;

  return (
    <div className="min-h-screen bg-background-page font-sans">
      {/* Header */}
      <header className="bg-gradient-hero text-foreground-inverse">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Bid<span className="text-primary-light">Hub</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <Link href="/" className="transition-opacity hover:opacity-80">
              Home
            </Link>
            <Link href="/#live-auctions" className="transition-opacity hover:opacity-80">
              Live Auctions
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {user && (
              <Link
                href="/wallet"
                className="flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/10"
              >
                <span>💰</span>
                <span>{walletBalance.toLocaleString("en-IN")} pts</span>
              </Link>
            )}
            {user ? (
              <>
                <span className="text-sm font-medium">
                  {user.first_name} {user.last_name}
                </span>
                <button
                  onClick={() => {
                    logout();
                    setUser(null);
                  }}
                  className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10"
                >
                  Log Out
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10"
              >
                Log In
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={() => {
          const u = getCurrentUser();
          setUser(u);
          if (u) {
            setFirstName(u.first_name);
            setLastName(u.last_name);
            setEmail(u.email);
            setMobile(u.mobile);
          }
        }}
      />

      <div className="mx-auto max-w-xl px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-foreground-muted">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <span className="text-foreground-heading">My Profile</span>
        </div>

        {!user ? (
          <div className="rounded-2xl bg-background-card p-12 text-center shadow-[var(--shadow-md)]">
            <div className="text-4xl">👤</div>
            <h2 className="mt-4 text-lg font-semibold text-foreground-heading">
              Please log in to view your profile
            </h2>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-gradient-primary mt-6 rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md"
            >
              Log In
            </button>
          </div>
        ) : (
          <>
            {/* Profile Card */}
            <div className="rounded-2xl bg-background-card p-6 shadow-[var(--shadow-md)] md:p-8">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-foreground-heading">
                  My Profile
                </h1>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
                  >
                    Edit Profile
                  </button>
                )}
              </div>

              {/* Auth method badge */}
              <div className="mt-2">
                <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {user.auth_method === "google" ? "Google Account" : "Mobile Account"}
                </span>
              </div>

              {/* Success message */}
              {successMessage && (
                <div className="mt-4 rounded-lg border border-accent-green/30 bg-accent-green/10 px-4 py-3 text-sm font-medium text-accent-teal">
                  {successMessage}
                </div>
              )}

              {/* General error */}
              {errors.general && (
                <div className="mt-4 rounded-lg border border-accent-red/30 bg-accent-red/5 px-4 py-3 text-sm font-medium text-accent-red">
                  {errors.general}
                </div>
              )}

              <div className="mt-6 space-y-5">
                {/* Name fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={!editing}
                      className={inputClass("first_name")}
                    />
                    {errors.first_name && (
                      <p className="mt-1 text-xs text-accent-red">{errors.first_name}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={!editing}
                      className={inputClass("last_name")}
                    />
                    {errors.last_name && (
                      <p className="mt-1 text-xs text-accent-red">{errors.last_name}</p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                    Email Address
                    {!email && editing && (
                      <span className="ml-2 text-xs font-normal text-foreground-muted">
                        (Add your email to enable Google login)
                      </span>
                    )}
                  </label>
                  <input
                    type="email"
                    placeholder={editing ? "you@gmail.com" : "Not set"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!editing}
                    className={inputClass("email")}
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-accent-red">{errors.email}</p>
                  )}
                </div>

                {/* Mobile */}
                <div>
                  <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                    Mobile Number
                    {!mobile && editing && (
                      <span className="ml-2 text-xs font-normal text-foreground-muted">
                        (Add your mobile to enable OTP login)
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-border bg-background-page px-3 py-3 text-sm text-foreground-muted">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder={editing ? "9876543210" : "Not set"}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                      disabled={!editing}
                      className={inputClass("mobile")}
                    />
                  </div>
                  {errors.mobile && (
                    <p className="mt-1 text-xs text-accent-red">{errors.mobile}</p>
                  )}
                </div>

                {/* Info note */}
                <p className="text-xs text-foreground-muted">
                  Either email or mobile number must be set. Member since{" "}
                  {new Date(user.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  .
                </p>

                {/* Action buttons */}
                {editing && (
                  <div className="flex gap-3 border-t border-border pt-5">
                    <button
                      onClick={handleCancel}
                      className="flex-1 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground-muted/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="bg-gradient-primary flex-1 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md"
                    >
                      Save Changes
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Link
                href="/wallet"
                className="rounded-xl bg-background-card p-5 text-center shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)]"
              >
                <div className="text-2xl">💰</div>
                <p className="mt-2 text-sm font-semibold text-foreground-heading">
                  My Wallet
                </p>
                <p className="mt-1 text-lg font-bold text-primary">
                  {walletBalance.toLocaleString("en-IN")} pts
                </p>
              </Link>
              <Link
                href="/#live-auctions"
                className="rounded-xl bg-background-card p-5 text-center shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)]"
              >
                <div className="text-2xl">🏷️</div>
                <p className="mt-2 text-sm font-semibold text-foreground-heading">
                  Live Auctions
                </p>
                <p className="mt-1 text-sm text-foreground-muted">
                  Browse & bid
                </p>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
