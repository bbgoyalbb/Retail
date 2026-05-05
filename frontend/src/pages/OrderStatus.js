import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { getCustomers, getOrderStatus, markOrderDelivered, updateItem, getItems, invalidateOrderStatusCache } from "@/api";
import { fmt } from "@/lib/fmt";
import { DatePickerInput } from "@/components/DatePickerInput";
import { ClipboardText, MagnifyingGlass, CheckCircle, Warning, PencilSimple, ArrowsClockwise } from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";


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
    warning: "text-[var(--warning)] border-[#D4984233] bg-[#D498420f]",
    info: "text-[var(--info)] border-[#5C8A9E33] bg-[#5C8A9E0f]",
    success: "text-[var(--success)] border-[#455D4A33] bg-[#455D4A0f]",
    muted: "text-[var(--text-secondary)] border-[var(--border-subtle)] bg-[var(--bg)]",
  };

  const fullLabel = STATUS_LABELS[label] || label;

  return (
    <span 
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${tones[tone] || tones.muted}`}
      title={fullLabel}
    >
      <span>{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </span>
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
    getCustomers().then((res) => setCustomers(res.data || [])).catch(() => setCustomers([]));
  }, []);

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
    <div data-testid="order-status-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Order Status</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Master status board grouped by order number</p>
        </div>
        <button onClick={() => { invalidateOrderStatusCache(); loadData(); }} disabled={loading} title="Refresh"
          className="p-2 rounded-sm border border-[var(--border-subtle)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50">
          <ArrowsClockwise size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {overdueOnly && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[#9E473D10] border border-[var(--error)] rounded-sm text-sm text-[var(--error)]">
          <Warning size={15} weight="fill" />
          Showing overdue orders only
          <button onClick={() => { setOverdueOnly(false); setTimeout(loadData, 0); }} className="ml-auto text-xs underline hover:opacity-80">Clear</button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm p-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Orders</p>
          <p className="font-mono text-xl mt-1">{summary.orders}</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm p-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Items</p>
          <p className="font-mono text-xl mt-1">{summary.items}</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm p-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Pending</p>
          <p className="font-mono text-xl mt-1 text-[var(--warning)]">{summary.pending}</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm p-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Stitched</p>
          <p className="font-mono text-xl mt-1 text-[var(--info)]">{summary.stitched}</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm p-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Delivered</p>
          <p className="font-mono text-xl mt-1 text-[var(--success)]">{summary.delivered}</p>
        </div>
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm p-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Total Value</p>
          <p className="font-mono text-xl mt-1">₹{fmt(summary.amount)}</p>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5 mb-1.5">
              Customer {customer && <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] inline-block" />}
            </label>
            <select value={customer} onChange={(e) => setCustomer(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
              <option value="">All Customers</option>
              {[...customers].sort().map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5 mb-1.5">
              Order No. {orderNo && <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] inline-block" />}
            </label>
            <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="Type order no" className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">From</label>
            <DatePickerInput value={fromDate} onChange={setFromDate} placeholder="From date" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">To</label>
            <DatePickerInput value={toDate} onChange={setToDate} placeholder="To date" />
          </div>
        </div>
        <div className="mt-3">
          <button data-testid="order-status-filter-btn" onClick={loadData} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] inline-flex items-center gap-1.5">
            <MagnifyingGlass size={16} /> Apply Filters
          </button>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2">
          <ClipboardText size={18} className="text-[var(--text-secondary)]" />
          <h2 className="font-heading text-base font-medium">Order Status Grid</h2>
          <span className="ml-auto text-xs text-[var(--text-secondary)]">{loading ? "Loading..." : `${rows.length} orders`}</span>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="p-4 space-y-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-10 bg-[var(--bg)] animate-pulse rounded-sm" />
            ))}
          </div>
        )}

      {/* Mobile legend */}
        <div className="md:hidden px-4 py-2 bg-[var(--bg)] border-b border-[var(--border-subtle)] flex flex-wrap gap-x-3 gap-y-1">
          {[
            ["Pnd","Pending"],["Stc","Stitched"],["Dlv","Delivered"],["Emb","Emb. In Progress"],["EFin","Emb. Finished"]
          ].map(([abbr, full]) => (
            <span key={abbr} className="text-[10px] text-[var(--text-secondary)]"><span className="font-mono font-semibold text-[var(--text-primary)]">{abbr}</span> = {full}</span>
          ))}
        </div>
      {/* Mobile card view */}
        <div className="md:hidden divide-y divide-[var(--border-subtle)]">
          {!loading && rows.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">No orders found.</p>
          )}
          {!loading && rows.map((row) => {
            const hasUndelivered = (row.tailoring_pending || 0) + (row.tailoring_stitched || 0) > 0;
            const isOverdue = hasUndelivered && row.latest_delivery_date && row.latest_delivery_date !== "N/A" && row.latest_delivery_date < today;
            return (
              <div key={row._id || row.order_no} className={`p-4 space-y-2 ${isOverdue ? "bg-[#9E473D08] border-l-2 border-l-[var(--error)]" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold">{row.order_no || "-"}</span>
                  <span className="font-mono text-xs text-[var(--brand)]">₹{fmt(row.order_total || 0)}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{(row.customers || []).join(", ") || "-"}</p>
                <div className="flex flex-wrap gap-1 text-[10px]">
                  <StatusPill label="Pnd" value={row.tailoring_pending || 0} tone="warning" />
                  <StatusPill label="Stc" value={row.tailoring_stitched || 0} tone="info" />
                  <StatusPill label="Dlv" value={row.tailoring_delivered || 0} tone="success" />
                  <StatusPill label="Emb" value={row.emb_in_progress || 0} tone="info" />
                  <StatusPill label="EFin" value={row.emb_finished || 0} tone="success" />
                </div>
                <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                  <span>Bill: {row.latest_bill_date || "-"}</span>
                  <span className={isOverdue ? "text-[var(--error)] font-medium" : ""}>Delivery: {row.latest_delivery_date && row.latest_delivery_date !== "N/A" ? row.latest_delivery_date : "-"}{isOverdue ? " ⚠" : ""}</span>
                </div>
                {hasUndelivered && (
                  <button
                    disabled={delivering === row.order_no}
                    onClick={() => handleDeliver(row.order_no)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[var(--success)] text-white rounded-sm hover:opacity-90 disabled:opacity-50">
                    <CheckCircle size={12} /> {delivering === row.order_no ? "…" : "Mark Delivered"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-[var(--border-strong)]">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="bg-[var(--bg)]">
                {[
                  "Order #",
                  "Customer(s)",
                  "Reference(s)",
                  "Items",
                  "Tailoring",
                  "Embroidery",
                  "Value",
                  "Latest Bill",
                  "Latest Delivery",
                  "Action",
                ].map((h, hi) => (
                  <th key={h} className={`text-left px-3 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--text-secondary)] ${hi === 0 ? 'sticky left-0 z-10 bg-[var(--bg)]' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">No orders found for selected filters.</td>
                </tr>
              )}

              {!loading && rows.map((row) => {
                const hasUndelivered = (row.tailoring_pending || 0) + (row.tailoring_stitched || 0) > 0;
                const isOverdue = hasUndelivered && row.latest_delivery_date && row.latest_delivery_date !== "N/A" && row.latest_delivery_date < today;
                return (
                <tr key={row._id || row.order_no} className={`border-t border-[var(--border-subtle)] align-top hover:bg-[#C86B4D06] ${isOverdue ? "bg-[#9E473D06] border-l-2 border-l-[var(--error)]" : ""}`}>
                  <td className="px-3 py-2 font-mono text-xs font-semibold sticky left-0 z-10 bg-[var(--surface)] border-r border-[var(--border-subtle)]">{row.order_no || "-"}</td>
                  <td className="px-3 py-2 text-xs">{(row.customers || []).join(", ") || "-"}</td>
                  <td className="px-3 py-2 text-xs">{(row.refs || []).join(", ") || "-"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.item_count || 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <StatusPill label="Pnd" value={row.tailoring_pending || 0} tone="warning" />
                      <StatusPill label="Stc" value={row.tailoring_stitched || 0} tone="info" />
                      <StatusPill label="Dlv" value={row.tailoring_delivered || 0} tone="success" />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <StatusPill label="Req" value={row.emb_required || 0} tone="warning" />
                      <StatusPill label="Prog" value={row.emb_in_progress || 0} tone="info" />
                      <StatusPill label="Fin" value={row.emb_finished || 0} tone="success" />
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">₹{fmt(row.order_total || 0)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.latest_bill_date || "-"}</td>
                  <td className="px-3 py-2">
                    {editingDelivery?.order_no === row.order_no ? (
                      <div className="flex items-center gap-1">
                        <div className="w-32 flex-shrink-0">
                          <DatePickerInput
                            value={editingDelivery.value}
                            onChange={v => setEditingDelivery(p => ({ ...p, value: v }))}
                            onKeyDown={e => { if (e.key === "Enter") handleSaveDeliveryDate(); if (e.key === "Escape") setEditingDelivery(null); }}
                          />
                        </div>
                        <button onClick={handleSaveDeliveryDate} disabled={savingDelivery} className="px-1.5 py-1 text-[10px] bg-[var(--brand)] text-white rounded-sm hover:opacity-90 disabled:opacity-50 whitespace-nowrap">{savingDelivery ? "…" : "Save"}</button>
                        <button onClick={() => setEditingDelivery(null)} className="px-1.5 py-1 text-[10px] border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingDelivery({ order_no: row.order_no, value: row.latest_delivery_date && row.latest_delivery_date !== "N/A" ? row.latest_delivery_date : "" })}
                        className={`group flex items-center gap-1 font-mono text-xs hover:text-[var(--brand)] transition-colors ${isOverdue ? "text-[var(--error)] font-semibold" : ""}`}
                        title="Click to edit delivery date"
                      >
                        {row.latest_delivery_date && row.latest_delivery_date !== "N/A" ? row.latest_delivery_date : "-"}{isOverdue ? " ⚠" : ""}
                        <PencilSimple size={10} className="opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {hasUndelivered && (
                      <button
                        disabled={delivering === row.order_no}
                        onClick={() => handleDeliver(row.order_no)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-[var(--success)] text-white rounded-sm hover:opacity-90 disabled:opacity-50 whitespace-nowrap">
                        <CheckCircle size={11} /> {delivering === row.order_no ? "…" : "Deliver"}
                      </button>
                    )}
                  </td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
