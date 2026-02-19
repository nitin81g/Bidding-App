-- ============================================================
-- BIDHUB — Supabase PostgreSQL Schema
-- Single-seller fashion auction platform
-- ============================================================
-- Run this file in the Supabase SQL Editor to set up the
-- entire database schema, RLS policies, functions & triggers.
-- ============================================================

-- ************************************************************
-- 1. CUSTOM ENUMS
-- ************************************************************

CREATE TYPE public.user_role AS ENUM ('admin', 'buyer');

CREATE TYPE public.auth_method AS ENUM ('google', 'mobile');

CREATE TYPE public.listing_category AS ENUM (
  'Jewellery', 'Clothing', 'Accessories', 'Shoes'
);

CREATE TYPE public.item_condition AS ENUM ('NEW', 'USED');

CREATE TYPE public.listing_status AS ENUM (
  'DRAFT', 'SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED'
);

CREATE TYPE public.notification_type AS ENUM (
  'BID_PLACED',
  'HIGHEST_BIDDER',
  'OUTBID',
  'AUCTION_ENDING_SOON',
  'AUCTION_WON',
  'AUCTION_LOST',
  'NEW_BID_RECEIVED',
  'ORDER_CONFIRMED'
);

CREATE TYPE public.transaction_type AS ENUM (
  'TOP_UP',
  'LISTING_FEE',
  'BID_DEDUCTION',
  'AUCTION_WIN_DEDUCTION',
  'REFUND'
);


-- ************************************************************
-- 2. TABLES
-- ************************************************************

-- --------------------------
-- 2.1 Profiles
-- --------------------------
-- Linked 1:1 to auth.users. Created automatically via trigger.

CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name   TEXT NOT NULL DEFAULT '',
  last_name    TEXT NOT NULL DEFAULT '',
  email        TEXT UNIQUE,
  mobile       TEXT UNIQUE,
  auth_method  public.auth_method NOT NULL DEFAULT 'google',
  role         public.user_role NOT NULL DEFAULT 'buyer',
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT profiles_contact_check
    CHECK (email IS NOT NULL OR mobile IS NOT NULL)
);

CREATE INDEX idx_profiles_email  ON public.profiles(email)  WHERE email  IS NOT NULL;
CREATE INDEX idx_profiles_mobile ON public.profiles(mobile) WHERE mobile IS NOT NULL;
CREATE INDEX idx_profiles_role   ON public.profiles(role);


-- --------------------------
-- 2.2 Wallets
-- --------------------------
-- One wallet per user. Balance can never go negative.

CREATE TABLE public.wallets (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance    NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0)
);


-- --------------------------
-- 2.3 Transactions
-- --------------------------
-- Immutable ledger of all point movements.
-- amount is signed: positive = credit, negative = debit.

CREATE TABLE public.transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        public.transaction_type NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  listing_id  UUID,                               -- FK added after listings table
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_user_id    ON public.transactions(user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX idx_transactions_type       ON public.transactions(type);


-- --------------------------
-- 2.4 Listings (Auctions)
-- --------------------------

CREATE TABLE public.listings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  category          public.listing_category NOT NULL,
  condition         public.item_condition NOT NULL,
  starting_price    NUMERIC(12,2) NOT NULL,
  minimum_increment NUMERIC(12,2) NOT NULL,
  current_price     NUMERIC(12,2) NOT NULL,
  highest_bidder_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  bid_count         INTEGER NOT NULL DEFAULT 0,
  start_time        TIMESTAMPTZ,                   -- nullable for DRAFTs
  end_time          TIMESTAMPTZ NOT NULL,
  status            public.listing_status NOT NULL DEFAULT 'DRAFT',
  images            TEXT[] NOT NULL DEFAULT '{}',   -- Supabase Storage URLs
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT listings_starting_price_positive CHECK (starting_price >= 1),
  CONSTRAINT listings_increment_positive      CHECK (minimum_increment >= 1),
  CONSTRAINT listings_current_price_valid     CHECK (current_price >= starting_price),
  CONSTRAINT listings_time_order              CHECK (start_time IS NULL OR end_time > start_time)
);

CREATE INDEX idx_listings_status           ON public.listings(status);
CREATE INDEX idx_listings_seller_id        ON public.listings(seller_id);
CREATE INDEX idx_listings_end_time         ON public.listings(end_time);
CREATE INDEX idx_listings_category         ON public.listings(category);
CREATE INDEX idx_listings_active_end_time  ON public.listings(status, end_time) WHERE status = 'ACTIVE';
CREATE INDEX idx_listings_highest_bidder   ON public.listings(highest_bidder_id) WHERE highest_bidder_id IS NOT NULL;


-- Add FK from transactions → listings (now that listings exists)
ALTER TABLE public.transactions
  ADD CONSTRAINT fk_transactions_listing
  FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_listing_id ON public.transactions(listing_id) WHERE listing_id IS NOT NULL;


-- --------------------------
-- 2.5 Bids
-- --------------------------
-- Append-only. No UPDATE or DELETE is ever allowed.

CREATE TABLE public.bids (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  bidder_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount     NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT bids_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_bids_listing_id       ON public.bids(listing_id);
CREATE INDEX idx_bids_bidder_id        ON public.bids(bidder_id);
CREATE INDEX idx_bids_created_at       ON public.bids(created_at DESC);
CREATE INDEX idx_bids_listing_created  ON public.bids(listing_id, created_at DESC);
CREATE INDEX idx_bids_listing_amount   ON public.bids(listing_id, amount DESC);


-- --------------------------
-- 2.6 Notifications
-- --------------------------

CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       public.notification_type NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id      ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_unread  ON public.notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_created_at   ON public.notifications(created_at DESC);


-- --------------------------
-- 2.7 Audit Logs
-- --------------------------

CREATE TABLE public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,    -- 'listing', 'bid', 'user', 'wallet'
  entity_id   UUID,
  details     JSONB DEFAULT '{}',
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor      ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity     ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);


-- ************************************************************
-- 3. TRIGGERS
-- ************************************************************

-- --------------------------
-- 3.1 Auto-update updated_at
-- --------------------------

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- --------------------------
-- 3.2 Auto-create profile + wallet on signup
-- --------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile from auth metadata
  INSERT INTO public.profiles (id, email, first_name, last_name, auth_method)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    CASE
      WHEN NEW.phone IS NOT NULL THEN 'mobile'::public.auth_method
      ELSE 'google'::public.auth_method
    END
  );

  -- Create wallet with zero balance
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ************************************************************
-- 4. DATABASE FUNCTIONS (Atomic operations)
-- ************************************************************

-- --------------------------
-- 4.1 Place Bid (atomic, race-condition-safe)
-- --------------------------
-- Locks the listing row, validates all rules, inserts bid,
-- and updates the listing — all in one transaction.

CREATE OR REPLACE FUNCTION public.place_bid(
  p_listing_id UUID,
  p_bidder_id  UUID,
  p_amount     NUMERIC(12,2)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing        public.listings%ROWTYPE;
  v_wallet_balance NUMERIC(12,2);
  v_is_first_bid   BOOLEAN;
  v_minimum_bid    NUMERIC(12,2);
  v_prev_highest   UUID;
  v_bid_id         UUID;
  v_bidder_suspended BOOLEAN;
BEGIN
  -- Check bidder is not suspended
  SELECT is_suspended INTO v_bidder_suspended
  FROM public.profiles WHERE id = p_bidder_id;

  IF v_bidder_suspended IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your account is suspended.');
  END IF;

  -- 1. Lock the listing row (prevents concurrent bid race conditions)
  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found.');
  END IF;

  -- 2. Seller cannot bid on own item
  IF v_listing.seller_id = p_bidder_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot bid on your own listing.');
  END IF;

  -- 3. Auction must be ACTIVE
  IF v_listing.status != 'ACTIVE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This auction is not active.');
  END IF;

  -- 4. Must be before end_time
  IF v_listing.end_time <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This auction has ended.');
  END IF;

  -- 5. Validate amount is positive
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bid amount must be greater than 0.');
  END IF;

  -- 6. Check wallet balance (lock wallet row too)
  SELECT balance INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = p_bidder_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL OR v_wallet_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Insufficient bid points. You need %s but have %s.',
                      p_amount, COALESCE(v_wallet_balance, 0))
    );
  END IF;

  -- 7. Calculate minimum valid bid
  v_is_first_bid := (v_listing.highest_bidder_id IS NULL);

  IF v_is_first_bid THEN
    v_minimum_bid := v_listing.current_price;       -- >= starting price
  ELSE
    v_minimum_bid := v_listing.current_price + v_listing.minimum_increment;
  END IF;

  IF p_amount < v_minimum_bid THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Bid must be at least %s.', v_minimum_bid)
    );
  END IF;

  -- 8. Reject if already highest bidder at same amount
  IF v_listing.highest_bidder_id = p_bidder_id AND p_amount = v_listing.current_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already the highest bidder at this amount.');
  END IF;

  -- Remember previous highest bidder (for OUTBID notification)
  v_prev_highest := v_listing.highest_bidder_id;

  -- 9. Insert bid record (immutable, append-only)
  v_bid_id := gen_random_uuid();
  INSERT INTO public.bids (id, listing_id, bidder_id, amount)
  VALUES (v_bid_id, p_listing_id, p_bidder_id, p_amount);

  -- 10. Update listing with new highest bid
  UPDATE public.listings
  SET current_price     = p_amount,
      highest_bidder_id = p_bidder_id,
      bid_count         = bid_count + 1
  WHERE id = p_listing_id;

  -- 11. Return success with context for app-layer notifications
  RETURN jsonb_build_object(
    'success', true,
    'bid_id', v_bid_id,
    'previous_highest_bidder_id', v_prev_highest,
    'listing_title', v_listing.title,
    'seller_id', v_listing.seller_id
  );
END;
$$;


-- --------------------------
-- 4.2 Activate Listing (with fee deduction)
-- --------------------------
-- Atomically deducts 100-point listing fee and sets status to ACTIVE.

CREATE OR REPLACE FUNCTION public.activate_listing(
  p_listing_id UUID,
  p_user_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_listing public.listings%ROWTYPE;
  v_balance NUMERIC(12,2);
  v_fee     NUMERIC(12,2) := 100;
BEGIN
  -- Lock listing
  SELECT * INTO v_listing
  FROM public.listings WHERE id = p_listing_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found.');
  END IF;

  IF v_listing.seller_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not own this listing.');
  END IF;

  IF v_listing.status != 'DRAFT' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only draft listings can be activated.');
  END IF;

  -- Check wallet balance
  SELECT balance INTO v_balance
  FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < v_fee THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Listing fee is %s points. Your balance is %s.', v_fee, COALESCE(v_balance, 0)));
  END IF;

  -- Deduct fee
  UPDATE public.wallets SET balance = balance - v_fee WHERE user_id = p_user_id;

  -- Record transaction
  INSERT INTO public.transactions (user_id, type, amount, description, listing_id)
  VALUES (p_user_id, 'LISTING_FEE', -v_fee, format('Listing fee: "%s"', v_listing.title), p_listing_id);

  -- Activate listing
  UPDATE public.listings SET status = 'ACTIVE' WHERE id = p_listing_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- --------------------------
-- 4.3 End Expired Auctions
-- --------------------------
-- Called by pg_cron every minute. Closes auctions past their
-- end_time, deducts winner points, and sends notifications.

CREATE OR REPLACE FUNCTION public.end_expired_auctions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count   INTEGER := 0;
  v_listing RECORD;
BEGIN
  FOR v_listing IN
    SELECT id, title, highest_bidder_id, current_price, seller_id
    FROM public.listings
    WHERE status = 'ACTIVE' AND end_time <= now()
    FOR UPDATE SKIP LOCKED   -- skip rows locked by concurrent bids
  LOOP
    -- Mark auction as ENDED
    UPDATE public.listings SET status = 'ENDED' WHERE id = v_listing.id;

    -- If there is a winner, deduct their wallet and notify
    IF v_listing.highest_bidder_id IS NOT NULL THEN
      UPDATE public.wallets
      SET balance = balance - v_listing.current_price
      WHERE user_id = v_listing.highest_bidder_id
        AND balance >= v_listing.current_price;

      INSERT INTO public.transactions (user_id, type, amount, description, listing_id)
      VALUES (
        v_listing.highest_bidder_id,
        'AUCTION_WIN_DEDUCTION',
        -v_listing.current_price,
        format('Won auction: "%s"', v_listing.title),
        v_listing.id
      );

      -- Notify winner
      INSERT INTO public.notifications (user_id, type, title, message, listing_id)
      VALUES (
        v_listing.highest_bidder_id,
        'AUCTION_WON',
        'Auction Won!',
        format('Congratulations! You won "%s" with a bid of %s.', v_listing.title, v_listing.current_price),
        v_listing.id
      );

      -- Order confirmed notification
      INSERT INTO public.notifications (user_id, type, title, message, listing_id)
      VALUES (
        v_listing.highest_bidder_id,
        'ORDER_CONFIRMED',
        'Order Confirmed',
        format('Your order for "%s" has been confirmed.', v_listing.title),
        v_listing.id
      );
    END IF;

    -- Notify all other bidders that they lost
    INSERT INTO public.notifications (user_id, type, title, message, listing_id)
    SELECT DISTINCT
      b.bidder_id,
      'AUCTION_LOST',
      'Auction Ended',
      format('The auction for "%s" has ended. You did not win.', v_listing.title),
      v_listing.id
    FROM public.bids b
    WHERE b.listing_id = v_listing.id
      AND b.bidder_id != COALESCE(v_listing.highest_bidder_id, '00000000-0000-0000-0000-000000000000'::UUID);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


-- ************************************************************
-- 5. ROW LEVEL SECURITY (RLS)
-- ************************************************************

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs    ENABLE ROW LEVEL SECURITY;

-- --------------------------
-- PROFILES
-- --------------------------

-- Anyone can read profiles (bidder names, seller info)
CREATE POLICY "Profiles: public read"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Profiles: self update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- --------------------------
-- WALLETS
-- --------------------------

-- Users can only view their own wallet
CREATE POLICY "Wallets: self read"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies — all writes via SECURITY DEFINER functions

-- --------------------------
-- TRANSACTIONS
-- --------------------------

-- Users can only view their own transactions
CREATE POLICY "Transactions: self read"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- --------------------------
-- LISTINGS
-- --------------------------

-- Anyone can read active/ended listings; sellers see their own drafts
CREATE POLICY "Listings: public read"
  ON public.listings FOR SELECT
  USING (status IN ('ACTIVE', 'ENDED') OR seller_id = auth.uid());

-- Sellers can create their own listings
CREATE POLICY "Listings: seller insert"
  ON public.listings FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

-- Sellers can update their own listings
CREATE POLICY "Listings: seller update"
  ON public.listings FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Admin has full access to all listings
CREATE POLICY "Listings: admin full access"
  ON public.listings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- --------------------------
-- BIDS
-- --------------------------

-- Anyone can read bids (bid history is public)
CREATE POLICY "Bids: public read"
  ON public.bids FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE — all bid creation via place_bid() function

-- --------------------------
-- NOTIFICATIONS
-- --------------------------

-- Users can read their own notifications
CREATE POLICY "Notifications: self read"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "Notifications: self update"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- --------------------------
-- AUDIT LOGS
-- --------------------------

-- Only admins can read audit logs
CREATE POLICY "Audit logs: admin read"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ************************************************************
-- 6. REALTIME
-- ************************************************************

-- Enable realtime subscriptions for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.listings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- ************************************************************
-- 7. STORAGE (run in Supabase Dashboard or via API)
-- ************************************************************

-- Create bucket for listing images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-images',
  'listing-images',
  true,
  5242880,    -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Anyone can view listing images
CREATE POLICY "Listing images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-images');

-- Authenticated users can upload images
CREATE POLICY "Listing images: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'listing-images'
    AND auth.role() = 'authenticated'
  );

-- Uploaders can delete their own images
CREATE POLICY "Listing images: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ************************************************************
-- 8. SCHEDULED JOBS (requires pg_cron extension)
-- ************************************************************

-- End expired auctions every minute
-- Note: pg_cron must be enabled in Supabase Dashboard > Database > Extensions
-- SELECT cron.schedule(
--   'end-expired-auctions',
--   '* * * * *',
--   $$SELECT public.end_expired_auctions()$$
-- );
