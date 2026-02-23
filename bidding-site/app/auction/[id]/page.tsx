"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  getListingById,
  getBidsForListing,
  placeBid,
  getCurrentUserId,
  formatCurrency,
  type Listing,
  type Bid,
} from "../../lib/listings";
import NotificationBell from "../../components/NotificationBell";
import AuthModal from "../../components/AuthModal";
import { useAuctionLifecycle } from "../../lib/useAuctionLifecycle";
import { getCurrentUser, logout, type User } from "../../lib/auth";
import { getBalance } from "../../lib/wallet";

function timeLeft(endTime: string): string {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

function maskBidderId(id: string): string {
  if (id.length <= 8) return "****";
  return id.slice(0, 4) + "****" + id.slice(-4);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AuctionDetailPage() {
  const params = useParams();
  const listingId = params.id as string;
  const [userId, setUserId] = useState("");
  useAuctionLifecycle();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidAmount, setBidAmount] = useState("");
  const [showBidInput, setShowBidInput] = useState(false);
  const [bidError, setBidError] = useState("");
  const [bidSuccess, setBidSuccess] = useState("");
  const [countdown, setCountdown] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    async function loadUser() {
      const uid = await getCurrentUserId();
      setUserId(uid);
      setUser(await getCurrentUser());
      setWalletBalance(await getBalance(uid));
    }
    loadUser();
  }, []);

  const refreshData = useCallback(async () => {
    const l = await getListingById(listingId);
    setListing(l);
    setBids(await getBidsForListing(listingId));
    setLoading(false);
  }, [listingId]);

  // Load data
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Countdown timer
  useEffect(() => {
    if (!listing?.end_time) return;
    const interval = setInterval(() => {
      setCountdown(timeLeft(listing.end_time));
    }, 1000);
    setCountdown(timeLeft(listing.end_time));
    return () => clearInterval(interval);
  }, [listing?.end_time]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-page font-sans">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-foreground-muted">Loading auction...</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-page font-sans">
        <div className="text-center">
          <p className="text-lg text-foreground-muted">Auction not found</p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const currentPrice =
    parseFloat(listing.current_price) || parseFloat(listing.starting_price);
  const minIncrement = parseFloat(listing.minimum_increment);
  const isFirstBid = !listing.highest_bidder_id;
  const minimumBid = isFirstBid ? currentPrice : currentPrice + minIncrement;
  const isExpired = new Date(listing.end_time) <= new Date();
  const isSeller = listing.seller_id === userId;
  const isHighestBidder = listing.highest_bidder_id === userId;

  function handlePlaceBidClick() {
    setBidError("");
    setBidSuccess("");
    setBidAmount(minimumBid.toString());
    setShowBidInput(true);
  }

  async function handleConfirmBid() {
    setBidError("");
    setBidSuccess("");

    const amount = parseFloat(bidAmount);

    // Client-side quick check for numeric
    if (!bidAmount || isNaN(amount)) {
      setBidError("Please enter a valid numeric amount.");
      return;
    }

    const result = await placeBid(listingId, userId, amount);

    if (!result.success) {
      setBidError(result.error || "Failed to place bid.");
      return;
    }

    // Success
    setBidSuccess("Your bid has been placed.");
    setShowBidInput(false);
    setBidAmount("");
    await refreshData();
    setWalletBalance(await getBalance(userId));

    setTimeout(() => setBidSuccess(""), 5000);
  }

  function handleCancelBid() {
    setShowBidInput(false);
    setBidAmount("");
    setBidError("");
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

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-foreground-muted">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link href="/#live-auctions" className="hover:text-primary">Live Auctions</Link>
          <span>/</span>
          <span className="text-foreground-heading">{listing.title}</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left: Images */}
          <div className="lg:col-span-3">
            {/* Main Image */}
            <div className="relative h-80 overflow-hidden rounded-xl bg-background-card shadow-[var(--shadow-md)] md:h-[420px]">
              {listing.images.length > 0 ? (
                <Image
                  src={listing.images[selectedImage]}
                  alt={listing.title}
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-6xl text-foreground-muted/30">
                  📷
                </div>
              )}
              {/* Condition + Category badges */}
              <span className="bg-gradient-accent absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold text-white">
                {listing.condition === "NEW" ? "New" : "Used"}
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white">
                {listing.category}
              </span>
            </div>

            {/* Thumbnail strip */}
            {listing.images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {listing.images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                      selectedImage === i
                        ? "border-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Image src={src} alt={`Thumb ${i + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="mt-6 rounded-xl bg-background-card p-6 shadow-[var(--shadow-sm)]">
              <h2 className="text-sm font-semibold text-foreground-heading">Description</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {listing.description}
              </p>
            </div>
          </div>

          {/* Right: Bid Panel */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 space-y-4">
              {/* Auction Info Card */}
              <div className="rounded-xl bg-background-card p-6 shadow-[var(--shadow-md)]">
                <h1 className="text-xl font-bold text-foreground-heading">
                  {listing.title}
                </h1>

                {/* Status */}
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      isExpired ? "bg-accent-red" : "bg-accent-green"
                    }`}
                  />
                  <span className="text-xs font-medium text-foreground-muted">
                    {isExpired ? "Auction Ended" : "Live Auction"}
                  </span>
                </div>

                {/* Countdown */}
                <div className="mt-4 rounded-lg bg-background-page p-4 text-center">
                  <p className="text-xs text-foreground-muted">
                    {isExpired ? "Auction ended" : "Time Remaining"}
                  </p>
                  <p
                    className={`mt-1 text-2xl font-bold ${
                      isExpired ? "text-foreground-muted" : "text-accent-red"
                    }`}
                  >
                    {countdown || "—"}
                  </p>
                </div>

                {/* Current Price */}
                <div className="mt-4">
                  <p className="text-xs text-foreground-muted">
                    {bids.length > 0 ? "Current Highest Bid" : "Starting Price"}
                  </p>
                  <p className="text-3xl font-bold text-primary">
                    {formatCurrency(currentPrice)}
                  </p>
                  <p className="mt-1 text-xs text-foreground-muted">
                    Minimum increment: {formatCurrency(minIncrement)}
                  </p>
                  {bids.length > 0 && (
                    <p className="mt-0.5 text-xs text-foreground-muted">
                      {bids.length} bid{bids.length !== 1 ? "s" : ""} placed
                    </p>
                  )}
                </div>

                {/* Highest bidder indicator */}
                {isHighestBidder && !isExpired && (
                  <div className="mt-3 rounded-lg border border-accent-green/30 bg-accent-green/10 px-4 py-2 text-sm font-medium text-accent-teal">
                    You are the highest bidder
                  </div>
                )}

                {isHighestBidder && isExpired && (
                  <div className="mt-3 rounded-lg border border-accent-green/30 bg-accent-green/10 px-4 py-2 text-sm font-bold text-accent-teal">
                    You won this auction!
                  </div>
                )}

                {/* Success message */}
                {bidSuccess && (
                  <div className="mt-3 rounded-lg border border-accent-green/30 bg-accent-green/10 px-4 py-2 text-sm font-medium text-accent-teal">
                    {bidSuccess}
                  </div>
                )}

                {/* Error message */}
                {bidError && (
                  <div className="mt-3 rounded-lg border border-accent-red/30 bg-accent-red/5 px-4 py-2 text-sm font-medium text-accent-red">
                    {bidError}
                  </div>
                )}

                {/* Bid Input */}
                {showBidInput && !isExpired && !isSeller && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-foreground-heading">
                        Your Bid Amount (₹)
                      </label>
                      <input
                        type="number"
                        min={minimumBid}
                        step="0.01"
                        value={bidAmount}
                        onChange={(e) => {
                          setBidAmount(e.target.value);
                          setBidError("");
                        }}
                        className="w-full rounded-lg border border-border bg-background px-4 py-3 text-lg font-semibold outline-none transition-colors focus:border-primary"
                        autoFocus
                      />
                      <p className="mt-1 text-xs text-foreground-muted">
                        Minimum bid: {formatCurrency(minimumBid)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelBid}
                        className="flex-1 rounded-lg border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground-muted/10"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmBid}
                        className="bg-gradient-primary flex-1 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md"
                      >
                        Confirm Bid
                      </button>
                    </div>
                  </div>
                )}

                {/* Wallet Balance */}
                {!isSeller && !isExpired && (
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-background-page px-4 py-2.5">
                    <span className="text-xs text-foreground-muted">
                      Your bid points:{" "}
                      <span className="font-semibold text-primary">
                        {walletBalance.toLocaleString("en-IN")} pts
                      </span>
                    </span>
                    <Link
                      href="/wallet"
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Top up
                    </Link>
                  </div>
                )}

                {/* Place Bid Button (shown when input is hidden) */}
                {!showBidInput && !isExpired && !isSeller && (
                  <button
                    onClick={handlePlaceBidClick}
                    className="bg-gradient-primary mt-3 w-full rounded-lg px-6 py-3.5 text-base font-semibold text-white shadow-md transition-shadow hover:shadow-xl"
                  >
                    Place Bid
                  </button>
                )}

                {/* Seller notice */}
                {isSeller && (
                  <div className="mt-4 rounded-lg bg-background-page px-4 py-3 text-center text-sm text-foreground-muted">
                    This is your listing — you cannot bid on it.
                  </div>
                )}

                {/* Expired notice */}
                {isExpired && !isHighestBidder && (
                  <div className="mt-4 rounded-lg bg-background-page px-4 py-3 text-center text-sm text-foreground-muted">
                    This auction has ended. Bidding is closed.
                  </div>
                )}
              </div>

              {/* Auction Details */}
              <div className="rounded-xl bg-background-card p-6 shadow-[var(--shadow-sm)]">
                <h3 className="text-sm font-semibold text-foreground-heading">
                  Auction Details
                </h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-foreground-muted">Starting Price</dt>
                    <dd className="font-medium text-foreground-heading">
                      {formatCurrency(parseFloat(listing.starting_price))}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground-muted">Min Increment</dt>
                    <dd className="font-medium text-foreground-heading">
                      {formatCurrency(minIncrement)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground-muted">Ends At</dt>
                    <dd className="font-medium text-foreground-heading">
                      {formatTime(listing.end_time)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground-muted">Condition</dt>
                    <dd className="font-medium text-foreground-heading">
                      {listing.condition === "NEW" ? "New" : "Used"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground-muted">Total Bids</dt>
                    <dd className="font-medium text-foreground-heading">
                      {bids.length}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Bid History */}
        <div className="mt-8 rounded-xl bg-background-card p-6 shadow-[var(--shadow-sm)]">
          <h2 className="text-lg font-bold text-foreground-heading">
            Bid History
          </h2>

          {bids.length === 0 ? (
            <div className="mt-6 py-8 text-center">
              <p className="text-sm text-foreground-muted">
                No bids yet. Be the first to bid!
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold uppercase text-foreground-muted">
                    <th className="pb-3 pr-4">#</th>
                    <th className="pb-3 pr-4">Bidder</th>
                    <th className="pb-3 pr-4">Amount</th>
                    <th className="pb-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid, i) => {
                    const isWinning = i === 0;
                    const isYou = bid.bidder_id === userId;
                    return (
                      <tr
                        key={bid.id}
                        className={`border-b border-border-light ${
                          isWinning ? "bg-accent-green/5" : ""
                        }`}
                      >
                        <td className="py-3 pr-4 text-foreground-muted">
                          {bids.length - i}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="font-medium text-foreground-heading">
                            {isYou ? "You" : maskBidderId(bid.bidder_id)}
                          </span>
                          {isWinning && (
                            <span className="ml-2 rounded bg-accent-green/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent-teal">
                              Highest
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 font-semibold text-primary">
                          {formatCurrency(bid.amount)}
                        </td>
                        <td className="py-3 text-foreground-muted">
                          {formatTime(bid.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
