import { useState, useEffect, useCallback } from "react";
import { getBalances, processSettlement, getSettings } from "@/api";
import { invalidate } from "@/lib/dataEvents";
import { fmt } from "@/lib/fmt";
import { CurrencyDollar, X, CheckCircle, CaretDown, CaretRight } from "@phosphor-icons/react";

/**
 * SettlementPanel — multi-ref capable settlement overlay.
 * Props:
 *   orders   : array of { ref, name (customer) } — 1 or many
 *   onClose  : called on close or after successful settlement
 *   onSuccess: optional, called after settlement success for parent refresh
 *
 * Single-ref compat shim: billRef + customer props still accepted.
 */
export default function SettlementPanel({ orders: ordersProp, billRef, customer, onClose, onSuccess }) {
  // Normalise to array
  const orders = ordersProp
    ? ordersProp
    : billRef ? [{ ref: billRef, name: customer }] : [];

  // Per-ref balance data: { [ref]: { fabric, tailoring, embroidery, addon, advance } }
  const [refBalances, setRefBalances] = useState({});
  const [paymentModes, setPaymentModes] = useState(["Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"]);
  const [loading, setLoading] = useState(true);

  // Payment inputs
  const [freshPay, setFreshPay] = useState("");
  const [useAdvance, setUseAdvance] = useState(false);
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedModes, setSelectedModes] = useState([]);

  // Per-ref allotment: { [ref]: { fabric, tailoring, embroidery, addon, advance } }
  const [allotments, setAllotments] = useState({});

  // UI state
  const [expandedRefs, setExpandedRefs] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState({ done: 0, total: 0 });

  // ── Load balances for all refs in parallel ──
  useEffect(() => {
    if (!orders.length) return;
    setLoading(true);
    Promise.all([
      ...orders.map(o => getBalances({ ref: o.ref }).then(r => ({ ref: o.ref, bal: r.data }))),
      getSettings(),
    ]).then(results => {
      const settRes = results[results.length - 1];
      const s = settRes.data || {};
      if (Array.isArray(s.payment_modes) && s.payment_modes.length > 0) setPaymentModes(s.payment_modes);
      const map = {};
      results.slice(0, -1).forEach(({ ref, bal }) => { map[ref] = bal; });
      setRefBalances(map);
      // Init allotments to zero
      const init = {};
      results.slice(0, -1).forEach(({ ref }) => {
        init[ref] = { fabric: "", tailoring: "", embroidery: "", addon: "", advance: "" };
      });
      setAllotments(init);
      // Auto-expand if single ref
      if (orders.length === 1) setExpandedRefs({ [orders[0].ref]: true });
    }).catch(() => {}).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.map(o => o.ref).join(",")]);

  // ── Aggregated totals ──
  const aggBalances = Object.values(refBalances).reduce(
    (acc, b) => ({
      fabric:     acc.fabric     + (b.fabric     || 0),
      tailoring:  acc.tailoring  + (b.tailoring  || 0),
      embroidery: acc.embroidery + (b.embroidery || 0),
      addon:      acc.addon      + (b.addon      || 0),
      advance:    acc.advance    + (b.advance     || 0),
    }),
    { fabric: 0, tailoring: 0, embroidery: 0, addon: 0, advance: 0 }
  );
  const totalPending = aggBalances.fabric + aggBalances.tailoring + aggBalances.embroidery + aggBalances.addon;
  const totalPool    = (parseFloat(freshPay) || 0) + (useAdvance ? aggBalances.advance : 0);
  const totalAlloc   = Object.values(allotments).reduce((sum, a) =>
    sum + (parseFloat(a.fabric) || 0) + (parseFloat(a.tailoring) || 0) +
          (parseFloat(a.embroidery) || 0) + (parseFloat(a.addon) || 0) + (parseFloat(a.advance) || 0), 0);

  const toggleMode = (m) => setSelectedModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  const toggleRef  = (ref) => setExpandedRefs(prev => ({ ...prev, [ref]: !prev[ref] }));

  const setRefAllot = (ref, field, val) =>
    setAllotments(prev => ({ ...prev, [ref]: { ...prev[ref], [field]: val } }));

  // ── Auto-distribute across all refs proportionally ──
  const autoDistribute = useCallback((pool) => {
    const p = pool !== undefined ? pool : totalPool;
    if (p <= 0) return;
    const sections = ["fabric", "tailoring", "embroidery", "addon"];
    const refTotals = orders.map(o => ({
      ref: o.ref,
      bal: sections.reduce((s, k) => s + (refBalances[o.ref]?.[k] || 0), 0),
    })).filter(r => r.bal > 0);
    const grandPending = refTotals.reduce((s, r) => s + r.bal, 0);
    if (grandPending <= 0) return;

    const newAllot = { ...allotments };
    let running = 0;
    refTotals.forEach((r, ri) => {
      const refShare = ri === refTotals.length - 1
        ? Math.round(p - running)
        : Math.round(p * (r.bal / grandPending));
      running += refShare;
      const refBal = refBalances[r.ref] || {};
      const refSections = sections.map(k => ({ k, v: refBal[k] || 0 })).filter(x => x.v > 0);
      const refPend = refSections.reduce((s, x) => s + x.v, 0);
      let sRunning = 0;
      const newRef = { ...newAllot[r.ref] };
      refSections.forEach((x, si) => {
        const share = si === refSections.length - 1
          ? Math.round(refShare - sRunning)
          : Math.round(refShare * (x.v / refPend));
        sRunning += share;
        newRef[x.k] = String(share);
      });
      sections.filter(k => !(refBal[k] > 0)).forEach(k => { newRef[k] = ""; });
      newRef.advance = "";
      newAllot[r.ref] = newRef;
    });
    setAllotments(newAllot);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refBalances, totalPool, orders, allotments]);

  useEffect(() => {
    if (loading) return;
    const pool = (parseFloat(freshPay) || 0) + (useAdvance ? aggBalances.advance : 0);
    if (pool > 0) autoDistribute(pool);
    else setAllotments(prev => {
      const reset = {};
      Object.keys(prev).forEach(ref => {
        reset[ref] = { fabric: "", tailoring: "", embroidery: "", addon: "", advance: "" };
      });
      return reset;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshPay, useAdvance, loading]);

  // ── Submit — one settlement per ref ──
  const handleSubmit = async () => {
    if (totalAlloc <= 0)          { setMessage({ type: "error", text: "Allocate at least some amount" }); return; }
    if (selectedModes.length === 0) { setMessage({ type: "error", text: "Select at least one payment mode" }); return; }
    setSaving(true);
    setSavingProgress({ done: 0, total: orders.length });
    let failed = 0;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const a = allotments[o.ref] || {};
      const anyAlloc = ["fabric","tailoring","embroidery","addon","advance"].some(k => parseFloat(a[k]) > 0);
      if (!anyAlloc) { setSavingProgress(p => ({ ...p, done: p.done + 1 })); continue; }
      try {
        await processSettlement({
          customer_name: o.name,
          ref: o.ref,
          payment_date: payDate,
          payment_modes: selectedModes,
          fresh_payment: parseFloat(freshPay) || 0,
          use_advance: useAdvance,
          allot_fabric:     parseFloat(a.fabric)    || 0,
          allot_tailoring:  parseFloat(a.tailoring) || 0,
          allot_embroidery: parseFloat(a.embroidery)|| 0,
          allot_addon:      parseFloat(a.addon)     || 0,
          allot_advance:    parseFloat(a.advance)   || 0,
        });
        setSavingProgress(p => ({ ...p, done: p.done + 1 }));
      } catch {
        failed++;
        setSavingProgress(p => ({ ...p, done: p.done + 1 }));
      }
    }
    invalidate("dashboard");
    invalidate("daybook");
    if (failed > 0) {
      setMessage({ type: "error", text: `${failed} settlement(s) failed. Rest processed.` });
      setSaving(false);
    } else {
      setMessage({ type: "success", text: `${orders.length} settlement(s) processed!` });
      onSuccess?.();
      setTimeout(() => onClose(), 1400);
    }
  };

  const isMulti = orders.length > 1;

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-t-lg sm:rounded-sm shadow-2xl w-full sm:max-w-xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-start justify-between flex-shrink-0 bg-[#C86B4D08]">
          <div className="min-w-0">
            <h3 className="font-heading text-base font-medium">Collect Payment</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
              {isMulti
                ? <><span className="font-medium text-[var(--brand)]">{orders.length} orders</span> · ₹{fmt(totalPending)} pending</>
                : <><span className="font-mono font-medium text-[var(--brand)]">{orders[0]?.ref}</span><span className="mx-1.5 text-[var(--border-strong)]">·</span>{orders[0]?.name}</>
              }
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] rounded-sm transition-colors flex-shrink-0 ml-3">
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-10 flex flex-col items-center gap-3 text-[var(--text-secondary)]">
              <div className="w-6 h-6 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading balances…</span>
            </div>
          ) : (
            <>
              {message && (
                <div className={`p-3 rounded-sm text-sm flex items-start gap-2 ${message.type === "success" ? "bg-[#455D4A10] border border-[var(--success)] text-[var(--success)]" : "bg-[#9E473D10] border border-[var(--error)] text-[var(--error)]"}`}>
                  {message.type === "success" && <CheckCircle size={15} weight="fill" className="flex-shrink-0 mt-0.5" />}
                  {message.text}
                </div>
              )}

              {/* ── Aggregated balance tiles ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">
                    {isMulti ? "Combined Pending" : "Pending Balances"}
                  </p>
                  <span className="font-mono text-sm font-semibold text-[var(--warning)]">₹{fmt(totalPending)}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Fabric",    value: aggBalances.fabric,     color: "var(--warning)" },
                    { label: "Tailoring", value: aggBalances.tailoring,  color: "var(--info)" },
                    { label: "Emb.",      value: aggBalances.embroidery, color: "var(--brand)" },
                    { label: "Add-on",    value: aggBalances.addon,      color: "var(--text-secondary)" },
                  ].map(b => b.value > 0 ? (
                    <div key={b.label} className="p-2 rounded-sm text-center bg-[var(--bg)] border border-[var(--border-subtle)]">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">{b.label}</p>
                      <p className="font-mono text-xs font-semibold mt-0.5" style={{ color: b.color }}>₹{fmt(b.value)}</p>
                    </div>
                  ) : null)}
                </div>
                {aggBalances.advance > 0 && (
                  <div className="mt-2 p-2.5 bg-[#455D4A08] border border-[#455D4A30] rounded-sm flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">Advance credit available</span>
                    <span className="font-mono text-sm font-semibold text-[var(--success)]">₹{fmt(aggBalances.advance)}</span>
                  </div>
                )}
              </div>

              {/* ── Payment Date + Fresh Amount ── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Payment Date</label>
                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Amount Received <span className="text-[var(--error)]">*</span></label>
                  <input type="number" value={freshPay} onChange={e => setFreshPay(e.target.value)}
                    placeholder="₹ 0"
                    className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]" />
                </div>
              </div>

              {/* Use Advance */}
              {aggBalances.advance > 0 && (
                <label className="flex items-center gap-3 cursor-pointer p-2.5 rounded-sm hover:bg-[var(--bg)] transition-colors -mx-1 px-1">
                  <input type="checkbox" checked={useAdvance} onChange={e => setUseAdvance(e.target.checked)} className="w-4 h-4 accent-[var(--brand)]" />
                  <span className="text-sm">Apply advance credit (₹{fmt(aggBalances.advance)})</span>
                </label>
              )}

              {/* ── Per-ref allotment ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">Allocate by Order</p>
                  <button onClick={() => autoDistribute()} disabled={totalPool <= 0}
                    className="text-xs text-[var(--brand)] hover:underline disabled:opacity-40 transition-opacity">
                    Auto-distribute
                  </button>
                </div>

                <div className="space-y-2">
                  {orders.map(o => {
                    const bal = refBalances[o.ref] || {};
                    const a   = allotments[o.ref]  || {};
                    const refPend = (bal.fabric || 0) + (bal.tailoring || 0) + (bal.embroidery || 0) + (bal.addon || 0);
                    const refAlloc = (parseFloat(a.fabric) || 0) + (parseFloat(a.tailoring) || 0) + (parseFloat(a.embroidery) || 0) + (parseFloat(a.addon) || 0) + (parseFloat(a.advance) || 0);
                    const isExpanded = expandedRefs[o.ref];
                    return (
                      <div key={o.ref} className="border border-[var(--border-subtle)] rounded-sm overflow-hidden">
                        {/* Ref header row */}
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--bg)] transition-colors"
                          onClick={() => toggleRef(o.ref)}
                        >
                          <span className="text-[var(--text-secondary)] flex-shrink-0">
                            {isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
                          </span>
                          <span className="font-mono text-xs text-[var(--brand)] font-medium">{o.ref}</span>
                          <span className="text-xs text-[var(--text-secondary)] truncate flex-1">{o.name}</span>
                          <span className="font-mono text-xs text-[var(--warning)] flex-shrink-0">₹{fmt(refPend)}</span>
                          {refAlloc > 0 && (
                            <span className="font-mono text-xs text-[var(--success)] flex-shrink-0">→ ₹{fmt(refAlloc)}</span>
                          )}
                        </button>

                        {/* Per-section inputs */}
                        {isExpanded && (
                          <div className="border-t border-[var(--border-subtle)] bg-[var(--bg)] px-3 py-3 space-y-2">
                            {[
                              { key: "fabric",     label: "Fabric" },
                              { key: "tailoring",  label: "Tailoring" },
                              { key: "embroidery", label: "Embroidery" },
                              { key: "addon",      label: "Add-on" },
                              { key: "advance",    label: "New Advance", noBalance: true },
                            ].filter(s => s.noBalance || (bal[s.key] || 0) > 0).map(s => (
                              <div key={s.key} className="flex items-center gap-2">
                                <label className="w-20 text-[10px] uppercase tracking-[0.12em] font-semibold text-[var(--text-secondary)] flex-shrink-0">{s.label}</label>
                                <input
                                  type="number" value={a[s.key] || ""} placeholder="0"
                                  onChange={e => setRefAllot(o.ref, s.key, e.target.value)}
                                  className="flex-1 px-2.5 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]"
                                />
                                {!s.noBalance && bal[s.key] > 0 && (
                                  <button
                                    onClick={() => setRefAllot(o.ref, s.key, String(bal[s.key]))}
                                    className="flex-shrink-0 text-[10px] px-2 py-1 text-[var(--brand)] border border-[var(--brand)]/40 rounded-sm hover:bg-[#C86B4D10] transition-colors whitespace-nowrap"
                                  >Full</button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Summary bar ── */}
              <div className="p-3 bg-[var(--bg)] rounded-sm border border-[var(--border-subtle)] grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Pending",   val: fmt(totalPending), color: "var(--warning)" },
                  { label: "Pool",      val: fmt(totalPool),    color: "var(--text-primary)" },
                  { label: "Allocated", val: fmt(totalAlloc),   color: Math.abs(totalAlloc - totalPool) > 1 ? "var(--warning)" : "var(--success)" },
                ].map(s => (
                  <div key={s.label}>
                    <p className="text-[9px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">{s.label}</p>
                    <p className="font-mono text-sm font-semibold mt-0.5" style={{ color: s.color }}>₹{s.val}</p>
                  </div>
                ))}
              </div>

              {/* ── Payment Modes ── */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-2">
                  Payment Mode <span className="text-[var(--error)]">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {paymentModes.map(m => (
                    <button key={m} onClick={() => toggleMode(m)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-sm border transition-all ${selectedModes.includes(m) ? "bg-[var(--brand)] text-white border-[var(--brand)]" : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--brand)] hover:text-[var(--brand)]"}`}>
                      {m}
                    </button>
                  ))}
                </div>
                {selectedModes.length === 0 && totalAlloc > 0 && (
                  <p className="text-[10px] text-[var(--error)] mt-1.5">Select at least one payment mode</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {!loading && (
          <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex items-center gap-3 flex-shrink-0 bg-[var(--bg)]">
            {saving && (
              <span className="text-xs text-[var(--text-secondary)] flex-1">
                Processing {savingProgress.done}/{savingProgress.total}…
              </span>
            )}
            {!saving && <div className="flex-1" />}
            <button onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--surface)] transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || totalAlloc <= 0 || selectedModes.length === 0}
              className="px-5 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50 flex items-center gap-2 transition-colors font-medium"
            >
              {saving
                ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing…</>
                : <><CurrencyDollar size={15} weight="bold" />Process {orders.length > 1 ? `${orders.length} Settlements` : "Settlement"}</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
