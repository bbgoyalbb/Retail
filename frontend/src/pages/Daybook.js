import { useState, useEffect, useCallback } from "react";
import { getDaybook, getDaybookDates, tallyEntries } from "@/api";
import { Check, Circle, Spinner } from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";

function SortableHeader({ label, sortKey, currentKey, dir, onSort }) {
  return (
    <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] cursor-pointer hover:text-[var(--brand)] select-none whitespace-nowrap" onClick={() => onSort(sortKey)}>
      {label} {currentKey === sortKey ? (dir === "asc" ? "↑" : "↓") : ""}
    </th>
  );
}

// Category tally button component
function TallyButton({ isTallied, onClick, hasAmount, label, loading }) {
  if (!hasAmount) return <span className="w-6 h-6 inline-block" />;
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
        isTallied 
          ? 'bg-[var(--success)] text-white hover:opacity-80' 
          : 'bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border-strong)]'
      } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
      title={isTallied ? `Un-tally ${label}` : `Tally ${label}`}
    >
      {loading ? <Spinner size={14} className="animate-spin" /> : (isTallied ? <Check size={14} weight="bold" /> : <Circle size={14} />)}
    </button>
  );
}

function DaybookTable({ entries, onCategoryTally, loading }) {
  const { toast } = useToast();
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [viewMode, setViewMode] = useState("pending"); // "pending" | "tallied"
  // Track optimistic tally updates for instant UI feedback
  const [localEntries, setLocalEntries] = useState(entries);
  const [updatingTally, setUpdatingTally] = useState({}); // { "ref:category": true }

  // Sync local entries when props change
  useEffect(() => { setLocalEntries(entries); }, [entries]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const fmt = (n) => n ? new Intl.NumberFormat('en-IN').format(Math.round(n)) : "-";
  
  // Helper to check if entry is fully tallied
  const isFullyTallied = (entry) => {
    const tallyStatus = entry.tally_status || {};
    const hasFabric = (entry.fabric || 0) > 0;
    const hasTailoring = (entry.tailoring || 0) > 0;
    const hasEmbroidery = (entry.embroidery || 0) > 0;
    const hasAddon = (entry.addon || 0) > 0;
    const hasAdvance = (entry.advance || 0) !== 0;
    
    if (hasFabric && !tallyStatus.fabric) return false;
    if (hasTailoring && !tallyStatus.tailoring) return false;
    if (hasEmbroidery && !tallyStatus.embroidery) return false;
    if (hasAddon && !tallyStatus.addon) return false;
    if (hasAdvance && !tallyStatus.advance) return false;
    return true;
  };
  
  // Filter entries based on view mode
  const visibleEntries = localEntries.filter(entry => {
    const fullyTallied = isFullyTallied(entry);
    if (viewMode === "pending") return !fullyTallied;
    return fullyTallied;
  });
  
  const grandTotal = visibleEntries.reduce((s, e) => s + (e.total || 0), 0);
  
  const sorted = [...visibleEntries].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    
    // Handle missing values
    if (va === undefined || va === null) va = "";
    if (vb === undefined || vb === null) vb = "";
    
    // For date field, use pay_dates if available (take first date for sorting)
    if (sortKey === "date") {
      const payDatesA = a.pay_dates || [];
      const payDatesB = b.pay_dates || [];
      va = payDatesA.length > 0 ? payDatesA[0] : (a.date || "");
      vb = payDatesB.length > 0 ? payDatesB[0] : (b.date || "");
    }
    
    // Check if values are dates (YYYY-MM-DD format)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const isDateA = dateRegex.test(String(va));
    const isDateB = dateRegex.test(String(vb));
    
    if (isDateA && isDateB) {
      // Compare as dates (reverse for desc)
      const cmp = String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    }
    
    // Check if numeric
    if (typeof va === "number" && typeof vb === "number") {
      const cmp = va - vb;
      return sortDir === "asc" ? cmp : -cmp;
    }
    
    // Default string comparison
    const cmp = String(va).localeCompare(String(vb));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const getModeCodes = (modes) => {
    if (!modes) return "";
    const all = Object.values(modes).join(" ").toUpperCase();
    const codes = [];
    if (all.includes("CASH")) codes.push("C");
    if (all.includes("PHONEPE")) codes.push("P");
    if (all.includes("[E]")) codes.push("E");
    if (all.includes("[S]")) codes.push("S");
    if (all.includes("BANK") || all.includes("TRANSFER")) codes.push("B");
    return codes.length > 0 ? `[${codes.join("+")}]` : "";
  };

  const handleCategoryTallyClick = async (ref, category, isTallied) => {
    const action = isTallied ? "untally" : "tally";
    const tallyKey = `${ref}:${category}`;
    
    // Optimistically update UI immediately
    setLocalEntries(prev => prev.map(entry => {
      if (entry.ref === ref) {
        return {
          ...entry,
          tally_status: {
            ...entry.tally_status,
            [category]: !isTallied
          }
        };
      }
      return entry;
    }));
    
    // Track loading state
    setUpdatingTally(prev => ({ ...prev, [tallyKey]: true }));
    
    try {
      await onCategoryTally(ref, category, action);
    } catch (err) {
      // Revert optimistic update on error
      setLocalEntries(prev => prev.map(entry => {
        if (entry.ref === ref) {
          return {
            ...entry,
            tally_status: {
              ...entry.tally_status,
              [category]: isTallied
            }
          };
        }
        return entry;
      }));
      toast({ title: "Tally failed", description: err.message || "Could not update tally. Please try again.", variant: "destructive" });
    } finally {
      setUpdatingTally(prev => ({ ...prev, [tallyKey]: false }));
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">
            {viewMode === "pending" ? "Pending" : "Tallied"} ({visibleEntries.length})
          </h3>
          <span className="font-mono text-xs text-[var(--text-secondary)]">Total: ₹{fmt(grandTotal)}</span>
        </div>
        <div className="flex items-center gap-1 bg-[var(--bg)] rounded-sm p-0.5">
          <button
            onClick={() => setViewMode("pending")}
            className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
              viewMode === "pending" 
                ? 'bg-[var(--surface)] text-[var(--brand)] shadow-sm' 
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setViewMode("tallied")}
            className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
              viewMode === "tallied" 
                ? 'bg-[var(--surface)] text-[var(--brand)] shadow-sm' 
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Tallied
          </button>
        </div>
      </div>

      {visibleEntries.length === 0 ? (
        <p className="p-6 text-sm text-[var(--text-secondary)] text-center">No entries</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--bg)]">
                <SortableHeader label="Ref" sortKey="ref" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="Date" sortKey="date" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="Name" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Fabric</th>
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Tailoring</th>
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Emb.</th>
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Add-on</th>
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Adv.</th>
                <SortableHeader label="Total" sortKey="total" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Mode</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, i) => {
                const tallyStatus = entry.tally_status || {};
                const fabricKey = `${entry.ref}:fabric`;
                const tailoringKey = `${entry.ref}:tailoring`;
                const embroideryKey = `${entry.ref}:embroidery`;
                const addonKey = `${entry.ref}:addon`;
                const advanceKey = `${entry.ref}:advance`;
                return (
                  <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[#C86B4D05]">
                    <td className="px-3 py-2.5 font-mono text-xs">{entry.ref}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {entry.pay_dates && entry.pay_dates.length > 0 
                        ? entry.pay_dates.sort().join(", ") 
                        : (entry.date || "-")}
                    </td>
                    <td className="px-3 py-2.5 text-sm">{entry.name}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{entry.fabric ? fmt(entry.fabric) : "-"}</span>
                        {entry.fabric > 0 && (
                          <TallyButton 
                            isTallied={tallyStatus.fabric} 
                            onClick={(e) => { e.stopPropagation(); handleCategoryTallyClick(entry.ref, "fabric", tallyStatus.fabric); }}
                            hasAmount={entry.fabric > 0}
                            label="Fabric"
                            loading={updatingTally[fabricKey]}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{entry.tailoring ? fmt(entry.tailoring) : "-"}</span>
                        {entry.tailoring > 0 && (
                          <TallyButton 
                            isTallied={tallyStatus.tailoring} 
                            onClick={(e) => { e.stopPropagation(); handleCategoryTallyClick(entry.ref, "tailoring", tallyStatus.tailoring); }}
                            hasAmount={entry.tailoring > 0}
                            label="Tailoring"
                            loading={updatingTally[tailoringKey]}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{entry.embroidery ? fmt(entry.embroidery) : "-"}</span>
                        {entry.embroidery > 0 && (
                          <TallyButton 
                            isTallied={tallyStatus.embroidery} 
                            onClick={(e) => { e.stopPropagation(); handleCategoryTallyClick(entry.ref, "embroidery", tallyStatus.embroidery); }}
                            hasAmount={entry.embroidery > 0}
                            label="Embroidery"
                            loading={updatingTally[embroideryKey]}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{entry.addon ? fmt(entry.addon) : "-"}</span>
                        {entry.addon > 0 && (
                          <TallyButton 
                            isTallied={tallyStatus.addon} 
                            onClick={(e) => { e.stopPropagation(); handleCategoryTallyClick(entry.ref, "addon", tallyStatus.addon); }}
                            hasAmount={entry.addon > 0}
                            label="Add-on"
                            loading={updatingTally[addonKey]}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{entry.advance ? fmt(entry.advance) : "-"}</span>
                        {entry.advance !== 0 && (
                          <TallyButton 
                            isTallied={tallyStatus.advance} 
                            onClick={(e) => { e.stopPropagation(); handleCategoryTallyClick(entry.ref, "advance", tallyStatus.advance); }}
                            hasAmount={entry.advance !== 0}
                            label="Advance"
                            loading={updatingTally[advanceKey]}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-sm text-right font-medium">{fmt(entry.total)}</td>
                    <td className="px-2 py-2.5 text-xs text-[var(--text-secondary)]">{getModeCodes(entry.modes)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Daybook() {
  const [dateFilter, setDateFilter] = useState("All");
  const [dates, setDates] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    getDaybook({ date_filter: dateFilter === "All" ? undefined : dateFilter })
      .then(res => setEntries(res.data.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateFilter]);

  useEffect(() => { getDaybookDates().then(res => setDates(res.data)).catch(() => {}); }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const handleCategoryTally = async (ref, category, action) => {
    // API call happens inside DaybookTable with optimistic updates
    // No page refresh - UI updates instantly via local state
    await tallyEntries({ entry_ids: [ref], category, action });
  };

  return (
    <div data-testid="daybook-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Daybook</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Daily transaction reconciliation</p>
      </div>

      {/* Date Filter - Prominent position */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-4 rounded-sm flex flex-wrap items-center gap-3">
        <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">Filter by Date</label>
        <select data-testid="daybook-date-filter" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="flex-1 min-w-[150px] px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
          <option value="All">All Dates</option>
          {[...dates].sort().reverse().map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="ml-auto text-xs text-[var(--text-secondary)]">
          {entries.length} entries
        </span>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-32 bg-[var(--surface)] border border-[var(--border-subtle)] animate-pulse rounded-sm" />)}
        </div>
      ) : (
        <DaybookTable entries={entries} onCategoryTally={handleCategoryTally} loading={loading} />
      )}
    </div>
  );
}
