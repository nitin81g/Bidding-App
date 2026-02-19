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

  // Update wallet balance
  const currentBalance = await getBalance(userId);
  await supabase
    .from("wallets")
    .update({ balance: currentBalance + amount })
    .eq("user_id", userId);

  // Record transaction
  await supabase.from("transactions").insert({
    user_id: userId,
    type: "TOP_UP",
    amount: amount,
    description,
  });
}

export async function debitPoints(
  userId: string,
  amount: number,
  description: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const balance = await getBalance(userId);
  if (balance < amount) {
    return {
      success: false,
      error: `Insufficient bid points. You need ${amount} points but have ${balance}.`,
    };
  }

  // Update wallet balance
  await supabase
    .from("wallets")
    .update({ balance: balance - amount })
    .eq("user_id", userId);

  // Record transaction
  const type = description.startsWith("Listing fee") ? "LISTING_FEE" : "BID_DEDUCTION";
  await supabase.from("transactions").insert({
    user_id: userId,
    type,
    amount: -amount,
    description,
  });

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
