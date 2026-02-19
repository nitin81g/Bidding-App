import { createClient } from "./supabase/client";

export interface WalletEntry {
  user_id: string;
  balance: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: "TOP_UP" | "LISTING_FEE" | "BID_DEDUCTION" | "AUCTION_WIN_DEDUCTION" | "REFUND";
  amount: number;
  description: string;
  created_at: string;
}

export async function getBalance(userId: string): Promise<number> {
  if (!userId) return 0;
  const supabase = createClient();
  const { data } = await supabase
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .single();
  return data ? Number(data.balance) : 0;
}

export async function hasEnoughPoints(userId: string, amount: number): Promise<boolean> {
  const balance = await getBalance(userId);
  return balance >= amount;
}

export async function creditPoints(
  userId: string,
  amount: number,
  description: string
): Promise<void> {
  const supabase = createClient();

  // Atomic credit via SECURITY DEFINER RPC
  const { data, error } = await supabase.rpc("credit_wallet", {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
  });

  if (error) {
    console.error("creditPoints RPC error:", error.message);
  } else if (data && !data.success) {
    console.error("creditPoints failed:", data.error);
  }
}

export async function debitPoints(
  userId: string,
  amount: number,
  description: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const type = description.startsWith("Listing fee") ? "LISTING_FEE" : "BID_DEDUCTION";

  // Atomic debit via SECURITY DEFINER RPC
  const { data, error } = await supabase.rpc("debit_wallet", {
    p_user_id: userId,
    p_amount: amount,
    p_description: description,
    p_type: type,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data && !data.success) {
    return { success: false, error: data.error };
  }

  return { success: true };
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return (data || []).map((t) => ({
    ...t,
    amount: Number(t.amount),
  }));
}
