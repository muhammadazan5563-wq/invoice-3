export interface BookingItem {
  roomType: string;      // Fish species (kept for backwards compatibility)
  quantity: number;      // Quantity in kilograms
  checkIn: string;       // CHECK-IN column, e.g., '2026-07-18'
  checkOut: string;      // CHECK-OUT column, e.g., '2026-07-20'
  nights: number;        // Legacy field; fishery invoices use 1
  price: number;         // Rate per kilogram
  total: number;         // quantity * price
  description?: string;
}

export interface PaymentRecord {
  amount: number;
  date: string;
  /** Shared ID links invoice splits back to one admin payment entry. */
  paymentId?: string;
  contactName?: string;
  contactPhone?: string;
}

export interface Invoice {
  rowIndex: number;      // 1-indexed row number in the spreadsheet
  id: string;            // Invoice No / ID
  date: string;          // Date
  customerName: string;  // Customer Name, e.g., 'FAIZ'
  /** Stable contact ID used as the sole ownership/matching key. */
  customerId?: string;
  customerEmail: string; // Customer Email
  customerPhone?: string;
  /** Legacy spreadsheet-only field; never sent to Supabase invoice tables. */
  hotelName?: string;
  totalAmount: number;   // Total Amount, e.g., 1600.00
  amountPaid: number;    // Amount Paid, e.g., 600.00
  paymentDate: string;   // Payment Date, e.g., '2026-07-18'
  balance: number;       // BALANCE (Total Amount - Amount Paid), e.g., 1000.00
  status: 'Paid' | 'Due' | 'Unpaid' | 'Pending' | 'Overdue';
  notes: string;         // Notes & Banking details
  items: BookingItem[];  // Parsed from cell or stored as JSON string
  payments: PaymentRecord[]; // List of detailed payments
  invoiceType?: 'customer' | 'vendor';
  rawRow: string[];      // Copy of original raw row values
}

export interface ColumnMapping {
  id: string;            // Maps to Invoice ID / Invoice No
  date: string;          // Maps to Date
  customerName: string;  // Maps to Customer Name
  customerEmail: string; // Maps to Customer Email
  hotelName: string;     // Maps to Hotel Name
  totalAmount: string;   // Maps to Total Amount
  amountPaid: string;    // Maps to Amount Paid
  paymentDate: string;   // Maps to Payment Date
  balance: string;       // Maps to Balance
  status: string;        // Maps to Status
  notes: string;         // Maps to Notes
  items: string;         // Maps to Items list (JSON or summarized)
  payments: string;      // Maps to Payments list (JSON)
}

export interface SpreadsheetInfo {
  id: string;
  title: string;
  sheets: string[];      // Tab names
}
