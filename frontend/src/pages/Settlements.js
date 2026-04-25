import { useState, useEffect, useRef, useCallback } from "react";
import { getPendingCustomers, getPendingRefs, getPendingOrders, getBalances, processSettlement, getItems, getSettings } from "@/api";
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
  const [selectedModes, setSelectedModes] = useState([]);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [orderInfo, setOrderInfo] = useState(null);
  const [paymentModes, setPaymentModes] = useState(["Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"]);

  // Flag to prevent customer useEffect from clearing ref when set by order lookup
  const setByOrderRef = useRef(false);

  const reloadFilters = useCallback(() => {
    getPendingCustomers().then(res => setCustomers(res.data)).catch(() => {});
    getPendingOrders().then(res => setOrders(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    reloadFilters();
    getSettings().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.payment_modes) && s.payment_modes.length > 0) setPaymentModes(s.payment_modes);
    }).catch(() => {});
  }, [reloadFilters]);

  const loadBalances = useCallback((ref) => {
    getBalances({ ref }).then(res => {
      setBalances(res.data);
      // Don't pre-fill allotments — leave blank so fresh payment drives allocation.
      // User clicks Auto-distribute or enters amounts manually.
      setAllotFab(""); setAllotTail(""); setAllotEmb(""); setAllotAddon(""); setAllotAdv("");
    }).catch(() => {});
  }, []);

  // When customer changes via manual selection (not order lookup), load refs.
  // `mode` is intentionally included so switching modes doesn't leave stale refs loaded.
  useEffect(() => {
    if (setByOrderRef.current) {
      setByOrderRef.current = false;
      return;
    }
    if (selectedCustomer && mode === "customer") {
      getPendingRefs(selectedCustomer).then(res => {
        const sorted = (res.data || []).slice().sort((a, b) => {
          const parse = r => { const m = r.match(/^(\d+)\/(\d{2})(\d{2})(\d{2})$/); return m ? [`${m[4]}${m[3]}${m[2]}`, parseInt(m[1], 10)] : [r, 0]; };
          const [da, sa] = parse(a); const [db, sb] = parse(b);
          return da !== db ? db.localeCompare(da) : sb - sa;
        });
        setRefs(sorted);
      }).catch(() => {});
      setSelectedRef("");
      setBalances({ fabric: 0, tailoring: 0, embroidery: 0, addon: 0, advance: 0 });
    }
  }, [selectedCustomer, mode]);

  // When ref changes, load balances
  useEffect(() => {
    if (selectedRef) {
      loadBalances(selectedRef);
    }
  }, [selectedRef, loadBalances]);

  // When order number changes, look up the customer + ref.
  // `mode` is intentionally included so stale order lookups don't fire in customer mode.
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
  }, [selectedOrder, mode]);

  const totalPending = balances.fabric + balances.tailoring + balances.embroidery + balances.addon;
  const totalPool = (parseFloat(freshPay) || 0) + (useAdvance ? balances.advance : 0);
  const totalAllocated = (parseFloat(allotFab) || 0) + (parseFloat(allotTail) || 0) + (parseFloat(allotEmb) || 0) + (parseFloat(allotAddon) || 0) + (parseFloat(allotAdv) || 0);

  const toggleMode = (m) => setSelectedModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  // Auto-distribute: allocate the full pool pro-rata by pending balance across active sections.
  // Works for both normal payments and over-payments (pool > total pending).
  const autoDistribute = (pool = totalPool) => {
    if (pool <= 0) return;

    const all = [
      { bal: balances.fabric,     setter: setAllotFab },
      { bal: balances.tailoring,  setter: setAllotTail },
      { bal: balances.embroidery, setter: setAllotEmb },
      { bal: balances.addon,      setter: setAllotAddon },
    ];
    // Use sections that have a positive pending balance as weights.
    // If nothing is pending (all already settled), don't distribute — user should use New Advance.
    const sections = all.filter(s => s.bal > 0);
    if (sections.length === 0) return;

    const pendingTotal = sections.reduce((s, x) => s + x.bal, 0);
    let running = 0;
    sections.forEach((s, idx) => {
      let share;
      if (idx === sections.length - 1) {
        share = Math.round(pool - running);
      } else {
        share = Math.round(pool * (s.bal / pendingTotal));
        running += share;
      }
      s.setter(String(share));
    });
    // Zero out sections with no balance
    all.filter(s => s.bal <= 0).forEach(s => s.setter(""));
    setAllotAdv("");
  };

  // Auto-distribute whenever fresh payment changes (and a ref is loaded)
  useEffect(() => {
    if (!selectedRef) return;
    const pool = (parseFloat(freshPay) || 0) + (useAdvance ? balances.advance : 0);
    if (pool > 0) autoDistribute(pool);
    else { setAllotFab(""); setAllotTail(""); setAllotEmb(""); setAllotAddon(""); setAllotAdv(""); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshPay, useAdvance, selectedRef]);

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
      setSelectedModes([]);
      setSelectedCustomer(""); setSelectedRef(""); setSelectedOrder(""); setOrderInfo(null);
      setBalances({ fabric: 0, tailoring: 0, embroidery: 0, addon: 0, advance: 0 });
      reloadFilters();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed" });
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n) => {
    const v = n || 0;
    const abs = new Intl.NumberFormat('en-IN').format(Math.round(Math.abs(v)));
    return v < 0 ? `-${abs}` : abs;
  };
  const hasRef = selectedRef && selectedRef.length > 0;

  // Reset when switching modes
  const switchMode = (newMode) => {
    setMode(newMode);
    setSelectedCustomer(""); setSelectedRef(""); setSelectedOrder("");
    setOrderInfo(null);
    setBalances({ fabric: 0, tailoring: 0, embroidery: 0, addon: 0, advance: 0 });
    setAllotFab(""); setAllotTail(""); setAllotEmb(""); setAllotAddon(""); setAllotAdv("");
    setFreshPay("");
    setUseAdvance(false);
    setSelectedModes([]);
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
                    <option value="">All</option>
                    {customers.sort().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Reference</label>
                  <select data-testid="settle-ref" value={selectedRef} onChange={e => setSelectedRef(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                    <option value="">All</option>
                    {refs.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Order No.</label>
                <select data-testid="settle-order" value={selectedOrder} onChange={e => setSelectedOrder(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                  <option value="">All</option>
                  {orders.slice().sort((a, b) => { const na = parseInt(a, 10), nb = parseInt(b, 10); return !isNaN(na) && !isNaN(nb) ? na - nb : a.localeCompare(b); }).map(o => <option key={o} value={o}>{o}</option>)}
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
                    <div key={b.key} className={`p-3 rounded-sm ${b.value < 0 ? 'bg-[#9E473D08] border border-[var(--error)]' : 'bg-[var(--bg)]'}`}>
                      <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">{b.label}</p>
                      <p className="font-mono text-lg font-medium mt-0.5" style={{ color: b.value < 0 ? 'var(--error)' : b.color }}>₹{fmt(b.value)}</p>
                      {b.value < 0 && <p className="text-[9px] text-[var(--error)] mt-0.5">Credit</p>}
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
                  { key: "fabric",    label: "Fabric",      value: allotFab,   setter: setAllotFab,   balance: balances.fabric },
                  { key: "tailoring", label: "Tailoring",   value: allotTail,  setter: setAllotTail,  balance: balances.tailoring },
                  { key: "embroidery",label: "Embroidery",  value: allotEmb,   setter: setAllotEmb,   balance: balances.embroidery },
                  { key: "addon",     label: "Add-on",      value: allotAddon, setter: setAllotAddon, balance: balances.addon },
                  { key: "advance",   label: "New Advance", value: allotAdv,   setter: setAllotAdv,   balance: null },
                ].filter(s => s.balance === null || s.balance > 0).map(s => {
                  const allotted = parseFloat(s.value) || 0;
                  const isOver = s.balance !== null && allotted > s.balance + 0.5;
                  return (
                  <div key={s.key} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <label className="w-20 sm:w-24 text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] flex-shrink-0">{s.label}</label>
                      <input
                        data-testid={`allot-${s.key}`}
                        type="number"
                        value={s.value}
                        onChange={e => s.setter(e.target.value)}
                        placeholder="0"
                        className={`flex-1 min-w-0 px-3 py-2 text-sm border rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] ${
                          isOver ? 'border-[var(--warning)] bg-[#D4870010]' : 'border-[var(--border-subtle)]'
                        }`}
                      />
                      {s.balance !== null && s.balance > 0 && (
                        <button onClick={() => settleSection(s.key)} className="flex-shrink-0 text-[10px] px-2 py-1 text-[var(--brand)] border border-[var(--brand)] rounded-sm hover:bg-[#C86B4D10] whitespace-nowrap">
                          Full
                        </button>
                      )}
                    </div>
                    {isOver && (
                      <p className="text-[10px] text-[var(--warning)] pl-[calc(5rem+0.5rem)] sm:pl-[calc(6rem+0.5rem)]">
                        ⚠ Exceeds balance by ₹{fmt(allotted - s.balance)}. Pending will go negative.
                      </p>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Payment Panel */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-4 h-fit lg:sticky lg:top-8">
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
              <span className={`font-mono font-medium ${Math.abs(totalAllocated - totalPool) > 1 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>₹{fmt(totalAllocated)}</span>
            </div>
            {totalPool > 0 && Math.abs(totalAllocated - totalPool) > 1 && (
              <p className="text-[10px] text-[var(--warning)]">⚠ Allocated ≠ Pool (diff ₹{fmt(Math.abs(totalAllocated - totalPool))}). You can still proceed.</p>
            )}
            {totalPool > 0 && totalPool > totalPending && (
              <p className="text-[10px] text-[var(--warning)]">⚠ Payment exceeds pending balance. Excess will be applied as negative pending (credit).</p>
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
