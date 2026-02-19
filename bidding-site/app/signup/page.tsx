"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signup } from "../lib/auth";
import NotificationBell from "../components/NotificationBell";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    mobile: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [success, setSuccess] = useState(false);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  async function handleSubmit() {
    setErrors({});
    const result = await signup(form);
    if (!result.success) {
      setErrors(result.errors || {});
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/"), 1500);
  }

  const inputClass = (field: string) =>
    `w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors ${
      errors[field]
        ? "border-accent-red bg-red-50"
        : "border-border bg-background focus:border-primary"
    }`;

  return (
    <div className="min-h-screen bg-background-page font-sans">
      {/* Header */}
      <header className="bg-gradient-hero text-foreground-inverse">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Bid<span className="text-primary-light">Hub</span>
          </Link>
          <NotificationBell />
        </div>
      </header>

      <div className="mx-auto max-w-md px-6 py-16">
        <div className="rounded-2xl bg-background-card p-8 shadow-[var(--shadow-md)]">
          <h1 className="text-2xl font-bold text-foreground-heading">
            Create Account
          </h1>
          <p className="mt-1 text-sm text-foreground-muted">
            Join BidHub and start bidding on exclusive items.
          </p>

          {success && (
            <div className="mt-4 rounded-lg border border-accent-green/30 bg-accent-green/10 px-4 py-3 text-sm font-medium text-accent-teal">
              Account created! Redirecting to home...
            </div>
          )}

          {errors.general && (
            <div className="mt-4 rounded-lg border border-accent-red/30 bg-accent-red/5 px-4 py-3 text-sm font-medium text-accent-red">
              {errors.general}
            </div>
          )}

          <div className="mt-6 space-y-4">
            {/* Name fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                  First Name <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  placeholder="John"
                  value={form.first_name}
                  onChange={(e) => updateField("first_name", e.target.value)}
                  className={inputClass("first_name")}
                />
                {errors.first_name && (
                  <p className="mt-1 text-xs text-accent-red">{errors.first_name}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                  Last Name <span className="text-accent-red">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Doe"
                  value={form.last_name}
                  onChange={(e) => updateField("last_name", e.target.value)}
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
              </label>
              <input
                type="email"
                placeholder="you@gmail.com"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
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
              </label>
              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-border bg-background-page px-3 py-3 text-sm text-foreground-muted">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={form.mobile}
                  onChange={(e) =>
                    updateField("mobile", e.target.value.replace(/\D/g, ""))
                  }
                  className={inputClass("mobile")}
                />
              </div>
              {errors.mobile && (
                <p className="mt-1 text-xs text-accent-red">{errors.mobile}</p>
              )}
            </div>

            <p className="text-xs text-foreground-muted">
              Either email or mobile number is required.
            </p>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={success}
              className="bg-gradient-primary w-full rounded-lg px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md disabled:opacity-50"
            >
              Create Account
            </button>

            {/* Login link */}
            <p className="text-center text-sm text-foreground-muted">
              Already have an account?{" "}
              <Link href="/" className="font-semibold text-primary hover:underline">
                Log In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
