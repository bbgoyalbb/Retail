import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getJobwork, moveJobwork, getJobworkFilters } from "@/api";
import { ArrowRight, ArrowLeft, Funnel, SortAscending, SortDescending, X, PencilSimple } from "@phosphor-icons/react";
import api from "@/api";

function MoveDialog({ title, onConfirm, onCancel, fields }) {
  const [values, setValues] = useState({});
  const [skips, setSkips] = useState({});

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" data-testid="move-dialog">
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-heading text-lg font-medium">{title}</h3>
        {fields.map(f => (
          <div key={f.key}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">{f.label}</label>
              {f.skippable && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={skips[f.key] || false} onChange={e => setSkips(p => ({ ...p, [f.key]: e.target.checked }))} className="w-3 h-3 accent-[var(--brand)]" />
                  <span className="text-[10px] text-[var(--text-secondary)]">Skip</span>
                </label>
              )}
            </div>
            <input
              data-testid={`dialog-${f.key}`}
              type={f.type || "text"}
              value={values[f.key] || ""}
              onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
              disabled={skips[f.key]}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:bg-[var(--bg)] disabled:text-[var(--text-secondary)]"
              autoFocus={fields.indexOf(f) === 0}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onConfirm(values, skips); } }}
            />
          </div>
        ))}
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Cancel</button>
          <button data-testid="dialog-confirm-btn" onClick={() => onConfirm(values, skips)} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]">Confirm</button>
        </div>
      </div>
    </div>
  );
}

function StatusColumn({ title, items, color, onMove, moveLabel, onMoveBack, moveBackLabel, sortKey, onSort, sortDir, onItemDoubleClick, editableFields }) {
  const [selected, setSelected] = useState([]);

  const toggleSelect = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleMove = () => {
    if (selected.length === 0) {
      window.alert("Please select at least one item to move.");
      return;
    }
    onMove(selected);
    setSelected([]);
  };

  const handleMoveBack = () => {
    if (selected.length === 0) return;
    onMoveBack(selected);
    setSelected([]);
  };

  const handleDoubleClick = (item) => {
    if (onItemDoubleClick) {
      onItemDoubleClick(item);
    }
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm flex flex-col">
      <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">{title}</h4>
          <span className="font-mono text-xs text-[var(--text-secondary)]">({items.length})</span>
        </div>
        <div className="flex gap-1">
          {["order_no", "date", "delivery_date"].map(k => (
            <button key={k} onClick={() => onSort(k)} className={`px-1.5 py-0.5 text-[9px] uppercase rounded-sm border transition-all ${sortKey === k ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}>
              {k === "order_no" ? "Ord" : k === "date" ? "Date" : "Del"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[400px] divide-y divide-[var(--border-subtle)]">
        {items.length === 0 ? (
          <p className="p-4 text-xs text-[var(--text-secondary)] text-center">No items</p>
        ) : items.map(item => (
          <div 
            key={item.id} 
            className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${selected.includes(item.id) ? 'bg-[#C86B4D10]' : 'hover:bg-[var(--bg)]'}`} 
            onClick={() => toggleSelect(item.id)}
            onDoubleClick={() => handleDoubleClick(item)}
            title={onItemDoubleClick ? "Double-click to edit" : undefined}
          >
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={selected.includes(item.id)} readOnly className="w-3.5 h-3.5 accent-[var(--brand)]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{item.article_type}</p>
                  <div className="flex items-center gap-1">
                    <p className="font-mono text-[10px] text-[var(--text-secondary)]">#{item.order_no}</p>
                    {onItemDoubleClick && <PencilSimple size={10} className="text-[var(--text-secondary)]" />}
                  </div>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{item.name}</p>
                <div className="flex gap-3 text-[10px] text-[var(--text-secondary)] mt-0.5">
                  <span>Date: {item.date}</span>
                  <span>Del: {item.delivery_date}</span>
                </div>
                {item.karigar && item.karigar !== "N/A" && (
                  <p className="text-[10px] text-[var(--info)] mt-0.5">Karigar: {item.karigar}</p>
                )}
                {item.emb_labour_amount > 0 && (
                  <p className="text-[10px] text-[var(--success)] mt-0.5">Labour: ₹{item.emb_labour_amount}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2 p-3 border-t border-[var(--border-subtle)]">
        {moveLabel && (
          <button data-testid={`move-${title.toLowerCase().replace(/\s/g, '-')}-btn`} onClick={handleMove} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-all">
            Move {selected.length} to {moveLabel} <ArrowRight size={14} />
          </button>
        )}
        {onMoveBack && moveBackLabel && (
          <button data-testid={`moveback-${title.toLowerCase().replace(/\s/g, '-')}-btn`} onClick={handleMoveBack} disabled={selected.length === 0} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-[var(--text-secondary)] text-white rounded-sm hover:bg-[var(--text-primary)] disabled:opacity-50 transition-all">
            <ArrowLeft size={14} /> Move {selected.length} {moveBackLabel}
          </button>
        )}
      </div>
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
  const [sortKey, setSortKey] = useState("order_no");
  const [sortDir, setSortDir] = useState("asc");
  const [dialog, setDialog] = useState(null);

  const loadData = useCallback(() => {
    const params = { tab };
    if (orderFilter !== "All") params.order_no = orderFilter;
    if (dateFilter !== "All") params.date_filter = dateFilter;
    if (deliveryFilter !== "All") params.delivery_filter = deliveryFilter;
    getJobwork(params).then(res => setData(res.data)).catch(() => {});
  }, [tab, orderFilter, dateFilter, deliveryFilter]);

  useEffect(() => { getJobworkFilters().then(res => setFilters(res.data)).catch(() => {}); }, []);
  useEffect(() => { loadData(); }, [loadData]);

  const sortItems = (items) => {
    if (!items) return [];
    return [...items].sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      
      // Handle missing values
      if (va === undefined || va === null) va = "";
      if (vb === undefined || vb === null) vb = "";
      
      // Check if values are dates (YYYY-MM-DD format)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const isDateA = dateRegex.test(String(va));
      const isDateB = dateRegex.test(String(vb));
      
      if (isDateA && isDateB) {
        // Compare dates using localeCompare for proper sorting
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
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handleTailoringMove = async (itemIds, newStatus) => {
    await moveJobwork({ item_ids: itemIds, new_status: newStatus });
    loadData();
  };

  const handleTailoringMoveBack = async (itemIds, currentStatus) => {
    await api.post("/jobwork/move-back", { item_ids: itemIds, current_status: currentStatus });
    loadData();
  };

  const handleEmbMoveBack = async (itemIds, currentStatus) => {
    await api.post("/jobwork/move-back", { item_ids: itemIds, current_status: currentStatus });
    loadData();
  };

  // Embroidery: Required → In Progress needs Karigar name
  const handleEmbRequiredMove = (itemIds) => {
    setDialog({
      title: "Assign Karigar",
      fields: [{ key: "karigar", label: "Karigar Name", placeholder: "Enter karigar name", skippable: true }],
      onConfirm: async (values, skips) => {
        await moveJobwork({ item_ids: itemIds, new_status: "In Progress", karigar: skips.karigar ? undefined : (values.karigar || undefined) });
        setDialog(null);
        loadData();
      },
    });
  };

  // Double-click to edit karigar name for In Progress items
  const handleEditInProgress = (item) => {
    setDialog({
      title: "Edit Karigar",
      fields: [{ key: "karigar", label: "Karigar Name", placeholder: "Enter karigar name", skippable: true }],
      onConfirm: async (values, skips) => {
        if (!skips.karigar && values.karigar !== undefined) {
          await api.post("/jobwork/edit-emb", { item_id: item.id, karigar: values.karigar || "" });
        }
        setDialog(null);
        loadData();
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
          await api.post("/jobwork/edit-emb", updates);
        }
        setDialog(null);
        loadData();
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
        const updates = { item_ids: itemIds, new_status: "Finished" };
        if (!skips.emb_labour && values.emb_labour) updates.emb_labour_amount = parseFloat(values.emb_labour);
        if (!skips.emb_customer && values.emb_customer) updates.emb_customer_amount = parseFloat(values.emb_customer);
        await api.post("/jobwork/move-emb", updates);
        setDialog(null);
        loadData();
      },
    });
  };

  return (
    <div data-testid="jobwork-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Job Work Tracker</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Track tailoring and embroidery progress</p>
      </div>

      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        {["tailoring", "embroidery"].map(t => (
          <button key={t} data-testid={`tab-${t}`} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Funnel size={16} className="text-[var(--text-secondary)]" />
        <select value={orderFilter} onChange={e => setOrderFilter(e.target.value)} className="px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm">
          <option value="All">All Orders</option>
          {filters.order_nos?.sort().map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm">
          <option value="All">All Dates</option>
          {filters.dates?.sort().reverse().map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={deliveryFilter} onChange={e => setDeliveryFilter(e.target.value)} className="px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm">
          <option value="All">All Delivery</option>
          {filters.delivery_dates?.sort().reverse().map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {dialog && <MoveDialog title={dialog.title} fields={dialog.fields} onConfirm={dialog.onConfirm} onCancel={() => setDialog(null)} />}

      {tab === "tailoring" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusColumn 
            title="Pending" 
            items={sortItems(data.pending)} 
            color="var(--warning)" 
            moveLabel="Stitched" 
            onMove={(ids) => handleTailoringMove(ids, "Stitched")} 
            sortKey={sortKey} 
            onSort={handleSort} 
            sortDir={sortDir} 
          />
          <StatusColumn 
            title="Stitched" 
            items={sortItems(data.stitched)} 
            color="var(--info)" 
            moveLabel="Delivered" 
            onMove={(ids) => handleTailoringMove(ids, "Delivered")} 
            onMoveBack={(ids) => handleTailoringMoveBack(ids, "Stitched")}
            moveBackLabel="to Pending"
            sortKey={sortKey} 
            onSort={handleSort} 
            sortDir={sortDir} 
          />
          <StatusColumn 
            title="Delivered" 
            items={sortItems(data.delivered)} 
            color="var(--success)" 
            onMoveBack={(ids) => handleTailoringMoveBack(ids, "Delivered")}
            moveBackLabel="to Stitched"
            sortKey={sortKey} 
            onSort={handleSort} 
            sortDir={sortDir} 
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatusColumn 
            title="Required" 
            items={sortItems(data.required)} 
            color="var(--warning)" 
            moveLabel="In Progress" 
            onMove={handleEmbRequiredMove} 
            sortKey={sortKey} 
            onSort={handleSort} 
            sortDir={sortDir} 
          />
          <StatusColumn 
            title="In Progress" 
            items={sortItems(data.in_progress)} 
            color="var(--info)" 
            moveLabel="Finished" 
            onMove={handleEmbProgressMove} 
            onMoveBack={(ids) => handleEmbMoveBack(ids, "In Progress")}
            moveBackLabel="to Required"
            onItemDoubleClick={handleEditInProgress}
            sortKey={sortKey} 
            onSort={handleSort} 
            sortDir={sortDir} 
          />
          <StatusColumn 
            title="Finished" 
            items={sortItems(data.finished)} 
            color="var(--success)" 
            onMoveBack={(ids) => handleEmbMoveBack(ids, "Finished")}
            moveBackLabel="to In Progress"
            onItemDoubleClick={handleEditFinished}
            sortKey={sortKey} 
            onSort={handleSort} 
            sortDir={sortDir} 
          />
        </div>
      )}
    </div>
  );
}
