"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NotificationBell from "../components/NotificationBell";
import AuthModal from "../components/AuthModal";
import { getCurrentUser, logout, type User } from "../lib/auth";
import { getBalance, getTransactions, type Transaction } from "../lib/wallet";
import { getCurrentUserId } from "../lib/listings";

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeLabel(type: Transaction["type"]): string {
  switch (type) {
    case "TOP_UP":
      return "Top Up";
    case "LISTING_FEE":
      return "Listing Fee";
    case "BID_DEDUCTION":
      return "Bid Deduction";
    default:
      return type;
  }
}

export default function WalletPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  useEffect(() => {
    setUser(getCurrentUser());
    const userId = getCurrentUserId();
    setBalance(getBalance(userId));
    setTransactions(getTransactions(userId));
  }, []);

  function handleAddPoints() {
    const amount = selectedAmount || parseInt(customAmount);
    if (!amount || amount < 1) return;
    router.push(`/wallet/payment?amount=${amount}`);
  }

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
            {user ? (
              <>
                <Link href="/profile" className="text-sm font-medium hover:underline">
                  {user.first_name} {user.last_name}
                </Link>
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
        onLoginSuccess={() => setUser(getCurrentUser())}
      />

      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-foreground-muted">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <span className="text-foreground-heading">My Wallet</span>
        </div>

        {!user ? (
          <div className="rounded-2xl bg-background-card p-12 text-center shadow-[var(--shadow-md)]">
            <div className="text-4xl">💰</div>
            <h2 className="mt-4 text-lg font-semibold text-foreground-heading">
              Please log in to view your wallet
            </h2>
            <p className="mt-2 text-sm text-foreground-muted">
              You need to be logged in to manage your bid points.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-gradient-primary mt-6 rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md"
            >
              Log In
            </button>
          </div>
        ) : (
          <>
            {/* Balance Card */}
            <div className="rounded-2xl bg-gradient-hero p-8 text-foreground-inverse shadow-[var(--shadow-lg)]">
              <p className="text-sm font-medium text-white/70">Available Bid Points</p>
              <p className="mt-2 text-4xl font-bold">
                {balance.toLocaleString("en-IN")} <span className="text-lg font-medium text-white/70">pts</span>
              </p>
              <p className="mt-1 text-sm text-white/50">1 point = ₹1</p>
            </div>

            {/* Top Up Section */}
            <div className="mt-8 rounded-2xl bg-background-card p-6 shadow-[var(--shadow-md)]">
              <h2 className="text-lg font-bold text-foreground-heading">
                Add Bid Points
              </h2>
              <p className="mt-1 text-sm text-foreground-muted">
                Select an amount or enter a custom value
              </p>

              {/* Quick amounts */}
              <div className="mt-4 flex flex-wrap gap-2">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      setSelectedAmount(amt);
                      setCustomAmount("");
                    }}
                    className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                      selectedAmount === amt
                        ? "bg-gradient-primary text-white shadow-sm"
                        : "border border-border bg-background text-foreground hover:border-primary"
                    }`}
                  >
                    ₹{amt.toLocaleString("en-IN")}
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-foreground-heading">
                  Custom Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                  }}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>

              <button
                onClick={handleAddPoints}
                disabled={!selectedAmount && (!customAmount || parseInt(customAmount) < 1)}
                className="bg-gradient-primary mt-4 w-full rounded-lg px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md disabled:opacity-50"
              >
                Add {selectedAmount || parseInt(customAmount) || 0} Points
              </button>
            </div>

            {/* Transaction History */}
            <div className="mt-8 rounded-2xl bg-background-card p-6 shadow-[var(--shadow-md)]">
              <h2 className="text-lg font-bold text-foreground-heading">
                Transaction History
              </h2>

              {transactions.length === 0 ? (
                <div className="mt-6 py-8 text-center">
                  <p className="text-sm text-foreground-muted">
                    No transactions yet. Add bid points to get started!
                  </p>
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold uppercase text-foreground-muted">
                        <th className="pb-3 pr-4">Date</th>
                        <th className="pb-3 pr-4">Type</th>
                        <th className="pb-3 pr-4">Description</th>
                        <th className="pb-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id} className="border-b border-border-light">
                          <td className="py-3 pr-4 text-foreground-muted">
                            {formatDate(t.created_at)}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                t.type === "TOP_UP"
                                  ? "bg-accent-green/10 text-accent-teal"
                                  : "bg-accent-red/10 text-accent-red"
                              }`}
                            >
                              {typeLabel(t.type)}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-foreground">
                            {t.description}
                          </td>
                          <td
                            className={`py-3 text-right font-semibold ${
                              t.amount > 0 ? "text-accent-teal" : "text-accent-red"
                            }`}
                          >
                            {t.amount > 0 ? "+" : ""}
                            {t.amount.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
