import { useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, CreditCard, History, Save } from 'lucide-react';
import { Contact } from '../lib/contacts';
import { Invoice } from '../types';
import { InvoiceTemplate, getCurrencySymbol } from '../lib/settings';

interface PaymentProps {
  invoices: Invoice[];
  vendorInvoices: Invoice[];
  contacts: Contact[];
  template?: InvoiceTemplate | null;
  onSavePayment: (contactId: string, amount: number) => Promise<number>;
}

const money = (value: number, symbol: string) =>
  `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function Payment({ invoices, vendorInvoices, contacts, template, onSavePayment }: PaymentProps) {
  const [contactId, setContactId] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const currencySymbol = getCurrencySymbol(template?.currency || 'PKR');

  const selectedContact = contacts.find((contact) => contact.id === contactId);
  const contactInvoices = useMemo(() => {
    if (!contactId) return [];
    return [...invoices, ...vendorInvoices]
      .filter((invoice) => invoice.customerId === contactId && invoice.balance > 0)
      .sort((a, b) => {
        const dateDifference = new Date(a.date).getTime() - new Date(b.date).getTime();
        return dateDifference || a.id.localeCompare(b.id);
      });
  }, [contactId, invoices, vendorInvoices]);

  const numericAmount = Math.max(0, Number(amount) || 0);
  const outstanding = contactInvoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const plannedAllocation = Math.min(numericAmount, outstanding);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!contactId) return setError('Select a contact first.');
    if (numericAmount <= 0) return setError('Enter a payment amount greater than zero.');
    if (contactInvoices.length === 0) return setError('This contact has no unpaid invoices.');

    setSaving(true);
    try {
      const allocated = await onSavePayment(contactId, numericAmount);
      setMessage(
        allocated < numericAmount
          ? `${money(allocated, currencySymbol)} applied. The remaining ${money(numericAmount - allocated, currencySymbol)} has no outstanding invoice balance.`
          : `${money(allocated, currencySymbol)} applied from oldest to newest invoice.`
      );
      setAmount('');
    } catch (err: any) {
      setError(err?.message || 'Could not save this payment.');
    } finally {
      setSaving(false);
    }
  };

  const history = useMemo(() => {
    return [...invoices, ...vendorInvoices]
      .flatMap((invoice) => (invoice.payments || []).map((entry) => ({ ...entry, invoice })))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, vendorInvoices]);

  return (
    <div className="space-y-6">
      <section className="bg-ink rounded-[26px] p-6 sm:p-8 text-white">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-brand flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-[20px] font-extrabold font-display">Record a payment</h2>
            <p className="text-[12px] text-white/60 mt-1">Apply one payment automatically from the oldest unpaid invoice forward.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto] gap-3 items-end">
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-white/55 mb-2">Contact</span>
            <select value={contactId} onChange={(event) => { setContactId(event.target.value); setMessage(''); setError(''); }} className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-[12px] font-semibold text-white outline-none focus:border-brand-soft">
              <option value="" className="text-ink">Select vendor or customer</option>
              {contacts.map((contact) => <option key={contact.id} value={contact.id} className="text-ink">{contact.fullName} · {contact.type}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-white/55 mb-2">Payment amount</span>
            <input type="number" min="0" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); setMessage(''); setError(''); }} placeholder="0" className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-[12px] font-semibold text-white placeholder:text-white/30 outline-none focus:border-brand-soft" />
          </label>
          <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-mid disabled:opacity-60 text-white text-[12px] font-bold px-5 py-3 rounded-xl cursor-pointer">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save payment'}
          </button>
        </form>

        {selectedContact && (
          <div className="mt-5 flex flex-wrap gap-4 text-[11px] text-white/65">
            <span>{contactInvoices.length} unpaid invoice{contactInvoices.length === 1 ? '' : 's'}</span>
            <span>Outstanding: <strong className="text-white">{money(outstanding, currencySymbol)}</strong></span>
            <span>Will allocate: <strong className="text-brand-soft">{money(plannedAllocation, currencySymbol)}</strong></span>
          </div>
        )}
        {message && <div className="mt-5 flex items-center gap-2 text-[12px] font-semibold text-[#9ee0b8]"><CheckCircle2 className="w-4 h-4" />{message}</div>}
        {error && <div className="mt-5 flex items-center gap-2 text-[12px] font-semibold text-[#ffb2a5]"><AlertCircle className="w-4 h-4" />{error}</div>}
      </section>

      <section className="bg-shell rounded-[26px] border border-hairline overflow-hidden">
        <div className="px-6 py-5 border-b border-hairline flex items-center gap-3">
          <History className="w-4 h-4 text-brand" />
          <div><h2 className="text-[16px] font-extrabold text-ink font-display">Payment entries</h2><p className="text-[11px] text-quill-soft mt-1">All payments recorded against invoices.</p></div>
        </div>
        {history.length === 0 ? <p className="p-6 text-[12px] text-quill">No payment entries yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-mist text-[10px] uppercase tracking-wider text-quill-soft"><th className="px-6 py-3">Date</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Invoice</th><th className="px-4 py-3">Type</th><th className="px-6 py-3 text-right">Amount</th></tr></thead><tbody>
            {history.map((entry, index) => <tr key={`${entry.invoice.id}-${entry.date}-${entry.amount}-${index}`} className="border-t border-hairline text-[12px]"><td className="px-6 py-4 nums text-quill">{entry.date}</td><td className="px-4 py-4 font-bold text-ink">{entry.invoice.customerName}</td><td className="px-4 py-4 font-mono text-ink">{entry.invoice.id}</td><td className="px-4 py-4 capitalize text-quill">{entry.invoice.invoiceType || 'customer'}</td><td className="px-6 py-4 text-right nums font-extrabold text-[#2f6b48]">{money(entry.amount, currencySymbol)}</td></tr>)}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
