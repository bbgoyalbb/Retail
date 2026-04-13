import { useState, useEffect } from "react";
import { getAwaitingOrders, assignTailoring } from "@/api";
import { Scissors, CheckCircle } from "@phosphor-icons/react";

const ARTICLE_TYPES = ["Shirt", "Pant", "Gurkha Pant", "Kurta", "Pajama", "Blazer", "Safari Shirt", "Indo", "Sherwani", "Jacket", "W Coat"];
const EMB_OPTIONS = ["Not Required", "Required"];

export default function TailoringOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [orderNo, setOrderNo] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [message, setMessage] = useState(null);

  const loadOrders = () => {
    setLoading(true);
    getAwaitingOrders()
      .then(res => setOrders(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadOrders(); }, []);

  const selectOrder = (order) => {
    setSelectedOrder(order);
    setAssignments(order.items.map(item => ({
      item_id: item.id,
      barcode: item.barcode,
      qty: item.qty,
      price: item.price,
      article_type: item.article_type !== "N/A" ? item.article_type : "Shirt",
      embroidery_status: item.embroidery_status !== "N/A" ? item.embroidery_status : "Not Required",
      selected: true,
    })));
  };

  const updateAssignment = (idx, field, value) => {
    setAssignments(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const handleAssign = async () => {
    if (!orderNo || !deliveryDate) {
      setMessage({ type: "error", text: "Please provide Order No and Delivery Date" });
      return;
    }
    const selected = assignments.filter(a => a.selected);
    if (selected.length === 0) {
      setMessage({ type: "error", text: "Please select at least one item" });
      return;
    }
    try {
      await assignTailoring({
        item_ids: selected.map(a => a.item_id),
        order_no: orderNo,
        delivery_date: deliveryDate,
        assignments: selected.map(a => ({
          item_id: a.item_id,
          article_type: a.article_type,
          embroidery_status: a.embroidery_status,
        })),
      });
      setMessage({ type: "success", text: `${selected.length} items assigned to order ${orderNo}` });
      setSelectedOrder(null);
      setAssignments([]);
      setOrderNo("");
      setDeliveryDate("");
      loadOrders();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to assign" });
    }
  };

  return (
    <div data-testid="tailoring-orders-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight">Tailoring Orders</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Assign article types and order details to awaiting items</p>
      </div>

      {message && (
        <div className={`p-4 border rounded-sm text-sm ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          {message.text}
        </div>
      )}

      {!selectedOrder ? (
        <div className="bg-white border border-[var(--border-subtle)] rounded-sm">
          <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <h3 className="font-heading text-base font-medium">Awaiting Tailoring Orders ({orders.length})</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center">
              <pre className="text-[var(--border-strong)] text-xs mb-4 font-mono">
{`    ___
   /   \\
  | --- |
  | ___ |
   \\___/
  No pending
   orders`}
              </pre>
              <p className="text-[var(--text-secondary)] text-sm">All caught up! No items awaiting tailoring orders.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {orders.map((order, i) => (
                <button
                  key={i}
                  data-testid={`order-${order.ref}`}
                  onClick={() => selectOrder(order)}
                  className="w-full text-left px-6 py-4 hover:bg-[#C86B4D08] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{order.name}</p>
                      <p className="font-mono text-xs text-[var(--text-secondary)]">{order.ref} | {order.date}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[var(--warning)]10 text-[var(--warning)] border border-[var(--warning)]30 rounded-sm">
                      {order.count} items
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <button onClick={() => { setSelectedOrder(null); setAssignments([]); }} className="text-sm text-[var(--brand)] hover:underline">
            &larr; Back to list
          </button>

          <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-lg font-medium">{selectedOrder.name}</h3>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{selectedOrder.ref}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Order No.</label>
                <input data-testid="order-no-input" value={orderNo} onChange={e => setOrderNo(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" placeholder="e.g. 801" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Delivery Date</label>
                <input data-testid="delivery-date-input" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full" data-testid="tailoring-items-table">
                <thead>
                  <tr className="bg-[var(--bg)]">
                    <th className="px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] w-10"></th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Item</th>
                    <th className="text-right px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Qty</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Article Type</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Embroidery</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a, i) => (
                    <tr key={i} className="border-b border-[var(--border-subtle)]">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={a.selected} onChange={e => updateAssignment(i, "selected", e.target.checked)} className="w-4 h-4 accent-[var(--brand)]" />
                      </td>
                      <td className="px-3 py-2 text-sm">{a.barcode}</td>
                      <td className="px-3 py-2 font-mono text-sm text-right">{a.qty}</td>
                      <td className="px-3 py-2">
                        <select value={a.article_type} onChange={e => updateAssignment(i, "article_type", e.target.value)} className="px-2 py-1 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                          {ARTICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select value={a.embroidery_status} onChange={e => updateAssignment(i, "embroidery_status", e.target.value)} className="px-2 py-1 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                          {EMB_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button data-testid="assign-order-btn" onClick={handleAssign} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-all duration-200 hover:translate-y-[-1px]">
              <CheckCircle size={18} weight="bold" /> Assign Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
