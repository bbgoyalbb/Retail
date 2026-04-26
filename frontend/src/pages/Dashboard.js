import { useState, useEffect, useCallback } from "react";
import { getDashboard } from "@/api";
import { fmt } from "@/lib/fmt";
import { useToast } from "@/hooks/use-toast";
import { CurrencyDollar, Scissors, UsersThree, TrendUp, ArrowsClockwise, Receipt } from "@phosphor-icons/react";
import { EmptyState } from "@/components/EmptyState";

function Sparkline({ data, color = "var(--success)", width = 60, height = 24 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "var(--brand)", trend }) {
  return (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}
      className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm overflow-hidden relative"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-semibold text-[var(--text-secondary)] mb-2 leading-tight">{label}</p>
            <p className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight truncate" style={{ color }}>{value}</p>
            {sub && <p className="text-xs text-[var(--text-secondary)] mt-1.5 truncate">{sub}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="p-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
              <Icon size={22} weight="duotone" style={{ color }} />
            </div>
            {trend && <Sparkline data={trend} color={color} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const fetchData = useCallback((silent = false) => {
    if (!silent) { setLoading(true); setFetchError(false); }
    else setRefreshing(true);
    getDashboard()
      .then(res => { setData(res.data); setFetchError(false); })
      .catch(() => { if (!silent) setFetchError(true); })
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

  if (fetchError || !data) return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <p className="text-sm text-[var(--text-secondary)]">Failed to load dashboard data.</p>
      <button
        onClick={() => fetchData()}
        className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-colors"
      >
        Retry
      </button>
    </div>
  );


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

      {data.total_items === 0 && (
        <EmptyState
          title="Welcome to your Dashboard"
          description="Get started by creating your first bill. Your business overview will appear here."
          action="Create First Bill"
          onAction={() => window.location.href = '/new-bill'}
        />
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard 
          icon={TrendUp} 
          label="Revenue Collected" 
          value={`₹${fmt(data.total_revenue)}`} 
          sub={`${data.total_items} transactions`} 
          color="var(--success)" 
          trend={data.revenue_trend || [45000, 52000, 48000, 61000, 58000, 72000, data.total_revenue / 7]} 
        />
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
              <span className="text-sm text-[var(--text-secondary)]">Add-on</span>
              <span className="font-mono text-sm font-medium text-[var(--warning)]">₹{fmt(data.addon_pending_amount)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
              <span className="text-sm text-[var(--text-secondary)]">Advances Balance</span>
              <span className="font-mono text-sm font-medium text-[var(--success)]">₹{fmt(data.total_advances_amount)}</span>
            </div>
            <div className="flex items-center justify-between py-2 font-medium">
              <span className="text-sm">Total Pending</span>
              <span className="font-mono text-base text-[var(--error)]">
                ₹{fmt((data.fabric_pending_amount || 0) + (data.tailoring_pending_amount || 0) + (data.embroidery_pending_amount || 0) + (data.addon_pending_amount || 0))}
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
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="p-4 rounded-sm" style={{ background: "var(--bg)" }}>
              <Receipt size={28} className="text-[var(--border-strong)]" weight="duotone" />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">No recent transactions found.</p>
          </div>
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
