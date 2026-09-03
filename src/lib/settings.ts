import { supabase } from "./supabase";

export interface InvoiceTemplate {
  companyName: string;
  companyLogo: string; // URL or base64
  termsAndConditions: string;
  paymentDetails: string;
  defaultHotelName: string;
  defaultNotes: string;
  currency: string;
  timezone: string;
  taxRate: number;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  tagline: string;
}

export interface SpreadsheetSettings {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetName: string;
  lastSynced: string;
}

export interface UserSettings {
  id?: string;
  user_email: string;
  firebase_uid: string;
  firebase_token: string;
  firebase_refresh_token: string;
  spreadsheet_settings: SpreadsheetSettings | null;
  invoice_template: InvoiceTemplate | null;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_TEMPLATE: InvoiceTemplate = {
  companyName: "FAIZ GROUP",
  companyLogo: "",
  termsAndConditions: "Payment is due within 30 days of invoice date.\nLate payments may incur additional charges.\nAll prices are in USD unless otherwise stated.",
  paymentDetails: "Beneficiaire Bank of America\nSwift Sort\nAccount No.: 324 6654 7766 9992",
  defaultHotelName: "",
  defaultNotes: "",
  currency: "USD",
  timezone: "UTC",
  taxRate: 0,
  contactPhone: "123-456-7890",
  contactEmail: "billing@finnova.com",
  contactAddress: "123 Anywhere St., Any City",
  tagline: "Smart Finances, Better Business",
};

// Currency symbol mapping
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  PKR: "₨",
  AED: "د.إ",
  SAR: "﷼",
  INR: "₹",
};

// Get currency symbol from currency code
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode;
}

// Format amount with currency symbol
export function formatCurrency(amount: number, currencyCode: string = "USD", options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }): string {
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  });
  return `${symbol}${formatted}`;
}

const DEFAULT_SPREADSHEET: SpreadsheetSettings = {
  spreadsheetId: "",
  spreadsheetUrl: "",
  sheetName: "",
  lastSynced: "",
};

// Get user settings from Supabase
export async function getUserSettings(firebaseUid: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("firebase_uid", firebaseUid)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found, which is fine for first-time users
    console.error("Error fetching user settings:", error);
    return null;
  }

  return data || null;
}

// Save or update user settings in Supabase
export async function saveUserSettings(settings: Partial<UserSettings> & { firebase_uid: string }): Promise<void> {
  const { data: existing } = await supabase
    .from("user_settings")
    .select("id")
    .eq("firebase_uid", settings.firebase_uid)
    .single();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from("user_settings")
      .update({
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .eq("firebase_uid", settings.firebase_uid);

    if (error) {
      throw new Error(error.message || "Failed to update settings");
    }
  } else {
    // Insert new
    const { error } = await supabase
      .from("user_settings")
      .insert({
        ...settings,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      throw new Error(error.message || "Failed to save settings");
    }
  }
}

// Save Firebase token for session persistence
export async function saveFirebaseToken(
  firebaseUid: string,
  email: string,
  token: string,
  refreshToken: string
): Promise<void> {
  await saveUserSettings({
    firebase_uid: firebaseUid,
    user_email: email,
    firebase_token: token,
    firebase_refresh_token: refreshToken,
  });
}

// Get stored Firebase token for session restoration
export async function getStoredToken(firebaseUid: string): Promise<{ token: string; refreshToken: string } | null> {
  const settings = await getUserSettings(firebaseUid);
  if (settings && settings.firebase_token) {
    return {
      token: settings.firebase_token,
      refreshToken: settings.firebase_refresh_token || "",
    };
  }
  return null;
}

// Save spreadsheet settings
export async function saveSpreadsheetSettings(
  firebaseUid: string,
  spreadsheetSettings: SpreadsheetSettings
): Promise<void> {
  const existing = await getUserSettings(firebaseUid);
  await saveUserSettings({
    firebase_uid: firebaseUid,
    user_email: existing?.user_email || "",
    spreadsheet_settings: spreadsheetSettings,
  });
}

// Save invoice template settings
export async function saveInvoiceTemplate(
  firebaseUid: string,
  template: InvoiceTemplate
): Promise<void> {
  const existing = await getUserSettings(firebaseUid);
  await saveUserSettings({
    firebase_uid: firebaseUid,
    user_email: existing?.user_email || "",
    invoice_template: template,
  });
}

// Get invoice template with defaults
export function getTemplateWithDefaults(template: InvoiceTemplate | null): InvoiceTemplate {
  if (!template) return DEFAULT_TEMPLATE;
  return {
    ...DEFAULT_TEMPLATE,
    ...template,
  };
}

// Get spreadsheet settings with defaults
export function getSpreadsheetWithDefaults(settings: SpreadsheetSettings | null): SpreadsheetSettings {
  if (!settings) return DEFAULT_SPREADSHEET;
  return {
    ...DEFAULT_SPREADSHEET,
    ...settings,
  };
}
