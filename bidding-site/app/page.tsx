"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getActiveListings, getBidsForListing, formatCurrency, type Listing } from "./lib/listings";
import NotificationBell from "./components/NotificationBell";
import AuthModal from "./components/AuthModal";
import { useAuctionLifecycle } from "./lib/useAuctionLifecycle";
import { getCurrentUser, logout, type User } from "./lib/auth";
import { getBalance } from "./lib/wallet";
import { getCurrentUserId } from "./lib/listings";

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

export default function Home() {
  const [activeListings, setActiveListings] = useState<Listing[]>([]);
  const [bidCountMap, setBidCountMap] = useState<Map<string, number>>(new Map());
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  useAuctionLifecycle();

  useEffect(() => {
    async function load() {
      const listings = await getActiveListings();
      setActiveListings(listings);
      setUser(await getCurrentUser());
      const uid = await getCurrentUserId();
      setWalletBalance(await getBalance(uid));

      const counts = new Map<string, number>();
      for (const l of listings) {
        const bids = await getBidsForListing(l.id);
        counts.set(l.id, bids.length);
      }
      setBidCountMap(counts);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background-page font-sans">
      {/* Header */}
      <header className="bg-gradient-hero text-foreground-inverse">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold tracking-tight">
            Bid<span className="text-primary-light">Hub</span>
          </h1>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="#live-auctions" className="transition-opacity hover:opacity-80">
              Live Auctions
            </a>
            <a href="#categories" className="transition-opacity hover:opacity-80">
              Categories
            </a>
            <a href="#how-it-works" className="transition-opacity hover:opacity-80">
              How It Works
            </a>
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

      {/* Hero Section */}
      <section className="bg-gradient-hero px-6 pb-20 pt-12 text-foreground-inverse">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
              Bid Smart. Win Big.
            </h2>
            <p className="mt-4 text-lg text-white/70">
              Discover exclusive deals and place your bids on premium items.
              Your trusted marketplace for competitive bidding.
            </p>
            <div className="mt-8">
              <Link
                href="/list-item"
                className="inline-block rounded-full border border-white/30 px-8 py-3 text-center text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                List an Item
              </Link>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mx-auto mt-12 max-w-3xl">
            <div className="flex overflow-hidden rounded-lg bg-white shadow-lg">
              <input
                type="text"
                placeholder="Search for items, categories, or sellers..."
                className="flex-1 px-6 py-4 text-sm text-foreground outline-none placeholder:text-foreground-muted"
              />
              <button className="bg-gradient-primary px-8 py-4 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                Search
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Category Cards */}
      <section id="categories" className="-mt-6 px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { name: "Jewellery", icon: "💍" },
            { name: "Clothing", icon: "👗" },
            { name: "Accessories", icon: "👜" },
            { name: "Shoes", icon: "👟" },
          ].map((cat) => {
            const count = activeListings.filter(
              (l) => l.category === cat.name
            ).length;
            return (
              <Link
                href={`/category/${encodeURIComponent(cat.name)}`}
                key={cat.name}
                className="cursor-pointer rounded-lg bg-background-card p-5 text-center shadow-[var(--shadow-md)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]"
              >
                <div className="text-3xl">{cat.icon}</div>
                <h3 className="mt-2 text-sm font-semibold text-foreground-heading">
                  {cat.name}
                </h3>
                <p className="mt-1 text-xs text-foreground-muted">
                  {count} active {count === 1 ? "listing" : "listings"}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Live Auctions */}
      <section id="live-auctions" className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground-heading">
              Live Auctions
            </h2>
            {activeListings.length > 0 && (
              <span className="text-sm text-foreground-muted">
                {activeListings.length} active{" "}
                {activeListings.length === 1 ? "auction" : "auctions"}
              </span>
            )}
          </div>

          {activeListings.length === 0 ? (
            <div className="mt-12 rounded-lg bg-background-card p-12 text-center shadow-[var(--shadow-sm)]">
              <div className="text-4xl">🏷️</div>
              <h3 className="mt-4 text-lg font-semibold text-foreground-heading">
                No live auctions yet
              </h3>
              <p className="mt-2 text-sm text-foreground-muted">
                Be the first to list an item and start an auction!
              </p>
              <Link
                href="/list-item"
                className="bg-gradient-primary mt-6 inline-block rounded-full px-8 py-3 text-sm font-semibold text-white shadow-md transition-shadow hover:shadow-xl"
              >
                List an Item
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {activeListings.map((item) => {
                const bidCount = bidCountMap.get(item.id) || 0;
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
                    <span className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
                      {item.category}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold text-foreground-heading group-hover:text-primary">
                      {item.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs text-foreground-muted">
                      {item.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-foreground-muted">
                          {bidCount > 0 ? "Current Bid" : "Starting Price"}
                        </p>
                        <p className="text-lg font-bold text-primary">
                          {formatPrice(currentPrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-foreground-muted">
                          Time Left
                        </p>
                        <p className="text-sm font-semibold text-accent-red">
                          {timeLeft(item.end_time)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                      <span className="text-xs text-foreground-muted">
                        {bidCount} bid{bidCount !== 1 ? "s" : ""}
                      </span>
                      <span className="bg-gradient-primary rounded-full px-5 py-2 text-xs font-semibold text-white transition-shadow group-hover:shadow-md">
                        Place Bid
                      </span>
                    </div>
                  </div>
                </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Stats Banner */}
      <section className="bg-gradient-hero px-6 py-12 text-foreground-inverse">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 text-center md:grid-cols-4">
          {[
            { value: "50K+", label: "Active Users" },
            { value: "12K+", label: "Items Listed" },
            { value: "₹200Cr+", label: "Bids Placed" },
            { value: "99.5%", label: "Satisfaction" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="mt-1 text-sm text-white/60">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="px-6 py-16">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-2xl font-bold text-foreground-heading">
            How It Works
          </h2>
          <p className="mt-2 text-foreground-muted">
            Start bidding in two simple steps
          </p>

          <div className="mt-12 grid gap-8 md:grid-cols-2 md:max-w-2xl md:mx-auto">
            {[
              {
                step: "01",
                title: "Browse & Discover",
                desc: "Explore categories and find exclusive items you love at great prices.",
              },
              {
                step: "02",
                title: "Place Your Bid",
                desc: "Bid competitively on premium items and win amazing deals.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-lg bg-background-card p-8 shadow-[var(--shadow-sm)]"
              >
                <div className="bg-gradient-primary mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground-heading">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-foreground-muted">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background-card px-6 py-12">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
          <div>
            <h3 className="text-lg font-bold text-foreground-heading">
              Bid<span className="text-primary">Hub</span>
            </h3>
            <p className="mt-2 text-sm text-foreground-muted">
              Your trusted marketplace for competitive bidding on premium items.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground-heading">
              Company
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-foreground-muted">
              <li><a href="#" className="hover:text-primary">About Us</a></li>
              <li><a href="#" className="hover:text-primary">Careers</a></li>
              <li><a href="#" className="hover:text-primary">Press</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground-heading">
              Support
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-foreground-muted">
              <li><a href="#" className="hover:text-primary">Help Center</a></li>
              <li><a href="#" className="hover:text-primary">Safety</a></li>
              <li><a href="#" className="hover:text-primary">Terms</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground-heading">
              Connect
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-foreground-muted">
              <li><a href="#" className="hover:text-primary">Twitter</a></li>
              <li><a href="#" className="hover:text-primary">Instagram</a></li>
              <li><a href="#" className="hover:text-primary">LinkedIn</a></li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-6xl border-t border-border pt-6 text-center text-xs text-foreground-muted">
          © 2026 BidHub. All rights reserved.
        </div>
      </footer>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={async () => setUser(await getCurrentUser())}
      />
    </div>
  );
}
