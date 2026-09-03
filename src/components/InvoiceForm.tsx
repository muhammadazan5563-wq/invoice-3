import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { Invoice, BookingItem, PaymentRecord } from "../types";
import { Contact } from "../lib/contacts";
import { InvoiceTemplate, getCurrencySymbol } from "../lib/settings";
import { getTodayInTimezone } from "../lib/timezone";

interface InvoiceFormProps {
  invoice?: Invoice;
  contacts: Contact[];
  onSave: (
    invoiceData: Omit<Invoice, "rowIndex" | "rawRow"> & { rowIndex?: number },
  ) => Promise<void>;
  onCancel: () => void;
  suggestInvoiceId?: string;
  template?: InvoiceTemplate | null;
}

type FormStatus = "Paid" | "Due" | "Unpaid" | "Pending" | "Overdue";

const fieldClass =
  "w-full bg-mist hover:bg-mist-2 focus:bg-mist-2 rounded-2xl px-4 py-3.5 text-[13px] font-semibold text-ink placeholder:text-quill-soft outline-none transition-colors focus-visible:outline-2 focus-visible:outline-brand";
const cellClass =
  "w-full bg-mist hover:bg-mist-2 focus:bg-shell rounded-xl px-3 py-2 text-[12px] font-semibold text-ink placeholder:text-quill-soft outline-none focus-visible:outline-2 focus-visible:outline-brand";
const labelClass =
  "block text-[10px] font-bold text-quill-soft uppercase tracking-wider mb-2";
const money = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
const emptyItem = (): BookingItem => ({
  roomType: "",
  quantity: 1,
  checkIn: "",
  checkOut: "",
  nights: 1,
  price: 0,
  total: 0,
  description: "",
});

export default function InvoiceForm({
  invoice,
  contacts,
  onSave,
  onCancel,
  suggestInvoiceId,
  template,
}: InvoiceFormProps) {
  const currencySymbol = getCurrencySymbol(template?.currency || "USD");
  const [id, setId] = useState("");
  const [date, setDate] = useState("");
  const [invoiceType, setInvoiceType] = useState<"customer" | "vendor">(
    "customer",
  );
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [items, setItems] = useState<BookingItem[]>([emptyItem()]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [status, setStatus] = useState<FormStatus>("Due");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [items],
  );
  const balance = subtotal - amountPaid;
  const contactsForType = useMemo(
    () => contacts.filter((contact) => contact.type === invoiceType),
    [contacts, invoiceType],
  );
  const contactMatches = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return [];
    return contactsForType
      .filter((contact) =>
        `${contact.fullName} ${contact.email} ${contact.companyName}`
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 8);
  }, [contactSearch, contactsForType]);

  useEffect(() => {
    const today = getTodayInTimezone(template?.timezone || "UTC");
    if (invoice) {
      setId(invoice.id);
      setDate(invoice.date);
      setInvoiceType(invoice.invoiceType || "customer");
      setName(invoice.customerName);
      setContactSearch(invoice.customerName);
      setEmail(invoice.customerEmail);
      setPhone(invoice.customerPhone || "");
      setCompany("");
      setItems(invoice.items.length > 0 ? invoice.items : [emptyItem()]);
      setPayments(
        invoice.payments?.length
          ? invoice.payments
          : invoice.amountPaid > 0
            ? [
                {
                  amount: invoice.amountPaid,
                  date: invoice.paymentDate || invoice.date,
                },
              ]
            : [],
      );
      setAmountPaid(invoice.amountPaid);
      setStatus(invoice.status);
      setNotes(invoice.notes || "");
    } else {
      setId(
        suggestInvoiceId || `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      );
      setDate(today);
      setInvoiceType("customer");
      setName("");
      setContactSearch("");
      setSelectedContactId("");
      setEmail("");
      setPhone("");
      setCompany("");
      setItems([emptyItem()]);
      setPayments([]);
      setAmountPaid(0);
      setStatus("Due");
      setNotes(template?.paymentDetails || template?.defaultNotes || "");
    }
  }, [invoice, suggestInvoiceId, template]);

  useEffect(() => {
    const total = payments.reduce((sum, payment) => sum + payment.amount, 0);
    setAmountPaid(total);
  }, [payments]);

  useEffect(() => {
    if (subtotal > 0 && amountPaid >= subtotal) setStatus("Paid");
    else if (status === "Paid") setStatus("Due");
  }, [subtotal, amountPaid, status]);

  const selectContact = (contact: Contact) => {
    setSelectedContactId(contact.id);
    setContactSearch(contact.fullName);
    setName(contact.fullName);
    setEmail(contact.email);
    setPhone(contact.phone);
    setCompany(contact.companyName || "");
  };

  const updateItem = (
    index: number,
    field: "roomType" | "description" | "quantity" | "price",
    value: string,
  ) => {
    setItems((current) =>
      current.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item };
        if (field === "roomType" || field === "description")
          next[field] = value;
        if (field === "quantity")
          next.quantity = Math.max(0, Number(value) || 0);
        if (field === "price") next.price = Math.max(0, Number(value) || 0);
        next.total = next.quantity * next.price;
        return next;
      }),
    );
  };

  const addPayment = () => setPayments([...payments, { amount: 0, date }]);
  const updatePayment = (
    index: number,
    field: keyof PaymentRecord,
    value: string,
  ) => {
    setPayments((current) =>
      current.map((payment, paymentIndex) =>
        paymentIndex === index
          ? {
              ...payment,
              [field]:
                field === "amount" ? Math.max(0, Number(value) || 0) : value,
            }
          : payment,
      ),
    );
  };
  const removePayment = (index: number) =>
    setPayments(payments.filter((_, paymentIndex) => paymentIndex !== index));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!id.trim()) return setError("An invoice number is required.");
    if (!name.trim())
      return setError(`Select a ${invoiceType} contact before saving.`);
    if (
      items.some(
        (item) => !item.roomType.trim() || item.quantity <= 0 || item.price < 0,
      )
    )
      return setError("Every fish line needs a species, quantity and rate.");

    setIsSaving(true);
    try {
      await onSave({
        rowIndex: invoice?.rowIndex,
        id: id.trim(),
        date,
        invoiceType,
        customerName: name.trim(),
        customerEmail: email.trim(),
        customerPhone: phone.trim(),
        totalAmount: subtotal,
        amountPaid,
        paymentDate: payments.find((payment) => payment.date)?.date || date,
        balance,
        status,
        notes: notes.trim(),
        items: items.map((item) => ({
          ...item,
          nights: 1,
          total: item.quantity * item.price,
        })),
        payments: payments.filter(
          (payment) => payment.amount > 0 || payment.date,
        ),
      });
    } catch (saveError: any) {
      setError(saveError?.message || "Could not save this invoice.");
    } finally {
      setIsSaving(false);
    }
  };

  const statusClass = (value: FormStatus) =>
    value === status
      ? "bg-brand text-white"
      : "bg-mist text-quill hover:bg-mist-2";

  return (
    <div
      className="bg-shell rounded-[26px] p-6 lg:p-8 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]"
      id="invoice-form-container"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8 pb-6 border-b border-hairline">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 text-quill hover:text-ink text-[12px] font-bold mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Back to invoices
          </button>
          <h2 className="text-[26px] leading-none font-extrabold tracking-tight text-ink font-display">
            {invoice
              ? `Edit invoice #${invoice.id}`
              : "Create a fishery invoice"}
          </h2>
          <p className="text-[12px] text-quill-soft font-medium mt-2">
            Record seafood purchases and sales by species, kilograms and rate.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-8">
        {error && (
          <div className="bg-[#fdeeea] text-[#a8492f] p-4 rounded-[18px] text-[12px] font-bold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className={labelClass}>Invoice number</label>
            <input
              required
              disabled={!!invoice}
              value={id}
              onChange={(event) => setId(event.target.value)}
              className={fieldClass}
              placeholder="e.g. INV-1003"
            />
          </div>
          <div>
            <label className={labelClass}>Invoice date</label>
            <input
              required
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Invoice type</label>
            <select
              disabled={!!invoice}
              value={invoiceType}
              onChange={(event) => {
                setInvoiceType(event.target.value as "customer" | "vendor");
                setSelectedContactId("");
                setContactSearch("");
                setName("");
                setEmail("");
                setPhone("");
                setCompany("");
              }}
              className={fieldClass}
            >
              <option value="customer">Customer sale</option>
              <option value="vendor">Vendor purchase</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="relative">
            <label className={labelClass}>
              {invoiceType === "vendor" ? "Vendor name" : "Customer name"}
            </label>
            <input
              required
              value={contactSearch || name}
              onChange={(event) => {
                setContactSearch(event.target.value);
                setName(event.target.value);
                setSelectedContactId("");
              }}
              placeholder={`Search ${invoiceType} name…`}
              className={fieldClass}
            />
            {contactMatches.length > 0 && !selectedContactId && (
              <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-shell rounded-2xl shadow-xl border border-hairline overflow-hidden">
                {contactMatches.map((contact) => (
                  <button
                    type="button"
                    key={contact.id}
                    onClick={() => selectContact(contact)}
                    className="w-full text-left px-4 py-3 hover:bg-mist text-[12px] font-bold text-ink"
                  >
                    {contact.fullName}
                    <span className="block text-[10px] text-quill font-medium">
                      {contact.email}
                      {contact.phone ? ` · ${contact.phone}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className={labelClass}>
              {invoiceType === "vendor" ? "Vendor email" : "Customer email"}
            </label>
            <input
              type="email"
              value={email}
              readOnly={!!selectedContactId}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              value={phone}
              readOnly={!!selectedContactId}
              onChange={(event) => setPhone(event.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Company</label>
            <input
              value={company}
              readOnly={!!selectedContactId}
              onChange={(event) => setCompany(event.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[15px] font-extrabold text-ink font-display">
              Fish line items
            </h3>
            <button
              type="button"
              onClick={() => setItems([...items, emptyItem()])}
              className="flex items-center gap-1.5 bg-brand-pale text-brand text-[11px] font-bold px-3.5 py-2.5 rounded-full"
            >
              <Plus className="w-3.5 h-3.5" /> Add fish line
            </button>
          </div>
          <div className="bg-mist rounded-[20px] overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="text-quill">
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider">
                    Fish species
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider">
                    Description
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-right">
                    Quantity kg
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-right">
                    Rate per kg
                  </th>
                  <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-right">
                    Amount
                  </th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} className="bg-shell border-t-4 border-mist">
                    <td className="p-3">
                      <input
                        required
                        value={item.roomType}
                        onChange={(event) =>
                          updateItem(index, "roomType", event.target.value)
                        }
                        placeholder="e.g. Tuna"
                        className={cellClass}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        value={item.description || ""}
                        onChange={(event) =>
                          updateItem(index, "description", event.target.value)
                        }
                        placeholder="Grade / notes"
                        className={cellClass}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity || ""}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        className={`${cellClass} text-right`}
                      />
                    </td>
                    <td className="p-3">
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price || ""}
                        onChange={(event) =>
                          updateItem(index, "price", event.target.value)
                        }
                        className={`${cellClass} text-right`}
                      />
                    </td>
                    <td className="p-3 text-right text-[13px] font-bold">
                      {currencySymbol}
                      {money(item.quantity * item.price)}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        disabled={items.length === 1}
                        onClick={() =>
                          setItems(
                            items.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        className="text-quill hover:text-[#c0453c] disabled:opacity-30"
                        title="Remove line"
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7 pt-2">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <span className={labelClass}>Invoice status</span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "Paid",
                    "Due",
                    "Unpaid",
                    "Pending",
                    "Overdue",
                  ] as FormStatus[]
                ).map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setStatus(value)}
                    className={`px-4 py-2.5 rounded-full text-[11px] font-bold ${statusClass(value)}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Payment and invoice notes</label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={4}
                className={`${fieldClass} font-mono text-[12px] leading-relaxed`}
                placeholder="Add payment terms, delivery notes or banking details"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className={labelClass}>Payment history</span>
                <button
                  type="button"
                  onClick={addPayment}
                  className="flex items-center gap-1 text-[11px] font-bold text-brand bg-brand-pale px-3 py-2 rounded-full"
                >
                  <Plus className="w-3.5 h-3.5" /> Add payment
                </button>
              </div>
              {payments.length === 0 ? (
                <p className="text-[12px] text-quill-soft bg-mist rounded-2xl p-4">
                  No payments recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {payments.map((payment, index) => (
                    <div
                      key={index}
                      className="flex gap-2 items-end bg-mist p-3 rounded-2xl"
                    >
                      <div className="flex-1">
                        <label className="block text-[9px] font-bold text-quill-soft uppercase mb-1">
                          Amount
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={payment.amount || ""}
                          onChange={(event) =>
                            updatePayment(index, "amount", event.target.value)
                          }
                          className={cellClass}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[9px] font-bold text-quill-soft uppercase mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={payment.date}
                          onChange={(event) =>
                            updatePayment(index, "date", event.target.value)
                          }
                          className={cellClass}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removePayment(index)}
                        className="w-9 h-9 flex items-center justify-center text-quill hover:text-[#c0453c]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="bg-mist p-5 rounded-[22px] space-y-4">
            <h4 className="text-[13px] font-extrabold text-ink font-display">
              Invoice totals
            </h4>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-quill">
                Total amount
              </span>
              <span className="text-[17px] font-extrabold text-ink">
                {currencySymbol}
                {money(subtotal)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-quill">
                Total paid
              </span>
              <span className="text-[15px] font-extrabold text-[#3f9c68]">
                {currencySymbol}
                {money(amountPaid)}
              </span>
            </div>
            <div
              className={`${balance <= 0 ? "bg-[#3f9c68]" : "bg-ink"} text-white px-4 py-3.5 rounded-[16px] flex justify-between items-center`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {balance <= 0 ? "Paid in full" : "Balance due"}
              </span>
              <span className="text-[16px] font-extrabold">
                {currencySymbol}
                {money(Math.max(0, balance))}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-6 border-t border-hairline">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-3.5 rounded-full bg-mist text-ink text-[12px] font-bold"
          >
            Discard
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 bg-brand disabled:opacity-60 text-white px-6 py-3.5 rounded-full text-[12px] font-bold"
          >
            <Save className="w-4 h-4" />
            {isSaving
              ? "Saving invoice…"
              : invoice
                ? "Update invoice"
                : "Save invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
