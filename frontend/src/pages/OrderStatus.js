import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { getCustomers, getOrderStatus, markOrderDelivered } from "@/api";
import { fmt } from "@/lib/fmt";
import { ClipboardText, MagnifyingGlass, CheckCircle } from "@phosphor-icons/react";


function StatusPill({ label, value, tone }) {
  const tones = {
    warning: "text-[var(--warning)] border-[#D4984233] bg-[#D498420f]",
    info: "text-[var(--info)] border-[#5C8A9E33] bg-[#5C8A9E0f]",
    success: "text-[var(--success)] border-[#455D4A33] bg-[#455D4A0f]",
    muted: "text-[var(--text-secondary)] border-[var(--border-subtle)] bg-[var(--bg)]",
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${tones[tone] || tones.muted}`}>
      <span>{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </span>
  );
}

const TODAY = new Date().toISOString().split("T")[0];

export default function OrderStatus() {
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [delivering, setDelivering] = useState(null);
  const [message, setMessage] = useState(null);

  // Keep a ref to the latest filter values so loadData is stable
  const filtersRef = useRef({ customer, orderNo, fromDate, toDate });
  useEffect(() => { filtersRef.current = { customer, orderNo, fromDate, toDate }; }, [customer, orderNo, fromDate, toDate]);

  const loadData = useCallback(async () => {
    const { customer, orderNo, fromDate, toDate } = filtersRef.current;
    setLoading(true);
    try {
      const params = { limit: 400 };
      if (customer) params.customer = customer;
      if (orderNo) params.order_no = orderNo;
      if (fromDate) params.date_from = fromDate;
      if (toDate) params.date_to = toDate;

      const res = await getOrderStatus(params);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setRows([]);
      setMessage({ type: "error", text: err.response?.data?.detail || err.message || "Failed to load orders" });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setLoading(false);
    }
  }, []); // stable — reads from ref

  useEffect(() => {
    getCustomers().then((res) => setCustomers(res.data || [])).catch(() => setCustomers([]));
  }, []);

  // Only load on mount; user clicks Apply to filter
  useEffect(() => { loadData(); }, [loadData]);

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
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Order Status</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Master status board grouped by order number</p>
      </div>

      {message && (
        <div className={`p-3 border rounded-sm text-sm ${
          message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'
        }`}>{message.text}</div>
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
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Customer</label>
            <select value={customer} onChange={(e) => setCustomer(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
              <option value="">All Customers</option>
              {[...customers].sort().map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Order No.</label>
            <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="Type order no" className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">To</label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm" />
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

      {/* Mobile card view */}
        <div className="md:hidden divide-y divide-[var(--border-subtle)]">
          {!loading && rows.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">No orders found.</p>
          )}
          {!loading && rows.map((row) => {
            const hasUndelivered = (row.tailoring_pending || 0) + (row.tailoring_stitched || 0) > 0;
            const isOverdue = hasUndelivered && row.latest_delivery_date && row.latest_delivery_date !== "N/A" && row.latest_delivery_date < TODAY;
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
                    onClick={async () => {
                      setDelivering(row.order_no);
                      try {
                        await markOrderDelivered(row.order_no);
                        setMessage({ type: "success", text: `Order ${row.order_no} marked as Delivered` });
                        setTimeout(() => setMessage(null), 3000);
                        loadData();
                      } catch (err) {
                        setMessage({ type: "error", text: err.message || "Failed" });
                        setTimeout(() => setMessage(null), 3000);
                      } finally { setDelivering(null); }
                    }}
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
                const isOverdue = hasUndelivered && row.latest_delivery_date && row.latest_delivery_date !== "N/A" && row.latest_delivery_date < TODAY;
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
                  <td className={`px-3 py-2 font-mono text-xs ${isOverdue ? "text-[var(--error)] font-semibold" : ""}`}>{row.latest_delivery_date && row.latest_delivery_date !== "N/A" ? row.latest_delivery_date : "-"}{isOverdue ? " ⚠" : ""}</td>
                  <td className="px-3 py-2">
                    {hasUndelivered && (
                      <button
                        disabled={delivering === row.order_no}
                        onClick={async () => {
                          setDelivering(row.order_no);
                          try {
                            await markOrderDelivered(row.order_no);
                            setMessage({ type: "success", text: `Order ${row.order_no} marked as Delivered` });
                            setTimeout(() => setMessage(null), 3000);
                            loadData();
                          } catch (err) {
                            setMessage({ type: "error", text: err.message || "Failed" });
                            setTimeout(() => setMessage(null), 3000);
                          } finally { setDelivering(null); }
                        }}
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
