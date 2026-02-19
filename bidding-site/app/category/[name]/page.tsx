"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getListings,
  getBidsForListing,
  formatCurrency,
  getCurrentUserId,
  type Listing,
} from "../../lib/listings";
import NotificationBell from "../../components/NotificationBell";
import AuthModal from "../../components/AuthModal";
import { useAuctionLifecycle } from "../../lib/useAuctionLifecycle";
import { getCurrentUser, logout, type User } from "../../lib/auth";
import { getBalance } from "../../lib/wallet";

const ICON_MAP: Record<string, string> = {
  Jewellery: "💍",
  Clothing: "👗",
  Accessories: "👜",
  Shoes: "👟",
};

function timeLeft(endTime: string): string {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatPrice(price: string): string {
  return formatCurrency(parseFloat(price) || 0);
}

function formatEndDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CategoryPage() {
  const params = useParams();
  const categoryName = decodeURIComponent(params.name as string);
  const icon = ICON_MAP[categoryName] || "📦";

  const [liveListings, setLiveListings] = useState<Listing[]>([]);
  const [completedListings, setCompletedListings] = useState<Listing[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  useAuctionLifecycle();

  useEffect(() => {
    setUser(getCurrentUser());
    setWalletBalance(getBalance(getCurrentUserId()));

    const all = getListings();
    const now = Date.now();
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    const live: Listing[] = [];
    const completed: Listing[] = [];

    for (const l of all) {
      if (l.category !== categoryName) continue;
      if (l.status === "DRAFT") continue;

      const endTime = new Date(l.end_time).getTime();
      if (l.status === "ACTIVE" && endTime > now) {
        live.push(l);
      } else if (endTime <= now && endTime > sixtyDaysAgo) {
        completed.push(l);
      }
    }

    // Sort: newest first
    live.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    completed.sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime());

    setLiveListings(live);
    setCompletedListings(completed);
  }, [categoryName]);

  function renderCard(item: Listing, isCompleted: boolean) {
    const bidCount = getBidsForListing(item.id).length;
    const currentPrice = item.current_price || item.starting_price;
    return (
      <Link
        href={`/auction/${item.id}`}
        key={item.id}
        className="group overflow-hidden rounded-lg bg-background-card shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-lg)]"
      >
        {/* Image */}
        <div className="relative h-48 bg-gradient-to-br from-primary-light/20 to-primary-dark/20">
          {item.images.length > 0 ? (
            <Image
              src={item.images[0]}
              alt={item.title}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl text-foreground-muted/40">
              📷
            </div>
          )}
          <span className="bg-gradient-accent absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold text-white">
            {item.condition === "NEW" ? "New" : "Used"}
          </span>
          {isCompleted && (
            <span className="absolute right-3 top-3 rounded-full bg-foreground-muted/80 px-3 py-1 text-xs font-medium text-white">
              Ended
            </span>
          )}
        </div>
        <div className="p-5">
          <h3 className={`font-semibold ${isCompleted ? "text-foreground-muted" : "text-foreground-heading group-hover:text-primary"}`}>
            {item.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-foreground-muted">
            {item.description}
          </p>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-foreground-muted">
                {bidCount > 0 ? (isCompleted ? "Final Bid" : "Current Bid") : "Starting Price"}
              </p>
              <p className={`text-lg font-bold ${isCompleted ? "text-foreground-muted" : "text-primary"}`}>
                {formatPrice(currentPrice)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-foreground-muted">
                {isCompleted ? "Ended On" : "Time Left"}
              </p>
              {isCompleted ? (
                <p className="text-sm font-medium text-foreground-muted">
                  {formatEndDate(item.end_time)}
                </p>
              ) : (
                <p className="text-sm font-semibold text-accent-red">
                  {timeLeft(item.end_time)}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-foreground-muted">
              {bidCount} bid{bidCount !== 1 ? "s" : ""}
            </span>
            <span
              className={`rounded-full px-5 py-2 text-xs font-semibold ${
                isCompleted
                  ? "bg-foreground-muted/10 text-foreground-muted"
                  : "bg-gradient-primary text-white transition-shadow group-hover:shadow-md"
              }`}
            >
              {isCompleted ? "View Details" : "Place Bid"}
            </span>
          </div>
        </div>
      </Link>
    );
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
            <Link href="/#categories" className="transition-opacity hover:opacity-80">
              Categories
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

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-foreground-muted">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link href="/#categories" className="hover:text-primary">Categories</Link>
          <span>/</span>
          <span className="text-foreground-heading">{categoryName}</span>
        </div>

        {/* Category Heading */}
        <div className="mb-10 flex items-center gap-3">
          <span className="text-4xl">{icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-foreground-heading">
              {categoryName}
            </h1>
            <p className="text-sm text-foreground-muted">
              {liveListings.length} live {liveListings.length === 1 ? "auction" : "auctions"} · {completedListings.length} recently completed
            </p>
          </div>
        </div>

        {/* Live Auctions */}
        <section className="mb-12">
          <h2 className="mb-6 text-xl font-bold text-foreground-heading">
            Live Auctions
          </h2>
          {liveListings.length === 0 ? (
            <div className="rounded-lg bg-background-card p-8 text-center shadow-[var(--shadow-sm)]">
              <div className="text-3xl">🏷️</div>
              <p className="mt-3 text-sm text-foreground-muted">
                No live auctions in {categoryName} right now.
              </p>
              <Link
                href="/list-item"
                className="bg-gradient-primary mt-4 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-sm"
              >
                List an Item
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {liveListings.map((item) => renderCard(item, false))}
            </div>
          )}
        </section>

        {/* Recently Completed */}
        <section>
          <h2 className="mb-6 text-xl font-bold text-foreground-heading">
            Recently Completed
          </h2>
          {completedListings.length === 0 ? (
            <div className="rounded-lg bg-background-card p-8 text-center shadow-[var(--shadow-sm)]">
              <p className="text-sm text-foreground-muted">
                No completed auctions in {categoryName} in the last 60 days.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {completedListings.map((item) => renderCard(item, true))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
