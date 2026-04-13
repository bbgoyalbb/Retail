import { useState, useEffect } from "react";
import { getCustomers, getRefs, getBalances, processSettlement, getOrders, getItems } from "@/api";
import { CurrencyDollar, CheckCircle } from "@phosphor-icons/react";

const PAYMENT_MODES = ["Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"];

export default function Settlements() {
  const [mode, setMode] = useState("customer");
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [refs, setRefs] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedRef, setSelectedRef] = useState("");
  const [selectedOrder, setSelectedOrder] = useState("");
  const [balances, setBalances] = useState({ fabric: 0, tailoring: 0, embroidery: 0, addon: 0, advance: 0 });
  const [freshPay, setFreshPay] = useState("");
  const [useAdvance, setUseAdvance] = useState(false);
  const [allotFab, setAllotFab] = useState("");
  const [allotTail, setAllotTail] = useState("");
  const [allotEmb, setAllotEmb] = useState("");
  const [allotAddon, setAllotAddon] = useState("");
  const [allotAdv, setAllotAdv] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedModes, setSelectedModes] = useState(["Cash"]);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCustomers().then(res => setCustomers(res.data)).catch(() => {});
    getOrders().then(res => setOrders(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      getRefs(selectedCustomer).then(res => setRefs(res.data)).catch(() => {});
      setSelectedRef("");
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (selectedRef) {
      getBalances({ name: selectedCustomer, ref: selectedRef }).then(res => {
        setBalances(res.data);
        setAllotFab(res.data.fabric > 0 ? String(res.data.fabric) : "");
        setAllotTail(res.data.tailoring > 0 ? String(res.data.tailoring) : "");
        setAllotEmb(res.data.embroidery > 0 ? String(res.data.embroidery) : "");
        setAllotAddon(res.data.addon > 0 ? String(res.data.addon) : "");
        setAllotAdv("");
      }).catch(() => {});
    }
  }, [selectedRef, selectedCustomer]);

  useEffect(() => {
    if (selectedOrder) {
      getItems({ order_no: selectedOrder, limit: 1 }).then(res => {
        if (res.data.items.length > 0) {
          const item = res.data.items[0];
          setSelectedCustomer(item.name);
          setSelectedRef(item.ref);
        }
      }).catch(() => {});
    }
  }, [selectedOrder]);

  const totalPool = (parseFloat(freshPay) || 0) + (useAdvance ? balances.advance : 0);
  const totalAllocated = (parseFloat(allotFab) || 0) + (parseFloat(allotTail) || 0) + (parseFloat(allotEmb) || 0) + (parseFloat(allotAddon) || 0) + (parseFloat(allotAdv) || 0);

  const toggleMode = (m) => setSelectedModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const handleSubmit = async () => {
    if (!selectedRef) { setMessage({ type: "error", text: "Please select a Reference" }); return; }
    if (Math.abs(totalAllocated - totalPool) > 1) {
      setMessage({ type: "error", text: `Allocated (₹${totalAllocated}) must equal Pool (₹${totalPool})` });
      return;
    }
    setSaving(true);
    try {
      await processSettlement({
        customer_name: selectedCustomer,
        ref: selectedRef,
        payment_date: payDate,
        payment_modes: selectedModes,
        fresh_payment: parseFloat(freshPay) || 0,
        use_advance: useAdvance,
        allot_fabric: parseFloat(allotFab) || 0,
        allot_tailoring: parseFloat(allotTail) || 0,
        allot_embroidery: parseFloat(allotEmb) || 0,
        allot_addon: parseFloat(allotAddon) || 0,
        allot_advance: parseFloat(allotAdv) || 0,
      });
      setMessage({ type: "success", text: "Settlement processed successfully!" });
      setFreshPay(""); setAllotFab(""); setAllotTail(""); setAllotEmb(""); setAllotAddon(""); setAllotAdv("");
      getBalances({ name: selectedCustomer, ref: selectedRef }).then(res => setBalances(res.data));
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed" });
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

  return (
    <div data-testid="settlements-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight">Payment Settlement</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Process payments and allocate across categories</p>
      </div>

      {message && (
        <div className={`p-4 border rounded-sm text-sm ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selection */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
            {/* Mode Toggle */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mode" checked={mode === "customer"} onChange={() => setMode("customer")} className="accent-[var(--brand)]" />
                <span className="text-sm">By Customer</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mode" checked={mode === "order"} onChange={() => setMode("order")} className="accent-[var(--brand)]" />
                <span className="text-sm">By Order No.</span>
              </label>
            </div>

            {mode === "customer" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Customer</label>
                  <select data-testid="settle-customer" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                    <option value="">Select</option>
                    {customers.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Reference</label>
                  <select data-testid="settle-ref" value={selectedRef} onChange={e => setSelectedRef(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                    <option value="">Select</option>
                    {refs.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Order No.</label>
                <select data-testid="settle-order" value={selectedOrder} onChange={e => setSelectedOrder(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                  <option value="">Select</option>
                  {orders.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}

            {/* Balances */}
            {selectedRef && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {[
                  { label: "Fabric", value: balances.fabric, color: "var(--warning)" },
                  { label: "Tailoring", value: balances.tailoring, color: "var(--info)" },
                  { label: "Embroidery", value: balances.embroidery, color: "var(--brand)" },
                  { label: "Add-on", value: balances.addon, color: "var(--text-secondary)" },
                ].map(b => (
                  <div key={b.label} className="p-3 bg-[var(--bg)] rounded-sm">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">{b.label} Balance</p>
                    <p className="font-mono text-lg font-medium mt-0.5" style={{ color: b.color }}>₹{fmt(b.value)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Allocation */}
          {selectedRef && (
            <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
              <h3 className="font-heading text-base font-medium">Allocate Payment</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Fabric</label>
                  <input data-testid="allot-fabric" type="number" value={allotFab} onChange={e => setAllotFab(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Tailoring</label>
                  <input data-testid="allot-tailoring" type="number" value={allotTail} onChange={e => setAllotTail(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Embroidery</label>
                  <input data-testid="allot-embroidery" type="number" value={allotEmb} onChange={e => setAllotEmb(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Add-on</label>
                  <input data-testid="allot-addon" type="number" value={allotAddon} onChange={e => setAllotAddon(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">New Advance</label>
                  <input data-testid="allot-advance" type="number" value={allotAdv} onChange={e => setAllotAdv(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Panel */}
        <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
          <h3 className="font-heading text-base font-medium">Payment Details</h3>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Payment Date</label>
            <input data-testid="settle-pay-date" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Fresh Payment</label>
            <input data-testid="settle-fresh-pay" type="number" value={freshPay} onChange={e => setFreshPay(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" placeholder="0" />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={useAdvance} onChange={e => setUseAdvance(e.target.checked)} className="w-4 h-4 accent-[var(--brand)]" />
            <span className="text-sm">Use Advance (₹{fmt(balances.advance)})</span>
          </label>

          <div className="p-3 bg-[var(--bg)] rounded-sm space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Total Pool</span>
              <span className="font-mono font-medium">₹{fmt(totalPool)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Allocated</span>
              <span className={`font-mono font-medium ${Math.abs(totalAllocated - totalPool) > 1 ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>₹{fmt(totalAllocated)}</span>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-2">Payment Mode</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_MODES.map(m => (
                <button key={m} onClick={() => toggleMode(m)} className={`px-2.5 py-1 text-xs font-medium rounded-sm border transition-all ${selectedModes.includes(m) ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'bg-white text-[var(--text-secondary)] border-[var(--border-subtle)]'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button data-testid="submit-settlement-btn" onClick={handleSubmit} disabled={saving} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50 transition-all">
            {saving ? "Processing..." : <><CurrencyDollar size={18} weight="bold" /> Process Settlement</>}
          </button>
        </div>
      </div>
    </div>
  );
}
