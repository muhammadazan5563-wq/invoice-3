import React, { useState, useEffect, useMemo } from 'react';
import { Invoice, BookingItem, PaymentRecord } from '../types';
import { Contact } from '../lib/contacts';
import { InvoiceTemplate, getCurrencySymbol } from '../lib/settings';
import { getTodayInTimezone } from '../lib/timezone';
import { Plus, Trash2, ArrowLeft, Save, Sparkles } from 'lucide-react';

interface InvoiceFormProps {
  invoice?: Invoice;
  contacts: Contact[];
  onSave: (invoiceData: Omit<Invoice, 'rowIndex' | 'rawRow'> & { rowIndex?: number }) => Promise<void>;
  onCancel: () => void;
  suggestInvoiceId?: string;
  template?: InvoiceTemplate | null;
}

type FormStatus = 'Paid' | 'Due' | 'Unpaid' | 'Pending' | 'Overdue';

const fieldClass =
  'w-full bg-mist hover:bg-mist-2 focus:bg-mist-2 rounded-2xl px-4 py-3.5 text-[13px] font-semibold text-ink placeholder:text-quill-soft placeholder:font-medium outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-55 disabled:pointer-events-none';

const cellClass =
  'w-full bg-mist hover:bg-mist-2 focus:bg-shell rounded-xl px-3 py-2 text-[12px] font-semibold text-ink placeholder:text-quill-soft outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand';

const labelClass = 'block text-[10px] font-bold text-quill-soft uppercase tracking-wider mb-2';

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function InvoiceForm({ invoice, contacts, onSave, onCancel, suggestInvoiceId, template }: InvoiceFormProps) {
  const currencySymbol = getCurrencySymbol(template?.currency || 'USD');

  const [id, setId] = useState('');
  const [date, setDate] = useState('');
  const [invoiceType, setInvoiceType] = useState<'customer' | 'vendor'>('customer');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState('');
  const [status, setStatus] = useState<FormStatus>('Pending');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<BookingItem[]>([
    { roomType: '', quantity: 1, checkIn: '', checkOut: '', nights: 1, price: 0, total: 0 }
  ]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultNotes =
    template?.paymentDetails || `Beneficiary: Bank of America\nSwift Sort\nAccount No.: 324 6654 7766 9992`;

  const eligibleContacts = useMemo(
    () => contacts.filter((contact) => contact.type === invoiceType),
    [contacts, invoiceType]
  );
  const contactMatches = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return [];
    return eligibleContacts
      .filter((contact) => `${contact.fullName} ${contact.email} ${contact.companyName}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [contactSearch, eligibleContacts]);

  const selectContact = (contact: Contact) => {
    setSelectedContactId(contact.id);
    setContactSearch(contact.fullName);
    setCustomerName(contact.fullName);
    setCustomerEmail(contact.email);
    setCustomerPhone(contact.phone);
  };

  useEffect(() => {
    if (invoice) {
      setId(invoice.id);
      setDate(invoice.date);
      setInvoiceType(invoice.invoiceType || 'customer');
      setCustomerName(invoice.customerName);
      setContactSearch(invoice.customerName);
      setCustomerEmail(invoice.customerEmail);
      setCustomerPhone(invoice.customerPhone || '');
      setAmountPaid(invoice.amountPaid);
      setPaymentDate(invoice.paymentDate || invoice.date);
      setStatus(invoice.status);
      setNotes(invoice.notes);
      setItems(
        invoice.items.length > 0
          ? invoice.items
          : [{ roomType: '', quantity: 1, checkIn: '', checkOut: '', nights: 1, price: 0, total: 0 }]
      );
      setSubtotal(invoice.totalAmount);

      let initialPayments = invoice.payments || [];
      if (initialPayments.length === 0 && invoice.amountPaid > 0) {
        initialPayments = [{ amount: invoice.amountPaid, date: invoice.paymentDate || invoice.date }];
      }
      if (initialPayments.length === 0) {
        initialPayments = [{ amount: 0, date: invoice.date }];
      }
      setPayments(initialPayments);
    } else {
      const today = getTodayInTimezone(template?.timezone || 'UTC');
      setId(suggestInvoiceId || `INV-${Math.floor(1000 + Math.random() * 9000)}`);
      setDate(today);
      setInvoiceType('customer');
      setCustomerName('');
      setContactSearch('');
      setSelectedContactId('');
      setCustomerEmail('');
      setCustomerPhone('');
      setAmountPaid(0);
      setPaymentDate(today);
      setStatus('Due');
      setNotes(template?.paymentDetails || template?.defaultNotes || defaultNotes);
      setItems([
        {
          roomType: 'Tuna',
          quantity: 1,
          checkIn: today,
          checkOut: getNextDayStr(today),
          nights: 1,
          price: 50.0,
          total: 50.0
        }
      ]);
      setPayments([{ amount: 0, date: today }]);
    }
  }, [invoice, suggestInvoiceId, template]);

  function getNextDayStr(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

  const calculateNights = (checkInStr: string, checkOutStr: string): number => {
    if (!checkInStr || !checkOutStr) return 1;
    try {
      const d1 = new Date(checkInStr);
      const d2 = new Date(checkOutStr);
      const diffTime = d2.getTime() - d1.getTime();
      if (diffTime <= 0) return 1;
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 1;
    }
  };

  useEffect(() => {
    const calculatedSubtotal = items.reduce((acc, curr) => acc + curr.quantity * curr.price, 0);
    setSubtotal(calculatedSubtotal);
  }, [items]);

  useEffect(() => {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    setAmountPaid(totalPaid);

    const firstDate = payments.find((p) => p.date)?.date;
    if (firstDate) setPaymentDate(firstDate);
  }, [payments]);

  useEffect(() => {
    const currentBalance = subtotal - amountPaid;
    if (currentBalance <= 0) {
      setStatus('Paid');
    } else if (status === 'Paid') {
      setStatus('Due');
    }
  }, [subtotal, amountPaid, status]);

  const handleAddPayment = () => {
    const today = getTodayInTimezone(template?.timezone || 'UTC');
    setPayments([...payments, { amount: 0, date: today }]);
  };

  const handleRemovePayment = (index: number) => {
    if (payments.length === 1) return;
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handlePaymentChange = (index: number, field: keyof PaymentRecord, value: any) => {
    const updated = [...payments];
    const item = { ...updated[index] };
    if (field === 'amount') {
      item.amount = Math.max(0, parseFloat(value) || 0);
    } else if (field === 'date') {
      item.date = value;
    }
    updated[index] = item;
    setPayments(updated);
  };

  const handleItemChange = (index: number, field: keyof BookingItem, value: any) => {
    const updated = [...items];
    const currentItem = { ...updated[index] };

    if (field === 'roomType') {
      currentItem.roomType = value;
    } else if (field === 'description') {
      currentItem.description = value;
    } else if (field === 'quantity') {
      currentItem.quantity = Math.max(1, parseInt(value) || 0);
    } else if (field === 'checkIn') {
      currentItem.checkIn = value;
      currentItem.nights = calculateNights(value, currentItem.checkOut);
    } else if (field === 'checkOut') {
      currentItem.checkOut = value;
      currentItem.nights = calculateNights(currentItem.checkIn, value);
    } else if (field === 'nights') {
      currentItem.nights = Math.max(1, parseInt(value) || 0);
    } else if (field === 'price') {
      currentItem.price = Math.max(0, parseFloat(value) || 0);
    }

    currentItem.total = currentItem.quantity * currentItem.price;
    updated[index] = currentItem;
    setItems(updated);
  };

  const addItemRow = () => {
    const today = getTodayInTimezone(template?.timezone || 'UTC');
    setItems([
      ...items,
      {
        roomType: 'Tuna',
        quantity: 1,
        checkIn: today,
        checkOut: getNextDayStr(today),
        nights: 1,
        price: 50.0,
        total: 50.0
      }
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim()) {
      setError('An invoice number is required before saving.');
      return;
    }
    if (!customerName.trim()) {
      setError(`Select a ${invoiceType} contact so the invoice can be addressed.`);
      return;
    }
    if (items.some((item) => !item.roomType.trim())) {
      setError('Every fish line needs a species, quantity and rate.');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      const balanceValue = subtotal - amountPaid;
      await onSave({
        rowIndex: invoice?.rowIndex,
        id: id.trim(),
        date,
        invoiceType,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        totalAmount: subtotal,
        amountPaid,
        paymentDate: paymentDate || date,
        balance: balanceValue,
        status,
        notes: notes.trim(),
        items: items.map((item) => ({
          ...item,
          total: item.quantity * item.price
        })),
        payments: payments.filter((p) => p.amount > 0 || p.date)
      });
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'We could not save this invoice. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const generateSampleItems = () => {
    setId('Z5');
    setDate('2026-07-18');
    setCustomerName('FAIZ');
    setCustomerEmail('albert@invoicefly.com');
    setStatus('Pending');
    setNotes(defaultNotes);
    setItems([
      { roomType: 'Tuna', quantity: 4, checkIn: '2026-07-18', checkOut: '2026-07-20', nights: 2, price: 50.0, total: 400.0 },
      { roomType: 'Tuna', quantity: 4, checkIn: '2026-07-18', checkOut: '2026-07-22', nights: 4, price: 75.0, total: 1200.0 }
    ]);
    setPayments([{ amount: 600.0, date: '2026-07-18' }]);
  };

  const balance = subtotal - amountPaid;

  const statusTone = (s: FormStatus, active: boolean) => {
    if (!active) return 'bg-mist text-quill hover:md:bg-mist-2';
    switch (s) {
      case 'Paid':
        return 'bg-[#3f9c68] text-white';
      case 'Due':
      case 'Pending':
        return 'bg-[#c98a2b] text-white';
      case 'Unpaid':
        return 'bg-[#c0453c] text-white';
      default:
        return 'bg-brand text-white';
    }
  };

  return (
    <div className="bg-shell rounded-[26px] p-6 lg:p-8 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]" id="invoice-form-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8 pb-6 border-b border-hairline">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 text-quill hover:text-ink text-[12px] font-bold mb-3 transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand rounded"
          >
            <ArrowLeft className="w-4 h-4" /> Back to invoices
          </button>
          <h2 className="text-[26px] leading-none font-extrabold tracking-tight text-ink font-display">
            {invoice ? `Edit invoice #${invoice.id}` : 'Create an invoice'}
          </h2>
          <p className="text-[12px] text-quill-soft font-medium mt-2">
            Fish line items, payments and totals — synced to your database.
          </p>
        </div>

        {!invoice && (
          <button
            type="button"
            onClick={generateSampleItems}
            className="flex items-center gap-2 bg-brand-pale text-brand hover:bg-[#e6e2fd] text-[12px] font-bold px-4 py-3 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Sparkles className="w-3.5 h-3.5" /> Fill sample fishery invoice
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="bg-[#fdeeea] text-[#a8492f] p-4 rounded-[18px] text-[12px] font-bold">{error}</div>
        )}

        {/* Invoice identity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="inv-id" className={labelClass}>Invoice number</label>
            <input
              id="inv-id"
              type="text"
              required
              disabled={!!invoice}
              value={id}
              onChange={(e) => setId(e.target.value)}
              className={fieldClass}
              placeholder="e.g. INV-1003"
            />
          </div>
          <div>
            <label htmlFor="inv-date" className={labelClass}>Invoice date</label>
            <input
              id="inv-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        {/* Guest / vendor contact */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="relative">
            <label htmlFor="inv-contact" className={labelClass}>{invoiceType === 'vendor' ? 'Vendor name' : 'Customer name'}</label>
            <input id="inv-contact" type="text" required value={contactSearch || customerName} onChange={(e) => { setContactSearch(e.target.value); setCustomerName(e.target.value); setSelectedContactId(''); }} className={fieldClass} placeholder={`Search ${invoiceType} name`} />
            {contactMatches.length > 0 && !selectedContactId && !invoice && <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-shell rounded-2xl shadow-xl border border-hairline overflow-hidden">{contactMatches.map((contact) => <button type="button" key={contact.id} onClick={() => selectContact(contact)} className="w-full text-left px-4 py-3 hover:bg-mist text-[12px] font-bold text-ink">{contact.fullName}<span className="block text-[10px] text-quill font-medium">{contact.email}{contact.phone ? ` · ${contact.phone}` : ''}</span></button>)}</div>}
          </div>
          <div><label htmlFor="inv-email" className={labelClass}>{invoiceType === 'vendor' ? 'Vendor email' : 'Customer email'}</label><input id="inv-email" type="email" value={customerEmail} readOnly={!!selectedContactId} onChange={(e) => setCustomerEmail(e.target.value)} className={fieldClass} placeholder="Email" /></div>
          <div><label htmlFor="inv-phone" className={labelClass}>Phone</label><input id="inv-phone" value={customerPhone} readOnly={!!selectedContactId} onChange={(e) => setCustomerPhone(e.target.value)} className={fieldClass} placeholder="Phone" /></div>
          <div><label htmlFor="inv-type" className={labelClass}>Invoice type</label><select id="inv-type" disabled={!!invoice} value={invoiceType} onChange={(e) => { setInvoiceType(e.target.value as 'customer' | 'vendor'); setContactSearch(''); setSelectedContactId(''); setCustomerName(''); setCustomerEmail(''); setCustomerPhone(''); }} className={fieldClass}><option value="customer">Customer sale</option><option value="vendor">Vendor purchase</option></select></div>
        </div>

        {/* Booking lines */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[15px] font-extrabold text-ink font-display">Fish line items</h3>
            <button
              type="button"
              onClick={addItemRow}
              className="flex items-center gap-1.5 bg-brand-pale text-brand hover:bg-[#e6e2fd] text-[11px] font-bold px-3.5 py-2.5 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Plus className="w-3.5 h-3.5" /> Add fish line
            </button>
          </div>

          <div className="bg-mist rounded-[20px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left border-collapse">
                <thead>
                  <tr className="text-quill">
                    <th className="py-3.5 px-4 text-[10px] font-bold uppercase tracking-wider w-1/4">Fish species</th>
                    <th className="py-3.5 px-4 text-[10px] font-bold uppercase tracking-wider w-1/4">Description</th>
                    <th className="py-3.5 px-4 text-[10px] font-bold uppercase tracking-wider w-20 text-center">Quantity kg</th>
                    <th className="py-3.5 px-4 text-[10px] font-bold uppercase tracking-wider w-28 text-right">Rate per kg</th>
                    <th className="py-3.5 px-4 text-[10px] font-bold uppercase tracking-wider w-32 text-right">Amount</th>
                    <th className="py-3.5 px-4 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="bg-shell border-t-4 border-mist">
                      <td className="p-3">
                        <input
                          type="text"
                          required
                          aria-label={`Fish species for line ${index + 1}`}
                          value={item.roomType}
                          onChange={(e) => handleItemChange(index, 'roomType', e.target.value)}
                          className={cellClass}
                          placeholder="e.g. Deluxe suite"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          aria-label={`Description for line ${index + 1}`}
                          value={item.description || ''}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          className={cellClass}
                          placeholder="Grade / notes"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="0.01"
                          aria-label={`Quantity in kilograms for line ${index + 1}`}
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className={`${cellClass} nums text-center`}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          aria-label={`Rate per kilogram for line ${index + 1}`}
                          value={item.price || ''}
                          onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                          className={`${cellClass} nums text-right`}
                          placeholder="0.00"
                        />
                      </td>
                      <td className="nums p-3 text-right text-[13px] font-bold text-ink pr-4">
                        {currencySymbol}{money(item.quantity * item.price)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          disabled={items.length === 1}
                          title="Remove line"
                          className="w-8 h-8 rounded-full flex items-center justify-center text-quill hover:text-[#c0453c] hover:bg-[#fdeeea] disabled:opacity-40 disabled:pointer-events-none transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Status, notes and totals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 pt-2">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <span className={labelClass}>Invoice status</span>
              <div className="flex flex-wrap gap-2">
                {(['Paid', 'Due', 'Unpaid', 'Pending', 'Overdue'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`px-4 py-2.5 rounded-full text-[11px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${statusTone(s, status === s)}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="inv-notes" className={labelClass}>Payment &amp; fishery details</label>
              <textarea
                id="inv-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className={`${fieldClass} font-mono text-[12px] leading-relaxed`}
                placeholder={defaultNotes}
              />
            </div>
          </div>

          {/* Totals card */}
          <div className="bg-mist p-5 rounded-[22px] space-y-4">
            <h4 className="text-[13px] font-extrabold text-ink font-display">Receipt totals</h4>

            <div className="flex items-center justify-between gap-3">
              <label htmlFor="inv-gross" className="text-[11px] font-bold text-quill">
                Gross amount
              </label>
              <input
                id="inv-gross"
                type="number"
                min="0"
                step="0.01"
                value={subtotal || ''}
                onChange={(e) => setSubtotal(Math.max(0, parseFloat(e.target.value) || 0))}
                className="nums w-28 bg-shell rounded-xl px-3 py-2 text-right text-[12px] font-bold text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                placeholder="0.00"
              />
            </div>

            <div className="pt-3 border-t border-hairline space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-quill-soft uppercase tracking-wider">Payment history</span>
                <button
                  type="button"
                  onClick={handleAddPayment}
                  className="flex items-center gap-1 text-[11px] font-bold text-brand hover:text-brand-mid bg-shell px-3 py-2 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {payments.map((p, idx) => (
                  <div key={idx} className="flex gap-2 items-end bg-shell p-2.5 rounded-[16px]">
                    <div className="flex-1">
                      <label htmlFor={`pay-amt-${idx}`} className="block text-[9px] font-bold text-quill-soft uppercase tracking-wider mb-1">
                        Amount
                      </label>
                      <input
                        id={`pay-amt-${idx}`}
                        type="number"
                        min="0"
                        step="0.01"
                        value={p.amount || ''}
                        onChange={(e) => handlePaymentChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                        className="nums w-full bg-mist rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex-1">
                      <label htmlFor={`pay-date-${idx}`} className="block text-[9px] font-bold text-quill-soft uppercase tracking-wider mb-1">
                        Date
                      </label>
                      <input
                        id={`pay-date-${idx}`}
                        type="date"
                        value={p.date}
                        onChange={(e) => handlePaymentChange(idx, 'date', e.target.value)}
                        className="nums w-full bg-mist rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                      />
                    </div>
                    {payments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePayment(idx)}
                        title="Remove payment"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-quill hover:text-[#c0453c] hover:bg-[#fdeeea] transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-hairline">
              <span className="text-[11px] font-bold text-quill">Total paid</span>
              <span className="nums text-[15px] font-extrabold text-[#3f9c68] font-display">
                {currencySymbol}{money(amountPaid)}
              </span>
            </div>

            <div
              className={`${
                balance === 0 ? 'bg-[#3f9c68]' : balance < 0 ? 'bg-brand' : 'bg-[#c0453c]'
              } text-white px-4 py-3.5 rounded-[16px] flex justify-between items-center`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {balance < 0 ? 'Change due' : balance === 0 ? 'Paid in full' : 'Balance due'}
              </span>
              <span className="nums text-[16px] font-extrabold font-display">
                {balance < 0
                  ? `-${currencySymbol}${money(Math.abs(balance))}`
                  : `${currencySymbol}${money(balance)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2.5 pt-6 border-t border-hairline">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-3.5 rounded-full bg-mist hover:bg-mist-2 text-ink text-[12px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-brand hover:bg-brand-mid disabled:opacity-60 disabled:pointer-events-none text-white px-6 py-3.5 rounded-full text-[12px] font-bold transition-colors duration-200 cursor-pointer shadow-[0_18px_34px_-20px_rgba(90,73,230,0.95)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving your invoice…' : invoice ? 'Update invoice' : 'Save invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}
