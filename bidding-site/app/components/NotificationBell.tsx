"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  getNotificationsForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  type AppNotification,
  type NotificationType,
} from "../lib/notifications";
import { getCurrentUserId } from "../lib/listings";

const ICON_MAP: Record<NotificationType, string> = {
  BID_PLACED: "✅",
  HIGHEST_BIDDER: "🏆",
  OUTBID: "⚠️",
  AUCTION_ENDING_SOON: "⏰",
  AUCTION_WON: "🎉",
  AUCTION_LOST: "😔",
  NEW_BID_RECEIVED: "💰",
  ORDER_CONFIRMED: "📦",
};

const COLOR_MAP: Record<NotificationType, string> = {
  BID_PLACED: "bg-primary/10 text-primary",
  HIGHEST_BIDDER: "bg-accent-green/10 text-accent-teal",
  OUTBID: "bg-accent-orange/10 text-accent-orange",
  AUCTION_ENDING_SOON: "bg-accent-red/10 text-accent-red",
  AUCTION_WON: "bg-accent-green/10 text-accent-teal",
  AUCTION_LOST: "bg-foreground-muted/10 text-foreground-muted",
  NEW_BID_RECEIVED: "bg-primary/10 text-primary",
  ORDER_CONFIRMED: "bg-accent-green/10 text-accent-teal",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "Just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadUserId() {
      const id = await getCurrentUserId();
      setUserId(id);
    }
    loadUserId();
  }, []);

  // Refresh notifications periodically
  useEffect(() => {
    async function refresh() {
      if (!userId) return;
      setNotifications(await getNotificationsForUser(userId));
      setUnreadCount(await getUnreadCount(userId));
    }
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [userId]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function handleToggle() {
    setIsOpen((prev) => !prev);
  }

  async function handleMarkAllRead() {
    if (!userId) return;
    await markAllAsRead(userId);
    setNotifications(await getNotificationsForUser(userId));
    setUnreadCount(0);
  }

  async function handleNotificationClick(n: AppNotification) {
    if (!n.read) {
      await markAsRead(n.id);
      setNotifications(await getNotificationsForUser(userId));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setIsOpen(false);
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={handleToggle}
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        aria-label="Notifications"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent-red px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-background-card shadow-[var(--shadow-lg)] sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-bold text-foreground-heading">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-3xl">🔔</div>
                <p className="mt-2 text-sm text-foreground-muted">
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.slice(0, 50).map((n) => (
                <Link
                  key={n.id}
                  href={`/auction/${n.listing_id}`}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex gap-3 border-b border-border-light px-4 py-3 transition-colors hover:bg-background-page ${
                    !n.read ? "bg-primary/[0.03]" : ""
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm ${COLOR_MAP[n.type]}`}
                  >
                    {ICON_MAP[n.type]}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm ${
                          !n.read
                            ? "font-semibold text-foreground-heading"
                            : "font-medium text-foreground"
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="mt-1 flex h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-foreground-muted">
                      {n.message}
                    </p>
                    <p className="mt-1 text-[10px] text-foreground-muted/70">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
