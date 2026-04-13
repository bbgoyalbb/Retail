import { useState, useEffect } from "react";
import { getDashboard } from "@/api";
import { Package, CurrencyDollar, Scissors, UsersThree, TrendUp, Warning } from "@phosphor-icons/react";

function StatCard({ icon: Icon, label, value, sub, color = "var(--brand)" }) {
  return (
    <div data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`} className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-[var(--text-secondary)] mb-2">{label}</p>
          <p className="font-heading text-3xl font-light tracking-tight" style={{ color }}>{value}</p>
          {sub && <p className="text-sm text-[var(--text-secondary)] mt-1">{sub}</p>}
        </div>
        <div className="p-2 rounded-sm" style={{ backgroundColor: `${color}10` }}>
          <Icon size={24} weight="duotone" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-[var(--border-subtle)] animate-pulse rounded-sm" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white border border-[var(--border-subtle)] animate-pulse rounded-sm" />)}
        </div>
      </div>
    );
  }

  if (!data) return <p>Failed to load dashboard</p>;

  const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

  return (
    <div data-testid="dashboard-page" className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Business overview at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard icon={TrendUp} label="Revenue Collected" value={`₹${fmt(data.total_revenue)}`} sub={`${data.total_items} transactions`} color="var(--success)" />
        <StatCard icon={CurrencyDollar} label="Fabric Pending" value={`₹${fmt(data.fabric_pending_amount)}`} sub="Outstanding payments" color="var(--warning)" />
        <StatCard icon={Scissors} label="Tailoring Pending" value={`₹${fmt(data.tailoring_pending_amount)}`} sub={`${data.tailoring_pending_count} items in queue`} color="var(--info)" />
        <StatCard icon={UsersThree} label="Customers" value={data.unique_customers} sub={`${data.total_advances} advances`} color="var(--brand)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Work Status */}
        <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm">
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
        <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm">
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
      <div className="bg-white border border-[var(--border-subtle)] rounded-sm">
        <div className="p-6 border-b border-[var(--border-subtle)]">
          <h3 className="font-heading text-lg font-medium tracking-tight">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="recent-transactions-table">
            <thead>
              <tr className="bg-[var(--bg)]">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Date</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Customer</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Ref</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Item</th>
                <th className="text-right px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Amount</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_items?.map((item, i) => (
                <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[#C86B4D08] transition-colors">
                  <td className="px-4 py-3 font-mono text-sm">{item.date}</td>
                  <td className="px-4 py-3 text-sm font-medium">{item.name}</td>
                  <td className="px-4 py-3 font-mono text-sm text-[var(--text-secondary)]">{item.ref}</td>
                  <td className="px-4 py-3 text-sm">{item.barcode}</td>
                  <td className="px-4 py-3 font-mono text-sm text-right">₹{fmt(item.fabric_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider
                      ${item.fabric_pay_mode?.startsWith('Settled') ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.fabric_pay_mode?.startsWith('Settled') ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`} />
                      {item.fabric_pay_mode?.startsWith('Settled') ? 'Settled' : 'Pending'}
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
