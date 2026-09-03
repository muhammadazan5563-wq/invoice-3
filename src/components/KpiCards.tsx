import { Invoice } from '../types';
import { getTodayInTimezone } from '../lib/timezone';
import { InvoiceTemplate } from '../lib/settings';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Receipt,
  PlusCircle,
  RefreshCw,
  FileWarning,
  Banknote,
} from 'lucide-react';

interface KpiCardsProps {
  invoices: Invoice[];
  currencySymbol: string;
  workspaceImage: string;
  onOpenLedger: () => void;
  template?: InvoiceTemplate | null;
  onCreateInvoice?: () => void;
  onSync?: () => void;
  loadingSync?: boolean;
}

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function KpiCards({
  invoices,
  currencySymbol,
  template,
  onCreateInvoice,
  onSync,
  loadingSync,
}: KpiCardsProps) {
  // Calculate KPIs
  let totalRevenue = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let overdueCount = 0;
  let overdueAmount = 0;

  invoices.forEach((inv) => {
    if ((inv.status as string) === 'Archived') return;
    totalRevenue += inv.totalAmount;
    totalPaid += inv.amountPaid;
    totalPending += inv.balance;
    if (inv.status === 'Overdue') {
      overdueCount += 1;
      overdueAmount += inv.balance;
    }
  });

  const collectionRate = totalRevenue > 0 ? Math.min(100, (totalPaid / totalRevenue) * 100) : 0;
  const collectionLabel =
    collectionRate >= 85 ? 'Excellent' : collectionRate >= 60 ? 'Healthy' : collectionRate >= 35 ? 'Watch' : 'At Risk';
  const collectionColor =
    collectionRate >= 85 ? '#10b981' : collectionRate >= 60 ? '#34d399' : collectionRate >= 35 ? '#f59e0b' : '#f43f5e';

  // Today collection
  const todayStr = getTodayInTimezone(template?.timezone || 'UTC');
  let todayTotal = 0;
  let todayPaidCount = 0;
  let todayPendingCount = 0;

  invoices.forEach((inv) => {
    const paymentsArray = inv.payments || [];
    if (paymentsArray.length > 0) {
      paymentsArray.forEach((p) => {
        if (p.date === todayStr) {
          todayTotal += p.amount;
        }
      });
      if (paymentsArray.some((p) => p.date === todayStr)) {
        todayPaidCount += 1;
      }
    } else {
      if (inv.paymentDate === todayStr) {
        todayTotal += inv.amountPaid;
        todayPaidCount += 1;
      }
    }
    if (inv.status === 'Pending' && inv.date === todayStr) {
      todayPendingCount += 1;
    }
  });

  // Due invoices (Pending + Due status)
  const dueInvoices = invoices.filter(
    (inv) => inv.status === 'Pending' || inv.status === 'Due'
  );
  const totalDueAmount = dueInvoices.reduce((sum, inv) => sum + inv.balance, 0);
  const duePercentOfTotal = totalRevenue > 0 ? ((totalDueAmount / totalRevenue) * 100).toFixed(1) : '0.0';

  // Outstanding amount (all unpaid balance)
  const outstandingPercentOfTotal = totalRevenue > 0 ? ((totalPending / totalRevenue) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-8 gap-5" id="kpi-cards-row">
      {/* ═══ LEFT COLUMN: Total Revenue + 2 sub-cards ═══ */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        {/* Total Revenue Card */}
        <div className="bg-shell p-6 sm:p-7 rounded-[26px] shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
          <span className="text-[10px] font-bold text-quill-soft uppercase tracking-widest">Total Revenue</span>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="nums text-[42px] sm:text-[48px] leading-none font-extrabold text-ink tracking-tight">
              {currencySymbol}{money(totalRevenue)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 mt-5">
            {onCreateInvoice && (
              <button
                type="button"
                onClick={onCreateInvoice}
                className="flex items-center gap-2 bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-5 py-3 rounded-full transition-all shadow-[0_18px_34px_-20px_rgba(90,73,230,0.95)] cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> New Invoice
              </button>
            )}
            {onSync && (
              <button
                type="button"
                onClick={onSync}
                className="flex items-center gap-2 bg-mist hover:bg-mist-2 text-ink text-[12px] font-bold px-5 py-3 rounded-full transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSync ? 'animate-spin' : ''}`} /> Sync DB
              </button>
            )}
          </div>

          {/* Mini Stats: Collected / Pending / Overdue */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-[#e8f7ee] rounded-[18px] p-3.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[#2f6b48] mb-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Collected</span>
              </div>
              <span className="nums text-[15px] font-extrabold text-[#2f6b48]">
                {currencySymbol}{money(totalPaid)}
              </span>
            </div>
            <div className="bg-[#fdf3e2] rounded-[18px] p-3.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[#8a5c17] mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Pending</span>
              </div>
              <span className="nums text-[15px] font-extrabold text-[#8a5c17]">
                {currencySymbol}{money(totalPending)}
              </span>
            </div>
            <div className="bg-[#fdeeea] rounded-[18px] p-3.5 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[#a8492f] mb-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Overdue</span>
              </div>
              <span className="nums text-[15px] font-extrabold text-[#a8492f]">{overdueCount}</span>
            </div>
          </div>
        </div>

        {/* ── Two sub-cards below Total Revenue ── */}
        <div className="grid grid-cols-2 gap-5">
          {/* Total Invoice Due Card */}
          <div className="bg-shell p-5 rounded-[26px] shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold text-quill-soft uppercase tracking-widest">Invoice Due</span>
              <div className="w-8 h-8 rounded-full bg-[#fdf3e2] flex items-center justify-center">
                <FileWarning className="w-4 h-4 text-[#d97706]" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="nums text-[26px] font-extrabold text-ink tracking-tight">
                {currencySymbol}{money(totalDueAmount)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold text-[#d97706]">
                {duePercentOfTotal}% of total billing
              </span>
              <TrendingUp className="w-3 h-3 text-[#d97706]" />
            </div>
            <p className="text-[10px] text-quill-soft mt-2 font-medium">
              {dueInvoices.length} invoice{dueInvoices.length === 1 ? '' : 's'} awaiting payment
            </p>
          </div>

          {/* Total Overdue Amount Card */}
          <div className="bg-shell p-5 rounded-[26px] shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold text-quill-soft uppercase tracking-widest">Overdue Amount</span>
              <div className="w-8 h-8 rounded-full bg-[#fdeeea] flex items-center justify-center">
                <Banknote className="w-4 h-4 text-[#dc2626]" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="nums text-[26px] font-extrabold text-ink tracking-tight">
                {currencySymbol}{money(overdueAmount)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold text-[#dc2626]">
                {outstandingPercentOfTotal}% of open billing
              </span>
              <AlertCircle className="w-3 h-3 text-[#dc2626]" />
            </div>
            <p className="text-[10px] text-quill-soft mt-2 font-medium">
              {overdueCount} overdue invoice{overdueCount === 1 ? '' : 's'} need attention
            </p>
          </div>
        </div>
      </div>

      {/* ═══ MIDDLE COLUMN: Today Collection ═══ */}
      <div className="lg:col-span-2 bg-shell p-6 sm:p-7 rounded-[26px] shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)] flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-[15px] font-extrabold text-ink">Today Collection</h3>
          <TrendingUp className="w-4 h-4 text-quill-soft" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <span className="nums text-[34px] font-extrabold text-ink">
            {currencySymbol}{money(todayTotal)}
          </span>
          <p className="text-[12px] text-quill-soft font-medium mt-2">Collected today</p>
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-quill-soft font-medium">Invoices paid today</span>
            <span className="nums font-bold text-ink">{todayPaidCount}</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
            <span className="text-quill-soft font-medium">Pending today</span>
            <span className="nums font-bold text-ink">{todayPendingCount}</span>
          </div>
        </div>
      </div>

      {/* ═══ RIGHT COLUMN: Collection Health + Summary ═══ */}
      <div className="lg:col-span-2 flex flex-col gap-5">
        {/* Collection Health Gauge */}
        <div className="bg-shell p-5 rounded-[26px] shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)] flex flex-col flex-1">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-[15px] font-extrabold text-ink">Collection Health</h3>
            <TrendingUp className="w-4 h-4 text-quill-soft" />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-2">
            <svg viewBox="0 0 200 120" className="w-full max-w-[180px]">
              <path d="M 20 110 A 80 80 0 0 1 180 110" fill="none" stroke="#e8e6f0" strokeWidth="16" strokeLinecap="round" />
              <path
                d="M 20 110 A 80 80 0 0 1 180 110"
                fill="none"
                stroke={collectionColor}
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${(collectionRate / 100) * 251.2} 251.2`}
              />
            </svg>

            <div className="text-center -mt-4">
              <span className="nums text-[28px] font-extrabold text-ink">{collectionRate.toFixed(0)}%</span>
              <p className="text-[11px] font-bold mt-0.5" style={{ color: collectionColor }}>{collectionLabel}</p>
            </div>
          </div>

          <p className="text-[10px] text-quill-soft text-center leading-relaxed mt-auto font-medium">
            Share of billed revenue collected across {invoices.length} invoice{invoices.length === 1 ? '' : 's'}.
          </p>
        </div>

        {/* Summary Card */}
        <div className="bg-shell p-5 rounded-[26px] shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)] flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[15px] font-extrabold text-ink">Summary</h3>
            <Receipt className="w-4 h-4 text-quill-soft" />
          </div>
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-quill-soft font-medium">Total Invoices</span>
              <span className="nums text-[12px] font-bold text-ink">{invoices.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-quill-soft font-medium">Paid</span>
              <span className="nums text-[12px] font-bold text-[#2f6b48]">{invoices.filter((i) => i.status === 'Paid').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-quill-soft font-medium">Pending</span>
              <span className="nums text-[12px] font-bold text-[#8a5c17]">{invoices.filter((i) => i.status === 'Pending').length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-quill-soft font-medium">Overdue</span>
              <span className="nums text-[12px] font-bold text-[#a8492f]">{overdueCount}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-hairline">
              <span className="text-[11px] text-quill-soft font-medium">Avg Invoice</span>
              <span className="nums text-[12px] font-bold text-ink">
                {currencySymbol}{invoices.length > 0 ? money(Math.round(totalRevenue / invoices.length)) : '0'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
