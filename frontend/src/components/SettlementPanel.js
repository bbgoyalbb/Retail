import { useState, useEffect, useCallback } from "react";
import { getBalances, processSettlement, getSettings } from "@/api";
import { invalidate } from "@/lib/dataEvents";
import { fmt } from "@/lib/fmt";
import { CurrencyDollar, X } from "@phosphor-icons/react";

/**
 * SettlementPanel — self-contained settlement form rendered inside a modal overlay.
 * Props:
 *   ref       : bill ref pre-selected (locked, cannot change)
 *   customer  : customer name (locked)
 *   onClose   : called when user closes or after successful settlement
 */
export default function SettlementPanel({ billRef, customer, onClose }) {
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
  const [paymentModes, setPaymentModes] = useState(["Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"]);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const clearAllotments = useCallback(() => {
    setAllotFab(""); setAllotTail(""); setAllotEmb(""); setAllotAddon(""); setAllotAdv("");
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getBalances({ ref: billRef }),
      getSettings(),
    ]).then(([balRes, settRes]) => {
      setBalances(balRes.data);
      const s = settRes.data || {};
      if (Array.isArray(s.payment_modes) && s.payment_modes.length > 0) setPaymentModes(s.payment_modes);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [billRef]);

  const totalPending = balances.fabric + balances.tailoring + balances.embroidery + balances.addon;
  const totalPool = (parseFloat(freshPay) || 0) + (useAdvance ? balances.advance : 0);
  const totalAllocated = (parseFloat(allotFab) || 0) + (parseFloat(allotTail) || 0) + (parseFloat(allotEmb) || 0) + (parseFloat(allotAddon) || 0) + (parseFloat(allotAdv) || 0);

  const toggleMode = (m) => setSelectedModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const autoDistribute = useCallback((pool) => {
    const p = pool !== undefined ? pool : totalPool;
    if (p <= 0) return;
    const all = [
      { bal: balances.fabric,     setter: setAllotFab },
      { bal: balances.tailoring,  setter: setAllotTail },
      { bal: balances.embroidery, setter: setAllotEmb },
      { bal: balances.addon,      setter: setAllotAddon },
    ];
    const sections = all.filter(s => s.bal > 0);
    if (sections.length === 0) return;
    const pendingTotal = sections.reduce((s, x) => s + x.bal, 0);
    let running = 0;
    sections.forEach((s, idx) => {
      let share = idx === sections.length - 1 ? Math.round(p - running) : Math.round(p * (s.bal / pendingTotal));
      running += share;
      s.setter(String(share));
    });
    all.filter(s => s.bal <= 0).forEach(s => s.setter(""));
    setAllotAdv("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balances, totalPool]);

  useEffect(() => {
    if (!billRef) return;
    const pool = (parseFloat(freshPay) || 0) + (useAdvance ? balances.advance : 0);
    if (pool > 0) autoDistribute(pool);
    else clearAllotments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshPay, useAdvance, billRef, autoDistribute, clearAllotments]);

  const handleSubmit = async () => {
    if (totalAllocated <= 0) { setMessage({ type: "error", text: "Please allocate at least some amount" }); return; }
    setSaving(true);
    try {
      await processSettlement({
        customer_name: customer,
        ref: billRef,
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
      invalidate("dashboard");
      invalidate("daybook");
      setMessage({ type: "success", text: "Settlement processed successfully!" });
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Settlement failed" });
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-shrink-0 bg-[#C86B4D08]">
          <div>
            <h3 className="font-heading text-base font-medium">Re-Settle Order</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              <span className="font-mono font-medium text-[var(--brand)]">{billRef}</span>
              <span className="mx-2 text-[var(--border-strong)]">·</span>
              {customer}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] rounded-sm transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-8 text-center text-sm text-[var(--text-secondary)]">Loading balances…</div>
          ) : (
            <>
              {message && (
                <div className={`p-3 rounded-sm text-sm ${message.type === "success" ? "bg-[#455D4A10] border border-[var(--success)] text-[var(--success)]" : "bg-[#9E473D10] border border-[var(--error)] text-[var(--error)]"}`}>
                  {message.text}
                </div>
              )}

              {/* Pending Balances */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">Updated Balances</p>
                  <span className="font-mono text-sm font-medium text-[var(--error)]">₹{fmt(totalPending)}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Fabric",    value: balances.fabric,     color: "var(--warning)" },
                    { label: "Tailoring", value: balances.tailoring,  color: "var(--info)" },
                    { label: "Emb.",      value: balances.embroidery, color: "var(--brand)" },
                    { label: "Add-on",    value: balances.addon,      color: "var(--text-secondary)" },
                  ].map(b => (
                    <div key={b.label} className={`p-2.5 rounded-sm text-center ${b.value < 0 ? "bg-[#9E473D08] border border-[var(--error)]" : "bg-[var(--bg)]"}`}>
                      <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">{b.label}</p>
                      <p className="font-mono text-sm font-medium mt-0.5" style={{ color: b.value < 0 ? "var(--error)" : b.color }}>₹{fmt(b.value)}</p>
                    </div>
                  ))}
                </div>
                {balances.advance > 0 && (
                  <div className="mt-2 p-2.5 bg-[#455D4A08] rounded-sm flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">Advance available</span>
                    <span className="font-mono text-sm font-medium text-[var(--success)]">₹{fmt(balances.advance)}</span>
                  </div>
                )}
              </div>

              {/* Payment Date */}
              <div>
                <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Payment Date</label>
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]" />
              </div>

              {/* Fresh Payment */}
              <div>
                <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Fresh Payment</label>
                <input type="number" value={freshPay} onChange={e => setFreshPay(e.target.value)} placeholder="Amount received" className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]" />
              </div>

              {/* Use Advance */}
              {balances.advance > 0 && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={useAdvance} onChange={e => setUseAdvance(e.target.checked)} className="w-4 h-4 accent-[var(--brand)]" />
                  <span className="text-sm">Use Advance (₹{fmt(balances.advance)})</span>
                </label>
              )}

              {/* Allocate */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">Allocate</p>
                  <button onClick={() => autoDistribute()} disabled={totalPool <= 0} className="text-xs text-[var(--brand)] hover:underline disabled:opacity-40">Auto-distribute</button>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Fabric",      value: allotFab,   setter: setAllotFab,   balance: balances.fabric },
                    { label: "Tailoring",   value: allotTail,  setter: setAllotTail,  balance: balances.tailoring },
                    { label: "Embroidery",  value: allotEmb,   setter: setAllotEmb,   balance: balances.embroidery },
                    { label: "Add-on",      value: allotAddon, setter: setAllotAddon, balance: balances.addon },
                    { label: "New Advance", value: allotAdv,   setter: setAllotAdv,   balance: null },
                  ].filter(s => s.balance === null || s.balance > 0).map(s => (
                    <div key={s.label} className="flex items-center gap-2">
                      <label className="w-24 text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] flex-shrink-0">{s.label}</label>
                      <input
                        type="number" value={s.value} onChange={e => s.setter(e.target.value)} placeholder="0"
                        className="flex-1 px-3 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]"
                      />
                      {s.balance !== null && s.balance > 0 && (
                        <button onClick={() => s.setter(String(s.balance))} className="flex-shrink-0 text-[10px] px-2 py-1 text-[var(--brand)] border border-[var(--brand)] rounded-sm hover:bg-[#C86B4D10] whitespace-nowrap">Full</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="p-3 bg-[var(--bg)] rounded-sm space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Total Pending</span>
                  <span className="font-mono font-medium text-[var(--warning)]">₹{fmt(totalPending)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Payment Pool</span>
                  <span className="font-mono font-medium">₹{fmt(totalPool)}</span>
                </div>
                <div className="flex justify-between border-t border-[var(--border-subtle)] pt-1.5">
                  <span className="text-[var(--text-secondary)]">Allocated</span>
                  <span className={`font-mono font-medium ${Math.abs(totalAllocated - totalPool) > 1 ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>₹{fmt(totalAllocated)}</span>
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-2">Payment Mode</label>
                <div className="flex flex-wrap gap-2">
                  {paymentModes.map(m => (
                    <button key={m} onClick={() => toggleMode(m)} className={`px-2.5 py-1 text-xs font-medium rounded-sm border transition-all ${selectedModes.includes(m) ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex gap-2 justify-end flex-shrink-0 bg-[var(--bg)]">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--surface)] transition-colors">Skip for now</button>
            <button onClick={handleSubmit} disabled={saving || totalAllocated <= 0} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50 flex items-center gap-2 transition-colors">
              {saving ? "Processing…" : <><CurrencyDollar size={14} weight="bold" /> Process Settlement</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
