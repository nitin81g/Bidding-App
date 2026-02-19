export type Condition = "NEW" | "USED";
export type ListingStatus = "DRAFT" | "ACTIVE" | "ENDED";

export interface Listing {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  condition: Condition | "";
  starting_price: string;
  minimum_increment: string;
  current_price: string;
  highest_bidder_id: string | null;
  end_time: string;
  status: ListingStatus;
  images: string[]; // base64 data URLs
  created_at: string;
  updated_at: string;
}

export interface Bid {
  id: string;
  listing_id: string;
  bidder_id: string;
  amount: number;
  created_at: string;
}

const STORAGE_KEY = "bidhub_listings";
const BIDS_STORAGE_KEY = "bidhub_bids";
const CURRENT_USER_KEY = "bidhub_current_user";

// Simple user simulation — each browser gets a persistent random user ID
export function getCurrentUserId(): string {
  if (typeof window === "undefined") return "";
  let userId = localStorage.getItem(CURRENT_USER_KEY);
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem(CURRENT_USER_KEY, userId);
  }
  return userId;
}

export function getListings(): Listing[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getListingById(id: string): Listing | null {
  return getListings().find((l) => l.id === id) ?? null;
}

export function getActiveListings(): Listing[] {
  return getListings().filter((l) => {
    if (l.status !== "ACTIVE") return false;
    if (l.end_time && new Date(l.end_time) <= new Date()) return false;
    return true;
  });
}

export function saveListing(listing: Listing): void {
  const all = getListings();
  const idx = all.findIndex((l) => l.id === listing.id);
  if (idx >= 0) {
    all[idx] = listing;
  } else {
    all.push(listing);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

// --- Bids ---

export function getBidsForListing(listingId: string): Bid[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(BIDS_STORAGE_KEY);
  if (!raw) return [];
  try {
    const allBids: Bid[] = JSON.parse(raw);
    return allBids
      .filter((b) => b.listing_id === listingId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch {
    return [];
  }
}

export interface PlaceBidResult {
  success: boolean;
  error?: string;
}

export function placeBid(
  listingId: string,
  bidderId: string,
  amount: number
): PlaceBidResult {
  // Import notifications lazily to avoid circular deps
  const {
    notifyBidPlaced,
    notifyHighestBidder,
    notifyOutbid,
    notifyNewBidReceived,
  } = require("./notifications");

  // Fetch latest listing
  const listing = getListingById(listingId);
  if (!listing) return { success: false, error: "Listing not found." };

  // Seller cannot bid on own item
  if (listing.seller_id === bidderId) {
    return { success: false, error: "You cannot bid on your own listing." };
  }

  // Auction must be active
  if (listing.status !== "ACTIVE") {
    return { success: false, error: "This auction is not active." };
  }

  // Must be before end_time
  if (new Date(listing.end_time) <= new Date()) {
    return { success: false, error: "This auction has ended." };
  }

  // Must be numeric and > 0
  if (isNaN(amount) || amount <= 0) {
    return { success: false, error: "Bid amount must be a number greater than 0." };
  }

  // Check bid points balance
  const { hasEnoughPoints, getBalance } = require("./wallet");
  if (!hasEnoughPoints(bidderId, amount)) {
    const balance = getBalance(bidderId);
    return {
      success: false,
      error: `Insufficient bid points. You need ${amount} points but have ${balance}. Please top up your wallet.`,
    };
  }

  const currentPrice = parseFloat(listing.current_price) || parseFloat(listing.starting_price);
  const minIncrement = parseFloat(listing.minimum_increment);
  const isFirstBid = !listing.highest_bidder_id;

  // Minimum bid calculation
  const minimumBid = isFirstBid ? currentPrice : currentPrice + minIncrement;

  if (amount < minimumBid) {
    return {
      success: false,
      error: `Bid must be at least ${formatCurrency(minimumBid)}. (current: ${formatCurrency(currentPrice)} + increment: ${formatCurrency(minIncrement)})`,
    };
  }

  // If user is already highest bidder with the same amount, reject
  if (listing.highest_bidder_id === bidderId && amount === currentPrice) {
    return { success: false, error: "You are already the highest bidder at this amount." };
  }

  // Remember previous highest bidder for outbid notification
  const previousHighestBidderId = listing.highest_bidder_id;

  // Insert bid record
  const bid: Bid = {
    id: crypto.randomUUID(),
    listing_id: listingId,
    bidder_id: bidderId,
    amount,
    created_at: new Date().toISOString(),
  };

  const allBidsRaw = localStorage.getItem(BIDS_STORAGE_KEY);
  const allBids: Bid[] = allBidsRaw ? JSON.parse(allBidsRaw) : [];
  allBids.push(bid);
  localStorage.setItem(BIDS_STORAGE_KEY, JSON.stringify(allBids));

  // Update listing
  listing.current_price = amount.toString();
  listing.highest_bidder_id = bidderId;
  listing.updated_at = new Date().toISOString();
  saveListing(listing);

  // --- Trigger notifications ---
  const amountStr = amount.toLocaleString("en-IN");

  // 1. Bid Placed Confirmation (to bidder)
  notifyBidPlaced(bidderId, listing.title, listingId, amountStr);

  // 2. You Are Highest Bidder (to bidder)
  notifyHighestBidder(bidderId, listing.title, listingId);

  // 3. You Have Been Outbid (to previous highest bidder, if different)
  if (previousHighestBidderId && previousHighestBidderId !== bidderId) {
    notifyOutbid(previousHighestBidderId, listing.title, listingId, amountStr);
  }

  // 7. New Bid Received (to seller)
  const bidderLabel = "Bidder " + bidderId.slice(0, 4) + "****";
  notifyNewBidReceived(listing.seller_id, listing.title, listingId, amountStr, bidderLabel);

  return { success: true };
}

export function formatCurrency(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function generateId(): string {
  return crypto.randomUUID();
}
