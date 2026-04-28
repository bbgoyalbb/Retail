import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboard } from "@/api";
import { fmt } from "@/lib/fmt";
import { dataEvents } from "@/lib/dataEvents";
import { CurrencyDollar, Scissors, UsersThree, TrendUp, ArrowsClockwise, Receipt, Warning, CalendarCheck, ChartBar, BookOpen, ArrowRight } from "@phosphor-icons/react";
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
  const navigate = useNavigate();
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
    const handler = () => fetchData(true);
    dataEvents.addEventListener("dashboard", handler);
    return () => { clearInterval(interval); dataEvents.removeEventListener("dashboard", handler); };
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


  const totalPending = (data.fabric_pending_amount || 0) + (data.tailoring_pending_amount || 0) + (data.embroidery_pending_amount || 0) + (data.addon_pending_amount || 0);

  return (
    <div data-testid="dashboard-page" className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Business overview at a glance</p>
        </div>
        <button onClick={() => fetchData(true)} disabled={refreshing} title="Refresh"
          className="p-2 rounded-sm border border-[var(--border-subtle)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
          <ArrowsClockwise size={16} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {data.total_items === 0 && (
        <EmptyState title="Welcome to your Dashboard" description="Get started by creating your first bill. Your business overview will appear here."
          action="Create First Bill" onAction={() => navigate('/new-bill')} />
      )}

      {/* Today's Summary Banner */}
      {data.total_items > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm px-5 py-3.5 flex flex-wrap items-center gap-x-8 gap-y-2">
          <div className="flex items-center gap-2">
            <CalendarCheck size={16} className="text-[var(--brand)]" weight="duotone" />
            <span className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-secondary)]">Bills</span>
            <span className="font-heading text-lg font-semibold text-[var(--text-primary)]">{data.today_bills_count ?? 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-secondary)]">Collected</span>
            <span className="font-heading text-lg font-semibold text-[var(--success)]">₹{fmt(data.today_collected ?? 0)}</span>
          </div>
          <button onClick={() => navigate('/new-bill')}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-colors font-medium">
            <Receipt size={13} weight="bold" /> New Bill
          </button>
        </div>
      )}

      {/* Overdue Alert */}
      {(data.overdue_orders_count ?? 0) > 0 && (
        <div className="flex items-center gap-3 px-5 py-3 bg-[#9E473D10] border border-[var(--error)] rounded-sm">
          <Warning size={18} className="text-[var(--error)] flex-shrink-0" weight="fill" />
          <span className="text-sm text-[var(--error)] font-medium">
            {data.overdue_orders_count} article{data.overdue_orders_count !== 1 ? 's' : ''} overdue for delivery — delivery date has passed but tailoring is not complete.
          </span>
          <button onClick={() => navigate('/order-status')}
            className="ml-auto text-xs font-medium text-[var(--error)] underline underline-offset-2 hover:opacity-80 whitespace-nowrap">
            View →
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendUp} label="Revenue Collected" value={`₹${fmt(data.total_revenue)}`}
          sub={`${data.total_items} transactions`} color="var(--success)" trend={data.revenue_trend} />
        <StatCard icon={Warning} label="Total Outstanding" value={`₹${fmt(totalPending)}`}
          sub="All pending payments" color="var(--error)" />
        <StatCard icon={Scissors} label="Tailoring Queue" value={data.tailoring_pending_count}
          sub={`${data.tailoring_stitched_count} stitched, ready to deliver`} color="var(--info)" />
        <StatCard icon={UsersThree} label="Customers" value={data.unique_customers}
          sub={`₹${fmt(data.total_advances_amount)} in advances`} color="var(--brand)" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "New Bill", icon: Receipt, path: "/new-bill", color: "var(--brand)" },
          { label: "Manage Orders", icon: CurrencyDollar, path: "/items", color: "var(--success)" },
          { label: "Reports", icon: ChartBar, path: "/reports", color: "var(--info)" },
          { label: "Daybook", icon: BookOpen, path: "/daybook", color: "var(--warning)" },
        ].map(({ label, icon: Icon, path, color }) => (
          <button key={path} onClick={() => navigate(path)}
            className="flex items-center gap-3 px-4 py-3 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] hover:bg-[#C86B4D06] transition-all group text-left">
            <div className="p-2 rounded-sm flex-shrink-0" style={{ background: `${color}15` }}>
              <Icon size={16} weight="duotone" style={{ color }} />
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">{label}</span>
            <ArrowRight size={13} className="ml-auto text-[var(--border-strong)] group-hover:text-[var(--brand)] transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Job Work Status */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-5 rounded-sm">
          <h3 className="font-heading text-base font-medium tracking-tight mb-4">Job Work Status</h3>
          <div className="space-y-0">
            {[
              { label: "Tailoring — Pending", value: data.tailoring_pending_count, color: "var(--warning)" },
              { label: "Tailoring — Stitched", value: data.tailoring_stitched_count, color: "var(--success)" },
              { label: "Embroidery — Required", value: data.embroidery_required_count, color: "var(--info)" },
              { label: "Embroidery — In Progress", value: data.embroidery_inprogress_count, color: "var(--brand)" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-0">
                <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                <span className="font-mono text-sm font-semibold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Breakdown */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-5 rounded-sm">
          <h3 className="font-heading text-base font-medium tracking-tight mb-4">Pending Breakdown</h3>
          <div className="space-y-0">
            {[
              { label: "Fabric", value: data.fabric_pending_amount },
              { label: "Tailoring", value: data.tailoring_pending_amount },
              { label: "Embroidery", value: data.embroidery_pending_amount },
              { label: "Add-on", value: data.addon_pending_amount },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-[var(--border-subtle)] last:border-0">
                <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                <span className="font-mono text-sm font-medium text-[var(--warning)]">₹{fmt(value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-[var(--text-secondary)]">Advances Balance</span>
              <span className="font-mono text-sm font-medium text-[var(--success)]">₹{fmt(data.total_advances_amount)}</span>
            </div>
            <div className="flex items-center justify-between pt-3 font-semibold">
              <span className="text-sm">Total Outstanding</span>
              <span className="font-mono text-base text-[var(--error)]">₹{fmt(totalPending)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm">
        <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="font-heading text-base font-medium tracking-tight">Recent Transactions</h3>
          <button onClick={() => navigate('/items')} className="flex items-center gap-1 text-xs text-[var(--brand)] hover:underline">
            View all <ArrowRight size={12} />
          </button>
        </div>
        {(!data.recent_items || data.recent_items.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <Receipt size={28} className="text-[var(--border-strong)]" weight="duotone" />
            <p className="text-sm text-[var(--text-secondary)]">No recent transactions found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="recent-transactions-table">
              <thead>
                <tr className="bg-[var(--bg)]">
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Date</th>
                  <th className="text-left px-4 py-3 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Customer</th>
                  <th className="hidden sm:table-cell text-left px-4 py-3 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Ref</th>
                  <th className="hidden md:table-cell text-center px-4 py-3 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Items</th>
                  <th className="text-right px-4 py-3 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_items.map((item, i) => (
                  <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[#C86B4D06] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{item.date}</td>
                    <td className="px-4 py-3 text-sm font-medium truncate max-w-[140px]">{item.name}</td>
                    <td className="hidden sm:table-cell px-4 py-3 font-mono text-xs text-[var(--brand)]">{item.ref}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-xs text-center text-[var(--text-secondary)]">{item.item_count}</td>
                    <td className="px-4 py-3 font-mono text-sm text-right font-medium">₹{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
