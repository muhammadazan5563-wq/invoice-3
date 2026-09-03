export interface BookingItem {
  roomType: string;      // Room column, e.g., 'AVG 4.5'
  quantity: number;      // QUANTITY column, e.g., 4
  checkIn: string;       // CHECK-IN column, e.g., '2026-07-18'
  checkOut: string;      // CHECK-OUT column, e.g., '2026-07-20'
  nights: number;        // NIGHTS column, e.g., 2
  price: number;         // PRICE column, e.g., 50.00
  total: number;         // TOTAL AMOUNT column, e.g., 400.00 (quantity * nights * price)
}

export interface PaymentRecord {
  amount: number;
  date: string;
}

export interface Invoice {
  rowIndex: number;      // 1-indexed row number in the spreadsheet
  id: string;            // Invoice No / ID
  date: string;          // Date
  customerName: string;  // Customer Name, e.g., 'FAIZ'
  customerEmail: string; // Customer Email
  hotelName: string;     // Hotel Name
  totalAmount: number;   // Total Amount, e.g., 1600.00
  amountPaid: number;    // Amount Paid, e.g., 600.00
  paymentDate: string;   // Payment Date, e.g., '2026-07-18'
  balance: number;       // BALANCE (Total Amount - Amount Paid), e.g., 1000.00
  status: 'Paid' | 'Due' | 'Unpaid' | 'Pending' | 'Overdue';
  notes: string;         // Notes & Banking details
  items: BookingItem[];  // Parsed from cell or stored as JSON string
  payments: PaymentRecord[]; // List of detailed payments
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
