import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://jybjzbtgpnhkdyofayji.supabase.co";
// Use the publishable/anon key - the secret key was invalid ("Unregistered API key")
// The anon key works for public reads with proper RLS policies
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_FDeECQfWSc89GcQVAUAhyA_QuEfE4AY";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url, method } = req;
  const path = url.replace(/\?.*$/, ""); // Remove query params for matching

  try {
    // GET /api/debug - Diagnostic endpoint to verify Supabase connection
    if (path === "/api/debug" && method === "GET") {
      const { data, error, count } = await supabase
        .from("invoices")
        .select("id", { count: "exact" });
      
      return res.status(200).json({
        supabase_url: supabaseUrl,
        key_prefix: supabaseKey ? supabaseKey.substring(0, 15) + "..." : "MISSING",
        connection: error ? "FAILED" : "OK",
        error: error ? error.message : null,
        invoice_count: data ? data.length : 0,
        invoice_ids: data ? data.map((r) => r.id) : [],
      });
    }

    // GET /api/invoices
    if (path === "/api/invoices" && method === "GET") {
      const invoiceTable = req.query?.invoiceType === "vendor" ? "vendor_invoices" : "invoices";
      const { data, error } = await supabase
        .from(invoiceTable)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const invoices = (data || []).map((row) => ({
        rowIndex: 0,
        id: row.id,
        date: row.date,
        customerName: row.customer_name || "",
        customerId: row.customer_id || "",
        customerEmail: row.customer_email || "",
        customerPhone: row.customer_phone || "",
        totalAmount: Number(row.total_amount || 0),
        amountPaid: Number(row.amount_paid || 0),
        paymentDate: row.payment_date || "",
        balance: Number(row.balance || 0),
        status: row.status || "Pending",
        notes: row.notes || "",
        invoiceType: row.invoice_type || (req.query?.invoiceType === "vendor" ? "vendor" : "customer"),
        items: row.items || [],
        payments: row.payments || [],
      }));

      return res.status(200).json(invoices);
    }

    // POST /api/invoices
    if (path === "/api/invoices" && method === "POST") {
      const inv = req.body;
      if (!inv.id || !inv.date || !inv.customerName || !inv.customerId) {
        return res.status(400).json({ error: "Missing required invoice fields (id, date, customerName, customerId)" });
      }

      const invoiceTable = inv.invoiceType === "vendor" ? "vendor_invoices" : "invoices";
      const { data, error } = await supabase
        .from(invoiceTable)
        .insert({
          id: inv.id,
          date: inv.date,
          customer_name: inv.customerName,
          customer_id: inv.customerId,
          customer_email: inv.customerEmail || "",
          customer_phone: inv.customerPhone || "",
          total_amount: Number(inv.totalAmount || 0),
          amount_paid: Number(inv.amountPaid || 0),
          payment_date: inv.paymentDate || "",
          balance: Number(inv.balance || 0),
          status: inv.status || "Pending",
          notes: inv.notes || "",
          items: inv.items || [],
          payments: inv.payments || [],
          invoice_type: inv.invoiceType || "customer",
        })
        .select();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    // PUT /api/invoices/:id
    const putMatch = path.match(/^\/api\/invoices\/(.+)$/);
    if (putMatch && method === "PUT") {
      const id = putMatch[1];
      const inv = req.body;
      if (!inv.customerId) {
        return res.status(400).json({ error: "customerId is required" });
      }
      const invoiceTable = inv.invoiceType === "vendor" ? "vendor_invoices" : "invoices";
      const { data, error } = await supabase
        .from(invoiceTable)
        .update({
          date: inv.date,
          customer_name: inv.customerName,
          customer_id: inv.customerId,
          customer_email: inv.customerEmail || "",
          customer_phone: inv.customerPhone || "",
          total_amount: Number(inv.totalAmount || 0),
          amount_paid: Number(inv.amountPaid || 0),
          payment_date: inv.paymentDate || "",
          balance: Number(inv.balance || 0),
          status: inv.status || "Pending",
          notes: inv.notes || "",
          items: inv.items || [],
          payments: inv.payments || [],
          invoice_type: inv.invoiceType || "customer",
        })
        .eq("id", id)
        .select();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    // DELETE /api/invoices/:id
    const deleteMatch = path.match(/^\/api\/invoices\/(.+)$/);
    if (deleteMatch && method === "DELETE") {
      const id = deleteMatch[1];
      const invoiceTable = req.query?.invoiceType === "vendor" ? "vendor_invoices" : "invoices";
      const { error } = await supabase.from(invoiceTable).delete().eq("id", id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    // GET /api/settings/:uid
    const settingsGetMatch = path.match(/^\/api\/settings\/(.+)$/);
    if (settingsGetMatch && method === "GET") {
      const uid = settingsGetMatch[1];
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("firebase_uid", uid)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return res.status(200).json(data || null);
    }

    // POST /api/settings
    if (path === "/api/settings" && method === "POST") {
      const settings = req.body;
      if (!settings.firebase_uid) {
        return res.status(400).json({ error: "Missing firebase_uid" });
      }

      const { data: existing } = await supabase
        .from("user_settings")
        .select("id")
        .eq("firebase_uid", settings.firebase_uid)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("user_settings")
          .update({ ...settings, updated_at: new Date().toISOString() })
          .eq("firebase_uid", settings.firebase_uid);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_settings")
          .insert({
            ...settings,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        if (error) throw error;
      }

      return res.status(200).json({ success: true });
    }

    // POST /api/sync-booking-sheet
    if (path === "/api/sync-booking-sheet" && method === "POST") {
      const { invoiceId, customerName, items, spreadsheetId, sheetName, accessToken } = req.body;

      if (!invoiceId || !customerName || !items || !spreadsheetId || !sheetName || !accessToken) {
        return res.status(400).json({ error: "Missing required fields for sheet sync" });
      }

      let cleanSpreadsheetId = spreadsheetId.trim();
      if (cleanSpreadsheetId.includes("docs.google.com/spreadsheets")) {
        const matches = cleanSpreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (matches && matches[1]) {
          cleanSpreadsheetId = matches[1];
        }
      }

      const sheetRange = `'${sheetName}'!A:H`;
      const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}/values/${encodeURIComponent(sheetRange)}`;

      const readResponse = await fetch(readUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      let nextId = 1;
      if (readResponse.ok) {
        const readData = await readResponse.json();
        const existingRows = readData.values || [];
        for (let i = 1; i < existingRows.length; i++) {
          const row = existingRows[i];
          if (row && row[3]) {
            const idNum = parseInt(row[3], 10);
            if (!isNaN(idNum) && idNum >= nextId) {
              nextId = idNum + 1;
            }
          }
        }
      } else {
        const errBody = await readResponse.text();
        throw new Error(`Failed to read spreadsheet (${readResponse.status}): ${errBody}`);
      }

      // Delete existing rows for this invoice
      const fullReadResponse = await fetch(readUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (fullReadResponse.ok) {
        const fullData = await fullReadResponse.json();
        const allRows = fullData.values || [];

        const sheetMetaResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (sheetMetaResponse.ok) {
          const sheetMeta = await sheetMetaResponse.json();
          const targetSheet = sheetMeta.sheets?.find((s) => s.properties?.title === sheetName);
          const sheetId = targetSheet?.properties?.sheetId || 0;

          const rowsToDelete = [];
          for (let i = 1; i < allRows.length; i++) {
            if (allRows[i] && allRows[i][5] === invoiceId) {
              rowsToDelete.push(i);
            }
          }

          if (rowsToDelete.length > 0) {
            const deleteRequests = rowsToDelete
              .sort((a, b) => b - a)
              .map((rowIdx) => ({
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: rowIdx,
                    endIndex: rowIdx + 1,
                  },
                },
              }));

            await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}:batchUpdate`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ requests: deleteRequests }),
              }
            );

            const reReadResponse = await fetch(readUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (reReadResponse.ok) {
              const reReadData = await reReadResponse.json();
              const remainingRows = reReadData.values || [];
              nextId = 1;
              for (let i = 1; i < remainingRows.length; i++) {
                const row = remainingRows[i];
                if (row && row[3]) {
                  const idNum = parseInt(row[3], 10);
                  if (!isNaN(idNum) && idNum >= nextId) {
                    nextId = idNum + 1;
                  }
                }
              }
            }
          }
        }
      }

      // Build new rows
      const newRows = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const formatDate = (dateStr) => {
          if (!dateStr) return "";
          try {
            const d = new Date(dateStr);
            return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
          } catch {
            return dateStr;
          }
        };

        newRows.push([
          formatDate(item.checkIn),
          formatDate(item.checkOut),
          String(item.nights || 1),
          String(nextId + i),
          customerName,
          invoiceId,
          String(item.quantity || 1),
          item.roomType || "",
        ]);
      }

      // Append new rows
      if (newRows.length > 0) {
        const appendRange = encodeURIComponent(`'${sheetName}'!A1`);
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${cleanSpreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`;

        const appendResponse = await fetch(appendUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: newRows }),
        });

        if (!appendResponse.ok) {
          const errorData = await appendResponse.json().catch(() => ({}));
          throw new Error(errorData.error?.message || "Failed to append booking rows");
        }
      }

      return res.status(200).json({ success: true, rowsAdded: newRows.length, startId: nextId });
    }

    // GET /api/public-invoice/:id - Public endpoint to fetch a single invoice
    const publicInvoiceMatch = path.match(/^\/api\/public-invoice\/(.+)$/);
    if (publicInvoiceMatch && method === "GET") {
      const rawId = decodeURIComponent(publicInvoiceMatch[1]).trim();
      if (!rawId) {
        return res.status(400).json({ error: "Invoice ID is required" });
      }

      // Fetch ALL invoices and do flexible matching (most reliable approach)
      const { data: allInvoices, error: fetchAllError } = await supabase
        .from("invoices")
        .select("*");

      if (fetchAllError) {
        console.error("[public-invoice] Supabase error:", fetchAllError);
        return res.status(500).json({ 
          error: "Database query failed", 
          details: fetchAllError.message,
          hint: fetchAllError.hint || null
        });
      }

      if (!allInvoices || allInvoices.length === 0) {
        return res.status(404).json({ 
          error: "No invoices exist in database",
          searched: rawId,
          debug_url: supabaseUrl
        });
      }

      // Flexible matching: exact, case-insensitive, with/without prefix
      const rawIdUpper = rawId.toUpperCase();
      let numericPart = rawId;
      if (rawIdUpper.startsWith("INV-") || rawIdUpper.startsWith("REF-")) {
        numericPart = rawId.substring(4);
      }

      let data = allInvoices.find((inv) => {
        const invId = (inv.id || "").toString();
        const invIdUpper = invId.toUpperCase();
        // Exact match
        if (invId === rawId) return true;
        // Case-insensitive match
        if (invIdUpper === rawIdUpper) return true;
        // Input has no prefix, DB has INV- prefix
        if (invIdUpper === `INV-${rawIdUpper}`) return true;
        // Input has prefix, DB has no prefix
        if (`INV-${invIdUpper}` === rawIdUpper) return true;
        // Match numeric part
        const invNumeric = invIdUpper.startsWith("INV-") ? invId.substring(4) : invId;
        if (invNumeric === numericPart) return true;
        return false;
      });

      if (!data) {
        return res.status(404).json({ 
          error: "Invoice not found", 
          searched: rawId,
          total_invoices: allInvoices.length,
          sample_ids: allInvoices.slice(0, 5).map((i) => i.id)
        });
      }

      const invoice = {
        id: data.id,
        date: data.date,
        customerName: data.customer_name || "",
        customerId: data.customer_id || "",
        customerEmail: data.customer_email || "",
        customerPhone: data.customer_phone || "",
        totalAmount: Number(data.total_amount || 0),
        amountPaid: Number(data.amount_paid || 0),
        paymentDate: data.payment_date || "",
        balance: Number(data.balance || 0),
        status: data.status || "Pending",
        notes: data.notes || "",
        invoiceType: data.invoice_type || "customer",
        items: data.items || [],
        payments: data.payments || [],
      };

      return res.status(200).json(invoice);
    }

    return res.status(404).json({ error: "API route not found" });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
