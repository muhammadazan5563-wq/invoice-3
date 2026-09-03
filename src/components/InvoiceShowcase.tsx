import { useState, useRef, useCallback, useEffect } from 'react';
import { Invoice } from '../types';
import {
  Link2,
  CalendarClock,
  MoreVertical,
  LayoutList,
  Plus,
  ArrowUpRight,
  Waves,
} from 'lucide-react';

interface InvoiceShowcaseProps {
  invoices: Invoice[];
  currencySymbol: string;
  companyName: string;
  selected: Invoice | null;
  onSelect: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onMarkAsPaid: (invoice: Invoice) => Promise<void> | void;
}

type ShowcaseTab = 'all' | 'draft' | 'unpaid';

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const relativeLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'No date set';
  const diff = Math.round((d.getTime() - Date.now()) / 86400000);
  if (diff > 0) return `In ${diff} day${diff === 1 ? '' : 's'}`;
  if (diff === 0) return 'Due today';
  const past = Math.abs(diff);
  return `${past} day${past === 1 ? '' : 's'} ago`;
};

/** Returns the actual status label matching the invoice ledger */
const getStatusLabel = (invoice: Invoice): string => {
  if (invoice.status === 'Paid' || invoice.balance <= 0) return 'Settled';
  if (invoice.amountPaid > 0 && invoice.balance > 0) return 'Part paid';
  if (invoice.status === 'Overdue') return 'Overdue';
  if (invoice.status === 'Unpaid') return 'Unpaid';
  if (invoice.status === 'Due') return 'Due';
  if (invoice.status === 'Pending') return 'Pending';
  return invoice.status;
};

/** Returns color classes matching the Invoice Ledger status colors */
const getStatusColors = (invoice: Invoice): { bg: string; text: string } => {
  if (invoice.status === 'Paid' || invoice.balance <= 0) {
    return { bg: 'bg-[#e8f7ee]', text: 'text-[#2f6b48]' };
  }
  if (invoice.amountPaid > 0 && invoice.balance > 0) {
    return { bg: 'bg-[#fdf3e2]', text: 'text-[#8a5c17]' };
  }
  if (invoice.status === 'Overdue') {
    return { bg: 'bg-brand-pale', text: 'text-brand' };
  }
  if (invoice.status === 'Unpaid') {
    return { bg: 'bg-[#fdeeea]', text: 'text-[#a8492f]' };
  }
  if (invoice.status === 'Due' || invoice.status === 'Pending') {
    return { bg: 'bg-[#fdf3e2]', text: 'text-[#8a5c17]' };
  }
  return { bg: 'bg-mist', text: 'text-quill' };
};

/** Returns color classes for the dark panel (white bg variants) */
const getStatusColorsDark = (invoice: Invoice): string => {
  if (invoice.status === 'Paid' || invoice.balance <= 0) {
    return 'bg-[#e8f7ee] text-[#2f6b48]';
  }
  if (invoice.amountPaid > 0 && invoice.balance > 0) {
    return 'bg-[#fdf3e2] text-[#8a5c17]';
  }
  if (invoice.status === 'Overdue') {
    return 'bg-[#ede8fc] text-[#5a49e6]';
  }
  if (invoice.status === 'Unpaid') {
    return 'bg-[#fdeeea] text-[#a8492f]';
  }
  if (invoice.status === 'Due' || invoice.status === 'Pending') {
    return 'bg-[#fdf3e2] text-[#8a5c17]';
  }
  return 'bg-white/15 text-white/70';
};

const avatarTints = [
  'bg-[#f2c9b8] text-[#8a4a2c]',
  'bg-[#c9d4f7] text-[#33459b]',
  'bg-[#f7d9a8] text-[#8a5c17]',
  'bg-[#cfe9d8] text-[#2f6b48]',
  'bg-[#e2cdf5] text-[#5f3a92]',
];

const ITEMS_PER_PAGE = 8;

export default function InvoiceShowcase({
  invoices,
  currencySymbol,
  companyName,
  selected,
  onSelect,
  onEdit,
  onMarkAsPaid,
}: InvoiceShowcaseProps) {
  const [tab, setTab] = useState<ShowcaseTab>('all');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const draft = invoices.filter((inv) => inv.status === 'Pending');
  const unpaid = invoices.filter((inv) => inv.balance > 0);

  const listFor = (active: ShowcaseTab) => {
    if (active === 'draft') return draft;
    if (active === 'unpaid') return unpaid;
    return invoices;
  };

  const allRows = listFor(tab);
  const rows = allRows.slice(0, visibleCount);
  const hasMore = visibleCount < allRows.length;
  const detail = selected ?? rows[0] ?? null;

  // Reset visible count when tab changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [tab]);

  // Infinite scroll handler - load more when scrolled near bottom
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // Load more when within 80px of the bottom
    if (scrollHeight - scrollTop - clientHeight < 80) {
      setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, allRows.length));
    }
  }, [hasMore, allRows.length]);

  const tabs: { key: ShowcaseTab; label: string; count?: number }[] = [
    { key: 'all', label: 'All invoices' },
    { key: 'draft', label: 'Draft', count: draft.length },
    { key: 'unpaid', label: 'Unpaid', count: unpaid.length },
  ];

  const panelTitle = tab === 'draft' ? 'Draft invoices' : tab === 'unpaid' ? 'Unpaid invoices' : 'All invoices';

  return (
    <section className="bg-ink rounded-[30px] p-4 sm:p-5 relative animate-fade-in" id="invoice-showcase">
      {/* Floating tab switcher */}
      <div className="flex flex-col-reverse lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
        <h2 className="text-[15px] font-bold text-white pl-2">{panelTitle}</h2>

        <div className="flex items-center gap-2 lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:top-4 z-10">
          <div className="flex items-center gap-1 bg-shell rounded-full p-1.5 shadow-[0_16px_34px_-20px_rgba(19,17,38,0.9)]">
            {tabs.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    active ? 'bg-brand text-white' : 'text-quill hover:md:bg-mist'
                  }`}
                >
                  {t.label}
                  {typeof t.count === 'number' && (
                    <span
                      className={`nums min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        active ? 'bg-white/25 text-white' : 'bg-mist-2 text-quill'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              title="Compact layout"
              className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors duration-200 cursor-pointer"
            >
              <LayoutList className="w-4 h-4 text-white/75" />
            </button>
            <button
              type="button"
              title="More options"
              className="w-9 h-9 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors duration-200 cursor-pointer"
            >
              <MoreVertical className="w-4 h-4 text-white/75" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-4 lg:pt-8">
        {/* Left rail — invoice picker with infinite scroll */}
        <div className="flex flex-col">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="space-y-1.5 max-h-[420px] overflow-y-auto ink-scroll pr-1"
          >
            {rows.length === 0 && (
              <div className="text-center py-14 px-6">
                <p className="text-[13px] font-bold text-white/80">Nothing waiting here</p>
                <p className="text-[11px] text-white/45 mt-1.5 leading-relaxed">
                  Invoices you create will queue up in this rail so you can settle them fast.
                </p>
              </div>
            )}

            {rows.map((inv, idx) => {
              const active = detail?.id === inv.id;
              const tint = avatarTints[idx % avatarTints.length];
              const statusLabel = getStatusLabel(inv);
              const statusColors = getStatusColors(inv);
              return (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => onSelect(inv)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-[18px] text-left transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft ${
                    active ? 'bg-brand' : 'hover:md:bg-white/6'
                  }`}
                >
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold ${tint}`}>
                    {(inv.customerName || '?').charAt(0).toUpperCase()}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold text-white truncate">#{inv.id}</span>
                    <span className="block text-[10px] text-white/50 mt-0.5">{relativeLabel(inv.date)}</span>
                  </span>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                      active
                        ? `${statusColors.bg} ${statusColors.text}`
                        : `${statusColors.bg} ${statusColors.text}`
                    }`}
                  >
                    {statusLabel}
                  </span>

                  <span className="nums text-[12px] font-bold text-white shrink-0">
                    {currencySymbol}{money(inv.totalAmount)}
                  </span>
                </button>
              );
            })}

            {/* Loading indicator when scrolling */}
            {hasMore && (
              <div className="flex items-center justify-center py-3">
                <div className="flex items-center gap-2 text-[11px] text-white/40 font-medium">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  <span>Scroll for more ({allRows.length - visibleCount} remaining)</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom count indicator */}
          <div className="mt-2 px-2 flex items-center justify-between">
            <span className="nums text-[10px] font-bold text-white/40">
              {Math.min(visibleCount, allRows.length)} of {allRows.length}
            </span>
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, allRows.length))}
                className="text-[10px] font-bold text-brand-soft hover:text-white transition-colors cursor-pointer"
              >
                Load more
              </button>
            )}
          </div>
        </div>

        {/* Right panel — violet invoice detail */}
        {detail ? (
          <div className="bg-brand rounded-[24px] p-5 sm:p-6 flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">Invoice details</span>
                <div className="flex items-center gap-2.5 mt-2">
                  <span className="text-[24px] font-extrabold tracking-tight text-white font-display">#{detail.id}</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${getStatusColorsDark(detail)}`}>
                    {getStatusLabel(detail)}
                  </span>
                </div>
                <span className="block text-[11px] text-white/55 mt-1.5">Issued {detail.date || '—'}</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">Company</span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[17px] font-extrabold text-white font-display truncate">
                    {detail.hotelName || companyName}
                  </span>
                  <Waves className="w-4 h-4 text-white/70 shrink-0" />
                </div>
                <span className="block text-[11px] text-white/55 mt-1.5">Billing entity</span>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">Customer</span>
                <div className="flex items-center gap-2.5 mt-2">
                  <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-[12px] font-bold text-white shrink-0">
                    {(detail.customerName || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-white truncate">{detail.customerName}</span>
                    <span className="block text-[10px] text-white/55 truncate">
                      {detail.customerEmail || 'No email on file'}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Line item tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {detail.items.slice(0, 3).map((item, i) => (
                <div key={i} className="bg-white/12 rounded-[18px] p-4 flex flex-col justify-between min-h-[104px]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="nums text-[15px] font-extrabold text-white">
                      {currencySymbol}{money(item.total)}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-white/60 shrink-0" />
                  </div>
                  <div className="mt-3">
                    <span className="block text-[11px] font-semibold text-white/80 truncate">
                      {item.roomType || 'Line item'}
                    </span>
                    <span className="nums block text-[10px] text-white/50 mt-0.5">
                      {item.quantity} × {item.nights} night{item.nights === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => onEdit(detail)}
                className="border border-dashed border-white/35 hover:border-white/60 rounded-[18px] p-4 min-h-[104px] flex flex-col items-center justify-center gap-2 transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Plus className="w-4 h-4 text-white/80" />
                <span className="text-[11px] font-bold text-white/80">Add item</span>
              </button>
            </div>

            {/* Totals footer */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 pt-1">
              <div className="grid grid-cols-3 gap-5">
                <div>
                  <span className="block text-[10px] font-semibold text-white/55">Sub total</span>
                  <span className="nums block text-[15px] font-extrabold text-white mt-1">
                    {currencySymbol}{money(detail.totalAmount)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-white/55">Paid</span>
                  <span className="nums block text-[15px] font-extrabold text-white mt-1">
                    {currencySymbol}{money(detail.amountPaid)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-white/55">Balance due</span>
                  <span className="nums block text-[15px] font-extrabold text-white mt-1">
                    {currencySymbol}{money(detail.balance)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(detail)}
                  title="Edit invoice"
                  className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <Link2 className="w-4 h-4 text-white" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(detail)}
                  title="Schedule reminder"
                  className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <CalendarClock className="w-4 h-4 text-white" />
                </button>

                {detail.balance > 0 ? (
                  <button
                    type="button"
                    onClick={() => onMarkAsPaid(detail)}
                    className="bg-white hover:bg-mist text-ink text-[12px] font-bold px-5 py-3 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    Settle now
                  </button>
                ) : (
                  <span className="bg-[#e8f7ee] text-[#2f6b48] text-[12px] font-bold px-5 py-3 rounded-full">
                    Paid in full
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-ink-2 rounded-[24px] p-10 flex flex-col items-center justify-center text-center">
            <p className="text-[14px] font-bold text-white/85">No invoice selected</p>
            <p className="text-[11px] text-white/45 mt-2 max-w-xs leading-relaxed">
              Pick an invoice from the rail to inspect its line items, totals and outstanding balance.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
