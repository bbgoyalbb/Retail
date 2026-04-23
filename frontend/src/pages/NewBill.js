import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createBill, getCustomers, getInvoiceUrl, getSettings } from "@/api";
import { Plus, Trash, FloppyDisk, Barcode, Printer, PencilSimple, X, Scissors, ArrowsSplit } from "@phosphor-icons/react";
import BarcodeScanner from "@/components/BarcodeScanner";
import InvoiceModal from "@/components/InvoiceModal";

export default function NewBill() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [customers, setCustomers] = useState([]);
  const [articleTypes, setArticleTypes] = useState(["Shirt", "Pant", "Kurta"]);
  const [addonItems, setAddonItems] = useState(["Buttons", "Tie", "Bow"]);
  const [paymentModes, setPaymentModes] = useState(["Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"]);
  const [customerName, setCustomerName] = useState("");
  const [orderDate, setOrderDate] = useState(today);
  const [payDate, setPayDate] = useState(today);
  const [items, setItems] = useState([]);
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [selectedModes, setSelectedModes] = useState([]);
  const [isSettled, setIsSettled] = useState(false);
  const [needsTailoring, setNeedsTailoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [lastBillRef, setLastBillRef] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showTailoringModal, setShowTailoringModal] = useState(false);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [dupWarning, setDupWarning] = useState(null);

  const nameRef = useRef(null);
  const dateRef = useRef(null);
  const barcodeRef = useRef(null);
  const qtyRef = useRef(null);
  const priceRef = useRef(null);
  const discountRef = useRef(null);
  const amountRef = useRef(null);
  const payDateRef = useRef(null);
  const settledRef = useRef(null);
  const tailoringRef = useRef(null);
  const saveBtnRef = useRef(null);

  useEffect(() => {
    getCustomers().then(res => setCustomers(res.data || [])).catch(() => {});
    getSettings().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.article_types) && s.article_types.length > 0) setArticleTypes(s.article_types);
      if (Array.isArray(s.addon_items) && s.addon_items.length > 0) setAddonItems(s.addon_items);
      if (Array.isArray(s.payment_modes) && s.payment_modes.length > 0) setPaymentModes(s.payment_modes);
    }).catch(() => {});
  }, []);

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

  // Get default article type (extracted for dependency clarity)
  const defaultArticleType = articleTypes[0] || "Shirt";

  const defaultTailoring = useMemo(() => ({
    enabled: false,
    order_no: "",
    delivery_date: "",
    article_type: defaultArticleType,
    embroidery_status: "Not Required",
  }), [defaultArticleType]);

  const defaultAddon = useMemo(() => ({
    enabled: false,
    items: [], // Array of {name, amount}
  }), []);

  const resetItemForm = () => {
    setBarcode("");
    setQty("");
    setPrice("");
    setDiscount("");
    setEditingIndex(null);
  };

  const addItem = useCallback(() => {
    if (!barcode || !qty || !price) return;
    const d = parseFloat(discount) || 0;
    const discountedPrice = Math.round(parseFloat(price) - (parseFloat(price) * d / 100));
    const total = Math.round(discountedPrice * parseFloat(qty));

    if (editingIndex !== null) {
      setItems(prev => prev.map((row, idx) => (
        idx === editingIndex
          ? { ...row, barcode, qty: parseFloat(qty), price: parseFloat(price), discount: d, total }
          : row
      )));
    } else {
      const isDuplicate = items.some(row => row.barcode === barcode);
      if (isDuplicate && dupWarning !== barcode) {
        setDupWarning(barcode);
        setMessage({ type: "error", text: `Barcode "${barcode}" already in bill. Scan/click Add again to force-add.` });
        setTimeout(() => { setDupWarning(null); setMessage(null); }, 4000);
        return;
      }
      setDupWarning(null);
      setItems(prev => [...prev, {
        barcode,
        qty: parseFloat(qty),
        price: parseFloat(price),
        discount: d,
        total,
        tailoring: { ...defaultTailoring },
        addon: { ...defaultAddon },
      }]);
    }

    resetItemForm();
    setTimeout(() => barcodeRef.current?.focus(), 50);
  }, [barcode, qty, price, discount, editingIndex, dupWarning, items, defaultTailoring, defaultAddon]);

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) resetItemForm();
    if (editingIndex !== null && index < editingIndex) setEditingIndex(editingIndex - 1);
  };

  const editItem = (index) => {
    const row = items[index];
    setBarcode(row.barcode);
    setQty(String(row.qty));
    setPrice(String(row.price));
    setDiscount(String(row.discount || 0));
    setEditingIndex(index);
    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  const toggleMode = (mode) => setSelectedModes(prev => prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]);

  const updateItemTailoring = (index, patch) => {
    setItems(prev => prev.map((row, idx) => idx === index ? { ...row, tailoring: { ...(row.tailoring || defaultTailoring), ...patch } } : row));
  };

  const updateItemAddon = (index, patch) => {
    setItems(prev => prev.map((row, idx) => idx === index ? { ...row, addon: { ...(row.addon || defaultAddon), ...patch } } : row));
  };

  const addAddonItem = (itemIndex) => {
    setItems(prev => prev.map((row, idx) => {
      if (idx !== itemIndex) return row;
      const currentItems = row.addon?.items || [];
      return {
        ...row,
        addon: {
          enabled: true,
          items: [...currentItems, { name: addonItems[0] || "Buttons", amount: "" }]
        }
      };
    }));
  };

  const removeAddonItem = (itemIndex, addonIdx) => {
    setItems(prev => prev.map((row, idx) => {
      if (idx !== itemIndex) return row;
      const currentItems = (row.addon?.items || []).filter((_, i) => i !== addonIdx);
      return {
        ...row,
        addon: {
          enabled: currentItems.length > 0,
          items: currentItems
        }
      };
    }));
  };

  const updateAddonItem = (itemIndex, addonIdx, patch) => {
    setItems(prev => prev.map((row, idx) => {
      if (idx !== itemIndex) return row;
      const currentItems = row.addon?.items || [];
      return {
        ...row,
        addon: {
          ...row.addon,
          items: currentItems.map((item, i) => i === addonIdx ? { ...item, ...patch } : item)
        }
      };
    }));
  };

  const validateTailoringRows = () => {
    const invalid = items.find(row => row.tailoring?.enabled && (!row.tailoring.order_no || !row.tailoring.delivery_date || !row.tailoring.article_type));
    return !invalid;
  };

  const isDirty = customerName.trim() !== "" || items.length > 0;

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleSave = async () => {
    if (!customerName || items.length === 0) {
      setMessage({ type: "error", text: "Please enter customer name and at least one item" });
      return;
    }
    if (parseFloat(amountPaid) > 0 && selectedModes.length === 0) {
      setMessage({ type: "error", text: "Please select a payment mode when entering an amount paid" });
      return;
    }
    if (isSettled && selectedModes.length === 0) {
      setMessage({ type: "error", text: "Please select at least one payment mode when settling the invoice" });
      return;
    }
    if (!validateTailoringRows()) {
      setMessage({ type: "error", text: "Please complete order number, delivery date and article type for all tailoring-enabled rows" });
      return;
    }

    setSaving(true);
    try {
      const hasTailoringRows = items.some(i => i.tailoring?.enabled);
      const res = await createBill({
        customer_name: customerName,
        date: orderDate,
        payment_date: payDate,
        items: items.map(i => {
          const payload = {
            barcode: i.barcode,
            qty: i.qty,
            price: i.price,
            discount: i.discount,
          };

          if (i.tailoring?.enabled) {
            payload.article_type = i.tailoring.article_type;
            payload.order_no = i.tailoring.order_no;
            payload.delivery_date = i.tailoring.delivery_date;
            payload.embroidery_status = i.tailoring.embroidery_status || "Not Required";
          }

          if (i.addon?.enabled && (i.addon.items || []).length > 0) {
            payload.addons = i.addon.items
              .filter(a => (parseFloat(a.amount) || 0) > 0)
              .map(a => ({
                name: a.name || "Add-on",
                price: parseFloat(a.amount) || 0,
              }));
          }

          return payload;
        }),
        payment_modes: selectedModes,
        amount_paid: parseFloat(amountPaid) || 0,
        is_settled: isSettled,
        needs_tailoring: needsTailoring || hasTailoringRows,
      });

      setLastBillRef(res.data.ref);
      setMessage({ type: "success", text: `Bill created! Ref: ${res.data.ref} | Total: ₹${res.data.grand_total}` });
      setItems([]);
      setCustomerName("");
      setOrderDate(today);
      setPayDate(today);
      setAmountPaid("");
      setSelectedModes([]);
      setIsSettled(false);
      setNeedsTailoring(false);
      setShowTailoringModal(false);
      setShowAddonModal(false);
      resetItemForm();
      setTimeout(() => nameRef.current?.focus(), 50);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to save bill" });
    } finally {
      setSaving(false);
    }
  };

  const enterNav = (e, nextRef) => {
    if (e.key === "Enter") { e.preventDefault(); nextRef?.current?.focus(); }
  };

  const openTailoringConfig = () => {
    if (!items.length) {
      setMessage({ type: "error", text: "Add at least one article first" });
      return;
    }
    setShowTailoringModal(true);
  };

  const openAddonConfig = () => {
    if (!items.length) {
      setMessage({ type: "error", text: "Add at least one article first" });
      return;
    }
    setShowAddonModal(true);
  };

  return (
    <div data-testid="new-bill-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">New Bill</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Create a new fabric sale entry</p>
      </div>

      {message && (
        <div data-testid="bill-message" className={`p-4 border rounded-sm text-sm flex items-center justify-between ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          <span>{message.text}</span>
          {message.type === 'success' && lastBillRef && (
            <div className="flex gap-2 ml-4">
              <button onClick={() => setShowInvoice(true)} data-testid="print-bill-btn" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--success)] text-white rounded-sm hover:bg-[#3d4d3f]">
                <Printer size={14} /> View Invoice
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer & Items */}
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
          <h3 className="font-heading text-base font-medium">Customer Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Customer Name</label>
              <input ref={nameRef} data-testid="customer-name-input" list="customers-list" value={customerName} onChange={e => setCustomerName(e.target.value)} onKeyDown={e => enterNav(e, dateRef)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" placeholder="Customer name" />
              <datalist id="customers-list">{customers.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Order Date</label>
              <input ref={dateRef} data-testid="order-date-input" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} onKeyDown={e => enterNav(e, barcodeRef)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
            </div>
          </div>

          <h3 className="font-heading text-base font-medium pt-2">Add Items</h3>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="relative col-span-2 sm:col-span-2">
              <input ref={barcodeRef} data-testid="barcode-input" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Barcode / Item No." className="w-full px-3 py-2 pr-10 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => enterNav(e, qtyRef)} />
              <button data-testid="scan-barcode-btn" onClick={() => setShowScanner(true)} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-[var(--brand)] hover:bg-[#C86B4D10] rounded-sm" title="Scan with camera">
                <Barcode size={18} weight="duotone" />
              </button>
            </div>
            <input ref={qtyRef} data-testid="qty-input" value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty (m)" type="number" step="0.1" className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => enterNav(e, priceRef)} />
            <input ref={priceRef} data-testid="price-input" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price/m" type="number" className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => enterNav(e, discountRef)} />
            <input ref={discountRef} data-testid="discount-input" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="Disc%" type="number" className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }} />
            <button data-testid="add-item-btn" onClick={addItem} className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-all duration-200 hover:translate-y-[-1px]">
              {editingIndex !== null ? <><FloppyDisk size={16} weight="bold" /> Update</> : <><Plus size={16} weight="bold" /> Add</>}
            </button>
          </div>

          {editingIndex !== null && (
            <div className="flex justify-end">
              <button onClick={resetItemForm} className="text-xs px-2.5 py-1.5 border border-[var(--border-subtle)] rounded-sm text-[var(--text-secondary)] hover:border-[var(--brand)]">Cancel Edit</button>
            </div>
          )}

          {showScanner && <BarcodeScanner onScan={(code) => { setBarcode(code); setShowScanner(false); setTimeout(() => qtyRef.current?.focus(), 100); }} onClose={() => setShowScanner(false)} />}

          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="bill-items-table">
                <thead>
                  <tr className="bg-[var(--bg)]">
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Item</th>
                    <th className="text-right px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Qty</th>
                    <th className="text-right px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Price</th>
                    <th className="text-right px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Disc%</th>
                    <th className="text-right px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Total</th>
                    <th className="px-3 py-2 text-right text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-[var(--border-subtle)]">
                      <td className="px-3 py-2 text-sm">{item.barcode}</td>
                      <td className="px-3 py-2 font-mono text-sm text-right">{item.qty}</td>
                      <td className="px-3 py-2 font-mono text-sm text-right">₹{item.price}</td>
                      <td className="px-3 py-2 font-mono text-sm text-right">{item.discount}%</td>
                      <td className="px-3 py-2 font-mono text-sm text-right font-medium">₹{item.total}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => editItem(i)} className="text-[var(--info)] hover:bg-[#5C8A9E10] p-1 rounded-sm" title="Edit row"><PencilSimple size={16} /></button>
                          <button onClick={() => removeItem(i)} className="text-[var(--error)] hover:bg-[#9E473D10] p-1 rounded-sm" title="Delete row"><Trash size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Panel */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
          <h3 className="font-heading text-base font-medium">Payment</h3>

          <div className="p-4 bg-[var(--bg)] rounded-sm">
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]">Grand Total</p>
            <p data-testid="grand-total" className="font-heading text-3xl font-light tracking-tight text-[var(--brand)] mt-1">₹{grandTotal.toLocaleString('en-IN')}</p>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Amount Received</label>
            <input ref={amountRef} data-testid="amount-paid-input" type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} onKeyDown={e => enterNav(e, payDateRef)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" placeholder="Amount received" />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Payment Date</label>
            <input ref={payDateRef} data-testid="pay-date-input" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} onKeyDown={e => enterNav(e, settledRef)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-2">Payment Mode</label>
            <div className="flex flex-wrap gap-2">
              {paymentModes.map(mode => (
                <button key={mode} data-testid={`mode-${mode.toLowerCase().replace(/[\s\[\]]/g, '-')}`} onClick={() => toggleMode(mode)} className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-all duration-200 ${selectedModes.includes(mode) ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--brand)]'}`}>
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input ref={settledRef} data-testid="settle-checkbox" type="checkbox" checked={isSettled} onChange={e => setIsSettled(e.target.checked)} onKeyDown={e => enterNav(e, tailoringRef)} className="w-4 h-4 rounded-sm accent-[var(--brand)]" />
              <span className="text-sm">Mark as Settled</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input ref={tailoringRef} data-testid="tailoring-checkbox" type="checkbox" checked={needsTailoring} onChange={e => setNeedsTailoring(e.target.checked)} onKeyDown={e => enterNav(e, saveBtnRef)} className="w-4 h-4 rounded-sm accent-[var(--brand)]" />
              <span className="text-sm">Needs Tailoring</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={openTailoringConfig} className="px-3 py-2 text-xs border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] flex items-center justify-center gap-1.5">
              <Scissors size={12} /> Configure Tailoring
            </button>
            <button type="button" onClick={openAddonConfig} className="px-3 py-2 text-xs border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] flex items-center justify-center gap-1.5">
              <Plus size={12} /> Configure Add-ons
            </button>
          </div>

          <button ref={saveBtnRef} data-testid="save-bill-btn" onClick={handleSave} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }} disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-all duration-200 hover:translate-y-[-1px] disabled:opacity-50">
            {saving ? "Saving..." : <><FloppyDisk size={18} weight="bold" /> Save Bill</>}
          </button>
        </div>
      </div>

      {showTailoringModal && (
        <TailoringModal
          items={items}
          setItems={setItems}
          customerName={customerName}
          articleTypes={articleTypes}
          onClose={() => setShowTailoringModal(false)}
        />
      )}

      {showInvoice && lastBillRef && (
        <InvoiceModal billRef={lastBillRef} onClose={() => setShowInvoice(false)} />
      )}

      {showAddonModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-[var(--surface)] rounded-sm border border-[var(--border-subtle)] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <h3 className="font-heading text-base">Configure Add-ons for Current Bill ({customerName || 'No Customer'})</h3>
              <button onClick={() => setShowAddonModal(false)} className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg)] rounded-sm"><X size={16} /></button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-[var(--bg)]">
                    <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Article</th>
                    <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Qty</th>
                    <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Add-ons</th>
                    <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Total</th>
                    <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={`addon-${idx}`} className="border-b border-[var(--border-subtle)]">
                      <td className="px-2 py-2 text-sm font-medium">{item.barcode}</td>
                      <td className="px-2 py-2 text-sm">{item.qty}</td>
                      <td className="px-2 py-2">
                        {(item.addon?.items || []).length === 0 ? (
                          <span className="text-sm text-[var(--text-secondary)]">No add-ons</span>
                        ) : (
                          <div className="space-y-1">
                            {(item.addon?.items || []).map((addon, addonIdx) => (
                              <div key={addonIdx} className="flex items-center gap-2">
                                <select
                                  value={addon.name}
                                  onChange={e => updateAddonItem(idx, addonIdx, { name: e.target.value })}
                                  className="px-2 py-1 text-sm border border-[var(--border-subtle)] rounded-sm"
                                >
                                  {addonItems.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                                <input
                                  type="number"
                                  value={addon.amount}
                                  onChange={e => updateAddonItem(idx, addonIdx, { amount: e.target.value })}
                                  className="w-24 px-2 py-1 text-sm border border-[var(--border-subtle)] rounded-sm"
                                  placeholder="Amount"
                                />
                                <button
                                  onClick={() => removeAddonItem(idx, addonIdx)}
                                  className="p-1 text-[var(--error)] hover:bg-[var(--error)]/10 rounded-sm"
                                >
                                  <Trash size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-sm">
                        ₹{(item.addon?.items || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0).toLocaleString()}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => addAddonItem(idx)}
                          className="px-3 py-1.5 text-xs bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] flex items-center gap-1"
                        >
                          <Plus size={12} /> Add
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex justify-end">
              <button onClick={() => setShowAddonModal(false)} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tailoring Modal Component with Split Functionality
function TailoringModal({ items, setItems, customerName, articleTypes, onClose }) {
  const [splitItem, setSplitItem] = useState(null);
  const [splitError, setSplitError] = useState(null);

  const updateItemTailoring = (index, patch) => {
    setItems(prev => prev.map((row, idx) => idx === index ? { ...row, tailoring: { ...(row.tailoring || {}), ...patch } } : row));
  };

  const handleSplit = (itemIdx) => {
    const item = items[itemIdx];
    if (item.qty <= 0) return;
    setSplitItem({
      itemIdx,
      originalQty: item.qty,
      originalTotal: item.total,
      originalPrice: item.price,
      originalDiscount: item.discount,
      // Pre-fill with 2 split parts, user can adjust
      splits: [
        { qty: (item.qty / 2).toFixed(2), article_type: articleTypes[0] || "Shirt" },
        { qty: (item.qty / 2).toFixed(2), article_type: articleTypes[0] || "Shirt" }
      ]
    });
  };

  const addSplitPart = () => {
    if (!splitItem) return;
    setSplitItem(prev => ({
      ...prev,
      splits: [...prev.splits, { qty: "0", article_type: articleTypes[0] || "Shirt" }]
    }));
  };

  const updateSplitPart = (idx, patch) => {
    if (!splitItem) return;
    setSplitItem(prev => ({
      ...prev,
      splits: prev.splits.map((s, i) => i === idx ? { ...s, ...patch } : s)
    }));
  };

  const removeSplitPart = (idx) => {
    if (!splitItem) return;
    setSplitItem(prev => ({ ...prev, splits: prev.splits.filter((_, i) => i !== idx) }));
  };

  const applySplit = () => {
    if (!splitItem) return;
    const totalSplitQty = splitItem.splits.reduce((sum, s) => sum + (parseFloat(s.qty) || 0), 0);
    if (Math.abs(totalSplitQty - splitItem.originalQty) > 0.01) {
      setSplitError(`Total split qty (${totalSplitQty.toFixed(2)}) must equal original qty (${splitItem.originalQty.toFixed(2)})`);
      return;
    }
    setSplitError(null);

    const originalItem = items[splitItem.itemIdx];
    const newItems = [...items];
    const totalQty = splitItem.originalQty;

    // Calculate proportional amounts for each split
    const splitData = splitItem.splits.map((split, i) => {
      const ratio = (parseFloat(split.qty) || 0) / totalQty;
      const splitTotal = Math.round(originalItem.total * ratio);
      const splitPrice = originalItem.price;
      return {
        ...split,
        ratio,
        total: splitTotal,
        price: splitPrice,
        discount: originalItem.discount
      };
    });

    // Update original item with first split
    newItems[splitItem.itemIdx] = {
      ...originalItem,
      qty: parseFloat(splitData[0].qty),
      total: splitData[0].total,
      tailoring: {
        enabled: true,
        article_type: splitData[0].article_type,
        order_no: "",  // User fills this in main table
        delivery_date: "",  // User fills this in main table
        embroidery_status: "Not Required"
      }
    };

    // Add additional items for remaining splits
    for (let i = 1; i < splitData.length; i++) {
      newItems.splice(splitItem.itemIdx + i, 0, {
        ...originalItem,
        id: `${originalItem.barcode}_split_${i}_${Date.now()}`,
        qty: parseFloat(splitData[i].qty),
        total: splitData[i].total,
        tailoring: {
          enabled: true,
          article_type: splitData[i].article_type,
          order_no: "",  // User fills this in main table
          delivery_date: "",  // User fills this in main table
          embroidery_status: "Not Required"
        }
      });
    }

    setItems(newItems);
    setSplitItem(null);
  };

  if (splitItem) {
    const currentTotal = splitItem.splits.reduce((sum, s) => sum + (parseFloat(s.qty) || 0), 0);
    const isBalanced = Math.abs(currentTotal - splitItem.originalQty) < 0.01;
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-[var(--surface)] rounded-sm border border-[var(--border-subtle)] shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <h3 className="font-heading text-base">Split Article: {items[splitItem.itemIdx]?.barcode}</h3>
              <p className="text-xs text-[var(--text-secondary)]">Original Qty: {splitItem.originalQty} | Original Amount: ₹{splitItem.originalTotal?.toLocaleString()}</p>
            </div>
            <button onClick={() => setSplitItem(null)} className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg)] rounded-sm"><X size={16} /></button>
          </div>
          <div className="p-4 max-h-[60vh] overflow-auto">
            <div className="space-y-3">
              {splitItem.splits.map((split, idx) => {
                const ratio = splitItem.originalQty > 0 ? (parseFloat(split.qty) || 0) / splitItem.originalQty : 0;
                const splitAmount = Math.round((splitItem.originalTotal || 0) * ratio);
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 border border-[var(--border-subtle)] rounded-sm bg-[var(--bg)]">
                    <div className="w-24">
                      <label className="text-xs text-[var(--text-secondary)] block mb-1">Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={split.qty}
                        onChange={e => updateSplitPart(idx, { qty: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-[var(--text-secondary)] block mb-1">Article Type</label>
                      <select
                        value={split.article_type}
                        onChange={e => updateSplitPart(idx, { article_type: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm"
                      >
                        {articleTypes.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div className="w-28 text-right">
                      <label className="text-xs text-[var(--text-secondary)] block mb-1">Amount</label>
                      <span className="text-sm font-medium">₹{splitAmount.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => removeSplitPart(idx)}
                      disabled={splitItem.splits.length <= 1}
                      className="mt-4 p-1.5 text-[var(--error)] hover:bg-[var(--error)]/10 rounded-sm disabled:opacity-30"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={addSplitPart}
              className="mt-3 px-3 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] flex items-center gap-1"
            >
              <Plus size={12} /> Add Split Part
            </button>
            <div className={`mt-3 text-sm ${isBalanced ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
              Split Total: {currentTotal.toFixed(2)} / {splitItem.originalQty} 
              {!isBalanced && ' (Must equal original quantity)'}
            </div>
          </div>
          {splitError && (
            <div className="mx-4 mb-0 mt-2 px-3 py-2 text-xs text-[var(--error)] bg-[#9E473D10] border border-[var(--error)] rounded-sm">{splitError}</div>
          )}
          <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex justify-between">
            <button onClick={() => { setSplitItem(null); setSplitError(null); }} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)]">Cancel</button>
            <button 
              onClick={applySplit} 
              disabled={!isBalanced}
              className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50"
            >
              Apply Split
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[var(--surface)] rounded-sm border border-[var(--border-subtle)] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="font-heading text-base">Configure Tailoring for Current Bill ({customerName || 'No Customer'})</h3>
          <button onClick={onClose} className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg)] rounded-sm"><X size={16} /></button>
        </div>
        <div className="p-4 overflow-auto flex-1">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-[var(--bg)]">
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Apply</th>
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Article</th>
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Qty</th>
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Order No</th>
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Delivery</th>
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Article Type</th>
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Embroidery</th>
                <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={`tail-${idx}`} className="border-b border-[var(--border-subtle)]">
                  <td className="px-2 py-2"><input type="checkbox" checked={!!item.tailoring?.enabled} onChange={e => updateItemTailoring(idx, { enabled: e.target.checked })} /></td>
                  <td className="px-2 py-2 text-sm">{item.barcode}</td>
                  <td className="px-2 py-2 text-sm">{item.qty}</td>
                  <td className="px-2 py-2"><input value={item.tailoring?.order_no || ""} onChange={e => updateItemTailoring(idx, { order_no: e.target.value })} disabled={!item.tailoring?.enabled} className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm disabled:opacity-50" /></td>
                  <td className="px-2 py-2"><input type="date" value={item.tailoring?.delivery_date || ""} onChange={e => updateItemTailoring(idx, { delivery_date: e.target.value })} disabled={!item.tailoring?.enabled} className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm disabled:opacity-50" /></td>
                  <td className="px-2 py-2">
                    <select value={item.tailoring?.article_type || (articleTypes[0] || "Shirt")} onChange={e => updateItemTailoring(idx, { article_type: e.target.value })} disabled={!item.tailoring?.enabled} className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm disabled:opacity-50">
                      {articleTypes.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select value={item.tailoring?.embroidery_status || "Not Required"} onChange={e => updateItemTailoring(idx, { embroidery_status: e.target.value })} disabled={!item.tailoring?.enabled} className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm disabled:opacity-50">
                      <option value="Not Required">Not Required</option>
                      <option value="Required">Required</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => handleSplit(idx)}
                      disabled={item.qty <= 1 || !item.tailoring?.enabled}
                      className="px-2 py-1 text-xs border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] disabled:opacity-30 flex items-center gap-1"
                      title="Split this article into multiple tailoring orders"
                    >
                      <ArrowsSplit size={12} /> Split
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]">Done</button>
        </div>
      </div>
    </div>
  );
}
