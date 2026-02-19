"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { saveListing, generateId, getCurrentUserId } from "../lib/listings";
import NotificationBell from "../components/NotificationBell";
import AuthModal from "../components/AuthModal";
import { getCurrentUser, logout, type User } from "../lib/auth";
import { getBalance } from "../lib/wallet";

type Condition = "NEW" | "USED" | "";

interface ListingForm {
  title: string;
  description: string;
  category: string;
  condition: Condition;
  starting_price: string;
  minimum_increment: string;
  end_time: string;
}

interface ValidationErrors {
  [key: string]: string;
}

const CATEGORIES = ["Jewellery", "Clothing", "Accessories", "Shoes"];

function validateForActivation(
  form: ListingForm,
  images: string[]
): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!form.title.trim()) errors.title = "Title is required";
  if (!form.description.trim()) errors.description = "Description is required";
  if (!form.category) errors.category = "Category is required";
  if (!form.condition) errors.condition = "Condition is required";
  if (!form.starting_price)
    errors.starting_price = "Starting price is required";
  if (!form.minimum_increment)
    errors.minimum_increment = "Minimum increment is required";
  if (!form.end_time) errors.end_time = "End time is required";

  if (form.title.trim() && form.title.trim().length < 5) {
    errors.title = "Title must be at least 5 characters";
  }
  if (form.title.trim().length > 150) {
    errors.title = "Title must be 150 characters or fewer";
  }

  if (form.description.trim() && form.description.trim().length < 20) {
    errors.description = "Description must be at least 20 characters";
  }

  const startingPrice = parseFloat(form.starting_price);
  if (form.starting_price && (isNaN(startingPrice) || startingPrice < 1)) {
    errors.starting_price = "Starting price must be at least 1";
  }
  const minIncrement = parseFloat(form.minimum_increment);
  if (form.minimum_increment && (isNaN(minIncrement) || minIncrement < 1)) {
    errors.minimum_increment = "Minimum increment must be at least 1";
  }

  if (form.end_time) {
    const endDate = new Date(form.end_time);
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    if (endDate <= new Date()) {
      errors.end_time = "End time must be in the future";
    } else if (endDate < oneHourFromNow) {
      errors.end_time = "End time must be at least 1 hour from now";
    }
  }

  if (images.length === 0) {
    errors.images = "At least one image is required to activate";
  }

  return errors;
}

export default function ListItemPage() {
  const [form, setForm] = useState<ListingForm>({
    title: "",
    description: "",
    category: "",
    condition: "",
    starting_price: "",
    minimum_increment: "",
    end_time: "",
  });
  const [images, setImages] = useState<string[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [savedStatus, setSavedStatus] = useState<"DRAFT" | "ACTIVE" | null>(
    null
  );
  const [successMessage, setSuccessMessage] = useState("");
  const [listingId] = useState(() => generateId());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showActivatedPopup, setShowActivatedPopup] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    async function load() {
      setUser(await getCurrentUser());
      const uid = await getCurrentUserId();
      setWalletBalance(await getBalance(uid));
    }
    load();
  }, []);

  function updateField(field: keyof ListingForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 5 * 1024 * 1024) return; // 5MB limit

      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => {
          if (prev.length >= 5) return prev; // max 5 images
          return [...prev, reader.result as string];
        });
      };
      reader.readAsDataURL(file);
    });

    // Clear error
    if (errors.images) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.images;
        return next;
      });
    }

    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function persistListing(status: "DRAFT" | "ACTIVE") {
    const now = new Date().toISOString();
    const uid = await getCurrentUserId();
    await saveListing({
      id: listingId,
      seller_id: uid,
      title: form.title,
      description: form.description,
      category: form.category,
      condition: form.condition as "NEW" | "USED" | "",
      starting_price: form.starting_price,
      minimum_increment: form.minimum_increment,
      current_price: form.starting_price,
      highest_bidder_id: null,
      end_time: form.end_time,
      status,
      images,
      created_at: now,
      updated_at: now,
    });
  }

  async function handleSaveDraft() {
    setErrors({});
    await persistListing("DRAFT");
    setSavedStatus("DRAFT");
    setSuccessMessage("Listing saved as draft successfully!");
    setTimeout(() => setSuccessMessage(""), 4000);
  }

  async function handleSaveActivate() {
    setSuccessMessage("");
    const validationErrors = validateForActivation(form, images);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    try {
      await persistListing("ACTIVE");
    } catch {
      setErrors({
        general:
          "Failed to save listing. Please try again.",
      });
      return;
    }

    setSavedStatus("ACTIVE");
    setShowActivatedPopup(true);
  }

  const inputClass = (field: string) =>
    `w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors ${
      errors[field]
        ? "border-accent-red bg-red-50 dark:bg-red-950/20"
        : "border-border bg-background focus:border-primary"
    }`;

  return (
    <div className="min-h-screen bg-background-page font-sans">
      {/* Header */}
      <header className="bg-gradient-hero text-foreground-inverse">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Bid<span className="text-primary-light">Hub</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <Link href="/" className="transition-opacity hover:opacity-80">
              Home
            </Link>
            <a href="#" className="transition-opacity hover:opacity-80">
              Live Auctions
            </a>
            <a href="#" className="transition-opacity hover:opacity-80">
              My Listings
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {user ? (
              <>
                <Link href="/profile" className="text-sm font-medium hover:underline">
                  {user.first_name} {user.last_name}
                </Link>
                <button
                  onClick={async () => {
                    await logout();
                    setUser(null);
                  }}
                  className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10"
                >
                  Log Out
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10"
              >
                Log In
              </button>
            )}
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={async () => setUser(await getCurrentUser())}
      />

      {/* Page Content */}
      <div className="mx-auto max-w-3xl px-6 py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-foreground-muted">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <span>/</span>
          <span className="text-foreground-heading">List an Item</span>
        </div>

        {/* Title + Status Badge */}
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground-heading">
            Create New Listing
          </h1>
          {savedStatus && (
            <span
              className={`rounded-full px-4 py-1 text-xs font-semibold ${
                savedStatus === "ACTIVE"
                  ? "bg-accent-green/20 text-accent-teal"
                  : "bg-foreground-muted/20 text-foreground-muted"
              }`}
            >
              {savedStatus}
            </span>
          )}
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 rounded-lg border border-accent-green/30 bg-accent-green/10 px-5 py-3 text-sm font-medium text-accent-teal">
            {successMessage}
          </div>
        )}

        {/* Form */}
        <div className="rounded-xl bg-background-card p-6 shadow-[var(--shadow-md)] md:p-8">
          {/* Image Upload */}
          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-semibold text-foreground-heading">
              Product Images <span className="text-accent-red">*</span>
            </label>
            <p className="mb-3 text-xs text-foreground-muted">
              Upload up to 5 images (max 5MB each). First image will be the
              cover.
            </p>

            <div className="flex flex-wrap gap-3">
              {/* Existing image previews */}
              {images.map((src, i) => (
                <div
                  key={i}
                  className="group relative h-28 w-28 overflow-hidden rounded-lg border border-border"
                >
                  <Image
                    src={src}
                    alt={`Product image ${i + 1}`}
                    fill
                    className="object-cover"
                  />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Add image button */}
              {images.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex h-28 w-28 flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                    errors.images
                      ? "border-accent-red bg-accent-red/5"
                      : "border-border hover:border-primary hover:bg-primary/5"
                  }`}
                >
                  <svg
                    className="mb-1 h-6 w-6 text-foreground-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  <span className="text-xs text-foreground-muted">
                    Add Photo
                  </span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            {errors.images && (
              <p className="mt-1.5 text-xs text-accent-red">{errors.images}</p>
            )}
          </div>

          {/* Title */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-semibold text-foreground-heading">
              Title <span className="text-accent-red">*</span>
            </label>
            <input
              type="text"
              maxLength={150}
              placeholder="e.g. Gold Kundan Necklace Set"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              className={inputClass("title")}
            />
            <div className="mt-1 flex justify-between">
              {errors.title ? (
                <p className="text-xs text-accent-red">{errors.title}</p>
              ) : (
                <span />
              )}
              <p className="text-xs text-foreground-muted">
                {form.title.length}/150
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-semibold text-foreground-heading">
              Description <span className="text-accent-red">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Describe your item in detail (minimum 20 characters)..."
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              className={inputClass("description")}
            />
            {errors.description && (
              <p className="mt-1 text-xs text-accent-red">
                {errors.description}
              </p>
            )}
          </div>

          {/* Category + Condition */}
          <div className="mb-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground-heading">
                Category <span className="text-accent-red">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                className={inputClass("category")}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="mt-1 text-xs text-accent-red">
                  {errors.category}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground-heading">
                Condition <span className="text-accent-red">*</span>
              </label>
              <div className="flex gap-3">
                {(["NEW", "USED"] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => updateField("condition", val)}
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                      form.condition === val
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground hover:border-primary/50"
                    }`}
                  >
                    {val === "NEW" ? "New" : "Used"}
                  </button>
                ))}
              </div>
              {errors.condition && (
                <p className="mt-1 text-xs text-accent-red">
                  {errors.condition}
                </p>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="mb-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground-heading">
                Starting Price (₹) <span className="text-accent-red">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="e.g. 1000"
                value={form.starting_price}
                onChange={(e) => updateField("starting_price", e.target.value)}
                className={inputClass("starting_price")}
              />
              {errors.starting_price && (
                <p className="mt-1 text-xs text-accent-red">
                  {errors.starting_price}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-foreground-heading">
                Minimum Increment (₹){" "}
                <span className="text-accent-red">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="e.g. 100"
                value={form.minimum_increment}
                onChange={(e) =>
                  updateField("minimum_increment", e.target.value)
                }
                className={inputClass("minimum_increment")}
              />
              {errors.minimum_increment && (
                <p className="mt-1 text-xs text-accent-red">
                  {errors.minimum_increment}
                </p>
              )}
            </div>
          </div>

          {/* End Time */}
          <div className="mb-8">
            <label className="mb-1.5 block text-sm font-semibold text-foreground-heading">
              Auction End Time <span className="text-accent-red">*</span>
            </label>
            <input
              type="datetime-local"
              value={form.end_time}
              onChange={(e) => updateField("end_time", e.target.value)}
              className={inputClass("end_time")}
            />
            <p className="mt-1 text-xs text-foreground-muted">
              Must be at least 1 hour from now
            </p>
            {errors.end_time && (
              <p className="mt-0.5 text-xs text-accent-red">
                {errors.end_time}
              </p>
            )}
          </div>

          {/* General error */}
          {errors.general && (
            <div className="mb-6 rounded-lg border border-accent-red/30 bg-accent-red/5 px-5 py-3">
              <p className="text-sm font-semibold text-accent-red">{errors.general}</p>
            </div>
          )}

          {/* Validation summary */}
          {Object.keys(errors).filter(k => k !== "general").length > 0 && (
            <div className="mb-6 rounded-lg border border-accent-red/30 bg-accent-red/5 px-5 py-3">
              <p className="text-sm font-semibold text-accent-red">
                Please fix {Object.keys(errors).filter(k => k !== "general").length} error
                {Object.keys(errors).filter(k => k !== "general").length > 1 ? "s" : ""} before activating
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
            <Link
              href="/"
              className="flex items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground-muted/10"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSaveDraft}
              className="rounded-lg border border-primary px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={handleSaveActivate}
              className="bg-gradient-primary rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md"
            >
              Save & Activate
            </button>
          </div>
        </div>
      </div>

      {/* Activated Successfully Popup */}
      {showActivatedPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-background-card p-8 text-center shadow-[var(--shadow-lg)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-green/20 text-3xl">
              ✓
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground-heading">
              Activated Successfully!
            </h2>
            <p className="mt-2 text-sm text-foreground-muted">
              Your listing is now live. Click on Home to enjoy the auction.
            </p>
            <Link
              href="/"
              className="bg-gradient-primary mt-6 inline-block w-full rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md"
            >
              Go to Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
