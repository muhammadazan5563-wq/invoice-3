import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  Copy,
  FileImage,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import {
  Contact,
  ContactDraft,
  ContactFiles,
  ContactType,
  createContact,
  generatePassword,
  getContacts,
  updateContact,
  invalidateContactsCache,
} from '../lib/contacts';

const fieldClass =
  'w-full bg-mist focus:bg-mist-2 rounded-2xl px-4 py-3 text-[13px] font-semibold text-ink placeholder:text-quill-soft placeholder:font-medium outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-55';

const labelClass = 'block text-[10px] font-bold text-quill-soft uppercase tracking-wider mb-2';

const emptyDraft: ContactDraft = {
  type: 'customer',
  fullName: '',
  phone: '',
  email: '',
  password: '',
  companyName: '',
  location: '',
  address: '',
  area: '',
};

interface FileFieldProps {
  id: string;
  label: string;
  file: File | null;
  disabled: boolean;
  onPick: (file: File | null) => void;
}

function FileField({ id, label, file, disabled, onPick }: FileFieldProps) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <label
        htmlFor={id}
        className={`flex items-center gap-2.5 bg-mist hover:bg-mist-2 rounded-2xl px-4 py-3 cursor-pointer transition-colors duration-200 ${
          disabled ? 'opacity-55 pointer-events-none' : ''
        }`}
      >
        <FileImage className="w-4 h-4 text-brand shrink-0" />
        <span className="text-[12px] font-semibold text-ink truncate">
          {file ? file.name : 'Choose an image'}
        </span>
        <input
          id={id}
          type="file"
          accept="image/*"
          disabled={disabled}
          className="hidden"
          onChange={(event) => onPick(event.target.files?.[0] || null)}
        />
      </label>
    </div>
  );
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft);
  const [files, setFiles] = useState<{ cnicFront: File | null; cnicBack: File | null; cheque: File | null }>({
    cnicFront: null,
    cnicBack: null,
    cheque: null,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ContactType>('all');
  const [visibleCount, setVisibleCount] = useState(50);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    setListError('');
    try {
      setContacts(await getContacts());
    } catch (err: any) {
      setListError(
        err?.message ||
          'Could not load contacts. Make sure Firestore is enabled for this Firebase project.'
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDraft(emptyDraft);
    setFiles({ cnicFront: null, cnicBack: null, cheque: null });
    setFormError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');

    if (!draft.fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!draft.email.trim()) {
      setFormError('An email address is required — it becomes their login.');
      return;
    }

    setSaving(true);
    try {
      const payload: ContactFiles =
        draft.type === 'customer'
          ? { cnicFront: files.cnicFront, cnicBack: files.cnicBack, cheque: files.cheque }
          : {};

      if (editingContact) {
        const updated = await updateContact(editingContact, draft, payload);
        invalidateContactsCache();
        setContacts((previous) => previous.map((contact) => contact.id === updated.id ? updated : contact));
      } else {
        const result = await createContact(draft, payload);
        invalidateContactsCache();
        setCreated({
          name: result.contact.fullName,
          email: result.contact.email,
          password: result.password,
        });
        setContacts((previous) => [result.contact, ...previous]);
      }
      resetForm();
      setEditingContact(null);
      setShowForm(false);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create the contact.');
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = () => {
    if (!created) return;
    navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const visibleContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (typeFilter !== 'all' && contact.type !== typeFilter) return false;
      if (!term) return true;
      return (
        contact.fullName.toLowerCase().includes(term) ||
        contact.email.toLowerCase().includes(term) ||
        contact.phone.toLowerCase().includes(term) ||
        contact.companyName.toLowerCase().includes(term)
      );
    });
  }, [contacts, search, typeFilter]);

  const renderedContacts = visibleContacts.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(50);
  }, [search, typeFilter]);

  const vendorCount = contacts.filter((contact) => contact.type === 'vendor').length;
  const customerCount = contacts.length - vendorCount;
  const isVendor = draft.type === 'vendor';

  return (
    <div className="space-y-6" id="contacts-page">
      {/* Credentials handoff */}
      {created && (
        <div className="bg-mist rounded-[26px] p-6 flex flex-wrap items-start justify-between gap-4 animate-fade-in">
          <div>
            <h3 className="text-[15px] font-extrabold text-ink font-display">
              {created.name} can now sign in
            </h3>
            <p className="text-[12px] text-quill font-medium mt-1.5 leading-relaxed">
              Share these details with them. The password is stored on the contact record if you need it later.
            </p>
            <div className="nums mt-3 bg-shell rounded-2xl px-4 py-3 text-[12px] font-semibold text-ink space-y-1">
              <div>{created.email}</div>
              <div className="font-mono text-brand">{created.password}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyCredentials}
              className="flex items-center gap-2 bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-4 py-2.5 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => setCreated(null)}
              title="Dismiss"
              className="w-9 h-9 rounded-full bg-shell hover:bg-mist-2 flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <X className="w-4 h-4 text-quill" />
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1 bg-ink rounded-full p-1.5">
          {([
            { key: 'all' as const, label: `All ${contacts.length}` },
            { key: 'vendor' as const, label: `Vendors ${vendorCount}` },
            { key: 'customer' as const, label: `Customers ${customerCount}` },
          ]).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setTypeFilter(tab.key)}
              className={`px-4 py-2.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft ${
                typeFilter === tab.key ? 'bg-brand text-white' : 'text-white/60 hover:md:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, phone or company"
            aria-label="Search contacts"
            className="w-full bg-mist hover:bg-mist-2 focus:bg-mist-2 text-[12px] font-semibold text-ink placeholder:text-quill-soft placeholder:font-medium pl-4 pr-11 py-3 rounded-full outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
          <Search className="w-4 h-4 text-quill absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setEditingContact(null);
            setShowForm((previous) => !previous);
          }}
          className="flex items-center gap-2 bg-brand hover:bg-brand-mid text-white text-[13px] font-bold pl-5 pr-6 py-3.5 rounded-full transition-colors duration-200 cursor-pointer shadow-[0_18px_34px_-20px_rgba(90,73,230,0.95)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Plus className="w-4 h-4" /> Create contact
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-mist rounded-[26px] p-6 sm:p-7 space-y-6 animate-fade-in"
          id="create-contact-form"
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
                  <h3 className="text-[17px] font-extrabold text-ink font-display tracking-tight">
                {editingContact ? 'Edit contact' : 'New contact'}
              </h3>
              <p className="text-[12px] text-quill-soft font-medium mt-1">
                Saving also creates their login account. You stay signed in as administrator.
              </p>
            </div>
            <div className="min-w-[190px]">
              <label className={labelClass} htmlFor="contact-type">
                Contact type
              </label>
              <select
                id="contact-type"
                value={draft.type}
                disabled={saving}
                onChange={(event) =>
                  setDraft({ ...draft, type: event.target.value as ContactType })
                }
                className={`${fieldClass} cursor-pointer`}
              >
                <option value="vendor">Vendor</option>
                <option value="customer">Customer</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass} htmlFor="contact-name">
                Full name
              </label>
              <input
                id="contact-name"
                type="text"
                value={draft.fullName}
                disabled={saving}
                onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
                placeholder="Muhammad Hamza"
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="contact-phone">
                Phone number
              </label>
              <input
                id="contact-phone"
                type="tel"
                value={draft.phone}
                disabled={saving}
                onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                placeholder="0300 1234567"
                className={fieldClass}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="contact-email">
                Email address
              </label>
              <input
                id="contact-email"
                type="email"
                value={draft.email}
                disabled={saving}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                placeholder="hamza@example.com"
                className={fieldClass}
              />
            </div>

            {isVendor ? (
              <>
                <div>
                  <label className={labelClass} htmlFor="contact-password">
                    Password
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="contact-password"
                      type="text"
                      value={draft.password}
                      disabled={saving}
                      onChange={(event) => setDraft({ ...draft, password: event.target.value })}
                      placeholder="At least 6 characters"
                      className={fieldClass}
                    />
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setDraft({ ...draft, password: generatePassword() })}
                      className="shrink-0 bg-shell hover:bg-mist-2 disabled:opacity-55 text-ink text-[11px] font-bold px-4 rounded-2xl transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      Generate
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelClass} htmlFor="contact-company">
                    Company name
                  </label>
                  <input
                    id="contact-company"
                    type="text"
                    value={draft.companyName}
                    disabled={saving}
                    onChange={(event) => setDraft({ ...draft, companyName: event.target.value })}
                    placeholder="Hamza Fisheries"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="contact-location">
                    Location
                  </label>
                  <input
                    id="contact-location"
                    type="text"
                    value={draft.location}
                    disabled={saving}
                    onChange={(event) => setDraft({ ...draft, location: event.target.value })}
                    placeholder="Karachi Fish Harbour"
                    className={fieldClass}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelClass} htmlFor="contact-password-customer">Password</label>
                  <div className="flex gap-2">
                    <input id="contact-password-customer" type="text" value={draft.password} disabled={saving} onChange={(event) => setDraft({ ...draft, password: event.target.value })} placeholder="At least 6 characters" className={fieldClass} />
                    <button type="button" disabled={saving} onClick={() => setDraft({ ...draft, password: generatePassword() })} className="shrink-0 bg-shell hover:bg-mist-2 disabled:opacity-55 text-ink text-[11px] font-bold px-4 rounded-2xl transition-colors duration-200 cursor-pointer">Generate</button>
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="contact-address">
                    Address
                  </label>
                  <input
                    id="contact-address"
                    type="text"
                    value={draft.address}
                    disabled={saving}
                    onChange={(event) => setDraft({ ...draft, address: event.target.value })}
                    placeholder="House 12, Street 4"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="contact-area">
                    Area
                  </label>
                  <input
                    id="contact-area"
                    type="text"
                    value={draft.area}
                    disabled={saving}
                    onChange={(event) => setDraft({ ...draft, area: event.target.value })}
                    placeholder="Gulshan-e-Iqbal"
                    className={fieldClass}
                  />
                </div>
              </>
            )}
          </div>

          {!isVendor && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FileField
                id="contact-cnic-front"
                label="CNIC front"
                file={files.cnicFront}
                disabled={saving}
                onPick={(file) => setFiles({ ...files, cnicFront: file })}
              />
              <FileField
                id="contact-cnic-back"
                label="CNIC back"
                file={files.cnicBack}
                disabled={saving}
                onPick={(file) => setFiles({ ...files, cnicBack: file })}
              />
              <FileField
                id="contact-cheque"
                label="Cheque"
                file={files.cheque}
                disabled={saving}
                onPick={(file) => setFiles({ ...files, cheque: file })}
              />
            </div>
          )}

          {!isVendor && (
            <p className="text-[11px] text-quill-soft font-medium">
              A password is generated automatically for customers and shown once the contact is saved.
            </p>
          )}

          {formError && (
            <div className="flex gap-2.5 items-start bg-[#fdf0ec] text-[#a8492f] px-4 py-3 rounded-2xl">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-[12px] font-semibold leading-relaxed">{formError}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2.5 justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setShowForm(false);
                resetForm();
                setEditingContact(null);
              }}
              className="px-5 py-3 bg-shell hover:bg-mist-2 disabled:opacity-55 text-ink rounded-full text-[12px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-brand hover:bg-brand-mid disabled:opacity-60 disabled:pointer-events-none text-white rounded-full text-[12px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {saving ? (editingContact ? 'Saving changes…' : 'Creating account…') : editingContact ? 'Save changes' : `Save ${isVendor ? 'vendor' : 'customer'}`}
            </button>
          </div>
        </form>
      )}

      {/* Contact list */}
      <section className="bg-shell rounded-[26px] p-6 sm:p-7 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
        <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
          <div>
            <h2 className="text-[19px] font-extrabold text-ink font-display tracking-tight">
              Contact list
            </h2>
            <p className="text-[12px] text-quill-soft font-medium mt-1">
              Every vendor and customer who can sign in to their own panel.
            </p>
          </div>
          <span className="nums text-[11px] font-bold text-quill bg-mist px-3.5 py-2 rounded-full">
            {Math.min(visibleCount, visibleContacts.length)} of {visibleContacts.length} shown
          </span>
        </div>

        {listError && (
          <div className="flex gap-2.5 items-start bg-[#fdf0ec] text-[#a8492f] px-5 py-4 rounded-[22px] mb-5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-bold">We couldn't load your contacts</p>
              <p className="text-[12px] font-medium text-[#b5654c] mt-1 leading-relaxed">{listError}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-14 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[3px] border-hairline border-t-brand rounded-full animate-spin" />
            <p className="text-[12px] font-bold text-quill">Loading contacts…</p>
          </div>
        ) : visibleContacts.length === 0 ? (
          <div className="py-14 text-center">
            <span className="w-14 h-14 rounded-2xl bg-mist flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-brand" />
            </span>
            <h3 className="text-[16px] font-extrabold text-ink font-display">
              {contacts.length === 0 ? 'No contacts yet' : 'Nothing matches that search'}
            </h3>
            <p className="text-[12px] text-quill font-medium mt-2 max-w-sm mx-auto leading-relaxed">
              {contacts.length === 0
                ? 'Create a vendor or customer contact and they will be able to sign in and see their own invoices.'
                : 'Try a different name, email or phone number.'}
            </p>
            {contacts.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="mt-5 inline-flex items-center gap-2 bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-5 py-3 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Plus className="w-3.5 h-3.5" /> Create the first contact
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {renderedContacts.map((contact) => (
              <article key={contact.id} className="bg-mist rounded-[22px] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-extrabold text-ink font-display truncate">
                      {contact.fullName}
                    </h3>
                    <p className="flex items-center gap-1.5 text-[11px] text-quill font-semibold mt-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-brand shrink-0" />
                      {contact.email}
                    </p>
                    {contact.tempPassword && (
                      <p className="flex items-center gap-1.5 text-[11px] text-quill font-semibold mt-1.5 truncate">
                        <KeyRound className="w-3.5 h-3.5 text-brand shrink-0" />
                        <span className="font-mono text-brand">{contact.tempPassword}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingContact(contact);
                        setDraft({
                          type: contact.type,
                          fullName: contact.fullName,
                          phone: contact.phone,
                          email: contact.email,
                          password: '',
                          companyName: contact.companyName,
                          location: contact.location,
                          address: contact.address,
                          area: contact.area,
                        });
                        setFiles({ cnicFront: null, cnicBack: null, cheque: null });
                        setFormError('');
                        setShowForm(true);
                      }}
                      className="bg-shell hover:bg-mist-2 text-ink text-[10px] font-bold px-3 py-1.5 rounded-full cursor-pointer"
                    >
                      Edit
                    </button>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${contact.type === 'vendor' ? 'bg-brand text-white' : 'bg-ink text-white'}`}>
                      {contact.type}
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-[11px] text-quill font-semibold">
                  {contact.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-quill-soft shrink-0" />
                      {contact.phone}
                    </p>
                  )}
                  {contact.companyName && (
                    <p className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-quill-soft shrink-0" />
                      {contact.companyName}
                    </p>
                  )}
                  {(contact.location || contact.address || contact.area) && (
                    <p className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-quill-soft shrink-0 mt-0.5" />
                      <span>
                        {[contact.location, contact.address, contact.area].filter(Boolean).join(' · ')}
                      </span>
                    </p>
                  )}
                </div>

                {(contact.cnicFrontUrl || contact.cnicBackUrl || contact.chequeUrl) && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {[
                      { label: 'CNIC front', url: contact.cnicFrontUrl },
                      { label: 'CNIC back', url: contact.cnicBackUrl },
                      { label: 'Cheque', url: contact.chequeUrl },
                    ]
                      .filter((document) => document.url)
                      .map((document) => (
                        <a
                          key={document.label}
                          href={document.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 bg-shell hover:bg-mist-2 text-ink text-[10px] font-bold px-3 py-2 rounded-full no-underline transition-colors duration-200"
                        >
                          <FileImage className="w-3 h-3 text-brand" />
                          {document.label}
                        </a>
                      ))}
                  </div>
                )}
              </article>
            ))}
            {visibleContacts.length > visibleCount && (
              <div className="col-span-full flex justify-center mt-2">
                <button type="button" onClick={() => setVisibleCount((previous) => previous + 50)} className="inline-flex items-center gap-2 bg-brand hover:bg-brand-mid text-white text-[11px] font-bold px-5 py-2.5 rounded-full cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Load 50 more
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
