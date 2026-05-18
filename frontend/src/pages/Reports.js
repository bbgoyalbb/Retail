import { useState, useEffect, useMemo, useRef } from "react";
import { DatePickerInput } from "@/components/DatePickerInput";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/components/ThemeProvider";
import { getRevenueReport, getCustomerReport, getSummaryReport, exportExcelUrl } from "@/api";
import { fmt } from "@/lib/fmt";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { ChartBar, Users, TrendUp, Warning, DownloadSimple, Printer, CaretDown, Calendar, ArrowsClockwise, CurrencyDollar, Package } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// CSS-variable-aware chart colours — respond to dark/light mode
const getChartColors = (_theme) => {
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

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border p-3 rounded-xl shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-xs font-bold text-foreground">{p.name}</span>
            </div>
            <span className="font-mono text-xs font-black">₹{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

function SummaryCards({ summary }) {
  const cards = [
    { label: "Fabric Revenue", value: `₹${fmt(summary.total_fabric)}`, icon: TrendUp, color: "text-primary", bg: "bg-primary/10" },
    { label: "Fabric Received", value: `₹${fmt(summary.total_fabric_received)}`, icon: TrendUp, color: "text-success", bg: "bg-success/10" },
    { label: "Tailoring Volume", value: `₹${fmt(summary.total_tailoring)}`, icon: ChartBar, color: "text-info", bg: "bg-info/10" },
    { label: "Total Pending", value: `₹${fmt(summary.total_fabric_pending + summary.total_tailoring_pending)}`, icon: Warning, color: "text-warning", bg: "bg-warning/10" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <Card key={c.label} className="border-none shadow-lg shadow-black/5 overflow-hidden group">
          <CardContent className="p-5 relative">
            <div className={cn("absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity", c.color)}>
              <c.icon size={64} weight="duotone" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground opacity-60 mb-2">{c.label}</p>
            <p className={cn("font-heading text-2xl font-black tracking-tighter", c.color)}>{c.value}</p>
          </CardContent>
        </Card>
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
  const { toast } = useToast();
  const chartRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);
  const COLORS = useMemo(() => getChartColors(theme), [theme]);
  const [tab, setTab] = useState("revenue");
  const [period, setPeriod] = useState("daily");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [revenueData, setRevenueData] = useState([]);
  const [customerData, setCustomerData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!chartRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (width) setChartWidth(width);
    });
    ro.observe(chartRef.current);
    return () => ro.disconnect();
  }, []);

  const getTickInterval = (dataLength) => {
    if (chartWidth < 480) return Math.max(1, Math.floor(dataLength / 4));
    if (chartWidth < 640) return Math.max(1, Math.floor(dataLength / 6));
    return 0;
  };

  const fetchedTabs = useRef(new Set());
  const lastParams = useRef("");

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = { period };
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        const paramsKey = JSON.stringify({ ...params, refreshKey });
        if (paramsKey !== lastParams.current) {
          fetchedTabs.current = new Set();
          lastParams.current = paramsKey;
        }
        const fetches = [getSummaryReport(params)];
        const needRevenue  = tab === "revenue"   || !fetchedTabs.current.has("revenue");
        const needCustomer = tab === "customers" || !fetchedTabs.current.has("customers");
        if (needRevenue)  fetches.push(getRevenueReport(params));
        if (needCustomer) fetches.push(getCustomerReport(params));
        const results = await Promise.all(fetches);
        let idx = 0;
        setSummary(results[idx++].data);
        if (needRevenue)  { setRevenueData(results[idx++].data);  fetchedTabs.current.add("revenue"); }
        if (needCustomer) { setCustomerData(results[idx++].data); fetchedTabs.current.add("customers"); }
        fetchedTabs.current.add("breakdown");
      } catch (err) {
        setError("Failed to load reports. Please try again.");
        toast({ title: "Error", description: "Failed to load reports", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadReports();
  }, [period, dateFrom, dateTo, tab, toast, refreshKey]);

  return (
    <div data-testid="reports-page" className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary">Reports & Analytics</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium">Business performance, revenue trends, and customer insights</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2">
            <Printer size={16} /> Print
          </Button>
          <Button variant="outline" size="sm" asChild className="rounded-xl font-bold uppercase tracking-widest text-[10px] gap-2">
            <a href={exportExcelUrl()} target="_blank" rel="noreferrer">
              <DownloadSimple size={16} /> Export Excel
            </a>
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="bg-card border-none shadow-lg shadow-black/5 overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap sm:flex-nowrap gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {DATE_PRESETS.map(p => (
              <Button 
                key={p.label} 
                variant={dateFrom === p.from && dateTo === p.to ? "default" : "outline"}
                size="sm"
                onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                className={cn(
                  "h-8 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                  dateFrom === p.from && dateTo === p.to ? "shadow-md" : "text-muted-foreground"
                )}
              >
                {p.label}
              </Button>
            ))}
            {(dateFrom || dateTo) && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10 rounded-lg"
              >
                Clear
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative group">
              <select 
                data-testid="report-period" 
                value={period} 
                onChange={e => setPeriod(e.target.value)} 
                className="h-10 pl-4 pr-10 text-[11px] font-black uppercase tracking-widest bg-background border border-border/50 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer group-hover:border-primary/50"
              >
                <option value="daily">Daily View</option>
                <option value="weekly">Weekly View</option>
                <option value="monthly">Monthly View</option>
              </select>
              <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
            </div>

            <div className="flex items-center gap-2">
              <DatePickerInput value={dateFrom} onChange={setDateFrom} placeholder="From date" />
              <div className="w-2 h-px bg-border/50" />
              <DatePickerInput value={dateTo} onChange={setDateTo} placeholder="To date" />
            </div>

            {(dateFrom || dateTo) && (
              <Badge variant="secondary" className="font-mono text-[10px] font-black uppercase tracking-tighter bg-primary/10 text-primary border-none">
                <Calendar size={12} className="mr-1.5" />
                {dateFrom || "Start"} — {dateTo || "End"}
              </Badge>
            )}

            <div className="flex-1" />
            <Button variant="ghost" size="icon" onClick={() => { lastParams.current = ""; setRefreshKey(k => k + 1); }} disabled={loading} className="rounded-full">
              <ArrowsClockwise size={18} className={loading ? "animate-spin text-primary" : ""} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
          <Card className="border-none shadow-lg">
            <CardContent className="p-6 h-[400px] flex items-center justify-center">
              <Skeleton className="w-full h-full rounded-xl" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {summary && <SummaryCards summary={summary} />}

          {/* Tabs */}
          <div className="space-y-6">
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl w-fit no-print">
              {[
                { key: "revenue", label: "Revenue", icon: TrendUp },
                { key: "customers", label: "Customers", icon: Users },
                { key: "breakdown", label: "Breakdown", icon: ChartBar },
              ].map((t) => (
                <Button
                  key={t.key}
                  variant={tab === t.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "h-9 px-6 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                    tab === t.key ? "shadow-md" : "text-muted-foreground"
                  )}
                >
                  <t.icon size={14} weight={tab === t.key ? "fill" : "bold"} className="mr-2" /> {t.label}
                </Button>
              ))}
            </div>

            {/* Tab Content */}
            <div>
              {tab === "revenue" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-none shadow-xl shadow-black/5 overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <TrendUp size={18} weight="duotone" />
                        </div>
                        <CardTitle className="text-sm font-black uppercase tracking-widest">Fabric Revenue Trend</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="h-64 sm:h-80" ref={chartRef}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis 
                              dataKey="_id" 
                              tick={chartWidth < 480 ? false : { fontSize: 10, fontWeight: 700, fill: "var(--muted-foreground)" }} 
                              axisLine={false}
                              tickLine={false}
                              angle={chartWidth < 480 ? 0 : -45} 
                              textAnchor="end" 
                              height={chartWidth < 480 ? 8 : 60}
                              interval={getTickInterval(revenueData.length)}
                            />
                            <YAxis 
                              tick={{ fontSize: 10, fontWeight: 700, fill: "var(--muted-foreground)" }} 
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} 
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.1 }} />
                            <Bar dataKey="fabric_total" name="Total Revenue" fill="var(--brand)" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="fabric_received" name="Amount Received" fill="var(--success)" radius={[4, 4, 0, 0]} barSize={20} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-xl shadow-black/5 overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-info/10 text-info">
                          <ChartBar size={18} weight="duotone" />
                        </div>
                        <CardTitle className="text-sm font-black uppercase tracking-widest">Service Distribution</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="h-64 sm:h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                            <XAxis 
                              dataKey="_id" 
                              tick={chartWidth < 480 ? false : { fontSize: 10, fontWeight: 700, fill: "var(--muted-foreground)" }} 
                              axisLine={false}
                              tickLine={false}
                              angle={chartWidth < 480 ? 0 : -45} 
                              textAnchor="end" 
                              height={chartWidth < 480 ? 8 : 60}
                              interval={getTickInterval(revenueData.length)}
                            />
                            <YAxis 
                              tick={{ fontSize: 10, fontWeight: 700, fill: "var(--muted-foreground)" }} 
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} 
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Line type="monotone" dataKey="fabric_received" name="Fabric" stroke="var(--brand)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="tailoring_received" name="Tailoring" stroke="var(--info)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {tab === "customers" && (
                <Card className="border-none shadow-xl shadow-black/5 overflow-hidden">
                  <CardHeader className="border-b border-border/50 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Users size={18} weight="duotone" />
                        </div>
                        <CardTitle className="text-sm font-black uppercase tracking-widest">Customer Revenue Ranking</CardTitle>
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] font-black">Top {customerData.length} Partners</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="sm:hidden divide-y divide-border/30">
                      {customerData.map((c, i) => (
                        <div key={c.name} className="p-4 space-y-3 hover:bg-muted/30 transition-colors" onClick={() => navigate(`/items?name=${encodeURIComponent(c.name)}`)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs font-black text-muted-foreground/40 w-5">{(i + 1).toString().padStart(2, '0')}</span>
                              <span className="text-sm font-black text-foreground">{c.name}</span>
                            </div>
                            <Badge variant="secondary" className="text-[9px] font-black px-2 py-0.5">{c.refs_count} Bills</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Revenue</span>
                              <p className="font-mono text-xs font-black">₹{fmt(c.total_fabric)}</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Received</span>
                              <p className="font-mono text-xs font-black text-success">₹{fmt(c.total_received)}</p>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Pending</span>
                              <p className="font-mono text-xs font-black text-warning">₹{fmt(c.total_pending)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden sm:block overflow-x-auto custom-scrollbar">
                      <table className="w-full min-w-[800px]">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border/50">
                            <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">#</th>
                            <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Customer Partner</th>
                            <th className="text-center px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Volume</th>
                            <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Gross Fabric</th>
                            <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Settled</th>
                            <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Outstanding</th>
                            <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Tailoring</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {customerData.map((c, i) => (
                            <tr key={c.name} className="group hover:bg-primary/[0.02] cursor-pointer transition-colors" onClick={() => navigate(`/items?name=${encodeURIComponent(c.name)}`)}>
                              <td className="px-6 py-4 font-mono text-xs font-black text-muted-foreground/40">{(i + 1).toString().padStart(2, '0')}</td>
                              <td className="px-6 py-4">
                                <span className="text-sm font-black text-foreground group-hover:text-primary transition-colors">{c.name}</span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Badge variant="outline" className="font-mono text-[10px] font-black border-border/50 group-hover:border-primary/30 group-hover:bg-primary/5 transition-all">
                                  {c.refs_count} Bills · {c.items_count} Items
                                </Badge>
                              </td>
                              <td className="px-6 py-4 font-mono text-sm font-black text-right tracking-tighter">₹{fmt(c.total_fabric)}</td>
                              <td className="px-6 py-4 font-mono text-sm font-black text-right text-success tracking-tighter">₹{fmt(c.total_received)}</td>
                              <td className="px-6 py-4 font-mono text-sm font-black text-right text-warning tracking-tighter">₹{fmt(c.total_pending)}</td>
                              <td className="px-6 py-4 font-mono text-sm font-black text-right text-info tracking-tighter">₹{fmt(c.total_tailoring)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {tab === "breakdown" && summary && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="border-none shadow-xl shadow-black/5 overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <CurrencyDollar size={18} weight="duotone" />
                        </div>
                        <CardTitle className="text-sm font-black uppercase tracking-widest">Payment Channels</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6">
                      {summary.payment_modes?.length > 0 ? (
                        <div className="h-64 sm:h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={summary.payment_modes}
                                dataKey="amount"
                                nameKey="mode"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                stroke="none"
                              >
                                {summary.payment_modes.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={v => `₹${fmt(v)}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 overflow-x-auto">
                            {summary.payment_modes.map((m, i) => (
                              <div key={m.mode} className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{m.mode}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground/40">
                          <Warning size={32} weight="duotone" className="mb-2" />
                          <p className="text-xs font-black uppercase tracking-widest">No payment data available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-xl shadow-black/5 overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-info/10 text-info">
                          <Package size={18} weight="duotone" />
                        </div>
                        <CardTitle className="text-sm font-black uppercase tracking-widest">Article Distribution</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-6">
                      {summary.article_types?.length > 0 ? (
                        <div className="h-64 sm:h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={summary.article_types} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                              <XAxis type="number" hide />
                              <YAxis 
                                dataKey="type" 
                                type="category" 
                                width={chartWidth < 480 ? 72 : 100} 
                                tick={{ fontSize: chartWidth < 480 ? 9 : 10, fontWeight: 700, fill: "var(--muted-foreground)" }} 
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.1 }} />
                              <Bar dataKey="count" name="Total Units" fill="var(--info)" radius={[0, 4, 4, 0]} barSize={16} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground/40">
                          <Warning size={32} weight="duotone" className="mb-2" />
                          <p className="text-xs font-black uppercase tracking-widest">No article data available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
