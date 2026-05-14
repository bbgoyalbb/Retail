import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getLabourItems, getKarigars, payLabour, deleteLabourPayment, getSettings } from "@/api";
import { dataEvents } from "@/lib/dataEvents";
import { fmt } from "@/lib/fmt";
import { 
  UsersThree, CurrencyDollar, CheckCircle, Circle, CaretDown, CaretRight, 
  Trash, PencilSimple, X, ArrowsClockwise, Scissors, PaintBrush, 
  CalendarCheck, Info, Receipt, Warning
} from "@phosphor-icons/react";
import { DatePickerInput } from "@/components/DatePickerInput";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function LabourPayments() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState("unpaid"); // "unpaid" | "paid"
  const [filterType, setFilterType] = useState("All");
  const [filterKarigar, setFilterKarigar] = useState("All");
  const [karigars, setKarigars] = useState([]);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedModes, setSelectedModes] = useState(["Cash"]);
  const [paymentModes, setPaymentModes] = useState(["Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const params = { 
      filter_type: filterType, 
      filter_karigar: filterKarigar,
      view_mode: viewMode
    };
    getLabourItems(params)
      .then(res => setItems(res.data))
      .catch(err => toast({ title: "Error", description: err.message || "Failed to load labour items", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [filterType, filterKarigar, viewMode, toast]);

  useEffect(() => {
    getKarigars().then(res => setKarigars(res.data)).catch((err) => {
      toast({ title: "Error", description: err.message || "Failed to load karigars", variant: "destructive" });
      setKarigars([]);
    });
    getSettings().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.payment_modes) && s.payment_modes.length > 0) setPaymentModes(s.payment_modes);
    }).catch((err) => {
      toast({ title: "Error", description: err.message || "Failed to load payment modes", variant: "destructive" });
    });
  }, [toast]);

  useEffect(() => { loadData(); setSelected([]); }, [loadData]);

  useEffect(() => {
    const handler = () => loadData();
    dataEvents.addEventListener("labour", handler);
    return () => dataEvents.removeEventListener("labour", handler);
  }, [loadData]);

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selected.length === items.length) setSelected([]);
    else setSelected(items.map(i => i.id));
  };

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedTotal = useMemo(() => items.filter(i => selectedSet.has(i.id)).reduce((sum, i) => {
    return sum + (i.labour_type === "Tailoring" ? (i.labour_amount || 0) : (i.emb_labour_amount || 0));
  }, 0), [items, selectedSet]);

  const toggleMode = (m) => setSelectedModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const handlePay = async () => {
    if (selected.length === 0) { toast({ title: "Nothing selected", description: "Select at least one item", variant: "destructive" }); return; }

    const tailoringIds = items.filter(i => selectedSet.has(i.id) && i.labour_type === "Tailoring").map(i => i.id);
    const embroideryIds = items.filter(i => selectedSet.has(i.id) && i.labour_type === "Embroidery").map(i => i.id);

    // Generate single payment_id for this batch (shared across tailoring + embroidery)
    const paymentId = `PAY-${Date.now().toString(36).slice(-6)}`;

    setSaving(true);
    try {
      await Promise.all([
        tailoringIds.length > 0 && payLabour({ item_ids: tailoringIds, labour_type: "tailoring", payment_date: payDate, payment_modes: selectedModes, payment_id: paymentId }),
        embroideryIds.length > 0 && payLabour({ item_ids: embroideryIds, labour_type: "embroidery", payment_date: payDate, payment_modes: selectedModes, payment_id: paymentId }),
      ].filter(Boolean));
      toast({ title: "Payment recorded", description: `${selected.length} items marked as paid` });
      setSelected([]);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.detail || err.message || "Failed to process payment", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const totalUnpaid = useMemo(() => items.reduce((s, i) => s + (i.labour_type === "Tailoring" ? (i.labour_amount || 0) : (i.emb_labour_amount || 0)), 0), [items]);

  // Track expanded states for 3-level hierarchy: date -> payment -> articles
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedPayments, setExpandedPayments] = useState({});
  const [editingPayment, setEditingPayment] = useState(null);
  const [editSelectedItems, setEditSelectedItems] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const toggleDateExpand = (date) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const togglePaymentExpand = (paymentId) => {
    setExpandedPayments(prev => ({ ...prev, [paymentId]: !prev[paymentId] }));
  };

  // Group paid items by date, then by payment_id
  const groupedPaid = useMemo(() => {
  const groupPaidByDateAndPayment = (items) => {
    const dates = {};
    
    items.forEach(item => {
      const paymentId = item.labour_type === "Tailoring" 
        ? item.labour_payment_id 
        : item.emb_labour_payment_id;
      const date = item.labour_type === "Tailoring" 
        ? item.labour_pay_date 
        : item.emb_labour_date;
      
      if (!date || date === "N/A") return;
      
      if (!dates[date]) {
        dates[date] = { date, payments: {} };
      }
      
      const key = `${item.labour_type.toLowerCase()}_${paymentId || `single_${item.id}`}`;
      if (!dates[date].payments[key]) {
        dates[date].payments[key] = {
          payment_id: paymentId,
          ref: paymentId || `PAY-${item.id.slice(-4)}`,
          date: date,
          mode: item.labour_type === "Tailoring" ? item.labour_payment_mode : item.emb_labour_payment_mode,
          items: [],
          total: 0,
          type: item.labour_type,
          labour_type: item.labour_type.toLowerCase()
        };
      }
      
      dates[date].payments[key].items.push(item);
      const amount = item.labour_type === "Tailoring" ? (item.labour_amount || 0) : (item.emb_labour_amount || 0);
      dates[date].payments[key].total += amount;
    });
    
    // Convert to array and sort by date descending
    return Object.values(dates)
      .map(d => ({
        ...d,
        payments: Object.values(d.payments).sort((a, b) => (b.ref || "").localeCompare(a.ref || ""))
      }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  };
  return groupPaidByDateAndPayment(items);
  }, [items]);

  const startEditPayment = (payment) => {
    setEditingPayment(payment);
    setEditSelectedItems(payment.items.map(i => i.id));
  };

  const cancelEditPayment = () => {
    setEditingPayment(null);
    setEditSelectedItems([]);
  };

  const toggleEditItem = (itemId) => {
    setEditSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const saveEditPayment = async () => {
    if (!editingPayment) return;
    
    // Items to remove from this payment (deselected items become unpaid)
    const itemsToRemove = editingPayment.items
      .filter(i => !editSelectedItems.includes(i.id))
      .map(i => i.id);
    
    // Items to keep
    const itemsToKeep = editingPayment.items
      .filter(i => editSelectedItems.includes(i.id));
    
    if (itemsToKeep.length === 0) {
      // If no items left, delete the entire payment directly (no need for separate confirm — user already confirmed by deselecting all)
      setSaving(true);
      try {
        await deleteLabourPayment({
          payment_id: editingPayment.payment_id,
          item_ids: editingPayment.items.map(i => i.id),
          labour_type: editingPayment.labour_type
        });
        toast({ title: "Payment deleted", description: `${editingPayment.items.length} items marked as unpaid` });
        loadData();
      } catch (err) {
        toast({ title: "Error", description: "Failed to delete payment", variant: "destructive" });
      } finally {
        setSaving(false);
        setTimeout(() => {}, 3000);
      }
      setEditingPayment(null);
      setEditSelectedItems([]);
      return;
    }
    
    setSaving(true);
    try {
      if (itemsToRemove.length > 0) {
        // Mark removed items as unpaid
        await deleteLabourPayment({
          payment_id: editingPayment.payment_id,
          item_ids: itemsToRemove,
          labour_type: editingPayment.labour_type
        });
      }
      toast({ title: "Payment updated", description: `${itemsToRemove.length} items removed, ${itemsToKeep.length} items kept` });
      setEditingPayment(null);
      setEditSelectedItems([]);
      loadData();
    } catch (e) {
      toast({ title: "Error", description: "Failed to update payment", variant: "destructive" });
    } finally {
      setSaving(false);
      setTimeout(() => {}, 3000);
    }
  };

  const handleDeletePayment = async (payment) => {
    if (deleteConfirm?.payment_id !== payment.payment_id) {
      setDeleteConfirm(payment);
      return;
    }
    setDeleteConfirm(null);
    setSaving(true);
    try {
      await deleteLabourPayment({
        payment_id: payment.payment_id,
        item_ids: payment.items.map(i => i.id),
        labour_type: payment.labour_type
      });
      toast({ title: "Payment deleted", description: `${payment.items.length} items marked as unpaid` });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete payment", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="labour-page" className="space-y-8 pb-24 lg:pb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary truncate">Labour Payments</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium truncate">Settle accounts for tailoring and embroidery services</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => loadData(true)} disabled={loading} className="rounded-full shadow-sm hover:rotate-180 transition-transform duration-500">
          <ArrowsClockwise size={20} className={loading ? "animate-spin text-primary" : ""} />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Workspace */}
        <div className="lg:col-span-3 space-y-6">
          {/* Filters Bar */}
          <Card className="bg-card border-none shadow-lg shadow-black/5 overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
            <CardContent className="p-4 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl">
                <Button
                  variant={viewMode === "unpaid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("unpaid")}
                  className={cn(
                    "h-9 px-4 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                    viewMode === "unpaid" ? "shadow-md" : "text-muted-foreground"
                  )}
                >
                  <Circle size={14} weight={viewMode === "unpaid" ? "fill" : "bold"} className="mr-2" /> Pending
                </Button>
                <Button
                  variant={viewMode === "paid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("paid")}
                  className={cn(
                    "h-9 px-4 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                    viewMode === "paid" ? "shadow-md" : "text-muted-foreground"
                  )}
                >
                  <CheckCircle size={14} weight={viewMode === "paid" ? "fill" : "bold"} className="mr-2" /> Settled
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative group">
                  <select 
                    data-testid="labour-type-filter" 
                    value={filterType} 
                    onChange={e => setFilterType(e.target.value)} 
                    className="h-10 pl-4 pr-10 text-[11px] font-black uppercase tracking-widest bg-background border border-border/50 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer group-hover:border-primary/50"
                  >
                    <option value="All">All Disciplines</option>
                    <option value="Tailoring Labour">Tailoring</option>
                    <option value="Embroidery Labour">Embroidery</option>
                  </select>
                  <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                  {filterType !== "All" && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background animate-pulse" />}
                </div>

                {filterType !== "Tailoring Labour" && (
                  <div className="relative group">
                    <select 
                      data-testid="labour-karigar-filter" 
                      value={filterKarigar} 
                      onChange={e => setFilterKarigar(e.target.value)} 
                      className="h-10 pl-4 pr-10 text-[11px] font-black uppercase tracking-widest bg-background border border-border/50 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer group-hover:border-primary/50"
                    >
                      <option value="All">All Artisans</option>
                      {karigars.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <UsersThree size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                    {filterKarigar !== "All" && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background animate-pulse" />}
                  </div>
                )}
              </div>
              
              <div className="sm:ml-auto flex items-center gap-6">
                {viewMode === "unpaid" ? (
                  <>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black opacity-60 leading-none mb-1">Total Outstanding</span>
                      <span className="font-mono text-base font-black text-warning tracking-tighter">₹{fmt(totalUnpaid)}</span>
                    </div>
                    <div className="flex flex-col items-end border-l border-border/50 pl-6">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black opacity-60 leading-none mb-1">Selected Allocation</span>
                      <span className="font-mono text-base font-black text-primary tracking-tighter">₹{fmt(selectedTotal)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-black opacity-60 leading-none mb-1">Processed Batches</span>
                    <Badge variant="secondary" className="font-mono text-sm font-black px-3 py-0.5 rounded-lg text-success bg-success/10 border-success/20">
                      {items.length} Entries
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl shadow-black/5 overflow-hidden bg-background min-h-[400px]">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 px-6 text-center animate-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                    {viewMode === "unpaid" ? <CheckCircle size={40} className="text-success opacity-40" weight="duotone" /> : <Warning size={40} className="text-muted-foreground opacity-40" weight="duotone" />}
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-[0.2em] text-foreground mb-2">
                    {viewMode === "unpaid" ? "Operational Excellence" : "No Records Found"}
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium max-w-[280px] leading-relaxed">
                    {viewMode === "unpaid" ? "All labour accounts are currently settled. No pending payments found." : "Your archive is currently empty for the selected filters."}
                  </p>
                </div>
              ) : viewMode === "unpaid" ? (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full" data-testid="labour-items-table">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/50">
                        <th className="px-4 py-4 w-12">
                          <div className="flex items-center justify-center">
                            <input 
                              type="checkbox" 
                              checked={selected.length === items.length && items.length > 0} 
                              onChange={selectAll} 
                              className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary/20 accent-primary cursor-pointer transition-all" 
                            />
                          </div>
                        </th>
                        <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Order Ref</th>
                        <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Article Description</th>
                        {filterType !== "Tailoring Labour" && <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Artisan</th>}
                        <th className="text-right px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Settlement Amt</th>
                        <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Discipline</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {items.map((item, i) => {
                        const amount = item.labour_type === "Tailoring" ? item.labour_amount : item.emb_labour_amount;
                        const isSelected = selected.includes(item.id);
                        return (
                          <tr 
                            key={i} 
                            className={cn(
                              "group transition-all duration-200 cursor-pointer",
                              isSelected ? "bg-primary/[0.04]" : "hover:bg-muted/30"
                            )}
                            onClick={() => toggleSelect(item.id)}
                          >
                            <td className="px-4 py-4">
                              <div className="flex items-center justify-center">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected} 
                                  readOnly 
                                  className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary/20 accent-primary transition-all" 
                                />
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-xs font-black text-primary">#{item.order_no}</span>
                                <span className="text-[10px] font-bold text-muted-foreground opacity-60 uppercase tracking-tighter">{item.ref}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{item.article_type}</span>
                            </td>
                            {filterType !== "Tailoring Labour" && (
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  {item.karigar !== "N/A" ? (
                                    <>
                                      <div className="p-1.5 rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                        <UsersThree size={14} weight="duotone" />
                                      </div>
                                      <span className="text-xs font-bold text-muted-foreground">{item.karigar}</span>
                                    </>
                                  ) : (
                                    <span className="text-xs font-medium text-muted-foreground/30">—</span>
                                  )}
                                </div>
                              </td>
                            )}
                            <td className="px-4 py-4 text-right">
                              <span className="font-mono text-sm font-black text-foreground group-hover:text-primary transition-colors">₹{fmt(amount)}</span>
                            </td>
                            <td className="px-4 py-4">
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none",
                                  item.labour_type === "Tailoring" ? "bg-info/10 text-info" : "bg-primary/10 text-primary"
                                )}
                              >
                                {item.labour_type === "Tailoring" ? <Scissors size={10} className="mr-1" weight="bold" /> : <PaintBrush size={10} className="mr-1" weight="bold" />}
                                {item.labour_type}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            ) : (
              // Paid View - 3-Level Hierarchy: Date -> Payment Entry -> Articles
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full" data-testid="labour-paid-table">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/50">
                        <th className="w-12"></th>
                        <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Settlement Date</th>
                        <th className="text-right px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Batch Count</th>
                        <th className="text-right px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Volume Total</th>
                        <th className="w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {groupedPaid.map((dateGroup, dateIdx) => (
                        <React.Fragment key={dateGroup.date}>
                          {/* Date Level */}
                          <tr
                            className="bg-muted/10 hover:bg-muted/20 cursor-pointer transition-colors group"
                            onClick={() => toggleDateExpand(dateGroup.date)}
                          >
                            <td className="px-4 py-4 text-center">
                              <div className={cn(
                                "p-1.5 rounded-full bg-background border border-border/50 text-muted-foreground transition-all duration-300",
                                expandedDates[dateGroup.date] && "rotate-90 bg-primary/10 text-primary border-primary/20"
                              )}>
                                <CaretRight size={14} weight="bold" />
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-background text-primary shadow-sm">
                                  <CalendarCheck size={18} weight="duotone" />
                                </div>
                                <span className="font-mono text-sm font-black text-foreground">{dateGroup.date}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 font-mono text-sm text-right font-bold text-muted-foreground">{dateGroup.payments.length} Settlements</td>
                            <td className="px-4 py-4 text-right">
                              <span className="font-mono text-base font-black text-success tracking-tighter">
                                ₹{fmt(dateGroup.payments.reduce((s, p) => s + p.total, 0))}
                              </span>
                            </td>
                            <td></td>
                          </tr>
                          
                          {/* Payment Entries under this date */}
                          {expandedDates[dateGroup.date] && dateGroup.payments.map((payment, payIdx) => {
                            const pKey = payment.payment_id || `${dateGroup.date}_${payIdx}`;
                            const isExpanded = expandedPayments[pKey];
                            return (
                              <React.Fragment key={pKey}>
                                <tr
                                  className={cn(
                                    "hover:bg-muted/30 cursor-pointer transition-colors border-l-4 border-l-transparent",
                                    isExpanded && "bg-muted/20 border-l-primary"
                                  )}
                                  onClick={() => togglePaymentExpand(pKey)}
                                >
                                  <td className="px-4 py-3 pl-12">
                                    <div className={cn(
                                      "p-1 rounded-md bg-muted text-muted-foreground transition-all",
                                      isExpanded && "rotate-90 bg-primary/10 text-primary"
                                    )}>
                                      <CaretRight size={12} weight="bold" />
                                    </div>
                                  </td>
                                  <td className="px-4 py-3" colSpan={2}>
                                    <div className="flex items-center gap-3">
                                      <Badge variant="outline" className="font-mono text-[10px] font-black uppercase tracking-widest bg-background border-border/50 text-muted-foreground px-2 py-0.5">
                                        {payment.ref}
                                      </Badge>
                                      <span className="text-xs font-bold text-muted-foreground">({payment.items.length} Articles)</span>
                                      <Badge 
                                        variant="outline" 
                                        className={cn(
                                          "text-[9px] font-black uppercase tracking-widest px-2 py-0 border-none",
                                          payment.type === "Tailoring" ? "bg-info/10 text-info" : "bg-primary/10 text-primary"
                                        )}
                                      >
                                        {payment.type}
                                      </Badge>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <span className="font-mono text-sm font-black text-foreground tracking-tighter">₹{fmt(payment.total)}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => startEditPayment(payment)}
                                        disabled={saving}
                                        className="h-8 w-8 text-info hover:bg-info/10"
                                      >
                                        <PencilSimple size={14} weight="bold" />
                                      </Button>
                                      {deleteConfirm?.payment_id === payment.payment_id ? (
                                        <div className="flex items-center gap-1 animate-in slide-in-from-right-2">
                                          <Button variant="destructive" size="sm" onClick={() => handleDeletePayment(payment)} className="h-7 px-2 text-[10px] font-black uppercase tracking-widest">Delete</Button>
                                          <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)} className="h-7 px-2 text-[10px] font-black uppercase tracking-widest">Cancel</Button>
                                        </div>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDeletePayment(payment)}
                                          disabled={saving}
                                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                        >
                                          <Trash size={14} weight="bold" />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                
                                {/* Articles under this payment */}
                                {isExpanded && (
                                  <tr className="bg-muted/5">
                                    <td colSpan={5} className="p-0">
                                      <div className="px-16 py-4 border-b border-border/20">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="border-b border-border/30">
                                              <th className="text-left py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Order Ref</th>
                                              <th className="text-left py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Article</th>
                                              <th className="text-left py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Artisan</th>
                                              <th className="text-right py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Net Amount</th>
                                              <th className="text-right py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 pr-2">Channel</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-border/20">
                                            {payment.items.map((item, idx) => (
                                              <tr key={idx} className="hover:bg-background/50 transition-colors">
                                                <td className="py-2.5 font-mono text-[11px] font-black text-primary">#{item.order_no}</td>
                                                <td className="py-2.5 font-bold text-foreground">{item.article_type}</td>
                                                <td className="py-2.5 text-muted-foreground font-medium">{item.karigar !== "N/A" ? item.karigar : "—"}</td>
                                                <td className="py-2.5 font-mono text-[11px] font-black text-right">₹{fmt(item.labour_type === "Tailoring" ? (item.labour_amount || 0) : (item.emb_labour_amount || 0))}</td>
                                                <td className="py-2.5 text-right pr-2">
                                                  <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0 rounded-md bg-muted/50 text-muted-foreground">
                                                    {payment.mode || "Cash"}
                                                  </Badge>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {/* Edit Payment Modal */}
                {editingPayment && (
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300" onKeyDown={e => e.key === "Escape" && cancelEditPayment()}>
                    <Card className="max-w-2xl w-full shadow-2xl border-border/50 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-4 border-b border-border/50">
                        <div className="space-y-1">
                          <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">Edit Settlement</CardTitle>
                          <Badge variant="outline" className="text-[10px] h-5 px-2 font-bold uppercase tracking-widest bg-primary/5 text-primary border-primary/20">
                            Batch: {editingPayment.ref}
                          </Badge>
                        </div>
                        <Button variant="ghost" size="icon" onClick={cancelEditPayment} className="h-9 w-9 rounded-full"><X size={20}/></Button>
                      </CardHeader>
                      <CardContent className="p-0 overflow-y-auto custom-scrollbar flex-1">
                        <div className="p-6 bg-muted/5 space-y-4">
                          <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/10 rounded-xl">
                            <Info size={18} className="text-primary mt-0.5" weight="duotone" />
                            <p className="text-xs font-medium text-muted-foreground leading-relaxed">
                              Deselect articles to remove them from this settlement. Removed articles will return to the <span className="text-primary font-bold">Pending</span> queue for future processing.
                            </p>
                          </div>
                          <div className="overflow-hidden border border-border/50 rounded-xl bg-background shadow-sm">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/30 sticky top-0">
                                <tr>
                                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select</th>
                                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Order Ref</th>
                                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</th>
                                  {editingPayment.labour_type === "embroidery" && <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Artisan</th>}
                                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/30">
                                {editingPayment.items.map((item) => {
                                  const isSelected = editSelectedItems.includes(item.id);
                                  return (
                                    <tr 
                                      key={item.id} 
                                      className={cn(
                                        "cursor-pointer transition-colors",
                                        isSelected ? "hover:bg-muted/30" : "opacity-40 grayscale bg-muted/10"
                                      )}
                                      onClick={() => toggleEditItem(item.id)}
                                    >
                                      <td className="px-4 py-3">
                                        <input 
                                          type="checkbox" 
                                          checked={isSelected} 
                                          readOnly
                                          className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary/20 accent-primary"
                                        />
                                      </td>
                                      <td className="px-4 py-3 font-mono text-xs font-black text-primary">#{item.order_no}</td>
                                      <td className="px-4 py-3 font-bold text-foreground">{item.article_type}</td>
                                      {editingPayment.labour_type === "embroidery" && <td className="px-4 py-3 text-muted-foreground font-medium">{item.karigar !== "N/A" ? item.karigar : "—"}</td>}
                                      <td className="px-4 py-3 font-mono text-sm text-right font-black">
                                        ₹{fmt(item.labour_type === "Tailoring" ? (item.labour_amount || 0) : (item.emb_labour_amount || 0))}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </CardContent>
                      <div className="p-6 border-t border-border/50 bg-background/80 backdrop-blur-md space-y-4">
                        {editSelectedItems.length === 0 && (
                          <div className="flex items-center gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg animate-in shake duration-500">
                            <Warning size={16} className="text-destructive" weight="fill" />
                            <p className="text-[11px] font-bold text-destructive leading-tight">
                              Critical: No items selected. Saving will <span className="uppercase">delete</span> this settlement record entirely.
                            </p>
                          </div>
                        )}
                        <div className="flex justify-end gap-3">
                          <Button variant="ghost" onClick={cancelEditPayment} className="h-10 px-6 font-black uppercase tracking-widest text-[10px]">Cancel</Button>
                          <Button
                            onClick={saveEditPayment}
                            disabled={saving}
                            variant={editSelectedItems.length === 0 ? "destructive" : "default"}
                            className="h-10 px-8 font-black uppercase tracking-widest text-[10px] shadow-lg"
                          >
                            {saving ? (
                              <div className="flex items-center gap-2">Processing <ArrowsClockwise size={14} className="animate-spin" /></div>
                            ) : editSelectedItems.length === 0 ? (
                              <div className="flex items-center gap-2"><Trash size={14} weight="bold" /> Void Settlement</div>
                            ) : (
                              <div className="flex items-center gap-2"><CheckCircle size={14} weight="bold" /> Save Updates</div>
                            )}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Panel */}
        <div className="space-y-6">
          <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden sticky top-8">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-primary" />
            <CardHeader className="pb-4 pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Receipt size={20} weight="duotone" />
                </div>
                <CardTitle className="text-lg font-black uppercase tracking-tight">Settlement Engine</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Execution Date</label>
                  <DatePickerInput data-testid="labour-pay-date" value={payDate} onChange={setPayDate} placeholder="Payment date" />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Payment Channel</label>
                  <div className="grid grid-cols-2 gap-2">
                    {paymentModes.map(m => {
                      const isActive = selectedModes.includes(m);
                      return (
                        <Button 
                          key={m} 
                          variant={isActive ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleMode(m)} 
                          className={cn(
                            "h-10 px-2 text-[10px] font-black uppercase tracking-tight border-border/50 transition-all truncate",
                            isActive ? "shadow-md bg-primary" : "bg-muted/30 text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30"
                          )}
                          title={m}
                        >
                          {m}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-5 bg-muted/30 rounded-2xl border border-border/50 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <CurrencyDollar size={64} weight="duotone" className="text-primary" />
                </div>
                <p className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground opacity-60 leading-none">Net Allocation</p>
                <p className="font-heading text-3xl font-black tracking-tighter text-primary mt-2">₹{fmt(selectedTotal)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-[9px] font-black px-2 py-0.5 rounded-md bg-primary/10 text-primary border-none">
                    {selected.length} Articles Selected
                  </Badge>
                </div>
              </div>

              <Button 
                data-testid="pay-labour-btn" 
                onClick={handlePay} 
                disabled={saving || selected.length === 0} 
                className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all active:scale-95 gap-3"
              >
                {saving ? (
                  <div className="flex items-center gap-2">Processing <ArrowsClockwise size={20} className="animate-spin" /></div>
                ) : (
                  <><CurrencyDollar size={20} weight="bold" /> Settle Accounts</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats or Info */}
          <Card className="bg-muted/20 border-none p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Info size={18} className="text-muted-foreground" weight="duotone" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Settlement Protocol</p>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground/70 leading-relaxed">
              Batch processing allows for multiple article settlements under a single transaction reference. All selected items will be marked as paid and moved to the settled archive.
            </p>
          </Card>
        </div>
      </div>

      {/* Mobile Sticky Action Bar */}
      {viewMode === "unpaid" && selected.length > 0 && (
        <div className="lg:hidden fixed bottom-[72px] left-4 right-4 z-40 animate-in slide-in-from-bottom-8 duration-500">
          <Card className="bg-background/80 backdrop-blur-xl border-primary/20 shadow-2xl overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.2em] font-black text-muted-foreground opacity-60">Net Allocation</p>
                <p className="text-xl font-black text-primary tracking-tighter leading-none mt-1">₹{fmt(selectedTotal)}</p>
                <p className="text-[10px] font-bold text-muted-foreground mt-1">{selected.length} articles</p>
              </div>
              <Button
                onClick={handlePay}
                disabled={saving}
                className="h-12 px-6 font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20 gap-2"
              >
                <CurrencyDollar size={18} weight="bold" />
                {saving ? "..." : "Settle"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
