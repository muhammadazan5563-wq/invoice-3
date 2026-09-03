import { createClient } from '@supabase/supabase-js';
import { Invoice } from '../types';

const supabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL || 'https://rfmdptajmsvsqkrikugy.supabase.co';
const supabaseKey =
  (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_GMAKWARwjUkSiWL4lHLBuA_DNVTcheD';

export const supabase = createClient(supabaseUrl, supabaseKey);

/** Maps a database row (snake_case) into the camelCase shape the UI expects. */
function rowToInvoice(row: any): Invoice {
  return {
    rowIndex: 0,
    id: row.id,
    date: row.date,
    customerName: row.customer_name,
    customerEmail: row.customer_email || '',
    hotelName: row.hotel_name || '',
    totalAmount: Number(row.total_amount || 0),
    amountPaid: Number(row.amount_paid || 0),
    paymentDate: row.payment_date || '',
    balance: Number(row.balance || 0),
    status: row.status || 'Pending',
    notes: row.notes || '',
    items: row.items || [],
    payments: row.payments || [],
    rawRow: [],
  };
}

/** Maps the UI invoice shape back onto database columns. */
function invoiceToRow(invoice: Omit<Invoice, 'rowIndex' | 'rawRow'>) {
  return {
    date: invoice.date,
    customer_name: invoice.customerName,
    customer_email: invoice.customerEmail || '',
    hotel_name: invoice.hotelName || '',
    total_amount: Number(invoice.totalAmount || 0),
    amount_paid: Number(invoice.amountPaid || 0),
    payment_date: invoice.paymentDate || '',
    balance: Number(invoice.balance || 0),
    status: invoice.status || 'Pending',
    notes: invoice.notes || '',
    items: invoice.items || [],
    payments: invoice.payments || [],
  };
}

export async function getInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to load invoices from Supabase');
  }

  return (data || []).map(rowToInvoice);
}

export async function createInvoice(invoice: Omit<Invoice, 'rowIndex' | 'rawRow'>): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .insert({ id: invoice.id, ...invoiceToRow(invoice) });

  if (error) {
    throw new Error(error.message || 'Failed to save new invoice to Supabase');
  }
}

export async function updateInvoice(
  id: string,
  invoice: Omit<Invoice, 'rowIndex' | 'rawRow'>
): Promise<void> {
  const { error } = await supabase.from('invoices').update(invoiceToRow(invoice)).eq('id', id);

  if (error) {
    throw new Error(error.message || 'Failed to update invoice in Supabase');
  }
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from('invoices').delete().eq('id', id);

  if (error) {
    throw new Error(error.message || 'Failed to delete invoice from Supabase');
  }
}

/**
 * Public invoice lookup used by the tracking pages.
 * Matching is deliberately forgiving: exact id, case-insensitive id, or the
 * numeric part with or without an `INV-` / `REF-` prefix.
 */
export async function getPublicInvoice(rawId: string): Promise<Invoice | null> {
  const searched = (rawId || '').trim();
  if (!searched) return null;

  const { data, error } = await supabase.from('invoices').select('*');
  if (error) {
    throw new Error(error.message || 'Could not reach the invoice database');
  }

  const upper = searched.toUpperCase();
  const numeric = upper.startsWith('INV-') || upper.startsWith('REF-') ? searched.slice(4) : searched;

  const match = (data || []).find((row: any) => {
    const id = String(row.id || '');
    const idUpper = id.toUpperCase();
    if (id === searched || idUpper === upper) return true;
    if (idUpper === `INV-${upper}` || `INV-${idUpper}` === upper) return true;
    const idNumeric = idUpper.startsWith('INV-') || idUpper.startsWith('REF-') ? id.slice(4) : id;
    return idNumeric === numeric || idNumeric === searched;
  });

  return match ? rowToInvoice(match) : null;
}

function extractSpreadsheetId(input: string): string {
  const clean = (input || '').trim();
  if (clean.includes('docs.google.com/spreadsheets')) {
    const matches = clean.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (matches && matches[1]) return matches[1];
  }
  return clean;
}

function formatSheetDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

async function readSheetRows(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<string[][]> {
  const range = encodeURIComponent(`'${sheetName}'!A:H`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({} as any));
    throw new Error(body?.error?.message || `Failed to read the spreadsheet (${response.status})`);
  }

  const payload = await response.json();
  return payload.values || [];
}

function nextSeriesId(rows: string[][]): number {
  let next = 1;
  for (let index = 1; index < rows.length; index += 1) {
    const value = rows[index]?.[3];
    if (!value) continue;
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= next) next = parsed + 1;
  }
  return next;
}

/**
 * Mirrors an invoice's line items into the connected Google Sheet.
 * Runs entirely in the browser using the admin's Google OAuth token: rows for
 * this invoice are removed first, then the current line items are appended.
 */
export async function syncBookingToSheet(
  invoiceId: string,
  customerName: string,
  items: Array<{ checkIn: string; checkOut: string; nights: number; quantity: number; roomType: string }>,
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<{ success: boolean; rowsAdded: number; startId: number }> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  if (!cleanId || !sheetName || !accessToken) {
    throw new Error('Missing spreadsheet configuration or Google access token');
  }

  let rows = await readSheetRows(cleanId, sheetName, accessToken);

  // Drop any rows already recorded for this invoice (REF # lives in column F).
  const staleRowIndexes: number[] = [];
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index]?.[5] === invoiceId) staleRowIndexes.push(index);
  }

  if (staleRowIndexes.length > 0) {
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (metaResponse.ok) {
      const meta = await metaResponse.json();
      const targetSheet = meta.sheets?.find((sheet: any) => sheet.properties?.title === sheetName);
      const sheetId = targetSheet?.properties?.sheetId ?? 0;

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: staleRowIndexes
            .sort((a, b) => b - a)
            .map((rowIndex) => ({
              deleteDimension: {
                range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
              },
            })),
        }),
      });

      rows = await readSheetRows(cleanId, sheetName, accessToken);
    }
  }

  const startId = nextSeriesId(rows);

  // Columns: CHECK IN | CHECK OUT | TOTAL NIGHTS | ID | GROUP NAME | REF # | ROOMS | ROOM TYPE
  const newRows = items.map((item, offset) => [
    formatSheetDate(item.checkIn),
    formatSheetDate(item.checkOut),
    String(item.nights || 1),
    String(startId + offset),
    customerName,
    invoiceId,
    String(item.quantity || 1),
    item.roomType || '',
  ]);

  if (newRows.length > 0) {
    const appendRange = encodeURIComponent(`'${sheetName}'!A1`);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: newRows }),
      }
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({} as any));
      throw new Error(body?.error?.message || 'Failed to append rows to the spreadsheet');
    }
  }

  return { success: true, rowsAdded: newRows.length, startId };
}
