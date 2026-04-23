import { useState, useEffect, useRef } from "react";
import { getCustomers, getRefs, getBalances, processSettlement, getOrders, getItems, getSettings } from "@/api";
import { CurrencyDollar, CheckCircle } from "@phosphor-icons/react";

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
  const [orderInfo, setOrderInfo] = useState(null);
  const [paymentModes, setPaymentModes] = useState(["Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"]);

  // Flag to prevent customer useEffect from clearing ref when set by order lookup
  const setByOrderRef = useRef(false);

  useEffect(() => {
    getCustomers().then(res => setCustomers(res.data)).catch(() => {});
    getOrders().then(res => setOrders(res.data)).catch(() => {});
    getSettings().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.payment_modes) && s.payment_modes.length > 0) setPaymentModes(s.payment_modes);
    }).catch(() => {});
  }, []);

  // When customer changes via manual selection (not order lookup), load refs
  useEffect(() => {
    if (setByOrderRef.current) {
      setByOrderRef.current = false;
      return;
    }
    if (selectedCustomer && mode === "customer") {
      getRefs(selectedCustomer).then(res => setRefs(res.data)).catch(() => {});
      setSelectedRef("");
      setBalances({ fabric: 0, tailoring: 0, embroidery: 0, addon: 0, advance: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer]);

  // When ref changes, load balances
  useEffect(() => {
    if (selectedRef) {
      loadBalances(selectedRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRef]);

  // When order number changes, look up the customer + ref
  useEffect(() => {
    if (selectedOrder && mode === "order") {
      getItems({ order_no: selectedOrder, limit: 10 }).then(res => {
        if (res.data.items.length > 0) {
          const item = res.data.items[0];
          setByOrderRef.current = true; // Prevent customer effect from clearing ref
          setSelectedCustomer(item.name);
          setSelectedRef(item.ref);
          setOrderInfo({
            name: item.name,
            ref: item.ref,
            order_no: selectedOrder,
            items_count: res.data.items.length,
          });
        }
      }).catch(() => {});
    } else {
      setOrderInfo(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrder]);

  const loadBalances = (ref) => {
    getBalances({ ref }).then(res => {
      setBalances(res.data);
      setAllotFab(res.data.fabric > 0 ? String(res.data.fabric) : "");
      setAllotTail(res.data.tailoring > 0 ? String(res.data.tailoring) : "");
      setAllotEmb(res.data.embroidery > 0 ? String(res.data.embroidery) : "");
      setAllotAddon(res.data.addon > 0 ? String(res.data.addon) : "");
      setAllotAdv("");
    }).catch(() => {});
  };

  const totalPending = balances.fabric + balances.tailoring + balances.embroidery + balances.addon;
  const totalPool = (parseFloat(freshPay) || 0) + (useAdvance ? balances.advance : 0);
  const totalAllocated = (parseFloat(allotFab) || 0) + (parseFloat(allotTail) || 0) + (parseFloat(allotEmb) || 0) + (parseFloat(allotAddon) || 0) + (parseFloat(allotAdv) || 0);

  const toggleMode = (m) => setSelectedModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  // Auto-distribute: allocate freshPay across sections proportionally
  const autoDistribute = () => {
    if (totalPending <= 0) return;
    const pool = totalPool;
    if (pool <= 0) return;

    let remaining = pool;
    const fabShare = Math.min(balances.fabric, Math.round(pool * (balances.fabric / totalPending)));
    const tailShare = Math.min(balances.tailoring, Math.round(pool * (balances.tailoring / totalPending)));
    const embShare = Math.min(balances.embroidery, Math.round(pool * (balances.embroidery / totalPending)));
    remaining = pool - fabShare - tailShare - embShare;
    const addonShare = Math.min(balances.addon, Math.max(0, remaining));

    setAllotFab(fabShare > 0 ? String(fabShare) : "");
    setAllotTail(tailShare > 0 ? String(tailShare) : "");
    setAllotEmb(embShare > 0 ? String(embShare) : "");
    setAllotAddon(addonShare > 0 ? String(addonShare) : "");
    setAllotAdv("");
  };

  // Settle full section
  const settleSection = (section) => {
    if (section === "fabric") setAllotFab(String(balances.fabric));
    if (section === "tailoring") setAllotTail(String(balances.tailoring));
    if (section === "embroidery") setAllotEmb(String(balances.embroidery));
    if (section === "addon") setAllotAddon(String(balances.addon));
  };

  const handleSubmit = async () => {
    if (!selectedRef) { setMessage({ type: "error", text: "Please select a reference" }); return; }
    if (totalAllocated <= 0) { setMessage({ type: "error", text: "Please allocate at least some amount" }); return; }
    if (Math.abs(totalAllocated - totalPool) > 1) {
      setMessage({ type: "error", text: `Allocated (₹${fmt(totalAllocated)}) doesn't match Pool (₹${fmt(totalPool)})` });
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
      setMessage({ type: "success", text: "Settlement processed!" });
      setFreshPay(""); setAllotFab(""); setAllotTail(""); setAllotEmb(""); setAllotAddon(""); setAllotAdv("");
      loadBalances(selectedRef);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed" });
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
  const hasRef = selectedRef && selectedRef.length > 0;

  // Reset when switching modes
  const switchMode = (newMode) => {
    setMode(newMode);
    setSelectedCustomer(""); setSelectedRef(""); setSelectedOrder("");
    setOrderInfo(null);
    setBalances({ fabric: 0, tailoring: 0, embroidery: 0, addon: 0, advance: 0 });
    setAllotFab(""); setAllotTail(""); setAllotEmb(""); setAllotAddon(""); setAllotAdv("");
    setFreshPay("");
    setSelectedModes(["Cash"]);
  };

  return (
    <div data-testid="settlements-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Settlements</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Process payments and allocate across categories</p>
      </div>

      {message && (
        <div data-testid="settle-message" className={`p-4 border rounded-sm text-sm ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Selection Card */}
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mode" checked={mode === "customer"} onChange={() => switchMode("customer")} className="accent-[var(--brand)]" />
                <span className="text-sm font-medium">By Customer</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="mode" checked={mode === "order"} onChange={() => switchMode("order")} className="accent-[var(--brand)]" />
                <span className="text-sm font-medium">By Order No.</span>
              </label>
            </div>

            {mode === "customer" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Customer</label>
                  <select data-testid="settle-customer" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                    <option value="">Select customer</option>
                    {customers.sort().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Reference</label>
                  <select data-testid="settle-ref" value={selectedRef} onChange={e => setSelectedRef(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                    <option value="">Select reference</option>
                    {refs.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Order No.</label>
                <select data-testid="settle-order" value={selectedOrder} onChange={e => setSelectedOrder(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                  <option value="">Select order</option>
                  {orders.sort().map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                {orderInfo && (
                  <div className="mt-2 p-3 bg-[var(--bg)] rounded-sm text-sm">
                    <span className="font-medium">{orderInfo.name}</span>
                    <span className="mx-2 text-[var(--text-secondary)]">|</span>
                    <span className="font-mono text-xs">{orderInfo.ref}</span>
                    <span className="mx-2 text-[var(--text-secondary)]">|</span>
                    <span className="text-xs text-[var(--text-secondary)]">{orderInfo.items_count} items</span>
                  </div>
                )}
              </div>
            )}

            {/* Balances */}
            {hasRef && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">Pending Balances</h4>
                  <span className="font-mono text-sm font-medium text-[var(--error)]">Total: ₹{fmt(totalPending)}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { key: "fabric", label: "Fabric", value: balances.fabric, color: "var(--warning)" },
                    { key: "tailoring", label: "Tailoring", value: balances.tailoring, color: "var(--info)" },
                    { key: "embroidery", label: "Embroidery", value: balances.embroidery, color: "var(--brand)" },
                    { key: "addon", label: "Add-on", value: balances.addon, color: "var(--text-secondary)" },
                    { key: "advance", label: "Advance", value: balances.advance, color: "var(--success)" },
                  ].map(b => (
                    <div key={b.key} className="p-3 bg-[var(--bg)] rounded-sm">
                      <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">{b.label}</p>
                      <p className="font-mono text-lg font-medium mt-0.5" style={{ color: b.color }}>₹{fmt(b.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Allocation Card */}
          {hasRef && (
            <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-base font-medium">Allocate Payment</h3>
                <button data-testid="auto-distribute-btn" onClick={autoDistribute} disabled={totalPool <= 0} className="text-xs text-[var(--brand)] hover:underline disabled:opacity-40">
                  Auto-distribute
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { key: "fabric", label: "Fabric", value: allotFab, setter: setAllotFab, balance: balances.fabric },
                  { key: "tailoring", label: "Tailoring", value: allotTail, setter: setAllotTail, balance: balances.tailoring },
                  { key: "embroidery", label: "Embroidery", value: allotEmb, setter: setAllotEmb, balance: balances.embroidery },
                  { key: "addon", label: "Add-on", value: allotAddon, setter: setAllotAddon, balance: balances.addon },
                  { key: "advance", label: "New Advance", value: allotAdv, setter: setAllotAdv, balance: null },
                ].filter(s => s.balance === null || s.balance > 0).map(s => (
                  <div key={s.key} className="flex items-center gap-2">
                    <label className="w-20 sm:w-24 text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] flex-shrink-0">{s.label}</label>
                    <input data-testid={`allot-${s.key}`} type="number" value={s.value} onChange={e => s.setter(e.target.value)} placeholder="0" className="flex-1 min-w-0 px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
                    {s.balance !== null && s.balance > 0 && (
                      <button onClick={() => settleSection(s.key)} className="flex-shrink-0 text-[10px] px-2 py-1 text-[var(--brand)] border border-[var(--brand)] rounded-sm hover:bg-[#C86B4D10] whitespace-nowrap">
                        Full
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payment Panel */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-4 h-fit">
          <h3 className="font-heading text-base font-medium">Payment Details</h3>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Payment Date</label>
            <input data-testid="settle-pay-date" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
          </div>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Fresh Payment</label>
            <input data-testid="settle-fresh-pay" type="number" value={freshPay} onChange={e => setFreshPay(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" placeholder="Amount received" />
          </div>

          {balances.advance > 0 && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={useAdvance} onChange={e => setUseAdvance(e.target.checked)} className="w-4 h-4 accent-[var(--brand)]" />
              <span className="text-sm">Use Advance (₹{fmt(balances.advance)})</span>
            </label>
          )}

          <div className="p-3 bg-[var(--bg)] rounded-sm space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Total Pending</span>
              <span className="font-mono font-medium text-[var(--warning)]">₹{fmt(totalPending)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Payment Pool</span>
              <span className="font-mono font-medium">₹{fmt(totalPool)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-[var(--border-subtle)] pt-1.5">
              <span className="text-[var(--text-secondary)]">Allocated</span>
              <span className={`font-mono font-medium ${Math.abs(totalAllocated - totalPool) > 1 ? 'text-[var(--error)]' : 'text-[var(--success)]'}`}>₹{fmt(totalAllocated)}</span>
            </div>
            {totalPool > 0 && Math.abs(totalAllocated - totalPool) > 1 && (
              <p className="text-[10px] text-[var(--error)]">Allocated must match pool. Difference: ₹{fmt(Math.abs(totalAllocated - totalPool))}</p>
            )}
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

          <button data-testid="submit-settlement-btn" onClick={handleSubmit} disabled={saving || !hasRef} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50 transition-all">
            {saving ? "Processing..." : <><CurrencyDollar size={18} weight="bold" /> Process Settlement</>}
          </button>
        </div>
      </div>
    </div>
  );
}
