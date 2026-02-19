"use client";

import { useEffect } from "react";
import { getListings, getBidsForListing, getCurrentUserId } from "./listings";
import { notifyAuctionEndingSoon, markAndSend } from "./notifications";

/**
 * Client-side hook that checks for "ending soon" notifications.
 *
 * Auction end-of-life events (WON, LOST, point deduction) are handled
 * server-side by the pg_cron `end_expired_auctions()` function.
 * This hook only handles the "ending soon" alert which is time-sensitive
 * and benefits from client-side checking.
 */
export function useAuctionLifecycle() {
  useEffect(() => {
    async function check() {
      const userId = await getCurrentUserId();
      if (!userId) return;

      const listings = await getListings();
      const now = Date.now();

      for (const listing of listings) {
        if (listing.status !== "ACTIVE") continue;

        const endTime = new Date(listing.end_time).getTime();
        const timeRemaining = endTime - now;

        // Only check "ending soon" — everything else is server-side
        if (timeRemaining > 0 && timeRemaining <= 60 * 60 * 1000) {
          const bids = await getBidsForListing(listing.id);
          const userHasBid = bids.some((b) => b.bidder_id === userId);

          if (userHasBid) {
            markAndSend(`ending_soon_${listing.id}_${userId}`, () => {
              notifyAuctionEndingSoon(userId, listing.title, listing.id);
            });
          }
        }
      }
    }

    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, []);
}
