import { useState, useEffect, useCallback } from "react";
import { getJobwork, moveJobwork, getJobworkFilters } from "@/api";
import { ArrowRight, Funnel } from "@phosphor-icons/react";

function StatusColumn({ title, items, color, onMove, moveLabel, showKarigarInput }) {
  const [selected, setSelected] = useState([]);
  const [karigar, setKarigar] = useState("");

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleMove = () => {
    if (selected.length === 0) return;
    onMove(selected, karigar);
    setSelected([]);
    setKarigar("");
  };

  return (
    <div className="bg-white border border-[var(--border-subtle)] rounded-sm flex flex-col">
      <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">{title}</h4>
          <span className="font-mono text-xs text-[var(--text-secondary)]">({items.length})</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto max-h-96 divide-y divide-[var(--border-subtle)]">
        {items.length === 0 ? (
          <p className="p-4 text-xs text-[var(--text-secondary)] text-center">No items</p>
        ) : items.map(item => (
          <div key={item.id} className={`px-4 py-3 text-sm cursor-pointer transition-colors ${selected.includes(item.id) ? 'bg-[#C86B4D10]' : 'hover:bg-[var(--bg)]'}`}
            onClick={() => toggleSelect(item.id)}>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={selected.includes(item.id)} readOnly className="w-3.5 h-3.5 accent-[var(--brand)]" />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-[var(--text-secondary)]">Order #{item.order_no}</p>
                <p className="text-sm font-medium truncate">{item.article_type}</p>
                <p className="text-xs text-[var(--text-secondary)]">{item.name} | {item.delivery_date}</p>
                {item.karigar && item.karigar !== "N/A" && (
                  <p className="text-xs text-[var(--info)]">Karigar: {item.karigar}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {moveLabel && (
        <div className="p-3 border-t border-[var(--border-subtle)] space-y-2">
          {showKarigarInput && (
            <input
              value={karigar}
              onChange={e => setKarigar(e.target.value)}
              placeholder="Karigar name"
              className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            />
          )}
          <button
            data-testid={`move-${title.toLowerCase().replace(/\s/g, '-')}-btn`}
            onClick={handleMove}
            disabled={selected.length === 0}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50 transition-all"
          >
            Move {selected.length} <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function JobWork() {
  const [tab, setTab] = useState("tailoring");
  const [data, setData] = useState({});
  const [filters, setFilters] = useState({ order_nos: [], dates: [], delivery_dates: [] });
  const [orderFilter, setOrderFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [deliveryFilter, setDeliveryFilter] = useState("All");

  const loadData = useCallback(() => {
    const params = { tab };
    if (orderFilter !== "All") params.order_no = orderFilter;
    if (dateFilter !== "All") params.date_filter = dateFilter;
    if (deliveryFilter !== "All") params.delivery_filter = deliveryFilter;
    getJobwork(params).then(res => setData(res.data)).catch(console.error);
  }, [tab, orderFilter, dateFilter, deliveryFilter]);

  useEffect(() => {
    getJobworkFilters().then(res => setFilters(res.data)).catch(() => {});
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleMove = async (itemIds, newStatus, karigar) => {
    try {
      await moveJobwork({ item_ids: itemIds, new_status: newStatus, karigar: karigar || undefined });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div data-testid="jobwork-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight">Job Work Tracker</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Track tailoring and embroidery progress</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        {["tailoring", "embroidery"].map(t => (
          <button
            key={t}
            data-testid={`tab-${t}`}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px
              ${tab === t ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Funnel size={16} className="text-[var(--text-secondary)]" />
        <select value={orderFilter} onChange={e => setOrderFilter(e.target.value)} className="px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm">
          <option value="All">All Orders</option>
          {filters.order_nos?.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm">
          <option value="All">All Dates</option>
          {filters.dates?.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={deliveryFilter} onChange={e => setDeliveryFilter(e.target.value)} className="px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm">
          <option value="All">All Delivery</option>
          {filters.delivery_dates?.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Kanban */}
      {tab === "tailoring" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusColumn title="Pending" items={data.pending || []} color="var(--warning)" moveLabel="Stitched" onMove={(ids) => handleMove(ids, "Stitched")} />
          <StatusColumn title="Stitched" items={data.stitched || []} color="var(--info)" moveLabel="Delivered" onMove={(ids) => handleMove(ids, "Delivered")} />
          <StatusColumn title="Delivered" items={data.delivered || []} color="var(--success)" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusColumn title="Required" items={data.required || []} color="var(--warning)" moveLabel="In Progress" showKarigarInput onMove={(ids, karigar) => handleMove(ids, "In Progress", karigar)} />
          <StatusColumn title="In Progress" items={data.in_progress || []} color="var(--info)" moveLabel="Finished" onMove={(ids) => handleMove(ids, "Finished")} />
          <StatusColumn title="Finished" items={data.finished || []} color="var(--success)" />
        </div>
      )}
    </div>
  );
}
