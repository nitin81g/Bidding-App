import { createClient } from "./supabase/client";

export type NotificationType =
  | "BID_PLACED"
  | "HIGHEST_BIDDER"
  | "OUTBID"
  | "AUCTION_ENDING_SOON"
  | "AUCTION_WON"
  | "AUCTION_LOST"
  | "NEW_BID_RECEIVED"
  | "ORDER_CONFIRMED";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  listing_id: string;
  read: boolean;
  created_at: string;
}

export async function getNotificationsForUser(userId: string): Promise<AppNotification[]> {
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return (data || []) as AppNotification[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (!userId) return 0;
  const supabase = createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  return count || 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);
}

export async function markAllAsRead(userId: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
}

export async function addNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  listingId: string
): Promise<void> {
  const supabase = createClient();
  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    listing_id: listingId,
    read: false,
  });
}

// --- Notification trigger helpers ---

export async function notifyBidPlaced(
  bidderId: string,
  listingTitle: string,
  listingId: string,
  amount: string
): Promise<void> {
  await addNotification(
    bidderId,
    "BID_PLACED",
    "Bid Placed",
    `Your bid of ₹${amount} on "${listingTitle}" was placed successfully.`,
    listingId
  );
}

export async function notifyHighestBidder(
  bidderId: string,
  listingTitle: string,
  listingId: string
): Promise<void> {
  await addNotification(
    bidderId,
    "HIGHEST_BIDDER",
    "You Are the Highest Bidder",
    `You are now the highest bidder on "${listingTitle}".`,
    listingId
  );
}

export async function notifyOutbid(
  previousBidderId: string,
  listingTitle: string,
  listingId: string,
  newAmount: string
): Promise<void> {
  await addNotification(
    previousBidderId,
    "OUTBID",
    "You Have Been Outbid",
    `Someone placed a bid of ₹${newAmount} on "${listingTitle}". Place a higher bid to stay in the lead!`,
    listingId
  );
}

export async function notifyAuctionEndingSoon(
  bidderId: string,
  listingTitle: string,
  listingId: string
): Promise<void> {
  await addNotification(
    bidderId,
    "AUCTION_ENDING_SOON",
    "Auction Ending Soon",
    `The auction for "${listingTitle}" ends in less than 1 hour. Don't miss out!`,
    listingId
  );
}

export async function notifyAuctionWon(
  winnerId: string,
  listingTitle: string,
  listingId: string,
  amount: string
): Promise<void> {
  await addNotification(
    winnerId,
    "AUCTION_WON",
    "Auction Won!",
    `Congratulations! You won the auction for "${listingTitle}" with a bid of ₹${amount}.`,
    listingId
  );
}

export async function notifyAuctionLost(
  bidderId: string,
  listingTitle: string,
  listingId: string
): Promise<void> {
  await addNotification(
    bidderId,
    "AUCTION_LOST",
    "Auction Ended",
    `The auction for "${listingTitle}" has ended. Another bidder won.`,
    listingId
  );
}

export async function notifyOrderConfirmed(
  winnerId: string,
  listingTitle: string,
  listingId: string,
  amount: string,
  email: string
): Promise<void> {
  await addNotification(
    winnerId,
    "ORDER_CONFIRMED",
    "Order Confirmed!",
    `Your order for "${listingTitle}" (₹${amount}) is confirmed. Confirmation sent to ${email || "your registered email"}.`,
    listingId
  );
}

export async function notifyNewBidReceived(
  sellerId: string,
  listingTitle: string,
  listingId: string,
  amount: string,
  bidderLabel: string
): Promise<void> {
  await addNotification(
    sellerId,
    "NEW_BID_RECEIVED",
    "New Bid Received",
    `${bidderLabel} placed a bid of ₹${amount} on your listing "${listingTitle}".`,
    listingId
  );
}

// Lifecycle dedup is handled server-side by pg_cron end_expired_auctions().
// These are kept for the useAuctionLifecycle hook (client-side ending-soon only).
const LIFECYCLE_KEY = "bidhub_lifecycle_sent";

interface LifecycleSent {
  [key: string]: boolean;
}

function getLifecycleSent(): LifecycleSent {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(LIFECYCLE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function markLifecycleSent(key: string): void {
  const sent = getLifecycleSent();
  sent[key] = true;
  localStorage.setItem(LIFECYCLE_KEY, JSON.stringify(sent));
}

export function wasLifecycleSent(key: string): boolean {
  return getLifecycleSent()[key] === true;
}

export function markAndSend(key: string, fn: () => void): void {
  if (wasLifecycleSent(key)) return;
  fn();
  markLifecycleSent(key);
}
