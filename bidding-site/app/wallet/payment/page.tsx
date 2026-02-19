"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import NotificationBell from "../../components/NotificationBell";
import AuthModal from "../../components/AuthModal";
import { getCurrentUser, logout, type User } from "../../lib/auth";
import { creditPoints } from "../../lib/wallet";
import { getCurrentUserId } from "../../lib/listings";

type PaymentMethod = "upi" | "card";

function PaymentForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const amount = parseInt(searchParams.get("amount") || "0");

  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // UPI fields
  const [upiId, setUpiId] = useState("");

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cardName, setCardName] = useState("");

  useEffect(() => {
    async function load() {
      setUser(await getCurrentUser());
    }
    load();
  }, []);

  if (!amount || amount < 1) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-foreground-muted">Invalid amount.</p>
        <Link href="/wallet" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          Back to Wallet
        </Link>
      </div>
    );
  }

  async function handlePay() {
    setError("");

    if (method === "upi") {
      if (!upiId.includes("@")) {
        setError("Please enter a valid UPI ID (e.g., user@upi)");
        return;
      }
    } else {
      const cleanCard = cardNumber.replace(/\s/g, "");
      if (cleanCard.length < 16) {
        setError("Please enter a valid 16-digit card number.");
        return;
      }
      if (!expiry.match(/^\d{2}\/\d{2}$/)) {
        setError("Please enter expiry in MM/YY format.");
        return;
      }
      if (cvv.length < 3) {
        setError("Please enter a valid CVV.");
        return;
      }
      if (!cardName.trim()) {
        setError("Please enter the name on card.");
        return;
      }
    }

    setProcessing(true);
    setTimeout(async () => {
      const userId = await getCurrentUserId();
      await creditPoints(userId, amount, `Top-up via ${method === "upi" ? "UPI" : "Card"}`);
      setProcessing(false);
      setSuccess(true);
    }, 1500);
  }

  function formatCardNumber(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  }

  function formatExpiry(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length > 2) {
      return digits.slice(0, 2) + "/" + digits.slice(2);
    }
    return digits;
  }

  return (
    <div className="min-h-screen bg-background-page font-sans">
      {/* Header */}
      <header className="bg-gradient-hero text-foreground-inverse">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Bid<span className="text-primary-light">Hub</span>
          </Link>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {user ? (
              <>
                <Link href="/profile" className="text-sm font-medium hover:underline">
                  {user.first_name} {user.last_name}
                </Link>
                <button
                  onClick={async () => {
                    await logout();
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
        onLoginSuccess={async () => setUser(await getCurrentUser())}
      />

      <div className="mx-auto max-w-md px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-foreground-muted">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link href="/wallet" className="hover:text-primary">My Wallet</Link>
          <span>/</span>
          <span className="text-foreground-heading">Add Points</span>
        </div>

        {success ? (
          /* Success Screen */
          <div className="rounded-2xl bg-background-card p-8 text-center shadow-[var(--shadow-md)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-green/20 text-3xl">
              ✓
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground-heading">
              Payment Successful!
            </h2>
            <p className="mt-2 text-sm text-foreground-muted">
              {amount.toLocaleString("en-IN")} bid points have been added to your wallet.
            </p>
            <div className="mt-2 text-3xl font-bold text-primary">
              +{amount.toLocaleString("en-IN")} pts
            </div>
            <button
              onClick={() => router.push("/wallet")}
              className="bg-gradient-primary mt-6 w-full rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md"
            >
              Go to Wallet
            </button>
          </div>
        ) : (
          /* Payment Form */
          <div className="rounded-2xl bg-background-card p-6 shadow-[var(--shadow-md)]">
            {/* Amount display */}
            <div className="mb-6 rounded-lg bg-background-page p-4 text-center">
              <p className="text-xs text-foreground-muted">You are paying</p>
              <p className="mt-1 text-3xl font-bold text-foreground-heading">
                ₹{amount.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs text-foreground-muted">
                = {amount.toLocaleString("en-IN")} bid points
              </p>
            </div>

            {/* Payment Method Tabs */}
            <div className="mb-6 flex overflow-hidden rounded-lg border border-border">
              <button
                onClick={() => { setMethod("upi"); setError(""); }}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  method === "upi"
                    ? "bg-primary text-white"
                    : "bg-background text-foreground-muted hover:text-foreground"
                }`}
              >
                UPI
              </button>
              <button
                onClick={() => { setMethod("card"); setError(""); }}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  method === "card"
                    ? "bg-primary text-white"
                    : "bg-background text-foreground-muted hover:text-foreground"
                }`}
              >
                Card
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-lg border border-accent-red/30 bg-accent-red/5 px-4 py-2.5 text-sm text-accent-red">
                {error}
              </div>
            )}

            {/* UPI Form */}
            {method === "upi" && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                    UPI ID
                  </label>
                  <input
                    type="text"
                    placeholder="yourname@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Card Form */}
            {method === "card" && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                    Card Number
                  </label>
                  <input
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    maxLength={19}
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                      Expiry
                    </label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                      CVV
                    </label>
                    <input
                      type="password"
                      placeholder="•••"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      maxLength={3}
                      className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                    Name on Card
                  </label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>
              </div>
            )}

            {/* Pay Button */}
            <button
              onClick={handlePay}
              disabled={processing}
              className="bg-gradient-primary mt-6 w-full rounded-lg px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md disabled:opacity-50"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                `Pay ₹${amount.toLocaleString("en-IN")}`
              )}
            </button>

            <p className="mt-3 text-center text-xs text-foreground-muted">
              This is a demo payment. No real transaction will be processed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background-page"><p className="text-foreground-muted">Loading...</p></div>}>
      <PaymentForm />
    </Suspense>
  );
}
