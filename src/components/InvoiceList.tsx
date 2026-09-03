import { useState, useEffect } from 'react';
import { Invoice } from '../types';
import { InvoiceTemplate, getCurrencySymbol } from '../lib/settings';
import { Search, Eye, Edit2, CheckCircle, Trash2, Printer, FileText, Mail, Phone, MapPin, X, Plus, Waves } from 'lucide-react';
import InvoiceQRCode from './InvoiceQRCode';

interface InvoiceListProps {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => Promise<void>;
  onMarkAsPaid: (invoice: Invoice) => Promise<void>;
  template?: InvoiceTemplate | null;
}

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function InvoiceList({ invoices, onEdit, onDelete, onMarkAsPaid, template }: InvoiceListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(50);

  const currencySymbol = getCurrencySymbol(template?.currency || 'USD');

  useEffect(() => {
    setVisibleCount(50);
  }, [search, statusFilter]);

  const filteredInvoices = invoices.filter((inv) => {
    if (inv.status === ('Archived' as any)) return false;

    const matchesSearch =
      inv.id.toLowerCase().includes(search.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(search.toLowerCase()) ||
      inv.customerEmail.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusStyle = (status: Invoice['status']) => {
    switch (status) {
      case 'Paid':
        return 'bg-[#e8f7ee] text-[#2f6b48]';
      case 'Due':
      case 'Pending':
        return 'bg-[#fdf3e2] text-[#8a5c17]';
      case 'Unpaid':
        return 'bg-[#fdeeea] text-[#a8492f]';
      case 'Overdue':
        return 'bg-brand-pale text-brand';
      default:
        return 'bg-mist text-quill';
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('invoice-receipt-body')?.cloneNode(true) as HTMLElement;
    if (!printContent) return;

    // Force responsive classes to their expanded state for print
    const forceResponsiveClasses = (el: HTMLElement) => {
      const all = el.querySelectorAll('*');
      const process = (node: Element) => {
        const cl = node.classList;
        // lg:grid-cols-2 → grid-cols-2
        if (cl.contains('lg:grid-cols-2')) {
          cl.remove('grid-cols-1', 'lg:grid-cols-2');
          cl.add('grid-cols-2');
        }
        // sm:flex-row → flex-row
        if (cl.contains('sm:flex-row')) {
          cl.remove('flex-col', 'sm:flex-row');
          cl.add('flex-row');
        }
        // md:flex-row → flex-row
        if (cl.contains('md:flex-row')) {
          cl.remove('flex-col', 'md:flex-row');
          cl.add('flex-row');
        }
        // sm:p-8 → p-8
        if (cl.contains('sm:p-8')) {
          cl.remove('sm:p-8');
          cl.add('p-8');
        }
      };
      process(el);
      all.forEach(n => process(n));
    };
    forceResponsiveClasses(printContent);

    // Add 3 rows of empty white spacing gap in the booking table for print
    const tableBody = printContent.querySelector('tbody');
    if (tableBody) {
      for (let i = 0; i < 3; i++) {
        const emptyRow = document.createElement('tr');
        emptyRow.setAttribute('style', 'border: none !important; border-top: none !important; border-bottom: none !important; background-color: #ffffff !important;');
        emptyRow.className = '';
        emptyRow.innerHTML = `
          <td colspan="7" style="padding: 14px 0; border: none !important; border-top: none !important; border-bottom: none !important; background-color: #ffffff !important;"></td>
        `;
        tableBody.appendChild(emptyRow);
      }
    }

    // Add gap between Terms & Conditions and Payment Information sections (print only)
    // Find the grid section with Terms + Totals and increase internal spacing
    const gridSection = printContent.querySelector('.grid.grid-cols-1');
    if (gridSection) {
      // Left column: increase gap between Terms text and Payment Info box
      const leftCol = gridSection.querySelector('.space-y-5');
      if (leftCol) {
        leftCol.classList.remove('space-y-5');
        leftCol.setAttribute('style', 'display: flex; flex-direction: column; gap: 2.5rem;');
      }
      // Right column: increase gap between Amount paid and Change Due
      const rightCol = gridSection.querySelector('[class*="space-y-3"]');
      if (rightCol) {
        rightCol.setAttribute('style', 'display: flex; flex-direction: column; gap: 1.5rem;');
      }
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${template?.companyName || 'FINNOVA'} - Invoice #${selectedInvoice?.id}</title>
            <meta charset="utf-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <script>
              tailwind.config = {
                theme: {
                  extend: {
                    colors: {
                      canvas: '#eceaf6',
                      shell: '#ffffff',
                      mist: '#f6f5fb',
                      'mist-2': '#edecf6',
                      hairline: '#e6e4f0',
                      ink: '#131126',
                      'ink-2': '#1e1b36',
                      'ink-3': '#2b2750',
                      brand: '#5a49e6',
                      'brand-mid': '#6d5cf0',
                      'brand-soft': '#8a7bf5',
                      'brand-pale': '#f0eefe',
                      quill: '#6c6885',
                      'quill-soft': '#9d99b4',
                    },
                    fontFamily: {
                      sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                      display: ['Urbanist', 'Manrope', 'sans-serif'],
                      mono: ['JetBrains Mono', 'monospace'],
                    },
                    borderRadius: {
                      '2xl': '16px',
                      '3xl': '22px',
                    }
                  }
                }
              }
            </script>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Urbanist:wght@500;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');

              body {
                font-family: 'Manrope', sans-serif;
                background-color: white !important;
                color: #131126 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                padding: 40px;
                margin: 0;
              }
              .font-display { font-family: 'Urbanist', sans-serif !important; }
              .font-mono { font-family: 'JetBrains Mono', monospace !important; }
              .nums { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }

              /* Custom theme classes for print */
              .bg-shell { background-color: #ffffff !important; }
              .bg-mist { background-color: #f6f5fb !important; }
              .bg-mist-2 { background-color: #edecf6 !important; }
              .bg-canvas { background-color: #eceaf6 !important; }
              .bg-ink { background-color: #131126 !important; }
              .bg-brand { background-color: #5a49e6 !important; }
              .bg-brand-pale { background-color: #f0eefe !important; }
              .text-ink { color: #131126 !important; }
              .text-quill { color: #6c6885 !important; }
              .text-quill-soft { color: #9d99b4 !important; }
              .text-brand { color: #5a49e6 !important; }
              .text-brand-soft { color: #8a7bf5 !important; }
              .border-hairline { border-color: #e6e4f0 !important; }
              .border-mist { border-color: #f6f5fb !important; }

              /* Ensure grid-cols-2 works (DOM manipulation removes responsive prefixes) */
              .grid-cols-2 {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              }
              .flex-row {
                flex-direction: row !important;
              }

              /* Match the exact spacing from the invoice view (space-y-7 = 1.75rem) */
              .invoice-print-body > * + * {
                margin-top: 1.75rem !important;
              }

              /* Match the padding from the invoice view (p-8 = 2rem) */
              .invoice-print-body {
                padding: 2rem;
              }

              /* Ensure the divider gap matches exactly */
              .invoice-print-body .border-b {
                padding-bottom: 1.5rem !important;
              }

              /* Footer positioning for print */
              .invoice-print-body {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                position: relative;
              }
              .invoice-print-body > *:last-child {
                margin-top: auto !important;
                padding-top: 2rem;
              }

              /* Hide borders on empty spacing rows */
              tbody tr[style*="background-color: #ffffff"] {
                border: none !important;
                border-top: none !important;
                border-bottom: none !important;
              }
              tbody tr[style*="background-color: #ffffff"] td {
                border: none !important;
                border-top: none !important;
                border-bottom: none !important;
              }
              /* Override any table border-spacing that might show lines */
              table {
                border-collapse: collapse;
              }
              .border-t-4 {
                border-top-width: 4px;
              }
              /* But not on our spacing rows */
              tr[style*="background-color: #ffffff"].border-t-4,
              tr[style*="background-color: #ffffff"] {
                border-top: none !important;
              }

              @media print {
                body { padding: 0; margin: 0; }
                .invoice-print-body {
                  padding: 2rem;
                  min-height: 100vh;
                  display: flex;
                  flex-direction: column;
                }
                .invoice-print-body > * + * {
                  margin-top: 1.75rem !important;
                }
                .invoice-print-body > *:last-child {
                  margin-top: auto !important;
                  padding-top: 2rem;
                }
                tbody tr[style*="background-color: #ffffff"],
                tbody tr[style*="background-color: #ffffff"] td {
                  border: none !important;
                  background-color: #ffffff !important;
                }
                .bg-brand { background-color: #5a49e6 !important; }
                .bg-mist { background-color: #f6f5fb !important; }
                .bg-shell { background-color: #ffffff !important; }
                .text-white { color: #ffffff !important; }
              }
            </style>
          </head>
          <body>
            <div class="max-w-4xl mx-auto invoice-print-body">
              ${printContent.innerHTML}
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 400);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-5" id="invoice-list-section">
      {/* Search & status pills */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-quill pointer-events-none" />
          <input
            type="text"
            placeholder="Search invoice #, customer or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search the ledger"
            className="w-full bg-mist hover:bg-mist-2 focus:bg-mist-2 rounded-full pl-11 pr-4 py-3 text-[12px] font-semibold text-ink placeholder:text-quill-soft placeholder:font-medium outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {['All', 'Paid', 'Due', 'Unpaid', 'Pending', 'Overdue'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                statusFilter === status ? 'bg-brand text-white' : 'bg-mist text-quill hover:md:bg-mist-2'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-5 ${selectedInvoice ? 'xl:grid-cols-3' : ''}`}>
        {/* Ledger table */}
        <div className={`bg-mist rounded-[22px] overflow-hidden ${selectedInvoice ? 'xl:col-span-1' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-quill font-bold text-[10px] uppercase tracking-wider">
                  <th className="py-4 px-5">Invoice</th>
                  <th className="py-4 px-5">Customer</th>
                  <th className="py-4 px-5">Date</th>
                  <th className="py-4 px-5 text-right">Total</th>
                  <th className="py-4 px-5 text-right">Paid</th>
                  <th className="py-4 px-5 text-right">Balance</th>
                  <th className="py-4 px-5 text-center">Status</th>
                  <th className="py-4 px-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-ink">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 px-6 text-center">
                      <p className="text-[13px] font-bold text-ink">No invoices match these filters</p>
                      <p className="text-[11px] text-quill-soft mt-1.5 font-medium">
                        Widen the status pills or clear the search to see more.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.slice(0, visibleCount).map((inv, index) => (
                    <tr
                      key={`${inv.id}-${inv.rowIndex || index}`}
                      className={`bg-shell border-t-4 border-mist transition-colors duration-200 hover:md:bg-brand-pale/60 ${
                        selectedInvoice?.id === inv.id ? 'bg-brand-pale' : ''
                      }`}
                    >
                      <td className="py-4 px-5">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(inv)}
                          className="flex items-center gap-1.5 text-[12px] font-bold text-brand hover:text-brand-mid transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          #{inv.id}
                        </button>
                      </td>

                      <td className="py-4 px-5">
                        <div className="text-[12px] font-bold text-ink">{inv.customerName}</div>
                        {inv.customerEmail && (
                          <div className="text-[10px] text-quill-soft mt-0.5 font-medium">{inv.customerEmail}</div>
                        )}
                        {inv.hotelName && (
                          <div className="text-[9px] bg-mist text-quill px-2 py-0.5 rounded-full font-bold w-max mt-1.5 uppercase tracking-wider">
                            {inv.hotelName}
                          </div>
                        )}
                      </td>

                      <td className="nums py-4 px-5 text-[12px] text-quill font-semibold">{inv.date}</td>

                      <td className="nums py-4 px-5 text-right text-[12px] font-bold text-ink">
                        {currencySymbol}{money(inv.totalAmount)}
                      </td>

                      <td className="nums py-4 px-5 text-right text-[12px] font-semibold text-[#3f9c68]">
                        {currencySymbol}{money(inv.amountPaid)}
                      </td>

                      <td
                        className={`nums py-4 px-5 text-right text-[12px] font-bold ${
                          inv.balance === 0 ? 'text-[#3f9c68]' : inv.balance < 0 ? 'text-brand' : 'text-[#c0453c]'
                        }`}
                      >
                        {inv.balance < 0
                          ? `-${currencySymbol}${money(Math.abs(inv.balance))}`
                          : `${currencySymbol}${money(inv.balance)}`}
                      </td>

                      <td className="py-4 px-5 text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold ${getStatusStyle(inv.status)}`}
                        >
                          {inv.status}
                        </span>
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(inv)}
                            title="View invoice"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-quill hover:text-brand hover:bg-brand-pale transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onEdit(inv)}
                            title="Edit invoice"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-quill hover:text-[#8a5c17] hover:bg-[#fdf3e2] transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {inv.status !== 'Paid' && (
                            <button
                              type="button"
                              onClick={() => onMarkAsPaid(inv)}
                              title="Settle invoice"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-quill hover:text-[#2f6b48] hover:bg-[#e8f7ee] transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onDelete(inv)}
                            title="Delete invoice"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-quill hover:text-[#c0453c] hover:bg-[#fdeeea] transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="nums text-[11px] font-bold text-quill">
              Showing {Math.min(visibleCount, filteredInvoices.length)} of {filteredInvoices.length}
            </span>
            {filteredInvoices.length > visibleCount && (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 50)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand hover:bg-brand-mid text-white font-bold px-5 py-2.5 rounded-full text-[11px] transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Plus className="w-3.5 h-3.5" />
                Load 50 more
              </button>
            )}
          </div>
        </div>

        {/* Receipt preview */}
        {selectedInvoice && (
          <div
            className="bg-shell rounded-[22px] overflow-hidden flex flex-col xl:col-span-2 animate-fade-in print:fixed print:inset-0 print:bg-white print:z-50 print:p-0 shadow-[0_24px_50px_-36px_rgba(19,17,38,0.6)]"
            id="invoice-detail-preview"
          >
            <div className="bg-ink text-white px-5 py-4 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-soft" />
                <span className="text-[13px] font-bold">Receipt #{selectedInvoice.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-white/12 hover:bg-white/22 text-[11px] font-bold px-4 py-2 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  title="Close preview"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/65 hover:text-white hover:bg-white/12 transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              id="invoice-receipt-body"
              className="p-7 sm:p-8 overflow-y-auto flex-1 space-y-7 print:overflow-visible print:p-0 bg-shell"
            >
              {/* Branding */}
              <div className="flex flex-wrap justify-between items-start gap-4 pb-6 border-b border-hairline">
                <div className="flex items-center gap-3">
                  {template?.companyLogo ? (
                    <img src={template.companyLogo} alt="" className="w-12 h-12 object-contain rounded-xl" />
                  ) : (
                    <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center text-white font-extrabold text-[17px] font-display">
                      {(template?.companyName || 'FN').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h1 className="text-[26px] leading-none font-extrabold tracking-tight text-ink font-display">
                      {template?.companyName || 'FINNOVA'}
                    </h1>
                    <p className="text-[10px] text-quill-soft font-bold uppercase tracking-wider mt-1.5">
                      {template?.tagline || 'Smart Finances, Better Business'}
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
                    {selectedInvoice.customerName}
                  </div>
                  {selectedInvoice.customerEmail && (
                    <div className="text-[12px] text-quill font-semibold">{selectedInvoice.customerEmail}</div>
                  )}
                  {selectedInvoice.hotelName && (
                    <div className="text-[12px] text-quill font-semibold">
                      <span className="text-quill-soft">Property: </span>
                      {selectedInvoice.hotelName}
                    </div>
                  )}
                </div>

                <div className="bg-brand text-white rounded-[18px] overflow-hidden flex min-w-[240px]">
                  <div className="p-4 flex-1 text-center border-r border-white/15">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-white/65">Invoice no</div>
                    <div className="nums text-[15px] font-extrabold mt-1">{selectedInvoice.id}</div>
                  </div>
                  <div className="p-4 flex-1 text-center">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-white/65">Date</div>
                    <div className="nums text-[13px] font-bold mt-1.5">{selectedInvoice.date}</div>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="bg-mist rounded-[18px] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-quill font-bold text-[10px] uppercase tracking-wider">
                      <th className="py-3.5 px-4">Fish species</th>
                      <th className="py-3.5 px-4">Description</th>
                      <th className="py-3.5 px-4 text-center">Quantity kg</th>
                      <th className="py-3.5 px-4 text-right">Rate per kg</th>
                      <th className="py-3.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink text-[12px]">
                    {selectedInvoice.items.length === 0 ? (
                      <tr className="bg-shell border-t-4 border-mist">
                        <td colSpan={6} className="py-8 px-4 text-center">
                          <p className="text-[12px] font-bold text-ink">No line items yet</p>
                          <p className="text-[11px] text-quill-soft mt-1 font-medium">
                            Add fish species and quantities to build this invoice.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      selectedInvoice.items.map((item, idx) => (
                        <tr key={idx} className="bg-shell border-t-4 border-mist">
                          <td className="py-3.5 px-4 font-bold">{item.roomType || 'Standard room'}</td>
                      <td className="py-3.5 px-4 text-[11px] text-quill font-semibold">
                        {item.description || '—'}
                      </td>
                      <td className="nums py-3.5 px-4 text-center font-semibold">{item.quantity}</td>
                          <td className="nums py-3.5 px-4 text-right font-semibold">
                            {currencySymbol}{money(item.price)}
                          </td>
                          <td className="nums py-3.5 px-4 text-right font-bold">
                            {currencySymbol}{money(item.quantity * item.price)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Terms + totals */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
                <div className="space-y-5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-quill-soft block mb-1.5">
                      Terms &amp; conditions
                    </span>
                    <p className="text-[11px] text-quill leading-relaxed font-medium whitespace-pre-line">
                      {template?.termsAndConditions ||
                        'Any delay in payment will be subject to a late payment fee. Thank you for your residency.'}
                    </p>
                  </div>

                  <div className="bg-mist p-4 rounded-[16px]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-quill-soft block mb-1.5">
                      Payment information
                    </span>
                    <p className="text-[11px] text-ink font-semibold whitespace-pre-line leading-relaxed">
                      {template?.paymentDetails ||
                        'Beneficiary: Bank of America\nSwift Sort\nAccount No.: 324 6654 7766 9992'}
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] font-semibold text-quill">Total amount</span>
                    <span className="nums text-[17px] font-extrabold text-ink font-display">
                      {currencySymbol}{money(selectedInvoice.totalAmount)}
                    </span>
                  </div>

                  <div className="flex justify-between items-start pt-3 border-t border-hairline">
                    <span className="text-[12px] font-semibold text-quill">Amount paid</span>
                    <div className="text-right">
                      <span className="nums text-[15px] font-bold text-[#3f9c68]">
                        {currencySymbol}{money(selectedInvoice.amountPaid)}
                      </span>
                      <div className="nums text-[10px] text-quill-soft mt-0.5 font-semibold">
                        {selectedInvoice.paymentDate || selectedInvoice.date}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`${
                      selectedInvoice.balance === 0
                        ? 'bg-[#3f9c68]'
                        : selectedInvoice.balance < 0
                          ? 'bg-brand'
                          : 'bg-[#c0453c]'
                    } text-white px-5 py-4 rounded-[16px] flex justify-between items-center`}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider">
                      {selectedInvoice.balance < 0
                        ? 'Change due'
                        : selectedInvoice.balance === 0
                          ? 'Paid in full'
                          : 'Balance due'}
                    </span>
                    <span className="nums text-[17px] font-extrabold font-display">
                      {selectedInvoice.balance < 0
                        ? `-${currencySymbol}${money(Math.abs(selectedInvoice.balance))}`
                        : `${currencySymbol}${money(selectedInvoice.balance)}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* QR Code for public tracking */}
              <div className="border-t border-hairline pt-5 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-quill-soft uppercase tracking-wider mb-1">Track Online</p>
                  <p className="text-[11px] text-quill font-medium leading-relaxed">
                    Scan this QR code or visit the tracking page to check your invoice status anytime.
                  </p>
                </div>
                <InvoiceQRCode invoiceId={selectedInvoice.id} size={80} />
              </div>

              {/* Contact footer */}
              <div className="border-t border-hairline pt-5 flex flex-col md:flex-row justify-between items-center gap-3 text-[11px] text-quill font-semibold">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-brand" />
                  <span>{template?.contactPhone || '123-456-7890'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-brand" />
                  <span>{template?.contactEmail || 'billing@finnova.com'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-brand" />
                  <span>{template?.contactAddress || '123 Anywhere St., Any City'}</span>
                </div>
              </div>
            </div>

            <div className="bg-mist px-5 py-4 flex gap-2 print:hidden justify-end">
              {selectedInvoice.status !== 'Paid' && (
                <button
                  type="button"
                  onClick={() => {
                    onMarkAsPaid(selectedInvoice);
                    setSelectedInvoice({
                      ...selectedInvoice,
                      status: 'Paid',
                      amountPaid: selectedInvoice.totalAmount,
                      balance: 0
                    });
                  }}
                  className="flex items-center justify-center gap-2 bg-[#3f9c68] hover:bg-[#35855a] text-white text-[11px] font-bold px-5 py-3 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Settle in full
                </button>
              )}
              <button
                type="button"
                onClick={() => onEdit(selectedInvoice)}
                className="flex items-center justify-center gap-2 bg-shell hover:bg-mist-2 text-ink text-[11px] font-bold px-5 py-3 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Edit2 className="w-3.5 h-3.5 text-quill" /> Edit invoice
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
