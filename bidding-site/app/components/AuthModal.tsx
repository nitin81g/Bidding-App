"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  loginWithGoogle,
  requestOtp,
  verifyOtp,
  getDemoOtp,
} from "../lib/auth";

type Tab = "google" | "mobile";
type MobileStep = "enter_mobile" | "enter_otp";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
}: AuthModalProps) {
  const [tab, setTab] = useState<Tab>("google");
  const [error, setError] = useState("");

  // Google state
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");

  // Mobile state
  const [mobile, setMobile] = useState("");
  const [mobileStep, setMobileStep] = useState<MobileStep>("enter_mobile");
  const [otp, setOtp] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setTab("google");
      setError("");
      setGoogleEmail("");
      setGoogleName("");
      setMobile("");
      setMobileStep("enter_mobile");
      setOtp("");
      setDemoOtp(null);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleGoogleLogin() {
    setError("");
    if (!googleEmail.trim()) {
      setError("Please enter your Gmail address.");
      return;
    }
    if (!googleEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    const result = loginWithGoogle(googleEmail.trim(), googleName.trim() || googleEmail.split("@")[0]);
    if (!result.success) {
      setError(result.error || "Login failed.");
      return;
    }
    onLoginSuccess();
    onClose();
  }

  function handleRequestOtp() {
    setError("");
    const result = requestOtp(mobile.trim());
    if (!result.success) {
      setError(result.error || "Failed to send OTP.");
      return;
    }
    setMobileStep("enter_otp");
    setDemoOtp(getDemoOtp());
  }

  function handleVerifyOtp() {
    setError("");
    if (!otp.trim()) {
      setError("Please enter the OTP.");
      return;
    }
    const result = verifyOtp(mobile.trim(), otp.trim());
    if (!result.success) {
      setError(result.error || "Verification failed.");
      return;
    }
    onLoginSuccess();
    onClose();
  }

  function switchTab(t: Tab) {
    setTab(t);
    setError("");
    setMobileStep("enter_mobile");
    setOtp("");
    setDemoOtp(null);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
      <div
        ref={modalRef}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-background-card shadow-[var(--shadow-lg)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-bold text-foreground-heading">Log In</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-foreground-muted/10"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-border">
          <button
            onClick={() => switchTab("google")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === "google"
                ? "border-b-2 border-primary text-primary"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            Google Login
          </button>
          <button
            onClick={() => switchTab("mobile")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === "mobile"
                ? "border-b-2 border-primary text-primary"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            Mobile + OTP
          </button>
        </div>

        <div className="px-6 py-6">
          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-accent-red/30 bg-accent-red/5 px-4 py-2.5 text-sm text-accent-red">
              {error}
            </div>
          )}

          {/* Google Tab */}
          {tab === "google" && (
            <div className="space-y-4">
              <p className="text-sm text-foreground-muted">
                Sign in with your Google account. No signup required.
              </p>
              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                  Gmail Address
                </label>
                <input
                  type="email"
                  placeholder="you@gmail.com"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGoogleLogin()}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                  Display Name{" "}
                  <span className="font-normal text-foreground-muted">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGoogleLogin()}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
              <button
                onClick={handleGoogleLogin}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white border border-border px-4 py-3 text-sm font-semibold text-foreground-heading shadow-sm transition-shadow hover:shadow-md"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </button>
            </div>
          )}

          {/* Mobile Tab */}
          {tab === "mobile" && mobileStep === "enter_mobile" && (
            <div className="space-y-4">
              <p className="text-sm text-foreground-muted">
                Enter your registered mobile number. We&apos;ll send you an OTP.
              </p>
              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                  Mobile Number
                </label>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg border border-border bg-background-page px-3 py-3 text-sm text-foreground-muted">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(e) =>
                      setMobile(e.target.value.replace(/\D/g, ""))
                    }
                    onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                    autoFocus
                  />
                </div>
              </div>
              <button
                onClick={handleRequestOtp}
                className="bg-gradient-primary w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition-shadow hover:shadow-md"
              >
                Send OTP
              </button>
            </div>
          )}

          {tab === "mobile" && mobileStep === "enter_otp" && (
            <div className="space-y-4">
              <p className="text-sm text-foreground-muted">
                Enter the 6-digit OTP sent to +91 {mobile}
              </p>

              {/* Demo OTP display */}
              {demoOtp && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-center text-sm">
                  <span className="text-foreground-muted">Demo OTP: </span>
                  <span className="font-bold text-primary">{demoOtp}</span>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                  OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-center text-lg font-semibold tracking-[0.5em] outline-none transition-colors focus:border-primary"
                  autoFocus
                />
              </div>
              <button
                onClick={handleVerifyOtp}
                className="bg-gradient-primary w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition-shadow hover:shadow-md"
              >
                Verify & Log In
              </button>
              <button
                onClick={() => {
                  setMobileStep("enter_mobile");
                  setOtp("");
                  setError("");
                  setDemoOtp(null);
                }}
                className="w-full text-center text-xs text-primary hover:underline"
              >
                Change number / Resend OTP
              </button>
            </div>
          )}

          {/* Sign Up Link */}
          <div className="mt-6 border-t border-border pt-4 text-center text-sm text-foreground-muted">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              onClick={onClose}
              className="font-semibold text-primary hover:underline"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
