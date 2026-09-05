import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Invoice } from '../types';
import {
  getInvoices,
  getVendorInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  syncBookingToSheet
} from '../lib/supabase';
import {
  InvoiceTemplate,
  SpreadsheetSettings,
  getUserSettings,
  getTemplateWithDefaults,
  getSpreadsheetWithDefaults,
  getCurrencySymbol
} from '../lib/settings';
import { getTodayInTimezone } from '../lib/timezone';
import Charts from './Charts';
import InvoiceList from './InvoiceList';
import InvoiceForm from './InvoiceForm';
import Settings from './Settings';
import Ledger from './Ledger';
import KpiCards from './KpiCards';
import InvoiceShowcase from './InvoiceShowcase';
import Contacts from './Contacts';
import Payment from './Payment';
import { Contact, getContacts } from '../lib/contacts';
import {
  LogOut,
  RefreshCw,
  Plus,
  AlertCircle,
  Settings as SettingsIcon,
  Search,
  Bell,
  ArrowLeft,
  SlidersHorizontal,
  ChevronDown,
  CalendarDays,
  FileText,
  Receipt,
  Wallet,
  ClipboardList,
  Repeat,
  ShoppingBag,
} from 'lucide-react';

const WORKSPACE_IMAGE =
  'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfbacajrq/card-workspace-desk-plant-lamp.png';
const BRAND_MARK =
  'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfoacajra/logo-finnova-n-mark.png';

interface DashboardProps {
  user: User;
  token: string;
  onLogout: () => Promise<void>;
  onTokenRefresh?: (newToken: string) => void;
}

type ViewState = 'dashboard' | 'vendor-dashboard' | 'create' | 'edit' | 'settings' | 'ledger' | 'payment' | 'contacts';

export default function Dashboard({ user, token, onLogout, onTokenRefresh }: DashboardProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendorInvoices, setVendorInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [currentToken, setCurrentToken] = useState(token);

  const [invoiceTemplate, setInvoiceTemplate] = useState<InvoiceTemplate | null>(null);
  const [spreadsheetSettings, setSpreadsheetSettings] = useState<SpreadsheetSettings | null>(null);

  const [viewState, setViewState] = useState<ViewState>('dashboard');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>(undefined);
  const [showcaseSelection, setShowcaseSelection] = useState<Invoice | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Filter strip state — drives the ledger + showcase below
  const [customerFilter, setCustomerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');
  const [invoiceQuery, setInvoiceQuery] = useState('');

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    actionLabel: string;
    actionStyle: string;
    onConfirm: () => void;
  } | null>(null);

  const supabaseSqlSchema = `-- 1. Create the invoices table in Supabase
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  date TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_date TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  payments JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- Vendor purchases live separately so vendor sorting and reporting stay fast
CREATE TABLE IF NOT EXISTS vendor_invoices (LIKE invoices INCLUDING ALL);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'vendor';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_date ON vendor_invoices (date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_contact ON vendor_invoices (customer_email, customer_name);

-- 2. Create the user_settings table for session persistence & settings
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firebase_uid TEXT UNIQUE NOT NULL,
  user_email TEXT,
  firebase_token TEXT,
  firebase_refresh_token TEXT,
  spreadsheet_settings JSONB DEFAULT '{}'::jsonb,
  invoice_template JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create index on firebase_uid for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_uid ON user_settings (firebase_uid);

-- 4. Disable Row Level Security (RLS) for simple integration
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(supabaseSqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  useEffect(() => {
    fetchInvoices();
    loadTemplateSettings();
    getContacts().then(setContacts).catch((err) => console.warn('Failed to load contacts:', err));
  }, []);

  const loadTemplateSettings = async () => {
    try {
      const settings = await getUserSettings(user.uid);
      if (settings) {
        if (settings.invoice_template) {
          setInvoiceTemplate(getTemplateWithDefaults(settings.invoice_template));
        }
        if (settings.spreadsheet_settings) {
          setSpreadsheetSettings(getSpreadsheetWithDefaults(settings.spreadsheet_settings));
        }
      }
    } catch (err) {
      console.warn('Failed to load template settings:', err);
    }
  };

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    setError(null);
    try {
      const customerData = await getInvoices();
      let vendorData: Invoice[] = [];
      try {
        vendorData = await getVendorInvoices();
      } catch (vendorError) {
        console.warn('Vendor invoices are unavailable:', vendorError);
      }
      setInvoices(customerData);
      setVendorInvoices(vendorData);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoices from Supabase.');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleSaveInvoice = async (
    invoiceData: Omit<Invoice, 'rowIndex' | 'rawRow'> & { rowIndex?: number }
  ) => {
    const performSave = async () => {
      setLoadingInvoices(true);
      setError(null);
      try {
        if (viewState === 'edit' && editingInvoice) {
          await updateInvoice(editingInvoice.id, invoiceData);
        } else {
          await createInvoice(invoiceData);
        }

        if (spreadsheetSettings?.spreadsheetId && spreadsheetSettings?.sheetName && token) {
          try {
            await syncBookingToSheet(
              invoiceData.id,
              invoiceData.customerName,
              invoiceData.items.map((item) => ({
                checkIn: item.checkIn,
                checkOut: item.checkOut,
                nights: item.nights,
                quantity: item.quantity,
                roomType: item.roomType,
              })),
              spreadsheetSettings.spreadsheetId,
              spreadsheetSettings.sheetName,
              token
            );
          } catch (sheetErr: any) {
            console.error('Failed to sync booking to Google Sheets:', sheetErr);
            setError(`Invoice saved to database, but failed to sync to Google Sheets: ${sheetErr.message}`);
          }
        }

        await fetchInvoices();
        setViewState('dashboard');
        setEditingInvoice(undefined);
      } catch (err: any) {
        setError(`Failed to save invoice: ${err.message}`);
      } finally {
        setLoadingInvoices(false);
      }
    };

    if (viewState === 'edit' && editingInvoice) {
      setConfirmModal({
        title: 'Save changes to this invoice?',
        message: `Invoice #${invoiceData.id} will be updated in Supabase and synchronized with Google Sheets.`,
        actionLabel: 'Update invoice',
        actionStyle: 'bg-brand hover:bg-brand-mid',
        onConfirm: () => {
          performSave();
          setConfirmModal(null);
        }
      });
    } else {
      performSave();
    }
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    const performMark = async () => {
      const todayStr = getTodayInTimezone(invoiceTemplate?.timezone || 'UTC');
      const updatedInvoice: Omit<Invoice, 'rowIndex' | 'rawRow'> = {
        id: invoice.id,
        date: invoice.date,
        customerName: invoice.customerName,
        customerId: invoice.customerId,
        customerEmail: invoice.customerEmail,
        totalAmount: invoice.totalAmount,
        amountPaid: invoice.totalAmount,
        paymentDate: todayStr,
        balance: 0,
        status: 'Paid',
        notes: invoice.notes,
        items: invoice.items,
        payments: [{ amount: invoice.totalAmount, date: todayStr }]
        ,invoiceType: invoice.invoiceType || 'customer'
      };

      setLoadingInvoices(true);
      try {
        await updateInvoice(invoice.id, updatedInvoice);

        if (spreadsheetSettings?.spreadsheetId && spreadsheetSettings?.sheetName && token) {
          try {
            await syncBookingToSheet(
              invoice.id,
              invoice.customerName,
              invoice.items.map((item) => ({
                checkIn: item.checkIn,
                checkOut: item.checkOut,
                nights: item.nights,
                quantity: item.quantity,
                roomType: item.roomType,
              })),
              spreadsheetSettings.spreadsheetId,
              spreadsheetSettings.sheetName,
              token
            );
          } catch (sheetErr: any) {
            console.error('Failed to sync booking to Google Sheets:', sheetErr);
            setError(`Invoice updated, but failed to sync to Google Sheets: ${sheetErr.message}`);
          }
        }

        setShowcaseSelection(null);
        await fetchInvoices();
      } catch (err: any) {
        setError(`Failed to mark invoice as paid: ${err.message}`);
      } finally {
        setLoadingInvoices(false);
      }
    };

    setConfirmModal({
      title: 'Settle this invoice in full?',
      message: `Invoice #${invoice.id} will be marked Paid and the full amount recorded as collected today.`,
      actionLabel: 'Settle invoice',
      actionStyle: 'bg-[#3f9c68] hover:bg-[#35855a]',
      onConfirm: () => {
        performMark();
        setConfirmModal(null);
      }
    });
  };

  const handleApplyPayment = async (contactId: string, amount: number): Promise<number> => {
    const contactInvoices = [...invoices, ...vendorInvoices]
      .filter((invoice) => invoice.customerId === contactId && invoice.balance > 0)
      .sort((a, b) => {
        const dateDifference = new Date(a.date).getTime() - new Date(b.date).getTime();
        return dateDifference || a.id.localeCompare(b.id);
      });
    const allocated = Math.min(amount, contactInvoices.reduce((sum, invoice) => sum + invoice.balance, 0));
    if (allocated <= 0) throw new Error('This contact has no outstanding invoice balance.');

    const paymentDate = getTodayInTimezone(invoiceTemplate?.timezone || 'UTC');
    const paymentId = crypto.randomUUID();
    const contact = contacts.find((item) => item.id === contactId);
    let remaining = allocated;
    const updates = contactInvoices.flatMap((invoice) => {
      if (remaining <= 0) return [];
      const applied = Math.min(remaining, invoice.balance);
      remaining -= applied;
      const balance = Math.max(0, invoice.balance - applied);
      const updatedInvoice: Omit<Invoice, 'rowIndex' | 'rawRow'> = {
        ...invoice,
        amountPaid: invoice.amountPaid + applied,
        paymentDate,
        balance,
        status: balance === 0 ? 'Paid' : 'Due',
        payments: [...(invoice.payments || []), {
          amount: applied,
          date: paymentDate,
          paymentId,
          contactName: contact?.fullName || invoice.customerName,
          contactPhone: contact?.phone || invoice.customerPhone || '',
        }],
      };
      return [updateInvoice(invoice.id, updatedInvoice)];
    });

    setLoadingInvoices(true);
    setError(null);
    try {
      await Promise.all(updates);
      await fetchInvoices();
      return allocated;
    } catch (err: any) {
      throw new Error(`Payment saved only partially or failed: ${err.message}`);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const performDelete = async () => {
      setLoadingInvoices(true);
      try {
        await deleteInvoice(invoice.id, invoice.invoiceType || 'customer');
        setShowcaseSelection(null);
        await fetchInvoices();
      } catch (err: any) {
        setError(`Failed to delete invoice: ${err.message}`);
      } finally {
        setLoadingInvoices(false);
      }
    };

    setConfirmModal({
      title: 'Delete this invoice?',
      message: `Invoice #${invoice.id} will be permanently removed from your database. This cannot be undone.`,
      actionLabel: 'Delete invoice',
      actionStyle: 'bg-[#d9534a] hover:bg-[#c0453c]',
      onConfirm: () => {
        performDelete();
        setConfirmModal(null);
      }
    });
  };

  const currencySymbol = getCurrencySymbol(invoiceTemplate?.currency || 'USD');

  // Derived filter data
  const customers = Array.from(
    new Set(invoices.map((inv) => inv.customerName).filter(Boolean))
  ).sort();

  const monthsSet = new Set<string>();
  invoices.forEach((inv) => {
    const d = new Date(inv.date);
    if (!isNaN(d.getTime())) {
      monthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  });
  const months: string[] = Array.from(monthsSet).sort();

  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (customerFilter !== 'all' && inv.customerName !== customerFilter) return false;
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;

    if (invoiceQuery.trim()) {
      const q = invoiceQuery.trim().toLowerCase();
      const hit =
        inv.id.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        (inv.customerEmail || '').toLowerCase().includes(q);
      if (!hit) return false;
    }

    if (fromMonth || toMonth) {
      const d = new Date(inv.date);
      if (isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (fromMonth && key < fromMonth) return false;
      if (toMonth && key > toMonth) return false;
    }

    return true;
  });

  const activeFilterCount =
    (customerFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (fromMonth ? 1 : 0) +
    (toMonth ? 1 : 0) +
    (invoiceQuery.trim() ? 1 : 0);

  const resetFilters = () => {
    setCustomerFilter('all');
    setStatusFilter('all');
    setFromMonth('');
    setToMonth('');
    setInvoiceQuery('');
  };

  const overdueCount = invoices.filter((inv) => inv.status === 'Overdue' || (inv.balance > 0 && new Date(inv.date).getTime() < Date.now())).length;

  const userInitials = user.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || 'U';

  const navItems: { key: ViewState; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'vendor-dashboard', label: 'Vendor dashboard' },
    { key: 'create', label: 'Invoice' },
    { key: 'ledger', label: 'Ledger' },
    { key: 'payment', label: 'Payment' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'settings', label: 'Settings' },
  ];



  const pageTitle =
    viewState === 'dashboard'
      ? 'Customer invoices'
      : viewState === 'vendor-dashboard'
        ? 'Vendor dashboard'
      : viewState === 'create'
        ? 'New invoice'
        : viewState === 'edit'
          ? 'Edit invoice'
            : viewState === 'ledger'
              ? 'Ledger'
              : viewState === 'payment'
                ? 'Payment'
              : viewState === 'contacts'
                ? 'Contacts'
              : 'Settings';

  const pageSubtitle =
    viewState === 'dashboard'
      ? 'Manage customer sales, collections and fishery billing in one place.'
      : viewState === 'vendor-dashboard'
        ? 'Track vendor purchases, fish species, quantities and amounts payable.'
      : viewState === 'create'
        ? 'Draft a new invoice and send it for collection.'
        : viewState === 'edit'
          ? 'Adjust line items, totals and payment records.'
            : viewState === 'ledger'
              ? 'Every payment movement, reconciled by date.'
              : viewState === 'payment'
                ? 'Record payments and allocate them from the oldest invoice to the newest.'
              : viewState === 'contacts'
                ? 'Manage the vendors and customers connected to your ledger.'
              : 'Company profile, currency and sheet connection.';

  return (
    <div className="min-h-screen bg-canvas px-3 sm:px-5 py-4 sm:py-6" id="dashboard-root">
      <div className="max-w-[1320px] mx-auto bg-shell rounded-[34px] px-4 sm:px-7 py-5 sm:py-6 shadow-[0_40px_90px_-60px_rgba(19,17,38,0.7)]">
        {/* ── Top bar ─────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-4" id="global-navbar">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img src={BRAND_MARK} alt="" className="w-9 h-9 object-contain" />
            <div className="hidden sm:block leading-none">
              <span className="block text-[19px] font-extrabold tracking-tight text-ink font-display">
                {invoiceTemplate?.companyName || 'FINNOVA'}
              </span>
              <span className="block text-[9px] font-semibold text-quill-soft mt-1">
                Smart Finances, Better Business
              </span>
            </div>
          </div>

          {/* Dark pill nav */}
          <div className="flex items-center gap-3 flex-1 justify-center min-w-0">
            <span className="nums hidden xl:flex w-11 h-11 rounded-full bg-mist items-center justify-center text-[13px] font-bold text-ink shrink-0">
              {invoices.length}
            </span>

            <nav className="flex items-center gap-1 bg-ink rounded-full p-1.5 overflow-x-auto no-scrollbar max-w-full">
              {navItems.map((item) => {
                const active =
                  viewState === item.key ||
                  (item.key === 'create' && viewState === 'edit');
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      if (item.key === 'create') setEditingInvoice(undefined);
                      setViewState(item.key);
                    }}
                    className={`px-4 py-2.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft ${
                      active ? 'bg-brand text-white' : 'text-white/60 hover:md:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Icon cluster */}
          <div className="flex items-center gap-1.5 shrink-0">


            <button
              type="button"
              onClick={fetchInvoices}
              disabled={loadingInvoices}
              title="Sync database"
              className="w-10 h-10 rounded-full bg-mist hover:bg-mist-2 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <RefreshCw className={`w-4 h-4 text-ink ${loadingInvoices ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              title="Overdue alerts"
              onClick={() => setStatusFilter('Overdue')}
              className="w-10 h-10 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors duration-200 cursor-pointer relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Bell className="w-4 h-4 text-ink" />
              {overdueCount > 0 && (
                <span className="nums absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-1 bg-[#e4694a] rounded-full text-[8px] text-white font-bold flex items-center justify-center">
                  {overdueCount}
                </span>
              )}
            </button>

            <button
              type="button"
              title="Settings"
              onClick={() => setViewState('settings')}
              className="w-10 h-10 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <SettingsIcon className="w-4 h-4 text-ink" />
            </button>

            <div className="flex items-center gap-1.5 ml-0.5">
              <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center text-white text-[12px] font-bold overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  userInitials
                )}
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
          </div>
        </header>

        {/* ── Page heading ────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4 mt-7 mb-6">
          <div className="flex items-start gap-3.5">
            {viewState !== 'dashboard' && (
              <button
                type="button"
                onClick={() => {
                  setViewState('dashboard');
                  setEditingInvoice(undefined);
                }}
                title="Back to invoices"
                className="w-11 h-11 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors duration-200 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <ArrowLeft className="w-5 h-5 text-ink" />
              </button>
            )}
            <div>
              <h1 className="text-[34px] sm:text-[40px] leading-none font-extrabold tracking-tight text-ink font-display">
                {pageTitle}
              </h1>
              <p className="text-[12px] text-quill-soft font-medium mt-2">{pageSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={resetFilters}
              title="Reset filters"
              className="w-11 h-11 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <SlidersHorizontal className="w-4 h-4 text-ink" />
            </button>
            {viewState !== 'contacts' && (
            <button
              type="button"
              onClick={() => {
                setEditingInvoice(undefined);
                setViewState('create');
              }}
              className="flex items-center gap-2 bg-brand hover:bg-brand-mid text-white text-[13px] font-bold pl-5 pr-6 py-3.5 rounded-full transition-colors duration-200 cursor-pointer shadow-[0_18px_34px_-20px_rgba(90,73,230,0.95)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Plus className="w-4 h-4" /> Create an invoice
            </button>
            )}
          </div>
        </div>

        {/* ── Error / setup notice ────────────────────────────── */}
        {error && (
          <div className="space-y-5 mb-7 animate-fade-in">
            <div className="bg-[#fdf0ec] text-[#a8492f] p-5 rounded-[22px] text-[13px] font-semibold flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">We couldn't reach your database</p>
                <p className="text-[12px] text-[#b5654c] mt-1 font-medium">{error}</p>
              </div>
            </div>

            <div className="bg-mist p-6 sm:p-7 rounded-[26px] space-y-5">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                  <h3 className="text-[16px] font-extrabold text-ink font-display">Database setup required</h3>
                  <p className="text-[12px] text-quill mt-1.5 leading-relaxed max-w-xl font-medium">
                    Create the{' '}
                    <code className="bg-shell px-1.5 py-0.5 rounded-md font-mono text-[11px] text-brand">invoices</code>{' '}
                    table in your Supabase project by running this SQL.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-4 py-2.5 rounded-full transition-colors duration-200 cursor-pointer"
                >
                  {copiedSql ? 'Copied' : 'Copy SQL'}
                </button>
              </div>
              <pre className="bg-ink text-white/85 p-5 rounded-[20px] font-mono text-[11px] overflow-x-auto leading-relaxed max-h-56 ink-scroll">
                {supabaseSqlSchema}
              </pre>
            </div>
          </div>
        )}

        {/* ── Dashboard view ─────────────────────────────────── */}
        {viewState === 'dashboard' && (
          <div className="space-y-6" id="main-dashboard-panels">
            <KpiCards
              invoices={invoices}
              currencySymbol={currencySymbol}
              workspaceImage={WORKSPACE_IMAGE}
              onOpenLedger={() => setViewState('ledger')}
              template={invoiceTemplate}
              onCreateInvoice={() => {
                setEditingInvoice(undefined);
                setViewState('create');
              }}
              onSync={fetchInvoices}
              loadingSync={loadingInvoices}
            />

            {/* Filter strip */}
            <div className="flex flex-wrap items-center gap-2.5 py-1" id="filter-strip">
              <div className="flex items-center gap-2 mr-1">
                <span className="text-[12px] font-bold text-ink">Active filters</span>
                <span className="nums w-6 h-6 rounded-full bg-mist-2 text-ink text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              </div>

              <div className="relative">
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  aria-label="Filter by customer"
                  className="select-bare bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-9 py-3 rounded-full cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[150px]"
                >
                  <option value="all">All customers</option>
                  {customers.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-quill absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                  className="select-bare bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-9 py-3 rounded-full cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[135px]"
                >
                  <option value="all">All statuses</option>
                  {['Paid', 'Due', 'Unpaid', 'Pending', 'Overdue'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-quill absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={fromMonth}
                  onChange={(e) => setFromMonth(e.target.value)}
                  aria-label="From month"
                  className="select-bare bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-10 py-3 rounded-full cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[160px]"
                >
                  <option value="">From: any month</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
                <CalendarDays className="w-3.5 h-3.5 text-quill absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={toMonth}
                  onChange={(e) => setToMonth(e.target.value)}
                  aria-label="To month"
                  className="select-bare bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-10 py-3 rounded-full cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[160px]"
                >
                  <option value="">To: any month</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{monthLabel(m)}</option>
                  ))}
                </select>
                <CalendarDays className="w-3.5 h-3.5 text-quill absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative flex-1 min-w-[180px]">
                <input
                  type="text"
                  value={invoiceQuery}
                  onChange={(e) => setInvoiceQuery(e.target.value)}
                  placeholder="Enter invoice #"
                  aria-label="Search invoices"
                  className="w-full bg-mist hover:bg-mist-2 focus:bg-mist-2 text-[12px] font-semibold text-ink placeholder:text-quill-soft placeholder:font-medium pl-4 pr-11 py-3 rounded-full outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                />
                <Search className="w-4 h-4 text-quill absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Dark showcase panel */}
            <InvoiceShowcase
              invoices={filteredInvoices}
              currencySymbol={currencySymbol}
              companyName={invoiceTemplate?.companyName || 'FINNOVA'}
              selected={showcaseSelection}
              onSelect={setShowcaseSelection}
              onEdit={(inv) => {
                setEditingInvoice(inv);
                setViewState('edit');
              }}
              onMarkAsPaid={handleMarkAsPaid}
            />

            {/* Analytics */}
            <section className="bg-shell rounded-[26px] p-6 sm:p-7 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
              <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
                <div>
                  <h2 className="text-[19px] font-extrabold text-ink font-display tracking-tight">Analytics</h2>
                  <p className="text-[12px] text-quill-soft font-medium mt-1">
                    Revenue trend, status split and your strongest accounts.
                  </p>
                </div>
                <span className="nums text-[11px] font-bold text-quill bg-mist px-3.5 py-2 rounded-full">
                  {invoices.length} invoice{invoices.length === 1 ? '' : 's'} tracked
                </span>
              </div>
              <Charts invoices={invoices} currencyCode={invoiceTemplate?.currency || 'USD'} currencySymbol={currencySymbol} />
            </section>

            {/* Full ledger table */}
            <section className="bg-shell rounded-[26px] p-6 sm:p-7 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
              <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
                <div>
                  <h2 className="text-[19px] font-extrabold text-ink font-display tracking-tight">Invoice ledger</h2>
                  <p className="text-[12px] text-quill-soft font-medium mt-1">
                    Every invoice, searchable and printable.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingInvoice(undefined);
                    setViewState('create');
                  }}
                  className="flex items-center gap-2 bg-mist hover:bg-mist-2 text-ink text-[12px] font-bold px-4 py-2.5 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <Plus className="w-3.5 h-3.5" /> Add invoice
                </button>
              </div>
              <InvoiceList
                invoices={filteredInvoices}
                onEdit={(inv) => {
                  setEditingInvoice(inv);
                  setViewState('edit');
                }}
                onDelete={handleDeleteInvoice}
                onMarkAsPaid={handleMarkAsPaid}
                template={invoiceTemplate}
              />
            </section>
          </div>
        )}

        {viewState === 'vendor-dashboard' && (
          <div className="space-y-6 animate-fade-in" id="vendor-dashboard-panels">
            <KpiCards mode="vendor" invoices={vendorInvoices} currencySymbol={currencySymbol} workspaceImage={WORKSPACE_IMAGE} onOpenLedger={() => setViewState('ledger')} template={invoiceTemplate} onCreateInvoice={() => { setEditingInvoice(undefined); setViewState('create'); }} onSync={fetchInvoices} loadingSync={loadingInvoices} />
            <InvoiceList invoices={vendorInvoices} onEdit={(invoice) => { setEditingInvoice(invoice); setViewState('edit'); }} onDelete={handleDeleteInvoice} onMarkAsPaid={handleMarkAsPaid} template={invoiceTemplate} />
          </div>
        )}

        {/* ── Create / Edit ──────────────────────────────────── */}
        {(viewState === 'create' || viewState === 'edit') && (
          <div className="animate-fade-in" id="invoice-editor-section">
      <InvoiceForm
              invoice={editingInvoice}
              contacts={contacts}
              suggestInvoiceId={
                viewState === 'create' ? `INV-${Math.floor(1000 + Math.random() * 9000)}` : undefined
              }
              onSave={handleSaveInvoice}
              onCancel={() => {
                setViewState('dashboard');
                setEditingInvoice(undefined);
              }}
              template={invoiceTemplate}
            />
          </div>
        )}

        {/* ── Ledger ────────────────────────────────────────── */}
        {viewState === 'ledger' && (
          <div className="animate-fade-in">
            <Ledger template={invoiceTemplate} />
          </div>
        )}

        {/* ── Payments ───────────────────────────────────────── */}
        {viewState === 'payment' && (
          <div className="animate-fade-in" id="payment-section">
            <Payment
              invoices={invoices}
              vendorInvoices={vendorInvoices}
              contacts={contacts}
              template={invoiceTemplate}
              onSavePayment={handleApplyPayment}
            />
          </div>
        )}

        {/* ── Contacts ────────────────────────────────────────── */}
        {viewState === 'contacts' && (
          <div className="animate-fade-in" id="contacts-section">
            <Contacts />
          </div>
        )}

        {/* ── Settings ──────────────────────────────────────── */}
        {viewState === 'settings' && (
          <div className="animate-fade-in" id="settings-section">
            <Settings
              user={user}
              token={currentToken}
              onClose={() => setViewState('dashboard')}
              onSettingsSaved={(newToken?: string) => {
                if (newToken) {
                  setCurrentToken(newToken);
                  if (onTokenRefresh) onTokenRefresh(newToken);
                }
                loadTemplateSettings();
              }}
            />
          </div>
        )}

        {/* Footer strip */}
        <footer className="mt-8 pt-5 border-t border-hairline flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-semibold text-quill-soft">
            {invoiceTemplate?.companyName || 'FINNOVA'} · Smart Finances, Better Business
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-quill-soft">
            <ShoppingBag className="w-3.5 h-3.5" /> Synced with Supabase
          </span>
        </footer>
      </div>

      {/* ── Confirmation dialog ─────────────────────────────── */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/45 animate-fade-in"
          id="custom-confirm-dialog"
        >
          <div className="bg-shell rounded-[26px] max-w-md w-full p-7 space-y-5 shadow-[0_40px_80px_-40px_rgba(19,17,38,0.8)]">
            <div className="space-y-2">
              <h3 className="text-[18px] font-extrabold text-ink font-display tracking-tight">
                {confirmModal.title}
              </h3>
              <p className="text-[13px] text-quill leading-relaxed font-medium">{confirmModal.message}</p>
            </div>
            <div className="flex gap-2.5 justify-end pt-1">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-5 py-3 bg-mist hover:bg-mist-2 text-ink rounded-full text-[12px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Keep as is
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-5 py-3 text-white rounded-full text-[12px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${confirmModal.actionStyle}`}
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
