import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getDaybook, getDaybookDates, tallyEntries, invalidateDaybookPendingCache } from "@/api";
import { dataEvents } from "@/lib/dataEvents";
import { fmt } from "@/lib/fmt";
import { 
  Check, Circle, Spinner, ArrowsClockwise, CaretDown, 
  CalendarCheck, Receipt, Wallet, Scissors, PaintBrush, 
  Tag, ChartBar, Info, Warning, CaretRight
} from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function SortableHeader({ label, sortKey, currentKey, dir, onSort }) {
  const isActive = currentKey === sortKey;
  return (
    <th 
      className={cn(
        "text-left px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer select-none whitespace-nowrap transition-colors",
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      )} 
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-primary animate-in zoom-in duration-300">
            {dir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </div>
    </th>
  );
}

// Tally indicator component - visual only, for use inside larger hit targets
function TallyIndicator({ isTallied }) {
  return (
    <div className={cn(
      "w-10 h-10 md:w-8 md:h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300",
      isTallied
        ? 'bg-success text-white shadow-lg shadow-success/20'
        : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
    )}>
      {isTallied ? <Check size={16} weight="bold" /> : <Circle size={16} weight="duotone" />}
    </div>
  );
}

// Category tally button component
function TallyButton({ isTallied, onClick, hasAmount, label, loading }) {
  if (!hasAmount) return <div className="w-10 h-10 md:w-8 md:h-8 flex-shrink-0" />;
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "min-w-10 min-h-10 md:min-w-0 md:min-h-0 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all duration-300",
        isTallied
          ? 'bg-success text-white hover:opacity-90 shadow-md shadow-success/20'
          : 'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary'
      , loading && "opacity-50 cursor-not-allowed")}
      title={isTallied ? `Un-tally ${label}` : `Tally ${label}`}
    >
      {loading ? <Spinner size={16} className="animate-spin" /> : (isTallied ? <Check size={16} weight="bold" /> : <Circle size={16} weight="duotone" />)}
    </button>
  );
}

function DaybookTable({ entries, onCategoryTally, loading, dateFilter, refFilter, nameFilter }) {
  const { toast } = useToast();
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [viewMode, setViewMode] = useState("pending");
  const [localEntries, setLocalEntries] = useState(entries);
  const [updatingTally, setUpdatingTally] = useState({});

  useEffect(() => { setLocalEntries(entries); }, [entries]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };


  // Compact mode label: Cash→C, PhonePe→P, Bank/Transfer→B, etc.
  const modeCode = (mode = "") => {
    const m = mode.toUpperCase();
    if (m.includes("CASH")) return "C";
    if (m.includes("PHONEPE") || m.includes("PHONE PE")) return "P";
    if (m.includes("BANK") || m.includes("TRANSFER") || m.includes("NEFT") || m.includes("IMPS")) return "B";
    if (m.includes("[E]")) return "E";
    if (m.includes("[S]")) return "S";
    return mode ? mode.slice(0, 2).toUpperCase() : "";
  }; 

  const CATS = ["fabric", "tailoring", "embroidery", "addon", "advance"];

  const isFullyTallied = (entry) => {
    const ts = entry.tally_status || {};
    if ((entry.fabric || 0) > 0 && !ts.fabric) return false;
    if ((entry.tailoring || 0) > 0 && !ts.tailoring) return false;
    if ((entry.embroidery || 0) > 0 && !ts.embroidery) return false;
    if ((entry.addon || 0) > 0 && !ts.addon) return false;
    if ((entry.advance || 0) !== 0 && !ts.advance) return false;
    return true;
  };

  // Which categories have amounts for an entry
  const activeCats = (entry) => CATS.filter(c => (entry[c] || 0) !== 0);

  // All active cats are tallied → row is fully tallied
  const allCatsTallied = (entry) => {
    const ts = entry.tally_status || {};
    return activeCats(entry).every(c => ts[c]);
  };

  const visibleEntries = useMemo(() => localEntries.filter(entry => {
    if (refFilter  !== "All" && entry.ref  !== refFilter)  return false;
    if (nameFilter !== "All" && entry.name !== nameFilter) return false;
    return viewMode === "pending" ? !isFullyTallied(entry) : isFullyTallied(entry);
  }), [localEntries, refFilter, nameFilter, viewMode]);

  const grandTotal = useMemo(() => visibleEntries.reduce((s, e) => s + (e.total || 0), 0), [visibleEntries]);

  const sorted = useMemo(() => {
    const NUMERIC_SORT_KEYS = new Set(["fabric", "tailoring", "embroidery", "addon", "advance", "total"]);
    return [...visibleEntries].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (NUMERIC_SORT_KEYS.has(sortKey)) {
        const na = parseFloat(va) || 0;
        const nb = parseFloat(vb) || 0;
        return sortDir === "asc" ? na - nb : nb - na;
      }
      va = va ?? "";
      vb = vb ?? "";
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [visibleEntries, sortKey, sortDir]);

  // Row-level unique key: date + ref
  const rowKey = (entry) => `${entry.date}__${entry.ref}`;

  const handleCategoryTallyClick = async (entry, category, isTallied) => {
    const action = isTallied ? "untally" : "tally";
    const key = `${rowKey(entry)}:${category}`;

    setLocalEntries(prev => prev.map(e =>
      e.date === entry.date && e.ref === entry.ref
        ? { ...e, tally_status: { ...e.tally_status, [category]: !isTallied } }
        : e
    ));
    setUpdatingTally(prev => ({ ...prev, [key]: true }));

    try {
      await onCategoryTally(entry.ref, entry.date, category, action);
    } catch (err) {
      setLocalEntries(prev => prev.map(e =>
        e.date === entry.date && e.ref === entry.ref
          ? { ...e, tally_status: { ...e.tally_status, [category]: isTallied } }
          : e
      ));
      toast({ title: "Tally failed", description: err.message || "Could not update tally.", variant: "destructive" });
    } finally {
      setUpdatingTally(prev => ({ ...prev, [key]: false }));
    }
  };

  // Tally-all handler: tally or untally all active categories at once
  const handleTallyAll = async (entry, shouldTally) => {
    const cats = activeCats(entry);
    if (cats.length === 0) return;
    const action = shouldTally ? "tally" : "untally";

    // Optimistic update all cats at once
    setLocalEntries(prev => prev.map(e => {
      if (e.date !== entry.date || e.ref !== entry.ref) return e;
      const newTs = { ...e.tally_status };
      cats.forEach(c => { newTs[c] = shouldTally; });
      return { ...e, tally_status: newTs };
    }));

    // Mark all as updating
    setUpdatingTally(prev => {
      const next = { ...prev };
      cats.forEach(c => { next[`${rowKey(entry)}:${c}`] = true; });
      return next;
    });

    try {
      await onCategoryTally(entry.ref, entry.date, "all", action);
    } catch (err) {
      // Revert on failure
      setLocalEntries(prev => prev.map(e => {
        if (e.date !== entry.date || e.ref !== entry.ref) return e;
        const revertTs = { ...e.tally_status };
        cats.forEach(c => { revertTs[c] = !shouldTally; });
        return { ...e, tally_status: revertTs };
      }));
      toast({ title: "Tally failed", description: err.message || "Could not update tally.", variant: "destructive" });
    } finally {
      setUpdatingTally(prev => {
        const next = { ...prev };
        cats.forEach(c => { delete next[`${rowKey(entry)}:${c}`]; });
        return next;
      });
    }
  };

  // Show date dividers only when "All" dates selected and sorted by date
  const showDateDividers = dateFilter === "All" && refFilter === "All" && nameFilter === "All" && sortKey === "date";

  return (
    <Card className="border-none shadow-xl shadow-black/5 overflow-hidden bg-background min-h-[400px]">
      <CardHeader className="px-6 py-4 border-b border-border/50 bg-background/50 backdrop-blur-md flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground leading-none mb-1.5">
              {viewMode === "pending" ? "Awaiting Tally" : "Reconciled Ledger"}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-[10px] h-5 px-1.5 font-bold">
                {visibleEntries.length} Entries
              </Badge>
              <span className="font-mono text-xs font-black text-primary">₹{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl">
          {["pending", "tallied"].map(mode => (
            <Button 
              key={mode} 
              variant={viewMode === mode ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode(mode)}
              className={cn(
                "h-8 px-4 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                viewMode === mode ? "shadow-md" : "text-muted-foreground"
              )}
            >
              {mode}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {visibleEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 px-6 text-center animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
              {viewMode === "pending" ? <Check size={40} className="text-success opacity-40" weight="duotone" /> : <Warning size={40} className="text-muted-foreground opacity-40" weight="duotone" />}
            </div>
            <h3 className="text-lg font-black uppercase tracking-[0.2em] text-foreground mb-2">
              {viewMode === "pending" ? "Perfect Alignment" : "Archive Empty"}
            </h3>
            <p className="text-sm text-muted-foreground font-medium max-w-[280px] leading-relaxed">
              {viewMode === "pending" ? "All transaction entries have been successfully tallied and reconciled." : "No tallied entries found for the selected filters."}
            </p>
          </div>
        ) : (
          <>
          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-border/30">
            {visibleEntries.map((entry) => {
              const ts = entry.tally_status || {};
              const modes = entry.modes || {};
              const cats = activeCats(entry);
              const allTallied = allCatsTallied(entry);
              const anyUpdating = cats.some(c => updatingTally[`${rowKey(entry)}:${c}`]);
              let swipeStartX = null;
              return (
                <div
                  key={entry.id || entry.ref}
                  className="p-5 space-y-4 animate-in fade-in duration-300"
                  onTouchStart={e => { swipeStartX = e.touches[0].clientX; }}
                  onTouchEnd={e => {
                    if (swipeStartX === null || anyUpdating) return;
                    const dx = e.changedTouches[0].clientX - swipeStartX;
                    if (dx > 80) handleTallyAll(entry, true);
                    else if (dx < -80) handleTallyAll(entry, false);
                    swipeStartX = null;
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-black text-muted-foreground">{entry.date}</span>
                        <Badge variant="outline" className="font-mono text-[10px] h-5 px-1.5 font-bold text-primary border-primary/20 bg-primary/5">
                          {entry.ref}
                        </Badge>
                      </div>
                      <span className="text-sm font-black text-foreground truncate uppercase tracking-tight">{entry.name}</span>
                    </div>
                    <span className="font-mono text-base font-black text-foreground tracking-tighter">₹{fmt(entry.total || 0)}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { cat: "fabric",     label: "Fabric",    amt: entry.fabric,     icon: Scissors },
                      { cat: "tailoring",  label: "Tailoring", amt: entry.tailoring,  icon: Scissors },
                      { cat: "embroidery", label: "Emb.",      amt: entry.embroidery, icon: PaintBrush },
                      { cat: "addon",      label: "Add-on",    amt: entry.addon,      icon: Tag },
                      { cat: "advance",    label: "Advance",   amt: entry.advance,    icon: Wallet },
                    ].filter(({ amt }) => amt && amt !== 0).map(({ cat, label, amt, icon: Icon }) => {
                      const key = `${rowKey(entry)}:${cat}`;
                      const code = modeCode(modes[cat] || "");
                      const isCatTallied = !!ts[cat];
                      return (
                        <div 
                          key={cat}
                          onClick={() => !updatingTally[key] && handleCategoryTallyClick(entry, cat, isCatTallied)}
                          className={cn(
                            "flex items-center justify-between gap-3 p-3 rounded-xl border border-border/50 transition-all active:scale-[0.98]",
                            isCatTallied ? "bg-success/5 border-success/20" : "bg-muted/30"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                              "p-2 rounded-lg transition-colors",
                              isCatTallied ? "bg-success/10 text-success" : "bg-background text-muted-foreground"
                            )}>
                              <Icon size={14} weight="duotone" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none mb-1">{label}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-black">₹{fmt(amt)}</span>
                                {code && <Badge variant="secondary" className="font-mono text-[8px] h-4 px-1 rounded-sm bg-background border-border/50">{code}</Badge>}
                              </div>
                            </div>
                          </div>
                          {updatingTally[key] ? (
                            <Spinner size={16} className="animate-spin text-primary" />
                          ) : (
                            <TallyIndicator isTallied={isCatTallied} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {cats.length > 1 && (
                    <Button
                      variant={allTallied ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleTallyAll(entry, !allTallied)}
                      disabled={anyUpdating}
                      className={cn(
                        "w-full h-10 font-black uppercase tracking-[0.2em] text-[10px] transition-all",
                        allTallied ? "border-success/30 text-success bg-success/5 hover:bg-success/10" : "shadow-md"
                      )}
                    >
                      {anyUpdating ? <Spinner size={14} className="animate-spin mr-2" /> : (allTallied ? <Check size={14} weight="bold" className="mr-2" /> : <Circle size={14} weight="duotone" className="mr-2" />)}
                      {allTallied ? 'Sync Reconciled' : 'Sync All Categories'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                  <SortableHeader label="Execution Date" sortKey="date" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Ref ID"        sortKey="ref"       currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Client Identity" sortKey="name"      currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Fabric</th>
                  <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Tailoring</th>
                  <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Emb.</th>
                  <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Add-on</th>
                  <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Advance</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-primary text-right cursor-pointer hover:text-primary transition-colors whitespace-nowrap" onClick={() => handleSort("total")}>
                    Total {sortKey === "total" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {(() => {
                  const rows = [];
                  let lastDate = null;

                  sorted.forEach((entry) => {
                    const ts = entry.tally_status || {};
                    const modes = entry.modes || {};

                    // Date divider
                    if (showDateDividers && entry.date !== lastDate) {
                      rows.push(
                        <tr key={`date-label-${entry.date}`} className="bg-muted/5 backdrop-blur-sm sticky top-0 z-10">
                          <td colSpan={9} className="px-4 py-2 border-y border-border/20">
                            <div className="flex items-center gap-2">
                              <CalendarCheck size={14} className="text-primary" weight="duotone" />
                              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary opacity-70">{entry.date}</span>
                            </div>
                          </td>
                        </tr>
                      );
                      lastDate = entry.date;
                    }

                    // Category cell with inline mode badge
                    const tallyCell = (cat, amount) => {
                      const key = `${rowKey(entry)}:${cat}`;
                      const code = modeCode(modes[cat] || "");
                      if (!amount) return (
                        <td key={cat} className="px-3 py-3 text-right">
                          <span className="font-mono text-xs text-muted-foreground opacity-20">—</span>
                        </td>
                      );
                      return (
                        <td key={cat} className="px-3 py-3">
                          <div className="flex items-center justify-end gap-2 group/cell">
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-xs font-black text-foreground">₹{fmt(amount)}</span>
                              {code && (
                                <Badge variant="outline" className="font-mono text-[8px] h-3.5 px-1 rounded-sm bg-background border-border/50 text-muted-foreground opacity-60">
                                  {code}
                                </Badge>
                              )}
                            </div>
                            <TallyButton
                              isTallied={ts[cat]}
                              onClick={(e) => { e.stopPropagation(); handleCategoryTallyClick(entry, cat, ts[cat]); }}
                              hasAmount={true}
                              label={cat}
                              loading={updatingTally[key]}
                            />
                          </div>
                        </td>
                      );
                    };

                    const allCodes = [...new Set(
                      activeCats(entry).map(c => modeCode(modes[c] || "")).filter(Boolean)
                    )].join("+");

                    const allTallied = allCatsTallied(entry);
                    const anyUpdating = activeCats(entry).some(c => updatingTally[`${rowKey(entry)}:${c}`]);

                    rows.push(
                      <tr key={rowKey(entry)} className="hover:bg-primary/[0.02] transition-colors group">
                        <td className="px-4 py-4">
                          <span className="font-mono text-[11px] font-black text-muted-foreground/60">{entry.date || "—"}</span>
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant="outline" className="font-mono text-[10px] font-black text-primary border-primary/20 bg-primary/5">
                            {entry.ref}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors uppercase tracking-tight">{entry.name}</span>
                        </td>
                        {tallyCell("fabric",     entry.fabric)}
                        {tallyCell("tailoring",  entry.tailoring)}
                        {tallyCell("embroidery", entry.embroidery)}
                        {tallyCell("addon",      entry.addon)}
                        {tallyCell("advance",    entry.advance)}
                        <td className="px-4 py-4 bg-primary/[0.01]">
                          <div className="flex items-center justify-end gap-2">
                            <div className="flex flex-col items-end">
                              <span className="font-mono text-sm font-black text-primary tracking-tighter">₹{fmt(entry.total)}</span>
                              {allCodes && (
                                <span className="font-mono text-[9px] font-black text-primary/40 leading-none">{allCodes}</span>
                              )}
                            </div>
                            <TallyButton
                              isTallied={allTallied}
                              onClick={(e) => { e.stopPropagation(); handleTallyAll(entry, !allTallied); }}
                              hasAmount={activeCats(entry).length > 0}
                              label="all"
                              loading={anyUpdating}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  });

                  return rows;
                })()}
              </tbody>
            </table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const todayStr = new Date().toISOString().split("T")[0];

export default function Daybook() {
  const { toast } = useToast();
  const [dateFilter, setDateFilter] = useState("All");
  const [refFilter,  setRefFilter]  = useState("All");
  const [nameFilter, setNameFilter] = useState("All");
  const [dates, setDates] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const uniqueRefs  = useMemo(() => ["All", ...Array.from(new Set(entries.map(e => e.ref).filter(Boolean))).sort()],  [entries]);
  const uniqueNames = useMemo(() => ["All", ...Array.from(new Set(entries.map(e => e.name).filter(Boolean))).sort()], [entries]);

  const loadData = useCallback(() => {
    setLoading(true);
    getDaybook({ date_filter: dateFilter === "All" ? undefined : dateFilter })
      .then(res => setEntries(res.data.entries || []))
      .catch((err) => {
        toast({ title: "Error", description: err.message || "Failed to load daybook", variant: "destructive" });
        setEntries([]);
      })
      .finally(() => setLoading(false));
  }, [dateFilter, toast]);

  const initialLoadDone = useRef(false);
  useEffect(() => {
    getDaybookDates().then(res => {
      setDates(res.data);
      if (res.data && res.data.includes(todayStr)) {
        setDateFilter(todayStr);
      } else {
        // dateFilter stays "All" — trigger first load manually since loadData won't fire
        initialLoadDone.current = true;
        loadData();
      }
    }).catch((err) => {
      toast({ title: "Error", description: err.message || "Failed to load available dates", variant: "destructive" });
      initialLoadDone.current = true;
      loadData();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!initialLoadDone.current) { initialLoadDone.current = true; return; }
    loadData();
    const handler = () => loadData();
    dataEvents.addEventListener("daybook", handler);
    return () => dataEvents.removeEventListener("daybook", handler);
  }, [loadData]);

  const handleCategoryTally = async (ref, date, category, action) => {
    await tallyEntries({ entry_ids: [ref], date, category, action });
    invalidateDaybookPendingCache();
  };

  const summaryStats = (() => {
    const visible = entries.filter(e => dateFilter === "All" || e.date === dateFilter);
    const total = visible.reduce((s, e) => s + (e.total || 0), 0);
    const byMode = {};
    visible.forEach(e => {
      ["fabric","tailoring","embroidery","addon","advance"].forEach(cat => {
        const amt = e[cat] || 0;
        if (amt > 0) {
          const raw = e.modes?.[cat] || "Unknown";
          const m = raw.replace(/^Settled\s*-?\s*/i, "").trim() || raw;
          byMode[m] = (byMode[m] || 0) + amt;
        }
      });
    });
    return { total, byMode, count: visible.length };
  })();

  return (
    <div data-testid="daybook-page" className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary truncate">Daybook</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium truncate">Daily transaction reconciliation and reconciliation engine</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => loadData()} disabled={loading} className="rounded-full shadow-sm hover:rotate-180 transition-transform duration-500">
          <ArrowsClockwise size={20} className={loading ? "animate-spin text-primary" : ""} />
        </Button>
      </div>

      {/* Date pills - quick horizontal scroll for mobile/tablet */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-1">
        <Button
          variant={dateFilter === todayStr ? "default" : "outline"}
          size="sm"
          onClick={() => setDateFilter(todayStr)}
          className={cn(
            "flex-shrink-0 h-9 px-6 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
            dateFilter === todayStr ? "shadow-lg shadow-primary/20" : "bg-card border-border/50 hover:border-primary/50"
          )}
        >
          Today
        </Button>
        {[...dates].sort().reverse().slice(0, 8).map(d => (
          <Button
            key={d}
            variant={dateFilter === d ? "default" : "outline"}
            size="sm"
            onClick={() => setDateFilter(d)}
            className={cn(
              "flex-shrink-0 h-9 px-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
              dateFilter === d ? "shadow-lg shadow-primary/20" : "bg-card border-border/50 hover:border-primary/50"
            )}
          >
            {new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </Button>
        ))}
        <Button
          variant={dateFilter === "All" ? "default" : "outline"}
          size="sm"
          onClick={() => setDateFilter("All")}
          className={cn(
            "flex-shrink-0 h-9 px-6 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
            dateFilter === "All" ? "shadow-lg shadow-primary/20" : "bg-card border-border/50 hover:border-primary/50"
          )}
        >
          Archive
        </Button>
      </div>

      {/* Summary Cards */}
      {!loading && summaryStats.count > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-primary text-primary-foreground border-none shadow-xl shadow-primary/10 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ChartBar size={64} weight="duotone" />
            </div>
            <CardContent className="p-6">
              <p className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60 leading-none mb-2">Gross Collection</p>
              <p className="font-heading text-3xl font-black tracking-tighter">₹{fmt(summaryStats.total)}</p>
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="secondary" className="bg-white/10 text-white border-none text-[9px] font-black uppercase">
                  {summaryStats.count} Operations
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-3 bg-card border-none shadow-lg shadow-black/5 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col h-full">
                <div className="px-6 py-3 border-b border-border/50 bg-muted/30">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Channel Breakdown</span>
                </div>
                <div className="flex-1 p-6 flex flex-wrap gap-8 items-center">
                  {Object.entries(summaryStats.byMode)
                    .filter(([,v]) => v > 0)
                    .sort((a,b) => b[1]-a[1])
                    .map(([mode, amt]) => (
                      <div key={mode} className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold opacity-60 leading-none mb-1">{mode}</span>
                        <span className="font-mono text-base font-black text-foreground tracking-tighter">₹{fmt(amt)}</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters Bar */}
      <Card className="bg-card border-none shadow-lg shadow-black/5 overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
        <CardContent className="p-4 flex flex-wrap gap-6 items-center">
          <div className="flex items-center gap-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Timeline</label>
            <div className="relative group">
              <select 
                data-testid="daybook-date-filter" 
                value={dateFilter} 
                onChange={e => setDateFilter(e.target.value)} 
                className="h-10 pl-4 pr-10 text-[11px] font-black uppercase tracking-widest bg-background border border-border/50 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer group-hover:border-primary/50"
              >
                <option value="All">Complete Archive</option>
                {[...dates].sort().reverse().map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Reference</label>
            <div className="relative group">
              <select 
                value={refFilter} 
                onChange={e => setRefFilter(e.target.value)} 
                className="h-10 pl-4 pr-10 text-[11px] font-black uppercase tracking-widest bg-background border border-border/50 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer group-hover:border-primary/50"
              >
                {uniqueRefs.map(r => <option key={r} value={r}>{r === "All" ? "Global Filter" : r}</option>)}
              </select>
              <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Stakeholder</label>
            <div className="relative group">
              <select 
                value={nameFilter} 
                onChange={e => setNameFilter(e.target.value)} 
                className="h-10 pl-4 pr-10 text-[11px] font-black uppercase tracking-widest bg-background border border-border/50 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer group-hover:border-primary/50"
              >
                {uniqueNames.map(n => <option key={n} value={n}>{n === "All" ? "All Customers" : n}</option>)}
              </select>
              <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div className="sm:ml-auto flex items-center gap-3 p-2 bg-muted/50 rounded-xl">
            <Info size={16} className="text-muted-foreground" weight="duotone" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {entries.length} Transaction Records
            </span>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="space-y-4">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        </div>
      ) : (
        <DaybookTable entries={entries} onCategoryTally={handleCategoryTally} loading={loading} dateFilter={dateFilter} refFilter={refFilter} nameFilter={nameFilter} />
      )}
    </div>
  );
}
