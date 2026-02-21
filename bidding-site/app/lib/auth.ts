import { createClient } from "./supabase/client";

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  auth_method: "google" | "mobile";
  created_at: string;
}

// --- Session ---

export async function getCurrentUser(): Promise<User | null> {
  if (typeof window === "undefined") return null;
  const supabase = createClient();

  // Use getSession() first — reads from localStorage, no network call.
  // This keeps the user logged in across page refreshes without waiting
  // for a server round-trip.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const userId = session.user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    first_name: profile.first_name || "",
    last_name: profile.last_name || "",
    email: profile.email || "",
    mobile: profile.mobile || "",
    auth_method: profile.auth_method || "google",
    created_at: profile.created_at,
  };
}

export async function isLoggedIn(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session !== null;
}

export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

// --- Mobile + OTP Login ---
// Demo mode: uses localStorage for OTP simulation.
// In production, use supabase.auth.signInWithOtp({ phone: '+91' + mobile }).

export interface MobileLoginResult {
  success: boolean;
  error?: string;
}

const OTP_KEY = "bidhub_pending_otp";

export async function requestOtp(mobile: string): Promise<MobileLoginResult> {
  if (!mobile || mobile.length < 10) {
    return { success: false, error: "Please enter a valid mobile number." };
  }

  const supabase = createClient();

  // Check if user exists with this mobile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("mobile", mobile)
    .single();

  if (!profile) {
    return {
      success: false,
      error: "Mobile number is not registered, please sign up and create account.",
    };
  }

  // Demo OTP simulation
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  localStorage.setItem(OTP_KEY, JSON.stringify({ mobile, otp, profileId: profile.id, expires: Date.now() + 5 * 60 * 1000 }));

  console.log(`[BidHub Demo] OTP for ${mobile}: ${otp}`);
  return { success: true };
}

export interface VerifyOtpResult {
  success: boolean;
  user?: User;
  error?: string;
}

export async function verifyOtp(mobile: string, enteredOtp: string): Promise<VerifyOtpResult> {
  const raw = localStorage.getItem(OTP_KEY);
  if (!raw) {
    return { success: false, error: "No OTP was requested. Please request a new OTP." };
  }

  const pending = JSON.parse(raw);
  if (pending.mobile !== mobile) {
    return { success: false, error: "OTP was sent to a different number." };
  }
  if (Date.now() > pending.expires) {
    localStorage.removeItem(OTP_KEY);
    return { success: false, error: "OTP has expired. Please request a new one." };
  }
  if (pending.otp !== enteredOtp) {
    return { success: false, error: "Incorrect OTP. Please try again." };
  }

  localStorage.removeItem(OTP_KEY);

  // Look up the user's email to sign in via Supabase Auth
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("mobile", mobile)
    .single();

  if (!profile?.email) {
    return { success: false, error: "User not found or no email linked." };
  }

  // Sign in using email/password (demo mode)
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: profile.email,
  });

  if (signInError) {
    return { success: false, error: "Authentication failed. " + signInError.message };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "User not found." };
  }

  return { success: true, user };
}

// --- Get the generated OTP (for demo display only) ---

export function getDemoOtp(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(OTP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw).otp;
  } catch {
    return null;
  }
}

// --- Update Profile ---

export interface UpdateProfileData {
  email?: string;
  mobile?: string;
  first_name?: string;
  last_name?: string;
}

export interface UpdateProfileResult {
  success: boolean;
  user?: User;
  errors?: { [key: string]: string };
}

export async function updateProfile(userId: string, data: UpdateProfileData): Promise<UpdateProfileResult> {
  const errors: { [key: string]: string } = {};
  const supabase = createClient();

  // Fetch current profile
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!currentProfile) {
    return { success: false, errors: { general: "User not found." } };
  }

  const updates: Record<string, string> = {};

  if (data.first_name !== undefined) {
    if (!data.first_name.trim()) {
      errors.first_name = "First name is required.";
    } else {
      updates.first_name = data.first_name.trim();
    }
  }

  if (data.last_name !== undefined) {
    if (!data.last_name.trim()) {
      errors.last_name = "Last name is required.";
    } else {
      updates.last_name = data.last_name.trim();
    }
  }

  if (data.email !== undefined) {
    const trimmedEmail = data.email.trim();
    if (trimmedEmail && !trimmedEmail.includes("@")) {
      errors.email = "Please enter a valid email address.";
    } else if (trimmedEmail) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", trimmedEmail)
        .neq("id", userId)
        .single();

      if (existing) {
        errors.email = "This email is already registered to another account.";
      } else {
        updates.email = trimmedEmail;
      }
    } else {
      const currentMobile = data.mobile?.trim() || currentProfile.mobile;
      if (!currentMobile) {
        errors.email = "Either email or mobile number is required.";
      } else {
        updates.email = "";
      }
    }
  }

  if (data.mobile !== undefined) {
    const trimmedMobile = data.mobile.trim();
    if (trimmedMobile && trimmedMobile.length < 10) {
      errors.mobile = "Please enter a valid 10-digit mobile number.";
    } else if (trimmedMobile) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("mobile", trimmedMobile)
        .neq("id", userId)
        .single();

      if (existing) {
        errors.mobile = "This mobile number is already registered to another account.";
      } else {
        updates.mobile = trimmedMobile;
      }
    } else {
      const currentEmail = data.email?.trim() || currentProfile.email;
      if (!currentEmail) {
        errors.mobile = "Either email or mobile number is required.";
      } else {
        updates.mobile = "";
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) {
      return { success: false, errors: { general: error.message } };
    }
  }

  const user = await getCurrentUser();
  return { success: true, user: user || undefined };
}

// --- Signup ---

export interface SignupData {
  first_name: string;
  last_name: string;
  mobile: string;
}

export interface SignupResult {
  success: boolean;
  user?: User;
  errors?: { [key: string]: string };
}

export async function signup(data: SignupData): Promise<SignupResult> {
  const errors: { [key: string]: string } = {};

  if (!data.first_name.trim()) errors.first_name = "First name is required.";
  if (!data.last_name.trim()) errors.last_name = "Last name is required.";

  if (!data.mobile.trim()) {
    errors.mobile = "Mobile number is required.";
  } else if (data.mobile.trim().length < 10) {
    errors.mobile = "Please enter a valid 10-digit mobile number.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  const supabase = createClient();

  // Check for duplicate mobile
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("mobile", data.mobile.trim())
    .single();
  if (existing) {
    return { success: false, errors: { mobile: "This mobile number is already registered." } };
  }

  // Supabase Auth requires an email — generate one from the mobile number
  const email = `${data.mobile.trim()}@bidhub.local`;

  // Create auth user via Supabase Auth
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: email, // Demo: using email as password
    options: {
      data: {
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
      },
    },
  });

  if (signUpError) {
    return { success: false, errors: { general: signUpError.message } };
  }

  if (!signUpData.user) {
    return { success: false, errors: { general: "Failed to create account." } };
  }

  // If email confirmation is enabled, signUp won't create a session.
  // Sign in immediately to establish a session for this demo app.
  if (!signUpData.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: email,
    });
    if (signInError) {
      return {
        success: false,
        errors: { general: "Account created but could not sign in: " + signInError.message },
      };
    }
  }

  // Update profile with mobile and auth method
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      mobile: data.mobile.trim(),
      auth_method: "mobile",
    })
    .eq("id", signUpData.user.id);

  if (updateError) {
    console.warn("Profile update after signup failed:", updateError.message);
  }

  const user = await getCurrentUser();
  return { success: true, user: user || undefined };
}
