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

interface PaymentLog {
  paymentId: string;
  date: string;
  name: string;
  phone: string;
  amount: number;
}

const money = (value: number, symbol: string) =>
  `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function Payment({ invoices, vendorInvoices, contacts, template, onSavePayment }: PaymentProps) {
  const [contactId, setContactId] = useState('');
  const [contactType, setContactType] = useState<'customer' | 'vendor'>('customer');
  const [contactSearch, setContactSearch] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const currencySymbol = getCurrencySymbol(template?.currency || 'PKR');

  const selectedContact = contacts.find((contact) => contact.id === contactId);
  const contactMatches = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query || contactId) return [];
    return contacts.filter((contact) => contact.type === contactType &&
      [contact.fullName, contact.email, contact.phone, contact.type].some((value) =>
        (value || '').toLowerCase().includes(query)
      )
    ).slice(0, 8);
  }, [contactId, contactSearch, contactType, contacts]);

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

  const history = useMemo<PaymentLog[]>(() => {
    const grouped = new Map<string, PaymentLog>();
    [...invoices, ...vendorInvoices].forEach((invoice) => {
      (invoice.payments || []).forEach((entry, index) => {
        // New entries share paymentId across invoice splits. Older entries use
        // a stable fallback key and remain visible individually.
        const paymentId = entry.paymentId || `${invoice.id}-${entry.date}-${index}`;
        const existing = grouped.get(paymentId);
        if (existing) {
          existing.amount += Number(entry.amount || 0);
        } else {
          grouped.set(paymentId, {
            paymentId,
            date: entry.date,
            name: entry.contactName || invoice.customerName,
            phone: entry.contactPhone || invoice.customerPhone || '',
            amount: Number(entry.amount || 0),
          });
        }
      });
    });
    return Array.from(grouped.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, vendorInvoices]);

  const chooseContact = (contact: Contact) => {
    setContactId(contact.id);
    setContactSearch(contact.fullName);
    setMessage('');
    setError('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!contactId) return setError('Select a contact from the search results.');
    if (numericAmount <= 0) return setError('Enter a payment amount greater than zero.');
    if (contactInvoices.length === 0) return setError('This contact has no unpaid invoices.');

    setSaving(true);
    try {
      const allocated = await onSavePayment(contactId, numericAmount);
      setMessage(
        allocated < numericAmount
          ? `${money(allocated, currencySymbol)} saved. The remaining ${money(numericAmount - allocated, currencySymbol)} has no outstanding invoice balance.`
          : `${money(allocated, currencySymbol)} saved as one payment entry and allocated oldest to newest.`
      );
      setAmount('');
    } catch (err: any) {
      setError(err?.message || 'Could not save this payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-ink rounded-[26px] p-6 sm:p-8 text-white">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-brand flex items-center justify-center shrink-0"><CreditCard className="w-5 h-5" /></div>
          <div><h2 className="text-[20px] font-extrabold font-display">Record a payment</h2><p className="text-[12px] text-white/60 mt-1">Apply one payment automatically from the oldest unpaid invoice forward.</p></div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[0.85fr_1.5fr_1fr_auto] gap-3 items-end">
          <label htmlFor="payment-contact-type" className="block"><span className="block text-[10px] font-bold uppercase tracking-wider text-white/55 mb-2">Contact type</span><select id="payment-contact-type" value={contactType} onChange={(event) => { setContactType(event.target.value as 'customer' | 'vendor'); setContactId(''); setContactSearch(''); setMessage(''); setError(''); }} className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-[12px] font-semibold text-white outline-none focus:border-brand-soft"><option value="customer" className="text-ink">Customer</option><option value="vendor" className="text-ink">Vendor</option></select></label>
          <div className="relative">
            <label htmlFor="payment-contact" className="block text-[10px] font-bold uppercase tracking-wider text-white/55 mb-2">Vendor or customer</label>
            <input id="payment-contact" type="text" value={contactSearch} onChange={(event) => { setContactSearch(event.target.value); setContactId(''); setMessage(''); setError(''); }} placeholder="Search contact name" autoComplete="off" className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-[12px] font-semibold text-white placeholder:text-white/30 outline-none focus:border-brand-soft" />
            {contactMatches.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-shell rounded-2xl shadow-xl border border-hairline overflow-hidden">
                {contactMatches.map((contact) => <button type="button" key={contact.id} onClick={() => chooseContact(contact)} className="w-full text-left px-4 py-3 hover:bg-mist text-[12px] font-bold text-ink">{contact.fullName}<span className="block text-[10px] text-quill font-medium capitalize">{contact.type}{contact.phone ? ` · ${contact.phone}` : ''}{contact.email ? ` · ${contact.email}` : ''}</span></button>)}
              </div>
            )}
          </div>
          <label className="block"><span className="block text-[10px] font-bold uppercase tracking-wider text-white/55 mb-2">Payment amount</span><input type="number" min="0" step="0.01" value={amount} onChange={(event) => { setAmount(event.target.value); setMessage(''); setError(''); }} placeholder="0" className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-[12px] font-semibold text-white placeholder:text-white/30 outline-none focus:border-brand-soft" /></label>
          <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-mid disabled:opacity-60 text-white text-[12px] font-bold px-5 py-3 rounded-xl cursor-pointer"><Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save payment'}</button>
        </form>

        {selectedContact && <div className="mt-5 flex flex-wrap gap-4 text-[11px] text-white/65"><span>{selectedContact.type} · {selectedContact.fullName}</span><span>{contactInvoices.length} unpaid invoice{contactInvoices.length === 1 ? '' : 's'}</span><span>Outstanding: <strong className="text-white">{money(outstanding, currencySymbol)}</strong></span><span>Will allocate: <strong className="text-brand-soft">{money(plannedAllocation, currencySymbol)}</strong></span></div>}
        {message && <div className="mt-5 flex items-center gap-2 text-[12px] font-semibold text-[#9ee0b8]"><CheckCircle2 className="w-4 h-4" />{message}</div>}
        {error && <div className="mt-5 flex items-center gap-2 text-[12px] font-semibold text-[#ffb2a5]"><AlertCircle className="w-4 h-4" />{error}</div>}
      </section>

      <section className="bg-shell rounded-[26px] border border-hairline overflow-hidden">
        <div className="px-6 py-5 border-b border-hairline flex items-center gap-3"><History className="w-4 h-4 text-brand" /><div><h2 className="text-[16px] font-extrabold text-ink font-display">Payment entries</h2><p className="text-[11px] text-quill-soft mt-1">Each saved payment appears once, even when it covers multiple invoices.</p></div></div>
        {history.length === 0 ? <p className="p-6 text-[12px] text-quill">No payment entries yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-mist text-[10px] uppercase tracking-wider text-quill-soft"><th className="px-6 py-3">Date</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Phone number</th><th className="px-6 py-3 text-right">Amount</th></tr></thead><tbody>{history.map((entry) => <tr key={entry.paymentId} className="border-t border-hairline text-[12px]"><td className="px-6 py-4 nums text-quill">{entry.date}</td><td className="px-4 py-4 font-bold text-ink">{entry.name}</td><td className="px-4 py-4 text-quill">{entry.phone || '—'}</td><td className="px-6 py-4 text-right nums font-extrabold text-[#2f6b48]">{money(entry.amount, currencySymbol)}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
