import { useState, useEffect, useCallback } from "react";
import { getItems, getCustomers, updateItem, deleteItem, getInvoiceUrl } from "@/api";
import { PencilSimple, Trash, FloppyDisk, X, FilePdf, CaretLeft, CaretRight } from "@phosphor-icons/react";

export default function ItemsManager() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [nameFilter, setNameFilter] = useState("");
  const [refFilter, setRefFilter] = useState("");
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [message, setMessage] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const PAGE_SIZE = 30;

  useEffect(() => { getCustomers().then(res => setCustomers(res.data)).catch(() => {}); }, []);

  const loadItems = useCallback(() => {
    const params = { limit: PAGE_SIZE, skip: page * PAGE_SIZE };
    if (nameFilter) params.name = nameFilter;
    if (refFilter) params.ref = refFilter;
    getItems(params).then(res => {
      setItems(res.data.items);
      setTotal(res.data.total);
    }).catch(console.error);
  }, [page, nameFilter, refFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditData({ ...item });
  };

  const cancelEdit = () => { setEditingId(null); setEditData({}); };

  const saveEdit = async () => {
    try {
      await updateItem(editingId, editData);
      setMessage({ type: "success", text: "Item updated successfully" });
      setEditingId(null);
      loadItems();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to update item" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = async (id) => {
    try {
      await deleteItem(id);
      setMessage({ type: "success", text: "Item deleted" });
      setDelConfirm(null);
      loadItems();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const EditCell = ({ field, type = "text", width = "w-20" }) => {
    if (editingId !== editData.id) return null;
    return (
      <input
        type={type}
        value={editData[field] ?? ""}
        onChange={e => setEditData(prev => ({ ...prev, [field]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value }))}
        className={`${width} px-1.5 py-1 text-xs border border-[var(--brand)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]`}
      />
    );
  };

  return (
    <div data-testid="items-manager-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight">Manage Items</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Edit, delete, and download invoices for all records</p>
      </div>

      {message && (
        <div data-testid="items-message" className={`p-3 border rounded-sm text-sm ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-[var(--border-subtle)] p-4 rounded-sm flex flex-wrap gap-3 items-center">
        <select data-testid="items-customer-filter" value={nameFilter} onChange={e => { setNameFilter(e.target.value); setPage(0); }} className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
          <option value="">All Customers</option>
          {customers.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input data-testid="items-ref-filter" value={refFilter} onChange={e => { setRefFilter(e.target.value); setPage(0); }} placeholder="Filter by Ref..." className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] w-40" />
        <span className="ml-auto text-xs text-[var(--text-secondary)]">{total} records</span>
      </div>

      {/* Delete Confirmation Modal */}
      {delConfirm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setDelConfirm(null)}>
          <div data-testid="delete-confirm-modal" className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-medium mb-2">Delete Item?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">This action cannot be undone. Item: <span className="font-mono">{delConfirm.barcode}</span></p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelConfirm(null)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Cancel</button>
              <button data-testid="confirm-delete-btn" onClick={() => handleDelete(delConfirm.id)} className="px-4 py-2 text-sm bg-[var(--error)] text-white rounded-sm hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[var(--border-subtle)] rounded-sm overflow-x-auto">
        <table className="w-full" data-testid="items-table">
          <thead>
            <tr className="bg-[var(--bg)]">
              {["Date", "Customer", "Ref", "Item", "Price", "Qty", "Disc%", "Amount", "Tailoring", "Article", "Payment", "Actions"].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-b border-[var(--border-subtle)] hover:bg-[#C86B4D05] transition-colors">
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                  {editingId === item.id ? <EditCell field="date" width="w-24" /> : item.date}
                </td>
                <td className="px-3 py-2 text-sm max-w-[140px] truncate">{item.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{item.ref}</td>
                <td className="px-3 py-2 text-sm max-w-[120px] truncate">
                  {editingId === item.id ? <EditCell field="barcode" width="w-24" /> : item.barcode}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-right">
                  {editingId === item.id ? <EditCell field="price" type="number" width="w-16" /> : `₹${fmt(item.price)}`}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-right">
                  {editingId === item.id ? <EditCell field="qty" type="number" width="w-14" /> : item.qty}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-right">
                  {editingId === item.id ? <EditCell field="discount" type="number" width="w-14" /> : `${item.discount}%`}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-right font-medium">₹{fmt(item.fabric_amount)}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs ${item.tailoring_status === 'N/A' ? 'text-[var(--text-secondary)]' : item.tailoring_status === 'Delivered' ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                    {item.tailoring_status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{item.article_type !== 'N/A' ? item.article_type : '-'}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex items-center gap-1 text-xs ${item.fabric_pay_mode?.startsWith('Settled') ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${item.fabric_pay_mode?.startsWith('Settled') ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`} />
                    {item.fabric_pay_mode?.startsWith('Settled') ? 'Settled' : 'Pending'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {editingId === item.id ? (
                      <>
                        <button data-testid={`save-edit-${item.id}`} onClick={saveEdit} className="p-1 text-[var(--success)] hover:bg-[#455D4A10] rounded-sm" title="Save">
                          <FloppyDisk size={16} />
                        </button>
                        <button onClick={cancelEdit} className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg)] rounded-sm" title="Cancel">
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button data-testid={`edit-${item.id}`} onClick={() => startEdit(item)} className="p-1 text-[var(--info)] hover:bg-[#5C8A9E10] rounded-sm" title="Edit">
                          <PencilSimple size={16} />
                        </button>
                        <button data-testid={`delete-${item.id}`} onClick={() => setDelConfirm(item)} className="p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm" title="Delete">
                          <Trash size={16} />
                        </button>
                        <a href={getInvoiceUrl(item.ref)} target="_blank" rel="noopener noreferrer" data-testid={`pdf-${item.id}`} className="p-1 text-[var(--brand)] hover:bg-[#C86B4D10] rounded-sm" title="Download Invoice">
                          <FilePdf size={16} />
                        </a>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--text-secondary)]">
          Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
        </p>
        <div className="flex gap-2">
          <button data-testid="prev-page-btn" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2 border border-[var(--border-subtle)] rounded-sm disabled:opacity-30 hover:bg-[var(--bg)]">
            <CaretLeft size={16} />
          </button>
          <span className="px-3 py-2 text-sm font-mono">{page + 1} / {totalPages || 1}</span>
          <button data-testid="next-page-btn" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} className="p-2 border border-[var(--border-subtle)] rounded-sm disabled:opacity-30 hover:bg-[var(--bg)]">
            <CaretRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
