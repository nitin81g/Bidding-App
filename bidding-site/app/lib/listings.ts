import { createClient } from "./supabase/client";
import {
  notifyBidPlaced,
  notifyHighestBidder,
  notifyOutbid,
  notifyNewBidReceived,
} from "./notifications";

export type Condition = "NEW" | "USED";
export type ListingStatus = "DRAFT" | "ACTIVE" | "ENDED" | "SCHEDULED" | "CANCELLED";

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
  bid_count?: number;
  end_time: string;
  status: ListingStatus;
  images: string[];
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

// Get current user ID from Supabase Auth session
export async function getCurrentUserId(): Promise<string> {
  if (typeof window === "undefined") return "";
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || "";
}

export async function getListings(): Promise<Listing[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("listings")
    .select("*")
    .order("created_at", { ascending: false });

  return (data || []).map(mapDbListing);
}

export async function getListingById(id: string): Promise<Listing | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .single();

  return data ? mapDbListing(data) : null;
}

export async function getActiveListings(): Promise<Listing[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("status", "ACTIVE")
    .gt("end_time", new Date().toISOString())
    .order("created_at", { ascending: false });

  return (data || []).map(mapDbListing);
}

export async function saveListing(listing: Listing): Promise<void> {
  const supabase = createClient();

  const dbListing = {
    id: listing.id,
    seller_id: listing.seller_id,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    condition: listing.condition || "NEW",
    starting_price: parseFloat(listing.starting_price) || 0,
    minimum_increment: parseFloat(listing.minimum_increment) || 0,
    current_price: parseFloat(listing.current_price) || parseFloat(listing.starting_price) || 0,
    highest_bidder_id: listing.highest_bidder_id || null,
    end_time: listing.end_time,
    status: listing.status,
    images: listing.images,
  };

  await supabase.from("listings").upsert(dbListing);
}

// --- Bids ---

export async function getBidsForListing(listingId: string): Promise<Bid[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("bids")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false });

  return (data || []).map((b) => ({
    ...b,
    amount: Number(b.amount),
  }));
}

export interface PlaceBidResult {
  success: boolean;
  error?: string;
}

// Place bid via the atomic database function
export async function placeBid(
  listingId: string,
  bidderId: string,
  amount: number
): Promise<PlaceBidResult> {
  const supabase = createClient();

  // Call the atomic place_bid database function
  const { data, error } = await supabase.rpc("place_bid", {
    p_listing_id: listingId,
    p_bidder_id: bidderId,
    p_amount: amount,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const result = data as {
    success: boolean;
    error?: string;
    bid_id?: string;
    previous_highest_bidder_id?: string | null;
    listing_title?: string;
    seller_id?: string;
  };

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Send notifications (non-critical, fire-and-forget)
  const amountStr = amount.toLocaleString("en-IN");

  notifyBidPlaced(bidderId, result.listing_title || "", listingId, amountStr);
  notifyHighestBidder(bidderId, result.listing_title || "", listingId);

  if (result.previous_highest_bidder_id && result.previous_highest_bidder_id !== bidderId) {
    notifyOutbid(result.previous_highest_bidder_id, result.listing_title || "", listingId, amountStr);
  }

  if (result.seller_id) {
    const bidderLabel = "Bidder " + bidderId.slice(0, 4) + "****";
    notifyNewBidReceived(result.seller_id, result.listing_title || "", listingId, amountStr, bidderLabel);
  }

  return { success: true };
}

export function formatCurrency(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function generateId(): string {
  return crypto.randomUUID();
}

// Map database row (NUMERIC fields) to the Listing interface (string fields)
function mapDbListing(row: Record<string, unknown>): Listing {
  return {
    id: row.id as string,
    seller_id: row.seller_id as string,
    title: row.title as string,
    description: (row.description as string) || "",
    category: row.category as string,
    condition: (row.condition as Condition) || "",
    starting_price: String(row.starting_price),
    minimum_increment: String(row.minimum_increment),
    current_price: String(row.current_price),
    highest_bidder_id: (row.highest_bidder_id as string) || null,
    bid_count: (row.bid_count as number) || 0,
    end_time: row.end_time as string,
    status: row.status as ListingStatus,
    images: (row.images as string[]) || [],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}
