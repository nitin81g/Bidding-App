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

const STORAGE_KEY = "bidhub_notifications";

function getAllNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveAllNotifications(notifications: AppNotification[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

export function getNotificationsForUser(userId: string): AppNotification[] {
  return getAllNotifications()
    .filter((n) => n.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getUnreadCount(userId: string): number {
  return getAllNotifications().filter((n) => n.user_id === userId && !n.read).length;
}

export function markAsRead(notificationId: string): void {
  const all = getAllNotifications();
  const idx = all.findIndex((n) => n.id === notificationId);
  if (idx >= 0) {
    all[idx].read = true;
    saveAllNotifications(all);
  }
}

export function markAllAsRead(userId: string): void {
  const all = getAllNotifications();
  let changed = false;
  for (const n of all) {
    if (n.user_id === userId && !n.read) {
      n.read = true;
      changed = true;
    }
  }
  if (changed) saveAllNotifications(all);
}

export function addNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  listingId: string
): void {
  const all = getAllNotifications();
  all.push({
    id: crypto.randomUUID(),
    user_id: userId,
    type,
    title,
    message,
    listing_id: listingId,
    read: false,
    created_at: new Date().toISOString(),
  });
  saveAllNotifications(all);
}

// --- Notification trigger helpers ---

export function notifyBidPlaced(
  bidderId: string,
  listingTitle: string,
  listingId: string,
  amount: string
): void {
  addNotification(
    bidderId,
    "BID_PLACED",
    "Bid Placed",
    `Your bid of ₹${amount} on "${listingTitle}" was placed successfully.`,
    listingId
  );
}

export function notifyHighestBidder(
  bidderId: string,
  listingTitle: string,
  listingId: string
): void {
  addNotification(
    bidderId,
    "HIGHEST_BIDDER",
    "You Are the Highest Bidder",
    `You are now the highest bidder on "${listingTitle}".`,
    listingId
  );
}

export function notifyOutbid(
  previousBidderId: string,
  listingTitle: string,
  listingId: string,
  newAmount: string
): void {
  addNotification(
    previousBidderId,
    "OUTBID",
    "You Have Been Outbid",
    `Someone placed a bid of ₹${newAmount} on "${listingTitle}". Place a higher bid to stay in the lead!`,
    listingId
  );
}

export function notifyAuctionEndingSoon(
  bidderId: string,
  listingTitle: string,
  listingId: string
): void {
  addNotification(
    bidderId,
    "AUCTION_ENDING_SOON",
    "Auction Ending Soon",
    `The auction for "${listingTitle}" ends in less than 1 hour. Don't miss out!`,
    listingId
  );
}

export function notifyAuctionWon(
  winnerId: string,
  listingTitle: string,
  listingId: string,
  amount: string
): void {
  addNotification(
    winnerId,
    "AUCTION_WON",
    "Auction Won!",
    `Congratulations! You won the auction for "${listingTitle}" with a bid of ₹${amount}.`,
    listingId
  );
}

export function notifyAuctionLost(
  bidderId: string,
  listingTitle: string,
  listingId: string
): void {
  addNotification(
    bidderId,
    "AUCTION_LOST",
    "Auction Ended",
    `The auction for "${listingTitle}" has ended. Another bidder won.`,
    listingId
  );
}

export function notifyOrderConfirmed(
  winnerId: string,
  listingTitle: string,
  listingId: string,
  amount: string,
  email: string
): void {
  addNotification(
    winnerId,
    "ORDER_CONFIRMED",
    "Order Confirmed!",
    `Your order for "${listingTitle}" (₹${amount}) is confirmed. Confirmation sent to ${email || "your registered email"}.`,
    listingId
  );
}

export function notifyNewBidReceived(
  sellerId: string,
  listingTitle: string,
  listingId: string,
  amount: string,
  bidderLabel: string
): void {
  addNotification(
    sellerId,
    "NEW_BID_RECEIVED",
    "New Bid Received",
    `${bidderLabel} placed a bid of ₹${amount} on your listing "${listingTitle}".`,
    listingId
  );
}

// --- Lifecycle check keys (prevent duplicate time-based notifications) ---

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
