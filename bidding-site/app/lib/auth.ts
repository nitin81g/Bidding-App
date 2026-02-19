export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  auth_method: "google" | "mobile";
  created_at: string;
}

const USERS_KEY = "bidhub_users";
const SESSION_KEY = "bidhub_session";
const OTP_KEY = "bidhub_pending_otp";

// --- User storage ---

function getAllUsers(): User[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveAllUsers(users: User[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function findUserByEmail(email: string): User | null {
  return getAllUsers().find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

function findUserByMobile(mobile: string): User | null {
  return getAllUsers().find((u) => u.mobile === mobile) ?? null;
}

// --- Session ---

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  return getCurrentUser() !== null;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

function setSession(user: User): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));

  // Also update the current user ID used by listings/bids
  localStorage.setItem("bidhub_current_user", user.id);
}

// --- Google Login ---
// Google login allows login even without prior signup.
// If the user doesn't exist, auto-create an account.

export interface GoogleLoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

export function loginWithGoogle(email: string, name: string): GoogleLoginResult {
  if (!email || !email.includes("@")) {
    return { success: false, error: "Invalid email address." };
  }

  let user = findUserByEmail(email);

  if (!user) {
    // Auto-create account for Google users
    const nameParts = name.trim().split(/\s+/);
    user = {
      id: crypto.randomUUID(),
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
      email,
      mobile: "",
      auth_method: "google",
      created_at: new Date().toISOString(),
    };
    const users = getAllUsers();
    users.push(user);
    saveAllUsers(users);
  }

  setSession(user);
  return { success: true, user };
}

// --- Mobile + OTP Login ---
// Mobile login requires the user to have signed up first.

export interface MobileLoginResult {
  success: boolean;
  error?: string;
}

export function requestOtp(mobile: string): MobileLoginResult {
  if (!mobile || mobile.length < 10) {
    return { success: false, error: "Please enter a valid mobile number." };
  }

  const user = findUserByMobile(mobile);
  if (!user) {
    return {
      success: false,
      error: "Mobile number is not registered, please sign up and create account.",
    };
  }

  // Simulate OTP generation (in real app, send via SMS)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  localStorage.setItem(OTP_KEY, JSON.stringify({ mobile, otp, expires: Date.now() + 5 * 60 * 1000 }));

  // For demo: show OTP in console
  console.log(`[BidHub Demo] OTP for ${mobile}: ${otp}`);

  return { success: true };
}

export interface VerifyOtpResult {
  success: boolean;
  user?: User;
  error?: string;
}

export function verifyOtp(mobile: string, enteredOtp: string): VerifyOtpResult {
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

  const user = findUserByMobile(mobile);
  if (!user) {
    return { success: false, error: "User not found." };
  }

  setSession(user);
  return { success: true, user };
}

// --- Get the generated OTP (for demo display only) ---

export function getDemoOtp(): string | null {
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

export function updateProfile(userId: string, data: UpdateProfileData): UpdateProfileResult {
  const errors: { [key: string]: string } = {};
  const users = getAllUsers();
  const userIdx = users.findIndex((u) => u.id === userId);
  if (userIdx < 0) {
    return { success: false, errors: { general: "User not found." } };
  }

  const user = { ...users[userIdx] };

  if (data.first_name !== undefined) {
    if (!data.first_name.trim()) {
      errors.first_name = "First name is required.";
    } else {
      user.first_name = data.first_name.trim();
    }
  }

  if (data.last_name !== undefined) {
    if (!data.last_name.trim()) {
      errors.last_name = "Last name is required.";
    } else {
      user.last_name = data.last_name.trim();
    }
  }

  if (data.email !== undefined) {
    const trimmedEmail = data.email.trim();
    if (trimmedEmail && !trimmedEmail.includes("@")) {
      errors.email = "Please enter a valid email address.";
    } else if (trimmedEmail) {
      const existing = findUserByEmail(trimmedEmail);
      if (existing && existing.id !== userId) {
        errors.email = "This email is already registered to another account.";
      } else {
        user.email = trimmedEmail;
      }
    } else {
      // Allow clearing email only if mobile is set
      if (!user.mobile && !(data.mobile && data.mobile.trim())) {
        errors.email = "Either email or mobile number is required.";
      } else {
        user.email = "";
      }
    }
  }

  if (data.mobile !== undefined) {
    const trimmedMobile = data.mobile.trim();
    if (trimmedMobile && trimmedMobile.length < 10) {
      errors.mobile = "Please enter a valid 10-digit mobile number.";
    } else if (trimmedMobile) {
      const existing = findUserByMobile(trimmedMobile);
      if (existing && existing.id !== userId) {
        errors.mobile = "This mobile number is already registered to another account.";
      } else {
        user.mobile = trimmedMobile;
      }
    } else {
      // Allow clearing mobile only if email is set
      if (!user.email && !(data.email && data.email.trim())) {
        errors.mobile = "Either email or mobile number is required.";
      } else {
        user.mobile = "";
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  users[userIdx] = user;
  saveAllUsers(users);
  setSession(user);
  return { success: true, user };
}

// --- Signup ---

export interface SignupData {
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
}

export interface SignupResult {
  success: boolean;
  user?: User;
  errors?: { [key: string]: string };
}

export function signup(data: SignupData): SignupResult {
  const errors: { [key: string]: string } = {};

  if (!data.first_name.trim()) errors.first_name = "First name is required.";
  if (!data.last_name.trim()) errors.last_name = "Last name is required.";

  // Either email or mobile must be provided
  if (!data.email.trim() && !data.mobile.trim()) {
    errors.email = "Either email or mobile number is required.";
    errors.mobile = "Either email or mobile number is required.";
  }

  if (data.email.trim() && !data.email.includes("@")) {
    errors.email = "Please enter a valid email address.";
  }

  if (data.mobile.trim() && data.mobile.trim().length < 10) {
    errors.mobile = "Please enter a valid mobile number.";
  }

  // Check duplicates
  if (data.email.trim() && findUserByEmail(data.email.trim())) {
    errors.email = "This email is already registered.";
  }
  if (data.mobile.trim() && findUserByMobile(data.mobile.trim())) {
    errors.mobile = "This mobile number is already registered.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  const user: User = {
    id: crypto.randomUUID(),
    first_name: data.first_name.trim(),
    last_name: data.last_name.trim(),
    email: data.email.trim(),
    mobile: data.mobile.trim(),
    auth_method: data.email.trim() ? "google" : "mobile",
    created_at: new Date().toISOString(),
  };

  const users = getAllUsers();
  users.push(user);
  saveAllUsers(users);

  setSession(user);
  return { success: true, user };
}
