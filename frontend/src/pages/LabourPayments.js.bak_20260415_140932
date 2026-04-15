import { useState, useEffect, useCallback } from "react";
import { getLabourItems, getKarigars, payLabour } from "@/api";
import { UsersThree, CurrencyDollar } from "@phosphor-icons/react";

const PAYMENT_MODES = ["Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"];

export default function LabourPayments() {
  const [filterType, setFilterType] = useState("All");
  const [filterKarigar, setFilterKarigar] = useState("All");
  const [karigars, setKarigars] = useState([]);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedModes, setSelectedModes] = useState(["Cash"]);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(() => {
    getLabourItems({ filter_type: filterType, filter_karigar: filterKarigar })
      .then(res => setItems(res.data))
      .catch(console.error);
  }, [filterType, filterKarigar]);

  useEffect(() => {
    getKarigars().then(res => setKarigars(res.data)).catch(() => {});
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
    return sum + (i.labour_type === "Tailoring" ? (i.labour_amount || 0) : (i.embroidery_amount || 0));
  }, 0);

  const toggleMode = (m) => setSelectedModes(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);

  const handlePay = async () => {
    if (selected.length === 0) { setMessage({ type: "error", text: "Select at least one item" }); return; }

    const tailoringIds = items.filter(i => selected.includes(i.id) && i.labour_type === "Tailoring").map(i => i.id);
    const embroideryIds = items.filter(i => selected.includes(i.id) && i.labour_type === "Embroidery").map(i => i.id);

    setSaving(true);
    try {
      if (tailoringIds.length > 0) {
        await payLabour({ item_ids: tailoringIds, labour_type: "tailoring", payment_date: payDate, payment_modes: selectedModes });
      }
      if (embroideryIds.length > 0) {
        await payLabour({ item_ids: embroideryIds, labour_type: "embroidery", payment_date: payDate, payment_modes: selectedModes });
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

  const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));
  const totalUnpaid = items.reduce((sum, i) => sum + (i.labour_type === "Tailoring" ? (i.labour_amount || 0) : (i.embroidery_amount || 0)), 0);

  return (
    <div data-testid="labour-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight">Labour Payments</h1>
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
          <div className="bg-white border border-[var(--border-subtle)] p-4 rounded-sm flex flex-wrap gap-3 items-center">
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
            <div className="ml-auto flex gap-4 text-sm">
              <span className="text-[var(--text-secondary)]">Unpaid: <span className="font-mono font-medium text-[var(--warning)]">₹{fmt(totalUnpaid)}</span></span>
              <span className="text-[var(--text-secondary)]">Selected: <span className="font-mono font-medium text-[var(--brand)]">₹{fmt(selectedTotal)}</span></span>
            </div>
          </div>

          <div className="bg-white border border-[var(--border-subtle)] rounded-sm">
            {items.length === 0 ? (
              <div className="p-12 text-center">
                <pre className="text-[var(--border-strong)] text-xs mb-4 font-mono">
{`  .--.
 /    \\
|  OK  |
 \\    /
  '--'
All paid!`}
                </pre>
                <p className="text-[var(--text-secondary)] text-sm">No pending labour payments</p>
              </div>
            ) : (
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
                      const amount = item.labour_type === "Tailoring" ? item.labour_amount : item.embroidery_amount;
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
            )}
          </div>
        </div>

        {/* Payment Panel */}
        <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4 h-fit">
          <h3 className="font-heading text-base font-medium">Process Payment</h3>

          <div>
            <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Payment Date</label>
            <input data-testid="labour-pay-date" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" />
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
