import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid } from 'recharts';
import { Invoice } from '../types';

interface ChartsProps {
  invoices: Invoice[];
  currencyCode?: string;
  currencySymbol?: string;
}

export default function Charts({ invoices, currencyCode = 'USD', currencySymbol = '$' }: ChartsProps) {
  // Revenue Over Time grouped by Month-Year
  const monthlyDataMap: { [key: string]: { month: string; revenue: number; count: number } } = {};

  invoices.forEach((inv) => {
    if (!inv.date) return;
    const dateObj = new Date(inv.date);
    if (isNaN(dateObj.getTime())) return;
    const monthYear = dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

    if (!monthlyDataMap[monthYear]) {
      monthlyDataMap[monthYear] = { month: monthYear, revenue: 0, count: 0 };
    }
    if (inv.status !== ('Archived' as any)) {
      monthlyDataMap[monthYear].revenue += inv.totalAmount;
      monthlyDataMap[monthYear].count += 1;
    }
  });

  const monthlyData = Object.values(monthlyDataMap).sort((a, b) => {
    const dateA = new Date(a.month + ' 01');
    const dateB = new Date(b.month + ' 01');
    return dateA.getTime() - dateB.getTime();
  });

  // Status Distribution
  const statusCounts = { Paid: 0, Unpaid: 0, Pending: 0, Overdue: 0 };
  invoices.forEach((inv) => {
    if (inv.status in statusCounts) {
      statusCounts[inv.status as keyof typeof statusCounts] += inv.totalAmount;
    }
  });

  const statusData = [
    { name: 'Paid', value: statusCounts.Paid, color: '#5a49e6' },
    { name: 'Unpaid', value: statusCounts.Unpaid, color: '#e4694a' },
    { name: 'Pending', value: statusCounts.Pending, color: '#e0a63f' },
    { name: 'Overdue', value: statusCounts.Overdue, color: '#8a7bf5' },
  ].filter((item) => item.value > 0);

  // Top Customers
  const customerMap: { [key: string]: number } = {};
  invoices.forEach((inv) => {
    if (!inv.customerName) return;
    if (inv.status === ('Archived' as any)) return;
    customerMap[inv.customerName] = (customerMap[inv.customerName] || 0) + inv.totalAmount;
  });

  const customerData = Object.entries(customerMap)
    .map(([name, total]) => ({ name, revenue: Math.round(total) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(value);

  const tooltipStyle = {
    background: '#131126',
    borderRadius: '14px',
    border: 'none',
    color: '#FFF',
    boxShadow: '0 18px 40px -22px rgba(19,17,38,0.8)',
    padding: '10px 14px',
    fontSize: '12px',
    fontWeight: 600,
  } as const;

  const tooltipLabelStyle = { color: '#FFF', fontWeight: 700, marginBottom: '2px' } as const;
  const tooltipItemStyle = { color: '#FFF' } as const;

  const axisTick = { fill: '#9d99b4', fontSize: 11, fontWeight: 600 };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="invoice-charts-grid">
      {/* Revenue Trend */}
      <div className="col-span-1 lg:col-span-2" id="chart-revenue-trend">
        <h3 className="text-[12px] font-bold text-quill uppercase tracking-wider mb-4">Revenue trend</h3>
        <div className="h-56">
          {monthlyData.length === 0 ? (
            <div className="h-full flex items-center justify-center bg-mist rounded-[18px] text-[12px] font-semibold text-quill-soft">
              Revenue appears here once invoices carry dates
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5a49e6" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#5a49e6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e6e4f0" strokeDasharray="4 6" vertical={false} />
                <XAxis dataKey="month" stroke="transparent" tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="transparent"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${currencySymbol}${val}`}
                />
                <Tooltip formatter={(value: any) => [formatCurrency(value), 'Revenue']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#5a49e6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  activeDot={{ r: 5, fill: '#fff', stroke: '#5a49e6', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Status Donut */}
      <div id="chart-status-breakdown">
        <h3 className="text-[12px] font-bold text-quill uppercase tracking-wider mb-4">Status breakdown</h3>
        <div className="h-56 relative flex items-center justify-center">
          {statusData.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center bg-mist rounded-[18px] text-[12px] font-semibold text-quill-soft">
              No billing yet
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={56} outerRadius={78} paddingAngle={4} dataKey="value">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => [formatCurrency(value), 'Value']} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] text-quill-soft font-bold uppercase tracking-wider">Billed</span>
                <span className="nums text-[17px] font-extrabold text-ink font-display mt-0.5">
                  {formatCurrency(statusData.reduce((acc, curr) => acc + curr.value, 0))}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center mt-3">
          {statusData.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5 text-[11px] text-quill font-semibold">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </div>
          ))}
        </div>
      </div>

      {/* Top Customers */}
      <div className="col-span-1 lg:col-span-3" id="chart-top-customers">
        <h3 className="text-[12px] font-bold text-quill uppercase tracking-wider mb-4">Top customers</h3>
        <div className="h-48">
          {customerData.length === 0 ? (
            <div className="h-full flex items-center justify-center bg-mist rounded-[18px] text-[12px] font-semibold text-quill-soft">
              Customer ranking builds up as you invoice
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid stroke="#e6e4f0" strokeDasharray="4 6" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="transparent"
                  tick={axisTick}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${currencySymbol}${val}`}
                />
                <YAxis type="category" dataKey="name" stroke="transparent" tick={axisTick} tickLine={false} axisLine={false} width={110} />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={{ fill: 'rgba(90,73,230,0.06)' }}
                />
                <Bar dataKey="revenue" radius={[0, 10, 10, 0]} maxBarSize={26}>
                  {customerData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? '#5a49e6' : index === 1 ? '#7a6af0' : '#b4aaf8'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
