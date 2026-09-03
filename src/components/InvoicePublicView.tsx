import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Users,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Printer,
  Phone,
  Mail,
  MapPin,
  Waves,
} from 'lucide-react';

const BRAND_MARK =
  'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfoacajra/logo-finnova-n-mark.png';

interface BookingItem {
  roomType: string;
  quantity: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  price: number;
  total: number;
}

interface InvoiceRecord {
  id: string;
  date: string;
  customerName: string;
  customerEmail: string;
  hotelName: string;
  totalAmount: number;
  amountPaid: number;
  paymentDate: string;
  balance: number;
  status: string;
  notes: string;
  items: BookingItem[];
  payments: { amount: number; date: string }[];
}

interface SpreadsheetRow {
  room: string;
  checkIn: string;
  checkout: string;
  nights: number;
  roomPrice: number;
  total: number;
  sum: number;
  due: number;
  group: string;
  ref: string;
}

interface SpreadsheetData {
  invoiceNumber: string;
  refValue: string;
  group: string;
  rows: SpreadsheetRow[];
  totalAmount: number;
  totalDue: number;
  headers: string[];
}

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function InvoicePublicView() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(
    (location.state as any)?.invoiceData || null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!invoiceId) {
      setError('No invoice number provided');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Normalize the invoice ID - strip prefixes for the spreadsheet lookup
        let lookupId = invoiceId!;
        if (lookupId.toUpperCase().startsWith("INV-")) {
          lookupId = lookupId.substring(4);
        } else if (lookupId.toUpperCase().startsWith("REF-")) {
          lookupId = lookupId.substring(4);
        }

        // Fetch both invoice record (server API) and spreadsheet data in parallel
        const [invoiceRes, sheetRes] = await Promise.allSettled([
          fetch(`/api/public-invoice/${encodeURIComponent(invoiceId!)}`),
          fetch(`/api/lookup-invoice/${encodeURIComponent(lookupId)}`),
        ]);

        // Process invoice record from server API
        if (invoiceRes.status === 'fulfilled' && invoiceRes.value.ok) {
          const invoiceData = await invoiceRes.value.json();
          setInvoice(invoiceData);
        } else if (invoiceRes.status === 'fulfilled') {
          // Log the error response for debugging
          const errBody = await invoiceRes.value.json().catch(() => ({}));
          console.warn('[InvoicePublicView] Server invoice lookup failed:', invoiceRes.value.status, errBody);
        }

        // Process spreadsheet data
        if (sheetRes.status === 'fulfilled' && sheetRes.value.ok) {
          const sheetData = await sheetRes.value.json();
          if (sheetData.rows && sheetData.rows.length > 0) {
            setSpreadsheetData(sheetData);
          }
        }

        // If neither returned data, show error
        const hasStateData = !!(location.state as any)?.invoiceData;
        if (
          (invoiceRes.status !== 'fulfilled' || !invoiceRes.value.ok) &&
          (sheetRes.status !== 'fulfilled' || !sheetRes.value.ok) &&
          !hasStateData
        ) {
          setError('Invoice not found. Please check the invoice number and try again.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [invoiceId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-4">
          <div className="w-9 h-9 border-[3px] border-hairline border-t-brand rounded-full animate-spin" />
          <p className="text-[12px] font-bold text-quill">Loading invoice…</p>
        </div>
      </div>
    );
  }

  if (error && !invoice && !spreadsheetData) {
    return (
      <div className="min-h-screen bg-canvas px-3 sm:px-5 py-4 sm:py-6">
        <div className="max-w-[600px] mx-auto">
          <header className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate('/track')}
              className="w-10 h-10 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-ink" />
            </button>
            <a href="/" className="flex items-center gap-2.5 no-underline">
              <img src={BRAND_MARK} alt="" className="w-8 h-8 object-contain" />
              <span className="text-[16px] font-extrabold tracking-tight text-ink font-display">FINNOVA</span>
            </a>
          </header>

          <div className="bg-shell rounded-[28px] p-8 text-center shadow-[0_20px_60px_-30px_rgba(19,17,38,0.15)]">
            <span className="w-14 h-14 rounded-2xl bg-[#fdeeea] flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-[#a8492f]" />
            </span>
            <h2 className="text-[18px] font-extrabold text-ink font-display">Invoice Not Found</h2>
            <p className="text-[13px] text-quill mt-2 max-w-sm mx-auto leading-relaxed font-medium">{error}</p>
            <button
              onClick={() => navigate('/track')}
              className="mt-6 bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-6 py-3 rounded-full transition-colors cursor-pointer"
            >
              Try Another Number
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isPaid = invoice ? invoice.balance <= 0 : (spreadsheetData ? spreadsheetData.totalDue <= 0 : false);

  return (
    <div className="min-h-screen bg-canvas px-3 sm:px-5 py-4 sm:py-6 print:bg-white print:p-0">
      <div className="max-w-[900px] mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 mb-6 print:hidden">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/track')}
              className="w-10 h-10 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-ink" />
            </button>
            <a href="/" className="flex items-center gap-2.5 no-underline">
              <img src={BRAND_MARK} alt="" className="w-8 h-8 object-contain" />
              <span className="text-[16px] font-extrabold tracking-tight text-ink font-display">FINNOVA</span>
            </a>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-ink hover:bg-ink-2 text-white text-[12px] font-bold px-5 py-3 rounded-full transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </header>

        {/* ===== INVOICE CARD (from Supabase) ===== */}
        {invoice && (
          <div className="bg-shell rounded-[30px] overflow-hidden shadow-[0_40px_90px_-60px_rgba(19,17,38,0.25)] mb-6 print:shadow-none print:rounded-none">
            {/* Branding Header */}
            <div className="p-7 sm:p-8 space-y-7">
              {/* Top branding */}
              <div className="flex flex-wrap justify-between items-start gap-4 pb-6 border-b border-hairline">
                <div className="flex items-center gap-3">
                  <img src={BRAND_MARK} alt="" className="w-12 h-12 object-contain rounded-xl" />
                  <div>
                    <h1 className="text-[26px] leading-none font-extrabold tracking-tight text-ink font-display">
                      FINNOVA
                    </h1>
                    <p className="text-[10px] text-quill-soft font-bold uppercase tracking-wider mt-1.5">
                      Smart Finances, Better Business
                    </p>
                  </div>
                </div>
                <Waves className="w-9 h-9 text-brand-soft" />
              </div>

              {/* Guest + invoice meta */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-5">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-quill-soft uppercase tracking-wider">Billed to</span>
                  <div className="text-[19px] font-extrabold text-ink tracking-tight font-display">
                    {invoice.customerName}
                  </div>
                  {invoice.customerEmail && (
                    <div className="text-[12px] text-quill font-semibold">{invoice.customerEmail}</div>
                  )}
                  {invoice.hotelName && (
                    <div className="text-[12px] text-quill font-semibold">
                      <span className="text-quill-soft">Property: </span>
                      {invoice.hotelName}
                    </div>
                  )}
                </div>

                <div className="bg-brand text-white rounded-[18px] overflow-hidden flex min-w-[240px]">
                  <div className="p-4 flex-1 text-center border-r border-white/15">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-white/65">Invoice no</div>
                    <div className="nums text-[15px] font-extrabold mt-1">{invoice.id}</div>
                  </div>
                  <div className="p-4 flex-1 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-white/65">Date</div>
                    <div className="nums text-[13px] font-bold mt-1.5">{invoice.date}</div>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              {invoice.items && invoice.items.length > 0 && (
                <div className="bg-mist rounded-[18px] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-quill font-bold text-[10px] uppercase tracking-wider">
                        <th className="py-3.5 px-4">Room</th>
                        <th className="py-3.5 px-4 text-center">Qty</th>
                        <th className="py-3.5 px-4 text-center">Check-in</th>
                        <th className="py-3.5 px-4 text-center">Check-out</th>
                        <th className="py-3.5 px-4 text-center">Nights</th>
                        <th className="py-3.5 px-4 text-right">Price</th>
                        <th className="py-3.5 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="text-ink text-[12px]">
                      {invoice.items.map((item, idx) => (
                        <tr key={idx} className="bg-shell border-t-4 border-mist">
                          <td className="py-3.5 px-4 font-bold">{item.roomType || 'Standard room'}</td>
                          <td className="nums py-3.5 px-4 text-center font-semibold">{item.quantity}</td>
                          <td className="nums py-3.5 px-4 text-center text-[11px] text-quill font-semibold">
                            {item.checkIn || '—'}
                          </td>
                          <td className="nums py-3.5 px-4 text-center text-[11px] text-quill font-semibold">
                            {item.checkOut || '—'}
                          </td>
                          <td className="nums py-3.5 px-4 text-center font-semibold">{item.nights}</td>
                          <td className="nums py-3.5 px-4 text-right font-semibold">
                            ${money(item.price)}
                          </td>
                          <td className="nums py-3.5 px-4 text-right font-bold">
                            ${money(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Terms + Totals */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
                <div className="space-y-5">
                  {invoice.notes && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-quill-soft block mb-1.5">
                        Notes & Payment Info
                      </span>
                      <p className="text-[11px] text-quill leading-relaxed font-medium whitespace-pre-line">
                        {invoice.notes}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-quill-soft block mb-1.5">
                      Terms & conditions
                    </span>
                    <p className="text-[11px] text-quill leading-relaxed font-medium">
                      Any delay in payment will be subject to a late payment fee. Thank you for your residency.
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] font-semibold text-quill">Total amount</span>
                    <span className="nums text-[17px] font-extrabold text-ink font-display">
                      ${money(invoice.totalAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between items-start pt-3 border-t border-hairline">
                    <span className="text-[12px] font-semibold text-quill">Amount paid</span>
                    <div className="text-right">
                      <span className="nums text-[15px] font-bold text-[#3f9c68]">
                        ${money(invoice.amountPaid)}
                      </span>
                      {invoice.paymentDate && (
                        <div className="nums text-[10px] text-quill-soft mt-0.5 font-semibold">
                          {invoice.paymentDate}
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className={`${
                      invoice.balance === 0
                        ? 'bg-[#3f9c68]'
                        : invoice.balance < 0
                          ? 'bg-brand'
                          : 'bg-[#c0453c]'
                    } text-white px-5 py-4 rounded-[16px] flex justify-between items-center`}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      {invoice.balance < 0
                        ? 'Change due'
                        : invoice.balance === 0
                          ? 'Paid in full'
                          : 'Balance due'}
                    </span>
                    <span className="nums text-[17px] font-extrabold font-display">
                      {invoice.balance < 0
                        ? `-$${money(Math.abs(invoice.balance))}`
                        : `$${money(invoice.balance)}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contact footer */}
              <div className="border-t border-hairline pt-5 flex flex-col md:flex-row justify-between items-center gap-3 text-[11px] text-quill font-semibold">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-brand" />
                  <span>123-456-7890</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-brand" />
                  <span>billing@finnova.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-brand" />
                  <span>123 Anywhere St., Any City</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== SPREADSHEET DATA CARD (from Google Sheets MASTER) ===== */}
        {spreadsheetData && spreadsheetData.rows.length > 0 && (
          <div className="bg-shell rounded-[30px] overflow-hidden shadow-[0_40px_90px_-60px_rgba(19,17,38,0.25)] animate-fade-in print:shadow-none print:rounded-none">
            {/* Top Banner */}
            <div className="bg-ink px-6 sm:px-8 py-6 sm:py-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-6 h-6 text-brand-soft" />
                    <span className="text-[16px] font-extrabold text-white font-display">Booking Details</span>
                  </div>
                  <p className="text-[11px] text-white/50 font-semibold">Data from MASTER spreadsheet</p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="block text-[11px] font-bold text-white/50 uppercase tracking-wider">Reference</span>
                  <span className="block text-[22px] font-extrabold text-white font-display mt-1">
                    {spreadsheetData.refValue}
                  </span>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="px-6 sm:px-8 py-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                <div className="bg-mist rounded-[18px] p-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-quill-soft uppercase tracking-wider">
                    <Users className="w-3.5 h-3.5" /> Group
                  </span>
                  <span className="block text-[14px] font-extrabold text-ink mt-2 truncate font-display">
                    {spreadsheetData.group || '—'}
                  </span>
                </div>

                <div className="bg-mist rounded-[18px] p-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-quill-soft uppercase tracking-wider">
                    <FileText className="w-3.5 h-3.5" /> Rooms
                  </span>
                  <span className="nums block text-[14px] font-extrabold text-ink mt-2 font-display">
                    {spreadsheetData.rows.length}
                  </span>
                </div>

                <div className="bg-mist rounded-[18px] p-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-quill-soft uppercase tracking-wider">
                    <DollarSign className="w-3.5 h-3.5" /> Total
                  </span>
                  <span className="nums block text-[14px] font-extrabold text-ink mt-2 font-display">
                    ${money(spreadsheetData.totalAmount)}
                  </span>
                </div>

                <div className={`rounded-[18px] p-4 ${spreadsheetData.totalDue <= 0 ? 'bg-[#e8f7ee]' : 'bg-[#fdeeea]'}`}>
                  <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${spreadsheetData.totalDue <= 0 ? 'text-[#2f6b48]' : 'text-[#a8492f]'}`}>
                    {spreadsheetData.totalDue <= 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {spreadsheetData.totalDue <= 0 ? 'Settled' : 'Balance Due'}
                  </span>
                  <span className={`nums block text-[14px] font-extrabold mt-2 font-display ${spreadsheetData.totalDue <= 0 ? 'text-[#2f6b48]' : 'text-[#a8492f]'}`}>
                    ${money(spreadsheetData.totalDue <= 0 ? 0 : spreadsheetData.totalDue)}
                  </span>
                </div>
              </div>

              {/* Booking Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 pr-4">Room</th>
                      <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 pr-4">Check In</th>
                      <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 pr-4">Checkout</th>
                      <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 pr-4 text-right">Nights</th>
                      <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 pr-4 text-right">Rate</th>
                      <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 pr-4 text-right">Total</th>
                      <th className="text-[10px] font-bold text-quill-soft uppercase tracking-wider pb-3 text-right">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spreadsheetData.rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-hairline/50 last:border-b-0">
                        <td className="py-3 pr-4">
                          <span className="text-[12px] font-bold text-ink">{row.room || '—'}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-[12px] font-medium text-quill">{row.checkIn || '—'}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-[12px] font-medium text-quill">{row.checkout || '—'}</span>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className="nums text-[12px] font-bold text-ink">{row.nights}</span>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className="nums text-[12px] font-medium text-quill">${money(row.roomPrice)}</span>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span className="nums text-[12px] font-bold text-ink">${money(row.total)}</span>
                        </td>
                        <td className="py-3 text-right">
                          <span className={`nums text-[12px] font-bold ${row.due > 0 ? 'text-[#a8492f]' : 'text-[#2f6b48]'}`}>
                            ${money(row.due)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Footer */}
              <div className="mt-6 pt-5 border-t border-hairline flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="block text-[10px] font-bold text-quill-soft uppercase tracking-wider">Grand Total</span>
                    <span className="nums block text-[18px] font-extrabold text-ink mt-1 font-display">
                      ${money(spreadsheetData.totalAmount)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-quill-soft uppercase tracking-wider">Paid</span>
                    <span className="nums block text-[18px] font-extrabold text-[#2f6b48] mt-1 font-display">
                      ${money(spreadsheetData.totalAmount - spreadsheetData.totalDue)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-quill-soft uppercase tracking-wider">Balance</span>
                    <span className={`nums block text-[18px] font-extrabold mt-1 font-display ${spreadsheetData.totalDue > 0 ? 'text-[#a8492f]' : 'text-[#2f6b48]'}`}>
                      ${money(spreadsheetData.totalDue)}
                    </span>
                  </div>
                </div>

                <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-bold ${spreadsheetData.totalDue <= 0 ? 'bg-[#e8f7ee] text-[#2f6b48]' : 'bg-[#fdeeea] text-[#a8492f]'}`}>
                  {spreadsheetData.totalDue <= 0 ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {spreadsheetData.totalDue <= 0 ? 'Fully Settled' : 'Payment Outstanding'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* If only spreadsheet data exists but no invoice record */}
        {!invoice && !spreadsheetData && (
          <div className="bg-shell rounded-[28px] p-8 text-center shadow-[0_20px_60px_-30px_rgba(19,17,38,0.15)]">
            <span className="w-14 h-14 rounded-2xl bg-[#fdeeea] flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-[#a8492f]" />
            </span>
            <h2 className="text-[18px] font-extrabold text-ink font-display">No Data Found</h2>
            <p className="text-[13px] text-quill mt-2 max-w-sm mx-auto leading-relaxed font-medium">
              No invoice or booking data found for this reference number.
            </p>
            <button
              onClick={() => navigate('/track')}
              className="mt-6 bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-6 py-3 rounded-full transition-colors cursor-pointer"
            >
              Try Another Number
            </button>
          </div>
        )}

        <footer className="mt-8 text-center print:hidden">
          <span className="text-[11px] font-semibold text-quill-soft">
            FINNOVA © 2026 · Smart Finances, Better Business
          </span>
        </footer>
      </div>
    </div>
  );
}
