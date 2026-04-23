import { useState, useEffect, useCallback } from "react";
import { getDashboard } from "@/api";
import { CurrencyDollar, Scissors, UsersThree, TrendUp, ArrowsClockwise } from "@phosphor-icons/react";

function StatCard({ icon: Icon, label, value, sub, color = "var(--brand)" }) {
  return (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`} className="bg-[var(--surface)] border border-[var(--border-subtle)] p-4 sm:p-6 rounded-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] font-semibold text-[var(--text-secondary)] mb-1 sm:mb-2 leading-tight">{label}</p>
          <p className="font-heading text-xl sm:text-3xl font-light tracking-tight truncate" style={{ color }}>{value}</p>
          {sub && <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 sm:mt-1 truncate">{sub}</p>}
        </div>
        <div className="p-1.5 sm:p-2 rounded-sm flex-shrink-0" style={{ backgroundColor: `${color}10` }}>
          <Icon size={20} weight="duotone" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    getDashboard()
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-[var(--border-subtle)] animate-pulse rounded-sm" />
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-[var(--surface)] border border-[var(--border-subtle)] animate-pulse rounded-sm" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-48 bg-[var(--surface)] border border-[var(--border-subtle)] animate-pulse rounded-sm" />)}
        </div>
      </div>
    );
  }

  if (!data) return <p className="text-sm text-[var(--text-secondary)] p-8 text-center">Failed to load dashboard data</p>;

  const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

  return (
    <div data-testid="dashboard-page" className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Business overview at a glance</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          title="Refresh"
          className="p-2 rounded-sm border border-[var(--border-subtle)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
        >
          <ArrowsClockwise size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={TrendUp} label="Revenue Collected" value={`₹${fmt(data.total_revenue)}`} sub={`${data.total_items} transactions`} color="var(--success)" />
        <StatCard icon={CurrencyDollar} label="Fabric Pending" value={`₹${fmt(data.fabric_pending_amount)}`} sub="Outstanding payments" color="var(--warning)" />
        <StatCard icon={Scissors} label="Tailoring Pending" value={`₹${fmt(data.tailoring_pending_amount)}`} sub={`${data.tailoring_pending_count} items in queue`} color="var(--info)" />
        <StatCard icon={UsersThree} label="Customers" value={data.unique_customers} sub={`${data.total_advances} advances`} color="var(--brand)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Job Work Status */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm">
          <h3 className="font-heading text-lg font-medium tracking-tight mb-4">Job Work Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
              <span className="text-sm text-[var(--text-secondary)]">Tailoring - Pending</span>
              <span className="font-mono text-sm font-medium">{data.tailoring_pending_count}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
              <span className="text-sm text-[var(--text-secondary)]">Tailoring - Stitched</span>
              <span className="font-mono text-sm font-medium text-[var(--success)]">{data.tailoring_stitched_count}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
              <span className="text-sm text-[var(--text-secondary)]">Embroidery - Required</span>
              <span className="font-mono text-sm font-medium">{data.embroidery_required_count}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-[var(--text-secondary)]">Embroidery - In Progress</span>
              <span className="font-mono text-sm font-medium text-[var(--info)]">{data.embroidery_inprogress_count}</span>
            </div>
          </div>
        </div>

        {/* Pending Summary */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm">
          <h3 className="font-heading text-lg font-medium tracking-tight mb-4">Pending Amounts</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
              <span className="text-sm text-[var(--text-secondary)]">Fabric</span>
              <span className="font-mono text-sm font-medium text-[var(--warning)]">₹{fmt(data.fabric_pending_amount)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
              <span className="text-sm text-[var(--text-secondary)]">Tailoring</span>
              <span className="font-mono text-sm font-medium text-[var(--warning)]">₹{fmt(data.tailoring_pending_amount)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
              <span className="text-sm text-[var(--text-secondary)]">Embroidery</span>
              <span className="font-mono text-sm font-medium text-[var(--warning)]">₹{fmt(data.embroidery_pending_amount)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
              <span className="text-sm text-[var(--text-secondary)]">Advances Balance</span>
              <span className="font-mono text-sm font-medium text-[var(--success)]">₹{fmt(data.total_advances_amount)}</span>
            </div>
            <div className="flex items-center justify-between py-2 font-medium">
              <span className="text-sm">Total Pending</span>
              <span className="font-mono text-base text-[var(--error)]">
                ₹{fmt((data.fabric_pending_amount || 0) + (data.tailoring_pending_amount || 0) + (data.embroidery_pending_amount || 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm">
        <div className="px-4 py-3 sm:p-6 border-b border-[var(--border-subtle)]">
          <h3 className="font-heading text-base sm:text-lg font-medium tracking-tight">Recent Transactions</h3>
        </div>
        {(!data.recent_items || data.recent_items.length === 0) && (
          <p className="p-8 text-center text-sm text-[var(--text-secondary)]">No recent transactions found.</p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="recent-transactions-table">
            <thead>
              <tr className="bg-[var(--bg)]">
                <th className="text-left px-3 sm:px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Date</th>
                <th className="text-left px-3 sm:px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Customer</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Ref</th>
                <th className="hidden md:table-cell text-left px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Item</th>
                <th className="text-right px-3 sm:px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Amount</th>
                <th className="text-left px-3 sm:px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_items?.map((item, i) => (
                <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[#C86B4D08] transition-colors">
                  <td className="px-3 sm:px-4 py-3 font-mono text-xs sm:text-sm">{item.date}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm font-medium max-w-[100px] sm:max-w-none truncate">{item.name}</td>
                  <td className="hidden sm:table-cell px-4 py-3 font-mono text-sm text-[var(--text-secondary)]">{item.ref}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-sm">{item.barcode}</td>
                  <td className="px-3 sm:px-4 py-3 font-mono text-xs sm:text-sm text-right">₹{fmt(item.fabric_amount)}</td>
                  <td className="px-3 sm:px-4 py-3">
                    <span className={`inline-flex items-center gap-1 sm:gap-1.5 text-xs font-medium uppercase tracking-wider
                      ${item.fabric_pay_mode?.startsWith('Settled') ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.fabric_pay_mode?.startsWith('Settled') ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`} />
                      <span className="hidden xs:inline">{item.fabric_pay_mode?.startsWith('Settled') ? 'Settled' : 'Pending'}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
