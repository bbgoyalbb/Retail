import { useState, useEffect, useCallback } from "react";
import { createBill, getCustomers } from "@/api";
import { Plus, Trash, FloppyDisk, CheckCircle } from "@phosphor-icons/react";

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
  const [discount, setDiscount] = useState("0");
  const [amountPaid, setAmountPaid] = useState("");
  const [selectedModes, setSelectedModes] = useState(["Cash"]);
  const [isSettled, setIsSettled] = useState(false);
  const [needsTailoring, setNeedsTailoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    getCustomers().then(res => setCustomers(res.data)).catch(() => {});
  }, []);

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);

  const addItem = useCallback(() => {
    if (!barcode || !qty || !price) return;
    const discountedPrice = Math.round(parseFloat(price) - (parseFloat(price) * parseFloat(discount || 0) / 100));
    const total = Math.round(discountedPrice * parseFloat(qty));
    setItems(prev => [...prev, { barcode, qty: parseFloat(qty), price: parseFloat(price), discount: parseFloat(discount || 0), total }]);
    setBarcode(""); setQty(""); setPrice(""); setDiscount("0");
  }, [barcode, qty, price, discount]);

  const removeItem = (index) => setItems(prev => prev.filter((_, i) => i !== index));

  const toggleMode = (mode) => {
    setSelectedModes(prev =>
      prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]
    );
  };

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
      setMessage({ type: "success", text: `Bill created! Ref: ${res.data.ref} | Total: ₹${res.data.grand_total}` });
      setItems([]); setCustomerName(""); setAmountPaid("");
      setIsSettled(false); setNeedsTailoring(false);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to save bill" });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e, nextAction) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextAction();
    }
  };

  return (
    <div data-testid="new-bill-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight">New Bill</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Create a new fabric sale entry</p>
      </div>

      {message && (
        <div data-testid="bill-message" className={`p-4 border rounded-sm text-sm ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer & Date */}
        <div className="lg:col-span-2 bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
          <h3 className="font-heading text-base font-medium">Customer Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Customer Name</label>
              <input
                data-testid="customer-name-input"
                list="customers-list"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
                placeholder="Customer name"
              />
              <datalist id="customers-list">
                {customers.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Order Date</label>
              <input
                data-testid="order-date-input"
                type="date"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Payment Date</label>
              <input
                data-testid="pay-date-input"
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
              />
            </div>
          </div>

          {/* Add Item */}
          <h3 className="font-heading text-base font-medium pt-4">Add Items</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <input data-testid="barcode-input" value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="Barcode / Item" className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => handleKeyDown(e, () => document.getElementById('qty-input')?.focus())} />
            <input data-testid="qty-input" id="qty-input" value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty (m)" type="number" step="0.1" className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => handleKeyDown(e, () => document.getElementById('price-input')?.focus())} />
            <input data-testid="price-input" id="price-input" value={price} onChange={e => setPrice(e.target.value)} placeholder="Price/m" type="number" className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => handleKeyDown(e, () => document.getElementById('discount-input')?.focus())} />
            <input data-testid="discount-input" id="discount-input" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="Disc %" type="number" className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" onKeyDown={e => handleKeyDown(e, addItem)} />
            <button data-testid="add-item-btn" onClick={addItem} className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-all duration-200 hover:translate-y-[-1px]">
              <Plus size={16} weight="bold" /> Add
            </button>
          </div>

          {/* Items List */}
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
                      <td className="px-3 py-2">
                        <button onClick={() => removeItem(i)} className="text-[var(--error)] hover:bg-[#9E473D10] p-1 rounded-sm">
                          <Trash size={16} />
                        </button>
                      </td>
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
            <input
              data-testid="amount-paid-input"
              type="number"
              value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              placeholder="Amount received"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-2">Payment Mode</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_MODES.map(mode => (
                <button
                  key={mode}
                  data-testid={`mode-${mode.toLowerCase().replace(/[\s\[\]]/g, '-')}`}
                  onClick={() => toggleMode(mode)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-all duration-200
                    ${selectedModes.includes(mode)
                      ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                      : 'bg-white text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--brand)]'
                    }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                data-testid="settle-checkbox"
                type="checkbox"
                checked={isSettled}
                onChange={e => setIsSettled(e.target.checked)}
                className="w-4 h-4 rounded-sm accent-[var(--brand)]"
              />
              <span className="text-sm">Mark as Settled</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                data-testid="tailoring-checkbox"
                type="checkbox"
                checked={needsTailoring}
                onChange={e => setNeedsTailoring(e.target.checked)}
                className="w-4 h-4 rounded-sm accent-[var(--brand)]"
              />
              <span className="text-sm">Needs Tailoring</span>
            </label>
          </div>

          <button
            data-testid="save-bill-btn"
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-all duration-200 hover:translate-y-[-1px] disabled:opacity-50"
          >
            {saving ? "Saving..." : <><FloppyDisk size={18} weight="bold" /> Save Bill</>}
          </button>
        </div>
      </div>
    </div>
  );
}
