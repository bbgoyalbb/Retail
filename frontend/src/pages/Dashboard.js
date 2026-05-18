import { useState, useEffect, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboard } from "@/api";
import { fmt } from "@/lib/fmt";
import { dataEvents } from "@/lib/dataEvents";
import { 
  Scissors, UsersThree, TrendUp, ArrowsClockwise, 
  Receipt, Warning, CalendarCheck, ChartBar, ArrowRight, Plus 
} from "@phosphor-icons/react";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const Sparkline = memo(function Sparkline({ data, color = "var(--success)", width = 60, height = 24 }) {
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
    <svg width={width} height={height} className="flex-shrink-0 overflow-visible">
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
});

const StatCard = memo(function StatCard({ icon: Icon, label, value, sub, color = "var(--brand)", trend }) {
  return (
    <Card className="overflow-hidden relative group hover:shadow-md transition-all duration-150 border-l-4" style={{ borderLeftColor: color }}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground mb-2 leading-tight">{label}</p>
            <p className="font-heading text-2xl font-bold tracking-tight leading-snug" style={{ color }}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-1 font-medium">{sub}</p>}
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="p-2.5 rounded-lg flex-shrink-0 group-hover:scale-110 transition-transform duration-150" style={{ backgroundColor: `${color}10` }}>
              <Icon size={20} weight="duotone" style={{ color }} />
            </div>
            {trend && (
              <div className="hidden xxs:block opacity-60 group-hover:opacity-100 transition-opacity">
                <Sparkline data={trend} color={color} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

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
      .then(res => { 
        if (res.data) {
          setData(res.data); 
          setFetchError(false); 
        } else {
          if (!silent) setFetchError(true);
        }
      })
      .catch((err) => { 
        if (!silent) setFetchError(true); 
        console.error("Dashboard fetch error:", err);
      })
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => {
    fetchData();
    let lastFetch = Date.now();
    const INTERVAL_MS = 5 * 60 * 1000;
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch >= INTERVAL_MS) {
        lastFetch = Date.now();
        fetchData(true);
      }
    };
    const handler = () => { lastFetch = Date.now(); fetchData(true); };
    document.addEventListener("visibilitychange", handleVisibility);
    dataEvents.addEventListener("dashboard", handler);
    return () => { document.removeEventListener("visibilitychange", handleVisibility); dataEvents.removeEventListener("dashboard", handler); };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-32 opacity-50" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1,2].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (fetchError || !data) return (
    <div className="flex flex-col items-center justify-center py-32 gap-6">
      <div className="p-6 rounded-full bg-destructive/10 text-destructive">
        <Warning size={48} weight="duotone" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-lg font-bold">Failed to load dashboard</p>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
      </div>
      <Button onClick={() => fetchData()} size="lg" className="px-8">
        Retry Connection
      </Button>
    </div>
  );


  const totalPending = (data.fabric_pending_amount || 0) + (data.tailoring_pending_amount || 0) + (data.embroidery_pending_amount || 0) + (data.addon_pending_amount || 0);

  return (
    <div data-testid="dashboard-page" className="space-y-8 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary truncate">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium line-clamp-2">Strategic business intelligence overview</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => fetchData(true)} disabled={refreshing} className="rounded-full shadow-sm">
          <ArrowsClockwise size={20} className={refreshing ? "animate-spin text-primary" : ""} />
        </Button>
      </div>

      {data.total_items === 0 && (
        <EmptyState title="Ready for Growth?" description="Your operational dashboard is currently empty. Start by creating your first digital invoice."
          action="Launch First Bill" onAction={() => navigate('/new-bill')} />
      )}

      {/* Today's Summary Banner */}
      {data.total_items > 0 && (
        <Card className="bg-card border-none shadow-lg shadow-black/5 overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row sm:items-center p-6 gap-6 sm:gap-12">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-primary/10 transition-transform group-hover:rotate-12 duration-150">
                  <CalendarCheck size={24} className="text-primary" weight="duotone" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground">Pulse</span>
                  <span className="text-lg font-bold uppercase tracking-tight">Today</span>
                </div>
              </div>
              
              <div className="flex items-center gap-8 sm:gap-12">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">New Invoices</span>
                  <span className="font-heading text-2xl font-black text-primary">{data.today_bills_count ?? 0}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Capital Collected</span>
                  <span className="font-heading text-2xl font-black text-success">₹{fmt(data.today_collected ?? 0)}</span>
                </div>
              </div>
              
              <Button onClick={() => navigate('/new-bill')} className="sm:ml-auto h-12 px-6 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95 gap-2">
                <Plus size={20} weight="bold" /> Create Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue Alert */}
      {(data.overdue_orders_count ?? 0) > 0 && (
        <div className="relative group cursor-pointer" onClick={() => navigate('/order-status?overdue=1')}>
          <div className="absolute -inset-0.5 bg-destructive/20 rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-200" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-4 bg-destructive/[0.03] border border-destructive/20 rounded-xl transition-all">
            <div className="flex items-center gap-4 flex-1">
              <div className="p-2 rounded-full bg-destructive/10">
                <Warning size={24} className="text-destructive" weight="fill" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-destructive uppercase tracking-wide">
                  Critical: {data.overdue_orders_count} Delivery Breach{data.overdue_orders_count !== 1 ? 'es' : ''}
                </span>
                <span className="text-xs text-destructive/70 font-medium">
                  Delivery deadlines exceeded for active tailoring projects. Immediate action required.
                </span>
              </div>
            </div>
            <Badge variant="destructive" className="sm:ml-auto px-4 py-1 font-bold uppercase tracking-widest">
              Review Status <ArrowRight size={14} className="ml-2" />
            </Badge>
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard icon={Receipt} label="Total Revenue" value={`₹${fmt(data.total_revenue || 0)}`} sub="All-time gross revenue" trend={data.revenue_trend} />
        <StatCard icon={TrendUp} label="Total Pending" value={`₹${fmt(totalPending || 0)}`} sub="Outstanding receivables" color="var(--info)" />
        <StatCard icon={UsersThree} label="Customer Base" value={data.unique_customers || 0} sub="Unique customer records" color="var(--success)" />
        <StatCard icon={Scissors} label="Tailoring Queue" value={data.tailoring_pending_count || 0} sub="Pending tailoring orders" color="var(--warning)" />
      </div>

      {/* Operations & Finance Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Job Work Status */}
        <Card className="shadow-sm border-muted-foreground/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
            <CardTitle className="text-base sm:text-lg font-black uppercase tracking-tight whitespace-nowrap">Operational Pipeline</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/jobwork')} className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5">
              Production Map
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {[
              { label: "Tailoring — Pending", value: data.tailoring_pending_count, color: "var(--warning)", icon: Scissors },
              { label: "Tailoring — Stitched", value: data.tailoring_stitched_count, color: "var(--success)", icon: Scissors },
              { label: "Embroidery — Required", value: data.embroidery_required_count, color: "var(--info)", icon: ChartBar },
              { label: "Embroidery — In Progress", value: data.embroidery_inprogress_count, color: "var(--brand)", icon: ChartBar },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between py-4 border-b border-muted/50 last:border-0 hover:bg-muted/30 transition-colors px-2 rounded-lg group">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-muted/50 group-hover:bg-background transition-colors">
                    <Icon size={14} weight="duotone" style={{ color }} />
                  </div>
                  <span className="text-sm text-muted-foreground font-bold">{label}</span>
                </div>
                <span className="font-mono text-base font-black tracking-tighter" style={{ color }}>{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pending Breakdown */}
        <Card className="shadow-sm border-muted-foreground/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
            <CardTitle className="text-base sm:text-lg font-black uppercase tracking-tight whitespace-nowrap">Financial Exposure</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/items?payment=Pending')} className="text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5">
              Settlements
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {[
              { label: "Fabric Inventory", value: data.fabric_pending_amount },
              { label: "Tailoring Services", value: data.tailoring_pending_amount },
              { label: "Embroidery Works", value: data.embroidery_pending_amount },
              { label: "Accessories & Add-ons", value: data.addon_pending_amount },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-4 border-b border-muted/50 last:border-0 hover:bg-muted/30 transition-colors px-2 rounded-lg">
                <span className="text-sm text-muted-foreground font-bold">{label}</span>
                <span className="font-mono text-base font-black tracking-tighter text-warning">₹{fmt(value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-4 border-b border-muted/50">
              <span className="text-sm text-muted-foreground font-bold">Unallocated Advances</span>
              <span className="font-mono text-base font-black tracking-tighter text-success">₹{fmt(data.total_advances_amount)}</span>
            </div>
            <div className="flex items-center justify-between pt-6">
              <span className="text-sm font-black uppercase tracking-[0.2em] text-primary">Net Outstanding</span>
              <div className="flex flex-col items-end">
                <span className="font-mono text-2xl font-black tracking-tighter text-destructive">₹{fmt(totalPending)}</span>
                <div className="h-1 w-full bg-destructive/10 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-destructive rounded-full" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="shadow-lg border-muted-foreground/10 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between bg-muted/20 pb-4">
          <div>
            <CardTitle className="text-base sm:text-lg font-black uppercase tracking-tight whitespace-nowrap">Recent Ledger Activity</CardTitle>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Live transaction feed</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/items')} className="font-black uppercase tracking-widest text-[10px] gap-2 rounded-full px-4 shadow-sm hover:bg-primary hover:text-white transition-all">
            Full Audit <ArrowRight size={14} weight="bold" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {(!data.recent_items || data.recent_items.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="p-6 rounded-full bg-muted/30">
                <Receipt size={40} className="text-muted-foreground/40" weight="duotone" />
              </div>
              <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">No recent transaction data</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]" data-testid="recent-transactions-table">
                <thead>
                  <tr className="bg-muted/40 border-b border-muted/50">
                    <th className="text-left px-6 py-4 text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground">Timestamp</th>
                    <th className="text-left px-6 py-4 text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground">Client Entity</th>
                    <th className="hidden sm:table-cell text-left px-6 py-4 text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground">Reference</th>
                    <th className="hidden md:table-cell text-center px-6 py-4 text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground">Volume</th>
                    <th className="text-right px-6 py-4 text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground">Net Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/30">
                  {data.recent_items.map((item, i) => (
                    <tr key={i} className="hover:bg-primary/[0.02] transition-colors group cursor-pointer" onClick={() => navigate(`/items?name=${encodeURIComponent(item.name)}`)}>
                      <td className="px-6 py-5 font-mono text-[11px] text-muted-foreground font-bold">{item.date}</td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-black text-primary truncate max-w-[200px] group-hover:text-primary transition-colors" title={item.name}>{item.name}</div>
                        <div className="sm:hidden font-mono text-[10px] text-primary/60 mt-1 font-bold">{item.ref}</div>
                      </td>
                      <td className="hidden sm:table-cell px-6 py-5">
                        <Badge variant="outline" className="font-mono text-[10px] font-black text-primary/70 border-primary/20 bg-primary/5">{item.ref}</Badge>
                      </td>
                      <td className="hidden md:table-cell px-6 py-5 text-center">
                        <span className="text-[11px] font-black text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">{item.item_count} items</span>
                      </td>
                      <td className="px-6 py-5 font-mono text-sm text-right font-black text-primary tracking-tighter">₹{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
