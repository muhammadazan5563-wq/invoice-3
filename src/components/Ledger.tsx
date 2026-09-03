import { useState, useEffect } from 'react';
import {
  getLedgerInvoices,
  getCashExpenses,
  createLedgerInvoice,
  createCashExpense,
  deleteLedgerInvoice,
  deleteCashExpense,
  groupLedgerByDate,
  LedgerInvoice,
  CashExpense,
  LedgerEntry,
} from '../lib/ledger';
import { getInvoices } from '../lib/supabase';
import { InvoiceTemplate, getUserSettings, getTemplateWithDefaults, getCurrencySymbol } from '../lib/settings';
import { getTodayInTimezone } from '../lib/timezone';
import { Invoice, PaymentRecord } from '../types';
import {
  PlusCircle,
  BookOpen,
  Calendar,
  Wallet,
  TrendingDown,
  TrendingUp,
  Trash2,
  RefreshCw,
  Receipt,
  Banknote,
  AlertCircle,
  Eye,
  ArrowLeft,
  Plus,
  Edit3,
} from 'lucide-react';

interface LedgerProps {
  template?: InvoiceTemplate | null;
}

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fieldClass =
  'w-full bg-shell rounded-2xl px-4 py-3 text-[12px] font-semibold text-ink placeholder:text-quill-soft placeholder:font-medium outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

const labelClass = 'block text-[10px] font-bold text-quill-soft uppercase tracking-wider mb-2';

const thClass = 'py-4 px-5 text-[10px] font-bold text-quill uppercase tracking-wider';

export default function Ledger({ template }: LedgerProps) {
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [allInvoices, setAllInvoices] = useState<LedgerInvoice[]>([]);
  const [allExpenses, setAllExpenses] = useState<CashExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'create'>('list');
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);

  const [selectedDate, setSelectedDate] = useState(() => getTodayInTimezone(template?.timezone || 'UTC'));
  const [todayInvoices, setTodayInvoices] = useState<Invoice[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseEntries, setExpenseEntries] = useState<
    { name: string; amount: string; description: string; tag: string }[]
  >([]);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseTag, setNewExpenseTag] = useState<string>('expense');
  const [saving, setSaving] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'entry'; date: string } | null>(null);

  useEffect(() => {
    fetchLedgerData();
  }, []);

  useEffect(() => {
    if (template?.currency) {
      setCurrencySymbol(getCurrencySymbol(template.currency));
    } else {
      loadCurrencySettings();
    }
  }, [template]);

  const loadCurrencySettings = async () => {
    try {
      const keys = Object.keys(localStorage);
      const firebaseKey = keys.find((k) => k.startsWith('firebase:authUser:'));
      if (firebaseKey) {
        const userData = JSON.parse(localStorage.getItem(firebaseKey) || '{}');
        if (userData.uid) {
          const settings = await getUserSettings(userData.uid);
          if (settings?.invoice_template) {
            const tmpl = getTemplateWithDefaults(settings.invoice_template);
            setCurrencySymbol(getCurrencySymbol(tmpl.currency));
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load currency settings for ledger:', err);
    }
  };

  const fetchLedgerData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [invoices, expenses] = await Promise.all([getLedgerInvoices(), getCashExpenses()]);
      setAllInvoices(invoices);
      setAllExpenses(expenses);
      setLedgerEntries(groupLedgerByDate(invoices, expenses, template?.timezone || 'UTC'));
    } catch (err: any) {
      setError(err.message || 'Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreatePanel = async (editDate?: string) => {
    const dateToUse = editDate || selectedDate;
    setSelectedDate(dateToUse);
    setViewMode('create');
    setShowExpenseForm(false);
    setError(null);

    const existingEntry = ledgerEntries.find((e) => e.date === dateToUse);
    if (existingEntry && existingEntry.expenses.length > 0) {
      setExpenseEntries(
        existingEntry.expenses.map((exp) => ({
          name: exp.name,
          amount: String(exp.amount),
          description: exp.description || '',
          tag: exp.tag || 'expense',
        }))
      );
      setShowExpenseForm(true);
    } else {
      setExpenseEntries([]);
    }

    await fetchInvoicesForDate(dateToUse);
  };

  const fetchInvoicesForDate = async (date: string) => {
    try {
      const invoices = await getInvoices();
      const matchingInvoices: Invoice[] = [];

      for (const inv of invoices) {
        const paymentsArray: PaymentRecord[] = inv.payments || [];

        if (paymentsArray.length > 0) {
          const datePayments = paymentsArray.filter((p) => p.date === date);
          if (datePayments.length > 0) {
            const dateTotal = datePayments.reduce((sum, p) => sum + p.amount, 0);
            matchingInvoices.push({ ...inv, totalAmount: dateTotal });
          }
        } else if (inv.paymentDate === date) {
          matchingInvoices.push(inv);
        }
      }

      matchingInvoices.sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
        return numA - numB;
      });
      setTodayInvoices(matchingInvoices);
    } catch (err: any) {
      setError(err.message || 'Failed to load invoices');
    }
  };

  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    if (viewMode === 'create') {
      await fetchInvoicesForDate(newDate);
    }
  };

  const handleAddExpenseEntry = () => {
    if (!newExpenseName.trim() || !newExpenseAmount.trim()) return;
    setExpenseEntries([
      ...expenseEntries,
      {
        name: newExpenseName.trim(),
        amount: newExpenseAmount.trim(),
        description: newExpenseDescription.trim(),
        tag: newExpenseTag,
      },
    ]);
    setNewExpenseName('');
    setNewExpenseAmount('');
    setNewExpenseDescription('');
    setNewExpenseTag('expense');
  };

  const handleRemoveExpenseEntry = (index: number) => {
    setExpenseEntries(expenseEntries.filter((_, i) => i !== index));
  };

  const handleSaveLedger = async () => {
    setSaving(true);
    setError(null);
    try {
      const existingIds = new Set(allInvoices.map((inv) => String(inv.id)));

      for (const inv of todayInvoices) {
        const ledgerKey = `${inv.id}_${selectedDate}`;
        if (existingIds.has(ledgerKey)) continue;
        await createLedgerInvoice({
          id: ledgerKey,
          guest_name: inv.customerName,
          hotel_name: inv.hotelName || '',
          total_amount: inv.totalAmount,
        });
      }

      const existingEntry = ledgerEntries.find((e) => e.date === selectedDate);
      if (existingEntry && existingEntry.expenses.length > 0) {
        for (const exp of existingEntry.expenses) {
          await deleteCashExpense(exp.id);
        }
      }

      for (const exp of expenseEntries) {
        await createCashExpense({
          name: exp.name,
          amount: Number(exp.amount) || 0,
          description: exp.description,
          tag: exp.tag || 'expense',
        });
      }

      await fetchLedgerData();
      setViewMode('list');
      setExpenseEntries([]);
      setTodayInvoices([]);
    } catch (err: any) {
      setError(err.message || 'Failed to save ledger');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLedgerInvoice = async (id: string) => {
    try {
      await deleteLedgerInvoice(id);
      await fetchLedgerData();
      if (selectedEntry) {
        const updated = selectedEntry.invoices.filter((inv) => inv.id !== id);
        setSelectedEntry({
          ...selectedEntry,
          invoices: updated,
          totalReceived: updated.reduce((s, i) => s + i.total_amount, 0),
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const handleDeleteCashExpense = async (id: number) => {
    try {
      await deleteCashExpense(id);
      await fetchLedgerData();
      if (selectedEntry) {
        const updated = selectedEntry.expenses.filter((exp) => exp.id !== id);
        const newTotalReceived =
          selectedEntry.invoices.reduce((s, i) => s + i.total_amount, 0) +
          updated.filter((e) => e.tag === 'cash').reduce((s, e) => s + e.amount, 0);
        const newTotalExpense = updated.filter((e) => e.tag !== 'cash').reduce((s, e) => s + e.amount, 0);
        setSelectedEntry({
          ...selectedEntry,
          expenses: updated,
          totalReceived: newTotalReceived,
          totalExpense: newTotalExpense,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const handleDeleteEntireEntry = async (entry: LedgerEntry) => {
    try {
      for (const inv of entry.invoices) {
        await deleteLedgerInvoice(inv.id);
      }
      for (const exp of entry.expenses) {
        await deleteCashExpense(exp.id);
      }
      await fetchLedgerData();
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message || 'Failed to delete entry');
      setDeleteConfirm(null);
    }
  };

  const handleShowReport = (entry: LedgerEntry) => {
    setSelectedEntry(entry);
    setViewMode('detail');
  };

  const grandTotalReceived =
    allInvoices.reduce((sum, inv) => sum + inv.total_amount, 0) +
    allExpenses.filter((exp) => exp.tag === 'cash').reduce((sum, exp) => sum + exp.amount, 0);
  const grandTotalExpense = allExpenses
    .filter((exp) => exp.tag !== 'cash')
    .reduce((sum, exp) => sum + exp.amount, 0);

  const panelTotalReceived =
    todayInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0) +
    expenseEntries.filter((exp) => exp.tag === 'cash').reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const panelTotalExpense = expenseEntries
    .filter((exp) => exp.tag !== 'cash')
    .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  // ============ CREATE VIEW ============
  if (viewMode === 'create') {
    return (
      <div className="space-y-6 animate-fade-in" id="ledger-create-section">
        {/* Header */}
        <div className="bg-ink rounded-[26px] px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Back to ledger"
              className="w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-[22px] leading-none font-extrabold text-white font-display tracking-tight">
                Record a ledger day
              </h1>
              <p className="text-[11px] text-white/50 font-medium mt-1.5">
                Collect the day's income and cash movements.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-3">
            <Calendar className="w-4 h-4 text-white/60" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              aria-label="Ledger date"
              className="nums bg-transparent text-[12px] font-bold text-white outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>
        </div>

        {error && (
          <div className="bg-[#fdeeea] text-[#a8492f] p-4 rounded-[18px] text-[12px] font-bold flex gap-2.5 items-center">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Payments received */}
        <section className="bg-shell rounded-[26px] p-6 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-[#e8f7ee] flex items-center justify-center">
                <Receipt className="w-5 h-5 text-[#3f9c68]" />
              </span>
              <div>
                <h2 className="text-[16px] font-extrabold text-ink font-display">Payments received</h2>
                <p className="nums text-[11px] text-quill-soft font-medium mt-0.5">Settled on {selectedDate}</p>
              </div>
            </div>
            <span className="nums text-[11px] font-bold text-quill bg-mist px-3.5 py-2 rounded-full">
              {todayInvoices.length} invoice{todayInvoices.length !== 1 ? 's' : ''}
            </span>
          </div>

          {todayInvoices.length === 0 ? (
            <div className="bg-mist rounded-[20px] p-10 text-center">
              <p className="text-[13px] font-bold text-ink">No payments landed on this date</p>
              <p className="text-[11px] text-quill-soft mt-1.5 font-medium">
                Pick another date above, or record cash movements below.
              </p>
            </div>
          ) : (
            <div className="bg-mist rounded-[20px] overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className={thClass}>Invoice</th>
                    <th className={thClass}>Guest</th>
                    <th className={thClass}>Property</th>
                    <th className={`${thClass} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {todayInvoices.map((inv, idx) => (
                    <tr key={idx} className="bg-shell border-t-4 border-mist">
                      <td className="py-4 px-5">
                        <span className="nums text-[11px] font-bold text-brand bg-brand-pale px-2.5 py-1.5 rounded-full">
                          #{inv.id}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-[12px] font-bold text-ink">{inv.customerName}</td>
                      <td className="py-4 px-5 text-[12px] text-quill font-semibold">{inv.hotelName || '—'}</td>
                      <td className="nums py-4 px-5 text-right text-[12px] font-bold text-[#3f9c68]">
                        {currencySymbol}{money(inv.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Cash & expense */}
        <section className="bg-shell rounded-[26px] p-6 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-brand-pale flex items-center justify-center">
                <Banknote className="w-5 h-5 text-brand" />
              </span>
              <div>
                <h2 className="text-[16px] font-extrabold text-ink font-display">Cash &amp; expenses</h2>
                <p className="text-[11px] text-quill-soft font-medium mt-0.5">
                  Walk-in cash adds to income; expenses are deducted.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowExpenseForm(!showExpenseForm)}
              className="flex items-center gap-2 bg-ink hover:bg-ink-3 text-white text-[12px] font-bold px-5 py-3 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Plus className="w-4 h-4" />
              {showExpenseForm ? 'Hide entry form' : 'Add cash or expense'}
            </button>
          </div>

          {showExpenseForm && (
            <div className="bg-mist rounded-[20px] p-5 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 items-end">
                <div>
                  <label htmlFor="exp-name" className={labelClass}>Name</label>
                  <input
                    id="exp-name"
                    type="text"
                    placeholder="e.g. Fuel, food, rent"
                    value={newExpenseName}
                    onChange={(e) => setNewExpenseName(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="exp-amount" className={labelClass}>Amount</label>
                  <input
                    id="exp-amount"
                    type="number"
                    placeholder="0.00"
                    value={newExpenseAmount}
                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                    className={`${fieldClass} nums`}
                  />
                </div>
                <div>
                  <label htmlFor="exp-tag" className={labelClass}>Direction</label>
                  <select
                    id="exp-tag"
                    value={newExpenseTag}
                    onChange={(e) => setNewExpenseTag(e.target.value)}
                    className={`${fieldClass} cursor-pointer`}
                  >
                    <option value="cash">Cash in</option>
                    <option value="expense">Expense out</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="exp-desc" className={labelClass}>Description</label>
                  <input
                    id="exp-desc"
                    type="text"
                    placeholder="Optional detail"
                    value={newExpenseDescription}
                    onChange={(e) => setNewExpenseDescription(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddExpenseEntry}
                  disabled={!newExpenseName.trim() || !newExpenseAmount.trim()}
                  className="flex items-center justify-center gap-2 bg-brand hover:bg-brand-mid disabled:opacity-45 disabled:pointer-events-none text-white text-[12px] font-bold px-5 py-3 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add row
                </button>
              </div>
            </div>
          )}

          {expenseEntries.length > 0 ? (
            <div className="bg-mist rounded-[20px] overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className={thClass}>Name</th>
                    <th className={`${thClass} text-right`}>Amount</th>
                    <th className={`${thClass} text-center`}>Direction</th>
                    <th className={thClass}>Description</th>
                    <th className={`${thClass} text-center w-20`}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseEntries.map((entry, idx) => (
                    <tr key={idx} className="bg-shell border-t-4 border-mist">
                      <td className="py-4 px-5 text-[12px] font-bold text-ink">{entry.name}</td>
                      <td
                        className={`nums py-4 px-5 text-right text-[12px] font-bold ${
                          entry.tag === 'cash' ? 'text-[#3f9c68]' : 'text-[#c0453c]'
                        }`}
                      >
                        {entry.tag === 'cash' ? '+' : '-'}{currencySymbol}{money(Number(entry.amount) || 0)}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span
                          className={`text-[10px] font-bold px-3 py-1.5 rounded-full ${
                            entry.tag === 'cash' ? 'bg-[#e8f7ee] text-[#2f6b48]' : 'bg-[#fdeeea] text-[#a8492f]'
                          }`}
                        >
                          {entry.tag === 'cash' ? 'Cash in' : 'Expense'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-[12px] text-quill font-semibold">{entry.description || '—'}</td>
                      <td className="py-4 px-5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveExpenseEntry(idx)}
                          title="Remove row"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-quill hover:text-[#c0453c] hover:bg-[#fdeeea] transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !showExpenseForm && (
              <div className="bg-mist rounded-[20px] p-8 text-center">
                <p className="text-[13px] font-bold text-ink">No cash movements recorded</p>
                <p className="text-[11px] text-quill-soft mt-1.5 font-medium">
                  Use "Add cash or expense" to log the day's petty cash.
                </p>
              </div>
            )
          )}
        </section>

        {/* Totals */}
        <section className="bg-ink rounded-[26px] p-7">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <span className="block text-[10px] font-bold text-white/45 uppercase tracking-wider mb-2">
                Total received
              </span>
              <span className="nums text-[26px] font-extrabold text-white font-display">
                {currencySymbol}{money(panelTotalReceived)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-white/45 uppercase tracking-wider mb-2">
                Total expense
              </span>
              <span className="nums text-[26px] font-extrabold text-white/80 font-display">
                {currencySymbol}{money(panelTotalExpense)}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-bold text-white/45 uppercase tracking-wider mb-2">
                Net balance
              </span>
              <span className="nums text-[26px] font-extrabold text-brand-soft font-display">
                {currencySymbol}{money(panelTotalReceived - panelTotalExpense)}
              </span>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className="px-6 py-3.5 bg-mist hover:bg-mist-2 text-ink rounded-full text-[12px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSaveLedger}
            disabled={saving || (todayInvoices.length === 0 && expenseEntries.length === 0)}
            className="flex items-center gap-2 px-6 py-3.5 bg-brand hover:bg-brand-mid disabled:opacity-45 disabled:pointer-events-none text-white rounded-full text-[12px] font-bold transition-colors duration-200 cursor-pointer shadow-[0_18px_34px_-20px_rgba(90,73,230,0.95)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving this ledger day…
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4" />
                Save ledger day
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ============ DETAIL VIEW ============
  if (viewMode === 'detail' && selectedEntry) {
    const cashIn = selectedEntry.expenses.filter((exp) => exp.tag === 'cash');
    const expensesOut = selectedEntry.expenses.filter((exp) => exp.tag !== 'cash');
    const net = selectedEntry.totalReceived - selectedEntry.totalExpense;

    return (
      <div className="space-y-6 animate-fade-in" id="ledger-detail-section">
        <button
          type="button"
          onClick={() => {
            setViewMode('list');
            setSelectedEntry(null);
          }}
          className="flex items-center gap-2 text-quill hover:text-ink text-[12px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to ledger days
        </button>

        <div className="bg-ink rounded-[26px] p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <span className="text-[10px] font-bold text-white/45 uppercase tracking-wider">Ledger report</span>
              <h2 className="nums text-[26px] font-extrabold text-white font-display tracking-tight mt-2">
                {selectedEntry.date}
              </h2>
              <p className="text-[11px] text-white/50 font-medium mt-1.5">
                Daily income and expense breakdown.
              </p>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-bold text-white/45 uppercase tracking-wider">Net balance</span>
              <span className="nums block text-[30px] font-extrabold text-brand-soft font-display mt-1.5">
                {currencySymbol}{money(net)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <div className="bg-white/10 rounded-[18px] p-5">
              <div className="flex items-center gap-2 text-white/60 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Received</span>
              </div>
              <span className="nums text-[22px] font-extrabold text-white font-display">
                {currencySymbol}{money(selectedEntry.totalReceived)}
              </span>
            </div>
            <div className="bg-white/10 rounded-[18px] p-5">
              <div className="flex items-center gap-2 text-white/60 mb-2">
                <TrendingDown className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Spent</span>
              </div>
              <span className="nums text-[22px] font-extrabold text-white font-display">
                {currencySymbol}{money(selectedEntry.totalExpense)}
              </span>
            </div>
          </div>
        </div>

        {/* Invoices */}
        {selectedEntry.invoices.length > 0 && (
          <div className="bg-shell rounded-[26px] p-6 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-9 h-9 rounded-xl bg-[#e8f7ee] flex items-center justify-center">
                <Receipt className="w-4 h-4 text-[#3f9c68]" />
              </span>
              <h3 className="text-[15px] font-extrabold text-ink font-display">
                Invoice income ({selectedEntry.invoices.length})
              </h3>
            </div>
            <div className="bg-mist rounded-[20px] overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className={thClass}>Invoice</th>
                    <th className={thClass}>Guest</th>
                    <th className={thClass}>Property</th>
                    <th className={`${thClass} text-right`}>Amount</th>
                    <th className={`${thClass} text-center w-20`}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEntry.invoices.map((inv) => (
                    <tr key={inv.id} className="bg-shell border-t-4 border-mist">
                      <td className="py-4 px-5">
                        <span className="nums text-[11px] font-bold text-brand bg-brand-pale px-2.5 py-1.5 rounded-full">
                          #{inv.id}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-[12px] font-bold text-ink">{inv.guest_name}</td>
                      <td className="py-4 px-5 text-[12px] text-quill font-semibold">{inv.hotel_name || '—'}</td>
                      <td className="nums py-4 px-5 text-right text-[12px] font-bold text-[#3f9c68]">
                        +{currencySymbol}{money(inv.total_amount)}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteLedgerInvoice(inv.id)}
                          title="Remove from ledger"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-quill hover:text-[#c0453c] hover:bg-[#fdeeea] transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Cash in */}
        {cashIn.length > 0 && (
          <div className="bg-shell rounded-[26px] p-6 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-9 h-9 rounded-xl bg-[#e8f7ee] flex items-center justify-center">
                <Banknote className="w-4 h-4 text-[#3f9c68]" />
              </span>
              <h3 className="text-[15px] font-extrabold text-ink font-display">Cash received ({cashIn.length})</h3>
            </div>
            <div className="bg-mist rounded-[20px] overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className={thClass}>Name</th>
                    <th className={thClass}>Description</th>
                    <th className={`${thClass} text-right`}>Amount</th>
                    <th className={`${thClass} text-center w-20`}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {cashIn.map((exp) => (
                    <tr key={exp.id} className="bg-shell border-t-4 border-mist">
                      <td className="py-4 px-5 text-[12px] font-bold text-ink">{exp.name}</td>
                      <td className="py-4 px-5 text-[12px] text-quill font-semibold">{exp.description || '—'}</td>
                      <td className="nums py-4 px-5 text-right text-[12px] font-bold text-[#3f9c68]">
                        +{currencySymbol}{money(exp.amount)}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteCashExpense(exp.id)}
                          title="Remove entry"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-quill hover:text-[#c0453c] hover:bg-[#fdeeea] transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Expenses out */}
        {expensesOut.length > 0 && (
          <div className="bg-shell rounded-[26px] p-6 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-9 h-9 rounded-xl bg-[#fdeeea] flex items-center justify-center">
                <Banknote className="w-4 h-4 text-[#c0453c]" />
              </span>
              <h3 className="text-[15px] font-extrabold text-ink font-display">Expenses ({expensesOut.length})</h3>
            </div>
            <div className="bg-mist rounded-[20px] overflow-hidden overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className={thClass}>Name</th>
                    <th className={thClass}>Description</th>
                    <th className={`${thClass} text-right`}>Amount</th>
                    <th className={`${thClass} text-center w-20`}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {expensesOut.map((exp) => (
                    <tr key={exp.id} className="bg-shell border-t-4 border-mist">
                      <td className="py-4 px-5 text-[12px] font-bold text-ink">{exp.name}</td>
                      <td className="py-4 px-5 text-[12px] text-quill font-semibold">{exp.description || '—'}</td>
                      <td className="nums py-4 px-5 text-right text-[12px] font-bold text-[#c0453c]">
                        -{currencySymbol}{money(exp.amount)}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteCashExpense(exp.id)}
                          title="Remove entry"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-quill hover:text-[#c0453c] hover:bg-[#fdeeea] transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ LIST VIEW ============
  return (
    <div className="space-y-6 animate-fade-in" id="ledger-section">
      {/* Header row */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-[26px] leading-none font-extrabold text-ink font-display tracking-tight">Ledger days</h1>
          <p className="text-[12px] text-quill-soft font-medium mt-2">
            Daily income against cash spend, reconciled per date.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            aria-label="Ledger date"
            className="nums bg-mist hover:bg-mist-2 rounded-full px-4 py-3 text-[12px] font-semibold text-ink outline-none transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          <button
            type="button"
            onClick={fetchLedgerData}
            disabled={loading}
            className="flex items-center gap-2 bg-mist hover:bg-mist-2 disabled:opacity-50 disabled:pointer-events-none text-ink text-[12px] font-bold px-4 py-3 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => handleOpenCreatePanel()}
            className="flex items-center gap-2 bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-5 py-3 rounded-full transition-colors duration-200 cursor-pointer shadow-[0_18px_34px_-20px_rgba(90,73,230,0.95)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <PlusCircle className="w-4 h-4" />
            Record a day
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#fdeeea] text-[#a8492f] p-4 rounded-[18px] text-[12px] font-bold flex gap-2.5 items-center">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-shell p-6 rounded-[24px] shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-quill-soft uppercase tracking-wider">Total received</span>
            <span className="w-8 h-8 rounded-full bg-[#e8f7ee] flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#3f9c68]" />
            </span>
          </div>
          <span className="nums text-[26px] font-extrabold text-ink font-display">
            {currencySymbol}{money(grandTotalReceived)}
          </span>
        </div>

        <div className="bg-shell p-6 rounded-[24px] shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-quill-soft uppercase tracking-wider">Total expense</span>
            <span className="w-8 h-8 rounded-full bg-[#fdeeea] flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-[#c0453c]" />
            </span>
          </div>
          <span className="nums text-[26px] font-extrabold text-ink font-display">
            {currencySymbol}{money(grandTotalExpense)}
          </span>
        </div>

        <div className="bg-ink p-6 rounded-[24px]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-white/45 uppercase tracking-wider">Net balance</span>
            <span className="w-8 h-8 rounded-full bg-white/12 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-brand-soft" />
            </span>
          </div>
          <span className="nums text-[26px] font-extrabold text-white font-display">
            {currencySymbol}{money(grandTotalReceived - grandTotalExpense)}
          </span>
        </div>
      </div>

      {/* Ledger list */}
      <div className="bg-shell rounded-[26px] p-6 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <h2 className="text-[17px] font-extrabold text-ink font-display tracking-tight">All ledger days</h2>
            <p className="text-[11px] text-quill-soft font-medium mt-1">
              Open a report to see the full breakdown for that date.
            </p>
          </div>
          <span className="nums text-[11px] font-bold text-quill bg-mist px-3.5 py-2 rounded-full">
            {ledgerEntries.length} entr{ledgerEntries.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>

        {loading ? (
          <div className="bg-mist rounded-[20px] p-14 text-center">
            <div className="w-9 h-9 border-[3px] border-hairline border-t-brand rounded-full animate-spin mx-auto" />
            <p className="text-[12px] text-quill font-bold mt-4">Loading your ledger…</p>
          </div>
        ) : ledgerEntries.length === 0 ? (
          <div className="bg-mist rounded-[20px] p-14 text-center">
            <p className="text-[14px] font-bold text-ink">No ledger days recorded yet</p>
            <p className="text-[11px] text-quill-soft mt-2 font-medium max-w-sm mx-auto leading-relaxed">
              Each ledger day captures the invoices settled and the cash spent, so you can close the books daily.
            </p>
            <button
              type="button"
              onClick={() => handleOpenCreatePanel()}
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-5 py-3 rounded-full mt-5 transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <PlusCircle className="w-4 h-4" /> Record your first day
            </button>
          </div>
        ) : (
          <div className="bg-mist rounded-[20px] overflow-hidden overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Contents</th>
                  <th className={`${thClass} text-right`}>Received</th>
                  <th className={`${thClass} text-right`}>Expense</th>
                  <th className={`${thClass} text-right`}>Net</th>
                  <th className={`${thClass} text-center`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry) => {
                  const net = entry.totalReceived - entry.totalExpense;
                  return (
                    <tr key={entry.date} className="bg-shell border-t-4 border-mist">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-full bg-brand-pale flex items-center justify-center shrink-0">
                            <Calendar className="w-3.5 h-3.5 text-brand" />
                          </span>
                          <span className="nums text-[12px] font-bold text-ink">{entry.date}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-[11px] text-quill font-semibold">
                        {entry.invoices.length} invoice{entry.invoices.length !== 1 ? 's' : ''} ·{' '}
                        {entry.expenses.length} cash entr{entry.expenses.length !== 1 ? 'ies' : 'y'}
                      </td>
                      <td className="nums py-4 px-5 text-right text-[12px] font-bold text-[#3f9c68]">
                        +{currencySymbol}{money(entry.totalReceived)}
                      </td>
                      <td className="nums py-4 px-5 text-right text-[12px] font-bold text-[#c0453c]">
                        -{currencySymbol}{money(entry.totalExpense)}
                      </td>
                      <td className={`nums py-4 px-5 text-right text-[12px] font-extrabold ${net >= 0 ? 'text-ink' : 'text-[#c0453c]'}`}>
                        {currencySymbol}{money(net)}
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleShowReport(entry)}
                            className="flex items-center gap-1.5 bg-brand-pale hover:bg-[#e6e2fd] text-brand text-[11px] font-bold px-3 py-2 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Report
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenCreatePanel(entry.date)}
                            className="flex items-center gap-1.5 bg-mist hover:bg-mist-2 text-ink text-[11px] font-bold px-3 py-2 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({ type: 'entry', date: entry.date })}
                            className="flex items-center gap-1.5 bg-[#fdeeea] hover:bg-[#fbe0d9] text-[#a8492f] text-[11px] font-bold px-3 py-2 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/45 animate-fade-in">
          <div className="bg-shell rounded-[26px] max-w-md w-full p-7 space-y-5 shadow-[0_40px_80px_-40px_rgba(19,17,38,0.8)]">
            <div className="space-y-2">
              <h3 className="text-[18px] font-extrabold text-ink font-display tracking-tight">
                Delete this ledger day?
              </h3>
              <p className="text-[13px] text-quill leading-relaxed font-medium">
                Everything recorded for <strong className="text-ink">{deleteConfirm.date}</strong> — invoices and cash
                entries — will be removed. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2.5 justify-end pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-5 py-3 bg-mist hover:bg-mist-2 text-ink rounded-full text-[12px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Keep as is
              </button>
              <button
                type="button"
                onClick={() => {
                  const entry = ledgerEntries.find((e) => e.date === deleteConfirm.date);
                  if (entry) handleDeleteEntireEntry(entry);
                }}
                className="px-5 py-3 bg-[#c0453c] hover:bg-[#a83a32] text-white rounded-full text-[12px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Delete day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
