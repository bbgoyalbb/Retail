import React, { useState, useEffect, useCallback } from "react";
import { getLabourItems, getKarigars, payLabour, deleteLabourPayment, getSettings } from "@/api";
import { fmt } from "@/lib/fmt";
import { UsersThree, CurrencyDollar, CheckCircle, Circle, CaretDown, CaretRight, Trash, PencilSimple, X } from "@phosphor-icons/react";

export default function LabourPayments() {
  const [viewMode, setViewMode] = useState("unpaid"); // "unpaid" | "paid"
  const [filterType, setFilterType] = useState("All");
  const [filterKarigar, setFilterKarigar] = useState("All");
  const [karigars, setKarigars] = useState([]);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedModes, setSelectedModes] = useState(["Cash"]);
  const [paymentModes, setPaymentModes] = useState(["Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"]);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    const params = { 
      filter_type: filterType, 
      filter_karigar: filterKarigar,
      view_mode: viewMode
    };
    getLabourItems(params)
      .then(res => setItems(res.data))
      .catch(() => {});
  }, [filterType, filterKarigar, viewMode]);

  useEffect(() => {
    getKarigars().then(res => setKarigars(res.data)).catch(() => {});
    getSettings().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.payment_modes) && s.payment_modes.length > 0) setPaymentModes(s.payment_modes);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadData(); setSelected([]); }, [loadData]);

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selected.length === items.length) setSelected([]);
    else setSelected(items.map(i => i.id));
  };

  const selectedTotal = items.filter(i => selected.includes(i.id)).reduce((sum, i) => {
    return sum + (i.labour_type === "Tailoring" ? (i.labour_amount || 0) : (i.emb_labour_amount || 0));
  }, 0);

  const toggleMode = (m) => setSelectedModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const handlePay = async () => {
    if (selected.length === 0) { setMessage({ type: "error", text: "Select at least one item" }); return; }

    const tailoringIds = items.filter(i => selected.includes(i.id) && i.labour_type === "Tailoring").map(i => i.id);
    const embroideryIds = items.filter(i => selected.includes(i.id) && i.labour_type === "Embroidery").map(i => i.id);

    // Generate single payment_id for this batch (shared across tailoring + embroidery)
    const paymentId = `PAY-${Date.now().toString(36).slice(-6)}`;

    setSaving(true);
    try {
      if (tailoringIds.length > 0) {
        await payLabour({ item_ids: tailoringIds, labour_type: "tailoring", payment_date: payDate, payment_modes: selectedModes, payment_id: paymentId });
      }
      if (embroideryIds.length > 0) {
        await payLabour({ item_ids: embroideryIds, labour_type: "embroidery", payment_date: payDate, payment_modes: selectedModes, payment_id: paymentId });
      }
      setMessage({ type: "success", text: `${selected.length} labour payments processed` });
      setSelected([]);
      loadData();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to process" });
    } finally {
      setSaving(false);
    }
  };

  const totalUnpaid = items.reduce((s, i) => s + (i.labour_type === "Tailoring" ? (i.labour_amount || 0) : (i.emb_labour_amount || 0)), 0);

  // Track expanded states for 3-level hierarchy: date -> payment -> articles
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedPayments, setExpandedPayments] = useState({});
  const [editingPayment, setEditingPayment] = useState(null);
  const [editSelectedItems, setEditSelectedItems] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const toggleDateExpand = (date) => {
    setExpandedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  const togglePaymentExpand = (paymentId) => {
    setExpandedPayments(prev => ({ ...prev, [paymentId]: !prev[paymentId] }));
  };

  // Group paid items by date, then by payment_id
  const groupPaidByDateAndPayment = (items) => {
    const dates = {};
    
    items.forEach(item => {
      const paymentId = item.labour_type === "Tailoring" 
        ? item.labour_payment_id 
        : item.emb_labour_payment_id;
      const date = item.labour_type === "Tailoring" 
        ? item.labour_pay_date 
        : item.emb_labour_date;
      
      if (!date || date === "N/A") return;
      
      if (!dates[date]) {
        dates[date] = { date, payments: {} };
      }
      
      const key = paymentId || `single_${item.id}`;
      if (!dates[date].payments[key]) {
        dates[date].payments[key] = {
          payment_id: paymentId,
          ref: paymentId || `PAY-${item.id.slice(-4)}`,
          date: date,
          mode: item.labour_type === "Tailoring" ? item.labour_payment_mode : item.emb_labour_payment_mode,
          items: [],
          total: 0,
          type: item.labour_type,
          labour_type: item.labour_type.toLowerCase()
        };
      }
      
      dates[date].payments[key].items.push(item);
      const amount = item.labour_type === "Tailoring" ? (item.labour_amount || 0) : (item.emb_labour_amount || 0);
      dates[date].payments[key].total += amount;
    });
    
    // Convert to array and sort by date descending
    return Object.values(dates)
      .map(d => ({
        ...d,
        payments: Object.values(d.payments).sort((a, b) => (b.ref || "").localeCompare(a.ref || ""))
      }))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  };

  const startEditPayment = (payment) => {
    setEditingPayment(payment);
    setEditSelectedItems(payment.items.map(i => i.id));
  };

  const cancelEditPayment = () => {
    setEditingPayment(null);
    setEditSelectedItems([]);
  };

  const toggleEditItem = (itemId) => {
    setEditSelectedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const saveEditPayment = async () => {
    if (!editingPayment) return;
    
    // Items to remove from this payment (deselected items become unpaid)
    const itemsToRemove = editingPayment.items
      .filter(i => !editSelectedItems.includes(i.id))
      .map(i => i.id);
    
    // Items to keep
    const itemsToKeep = editingPayment.items
      .filter(i => editSelectedItems.includes(i.id));
    
    if (itemsToKeep.length === 0) {
      // If no items left, delete the entire payment directly (no need for separate confirm — user already confirmed by deselecting all)
      setSaving(true);
      try {
        await deleteLabourPayment({
          payment_id: editingPayment.payment_id,
          item_ids: editingPayment.items.map(i => i.id),
          labour_type: editingPayment.labour_type
        });
        setMessage({ type: "success", text: `Payment deleted - ${editingPayment.items.length} items marked as unpaid` });
        loadData();
      } catch (err) {
        setMessage({ type: "error", text: "Failed to delete payment" });
      } finally {
        setSaving(false);
        setTimeout(() => setMessage(null), 3000);
      }
      setEditingPayment(null);
      setEditSelectedItems([]);
      return;
    }
    
    setSaving(true);
    try {
      if (itemsToRemove.length > 0) {
        // Mark removed items as unpaid
        await deleteLabourPayment({
          payment_id: editingPayment.payment_id,
          item_ids: itemsToRemove,
          labour_type: editingPayment.labour_type
        });
      }
      setMessage({ type: "success", text: `Payment updated - ${itemsToRemove.length} items removed, ${itemsToKeep.length} items kept` });
      setEditingPayment(null);
      setEditSelectedItems([]);
      loadData();
    } catch (e) {
      setMessage({ type: "error", text: "Failed to update payment" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDeletePayment = async (payment) => {
    if (deleteConfirm?.payment_id !== payment.payment_id) {
      setDeleteConfirm(payment);
      return;
    }
    setDeleteConfirm(null);
    setSaving(true);
    try {
      await deleteLabourPayment({
        payment_id: payment.payment_id,
        item_ids: payment.items.map(i => i.id),
        labour_type: payment.labour_type
      });
      setMessage({ type: "success", text: `Payment deleted - ${payment.items.length} items marked as unpaid` });
      loadData();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete payment" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="labour-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Labour Payments</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Pay tailoring and embroidery labour</p>
      </div>

      {message && (
        <div className={`p-4 border rounded-sm text-sm ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters & Table */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-4 rounded-sm flex flex-wrap gap-2 sm:gap-3 items-center">
            <div className="flex items-center gap-1 bg-[var(--bg)] rounded-sm p-0.5">
              <button
                onClick={() => setViewMode("unpaid")}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors flex items-center gap-1 ${
                  viewMode === "unpaid" 
                    ? 'bg-[var(--surface)] text-[var(--brand)] shadow-sm' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Circle size={14} /> Pending
              </button>
              <button
                onClick={() => setViewMode("paid")}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors flex items-center gap-1 ${
                  viewMode === "paid" 
                    ? 'bg-[var(--surface)] text-[var(--brand)] shadow-sm' 
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <CheckCircle size={14} /> Paid
              </button>
            </div>
            
            <select data-testid="labour-type-filter" value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
              <option value="All">All Types</option>
              <option value="Tailoring Labour">Tailoring</option>
              <option value="Embroidery Labour">Embroidery</option>
            </select>
            {filterType !== "Tailoring Labour" && (
              <select data-testid="labour-karigar-filter" value={filterKarigar} onChange={e => setFilterKarigar(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                <option value="All">All Karigars</option>
                {karigars.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            )}
            
            <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap gap-3 sm:gap-4 text-sm">
              {viewMode === "unpaid" ? (
                <>
                  <span className="text-[var(--text-secondary)]">Unpaid: <span className="font-mono font-medium text-[var(--warning)]">₹{fmt(totalUnpaid)}</span></span>
                  <span className="text-[var(--text-secondary)]">Selected: <span className="font-mono font-medium text-[var(--brand)]">₹{fmt(selectedTotal)}</span></span>
                </>
              ) : (
                <span className="text-[var(--text-secondary)]">Paid Entries: <span className="font-mono font-medium text-[var(--success)]">{items.length}</span></span>
              )}
            </div>
          </div>

          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm">
            {items.length === 0 ? (
              <div className="p-12 text-center">
                <pre className="text-[var(--border-strong)] text-xs mb-4 font-mono">
{viewMode === "unpaid" ? `  .--.
 /    \\
|  OK  |
 \\    /
  '--'
All paid!` : `  .--.
 /    \\
|  N/A |
 \\    /
  '--'
No paid entries`}
                </pre>
                <p className="text-[var(--text-secondary)] text-sm">
                  {viewMode === "unpaid" ? "No pending labour payments" : "No paid labour entries"}
                </p>
              </div>
            ) : viewMode === "unpaid" ? (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="labour-items-table">
                  <thead>
                    <tr className="bg-[var(--bg)]">
                      <th className="px-3 py-2 w-10">
                        <input type="checkbox" checked={selected.length === items.length && items.length > 0} onChange={selectAll} className="w-3.5 h-3.5 accent-[var(--brand)]" />
                      </th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Order</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Article</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Karigar</th>
                      <th className="text-right px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Amount</th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => {
                      const amount = item.labour_type === "Tailoring" ? item.labour_amount : item.emb_labour_amount;
                      return (
                        <tr key={i} className={`border-b border-[var(--border-subtle)] transition-colors cursor-pointer ${selected.includes(item.id) ? 'bg-[#C86B4D08]' : 'hover:bg-[#C86B4D05]'}`}
                          onClick={() => toggleSelect(item.id)}>
                          <td className="px-3 py-2.5">
                            <input type="checkbox" checked={selected.includes(item.id)} readOnly className="w-3.5 h-3.5 accent-[var(--brand)]" />
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs">{item.order_no}</td>
                          <td className="px-3 py-2.5 text-sm">{item.article_type}</td>
                          <td className="px-3 py-2.5 text-sm text-[var(--text-secondary)]">{item.karigar !== "N/A" ? item.karigar : "-"}</td>
                          <td className="px-3 py-2.5 font-mono text-sm text-right font-medium">₹{fmt(amount)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`text-xs font-medium uppercase tracking-wider ${item.labour_type === "Tailoring" ? 'text-[var(--info)]' : 'text-[var(--brand)]'}`}>
                              {item.labour_type}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              // Paid View - 3-Level Hierarchy: Date -> Payment Entry -> Articles
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="labour-paid-table">
                  <thead>
                    <tr className="bg-[var(--bg)]">
                      <th className="w-8"></th>
                      <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Date</th>
                      <th className="text-right px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Payments</th>
                      <th className="text-right px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Total</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupPaidByDateAndPayment(items).map((dateGroup, dateIdx) => (
                      <React.Fragment key={dateGroup.date}>
                        {/* Date Level */}
                        <tr 
                          
                          className="border-b border-[var(--border-subtle)] bg-[#C86B4D08] hover:bg-[#C86B4D12] cursor-pointer"
                          onClick={() => toggleDateExpand(dateGroup.date)}
                        >
                          <td className="px-3 py-2.5">
                            {expandedDates[dateGroup.date] ? (
                              <CaretDown size={16} className="text-[var(--brand)]" />
                            ) : (
                              <CaretRight size={16} className="text-[var(--text-secondary)]" />
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-sm font-medium">{dateGroup.date}</td>
                          <td className="px-3 py-2.5 font-mono text-sm text-right">{dateGroup.payments.length}</td>
                          <td className="px-3 py-2.5 font-mono text-sm text-right font-medium text-[var(--success)]">
                            ₹{fmt(dateGroup.payments.reduce((s, p) => s + p.total, 0))}
                          </td>
                          <td></td>
                        </tr>
                        
                        {/* Payment Entries under this date */}
                        {expandedDates[dateGroup.date] && dateGroup.payments.map((payment, payIdx) => (
                          <React.Fragment key={payment.payment_id || `${dateGroup.date}_${payIdx}`}>
                            <tr 
                              
                              className="border-b border-[var(--border-subtle)] hover:bg-[#C86B4D05] cursor-pointer"
                              onClick={() => togglePaymentExpand(payment.payment_id || `${dateGroup.date}_${payIdx}`)}
                            >
                              <td className="px-3 py-2 pl-8">
                                {expandedPayments[payment.payment_id || `${dateGroup.date}_${payIdx}`] ? (
                                  <CaretDown size={14} className="text-[var(--info)]" />
                                ) : (
                                  <CaretRight size={14} className="text-[var(--text-secondary)]" />
                                )}
                              </td>
                              <td className="px-3 py-2" colSpan={2}>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-medium">₹{fmt(payment.total)}</span>
                                  <span className="text-xs text-[var(--text-secondary)]">({payment.items.length} items)</span>
                                  <span className={`text-xs font-medium uppercase ${payment.type === "Tailoring" ? 'text-[var(--info)]' : 'text-[var(--brand)]'}`}>
                                    {payment.type}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2 font-mono text-sm text-right font-medium">₹{fmt(payment.total)}</td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditPayment(payment);
                                    }}
                                    disabled={saving}
                                    className="p-1.5 text-[var(--info)] hover:bg-[var(--bg)] rounded-sm transition-colors"
                                    title="Edit payment"
                                  >
                                    <PencilSimple size={14} />
                                  </button>
                                  {deleteConfirm?.payment_id === payment.payment_id ? (
                                    <span className="flex items-center gap-1">
                                      <button onClick={(e) => { e.stopPropagation(); handleDeletePayment(payment); }} className="px-1.5 py-0.5 bg-red-500 text-white rounded-sm text-[10px] hover:bg-red-600">Delete</button>
                                      <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="px-1.5 py-0.5 border border-[var(--border-subtle)] rounded-sm text-[10px] hover:bg-[var(--bg)]">Cancel</button>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDeletePayment(payment); }}
                                      disabled={saving}
                                      className="p-1.5 text-[var(--error)] hover:bg-[var(--bg)] rounded-sm transition-colors"
                                      title="Delete payment"
                                    >
                                      <Trash size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                            
                            {/* Articles under this payment */}
                            {expandedPayments[payment.payment_id || `${dateGroup.date}_${payIdx}`] && (
                              <tr className="bg-[var(--bg)]">
                                <td colSpan={5} className="px-0 py-0">
                                  <div className="px-4 py-2">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="border-b border-[var(--border-subtle)]">
                                          <th className="text-left py-1.5 text-xs text-[var(--text-secondary)] font-medium pl-4">Order</th>
                                          <th className="text-left py-1.5 text-xs text-[var(--text-secondary)] font-medium">Article</th>
                                          <th className="text-left py-1.5 text-xs text-[var(--text-secondary)] font-medium">Karigar</th>
                                          <th className="text-right py-1.5 text-xs text-[var(--text-secondary)] font-medium">Amount</th>
                                          <th className="text-left py-1.5 text-xs text-[var(--text-secondary)] font-medium pl-2">Mode</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {payment.items.map((item, idx) => (
                                          <tr key={idx} className="border-b border-[var(--border-subtle)] last:border-0">
                                            <td className="py-1.5 font-mono text-xs text-[var(--text-secondary)] pl-4">{item.order_no}</td>
                                            <td className="py-1.5 text-sm">{item.article_type}</td>
                                            <td className="py-1.5 text-sm text-[var(--text-secondary)]">{item.karigar !== "N/A" ? item.karigar : "-"}</td>
                                            <td className="py-1.5 font-mono text-sm text-right">₹{fmt(item.labour_type === "Tailoring" ? (item.labour_amount || 0) : (item.emb_labour_amount || 0))}</td>
                                            <td className="py-1.5 text-xs text-[var(--text-secondary)] pl-2">{payment.mode || "Cash"}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                
                {/* Edit Payment Modal */}
                {editingPayment && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-[var(--surface)] rounded-sm shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
                      <div className="p-4 border-b border-[var(--border-subtle)] flex justify-between items-center">
                        <h3 className="font-heading text-lg">Edit Payment - {editingPayment.ref}</h3>
                        <button onClick={cancelEditPayment} className="p-1 hover:bg-[var(--bg)] rounded">
                          <X size={20} />
                        </button>
                      </div>
                      <div className="p-4 overflow-y-auto flex-1">
                        <p className="text-sm text-[var(--text-secondary)] mb-4">
                          Uncheck items to remove them from this payment. Removed items will become unpaid.
                        </p>
                        <table className="w-full">
                          <thead className="bg-[var(--bg)] sticky top-0">
                            <tr>
                              <th className="text-left px-3 py-2 text-xs font-medium">Select</th>
                              <th className="text-left px-3 py-2 text-xs font-medium">Order</th>
                              <th className="text-left px-3 py-2 text-xs font-medium">Article</th>
                              <th className="text-left px-3 py-2 text-xs font-medium">Karigar</th>
                              <th className="text-right px-3 py-2 text-xs font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editingPayment.items.map((item) => (
                              <tr 
                                key={item.id} 
                                className={`border-b border-[var(--border-subtle)] cursor-pointer ${editSelectedItems.includes(item.id) ? '' : 'opacity-50 bg-[var(--bg)]'}`}
                                onClick={() => toggleEditItem(item.id)}
                              >
                                <td className="px-3 py-2">
                                  <input 
                                    type="checkbox" 
                                    checked={editSelectedItems.includes(item.id)} 
                                    readOnly
                                    className="w-4 h-4 accent-[var(--brand)]"
                                  />
                                </td>
                                <td className="px-3 py-2 font-mono text-xs">{item.order_no}</td>
                                <td className="px-3 py-2 text-sm">{item.article_type}</td>
                                <td className="px-3 py-2 text-sm">{item.karigar !== "N/A" ? item.karigar : "-"}</td>
                                <td className="px-3 py-2 font-mono text-sm text-right">
                                  ₹{fmt(item.labour_type === "Tailoring" ? (item.labour_amount || 0) : (item.emb_labour_amount || 0))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-4 border-t border-[var(--border-subtle)] space-y-3">
                        {editSelectedItems.length === 0 && (
                          <div className="px-3 py-2 text-xs text-[var(--error)] bg-[#9E473D10] border border-[var(--error)] rounded-sm">
                            ⚠ All items deselected — saving will <strong>delete this entire payment</strong> and mark all items as unpaid.
                          </div>
                        )}
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={cancelEditPayment}
                            className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveEditPayment}
                            disabled={saving}
                            className={`px-4 py-2 text-sm text-white rounded-sm disabled:opacity-50 ${editSelectedItems.length === 0 ? 'bg-[var(--error)] hover:bg-[var(--error)]/90' : 'bg-[var(--brand)] hover:bg-[var(--brand-hover)]'}`}
                          >
                            {saving ? 'Saving...' : editSelectedItems.length === 0 ? 'Delete Payment' : `Save Changes (${editSelectedItems.length} items)`}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Payment Panel */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-4 h-fit">
          <h3 className="font-heading text-base font-medium">Process Payment</h3>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Payment Date</label>
            <input data-testid="labour-pay-date" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-2">Payment Mode</label>
            <div className="flex flex-wrap gap-2">
              {paymentModes.map(m => (
                <button key={m} onClick={() => toggleMode(m)} className={`px-2.5 py-1 text-xs font-medium rounded-sm border transition-all ${selectedModes.includes(m) ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-[var(--bg)] rounded-sm">
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]">Selected Amount</p>
            <p className="font-heading text-2xl font-light tracking-tight text-[var(--brand)] mt-1">₹{fmt(selectedTotal)}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{selected.length} items selected</p>
          </div>

          <button data-testid="pay-labour-btn" onClick={handlePay} disabled={saving || selected.length === 0} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50 transition-all">
            {saving ? "Processing..." : <><CurrencyDollar size={18} weight="bold" /> Pay Labour</>}
          </button>
        </div>
      </div>
    </div>
  );
}
