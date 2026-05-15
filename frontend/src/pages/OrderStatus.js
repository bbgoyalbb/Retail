import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { getCustomers, getOrderStatus, markOrderDelivered, updateItem, getItems, invalidateOrderStatusCache } from "@/api";
import { fmt } from "@/lib/fmt";
import { DatePickerInput } from "@/components/DatePickerInput";
import { 
  ClipboardText, MagnifyingGlass, CheckCircle, Warning, 
  PencilSimple, ArrowsClockwise, X, Info, Receipt, 
  UsersThree, CalendarCheck, Package, Clock, Truck,
  Scissors, Wallet, CaretDown
} from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";


const STATUS_LABELS = {
  "Pnd": "Pending",
  "Stc": "Stitched", 
  "Dlv": "Delivered",
  "Emb": "Embroidery",
  "EFin": "Emb. Finished",
  "Req": "Required",
  "Prog": "In Progress",
  "Fin": "Finished",
};

function StatusPill({ label, value, tone }) {
  const tones = {
    warning: "text-warning border-warning/20 bg-warning/10",
    info: "text-info border-info/20 bg-info/10",
    success: "text-success border-success/20 bg-success/10",
    muted: "text-muted-foreground border-border/50 bg-muted/30",
  };

  const fullLabel = STATUS_LABELS[label] || label;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "inline-flex items-center gap-1.5 h-6 px-2 text-[9px] font-black uppercase tracking-widest border-none transition-all",
        tones[tone] || tones.muted
      )}
      title={fullLabel}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-mono font-black">{value}</span>
    </Badge>
  );
}

export default function OrderStatus() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(searchParams.get("overdue") === "1");
  const [loading, setLoading] = useState(false);
  const [delivering, setDelivering] = useState(null);
  const [editingDelivery, setEditingDelivery] = useState(null); // { order_no, value }
  const [savingDelivery, setSavingDelivery] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  // Keep a ref to the latest filter values so loadData is stable
  const filtersRef = useRef({ customer, orderNo, fromDate, toDate, overdueOnly });
  useEffect(() => { filtersRef.current = { customer, orderNo, fromDate, toDate, overdueOnly }; }, [customer, orderNo, fromDate, toDate, overdueOnly]);

  const loadData = useCallback(async () => {
    const { customer, orderNo, fromDate, toDate } = filtersRef.current;
    setLoading(true);
    try {
      const params = { limit: 400 };
      if (customer) params.customer = customer;
      if (orderNo) params.order_no = orderNo;
      if (fromDate) params.date_from = fromDate;
      if (toDate) params.date_to = toDate;
      if (filtersRef.current.overdueOnly) params.overdue_only = true;

      const res = await getOrderStatus(params);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      toast({ title: "Error", description: err.response?.data?.detail || err.message || "Failed to load orders", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]); // stable — reads filters from ref; toast ref is also stable

  useEffect(() => {
    getCustomers()
      .then((res) => setCustomers(res.data || []))
      .catch((err) => {
        setCustomers([]);
        toast({ title: "Error", description: err.message || "Failed to load customers", variant: "destructive" });
      });
  }, [toast]);

  // Only load on mount; user clicks Apply to filter
  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveDeliveryDate = async () => {
    if (!editingDelivery || savingDelivery) return;
    setSavingDelivery(true);
    try {
      const itemsRes = await getItems({ order_no: editingDelivery.order_no, limit: 200 });
      const ids = (itemsRes.data?.items || itemsRes.data || []).map(i => i.id || i._id).filter(Boolean);
      await Promise.all(ids.map(id => updateItem(id, { delivery_date: editingDelivery.value })));
      toast({ title: "Delivery date updated", description: `Order #${editingDelivery.order_no}` });
      setEditingDelivery(null);
      invalidateOrderStatusCache();
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to update delivery date", variant: "destructive" });
    } finally {
      setSavingDelivery(false);
    }
  };

  const handleDeliver = async (order_no) => {
    setDelivering(order_no);
    try {
      await markOrderDelivered(order_no);
      toast({ title: "Delivered", description: `Order ${order_no} marked as Delivered` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed", variant: "destructive" });
    } finally { setDelivering(null); }
  };

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.orders += 1;
        acc.items += row.item_count || 0;
        acc.pending += row.tailoring_pending || 0;
        acc.stitched += row.tailoring_stitched || 0;
        acc.delivered += row.tailoring_delivered || 0;
        acc.amount += row.order_total || 0;
        return acc;
      },
      { orders: 0, items: 0, pending: 0, stitched: 0, delivered: 0, amount: 0 }
    );
  }, [rows]);

  return (
    <div data-testid="order-status-page" className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary truncate">Order Status</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium truncate">Master tracking board for tailoring and delivery pipelines</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => { invalidateOrderStatusCache(); loadData(); }} disabled={loading} className="rounded-full shadow-sm hover:rotate-180 transition-transform duration-500">
          <ArrowsClockwise size={20} className={loading ? "animate-spin text-primary" : ""} />
        </Button>
      </div>

      {overdueOnly && (
        <div className="flex items-center gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-2xl animate-in slide-in-from-top-4 duration-500">
          <div className="p-2 rounded-full bg-destructive/10 text-destructive">
            <Warning size={20} weight="fill" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black uppercase tracking-widest text-destructive leading-none mb-1">Overdue Alert</p>
            <p className="text-xs text-muted-foreground font-medium">Currently isolating orders that have breached their delivery timeline.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setOverdueOnly(false); setTimeout(loadData, 0); }} className="text-destructive hover:bg-destructive/10 font-black uppercase tracking-widest text-[10px]">
            Clear Filter
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Active Orders", value: summary.orders, icon: Package, color: "primary" },
          { label: "Total Articles", value: summary.items, icon: Receipt, color: "primary" },
          { label: "Pending Cut", value: summary.pending, icon: Clock, color: "warning" },
          { label: "Stitched", value: summary.stitched, icon: Scissors, color: "info" },
          { label: "Dispatched", value: summary.delivered, icon: Truck, color: "success" },
          { label: "Board Value", value: `₹${fmt(summary.amount)}`, icon: Wallet, color: "primary", isCurrency: true },
        ].map((stat, i) => (
          <Card key={i} className="bg-card border-none shadow-lg shadow-black/5 overflow-hidden group hover:shadow-xl transition-all duration-300">
            <CardContent className="p-5 flex flex-col items-start gap-4">
              <div className={cn(
                "p-2.5 rounded-xl transition-transform group-hover:scale-110 duration-300",
                stat.color === "primary" ? "bg-primary/10 text-primary" :
                stat.color === "warning" ? "bg-warning/10 text-warning" :
                stat.color === "info" ? "bg-info/10 text-info" : "bg-success/10 text-success"
              )}>
                <stat.icon size={20} weight="duotone" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground opacity-60 leading-none mb-2">{stat.label}</p>
                <p className={cn(
                  "font-mono text-xl font-black tracking-tighter",
                  stat.color === "warning" ? "text-warning" :
                  stat.color === "info" ? "text-info" :
                  stat.color === "success" ? "text-success" : "text-foreground"
                )}>
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters Bar */}
      <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                <UsersThree size={14} weight="bold" /> Client Identity
              </label>
              <div className="relative group">
                <select 
                  value={customer} 
                  onChange={(e) => setCustomer(e.target.value)} 
                  className="w-full h-11 pl-4 pr-10 text-xs font-bold bg-muted/30 border border-border/50 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer group-hover:border-primary/50"
                >
                  <option value="">Global Search (All Clients)</option>
                  {[...customers].sort().map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                {customer && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background animate-pulse" />}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                <Receipt size={14} weight="bold" /> Order Protocol
              </label>
              <div className="relative group">
                <input 
                  value={orderNo} 
                  onChange={(e) => setOrderNo(e.target.value)} 
                  placeholder="Order No. (e.g. 4502)" 
                  className="w-full h-11 px-4 text-xs font-black font-mono bg-muted/30 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all group-hover:border-primary/50" 
                />
                <MagnifyingGlass size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                {orderNo && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background animate-pulse" />}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                <CalendarCheck size={14} weight="bold" /> From Date
              </label>
              <DatePickerInput value={fromDate} onChange={setFromDate} placeholder="Filter start date" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                <CalendarCheck size={14} weight="bold" /> To Date
              </label>
              <DatePickerInput value={toDate} onChange={setToDate} placeholder="Filter end date" />
            </div>
          </div>
          <div className="mt-8 flex justify-end border-t border-border/50 pt-6">
            <Button 
              data-testid="order-status-filter-btn" 
              onClick={loadData} 
              className="h-12 px-8 font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-primary/20 gap-3"
            >
              <MagnifyingGlass size={18} weight="bold" /> Execute Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl shadow-black/5 overflow-hidden bg-background min-h-[400px]">
        <CardHeader className="px-6 py-4 border-b border-border/50 bg-background/50 backdrop-blur-md flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ClipboardText size={18} weight="duotone" />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Master Status Board</CardTitle>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{loading ? "Synchronizing..." : `${rows.length} Active Orders`}</span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-6">
            <div className="flex items-center gap-4">
              {[
                { label: "Pnd", full: "Pending" },
                { label: "Stc", full: "Stitched" },
                { label: "Dlv", full: "Delivered" },
              ].map(leg => (
                <div key={leg.label} className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{leg.label}:</span>
                  <span className="text-[9px] font-bold text-foreground opacity-60">{leg.full}</span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 px-6 text-center animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                <Package size={40} className="text-muted-foreground opacity-40" weight="duotone" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-[0.2em] text-foreground mb-2">No Records Found</h3>
              <p className="text-sm text-muted-foreground font-medium max-w-[280px] leading-relaxed">
                Adjust your filter protocols or timeline to visualize existing order pipelines.
              </p>
            </div>
          ) : (
            <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-border/30">
              {rows.map((row) => {
                const hasUndelivered = (row.tailoring_pending || 0) + (row.tailoring_stitched || 0) > 0;
                const isOverdue = hasUndelivered && row.latest_delivery_date && row.latest_delivery_date !== "N/A" && row.latest_delivery_date < today;
                return (
                  <div key={row._id || row.order_no} className={cn(
                    "p-6 space-y-4 animate-in fade-in duration-300 relative",
                    isOverdue && "bg-destructive/[0.02]"
                  )}>
                    {isOverdue && <div className="absolute top-0 left-0 w-1 h-full bg-destructive" />}
                    
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-1.5">
                        <Badge variant="outline" className="w-fit font-mono text-[10px] h-5 px-1.5 font-bold text-primary border-primary/20 bg-primary/5">
                          #{row.order_no}
                        </Badge>
                        <span className="text-sm font-black text-foreground uppercase tracking-tight">{(row.customers || []).join(", ")}</span>
                      </div>
                      <span className="font-mono text-base font-black text-foreground tracking-tighter">₹{fmt(row.order_total || 0)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Tailoring Status</span>
                        <div className="flex flex-wrap gap-1">
                          <StatusPill label="Pnd" value={row.tailoring_pending || 0} tone="warning" />
                          <StatusPill label="Stc" value={row.tailoring_stitched || 0} tone="info" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Embroidery Status</span>
                        <div className="flex flex-wrap gap-1">
                          <StatusPill label="Prog" value={row.emb_in_progress || 0} tone="info" />
                          <StatusPill label="Fin" value={row.emb_finished || 0} tone="success" />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Timeline</span>
                        <span className={cn("text-[10px] font-bold", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                          Del: {row.latest_delivery_date && row.latest_delivery_date !== "N/A" ? row.latest_delivery_date : "—"}
                          {isOverdue && " (OVERDUE)"}
                        </span>
                      </div>
                      {hasUndelivered && (
                        <Button
                          size="sm"
                          disabled={delivering === row.order_no}
                          onClick={() => handleDeliver(row.order_no)}
                          className="h-8 px-4 font-black uppercase tracking-widest text-[9px] bg-success hover:bg-success/90 shadow-md shadow-success/10"
                        >
                          {delivering === row.order_no ? <ArrowsClockwise size={12} className="animate-spin" /> : <Truck size={12} className="mr-2" />} 
                          Deliver
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="bg-muted/30 border-b border-border/50">
                <th className="sticky left-0 z-20 bg-muted/30 px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Protocol #</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Client Entity</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Reference(s)</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Articles</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Tailoring Pipeline</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Embroidery Queue</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Valuation</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Timeline</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Delivery Goal</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {rows.map((row) => {
                const hasUndelivered = (row.tailoring_pending || 0) + (row.tailoring_stitched || 0) > 0;
                const isOverdue = hasUndelivered && row.latest_delivery_date && row.latest_delivery_date !== "N/A" && row.latest_delivery_date < today;
                return (
                  <tr key={row._id || row.order_no} className={cn(
                    "group transition-all duration-200 hover:bg-primary/[0.02]",
                    isOverdue && "bg-destructive/[0.02]"
                  )}>
                    <td className="sticky left-0 z-10 bg-background group-hover:bg-muted/50 border-r border-border/50 px-4 py-4">
                      <Badge variant="outline" className="font-mono text-[11px] font-black text-primary border-primary/20 bg-primary/5">
                        #{row.order_no}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs font-black text-foreground uppercase tracking-tight">{(row.customers || []).join(", ") || "—"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-[10px] font-bold text-muted-foreground opacity-60 uppercase tracking-widest">{(row.refs || []).join(", ") || "—"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-xs font-black text-foreground">{row.item_count || 0}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        <StatusPill label="Pnd" value={row.tailoring_pending || 0} tone="warning" />
                        <StatusPill label="Stc" value={row.tailoring_stitched || 0} tone="info" />
                        <StatusPill label="Dlv" value={row.tailoring_delivered || 0} tone="success" />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        <StatusPill label="Req" value={row.emb_required || 0} tone="warning" />
                        <StatusPill label="Prog" value={row.emb_in_progress || 0} tone="info" />
                        <StatusPill label="Fin" value={row.emb_finished || 0} tone="success" />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-mono text-xs font-black text-foreground">₹{fmt(row.order_total || 0)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-1">Billing</span>
                        <span className="font-mono text-[11px] font-bold text-foreground">{row.latest_bill_date || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {editingDelivery?.order_no === row.order_no ? (
                        <div className="flex items-center gap-2 animate-in zoom-in-95 duration-200">
                          <div className="w-36">
                            <DatePickerInput
                              value={editingDelivery.value}
                              onChange={v => setEditingDelivery(p => ({ ...p, value: v }))}
                              onKeyDown={e => { if (e.key === "Enter") handleSaveDeliveryDate(); if (e.key === "Escape") setEditingDelivery(null); }}
                            />
                          </div>
                          <Button size="icon" onClick={handleSaveDeliveryDate} disabled={savingDelivery} className="h-9 w-9 bg-primary shadow-md">
                            <CheckCircle size={16} weight="bold" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setEditingDelivery(null)} className="h-9 w-9 text-muted-foreground">
                            <X size={16} weight="bold" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => setEditingDelivery({ order_no: row.order_no, value: row.latest_delivery_date && row.latest_delivery_date !== "N/A" ? row.latest_delivery_date : "" })}
                          className="flex flex-col cursor-pointer group/del"
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-1 flex items-center gap-2">
                            Delivery Goal <PencilSimple size="10" className="opacity-0 group-hover/del:opacity-100 transition-opacity" />
                          </span>
                          <span className={cn(
                            "font-mono text-[11px] font-bold flex items-center gap-2",
                            isOverdue ? "text-destructive" : "text-foreground group-hover/del:text-primary"
                          )}>
                            {row.latest_delivery_date && row.latest_delivery_date !== "N/A" ? row.latest_delivery_date : "—"}
                            {isOverdue && <Warning size={14} weight="fill" className="animate-pulse" />}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {hasUndelivered && (
                        <Button
                          size="sm"
                          disabled={delivering === row.order_no}
                          onClick={() => handleDeliver(row.order_no)}
                          className="h-9 px-4 font-black uppercase tracking-widest text-[10px] bg-success hover:bg-success/90 shadow-lg shadow-success/10"
                        >
                          {delivering === row.order_no ? <ArrowsClockwise size={14} className="animate-spin" /> : <Truck size={14} className="mr-2" />} 
                          Deliver
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
