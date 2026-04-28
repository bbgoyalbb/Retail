import { useState, useEffect, useCallback, useMemo } from "react";
import { DatePickerInput } from "@/components/DatePickerInput";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/components/ThemeProvider";
import { getRevenueReport, getCustomerReport, getSummaryReport, exportExcelUrl } from "@/api";
import { fmt } from "@/lib/fmt";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from "recharts";
import { ChartBar, Users, TrendUp, Warning, DownloadSimple } from "@phosphor-icons/react";

// CSS-variable-aware chart colours — respond to dark/light mode
const getChartColors = () => {
  const s = getComputedStyle(document.documentElement);
  return [
    s.getPropertyValue("--brand").trim()       || "#C86B4D",
    s.getPropertyValue("--success").trim()     || "#455D4A",
    s.getPropertyValue("--info").trim()        || "#5C8A9E",
    s.getPropertyValue("--warning").trim()     || "#D49842",
    s.getPropertyValue("--error").trim()       || "#9E473D",
    s.getPropertyValue("--text-secondary").trim() || "#6C6760",
    "#B35A3E",
  ];
};
function SummaryCards({ summary }) {
  const cards = [
    { label: "Fabric Total", value: `₹${fmt(summary.total_fabric)}`, color: "var(--brand)" },
    { label: "Fabric Received", value: `₹${fmt(summary.total_fabric_received)}`, color: "var(--success)" },
    { label: "Fabric Pending", value: `₹${fmt(summary.total_fabric_pending)}`, color: "var(--warning)" },
    { label: "Tailoring Total", value: `₹${fmt(summary.total_tailoring)}`, color: "var(--info)" },
    { label: "Tailoring Received", value: `₹${fmt(summary.total_tailoring_received)}`, color: "var(--success)" },
    { label: "Tailoring Pending", value: `₹${fmt(summary.total_tailoring_pending)}`, color: "var(--warning)" },
    { label: "Embroidery Total", value: `₹${fmt(summary.total_embroidery)}`, color: "var(--brand)" },
    { label: "Embroidery Received", value: `₹${fmt(summary.total_embroidery_received)}`, color: "var(--success)" },
    { label: "Add-on Total", value: `₹${fmt(summary.total_addon)}`, color: "var(--text-secondary)" },
    { label: "Add-on Received", value: `₹${fmt(summary.total_addon_received)}`, color: "var(--success)" },
    { label: "Total Advances", value: `₹${fmt(summary.total_advance)}`, color: "var(--info)" },
    { label: "Total Items", value: String(summary.total_items || 0), color: "var(--text-primary)" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-[var(--surface)] border border-[var(--border-subtle)] p-4 rounded-sm">
          <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] mb-1">{c.label}</p>
          <p className="font-heading text-xl font-light tracking-tight" style={{ color: c.color }}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

const today = new Date();
const iso = (d) => d.toISOString().split("T")[0];
const DATE_PRESETS = [
  { label: "Today",      from: iso(today),                                            to: iso(today) },
  { label: "This Week",  from: iso(new Date(today - (today.getDay()||7)*86400000+86400000)), to: iso(today) },
  { label: "This Month", from: iso(new Date(today.getFullYear(), today.getMonth(), 1)),  to: iso(today) },
  { label: "Last Month", from: iso(new Date(today.getFullYear(), today.getMonth()-1, 1)), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)) },
  { label: "This Year",  from: iso(new Date(today.getFullYear(), 0, 1)),                 to: iso(today) },
];

export default function Reports() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const COLORS = useMemo(() => getChartColors(), [theme]);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Revenue, customer, and business insights</p>
        </div>
        <a href={exportExcelUrl()} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors">
          <DownloadSimple size={16} /> Export Excel
        </a>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 border border-[var(--error)] bg-[#9E473D10] rounded-sm flex items-center gap-3 text-[var(--error)]">
          <Warning size={20} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Loading State - Skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm animate-pulse" />
            <div className="h-48 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm animate-pulse" />
          </div>
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
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-4 rounded-sm space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {DATE_PRESETS.map(p => (
                <button key={p.label} onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                  className={`px-3 py-1 text-xs font-medium rounded-sm border transition-colors ${
                    dateFrom === p.from && dateTo === p.to
                      ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]'
                  }`}>{p.label}</button>
              ))}
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="px-3 py-1 text-xs font-medium rounded-sm border border-[var(--border-subtle)] text-[var(--error)] hover:bg-[#9E473D08]">Clear</button>
              )}
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <select data-testid="report-period" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <DatePickerInput value={dateFrom} onChange={setDateFrom} placeholder="From date" />
              <DatePickerInput value={dateTo} onChange={setDateTo} placeholder="To date" />
            </div>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="fabric_total" name="Total" fill="var(--brand)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="fabric_received" name="Received" fill="var(--success)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm">
            <h3 className="font-heading text-base font-medium mb-4">Revenue Trend (Received)</h3>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="fabric_received" name="Fabric" stroke="var(--brand)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="tailoring_received" name="Tailoring" stroke="var(--info)" strokeWidth={2} dot={{ r: 3 }} />
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
                    <td className="px-4 py-2.5 text-sm font-medium">
                      <button onClick={() => navigate(`/items?name=${encodeURIComponent(c.name)}`)} className="hover:text-[var(--brand)] hover:underline text-left">{c.name}</button>
                    </td>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="type" type="category" width={90} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Count" fill="var(--info)" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)] text-center py-8">No article type data</p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
