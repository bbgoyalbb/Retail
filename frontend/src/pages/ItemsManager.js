import { useState, useEffect, useCallback } from "react";
import { getItems, getCustomers, updateItem, deleteItem, getInvoiceUrl } from "@/api";
import { PencilSimple, Trash, FloppyDisk, X, FilePdf, CaretDown, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";

export default function ItemsManager() {
  const [allItems, setAllItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [nameFilter, setNameFilter] = useState("");
  const [orderFilter, setOrderFilter] = useState("");
  const [expanded, setExpanded] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [message, setMessage] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => { getCustomers().then(res => setCustomers(res.data)).catch(() => {}); }, []);

  const loadItems = useCallback(() => {
    const params = { limit: 2000 };
    if (nameFilter) params.name = nameFilter;
    getItems(params).then(res => setAllItems(res.data.items)).catch(console.error);
  }, [nameFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Group items by reference
  const grouped = {};
  allItems.forEach(item => {
    if (orderFilter && item.order_no !== orderFilter && item.order_no !== "N/A") {
      if (item.order_no !== orderFilter) return;
    }
    if (orderFilter && item.order_no !== orderFilter) return;
    const ref = item.ref;
    if (!grouped[ref]) grouped[ref] = { ref, name: item.name, date: item.date, items: [], totals: { fabric: 0, tailoring: 0, embroidery: 0, addon: 0 } };
    grouped[ref].items.push(item);
    grouped[ref].totals.fabric += item.fabric_amount || 0;
    grouped[ref].totals.tailoring += item.tailoring_amount || 0;
    grouped[ref].totals.embroidery += item.embroidery_amount || 0;
    grouped[ref].totals.addon += item.addon_amount || 0;
  });

  const refs = Object.values(grouped).sort((a, b) => {
    const va = a[sortKey] || ""; const vb = b[sortKey] || "";
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === "desc" ? -cmp : cmp;
  });

  const orderNos = [...new Set(allItems.map(i => i.order_no).filter(o => o && o !== "N/A"))].sort();

  const toggleExpand = (ref) => setExpanded(prev => ({ ...prev, [ref]: !prev[ref] }));
  const startEdit = (item) => { setEditingId(item.id); setEditData({ ...item }); };
  const cancelEdit = () => { setEditingId(null); setEditData({}); };

  const saveEdit = async () => {
    try {
      await updateItem(editingId, editData);
      setMessage({ type: "success", text: "Item updated" });
      setEditingId(null);
      loadItems();
    } catch (err) { setMessage({ type: "error", text: "Failed to update" }); }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async (id) => {
    try {
      await deleteItem(id);
      setMessage({ type: "success", text: "Item deleted" });
      setDelConfirm(null);
      loadItems();
    } catch (err) { setMessage({ type: "error", text: "Failed" }); }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const fmt = (n) => n ? new Intl.NumberFormat('en-IN').format(Math.round(n)) : "-";

  return (
    <div data-testid="items-manager-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight">Manage Orders</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">View, edit and manage all orders grouped by reference</p>
      </div>

      {message && (
        <div className={`p-3 border rounded-sm text-sm ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>{message.text}</div>
      )}

      {/* Filters */}
      <div className="bg-white border border-[var(--border-subtle)] p-4 rounded-sm flex flex-wrap gap-3 items-center">
        <select data-testid="orders-customer-filter" value={nameFilter} onChange={e => setNameFilter(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
          <option value="">All Customers</option>
          {customers.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select data-testid="orders-order-filter" value={orderFilter} onChange={e => setOrderFilter(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
          <option value="">All Order Nos</option>
          {orderNos.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="ml-auto text-xs text-[var(--text-secondary)]">{refs.length} references, {allItems.length} items</span>
      </div>

      {/* Delete Confirmation */}
      {delConfirm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setDelConfirm(null)}>
          <div data-testid="delete-confirm-modal" className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-medium mb-2">Delete Item?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">Item: <span className="font-mono">{delConfirm.barcode}</span></p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelConfirm(null)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm">Cancel</button>
              <button data-testid="confirm-delete-btn" onClick={() => handleDelete(delConfirm.id)} className="px-4 py-2 text-sm bg-[var(--error)] text-white rounded-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Grouped References */}
      <div className="space-y-2">
        {/* Header row */}
        <div className="bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm px-4 py-2 flex items-center text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">
          <span className="w-6"></span>
          <button onClick={() => handleSort("date")} className="w-24 text-left hover:text-[var(--brand)]">Date {sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button>
          <button onClick={() => handleSort("ref")} className="w-28 text-left hover:text-[var(--brand)]">Ref {sortKey === 'ref' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button>
          <button onClick={() => handleSort("name")} className="flex-1 text-left hover:text-[var(--brand)]">Customer {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button>
          <span className="w-20 text-right">Fabric</span>
          <span className="w-20 text-right">Tailoring</span>
          <span className="w-20 text-right">Emb.</span>
          <span className="w-20 text-right">Add-on</span>
          <span className="w-16 text-center">Items</span>
          <span className="w-10"></span>
        </div>

        {refs.map(group => (
          <div key={group.ref} className="bg-white border border-[var(--border-subtle)] rounded-sm overflow-hidden">
            {/* Collapsed Reference Row */}
            <div className="px-4 py-3 flex items-center cursor-pointer hover:bg-[#C86B4D05] transition-colors" onClick={() => toggleExpand(group.ref)}>
              <span className="w-6 text-[var(--text-secondary)]">{expanded[group.ref] ? <CaretDown size={14} /> : <CaretRight size={14} />}</span>
              <span className="w-24 font-mono text-xs">{group.date}</span>
              <span className="w-28 font-mono text-xs text-[var(--brand)] font-medium">{group.ref}</span>
              <span className="flex-1 text-sm font-medium truncate">{group.name}</span>
              <span className="w-20 font-mono text-xs text-right">{fmt(group.totals.fabric)}</span>
              <span className="w-20 font-mono text-xs text-right">{fmt(group.totals.tailoring)}</span>
              <span className="w-20 font-mono text-xs text-right">{fmt(group.totals.embroidery)}</span>
              <span className="w-20 font-mono text-xs text-right">{fmt(group.totals.addon)}</span>
              <span className="w-16 text-center font-mono text-xs">{group.items.length}</span>
              <a href={getInvoiceUrl(group.ref)} target="_blank" rel="noopener noreferrer" className="w-10 text-center" onClick={e => e.stopPropagation()}>
                <FilePdf size={16} className="text-[var(--brand)] hover:text-[var(--brand-hover)] inline" />
              </a>
            </div>

            {/* Expanded Detail Rows */}
            {expanded[group.ref] && (
              <div className="border-t border-[var(--border-subtle)]">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--bg)]">
                      {["Barcode", "Price", "Qty", "Disc%", "Fabric Amt", "Article", "Order#", "Delivery", "Tail. Amt", "Emb. Amt", "Add-on", "Actions"].map(h => (
                        <th key={h} className="text-left px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map(item => (
                      <tr key={item.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[#C86B4D05]">
                        <td className="px-3 py-2 text-xs max-w-[100px] truncate">
                          {editingId === item.id ? <input value={editData.barcode||""} onChange={e => setEditData(p=>({...p, barcode: e.target.value}))} className="w-20 px-1 py-0.5 text-xs border border-[var(--brand)] rounded-sm" /> : item.barcode}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {editingId === item.id ? <input type="number" value={editData.price||""} onChange={e => setEditData(p=>({...p, price: parseFloat(e.target.value)||0}))} className="w-14 px-1 py-0.5 text-xs border border-[var(--brand)] rounded-sm" /> : `₹${fmt(item.price)}`}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {editingId === item.id ? <input type="number" step="0.1" value={editData.qty||""} onChange={e => setEditData(p=>({...p, qty: parseFloat(e.target.value)||0}))} className="w-12 px-1 py-0.5 text-xs border border-[var(--brand)] rounded-sm" /> : item.qty}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {editingId === item.id ? <input type="number" value={editData.discount||""} onChange={e => setEditData(p=>({...p, discount: parseFloat(e.target.value)||0}))} className="w-10 px-1 py-0.5 text-xs border border-[var(--brand)] rounded-sm" /> : (item.discount ? `${item.discount}%` : "-")}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs font-medium">₹{fmt(item.fabric_amount)}</td>
                        <td className="px-3 py-2 text-xs">{item.article_type !== "N/A" ? item.article_type : "-"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.order_no !== "N/A" ? item.order_no : "-"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.delivery_date !== "N/A" ? item.delivery_date : "-"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.tailoring_amount ? `₹${fmt(item.tailoring_amount)}` : "-"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{item.embroidery_amount ? `₹${fmt(item.embroidery_amount)}` : "-"}</td>
                        <td className="px-3 py-2 text-xs max-w-[80px] truncate">{item.addon_desc !== "N/A" ? item.addon_desc : "-"}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-0.5">
                            {editingId === item.id ? (
                              <>
                                <button onClick={saveEdit} className="p-1 text-[var(--success)] hover:bg-[#455D4A10] rounded-sm"><FloppyDisk size={14} /></button>
                                <button onClick={cancelEdit} className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg)] rounded-sm"><X size={14} /></button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(item)} className="p-1 text-[var(--info)] hover:bg-[#5C8A9E10] rounded-sm"><PencilSimple size={14} /></button>
                                <button onClick={() => setDelConfirm(item)} className="p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm"><Trash size={14} /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
