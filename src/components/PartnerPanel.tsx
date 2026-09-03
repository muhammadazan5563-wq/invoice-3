import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  FileText,
  LogOut,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';
import { Invoice } from '../types';
import { Session } from '../lib/auth';
import { getInvoices, getVendorInvoices } from '../lib/supabase';
import { formatCurrency } from '../lib/settings';
import InvoiceQRCode from './InvoiceQRCode';

const BRAND_MARK =
  'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfoacajra/logo-finnova-n-mark.png';

interface PartnerPanelProps {
  session: Session;
  onLogout: () => Promise<void>;
}

type PanelView = 'dashboard' | 'invoices';

const CURRENCY = 'PKR';

const money = (value: number) => formatCurrency(value, CURRENCY);

/**
 * Shared panel for vendors and customers. Read-only by design: it exposes only
 * a dashboard and the signed-in person's own invoices.
 */
export default function PartnerPanel({ session, onLogout }: PartnerPanelProps) {
  const { contact, role } = session;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<PanelView>('dashboard');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id]);

  const loadInvoices = async () => {
    setLoading(true);
    setError('');
    try {
      const all = role === 'vendor' ? await getVendorInvoices() : await getInvoices();
      const email = (contact?.email || session.user.email || '').toLowerCase();
      const name = (contact?.fullName || '').trim().toLowerCase();

      // Match on email first; fall back to the customer name recorded on the invoice.
      setInvoices(
        all.filter((invoice) => {
          const invoiceEmail = (invoice.customerEmail || '').trim().toLowerCase();
          const invoiceName = (invoice.customerName || '').trim().toLowerCase();
          if (email && invoiceEmail && invoiceEmail === email) return true;
          if (name && invoiceName && invoiceName === name) return true;
          return false;
        })
      );
    } catch (err: any) {
      setError(err?.message || 'Could not load your invoices right now.');
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const billed = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    const paid = invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
    const outstanding = invoices.reduce(
      (sum, invoice) => sum + (invoice.balance > 0 ? invoice.balance : 0),
      0
    );
    const settled = invoices.filter((invoice) => invoice.balance <= 0).length;
    return { billed, paid, outstanding, settled };
  }, [invoices]);

  const visibleInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter(
      (invoice) =>
        invoice.id.toLowerCase().includes(term) ||
        (invoice.status || '').toLowerCase().includes(term) ||
        (invoice.date || '').toLowerCase().includes(term)
    );
  }, [invoices, search]);

  const displayName = contact?.fullName || session.user.email || 'Account';
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const statusTone = (invoice: Invoice) => {
    if (invoice.balance <= 0) return 'bg-[#e8f7ee] text-[#2f6b48]';
    if (invoice.status === 'Overdue') return 'bg-[#fdeeea] text-[#a8492f]';
    return 'bg-mist-2 text-quill';
  };

  return (
    <div className="min-h-screen bg-canvas px-3 sm:px-5 py-4 sm:py-6" id="partner-panel-root">
      <div className="max-w-[1120px] mx-auto bg-shell rounded-[34px] px-4 sm:px-7 py-5 sm:py-6 shadow-[0_40px_90px_-60px_rgba(19,17,38,0.7)]">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <img src={BRAND_MARK} alt="" className="w-9 h-9 object-contain" />
            <div className="hidden sm:block leading-none">
              <span className="block text-[19px] font-extrabold tracking-tight text-ink font-display">
                AQUA LEDGER
              </span>
              <span className="block text-[9px] font-semibold text-quill-soft mt-1">
                {role === 'vendor' ? 'Vendor portal' : 'Customer portal'}
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-ink rounded-full p-1.5">
            {([
              { key: 'dashboard' as const, label: 'Dashboard' },
              { key: 'invoices' as const, label: 'My invoices' },
            ]).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                className={`px-4 py-2.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft ${
                  view === item.key ? 'bg-brand text-white' : 'text-white/60 hover:md:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadInvoices}
              disabled={loading}
              title="Refresh"
              className="w-10 h-10 rounded-full bg-mist hover:bg-mist-2 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <RefreshCw className={`w-4 h-4 text-ink ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center text-white text-[12px] font-bold">
              {initials || 'U'}
            </div>
            <button
              type="button"
              onClick={onLogout}
              title="Sign out"
              className="w-9 h-9 rounded-full hover:bg-mist flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <LogOut className="w-4 h-4 text-quill" />
            </button>
          </div>
        </header>

        {/* Page heading */}
        <div className="mt-7 mb-6">
          <h1 className="text-[32px] sm:text-[38px] leading-none font-extrabold tracking-tight text-ink font-display">
            {view === 'dashboard' ? `Welcome, ${displayName.split(' ')[0]}` : 'My invoices'}
          </h1>
          <p className="text-[12px] text-quill-soft font-medium mt-2">
            {view === 'dashboard'
              ? 'Your billing summary and account details.'
              : role === 'vendor' ? 'Every purchase invoice recorded for your supply.' : 'Every sales invoice issued against your account.'}
          </p>
        </div>

        {error && (
          <div className="bg-[#fdf0ec] text-[#a8492f] p-5 rounded-[22px] text-[13px] font-semibold flex gap-3 items-start mb-6">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">We couldn't load your invoices</p>
              <p className="text-[12px] text-[#b5654c] mt-1 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Dashboard */}
        {view === 'dashboard' && (
          <div className="space-y-6" id="partner-dashboard">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-ink rounded-[24px] p-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                  Outstanding
                </span>
                <div className="nums text-[26px] font-extrabold text-white font-display mt-2.5 leading-none">
                  {money(totals.outstanding)}
                </div>
                <p className="text-[11px] text-white/55 font-semibold mt-3">
                  {totals.outstanding > 0 ? 'Payment pending' : 'Nothing due'}
                </p>
              </div>

              <div className="bg-mist rounded-[24px] p-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-quill-soft">
                  Total billed
                </span>
                <div className="nums text-[26px] font-extrabold text-ink font-display mt-2.5 leading-none">
                  {money(totals.billed)}
                </div>
                <p className="text-[11px] text-quill font-semibold mt-3">
                  Across {invoices.length} invoice{invoices.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="bg-mist rounded-[24px] p-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-quill-soft">
                  Total paid
                </span>
                <div className="nums text-[26px] font-extrabold text-[#3f9c68] font-display mt-2.5 leading-none">
                  {money(totals.paid)}
                </div>
                <p className="text-[11px] text-quill font-semibold mt-3">
                  {totals.settled} settled in full
                </p>
              </div>

              <div className="bg-brand rounded-[24px] p-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/65">
                  Invoices
                </span>
                <div className="nums text-[26px] font-extrabold text-white font-display mt-2.5 leading-none">
                  {invoices.length}
                </div>
                <button
                  type="button"
                  onClick={() => setView('invoices')}
                  className="mt-3 text-[11px] font-bold text-white underline decoration-white/40 hover:decoration-white cursor-pointer bg-transparent"
                >
                  View all
                </button>
              </div>
            </div>

            {/* Account card */}
            <section className="bg-shell rounded-[26px] p-6 sm:p-7 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
              <h2 className="text-[19px] font-extrabold text-ink font-display tracking-tight">
                Your details
              </h2>
              <p className="text-[12px] text-quill-soft font-medium mt-1 mb-5">
                Ask the administrator to update anything that looks wrong.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-mist rounded-[18px] p-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-quill-soft uppercase tracking-wider">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </span>
                  <span className="block text-[13px] font-bold text-ink mt-2 truncate">
                    {contact?.email || session.user.email}
                  </span>
                </div>

                <div className="bg-mist rounded-[18px] p-4">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-quill-soft uppercase tracking-wider">
                    <Phone className="w-3.5 h-3.5" /> Phone
                  </span>
                  <span className="block text-[13px] font-bold text-ink mt-2">
                    {contact?.phone || '—'}
                  </span>
                </div>

                {role === 'vendor' ? (
                  <>
                    <div className="bg-mist rounded-[18px] p-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-quill-soft uppercase tracking-wider">
                        <Building2 className="w-3.5 h-3.5" /> Company
                      </span>
                      <span className="block text-[13px] font-bold text-ink mt-2">
                        {contact?.companyName || '—'}
                      </span>
                    </div>
                    <div className="bg-mist rounded-[18px] p-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-quill-soft uppercase tracking-wider">
                        <MapPin className="w-3.5 h-3.5" /> Location
                      </span>
                      <span className="block text-[13px] font-bold text-ink mt-2">
                        {contact?.location || '—'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-mist rounded-[18px] p-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-quill-soft uppercase tracking-wider">
                        <MapPin className="w-3.5 h-3.5" /> Address
                      </span>
                      <span className="block text-[13px] font-bold text-ink mt-2">
                        {contact?.address || '—'}
                      </span>
                    </div>
                    <div className="bg-mist rounded-[18px] p-4">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-quill-soft uppercase tracking-wider">
                        <MapPin className="w-3.5 h-3.5" /> Area
                      </span>
                      <span className="block text-[13px] font-bold text-ink mt-2">
                        {contact?.area || '—'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Invoices */}
        {view === 'invoices' && (
          <section className="bg-shell rounded-[26px] p-6 sm:p-7 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)] animate-fade-in">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search invoice number, status or date"
                  aria-label="Search invoices"
                  className="w-full bg-mist hover:bg-mist-2 focus:bg-mist-2 text-[12px] font-semibold text-ink placeholder:text-quill-soft placeholder:font-medium pl-4 pr-11 py-3 rounded-full outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                />
                <Search className="w-4 h-4 text-quill absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <span className="nums text-[11px] font-bold text-quill bg-mist px-3.5 py-2 rounded-full">
                {visibleInvoices.length} invoice{visibleInvoices.length === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <div className="py-14 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-[3px] border-hairline border-t-brand rounded-full animate-spin" />
                <p className="text-[12px] font-bold text-quill">Loading your invoices…</p>
              </div>
            ) : visibleInvoices.length === 0 ? (
              <div className="py-14 text-center">
                <span className="w-14 h-14 rounded-2xl bg-mist flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-brand" />
                </span>
                <h3 className="text-[16px] font-extrabold text-ink font-display">
                  {invoices.length === 0 ? 'No invoices yet' : 'Nothing matches that search'}
                </h3>
                <p className="text-[12px] text-quill font-medium mt-2 max-w-sm mx-auto leading-relaxed">
                  {invoices.length === 0
                    ? 'Once the administrator issues an invoice against your account it will appear here automatically.'
                    : 'Try a different invoice number, status or date.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleInvoices.map((invoice) => (
                  <article
                    key={invoice.id}
                    className="bg-mist rounded-[22px] p-5 flex flex-wrap items-center justify-between gap-5"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="bg-shell rounded-2xl p-2 shrink-0 hidden sm:block">
                        <InvoiceQRCode invoiceId={invoice.id} size={56} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="nums text-[15px] font-extrabold text-ink font-display">
                            {invoice.id}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${statusTone(
                              invoice
                            )}`}
                          >
                            {invoice.balance <= 0 ? 'Paid' : invoice.status}
                          </span>
                        </div>
                        <p className="nums text-[11px] text-quill font-semibold mt-1.5">
                          Issued {invoice.date || '—'}
                          {invoice.paymentDate ? ` · Last payment ${invoice.paymentDate}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="block text-[9px] font-bold text-quill-soft uppercase tracking-wider">
                          Total
                        </span>
                        <span className="nums block text-[14px] font-extrabold text-ink mt-1">
                          {money(invoice.totalAmount)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[9px] font-bold text-quill-soft uppercase tracking-wider">
                          Paid
                        </span>
                        <span className="nums block text-[14px] font-bold text-[#3f9c68] mt-1">
                          {money(invoice.amountPaid)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[9px] font-bold text-quill-soft uppercase tracking-wider">
                          Balance
                        </span>
                        <span
                          className={`nums block text-[14px] font-extrabold mt-1 ${
                            invoice.balance > 0 ? 'text-[#a8492f]' : 'text-[#2f6b48]'
                          }`}
                        >
                          {money(invoice.balance)}
                        </span>
                      </div>
                      <a
                        href={`/invoice/${encodeURIComponent(invoice.id)}`}
                        className="inline-flex items-center gap-1.5 bg-ink hover:bg-ink-2 text-white text-[11px] font-bold px-4 py-2.5 rounded-full no-underline transition-colors duration-200"
                      >
                        <Wallet className="w-3.5 h-3.5" /> Open
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="mt-8 pt-5 border-t border-hairline flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-semibold text-quill-soft">
            AQUA LEDGER · Fish trading invoices
          </span>
          <span className="text-[11px] font-semibold text-quill-soft capitalize">
            Signed in as {role}
          </span>
        </footer>
      </div>
    </div>
  );
}
