import { useState, useEffect, useCallback, useRef } from "react";
import { createBill, getCustomers, getInvoiceUrl } from "@/api";
import { Plus, Trash, FloppyDisk, Barcode, Printer, FilePdf } from "@phosphor-icons/react";
import BarcodeScanner from "@/components/BarcodeScanner";

const PAYMENT_MODES = ["Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"];

export default function NewBill() {
  const [customers, setCustomers] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState([]);
  const [barcode, setBarcode] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [selectedModes, setSelectedModes] = useState(["Cash"]);
  const [isSettled, setIsSettled] = useState(false);
  const [needsTailoring, setNeedsTailoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [lastBillRef, setLastBillRef] = useState(null);

  const nameRef = useRef(null);
  const barcodeRef = useRef(null);
  const qtyRef = useRef(null);
  const priceRef = useRef(null);
  const discountRef = useRef(null);
  const amountRef = useRef(null);

  useEffect(() => {
    getCustomers().then(res => setCustomers(res.data)).catch(() => {});
  }, []);

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

  const addItem = useCallback(() => {
    if (!barcode || !qty || !price) return;
    const d = parseFloat(discount) || 0;
    const discountedPrice = Math.round(parseFloat(price) - (parseFloat(price) * d / 100));
    const total = Math.round(discountedPrice * parseFloat(qty));
    setItems(prev => [...prev, { barcode, qty: parseFloat(qty), price: parseFloat(price), discount: d, total }]);
    setBarcode(""); setQty(""); setPrice(""); setDiscount("");
    setTimeout(() => barcodeRef.current?.focus(), 50);
  }, [barcode, qty, price, discount]);

  const removeItem = (index) => setItems(prev => prev.filter((_, i) => i !== index));
  const toggleMode = (mode) => setSelectedModes(prev => prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]);

  const handleSave = async () => {
    if (!customerName || items.length === 0) {
      setMessage({ type: "error", text: "Please enter customer name and at least one item" });
      return;
    }
    setSaving(true);
    try {
      const res = await createBill({
        customer_name: customerName,
        date: orderDate,
        payment_date: payDate,
        items: items.map(i => ({ barcode: i.barcode, qty: i.qty, price: i.price, discount: i.discount })),
        payment_modes: selectedModes,
        amount_paid: parseFloat(amountPaid) || 0,
        is_settled: isSettled,
        needs_tailoring: needsTailoring,
      });
      setLastBillRef(res.data.ref);
      setMessage({ type: "success", text: `Bill created! Ref: ${res.data.ref} | Total: ₹${res.data.grand_total}` });
      setItems([]); setAmountPaid("");
      setIsSettled(false); setNeedsTailoring(false);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to save bill" });
    } finally {
      setSaving(false);
    }
  };

  const enterNav = (e, nextRef) => {
    if (e.key === "Enter") { e.preventDefault(); nextRef?.current?.focus(); }
  };

  return (
    <div data-testid="new-bill-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight">New Bill</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Create a new fabric sale entry</p>
      </div>

      {message && (
        <div data-testid="bill-message" className={`p-4 border rounded-sm text-sm flex items-center justify-between ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          <span>{message.text}</span>
          {message.type === 'success' && lastBillRef && (
            <div className="flex gap-2 ml-4">
              <a href={getInvoiceUrl(lastBillRef)} target="_blank" rel="noopener noreferrer" data-testid="print-bill-btn" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]">
                <FilePdf size={14} /> Download PDF
              </a>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer & Items */}
        <div className="lg:col-span-2 bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
          <h3 className="font-heading text-base font-medium">Customer Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Customer Name</label>
              <input ref={nameRef} data-testid="customer-name-input" list="customers-list" value={customerName} onChange={e => setCustomerName(e.target.value)} onKeyDown={e => enterNav(e, barcodeRef)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" placeholder="Customer name" />
              <datalist id="customers-list">{customers.map(c => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Order Date</label>
              <input data-testid="order-date-input" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} onKeyDown={e => enterNav(e, barcodeRef)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
            </div>
          </div>

          <h3 className="font-heading text-base font-medium pt-2">Add Items</h3>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="relative sm:col-span-2">
              <input ref={barcodeRef} data-testid="barcode-input" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Barcode / Item No." className="w-full px-3 py-2 pr-10 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => enterNav(e, qtyRef)} />
              <button data-testid="scan-barcode-btn" onClick={() => setShowScanner(true)} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-[var(--brand)] hover:bg-[#C86B4D10] rounded-sm" title="Scan with camera">
                <Barcode size={18} weight="duotone" />
              </button>
            </div>
            <input ref={qtyRef} data-testid="qty-input" value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty (meters)" type="number" step="0.1" className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => enterNav(e, priceRef)} />
            <input ref={priceRef} data-testid="price-input" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price / meter" type="number" className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => enterNav(e, discountRef)} />
            <input ref={discountRef} data-testid="discount-input" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="Discount %" type="number" className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }} />
            <button data-testid="add-item-btn" onClick={addItem} className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-all duration-200 hover:translate-y-[-1px]">
              <Plus size={16} weight="bold" /> Add
            </button>
          </div>

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
                    <th className="px-3 py-2"></th>
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
                      <td className="px-3 py-2"><button onClick={() => removeItem(i)} className="text-[var(--error)] hover:bg-[#9E473D10] p-1 rounded-sm"><Trash size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Panel */}
        <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
          <h3 className="font-heading text-base font-medium">Payment</h3>

          <div className="p-4 bg-[var(--bg)] rounded-sm">
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]">Grand Total</p>
            <p data-testid="grand-total" className="font-heading text-3xl font-light tracking-tight text-[var(--brand)] mt-1">₹{grandTotal.toLocaleString('en-IN')}</p>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Amount Received</label>
            <input ref={amountRef} data-testid="amount-paid-input" type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" placeholder="Amount received" />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Payment Date</label>
            <input data-testid="pay-date-input" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-2">Payment Mode</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_MODES.map(mode => (
                <button key={mode} data-testid={`mode-${mode.toLowerCase().replace(/[\s\[\]]/g, '-')}`} onClick={() => toggleMode(mode)} className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-all duration-200 ${selectedModes.includes(mode) ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'bg-white text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--brand)]'}`}>
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input data-testid="settle-checkbox" type="checkbox" checked={isSettled} onChange={e => setIsSettled(e.target.checked)} className="w-4 h-4 rounded-sm accent-[var(--brand)]" />
              <span className="text-sm">Mark as Settled</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input data-testid="tailoring-checkbox" type="checkbox" checked={needsTailoring} onChange={e => setNeedsTailoring(e.target.checked)} className="w-4 h-4 rounded-sm accent-[var(--brand)]" />
              <span className="text-sm">Needs Tailoring</span>
            </label>
          </div>

          <button data-testid="save-bill-btn" onClick={handleSave} disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-all duration-200 hover:translate-y-[-1px] disabled:opacity-50">
            {saving ? "Saving..." : <><FloppyDisk size={18} weight="bold" /> Save Bill</>}
          </button>
        </div>
      </div>
    </div>
  );
}
