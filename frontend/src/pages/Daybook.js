import { useState, useEffect, useCallback } from "react";
import { getDaybook, getDaybookDates, tallyEntries } from "@/api";
import { fmt } from "@/lib/fmt";
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
  if (!hasAmount) return <span className="w-6 h-6 sm:w-6 sm:h-6 w-11 h-11 inline-block" />;
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-colors ${
        isTallied
          ? 'bg-[var(--success)] text-white hover:opacity-80'
          : 'bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border-strong)]'
      } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
      title={isTallied ? `Un-tally ${label}` : `Tally ${label}`}
      aria-label={isTallied ? `Un-tally ${label}` : `Tally ${label}`}
    >
      {loading ? <Spinner size={14} className="animate-spin" /> : (isTallied ? <Check size={14} weight="bold" /> : <Circle size={14} />)}
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

  const visibleEntries = localEntries.filter(entry => {
    if (refFilter  !== "All" && entry.ref  !== refFilter)  return false;
    if (nameFilter !== "All" && entry.name !== nameFilter) return false;
    return viewMode === "pending" ? !isFullyTallied(entry) : isFullyTallied(entry);
  });

  const grandTotal = visibleEntries.reduce((s, e) => s + (e.total || 0), 0);

  const sorted = [...visibleEntries].sort((a, b) => {
    let va = a[sortKey] ?? "";
    let vb = b[sortKey] ?? "";
    if (typeof va === "number" && typeof vb === "number") {
      return sortDir === "asc" ? va - vb : vb - va;
    }
    const cmp = String(va).localeCompare(String(vb));
    return sortDir === "asc" ? cmp : -cmp;
  });

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
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">
            {viewMode === "pending" ? "Pending" : "Tallied"} ({visibleEntries.length})
          </h3>
          <span className="font-mono text-xs text-[var(--text-secondary)]">Total: ₹{fmt(grandTotal)}</span>
        </div>
        <div className="flex items-center gap-1 bg-[var(--bg)] rounded-sm p-0.5">
          {["pending", "tallied"].map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors capitalize ${
                viewMode === mode
                  ? 'bg-[var(--surface)] text-[var(--brand)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}>
              {mode}
            </button>
          ))}
        </div>
      </div>

      {visibleEntries.length === 0 ? (
        <p className="p-6 text-sm text-[var(--text-secondary)] text-center">No entries</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="bg-[var(--bg)]">
                <SortableHeader label="Date"      sortKey="date"      currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="Ref"       sortKey="ref"       currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHeader label="Name"      sortKey="name"      currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <th className="px-2 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] text-right">Fabric</th>
                <th className="px-2 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] text-right">Tailoring</th>
                <th className="px-2 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] text-right">Emb.</th>
                <th className="px-2 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] text-right">Add-on</th>
                <th className="px-2 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] text-right">Adv.</th>
                <th className="px-2 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const rows = [];
                let lastDate = null;

                sorted.forEach((entry) => {
                  const ts = entry.tally_status || {};
                  const modes = entry.modes || {};

                  // Date divider
                  if (showDateDividers && entry.date !== lastDate) {
                    if (lastDate !== null) {
                      rows.push(
                        <tr key={`divider-${entry.date}`}>
                          <td colSpan={9} className="px-0 py-0">
                            <div className="h-px bg-[var(--border-subtle)] opacity-60 mx-3" />
                          </td>
                        </tr>
                      );
                    }
                    rows.push(
                      <tr key={`date-label-${entry.date}`} className="bg-[var(--bg)]">
                        <td colSpan={9} className="px-3 py-1.5">
                          <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">{entry.date}</span>
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
                      <td key={cat} className="px-2 py-2.5 text-right">
                        <span className="font-mono text-xs text-[var(--text-secondary)]">-</span>
                      </td>
                    );
                    return (
                      <td key={cat} className="px-2 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-mono text-xs">{fmt(amount)}</span>
                          {code && (
                            <span className="font-mono text-[9px] text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm px-1 py-px leading-none">{code}</span>
                          )}
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

                  // Build unique mode codes across all active categories for Total cell
                  const allCodes = [...new Set(
                    activeCats(entry).map(c => modeCode(modes[c] || "")).filter(Boolean)
                  )].join("+");

                  const allTallied = allCatsTallied(entry);
                  const anyUpdating = activeCats(entry).some(c => updatingTally[`${rowKey(entry)}:${c}`]);

                  rows.push(
                    <tr key={rowKey(entry)} className="border-b border-[var(--border-subtle)] hover:bg-[#C86B4D05]">
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{entry.date || "-"}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-[var(--brand)] font-medium">{entry.ref}</td>
                      <td className="px-3 py-2.5 text-sm">{entry.name}</td>
                      {tallyCell("fabric",     entry.fabric)}
                      {tallyCell("tailoring",  entry.tailoring)}
                      {tallyCell("embroidery", entry.embroidery)}
                      {tallyCell("addon",      entry.addon)}
                      {tallyCell("advance",    entry.advance)}
                      <td className="px-2 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-mono text-sm font-semibold">{fmt(entry.total)}</span>
                          {allCodes && (
                            <span className="font-mono text-[9px] text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm px-1 py-px leading-none">{allCodes}</span>
                          )}
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
      )}
    </div>
  );
}

export default function Daybook() {
  const [dateFilter, setDateFilter] = useState("All");
  const [refFilter,  setRefFilter]  = useState("All");
  const [nameFilter, setNameFilter] = useState("All");
  const [dates, setDates] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const uniqueRefs  = ["All", ...Array.from(new Set(entries.map(e => e.ref).filter(Boolean))).sort()];
  const uniqueNames = ["All", ...Array.from(new Set(entries.map(e => e.name).filter(Boolean))).sort()];

  const loadData = useCallback(() => {
    setLoading(true);
    getDaybook({ date_filter: dateFilter === "All" ? undefined : dateFilter })
      .then(res => setEntries(res.data.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateFilter]);

  useEffect(() => { getDaybookDates().then(res => setDates(res.data)).catch(() => {}); }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const handleCategoryTally = async (ref, date, category, action) => {
    await tallyEntries({ entry_ids: [ref], date, category, action });
  };

  return (
    <div data-testid="daybook-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Daybook</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Daily transaction reconciliation</p>
      </div>

      {/* Filters */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-4 rounded-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Date</label>
          <select data-testid="daybook-date-filter" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="min-w-[130px] px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
            <option value="All">All Dates</option>
            {[...dates].sort().reverse().map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Ref</label>
          <select value={refFilter} onChange={e => setRefFilter(e.target.value)} className="min-w-[130px] px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
            {uniqueRefs.map(r => <option key={r} value={r}>{r === "All" ? "All Refs" : r}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Customer</label>
          <select value={nameFilter} onChange={e => setNameFilter(e.target.value)} className="min-w-[150px] px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
            {uniqueNames.map(n => <option key={n} value={n}>{n === "All" ? "All Customers" : n}</option>)}
          </select>
        </div>
        <span className="ml-auto text-xs text-[var(--text-secondary)]">
          {entries.length} entries
        </span>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-32 bg-[var(--surface)] border border-[var(--border-subtle)] animate-pulse rounded-sm" />)}
        </div>
      ) : (
        <DaybookTable entries={entries} onCategoryTally={handleCategoryTally} loading={loading} dateFilter={dateFilter} refFilter={refFilter} nameFilter={nameFilter} />
      )}
    </div>
  );
}
