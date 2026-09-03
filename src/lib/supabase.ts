import { createClient } from "@supabase/supabase-js";
import { Invoice } from "../types";

// Client-side environment variables with automatic fallback to user's provided credentials
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "https://jybjzbtgpnhkdyofayji.supabase.co";
const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_FDeECQfWSc89GcQVAUAhyA_QuEfE4AY";

export const supabase = createClient(supabaseUrl, supabaseKey);

// Fetch all invoices from Supabase
export async function getInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load invoices from Supabase");
  }

  // Map database snake_case fields to camelCase for the frontend React components
  return (data || []).map((row: any) => ({
    rowIndex: 0,
    id: row.id,
    date: row.date,
    customerName: row.customer_name,
    customerEmail: row.customer_email || "",
    hotelName: row.hotel_name || "",
    totalAmount: Number(row.total_amount || 0),
    amountPaid: Number(row.amount_paid || 0),
    paymentDate: row.payment_date || "",
    balance: Number(row.balance || 0),
    status: row.status || "Pending",
    notes: row.notes || "",
    items: row.items || [],
    payments: row.payments || [],
    rawRow: []
  }));
}

// Add a new invoice
export async function createInvoice(invoice: Omit<Invoice, 'rowIndex' | 'rawRow'>): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .insert({
      id: invoice.id,
      date: invoice.date,
      customer_name: invoice.customerName,
      customer_email: invoice.customerEmail || "",
      hotel_name: invoice.hotelName || "",
      total_amount: Number(invoice.totalAmount || 0),
      amount_paid: Number(invoice.amountPaid || 0),
      payment_date: invoice.paymentDate || "",
      balance: Number(invoice.balance || 0),
      status: invoice.status || "Pending",
      notes: invoice.notes || "",
      items: invoice.items || [],
      payments: invoice.payments || []
    });

  if (error) {
    throw new Error(error.message || "Failed to save new invoice to Supabase");
  }
}

// Update an existing invoice
export async function updateInvoice(id: string, invoice: Omit<Invoice, 'rowIndex' | 'rawRow'>): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .update({
      date: invoice.date,
      customer_name: invoice.customerName,
      customer_email: invoice.customerEmail || "",
      hotel_name: invoice.hotelName || "",
      total_amount: Number(invoice.totalAmount || 0),
      amount_paid: Number(invoice.amountPaid || 0),
      payment_date: invoice.paymentDate || "",
      balance: Number(invoice.balance || 0),
      status: invoice.status || "Pending",
      notes: invoice.notes || "",
      items: invoice.items || [],
      payments: invoice.payments || []
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to update invoice in Supabase");
  }
}

// Delete an invoice
export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to delete invoice from Supabase");
  }
}

// Sync room booking details to Google Sheets
export async function syncBookingToSheet(
  invoiceId: string,
  customerName: string,
  items: Array<{ checkIn: string; checkOut: string; nights: number; quantity: number; roomType: string }>,
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<{ success: boolean; rowsAdded: number; startId: number }> {
  const response = await fetch("/api/sync-booking-sheet", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      invoiceId,
      customerName,
      items,
      spreadsheetId,
      sheetName,
      accessToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to sync booking details to spreadsheet");
  }

  return response.json();
}
