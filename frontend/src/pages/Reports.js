import { useState, useEffect } from "react";
import { getRevenueReport, getCustomerReport, getSummaryReport } from "@/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { ChartBar, Users, TrendUp, Spinner, Warning } from "@phosphor-icons/react";

const COLORS = ["#C86B4D", "#455D4A", "#5C8A9E", "#D49842", "#9E473D", "#6C6760", "#B35A3E"];

function SummaryCards({ summary }) {
  const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
  const cards = [
    { label: "Total Fabric Sales", value: `₹${fmt(summary.total_fabric)}`, color: "var(--brand)" },
    { label: "Fabric Received", value: `₹${fmt(summary.total_fabric_received)}`, color: "var(--success)" },
    { label: "Fabric Pending", value: `₹${fmt(summary.total_fabric_pending)}`, color: "var(--warning)" },
    { label: "Tailoring Revenue", value: `₹${fmt(summary.total_tailoring)}`, color: "var(--info)" },
    { label: "Tailoring Received", value: `₹${fmt(summary.total_tailoring_received)}`, color: "var(--success)" },
    { label: "Total Advances", value: `₹${fmt(summary.total_advance)}`, color: "var(--text-secondary)" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-[var(--surface)] border border-[var(--border-subtle)] p-4 rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] mb-1">{c.label}</p>
          <p className="font-heading text-xl font-light tracking-tight" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const [tab, setTab] = useState("revenue");
  const [period, setPeriod] = useState("daily");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [revenueData, setRevenueData] = useState([]);
  const [customerData, setCustomerData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = { period };
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        const [revenueRes, summaryRes, customerRes] = await Promise.all([
          getRevenueReport(params),
          getSummaryReport(params),
          getCustomerReport()
        ]);
        setRevenueData(revenueRes.data);
        setSummary(summaryRes.data);
        setCustomerData(customerRes.data);
      } catch (err) {
        setError("Failed to load reports. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    loadReports();
  }, [period, dateFrom, dateTo]);

  const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-3 rounded-sm shadow-sm">
        <p className="text-xs font-medium mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-xs" style={{ color: p.color }}>
            {p.name}: ₹{fmt(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div data-testid="reports-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Reports & Analytics</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Revenue, customer, and business insights</p>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 border border-[var(--error)] bg-[#9E473D10] rounded-sm flex items-center gap-3 text-[var(--error)]">
          <Warning size={20} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center">
          <Spinner size={32} className="animate-spin mx-auto text-[var(--brand)] mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">Loading reports...</p>
        </div>
      )}

      {/* Summary */}
      {!loading && summary && <SummaryCards summary={summary} />}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        {[
          { key: "revenue", label: "Revenue", icon: TrendUp },
          { key: "customers", label: "Customers", icon: Users },
          { key: "breakdown", label: "Breakdown", icon: ChartBar },
        ].map(t => (
          <button
            key={t.key}
            data-testid={`report-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
              ${tab === t.key ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Revenue Tab */}
      {tab === "revenue" && (
        <div className="space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-4 rounded-sm grid grid-cols-1 sm:flex sm:flex-wrap gap-3 items-center">
            <select data-testid="report-period" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <input data-testid="report-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm" />
            <input data-testid="report-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm" />
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm">
            <h3 className="font-heading text-base font-medium mb-4">Fabric Sales Over Time</h3>
            {!loading && revenueData.length === 0 && (
              <div className="p-8 text-center text-sm text-[var(--text-secondary)]">
                No data available for selected period
              </div>
            )}
            <div style={{ width: "100%", height: 350 }}>
              <ResponsiveContainer>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBE8E1" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="fabric_total" name="Total" fill="#C86B4D" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="fabric_received" name="Received" fill="#455D4A" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm">
            <h3 className="font-heading text-base font-medium mb-4">Revenue Trend (Received)</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EBE8E1" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="fabric_received" name="Fabric" stroke="#C86B4D" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="tailoring_received" name="Tailoring" stroke="#5C8A9E" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Customers Tab */}
      {tab === "customers" && (
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm">
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <h3 className="font-heading text-base font-medium">Customer Revenue Ranking</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="customer-report-table">
              <thead>
                <tr className="bg-[var(--bg)]">
                  {["#", "Customer", "Bills", "Items", "Fabric Total", "Received", "Pending", "Tailoring"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customerData.map((c, i) => (
                  <tr key={c.name} className="border-b border-[var(--border-subtle)] hover:bg-[#C86B4D05]">
                    <td className="px-4 py-2.5 font-mono text-xs text-[var(--text-secondary)]">{i + 1}</td>
                    <td className="px-4 py-2.5 text-sm font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{c.refs_count}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{c.items_count}</td>
                    <td className="px-4 py-2.5 font-mono text-sm text-right">₹{fmt(c.total_fabric)}</td>
                    <td className="px-4 py-2.5 font-mono text-sm text-right text-[var(--success)]">₹{fmt(c.total_received)}</td>
                    <td className="px-4 py-2.5 font-mono text-sm text-right text-[var(--warning)]">₹{fmt(c.total_pending)}</td>
                    <td className="px-4 py-2.5 font-mono text-sm text-right text-[var(--info)]">₹{fmt(c.total_tailoring)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Breakdown Tab */}
      {tab === "breakdown" && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Mode Distribution */}
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm">
            <h3 className="font-heading text-base font-medium mb-4">Payment Mode Distribution</h3>
            {summary.payment_modes?.length > 0 ? (
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={summary.payment_modes}
                      dataKey="amount"
                      nameKey="mode"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ mode, percent }) => `${mode} ${(percent * 100).toFixed(0)}%`}
                    >
                      {summary.payment_modes.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={v => `₹${fmt(v)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)] text-center py-8">No payment data</p>
            )}
          </div>

          {/* Article Type Distribution */}
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm">
            <h3 className="font-heading text-base font-medium mb-4">Article Type Distribution</h3>
            {summary.article_types?.length > 0 ? (
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={summary.article_types} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#EBE8E1" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="type" type="category" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Count" fill="#5C8A9E" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)] text-center py-8">No article type data</p>
            )}
          </div>

          {/* Revenue Breakdown Table */}
          <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm">
            <h3 className="font-heading text-base font-medium mb-4">Detailed Revenue Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Fabric Total", value: summary.total_fabric, color: "var(--brand)" },
                { label: "Fabric Received", value: summary.total_fabric_received, color: "var(--success)" },
                { label: "Fabric Pending", value: summary.total_fabric_pending, color: "var(--warning)" },
                { label: "Tailoring Total", value: summary.total_tailoring, color: "var(--info)" },
                { label: "Tailoring Received", value: summary.total_tailoring_received, color: "var(--success)" },
                { label: "Tailoring Pending", value: summary.total_tailoring_pending, color: "var(--warning)" },
                { label: "Embroidery Total", value: summary.total_embroidery, color: "var(--brand)" },
                { label: "Embroidery Received", value: summary.total_embroidery_received, color: "var(--success)" },
                { label: "Add-ons Total", value: summary.total_addon, color: "var(--text-secondary)" },
                { label: "Advances Net", value: summary.total_advance, color: "var(--info)" },
                { label: "Total Items", value: summary.total_items, color: "var(--text-primary)", isCurrency: false },
                { label: "Grand Revenue", value: summary.total_fabric + summary.total_tailoring + summary.total_embroidery + summary.total_addon, color: "var(--brand)" },
              ].map(item => (
                <div key={item.label} className="p-3 bg-[var(--bg)] rounded-sm">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">{item.label}</p>
                  <p className="font-mono text-lg font-medium mt-0.5" style={{ color: item.color }}>
                    {item.isCurrency === false ? item.value : `₹${fmt(item.value)}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
