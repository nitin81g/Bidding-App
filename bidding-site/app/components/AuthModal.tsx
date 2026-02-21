"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  requestOtp,
  verifyOtp,
  getDemoOtp,
} from "../lib/auth";

type MobileStep = "enter_mobile" | "enter_otp";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void | Promise<void>;
}

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
}: AuthModalProps) {
  const [error, setError] = useState("");

  // Mobile state
  const [mobile, setMobile] = useState("");
  const [mobileStep, setMobileStep] = useState<MobileStep>("enter_mobile");
  const [otp, setOtp] = useState("");
  const [demoOtp, setDemoOtp] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setError("");
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

  async function handleRequestOtp() {
    setError("");
    const result = await requestOtp(mobile.trim());
    if (!result.success) {
      setError(result.error || "Failed to send OTP.");
      return;
    }
    setMobileStep("enter_otp");
    setDemoOtp(getDemoOtp());
  }

  async function handleVerifyOtp() {
    setError("");
    if (!otp.trim()) {
      setError("Please enter the OTP.");
      return;
    }
    const result = await verifyOtp(mobile.trim(), otp.trim());
    if (!result.success) {
      setError(result.error || "Verification failed.");
      return;
    }
    await onLoginSuccess();
    onClose();
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

        <div className="px-6 py-6">
          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-accent-red/30 bg-accent-red/5 px-4 py-2.5 text-sm text-accent-red">
              {error}
            </div>
          )}

          {/* Enter Mobile */}
          {mobileStep === "enter_mobile" && (
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

          {/* Enter OTP */}
          {mobileStep === "enter_otp" && (
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
