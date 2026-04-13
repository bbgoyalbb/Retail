import { useState, useEffect, useCallback } from "react";
import { getDaybook, getDaybookDates, tallyEntries } from "@/api";
import { Check, X, CaretDown, CaretRight } from "@phosphor-icons/react";

function SortableHeader({ label, sortKey, currentKey, dir, onSort }) {
  return (
    <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] cursor-pointer hover:text-[var(--brand)] select-none whitespace-nowrap" onClick={() => onSort(sortKey)}>
      {label} {currentKey === sortKey ? (dir === "asc" ? "↑" : "↓") : ""}
    </th>
  );
}

function DaybookSection({ title, entries, color, actionLabel, onAction, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const [selected, setSelected] = useState([]);
  const [sortKey, setSortKey] = useState("ref");
  const [sortDir, setSortDir] = useState("asc");

  const toggleSelect = (ref) => setSelected(prev => prev.includes(ref) ? prev.filter(r => r !== ref) : [...prev, ref]);
  const selectAll = () => { if (selected.length === entries.length) setSelected([]); else setSelected(entries.map(e => e.ref)); };

  const handleAction = () => { if (selected.length === 0) return; onAction(selected); setSelected([]); };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = [...entries].sort((a, b) => {
    let va = a[sortKey] || "", vb = b[sortKey] || "";
    if (typeof va === "number") { const cmp = va - vb; return sortDir === "asc" ? cmp : -cmp; }
    const cmp = String(va).localeCompare(String(vb));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const fmt = (n) => n ? new Intl.NumberFormat('en-IN').format(Math.round(n)) : "-";
  const grandTotal = entries.reduce((s, e) => s + (e.total || 0), 0);

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

  return (
    <div className="bg-white border border-[var(--border-subtle)] rounded-sm">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          {open ? <CaretDown size={14} /> : <CaretRight size={14} />}
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">{title} ({entries.length})</h3>
          <span className="font-mono text-xs text-[var(--text-secondary)]">Total: ₹{fmt(grandTotal)}</span>
        </div>
        {actionLabel && entries.length > 0 && open && (
          <button data-testid={`${actionLabel.toLowerCase()}-btn`} onClick={(e) => { e.stopPropagation(); handleAction(); }} disabled={selected.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50">
            {actionLabel === "Tally" ? <Check size={14} /> : <X size={14} />} {actionLabel} ({selected.length})
          </button>
        )}
      </div>

      {open && (
        entries.length === 0 ? (
          <p className="p-6 text-sm text-[var(--text-secondary)] text-center">No entries</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--bg)]">
                  <th className="px-3 py-2 w-10">
                    <input type="checkbox" checked={selected.length === entries.length && entries.length > 0} onChange={selectAll} className="w-3.5 h-3.5 accent-[var(--brand)]" />
                  </th>
                  <SortableHeader label="Ref" sortKey="ref" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Name" sortKey="name" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Fabric" sortKey="fabric" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Tailoring" sortKey="tailoring" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Emb." sortKey="embroidery" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Add-on" sortKey="addon" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Adv." sortKey="advance" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Total" sortKey="total" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Mode</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, i) => (
                  <tr key={i} className={`border-b border-[var(--border-subtle)] transition-colors cursor-pointer ${selected.includes(entry.ref) ? 'bg-[#C86B4D08]' : 'hover:bg-[#C86B4D05]'}`} onClick={() => toggleSelect(entry.ref)}>
                    <td className="px-3 py-2.5"><input type="checkbox" checked={selected.includes(entry.ref)} readOnly className="w-3.5 h-3.5 accent-[var(--brand)]" /></td>
                    <td className="px-3 py-2.5 font-mono text-xs">{entry.ref}</td>
                    <td className="px-3 py-2.5 text-sm">{entry.name}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-right">{entry.fabric ? fmt(entry.fabric) : "-"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-right">{entry.tailoring ? fmt(entry.tailoring) : "-"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-right">{entry.embroidery ? fmt(entry.embroidery) : "-"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-right">{entry.addon ? fmt(entry.addon) : "-"}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-right">{entry.advance ? fmt(entry.advance) : "-"}</td>
                    <td className="px-3 py-2.5 font-mono text-sm text-right font-medium">{fmt(entry.total)}</td>
                    <td className="px-3 py-2.5 text-xs text-[var(--text-secondary)]">{getModeCodes(entry.modes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

export default function Daybook() {
  const [dateFilter, setDateFilter] = useState("All");
  const [dates, setDates] = useState([]);
  const [data, setData] = useState({ pending: [], reconciled: [] });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    getDaybook({ date_filter: dateFilter === "All" ? undefined : dateFilter })
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [dateFilter]);

  useEffect(() => { getDaybookDates().then(res => setDates(res.data)).catch(() => {}); }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const handleTally = async (refs) => { await tallyEntries({ entry_ids: refs, category: "all", action: "tally" }); loadData(); };
  const handleUntally = async (refs) => { await tallyEntries({ entry_ids: refs, category: "all", action: "untally" }); loadData(); };

  return (
    <div data-testid="daybook-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight">Daybook</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Daily transaction reconciliation</p>
      </div>

      {/* Date Filter - Prominent position */}
      <div className="bg-white border border-[var(--border-subtle)] p-4 rounded-sm flex items-center gap-3">
        <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">Filter by Date</label>
        <select data-testid="daybook-date-filter" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] min-w-[180px]">
          <option value="All">All Dates</option>
          {[...dates].sort().reverse().map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className="ml-auto text-xs text-[var(--text-secondary)]">
          {data.pending.length} pending, {data.reconciled.length} reconciled
        </span>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-32 bg-white border border-[var(--border-subtle)] animate-pulse rounded-sm" />)}
        </div>
      ) : (
        <div className="space-y-4">
          <DaybookSection title="Pending" entries={data.pending} color="var(--warning)" actionLabel="Tally" onAction={handleTally} defaultOpen={true} />
          <DaybookSection title="Reconciled" entries={data.reconciled} color="var(--success)" actionLabel="Un-Tally" onAction={handleUntally} defaultOpen={false} />
        </div>
      )}
    </div>
  );
}
