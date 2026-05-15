import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { getJobwork, moveJobwork, moveJobworkBack, moveJobworkEmb, editJobworkEmb, getJobworkFilters } from "@/api";
import { 
  ArrowRight, ArrowLeft, Funnel, X, PencilSimple, 
  CheckSquare, ArrowsClockwise, Scissors, ChartBar, 
  Calendar, User, Package, MagnifyingGlass 
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fmt } from "@/lib/fmt";

function MoveDialog({ title, onConfirm, onCancel, fields }) {
  const [values, setValues] = useState({});
  const [skips, setSkips] = useState({});

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200" data-testid="move-dialog">
      <Card className="max-w-md w-full shadow-2xl border-none animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-xl font-black uppercase tracking-tight text-primary">{title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-full">
            <X size={20} weight="bold" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-5">
            {fields.map(f => (
              <div key={f.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground ml-1">{f.label}</label>
                  {f.skippable && (
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={skips[f.key] || false} onChange={e => setSkips(p => ({ ...p, [f.key]: e.target.checked }))} className="w-4 h-4 rounded accent-primary" />
                      <span className="text-[10px] uppercase font-black text-muted-foreground group-hover:text-primary transition-colors">Skip</span>
                    </label>
                  )}
                </div>
                <Input
                  data-testid={`dialog-${f.key}`}
                  type={f.type || "text"}
                  value={values[f.key] || ""}
                  onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
                  disabled={skips[f.key]}
                  placeholder={f.placeholder}
                  className="h-12 text-base font-bold focus:border-primary border-2"
                  autoFocus={fields.indexOf(f) === 0}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onConfirm(values, skips); } }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-4 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1 h-12 font-black uppercase tracking-widest">Cancel</Button>
            <Button data-testid="dialog-confirm-btn" onClick={() => onConfirm(values, skips)} className="flex-[2] h-12 font-black uppercase tracking-widest shadow-lg shadow-primary/20">Confirm Action</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusColumn({ title, items, color, onMove, moveLabel, onMoveBack, moveBackLabel, sortKey, onSort, sortDir, onItemDoubleClick, editableFields }) {
  const [selected, setSelected] = useState([]);
  const longPressTimer = useRef(null);

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleMove = () => {
    if (selected.length === 0) return;
    onMove(selected);
    setSelected([]);
  };

  const handleMoveBack = () => {
    if (selected.length === 0) return;
    onMoveBack(selected);
    setSelected([]);
  };

  const handleDoubleClick = (item) => {
    if (onItemDoubleClick) onItemDoubleClick(item);
  };

  const handleTouchStart = (item) => {
    if (!onItemDoubleClick) return;
    longPressTimer.current = setTimeout(() => { onItemDoubleClick(item); }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  return (
    <Card className="flex flex-col shadow-lg border-muted-foreground/10 h-full overflow-hidden" data-kanban-col={title}>
      <CardHeader className="p-4 border-b bg-muted/20 sticky top-0 z-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full animate-pulse shadow-[0_0_8px_rgba(0,0,0,0.1)]" style={{ backgroundColor: color }} />
            <div className="flex flex-col">
              <CardTitle className="text-xs uppercase tracking-[0.2em] font-black text-primary">{title}</CardTitle>
              <span className="text-[9px] font-black text-muted-foreground uppercase opacity-60 tracking-widest">{items.length} Workloads</span>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] font-black">{sortKey === "order_no" ? "ORD" : sortKey === "date" ? "DATE" : "DEL"}</Badge>
        </div>
        <div className="flex gap-1.5">
          {["order_no", "date", "delivery_date"].map(k => (
            <Button key={k} variant={sortKey === k ? "default" : "outline"} size="sm" onClick={() => onSort(k)} 
              className={`flex-1 h-8 text-[9px] font-black uppercase tracking-widest transition-all ${sortKey === k ? 'shadow-md shadow-primary/20' : 'text-muted-foreground hover:text-primary'}`}>
              {k === "order_no" ? "Order" : k === "date" ? "Booked" : "Delivery"}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto min-h-[300px] lg:max-h-[calc(100vh-340px)] p-0 divide-y divide-muted/30 no-scrollbar bg-background">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
            <div className="p-4 rounded-full bg-muted">
              <CheckSquare size={40} className="text-muted-foreground" weight="duotone" />
            </div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground">Operational Void</p>
          </div>
        ) : items.map(item => (
          <div 
            key={item.id} 
            className={`px-5 py-4 cursor-pointer transition-all border-l-4 group relative ${selected.includes(item.id) ? 'bg-primary/[0.03] border-l-primary' : 'hover:bg-muted/[0.02] border-l-transparent'}`} 
            onClick={() => toggleSelect(item.id)}
            onDoubleClick={() => handleDoubleClick(item)}
            onTouchStart={() => handleTouchStart(item)}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
          >
            <div className="flex items-start gap-4">
              <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selected.includes(item.id) ? 'bg-primary border-primary scale-110 shadow-md shadow-primary/20' : 'border-muted-foreground/20 bg-background group-hover:border-primary/50'}`}>
                {selected.includes(item.id) && <CheckSquare size={14} weight="bold" className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-primary truncate uppercase tracking-tight">{item.article_type}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="font-mono text-[10px] font-black text-primary border-primary/20 bg-primary/5">#{item.order_no}</Badge>
                    {onItemDoubleClick && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleDoubleClick(item); }}>
                        <PencilSimple size={14} weight="bold" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs font-bold text-muted-foreground mt-1 truncate">{item.name}</p>
                
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div className="space-y-1">
                    <span className="text-[8px] uppercase font-black text-muted-foreground opacity-50 tracking-widest block">Booked</span>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={10} className="text-muted-foreground" />
                      <span className="font-mono text-[10px] font-black">{item.date}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-right sm:text-left">
                    <span className="text-[8px] uppercase font-black text-muted-foreground opacity-50 tracking-widest block">Due Date</span>
                    <div className="flex items-center gap-1.5 justify-end sm:justify-start">
                      <Calendar size={10} className="text-info" />
                      <span className="font-mono text-[10px] font-black text-info">{item.delivery_date}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  {item.barcode && item.barcode !== "N/A" && (
                    <Badge variant="outline" className="font-mono text-[9px] font-black gap-1 py-0.5 px-2">
                      <Package size={10} /> {item.barcode}
                    </Badge>
                  )}
                  {item.price > 0 && (
                    <Badge variant="outline" className="text-[9px] font-black gap-1 py-0.5 px-2">
                      ₹{fmt(item.price)} × {item.qty}
                    </Badge>
                  )}
                  {item.karigar && item.karigar !== "N/A" && (
                    <Badge variant="info" className="text-[9px] font-black gap-1 py-0.5 px-2">
                      <User size={10} weight="fill" /> {item.karigar}
                    </Badge>
                  )}
                  {item.emb_labour_amount > 0 && (
                    <Badge variant="success" className="text-[9px] font-black gap-1 py-0.5 px-2">
                      LABOUR: ₹{item.emb_labour_amount}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>

      <div className="p-4 border-t bg-muted/20 space-y-3">
        {moveLabel && (
          <Button 
            data-testid={`move-${title.toLowerCase().replace(/\s/g, '-')}-btn`} 
            onClick={handleMove} 
            disabled={selected.length === 0}
            className="w-full h-12 font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 active:scale-95 transition-all gap-2"
          >
            Advance {selected.length > 0 ? selected.length : ''} <ArrowRight size={18} weight="bold" />
          </Button>
        )}
        {onMoveBack && moveBackLabel && (
          <Button 
            data-testid={`moveback-${title.toLowerCase().replace(/\s/g, '-')}-btn`} 
            onClick={handleMoveBack} 
            disabled={selected.length === 0} 
            variant="outline"
            className="w-full h-10 font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary hover:border-primary active:scale-95 transition-all gap-2"
          >
            <ArrowLeft size={16} weight="bold" /> Revert
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function JobWork() {
  const { toast } = useToast();
  const [tab, setTab] = useState("tailoring");
  const [activeCol, setActiveCol] = useState("Pending");
  const [data, setData] = useState({});
  const [filters, setFilters] = useState({ order_nos: [], dates: [], delivery_dates: [] });
  const [orderFilter, setOrderFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [deliveryFilter, setDeliveryFilter] = useState("All");
  const [sortKey, setSortKey] = useState("order_no");
  const [sortDir, setSortDir] = useState("asc");
  const [dialog, setDialog] = useState(null);

  const loadData = useCallback(() => {
    const params = { tab };
    if (orderFilter !== "All") params.order_no = orderFilter;
    if (dateFilter !== "All") params.date_filter = dateFilter;
    if (deliveryFilter !== "All") params.delivery_filter = deliveryFilter;
    getJobwork(params).then(res => setData(res.data)).catch(err => {
      toast({ title: "Error", description: err.message || "Failed to load job work data", variant: "destructive" });
    });
  }, [tab, orderFilter, dateFilter, deliveryFilter, toast]);

  useEffect(() => {
    getJobworkFilters()
      .then(res => setFilters(res.data))
      .catch((err) => {
        toast({ title: "Error", description: err.message || "Failed to load jobwork filters", variant: "destructive" });
        setFilters({ order_nos: [], dates: [], delivery_dates: [] });
      });
  }, [toast]);
  useEffect(() => { loadData(); }, [loadData]);

  const sortItems = (items) => {
    if (!items) return [];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return [...items].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];

      // Normalise missing / N/A — always push to end regardless of direction
      const emptyA = va === undefined || va === null || va === "" || va === "N/A";
      const emptyB = vb === undefined || vb === null || vb === "" || vb === "N/A";
      if (emptyA && emptyB) return 0;
      if (emptyA) return 1;
      if (emptyB) return -1;

      // Date comparison (YYYY-MM-DD)
      if (dateRegex.test(String(va)) && dateRegex.test(String(vb))) {
        const cmp = new Date(va) - new Date(vb);
        return sortDir === "asc" ? cmp : -cmp;
      }

      // Numeric
      if (typeof va === "number" && typeof vb === "number") {
        const cmp = va - vb;
        return sortDir === "asc" ? cmp : -cmp;
      }

      // String
      const cmp = String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortedPending    = useMemo(() => sortItems(data.pending),     [data.pending,    sortKey, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps
  const sortedStitched   = useMemo(() => sortItems(data.stitched),    [data.stitched,   sortKey, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps
  const sortedDelivered  = useMemo(() => sortItems(data.delivered),   [data.delivered,  sortKey, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps
  const sortedRequired   = useMemo(() => sortItems(data.required),    [data.required,   sortKey, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps
  const sortedInProgress = useMemo(() => sortItems(data.in_progress), [data.in_progress,sortKey, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps
  const sortedFinished   = useMemo(() => sortItems(data.finished),    [data.finished,   sortKey, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTailoringMove = async (itemIds, newStatus) => {
    try {
      await moveJobwork({ item_ids: itemIds, new_status: newStatus });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to move items", variant: "destructive" });
    }
  };

  const handleTailoringMoveBack = async (itemIds, currentStatus) => {
    try {
      await moveJobworkBack({ item_ids: itemIds, current_status: currentStatus });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to move items back", variant: "destructive" });
    }
  };

  const handleEmbMoveBack = async (itemIds, currentStatus) => {
    try {
      await moveJobworkBack({ item_ids: itemIds, current_status: currentStatus });
      loadData();
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to move items back", variant: "destructive" });
    }
  };

  // Embroidery: Required → In Progress needs Karigar name
  const handleEmbRequiredMove = (itemIds) => {
    setDialog({
      title: "Assign Karigar",
      fields: [{ key: "karigar", label: "Karigar Name", placeholder: "Enter karigar name", skippable: true }],
      onConfirm: async (values, skips) => {
        try {
          await moveJobwork({ item_ids: itemIds, new_status: "In Progress", karigar: skips.karigar ? undefined : (values.karigar || undefined) });
          setDialog(null);
          loadData();
        } catch (err) {
          toast({ title: "Error", description: err.message || "Failed to assign karigar", variant: "destructive" });
        }
      },
    });
  };

  // Double-click to edit karigar name for In Progress items
  const handleEditInProgress = (item) => {
    setDialog({
      title: "Edit Karigar",
      fields: [{ key: "karigar", label: "Karigar Name", placeholder: "Enter karigar name", skippable: true }],
      onConfirm: async (values, skips) => {
        try {
          if (!skips.karigar && values.karigar !== undefined) {
            await editJobworkEmb({ item_id: item.id, karigar: values.karigar || "" });
          }
          setDialog(null);
          loadData();
        } catch (err) {
          toast({ title: "Error", description: err.message || "Failed to update karigar", variant: "destructive" });
        }
      },
    });
  };

  // Double-click to edit karigar and amounts for Finished items
  const handleEditFinished = (item) => {
    setDialog({
      title: "Edit Embroidery Details",
      fields: [
        { key: "karigar", label: "Karigar Name", placeholder: item.karigar || "Enter karigar name", skippable: true },
        { key: "emb_labour", label: "Labour Charges (Karigar)", type: "number", placeholder: item.emb_labour_amount || "0", skippable: true },
        { key: "emb_customer", label: "Customer Embroidery Charges", type: "number", placeholder: item.embroidery_amount || "0", skippable: true },
      ],
      onConfirm: async (values, skips) => {
        try {
          const updates = { item_id: item.id };
          if (!skips.karigar && values.karigar !== undefined) {
            updates.karigar = values.karigar;
          }
          if (!skips.emb_labour && values.emb_labour) {
            updates.emb_labour_amount = parseFloat(values.emb_labour);
          }
          if (!skips.emb_customer && values.emb_customer) {
            updates.emb_customer_amount = parseFloat(values.emb_customer);
          }
          if (Object.keys(updates).length > 1) {
            await editJobworkEmb(updates);
          }
          setDialog(null);
          loadData();
        } catch (err) {
          toast({ title: "Error", description: err.message || "Failed to update embroidery details", variant: "destructive" });
        }
      },
    });
  };

  // Embroidery: In Progress → Finished needs labour charges + customer charges
  const handleEmbProgressMove = (itemIds) => {
    setDialog({
      title: "Finish Embroidery",
      fields: [
        { key: "emb_labour", label: "Labour Charges (Karigar)", type: "number", placeholder: "Karigar payment amount", skippable: true },
        { key: "emb_customer", label: "Customer Embroidery Charges", type: "number", placeholder: "Amount payable by customer", skippable: true },
      ],
      onConfirm: async (values, skips) => {
        try {
          const updates = { item_ids: itemIds, new_status: "Finished" };
          if (!skips.emb_labour && values.emb_labour) updates.emb_labour_amount = parseFloat(values.emb_labour);
          if (!skips.emb_customer && values.emb_customer) updates.emb_customer_amount = parseFloat(values.emb_customer);
          await moveJobworkEmb(updates);
          setDialog(null);
          loadData();
        } catch (err) {
          toast({ title: "Error", description: err.message || "Failed to finish embroidery", variant: "destructive" });
        }
      },
    });
  };

  const closeDialog = useCallback(() => setDialog(null), []);

  return (
    <div data-testid="jobwork-page" className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary truncate">Production Pipeline</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium truncate">Real-time tracking of tailoring and embroidery workflows</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => loadData()} className="rounded-full shadow-sm">
          <ArrowsClockwise size={20} className="text-primary" />
        </Button>
      </div>

      <div className="flex items-center justify-between border-b pb-1">
        <div className="flex gap-2">
          {[
            { id: "tailoring", label: "Tailoring Units", icon: Scissors },
            { id: "embroidery", label: "Embroidery Studio", icon: ChartBar },
          ].map(t => (
            <Button 
              key={t.id} 
              variant={tab === t.id ? "default" : "ghost"} 
              onClick={() => { setTab(t.id); setActiveCol(t.id === "tailoring" ? "Pending" : "Required"); }} 
              className={`h-11 px-6 font-black uppercase tracking-widest text-[10px] gap-2 transition-all ${tab === t.id ? 'shadow-lg shadow-primary/20' : 'text-muted-foreground'}`}
            >
              <t.icon size={18} weight={tab === t.id ? "fill" : "bold"} />
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      <Card className="bg-muted/10 border-none shadow-inner">
        <CardContent className="p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-muted-foreground px-2">
            <Funnel size={18} weight="bold" />
            <span className="text-[10px] font-black uppercase tracking-widest">Filters</span>
          </div>
          
          <div className="flex-1 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[140px]">
              <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select value={orderFilter} onChange={e => setOrderFilter(e.target.value)} className="w-full h-10 pl-9 pr-4 text-[11px] font-bold uppercase tracking-wider bg-background border border-muted-foreground/20 rounded-lg focus:ring-2 focus:ring-primary appearance-none cursor-pointer">
                <option value="All">All Order References</option>
                {filters.order_nos?.sort().map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="relative flex-1 min-w-[140px]">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-full h-10 pl-9 pr-4 text-[11px] font-bold uppercase tracking-wider bg-background border border-muted-foreground/20 rounded-lg focus:ring-2 focus:ring-primary appearance-none cursor-pointer">
                <option value="All">All Booking Dates</option>
                {filters.dates?.sort().reverse().map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="relative flex-1 min-w-[140px]">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-info" />
              <select value={deliveryFilter} onChange={e => setDeliveryFilter(e.target.value)} className="w-full h-10 pl-9 pr-4 text-[11px] font-bold uppercase tracking-wider bg-background border border-muted-foreground/20 rounded-lg focus:ring-2 focus:ring-primary appearance-none cursor-pointer text-info">
                <option value="All">All Delivery Deadlines</option>
                {filters.delivery_dates?.sort().reverse().map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {(orderFilter !== "All" || dateFilter !== "All" || deliveryFilter !== "All") && (
            <Button variant="ghost" size="sm" onClick={() => { setOrderFilter("All"); setDateFilter("All"); setDeliveryFilter("All"); }} className="text-[10px] font-black uppercase tracking-widest text-destructive hover:bg-destructive/10">
              Reset <X size={12} weight="bold" className="ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {dialog && <MoveDialog title={dialog.title} fields={dialog.fields} onConfirm={dialog.onConfirm} onCancel={closeDialog} />}

      {tab === "tailoring" ? (
        <div className="space-y-6">
          <div className="flex lg:hidden gap-1 p-1 bg-muted/20 border rounded-xl overflow-hidden shadow-inner">
            {["Pending", "Stitched", "Delivered"].map(col => (
              <Button key={col} variant={activeCol === col ? "default" : "ghost"} onClick={() => setActiveCol(col)}
                className={`flex-1 h-10 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  activeCol === col ? "shadow-md" : "text-muted-foreground"
                }`}>{col}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={activeCol === "Pending" ? "block lg:block" : "hidden lg:block"}>
              <StatusColumn title="Pending" items={sortedPending} color="#D49842" moveLabel="Stitched" onMove={(ids) => handleTailoringMove(ids, "Stitched")} sortKey={sortKey} onSort={handleSort} sortDir={sortDir} />
            </div>
            <div className={activeCol === "Stitched" ? "block lg:block" : "hidden lg:block"}>
              <StatusColumn title="Stitched" items={sortedStitched} color="#5C8A9E" moveLabel="Delivered" onMove={(ids) => handleTailoringMove(ids, "Delivered")} onMoveBack={(ids) => handleTailoringMoveBack(ids, "Stitched")} moveBackLabel="to Pending" sortKey={sortKey} onSort={handleSort} sortDir={sortDir} />
            </div>
            <div className={activeCol === "Delivered" ? "block lg:block" : "hidden lg:block"}>
              <StatusColumn title="Delivered" items={sortedDelivered} color="#455D4A" onMoveBack={(ids) => handleTailoringMoveBack(ids, "Delivered")} moveBackLabel="to Stitched" sortKey={sortKey} onSort={handleSort} sortDir={sortDir} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex lg:hidden gap-1 p-1 bg-muted/20 border rounded-xl overflow-hidden shadow-inner">
            {["Required", "In Progress", "Finished"].map(col => (
              <Button key={col} variant={activeCol === col ? "default" : "ghost"} onClick={() => setActiveCol(col)}
                className={`flex-1 h-10 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  activeCol === col ? "shadow-md" : "text-muted-foreground"
                }`}>{col}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={activeCol === "Required" ? "block lg:block" : "hidden lg:block"}>
              <StatusColumn title="Required" items={sortedRequired} color="#D49842" moveLabel="In Progress" onMove={handleEmbRequiredMove} sortKey={sortKey} onSort={handleSort} sortDir={sortDir} />
            </div>
            <div className={activeCol === "In Progress" ? "block lg:block" : "hidden lg:block"}>
              <StatusColumn title="In Progress" items={sortedInProgress} color="#5C8A9E" moveLabel="Finished" onMove={handleEmbProgressMove} onMoveBack={(ids) => handleEmbMoveBack(ids, "In Progress")} moveBackLabel="to Required" onItemDoubleClick={handleEditInProgress} sortKey={sortKey} onSort={handleSort} sortDir={sortDir} />
            </div>
            <div className={activeCol === "Finished" ? "block lg:block" : "hidden lg:block"}>
              <StatusColumn title="Finished" items={sortedFinished} color="#455D4A" onMoveBack={(ids) => handleEmbMoveBack(ids, "Finished")} moveBackLabel="to In Progress" onItemDoubleClick={handleEditFinished} sortKey={sortKey} onSort={handleSort} sortDir={sortDir} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
