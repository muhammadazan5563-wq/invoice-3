import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, FileText, QrCode, ArrowRight, Waves } from 'lucide-react';

const BRAND_MARK =
  'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfoacajra/logo-finnova-n-mark.png';

export default function InvoiceLookup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [invoiceNumber, setInvoiceNumber] = useState(searchParams.get('ref') || '');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = invoiceNumber.trim();
    if (!trimmed) {
      setError('Please enter an invoice number');
      return;
    }
    setError('');
    setIsSearching(true);

    // The invoice page performs the authoritative database lookup.
    // Navigating directly avoids the retired Google Sheets lookup path.
    navigate(`/invoice/${encodeURIComponent(trimmed)}`);
    setIsSearching(false);
  };

  return (
    <div className="min-h-screen bg-canvas px-3 sm:px-5 py-4 sm:py-6">
      <div className="max-w-[720px] mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 mb-12">
          <a href="/" className="flex items-center gap-2.5 no-underline">
            <img src={BRAND_MARK} alt="" className="w-9 h-9 object-contain" />
            <div className="leading-none">
              <span className="block text-[19px] font-extrabold tracking-tight text-ink font-display">FINNOVA</span>
              <span className="block text-[9px] font-semibold text-quill-soft mt-1">
                Smart Finances, Better Business
              </span>
            </div>
          </a>
        </header>

        {/* Main Content */}
        <div className="bg-shell rounded-[34px] px-6 sm:px-10 py-10 sm:py-14 shadow-[0_40px_90px_-60px_rgba(19,17,38,0.25)] animate-fade-in">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 bg-brand-pale text-brand text-[10px] font-bold px-3.5 py-2 rounded-full uppercase tracking-wider mb-5">
              <QrCode className="w-3.5 h-3.5" /> Invoice Tracker
            </span>
            <h1 className="text-[32px] sm:text-[42px] leading-[1.1] font-extrabold tracking-tight text-ink font-display">
              Track Your Invoice
            </h1>
            <p className="text-[14px] text-quill leading-relaxed mt-3 max-w-md mx-auto font-medium">
              Enter your invoice number below to view fishery details, payment status, and outstanding balance.
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="max-w-md mx-auto">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <Search className="w-5 h-5 text-quill-soft" />
              </div>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => {
                  setInvoiceNumber(e.target.value);
                  setError('');
                }}
                placeholder="e.g. INV-001 or 001"
                className="w-full h-14 pl-12 pr-14 rounded-full border border-hairline bg-mist text-ink text-[14px] font-semibold placeholder:text-quill-soft focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all duration-200"
                autoFocus
              />
              <button
                type="submit"
                disabled={isSearching}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-brand hover:bg-brand-mid disabled:opacity-60 flex items-center justify-center transition-colors duration-200 cursor-pointer"
              >
                {isSearching ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-white" />
                )}
              </button>
            </div>

            {error && (
              <div className="mt-4 px-4 py-3 rounded-2xl bg-[#fdeeea] border border-[#f5c6bc]">
                <p className="text-[12px] font-semibold text-[#a8492f]">{error}</p>
              </div>
            )}
          </form>

          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12">
            <div className="bg-mist rounded-[20px] p-5">
              <span className="w-10 h-10 rounded-xl bg-brand-pale flex items-center justify-center mb-3">
                <FileText className="w-4.5 h-4.5 text-brand" />
              </span>
              <h3 className="text-[13px] font-bold text-ink">Invoice Number</h3>
              <p className="text-[11px] text-quill leading-relaxed mt-1.5 font-medium">
                Find your invoice number on the document we sent you, or scan the QR code printed on it.
              </p>
            </div>

            <div className="bg-mist rounded-[20px] p-5">
              <span className="w-10 h-10 rounded-xl bg-brand-pale flex items-center justify-center mb-3">
                <Waves className="w-4.5 h-4.5 text-brand" />
              </span>
              <h3 className="text-[13px] font-bold text-ink">Real-time Status</h3>
              <p className="text-[11px] text-quill leading-relaxed mt-1.5 font-medium">
                See your fishery lines, quantities, payment history, and remaining balance — all live.
              </p>
            </div>
          </div>
        </div>

        <footer className="mt-8 text-center">
          <span className="text-[11px] font-semibold text-quill-soft">
            FINNOVA © 2026 · Smart Finances, Better Business
          </span>
        </footer>
      </div>
    </div>
  );
}
