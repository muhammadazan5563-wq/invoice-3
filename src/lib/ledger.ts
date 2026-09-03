import { supabase } from "./supabase";

export interface LedgerInvoice {
  id: string;
  guest_name: string;
  hotel_name: string;
  total_amount: number;
  created_at: string;
}

export interface CashExpense {
  id: number;
  name: string;
  amount: number;
  description: string;
  tag: string;
  created_at: string;
}

export interface LedgerEntry {
  date: string;
  invoices: LedgerInvoice[];
  expenses: CashExpense[];
  totalReceived: number;
  totalExpense: number;
}

// Fetch all ledger invoices
export async function getLedgerInvoices(): Promise<LedgerInvoice[]> {
  const { data, error } = await supabase
    .from("ledger_invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load ledger invoices");
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    guest_name: row.guest_name,
    hotel_name: row.hotel_name,
    total_amount: Number(row.total_amount || 0),
    created_at: row.created_at,
  }));
}

// Fetch all cash expenses
export async function getCashExpenses(): Promise<CashExpense[]> {
  const { data, error } = await supabase
    .from("cash_expenses")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load cash expenses");
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    amount: Number(row.amount || 0),
    description: row.description || "",
    tag: row.tag || "expense",
    created_at: row.created_at,
  }));
}

// Create a ledger invoice entry
export async function createLedgerInvoice(invoice: Omit<LedgerInvoice, "created_at">): Promise<void> {
  const { error } = await supabase
    .from("ledger_invoices")
    .insert({
      id: invoice.id,
      guest_name: invoice.guest_name,
      hotel_name: invoice.hotel_name,
      total_amount: invoice.total_amount,
    });

  if (error) {
    throw new Error(error.message || "Failed to create ledger invoice");
  }
}

// Create a cash expense entry
export async function createCashExpense(expense: Omit<CashExpense, "id" | "created_at">): Promise<void> {
  const { error } = await supabase
    .from("cash_expenses")
    .insert({
      name: expense.name,
      amount: expense.amount,
      description: expense.description,
      tag: expense.tag || "expense",
    });

  if (error) {
    throw new Error(error.message || "Failed to create cash expense");
  }
}

// Delete a ledger invoice
export async function deleteLedgerInvoice(id: string): Promise<void> {
  const { error } = await supabase
    .from("ledger_invoices")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to delete ledger invoice");
  }
}

// Delete a cash expense
export async function deleteCashExpense(id: number): Promise<void> {
  const { error } = await supabase
    .from("cash_expenses")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to delete cash expense");
  }
}

// Helper to convert a UTC timestamp to a date string in the given timezone
function toDateInTimezone(utcDateStr: string, timezone: string = 'UTC'): string {
  try {
    const date = new Date(utcDateStr);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch (err) {
    return new Date(utcDateStr).toISOString().split("T")[0];
  }
}

// Group ledger data by date
// Cash-tagged entries are added to totalReceived, expense-tagged entries are added to totalExpense
export function groupLedgerByDate(invoices: LedgerInvoice[], expenses: CashExpense[], timezone: string = 'UTC'): LedgerEntry[] {
  const dateMap = new Map<string, LedgerEntry>();

  // Group invoices by date
  // For composite IDs (format: "invoiceId_YYYY-MM-DD"), extract the date from the ID.
  // For legacy IDs without a date suffix, fall back to created_at converted to user timezone.
  invoices.forEach((inv) => {
    let date: string;
    const dateMatch = inv.id.match(/_(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      date = dateMatch[1];
    } else {
      date = toDateInTimezone(inv.created_at, timezone);
    }
    if (!dateMap.has(date)) {
      dateMap.set(date, { date, invoices: [], expenses: [], totalReceived: 0, totalExpense: 0 });
    }
    const entry = dateMap.get(date)!;
    entry.invoices.push(inv);
    entry.totalReceived += inv.total_amount;
  });

  // Group expenses by date (using user timezone for created_at conversion)
  // If tag is "cash", it counts as received (added to totalReceived)
  // If tag is "expense", it counts as expense (added to totalExpense / deducted)
  expenses.forEach((exp) => {
    const date = toDateInTimezone(exp.created_at, timezone);
    if (!dateMap.has(date)) {
      dateMap.set(date, { date, invoices: [], expenses: [], totalReceived: 0, totalExpense: 0 });
    }
    const entry = dateMap.get(date)!;
    entry.expenses.push(exp);
    if (exp.tag === "cash") {
      entry.totalReceived += exp.amount;
    } else {
      entry.totalExpense += exp.amount;
    }
  });

  // Sort by date descending
  return Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}
