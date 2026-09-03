import { Invoice, ColumnMapping, SpreadsheetInfo, BookingItem, PaymentRecord } from '../types';

// Extract spreadsheet ID from URL if user pastes the full link instead of just the ID
export function extractSpreadsheetId(input: string): string {
  const clean = input.trim();
  if (clean.includes('docs.google.com/spreadsheets')) {
    const matches = clean.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (matches && matches[1]) {
      return matches[1];
    }
  }
  return clean;
}

// Fetch general information about the spreadsheet
export async function getSpreadsheetInfo(spreadsheetId: string, accessToken: string): Promise<SpreadsheetInfo> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch spreadsheet info (Status: ${response.status})`);
  }

  const data = await response.json();
  const sheets = data.sheets?.map((s: any) => s.properties?.title) || [];
  
  return {
    id: cleanId,
    title: data.properties?.title || 'Untitled Spreadsheet',
    sheets,
  };
}

// Create a new sheet tab and initialize it with default headers
export async function createAndInitializeSheet(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  
  // 1. Add Sheet Tab
  const addSheetResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
            },
          },
        },
      ],
    }),
  });

  if (!addSheetResponse.ok) {
    const errorData = await addSheetResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to create new sheet tab');
  }

  // 2. Set Default Headers in the first row matching the hotel booking attributes
  const headers = [
    'Invoice No',
    'Date',
    'Customer Name',
    'Customer Email',
    'Hotel Name',
    'Total Amount',
    'Amount Paid',
    'Payment Date',
    'Balance',
    'Status',
    'Notes',
    'Booking Items (JSON)',
    'Payments (JSON)'
  ];

  const appendResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'${sheetName}'!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [headers],
      }),
    }
  );

  if (!appendResponse.ok) {
    const errorData = await appendResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to write sheet headers');
  }
}

// Fetch all values from a sheet tab
export async function getSheetValues(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<string[][]> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const encodedSheetName = encodeURIComponent(sheetName);
  
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'${encodedSheetName}'!A:Z`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to fetch sheet values (Status: ${response.status})`);
  }

  const data = await response.json();
  return data.values || [];
}

// Helper to auto-detect mappings from header row
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    id: '',
    date: '',
    customerName: '',
    customerEmail: '',
    hotelName: '',
    totalAmount: '',
    amountPaid: '',
    paymentDate: '',
    balance: '',
    status: '',
    notes: '',
    items: '',
    payments: ''
  };

  const cleanHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

  headers.forEach((header) => {
    const normalized = cleanHeader(header);
    
    if (normalized.includes('invoiceid') || normalized.includes('invoiceno') || normalized.includes('invoicenumber') || normalized === 'id' || normalized === 'no') {
      mapping.id = header;
    } else if (normalized.includes('paymentdate') || (normalized.includes('paid') && normalized.includes('date')) || normalized.includes('datepaid') || normalized.includes('paydate')) {
      mapping.paymentDate = header;
    } else if (normalized.includes('date')) {
      mapping.date = header;
    } else if (normalized.includes('customername') || normalized.includes('clientname') || normalized === 'customer' || normalized === 'client' || normalized === 'name') {
      mapping.customerName = header;
    } else if (normalized.includes('customeremail') || normalized.includes('clientemail') || normalized === 'email') {
      mapping.customerEmail = header;
    } else if (normalized.includes('hotelname') || normalized.includes('hotel') || normalized.includes('property')) {
      mapping.hotelName = header;
    } else if (normalized.includes('totalamount') || normalized.includes('total') || normalized.includes('amount')) {
      // Check if it's "amountpaid" first to avoid collision
      if (!normalized.includes('paid')) {
        mapping.totalAmount = header;
      }
    } else if (normalized.includes('amountpaid') || normalized.includes('paid') || normalized.includes('paidamount')) {
      mapping.amountPaid = header;
    } else if (normalized.includes('balance') || normalized.includes('bal')) {
      mapping.balance = header;
    } else if (normalized.includes('status') || normalized.includes('state')) {
      mapping.status = header;
    } else if (normalized.includes('notes') || normalized.includes('remark') || normalized.includes('comment') || normalized.includes('banking')) {
      mapping.notes = header;
    } else if (normalized.includes('items') || normalized.includes('booking') || normalized.includes('products') || normalized.includes('details') || normalized.includes('rooms')) {
      mapping.items = header;
    } else if (normalized.includes('payments') || normalized.includes('payhistory')) {
      mapping.payments = header;
    }
  });

  // Fallback map standard column indices if headers weren't matched perfectly
  const hasHotelHeader = headers.some(h => {
    const c = cleanHeader(h);
    return c.includes('hotel') || c.includes('property');
  });

  if (!mapping.id && headers[0]) mapping.id = headers[0];
  if (!mapping.date && headers[1]) mapping.date = headers[1];
  if (!mapping.customerName && headers[2]) mapping.customerName = headers[2];
  if (!mapping.customerEmail && headers[3]) mapping.customerEmail = headers[3];

  if (hasHotelHeader) {
    if (!mapping.hotelName) {
      const idx = headers.findIndex(h => {
        const c = cleanHeader(h);
        return c.includes('hotel') || c.includes('property');
      });
      if (idx !== -1) mapping.hotelName = headers[idx];
    }
    // Shift indices if hotel header is at index 4 (standard index for Hotel Name in new sheets)
    const hotelIdx = headers.findIndex(h => {
      const c = cleanHeader(h);
      return c.includes('hotel') || c.includes('property');
    });
    if (hotelIdx === 4) {
      if (!mapping.totalAmount && headers[5]) mapping.totalAmount = headers[5];
      if (!mapping.amountPaid && headers[6]) mapping.amountPaid = headers[6];
      if (!mapping.paymentDate && headers[7]) mapping.paymentDate = headers[7];
      if (!mapping.balance && headers[8]) mapping.balance = headers[8];
      if (!mapping.status && headers[9]) mapping.status = headers[9];
      if (!mapping.notes && headers[10]) mapping.notes = headers[10];
      if (!mapping.items && headers[11]) mapping.items = headers[11];
      if (!mapping.payments && headers[12]) mapping.payments = headers[12];
    } else {
      // Fallback normally by skipping the detected hotel index
      const remainingHeaders = headers.filter((_, idx) => idx !== hotelIdx);
      if (!mapping.totalAmount && remainingHeaders[4]) mapping.totalAmount = remainingHeaders[4];
      if (!mapping.amountPaid && remainingHeaders[5]) mapping.amountPaid = remainingHeaders[5];
      if (!mapping.paymentDate && remainingHeaders[6]) mapping.paymentDate = remainingHeaders[6];
      if (!mapping.balance && remainingHeaders[7]) mapping.balance = remainingHeaders[7];
      if (!mapping.status && remainingHeaders[8]) mapping.status = remainingHeaders[8];
      if (!mapping.notes && remainingHeaders[9]) mapping.notes = remainingHeaders[9];
      if (!mapping.items && remainingHeaders[10]) mapping.items = remainingHeaders[10];
      if (!mapping.payments && remainingHeaders[11]) mapping.payments = remainingHeaders[11];
    }
  } else {
    // No hotel header
    if (!mapping.totalAmount && headers[4]) mapping.totalAmount = headers[4];
    if (!mapping.amountPaid && headers[5]) mapping.amountPaid = headers[5];
    if (!mapping.paymentDate && headers[6]) {
      if (headers[6]?.toLowerCase().includes('payment') || headers[6]?.toLowerCase().includes('date')) {
        mapping.paymentDate = headers[6];
      }
    }
    if (!mapping.balance && headers[7]) mapping.balance = headers[7];
    if (!mapping.status && headers[8]) mapping.status = headers[8];
    if (!mapping.notes && headers[9]) mapping.notes = headers[9];
    if (!mapping.items && headers[10]) mapping.items = headers[10];
    if (!mapping.payments && headers[11]) mapping.payments = headers[11];
  }

  // More resilient mapping logic for standard templates
  if (!mapping.paymentDate) {
    const found = headers.find(h => {
      const c = cleanHeader(h);
      return c.includes('paymentdate') || (c.includes('paid') && c.includes('date'));
    });
    if (found) mapping.paymentDate = found;
  }

  return mapping;
}

// Map row array values into standard Invoice structures
export function parseRowsToInvoices(
  rows: string[][],
  mapping: ColumnMapping,
  headers: string[]
): Invoice[] {
  if (rows.length <= 1) return []; // No data rows
  
  const invoices: Invoice[] = [];

  // Indices of headers
  const getIndex = (headerName: string) => headers.indexOf(headerName);
  
  const idIdx = getIndex(mapping.id);
  const dateIdx = getIndex(mapping.date);
  const nameIdx = getIndex(mapping.customerName);
  const emailIdx = getIndex(mapping.customerEmail);
  const totalAmountIdx = getIndex(mapping.totalAmount);
  const amountPaidIdx = getIndex(mapping.amountPaid);
  const paymentDateIdx = getIndex(mapping.paymentDate);
  const balanceIdx = getIndex(mapping.balance);
  const statusIdx = getIndex(mapping.status);
  const notesIdx = getIndex(mapping.notes);
  const itemsIdx = getIndex(mapping.items);
  const paymentsIdx = getIndex(mapping.payments);
  const hotelNameIdx = getIndex(mapping.hotelName);

  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || !row[idIdx]) continue; // Skip empty rows or rows without IDs
    
    // Parse booking items JSON or fallback to structured text
    let items: BookingItem[] = [];
    const itemsRaw = row[itemsIdx] || '';
    if (itemsRaw) {
      try {
        items = JSON.parse(itemsRaw);
        if (!Array.isArray(items)) {
          items = [];
        }
      } catch (e) {
        // Fallback to text parsing if it's a simple list like "Item 1, Item 2"
        items = itemsRaw.split(',').map((itemStr) => {
          const trimmed = itemStr.trim();
          return {
            roomType: trimmed,
            quantity: 1,
            checkIn: '',
            checkOut: '',
            nights: 1,
            price: 0,
            total: 0
          };
        });
      }
    }

    const totalAmount = parseFloat(row[totalAmountIdx]?.replace(/[^0-9.-]/g, '') || '0') || 0;
    const amountPaid = parseFloat(row[amountPaidIdx]?.replace(/[^0-9.-]/g, '') || '0') || 0;
    const paymentDate = paymentDateIdx !== -1 ? (row[paymentDateIdx] || '') : '';
    // Balance can be retrieved or calculated as totalAmount - amountPaid
    const balance = parseFloat(row[balanceIdx]?.replace(/[^0-9.-]/g, '') || '0') || (totalAmount - amountPaid);

    let notesText = row[notesIdx] || '';
    let hotelName = hotelNameIdx !== -1 ? (row[hotelNameIdx] || '') : '';

    // Extract Hotel Name from notes if not mapped
    if (!hotelName && notesText.includes('--- Hotel:')) {
      try {
        const parts = notesText.split('--- Hotel:');
        if (parts[1]) {
          hotelName = parts[1].split('---')[0].trim();
          notesText = parts[0].trim();
        }
      } catch (e) {}
    }

    let payments: PaymentRecord[] = [];
    const paymentsRaw = paymentsIdx !== -1 ? (row[paymentsIdx] || '') : '';
    if (paymentsRaw) {
      try {
        payments = JSON.parse(paymentsRaw);
      } catch (e) {}
    }

    // 2. If empty, try parsing from notes text
    if ((!payments || payments.length === 0) && notesText.includes('--- Payments:')) {
      try {
        const parts = notesText.split('--- Payments:');
        if (parts[1]) {
          const jsonStr = parts[1].split('---')[0].trim();
          payments = JSON.parse(jsonStr);
          notesText = parts[0].trim(); // Extract clean notes text
        }
      } catch (e) {}
    }

    // 3. Fallback: Seed with single payment if list is still empty but we have an amountPaid
    if ((!payments || payments.length === 0) && amountPaid > 0) {
      payments = [{
        amount: amountPaid,
        date: paymentDate || row[dateIdx] || ''
      }];
    }

    let statusValue: any = (row[statusIdx] || 'Pending').trim();
    // Normalize status
    if (['Paid', 'Due', 'Unpaid', 'Pending', 'Overdue'].includes(statusValue)) {
      // already normalized
    } else if (statusValue.toLowerCase() === 'unpaid') {
      statusValue = 'Unpaid';
    } else if (statusValue.toLowerCase() === 'due') {
      statusValue = 'Due';
    } else if (statusValue.toLowerCase() === 'paid') {
      statusValue = 'Paid';
    } else if (statusValue.toLowerCase() === 'overdue') {
      statusValue = 'Overdue';
    } else {
      statusValue = 'Pending';
    }

    invoices.push({
      rowIndex: i + 1, // Row number in spreadsheet (1-indexed, header is Row 1, so row i is rowIndex i+1)
      id: row[idIdx] || '',
      date: row[dateIdx] || '',
      customerName: row[nameIdx] || '',
      customerEmail: row[emailIdx] || '',
      hotelName,
      totalAmount,
      amountPaid,
      paymentDate,
      balance,
      status: statusValue,
      notes: notesText,
      items,
      payments: payments || [],
      rawRow: row
    });
  }

  return invoices;
}

// Convert Invoice structure to ordered row array based on column mappings
export function invoiceToRowArray(
  invoice: Omit<Invoice, 'rowIndex' | 'rawRow'>,
  mapping: ColumnMapping,
  headers: string[]
): string[] {
  const row: string[] = Array(headers.length).fill('');
  
  const setVal = (headerName: string, val: string) => {
    const idx = headers.indexOf(headerName);
    if (idx !== -1) {
      row[idx] = val;
    }
  };

  setVal(mapping.id, invoice.id);
  setVal(mapping.date, invoice.date);
  setVal(mapping.customerName, invoice.customerName);
  setVal(mapping.customerEmail, invoice.customerEmail);
  setVal(mapping.hotelName, invoice.hotelName || '');
  setVal(mapping.totalAmount, invoice.totalAmount.toString());
  setVal(mapping.amountPaid, invoice.amountPaid.toString());
  setVal(mapping.paymentDate, invoice.paymentDate || '');
  setVal(mapping.balance, invoice.balance.toString());
  setVal(mapping.status, invoice.status);

  // If we have a mapped payments column, store it there.
  // Otherwise, embed it in the notes field so it is 100% stored securely on older sheets too!
  let notesValue = invoice.notes;
  const paymentsJson = JSON.stringify(invoice.payments || []);
  if (mapping.payments) {
    setVal(mapping.payments, paymentsJson);
  } else if (invoice.payments && invoice.payments.length > 0) {
    notesValue = `${invoice.notes.split('\n--- Payments:')[0].trim()}\n--- Payments: ${paymentsJson} ---`;
  }

  if (!mapping.hotelName && invoice.hotelName) {
    notesValue = `${notesValue.split('\n--- Hotel:')[0].trim()}\n--- Hotel: ${invoice.hotelName} ---`;
  }
  setVal(mapping.notes, notesValue);
  
  setVal(mapping.items, JSON.stringify(invoice.items));

  return row;
}

// Add a new invoice (append row)
export async function appendInvoice(
  spreadsheetId: string,
  sheetName: string,
  invoice: Omit<Invoice, 'rowIndex' | 'rawRow'>,
  mapping: ColumnMapping,
  headers: string[],
  accessToken: string
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const rowValues = invoiceToRowArray(invoice, mapping, headers);
  const encodedSheetName = encodeURIComponent(sheetName);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'${encodedSheetName}'!A1:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to append invoice row');
  }
}

// Update an existing invoice (rewrite specific row)
export async function updateInvoiceRow(
  spreadsheetId: string,
  sheetName: string,
  invoice: Invoice,
  mapping: ColumnMapping,
  headers: string[],
  accessToken: string
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  const rowValues = invoiceToRowArray(invoice, mapping, headers);
  const encodedSheetName = encodeURIComponent(sheetName);

  // We write to A{rowIndex}:Z{rowIndex} or similar range to replace the exact row
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/'${encodedSheetName}'!A${invoice.rowIndex}:Z${invoice.rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to update invoice row');
  }
}

// Delete an invoice (mark status as Archived and prefix ID)
export async function deleteInvoiceRow(
  spreadsheetId: string,
  sheetName: string,
  invoice: Invoice,
  mapping: ColumnMapping,
  headers: string[],
  accessToken: string
): Promise<void> {
  const cleanId = extractSpreadsheetId(spreadsheetId);
  
  const updatedInvoice = {
    ...invoice,
    status: 'Archived' as any, // Mark status as Archived
    id: `ARC-${invoice.id}` // Update ID to avoid key collisions
  };

  await updateInvoiceRow(spreadsheetId, sheetName, updatedInvoice, mapping, headers, accessToken);
}
