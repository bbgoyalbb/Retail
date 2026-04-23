import { useState, useEffect, useRef } from "react";
import { getAwaitingOrders, assignTailoring, splitTailoring, getOrders, getSettings } from "@/api";
import { Scissors, CheckCircle, SplitVertical, Plus, Trash } from "@phosphor-icons/react";

const EMB_OPTIONS = ["Not Required", "Required"];

function SplitDialog({ item, onConfirm, onCancel, articleTypes }) {
  const [splits, setSplits] = useState([{ article_type: "Shirt", qty: "" }]);
  const totalQty = item?.qty || 0;
  const usedQty = splits.reduce((s, sp) => s + (parseFloat(sp.qty) || 0), 0);
  const remaining = Math.round((totalQty - usedQty) * 100) / 100;

  const addSplit = () => setSplits(prev => [...prev, { article_type: articleTypes[1] || "Pant", qty: "" }]);
  const removeSplit = (idx) => setSplits(prev => prev.filter((_, i) => i !== idx));
  const updateSplit = (idx, field, val) => setSplits(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));

  const handleConfirm = () => {
    const valid = splits.filter(s => parseFloat(s.qty) > 0);
    if (valid.length === 0) return;
    if (Math.abs(remaining) > 0.01) return;
    onConfirm(valid.map(s => ({ ...s, qty: parseFloat(s.qty) })));
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" data-testid="split-dialog">
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm max-w-lg w-full space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="font-heading text-lg font-medium">Split Fabric</h3>
          <p className="text-sm text-[var(--text-secondary)]">Total fabric: <span className="font-mono font-medium">{totalQty}m</span> | Item: {item?.barcode}</p>
        </div>

        <div className="space-y-2">
          {splits.map((sp, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select value={sp.article_type} onChange={e => updateSplit(i, "article_type", e.target.value)} className="col-span-5 px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]">
                {articleTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="number" step="0.1" value={sp.qty} onChange={e => updateSplit(i, "qty", e.target.value)} placeholder="Qty (m)" className="col-span-6 px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (i === splits.length - 1) addSplit(); } }} />
              <button onClick={() => removeSplit(i)} disabled={splits.length <= 1} className="col-span-1 p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm disabled:opacity-30">
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={addSplit} className="flex items-center gap-1 text-xs text-[var(--brand)] hover:underline"><Plus size={14} /> Add garment</button>
          <p className={`font-mono text-sm font-medium ${Math.abs(remaining) < 0.01 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
            Remaining: {remaining.toFixed(2)}m {Math.abs(remaining) < 0.01 ? '(balanced)' : ''}
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Cancel</button>
          <button data-testid="confirm-split-btn" onClick={handleConfirm} disabled={Math.abs(remaining) > 0.01} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50">
            <Scissors size={14} className="inline mr-1" /> Confirm Split
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TailoringOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [message, setMessage] = useState(null);
  const [splitItem, setSplitItem] = useState(null);

  const [articleTypes, setArticleTypes] = useState(["Shirt", "Pant", "Gurkha Pant", "Kurta", "Pajama", "Blazer", "Safari Shirt", "Indo", "Sherwani", "Jacket", "W Coat"]);

  const loadOrders = () => {
    setLoading(true);
    getAwaitingOrders().then(res => setOrders(res.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
    getSettings().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.article_types) && s.article_types.length > 0) setArticleTypes(s.article_types);
    }).catch(() => {});
  }, []);

  const selectOrder = (order) => {
    setSelectedOrder(order);
    setAssignments(order.items.map(item => ({
      item_id: item.id, barcode: item.barcode, qty: item.qty, price: item.price,
      article_type: item.article_type !== "N/A" ? item.article_type : "Shirt",
      embroidery_status: item.embroidery_status !== "N/A" ? item.embroidery_status : "Not Required",
      order_no: "", delivery_date: "",
      selected: true, isSplit: false,
    })));
  };

  const updateAssignment = (idx, field, value) => {
    setAssignments(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const handleSplitConfirm = async (splits) => {
    const parentAssignment = assignments.find(a => a.item_id === splitItem.item_id);
    // Use item's order_no/delivery_date if set, otherwise use placeholder values for split API
    const itemOrderNo = parentAssignment?.order_no || "TEMP";
    const itemDeliveryDate = parentAssignment?.delivery_date || new Date().toISOString().split("T")[0];
    
    try {
      // Call API to split item in database
      await splitTailoring({ item_id: splitItem.item_id, order_no: itemOrderNo, delivery_date: itemDeliveryDate, splits });
      setSplitItem(null);
      
      // Reload the order to get updated items including newly created splits
      const refreshed = await getAwaitingOrders();
      const updatedOrder = refreshed.data.find(o => o.ref === selectedOrder.ref);
      if (updatedOrder) {
        // Update assignments with new data, preserving user edits for non-split items
        const newAssignments = updatedOrder.items.map(item => {
          // Check if this item was already in assignments (preserve user edits)
          const existing = assignments.find(a => a.item_id === item.id);
          if (existing && existing.item_id !== splitItem.item_id) {
            return existing; // Keep user edits
          }
          // New or updated item
          return {
            item_id: item.id,
            barcode: item.barcode,
            qty: item.qty,
            price: item.price,
            article_type: item.article_type !== "N/A" ? item.article_type : "Shirt",
            embroidery_status: item.embroidery_status !== "N/A" ? item.embroidery_status : "Not Required",
            order_no: item.order_no || "",
            delivery_date: item.delivery_date || "",
            selected: true,
            isSplit: false,
          };
        });
        setAssignments(newAssignments);
        setMessage({ type: "success", text: `Item split into ${splits.length} pieces. Fill details for all articles before assigning.` });
      }
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Split failed" });
    }
  };

  const handleAssign = async () => {
    const selected = assignments.filter(a => a.selected && !a.isSplit);
    if (selected.length === 0) { setMessage({ type: "error", text: "Select at least one item" }); return; }
    // Validate that selected items have order no and delivery date
    const missing = selected.filter(a => !a.order_no || !a.delivery_date);
    if (missing.length > 0) { setMessage({ type: "error", text: "Please provide Order No and Delivery Date for all selected items" }); return; }
    try {
      // Group by order_no and delivery_date combinations
      const orderGroups = {};
      selected.forEach(a => {
        const key = `${a.order_no}|${a.delivery_date}`;
        if (!orderGroups[key]) orderGroups[key] = { order_no: a.order_no, delivery_date: a.delivery_date, items: [] };
        orderGroups[key].items.push({ item_id: a.item_id, article_type: a.article_type, embroidery_status: a.embroidery_status });
      });
      // Assign each group
      for (const group of Object.values(orderGroups)) {
        await assignTailoring({
          item_ids: group.items.map(i => i.item_id),
          order_no: group.order_no,
          delivery_date: group.delivery_date,
          assignments: group.items,
        });
      }
      const uniqueOrders = [...new Set(selected.map(a => a.order_no))];
      setMessage({ type: "success", text: `${selected.length} items assigned to ${uniqueOrders.length} order(s)` });
      setSelectedOrder(null);
      loadOrders();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed" });
    }
  };

  return (
    <div data-testid="tailoring-orders-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Tailoring Orders</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Assign article types, split fabric, and create tailoring orders</p>
      </div>

      {message && (
        <div className={`p-4 border rounded-sm text-sm ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>{message.text}</div>
      )}

      {splitItem && (
        <SplitDialog
          item={splitItem}
          onConfirm={handleSplitConfirm}
          onCancel={() => setSplitItem(null)}
          articleTypes={articleTypes}
        />
      )}

      {!selectedOrder ? (
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm">
          <div className="p-6 border-b border-[var(--border-subtle)]">
            <h3 className="font-heading text-base font-medium">Awaiting Tailoring Orders ({orders.length})</h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[var(--text-secondary)] text-sm">All caught up! No items awaiting tailoring orders.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {orders.map((order, i) => (
                <button key={i} data-testid={`order-${order.ref}`} onClick={() => selectOrder(order)} className="w-full text-left px-6 py-4 hover:bg-[#C86B4D08] transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{order.name}</p>
                      <p className="font-mono text-xs text-[var(--text-secondary)]">{order.ref} | {order.date}</p>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-medium bg-[#D4984210] text-[var(--warning)] border border-[#D4984230] rounded-sm">{order.count} items</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <button onClick={() => { setSelectedOrder(null); setAssignments([]); }} className="text-sm text-[var(--brand)] hover:underline">&larr; Back to list</button>

          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading text-lg font-medium">{selectedOrder.name}</h3>
                <p className="font-mono text-sm text-[var(--text-secondary)]">{selectedOrder.ref}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full" data-testid="tailoring-items-table">
                <thead>
                  <tr className="bg-[var(--bg)]">
                    <th className="px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] w-10"></th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Item</th>
                    <th className="text-right px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Qty</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Order No.</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Delivery Date</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Article Type</th>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Embroidery</th>
                    <th className="text-center px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Split</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a, i) => (
                    <tr key={i} className="border-b border-[var(--border-subtle)]">
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={a.selected} onChange={e => updateAssignment(i, "selected", e.target.checked)} className="w-4 h-4 accent-[var(--brand)]" />
                      </td>
                      <td className="px-3 py-2 text-sm">{a.barcode}</td>
                      <td className="px-3 py-2 font-mono text-sm text-right">{a.qty}m</td>
                      <td className="px-3 py-2">
                        <input type="text" value={a.order_no} onChange={e => updateAssignment(i, "order_no", e.target.value)} placeholder="e.g. 801" className="w-24 px-2 py-1 text-sm border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="date" value={a.delivery_date} onChange={e => updateAssignment(i, "delivery_date", e.target.value)} className="w-32 px-2 py-1 text-sm border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
                      </td>
                      <td className="px-3 py-2">
                        <select value={a.article_type} onChange={e => updateAssignment(i, "article_type", e.target.value)} className="px-2 py-1 text-sm border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]">
                          {articleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select value={a.embroidery_status} onChange={e => updateAssignment(i, "embroidery_status", e.target.value)} className="px-2 py-1 text-sm border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]">
                          {EMB_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button data-testid={`split-btn-${i}`} onClick={() => setSplitItem(a)} className="p-1.5 text-[var(--brand)] hover:bg-[#C86B4D10] rounded-sm" title="Split into multiple garments">
                          <SplitVertical size={16} />
                        </button>
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
