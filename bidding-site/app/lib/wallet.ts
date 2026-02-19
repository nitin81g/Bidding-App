export interface WalletEntry {
  user_id: string;
  balance: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: "TOP_UP" | "LISTING_FEE" | "BID_DEDUCTION";
  amount: number;
  description: string;
  created_at: string;
}

const WALLETS_KEY = "bidhub_wallets";
const TRANSACTIONS_KEY = "bidhub_transactions";

function getAllWallets(): WalletEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(WALLETS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveAllWallets(wallets: WalletEntry[]): void {
  localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
}

function getAllTransactions(): Transaction[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(TRANSACTIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveAllTransactions(transactions: Transaction[]): void {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

function addTransaction(
  userId: string,
  type: Transaction["type"],
  amount: number,
  description: string
): void {
  const transactions = getAllTransactions();
  transactions.push({
    id: crypto.randomUUID(),
    user_id: userId,
    type,
    amount,
    description,
    created_at: new Date().toISOString(),
  });
  saveAllTransactions(transactions);
}

export function getBalance(userId: string): number {
  const wallets = getAllWallets();
  const wallet = wallets.find((w) => w.user_id === userId);
  return wallet ? wallet.balance : 0;
}

export function hasEnoughPoints(userId: string, amount: number): boolean {
  return getBalance(userId) >= amount;
}

export function creditPoints(
  userId: string,
  amount: number,
  description: string
): void {
  const wallets = getAllWallets();
  const existing = wallets.find((w) => w.user_id === userId);
  if (existing) {
    existing.balance += amount;
  } else {
    wallets.push({ user_id: userId, balance: amount });
  }
  saveAllWallets(wallets);
  addTransaction(userId, "TOP_UP", amount, description);
}

export function debitPoints(
  userId: string,
  amount: number,
  description: string
): { success: boolean; error?: string } {
  const wallets = getAllWallets();
  const existing = wallets.find((w) => w.user_id === userId);
  const balance = existing ? existing.balance : 0;

  if (balance < amount) {
    return {
      success: false,
      error: `Insufficient bid points. You need ${amount} points but have ${balance}.`,
    };
  }

  if (existing) {
    existing.balance -= amount;
  } else {
    wallets.push({ user_id: userId, balance: -amount });
  }
  saveAllWallets(wallets);

  const type: Transaction["type"] = description.startsWith("Listing fee")
    ? "LISTING_FEE"
    : "BID_DEDUCTION";
  addTransaction(userId, type, -amount, description);

  return { success: true };
}

export function getTransactions(userId: string): Transaction[] {
  return getAllTransactions()
    .filter((t) => t.user_id === userId)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}
