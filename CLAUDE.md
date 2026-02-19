# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bidding App — a Next.js 16 web application using the App Router pattern. The main application code lives in the `bidding-site/` subdirectory.

# PROJECT CONTEXT: SINGLE-SELLER FASHION AUCTION PLATFORM (NO PAYMENTS)

------------------------------------------------------------
1. PROJECT OVERVIEW
------------------------------------------------------------

This project is a mobile-first responsive web application that allows a single seller (platform owner) to publish fashion-related items for auction-style bidding.

There is only ONE seller account (admin-controlled).
Multiple buyers can register and place bids.

This version DOES NOT include:
- Payment processing
- Commission logic
- Escrow system
- Multi-vendor features
- Shipping workflow

The purpose of this phase is to build a clean, scalable, real-time bidding engine with strong architecture and UI/UX best practices.

This is NOT a simple e-commerce store.
This is a time-bound auction system.

------------------------------------------------------------
2. USER ROLES
------------------------------------------------------------

1) Admin (Platform Owner / Seller)
2) Buyer (Bidder)
3) System (Automated auction engine)

------------------------------------------------------------
3. ROLE CAPABILITIES
------------------------------------------------------------

--------------------
ADMIN
--------------------

Admin is the only seller.

Admin can:
- Create auction listing
- Edit auction (before bids exist)
- Cancel auction (before bids exist)
- View all bids
- View all users
- Suspend users
- Force close auction
- Configure system settings:
    - Minimum increment
    - Allowed auction durations
    - Bid time extensions (optional)
- Access audit logs

Admin CANNOT:
- Modify bid history
- Change auction rules after first bid

--------------------
BUYER
--------------------

Buyer can:
- Register / Login
- Update profile
- Browse auctions
- View auction details
- Place bid
- Increase bid
- View own bidding history
- See if they are highest bidder
- Receive notifications when outbid

Buyer CANNOT:
- Cancel bid
- Reduce bid
- Edit other users' data
- Bid after auction ends

--------------------
SYSTEM
--------------------

System automatically:
- Validates bids
- Rejects invalid bids
- Locks auction at end time
- Determines winner
- Updates auction status
- Sends notifications

------------------------------------------------------------
4. AUCTION RULES (STRICT BUSINESS LOGIC)
------------------------------------------------------------

1. Auction must have:
   - Title
   - Description
   - Images
   - Base price
   - Increment amount
   - Start time
   - End time

2. A valid bid must be:
   - >= base price (if first bid)
   - >= current highest bid + increment

3. Bids:
   - Cannot be deleted
   - Cannot be modified
   - Cannot be reduced
   - Are timestamped and immutable

4. Auction lifecycle states:
   - DRAFT
   - SCHEDULED
   - LIVE
   - ENDED
   - CANCELLED

5. After auction ends:
   - Highest valid bid wins
   - Auction becomes read-only

6. Once first bid is placed:
   - Admin cannot edit base price
   - Admin cannot edit increment
   - Admin cannot change end time

7. Concurrency protection is REQUIRED.
   The system must prevent race conditions when multiple bids occur at the same time.

------------------------------------------------------------
5. UI / UX PRINCIPLES (MANDATORY DESIGN GUIDELINES)
------------------------------------------------------------

This application is MOBILE-FIRST.

Design must prioritize:
- Touch-friendly buttons
- Large tap areas
- Clear visual hierarchy
- Fast loading
- Clean typography
- Minimal clutter

--------------------
AUCTION DETAIL PAGE MUST INCLUDE:
--------------------
- Image carousel
- Title
- Current highest bid (large & bold)
- Countdown timer (real-time)
- Bid increment info
- Place Bid button (sticky on mobile)
- Bid history section
- Auction status indicator

--------------------
UX REQUIREMENTS
--------------------
- Immediate visual feedback when bid is placed
- Real-time update if outbid
- Clear validation error if bid is invalid
- Disable bid button when auction ends
- Clear “You are highest bidder” indicator
- Show masked bidder names in history

--------------------
STYLING GUIDELINES
--------------------
- Clean modern UI
- Neutral background colors
- Primary accent color for CTA
- Soft shadows for cards
- Rounded corners (8–16px)
- Use consistent spacing scale
- Avoid overcrowded layouts
- Avoid excessive animations

Performance:
- Page load < 3 seconds
- Minimal blocking scripts
- Lazy load images

------------------------------------------------------------
6. PROJECT ARCHITECTURE (HIGH-LEVEL)
------------------------------------------------------------

Preferred Structure:

Frontend:
- React or Next.js
- Component-based architecture
- State management for live bidding

Backend:
- Node.js (Express) OR Django
- RESTful APIs
- WebSocket for real-time bidding updates

Architecture separation:

- Auth Module
- User Module
- Auction Module
- Bid Engine
- Notification Module
- Admin Module

Auction logic MUST be server-side.
Frontend must never determine winning bid.

------------------------------------------------------------
7. DATA ARCHITECTURE
------------------------------------------------------------

Core Entities:

User
- id
- email
- password_hash
- role
- status
- created_at

Auction
- id
- title
- description
- base_price
- increment
- start_time
- end_time
- status
- created_at

Bid
- id
- auction_id
- user_id
- amount
- created_at

Indexes Required:
- auction_id (Bid table)
- user_id (Bid table)
- created_at
- auction status

All bids must be immutable.

Use database transactions when placing bids.

------------------------------------------------------------
8. BID ENGINE REQUIREMENTS
------------------------------------------------------------

When placing a bid:

1. Lock auction row
2. Fetch current highest bid
3. Validate new bid amount
4. Insert bid record
5. Update auction current price
6. Commit transaction

Must prevent:
- Double bids
- Lost updates
- Race conditions

Use server-side validation always.

------------------------------------------------------------
9. SECURITY REQUIREMENTS
------------------------------------------------------------

- JWT or secure session authentication
- Password hashing (bcrypt or equivalent)
- Rate limit bidding endpoint
- Validate all inputs
- Prevent SQL injection
- Prevent XSS
- Prevent CSRF
- Use HTTPS only
- Log all bid attempts

------------------------------------------------------------
10. PERFORMANCE REQUIREMENTS
------------------------------------------------------------

System must handle:
- Multiple concurrent auctions
- Simultaneous bids
- Real-time updates under 1 second latency

Bid submission must be atomic.

Use:
- Database transactions
- WebSockets for live updates
- Proper indexing

------------------------------------------------------------
11. DEVELOPMENT STANDARDS
------------------------------------------------------------

When generating code:

- Use clean, modular functions
- Add comments explaining auction logic
- Avoid monolithic files
- Follow REST conventions
- Return structured JSON responses
- Use meaningful variable names
- Separate business logic from controllers

Example API design:

POST /api/auctions
GET /api/auctions
GET /api/auctions/:id
POST /api/auctions/:id/bid
GET /api/auctions/:id/bids

------------------------------------------------------------
12. ADMIN PANEL REQUIREMENTS
------------------------------------------------------------

Admin dashboard must show:

- Active auctions
- Scheduled auctions
- Ended auctions
- Total bids per auction
- User list
- Audit logs

Admin can:
- Create auction
- Schedule auction
- Cancel auction
- Force end auction
- Suspend user

------------------------------------------------------------
13. BUSINESS PRIORITIES
------------------------------------------------------------

When making design decisions, prioritize:

1. Auction fairness
2. Data integrity
3. Concurrency safety
4. Clean UX
5. Scalability readiness

Never oversimplify bid logic.

------------------------------------------------------------
14. WHAT THIS PROJECT IS NOT
------------------------------------------------------------

- Not an e-commerce checkout system
- Not a marketplace
- Not a payment processor
- Not a messaging platform

It is a time-based competitive bidding system.

------------------------------------------------------------
15. OUTPUT EXPECTATION FROM CLAUDE
------------------------------------------------------------

When generating responses:

- Think like a senior backend engineer.
- Think like a product architect.
- Highlight race condition risks.
- Suggest improvements if needed.
- Do not generate toy examples unless requested.
- Prefer production-ready patterns.

Correctness > simplicity.
Security > speed of implementation.
Architecture clarity > quick hacks.

------------------------------------------------------------

END OF PROJECT CONTEXT

## Commands

All commands must be run from the `bidding-site/` directory:

```bash
cd bidding-site

npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm start         # Start production server
npm run lint     # Run ESLint (flat config, ESLint 9)
```

No test framework is configured yet.

## Architecture

- **Framework**: Next.js 16.1.6 with App Router (server components by default)
- **Language**: TypeScript 5 (strict mode)
- **UI**: React 19, Tailwind CSS 4
- **Path alias**: `@/*` maps to the project root

### Directory Structure (inside `bidding-site/`)

- `app/` — Next.js App Router: pages, layouts, and global styles
- `app/layout.tsx` — Root layout (Geist font family)
- `app/page.tsx` — Home page
- `app/globals.css` — Global styles, Tailwind imports, CSS custom properties for theming
- `public/` — Static assets

### Key Config Files

- `tsconfig.json` — TypeScript config (target ES2017, bundler module resolution)
- `eslint.config.mjs` — ESLint 9 flat config extending `next/core-web-vitals` and `next/typescript`
- `next.config.ts` — Next.js configuration
- `postcss.config.mjs` — PostCSS with `@tailwindcss/postcss` plugin

## Color Theme (MakeMyTrip-inspired)

All colors are defined as CSS custom properties in `globals.css` and registered with Tailwind via `@theme inline`.

| Token | Light | Dark | Tailwind Class |
|---|---|---|---|
| Primary | `#008cff` | same | `text-primary`, `bg-primary` |
| Primary Dark | `#065af3` | same | `text-primary-dark`, `bg-primary-dark` |
| Primary Light | `#53b2fe` | same | `text-primary-light`, `bg-primary-light` |
| Background | `#ffffff` | `#0d1b2a` | `bg-background` |
| Page Background | `#f2f2f2` | `#051322` | `bg-background-page` |
| Card Background | `#ffffff` | `#122a42` | `bg-background-card` |
| Body Text | `#4a4a4a` | `#d4dde8` | `text-foreground` |
| Heading Text | `#000000` | `#ffffff` | `text-foreground-heading` |
| Muted Text | `#9b9b9b` | `#7a8fa3` | `text-foreground-muted` |
| Accent Orange | `#ff664b` | same | `text-accent-orange` |
| Accent Red | `#eb2026` | same | `text-accent-red` |
| Accent Green | `#ace143` | same | `text-accent-green` |
| Accent Teal | `#219393` | same | `text-accent-teal` |
| Border | `#e7e7e7` | `#1e3a54` | `border-border` |

**Gradient utility classes** (defined in `globals.css`, not Tailwind):
- `.bg-gradient-primary` — blue CTA gradient (`#53b2fe → #065af3`)
- `.bg-gradient-hero` — dark blue hero sections (`#051322 → #15457c`)
- `.bg-gradient-accent` — orange-red tags/badges (`#ff684a → #ff4959`)

**Shadow tokens** (use via inline style `shadow-[var(--shadow-sm)]`):
- `--shadow-sm`, `--shadow-md`, `--shadow-lg`

## Conventions

- Client components require the `"use client"` directive at the top of the file
- Tailwind CSS 4 uses `@import "tailwindcss"` in CSS (not the v3 `@tailwind` directives)
- Dark mode is handled via `prefers-color-scheme` media query with CSS custom properties
- Use the defined color tokens (e.g. `bg-primary`, `text-foreground-muted`) instead of raw hex values
- Use `.bg-gradient-primary` / `.bg-gradient-hero` / `.bg-gradient-accent` for gradient backgrounds
