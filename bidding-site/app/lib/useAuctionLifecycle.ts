"use client";

import { useEffect } from "react";
import { getListings, getBidsForListing, getCurrentUserId } from "./listings";
import {
  notifyAuctionEndingSoon,
  notifyAuctionWon,
  notifyAuctionLost,
  notifyOrderConfirmed,
  markAndSend,
} from "./notifications";
import { debitPoints } from "./wallet";
import { getCurrentUser } from "./auth";

/**
 * Checks all auctions for lifecycle events and sends notifications:
 * - Auction Ending Soon (< 1 hour remaining, user has bid)
 * - Auction Won (ended, user is highest bidder)
 * - Auction Lost (ended, user bid but is not the highest bidder)
 *
 * Uses deduplication keys to avoid sending the same notification twice.
 */
export function useAuctionLifecycle() {
  useEffect(() => {
    function check() {
      const userId = getCurrentUserId();
      if (!userId) return;

      const listings = getListings();
      const now = Date.now();

      for (const listing of listings) {
        if (listing.status !== "ACTIVE") continue;

        const endTime = new Date(listing.end_time).getTime();
        const timeRemaining = endTime - now;
        const bids = getBidsForListing(listing.id);
        const userBids = bids.filter((b) => b.bidder_id === userId);
        const userHasBid = userBids.length > 0;
        const isSeller = listing.seller_id === userId;

        // 4. Auction Ending Soon — less than 1 hour remaining, user has bid
        if (
          userHasBid &&
          timeRemaining > 0 &&
          timeRemaining <= 60 * 60 * 1000
        ) {
          markAndSend(`ending_soon_${listing.id}_${userId}`, () => {
            notifyAuctionEndingSoon(userId, listing.title, listing.id);
          });
        }

        // Auction has ended
        if (timeRemaining <= 0) {
          const winnerId = listing.highest_bidder_id;

          // 5. Auction Won — user is the highest bidder
          if (winnerId === userId) {
            const winAmount =
              listing.current_price || listing.starting_price;
            const winAmountNum = parseFloat(winAmount);
            const winAmountStr = winAmountNum.toLocaleString("en-IN");
            markAndSend(`auction_won_${listing.id}_${userId}`, () => {
              notifyAuctionWon(
                userId,
                listing.title,
                listing.id,
                winAmountStr
              );

              // Deduct bid points from winner
              debitPoints(
                userId,
                winAmountNum,
                `Won auction: "${listing.title}"`
              );

              // Send order confirmation
              const currentUser = getCurrentUser();
              const email = currentUser?.email || "";
              notifyOrderConfirmed(
                userId,
                listing.title,
                listing.id,
                winAmountStr,
                email
              );
            });
          }

          // 6. Auction Lost — user bid but didn't win
          if (userHasBid && winnerId !== userId && !isSeller) {
            markAndSend(`auction_lost_${listing.id}_${userId}`, () => {
              notifyAuctionLost(userId, listing.title, listing.id);
            });
          }
        }
      }
    }

    check();
    const interval = setInterval(check, 30_000); // check every 30 seconds
    return () => clearInterval(interval);
  }, []);
}
