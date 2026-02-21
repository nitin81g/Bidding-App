-- ============================================================
-- BIDHUB — Full Database Reset & Recreate
-- ============================================================
-- This script DROPS all existing BidHub objects and recreates
-- them from scratch. Safe to run multiple times.
--
-- WARNING: This will DELETE all existing data (users, listings,
-- bids, wallets, transactions, notifications).
-- ============================================================


-- ************************************************************
-- 0. DROP EVERYTHING (in reverse dependency order)
-- ************************************************************

-- Drop storage policies (bucket must be deleted via Supabase Dashboard/API)
DROP POLICY IF EXISTS "Listing images: public read" ON storage.objects;
DROP POLICY IF EXISTS "Listing images: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Listing images: owner delete" ON storage.objects;

-- Drop realtime publications (safe: do nothing if not added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.bids;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.listings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop all policies
DROP POLICY IF EXISTS "Audit logs: admin read" ON public.audit_logs;
DROP POLICY IF EXISTS "Notifications: authenticated insert" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: self update" ON public.notifications;
DROP POLICY IF EXISTS "Notifications: self read" ON public.notifications;
DROP POLICY IF EXISTS "Bids: public read" ON public.bids;
DROP POLICY IF EXISTS "Listings: admin full access" ON public.listings;
DROP POLICY IF EXISTS "Listings: seller update" ON public.listings;
DROP POLICY IF EXISTS "Listings: seller insert" ON public.listings;
DROP POLICY IF EXISTS "Listings: public read" ON public.listings;
DROP POLICY IF EXISTS "Transactions: self read" ON public.transactions;
DROP POLICY IF EXISTS "Wallets: self read" ON public.wallets;
DROP POLICY IF EXISTS "Profiles: self update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: public read" ON public.profiles;

-- Drop functions
DROP FUNCTION IF EXISTS public.credit_wallet(UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.debit_wallet(UUID, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.end_expired_auctions();
DROP FUNCTION IF EXISTS public.activate_listing(UUID, UUID);
DROP FUNCTION IF EXISTS public.place_bid(UUID, UUID, NUMERIC);

-- Drop triggers
DROP TRIGGER IF EXISTS set_listings_updated_at ON public.listings;
DROP TRIGGER IF EXISTS set_wallets_updated_at ON public.wallets;
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop trigger functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- Drop tables (in dependency order)
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.bids CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.listings CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop enums
DROP TYPE IF EXISTS public.transaction_type;
DROP TYPE IF EXISTS public.notification_type;
DROP TYPE IF EXISTS public.listing_status;
DROP TYPE IF EXISTS public.item_condition;
DROP TYPE IF EXISTS public.listing_category;
DROP TYPE IF EXISTS public.auth_method;
DROP TYPE IF EXISTS public.user_role;


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

CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name   TEXT NOT NULL DEFAULT '',
  last_name    TEXT NOT NULL DEFAULT '',
  email        TEXT UNIQUE,
  mobile       TEXT UNIQUE,
  auth_method  public.auth_method NOT NULL DEFAULT 'mobile',
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

CREATE TABLE public.wallets (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance    NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0)
);


-- --------------------------
-- 2.3 Transactions
-- --------------------------

CREATE TABLE public.transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        public.transaction_type NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  listing_id  UUID,
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
  start_time        TIMESTAMPTZ,
  end_time          TIMESTAMPTZ NOT NULL,
  status            public.listing_status NOT NULL DEFAULT 'DRAFT',
  images            TEXT[] NOT NULL DEFAULT '{}',
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


-- Add FK from transactions → listings
ALTER TABLE public.transactions
  ADD CONSTRAINT fk_transactions_listing
  FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;

CREATE INDEX idx_transactions_listing_id ON public.transactions(listing_id) WHERE listing_id IS NOT NULL;


-- --------------------------
-- 2.5 Bids
-- --------------------------

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
  entity_type TEXT NOT NULL,
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
  INSERT INTO public.profiles (id, email, first_name, last_name, auth_method)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'mobile'::public.auth_method
  );

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
  SELECT is_suspended INTO v_bidder_suspended
  FROM public.profiles WHERE id = p_bidder_id;

  IF v_bidder_suspended IS TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Your account is suspended.');
  END IF;

  SELECT * INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found.');
  END IF;

  IF v_listing.seller_id = p_bidder_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot bid on your own listing.');
  END IF;

  IF v_listing.status != 'ACTIVE' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This auction is not active.');
  END IF;

  IF v_listing.end_time <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'This auction has ended.');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bid amount must be greater than 0.');
  END IF;

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

  v_is_first_bid := (v_listing.highest_bidder_id IS NULL);

  IF v_is_first_bid THEN
    v_minimum_bid := v_listing.current_price;
  ELSE
    v_minimum_bid := v_listing.current_price + v_listing.minimum_increment;
  END IF;

  IF p_amount < v_minimum_bid THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Bid must be at least %s.', v_minimum_bid)
    );
  END IF;

  IF v_listing.highest_bidder_id = p_bidder_id AND p_amount = v_listing.current_price THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already the highest bidder at this amount.');
  END IF;

  v_prev_highest := v_listing.highest_bidder_id;

  v_bid_id := gen_random_uuid();
  INSERT INTO public.bids (id, listing_id, bidder_id, amount)
  VALUES (v_bid_id, p_listing_id, p_bidder_id, p_amount);

  UPDATE public.listings
  SET current_price     = p_amount,
      highest_bidder_id = p_bidder_id,
      bid_count         = bid_count + 1
  WHERE id = p_listing_id;

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
-- 4.2 Activate Listing (no fee)
-- --------------------------

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
BEGIN
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

  UPDATE public.listings SET status = 'ACTIVE' WHERE id = p_listing_id;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- --------------------------
-- 4.3 End Expired Auctions
-- --------------------------

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
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.listings SET status = 'ENDED' WHERE id = v_listing.id;

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

      INSERT INTO public.notifications (user_id, type, title, message, listing_id)
      VALUES (
        v_listing.highest_bidder_id,
        'AUCTION_WON',
        'Auction Won!',
        format('Congratulations! You won "%s" with a bid of %s.', v_listing.title, v_listing.current_price),
        v_listing.id
      );

      INSERT INTO public.notifications (user_id, type, title, message, listing_id)
      VALUES (
        v_listing.highest_bidder_id,
        'ORDER_CONFIRMED',
        'Order Confirmed',
        format('Your order for "%s" has been confirmed.', v_listing.title),
        v_listing.id
      );
    END IF;

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


-- --------------------------
-- 4.4 Credit Wallet (top-up)
-- --------------------------

CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_user_id    UUID,
  p_amount     NUMERIC(12,2),
  p_description TEXT DEFAULT 'Top-up'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive.');
  END IF;

  UPDATE public.wallets
  SET balance = balance + p_amount
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found.');
  END IF;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, 'TOP_UP', p_amount, p_description);

  RETURN jsonb_build_object('success', true);
END;
$$;


-- --------------------------
-- 4.5 Debit Wallet
-- --------------------------

CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_user_id     UUID,
  p_amount      NUMERIC(12,2),
  p_description TEXT,
  p_type        TEXT DEFAULT 'BID_DEDUCTION'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC(12,2);
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive.');
  END IF;

  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found.');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Insufficient bid points. You need %s points but have %s.', p_amount, v_balance));
  END IF;

  UPDATE public.wallets
  SET balance = balance - p_amount
  WHERE user_id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, description)
  VALUES (p_user_id, p_type::public.transaction_type, -p_amount, p_description);

  RETURN jsonb_build_object('success', true);
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

-- PROFILES
CREATE POLICY "Profiles: public read"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Profiles: self update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- WALLETS (writes only via SECURITY DEFINER functions)
CREATE POLICY "Wallets: self read"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

-- TRANSACTIONS (writes only via SECURITY DEFINER functions)
CREATE POLICY "Transactions: self read"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- LISTINGS
CREATE POLICY "Listings: public read"
  ON public.listings FOR SELECT
  USING (status IN ('ACTIVE', 'ENDED') OR seller_id = auth.uid());

CREATE POLICY "Listings: seller insert"
  ON public.listings FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Listings: seller update"
  ON public.listings FOR UPDATE
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Listings: admin full access"
  ON public.listings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- BIDS (writes only via place_bid() function)
CREATE POLICY "Bids: public read"
  ON public.bids FOR SELECT
  USING (true);

-- NOTIFICATIONS
CREATE POLICY "Notifications: self read"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Notifications: self update"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Notifications: authenticated insert"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- AUDIT LOGS
CREATE POLICY "Audit logs: admin read"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );


-- ************************************************************
-- 6. REALTIME
-- ************************************************************

ALTER PUBLICATION supabase_realtime ADD TABLE public.listings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bids;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- ************************************************************
-- 7. STORAGE
-- ************************************************************

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-images',
  'listing-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Listing images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-images');

CREATE POLICY "Listing images: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'listing-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Listing images: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
