import React, { useState, useEffect } from "react";
import { getSettings, addAddons, assignTailoring, splitTailoring, getItems, invalidateItemsCache } from "@/api";
import { X, Check, Plus, Trash, Scissors, Tag, PlusCircle, ArrowsSplit } from "@phosphor-icons/react";

const DEFAULT_ADDON_ITEMS = ["Bow","Tie","Cufflinks","Stall","Buttons","Saffa","Dye","Malla","Kalangi"];
const EMB_OPTIONS = ["Not Required","Required"];
const ARTICLE_TYPES = ["Shirt","Pant","Gurkha Pant","Kurta","Pajama","Blazer","Safari Shirt","Indo","Sherwani","Jacket","W Coat"];

// ─── Split sub-form ───────────────────────────────────────────
function SplitForm({ item, articleTypes, onConfirm, onCancel }) {
  const [splits, setSplits] = useState([{ article_type: articleTypes[0] || "Shirt", qty: "" }]);
  const used = splits.reduce((s, sp) => s + (parseFloat(sp.qty) || 0), 0);
  const rem  = Math.round((item.qty - used) * 100) / 100;
  const valid = Math.abs(rem) < 0.01 && splits.some(s => parseFloat(s.qty) > 0);

  const update = (i, f, v) => setSplits(p => p.map((s, j) => j === i ? { ...s, [f]: v } : s));

  return (
    <>
      <div className="space-y-2">
        {splits.map((sp, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <select value={sp.article_type} onChange={e => update(i, "article_type", e.target.value)}
              className="col-span-5 px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]">
              {articleTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" step="0.1" value={sp.qty} onChange={e => update(i, "qty", e.target.value)}
              placeholder="Qty (m)"
              className="col-span-6 px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]"/>
            <button onClick={() => setSplits(p => p.filter((_, j) => j !== i))} disabled={splits.length <= 1}
              className="col-span-1 p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm disabled:opacity-30">
              <Trash size={14}/>
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1">
        <button onClick={() => setSplits(p => [...p, { article_type: articleTypes[0] || "Shirt", qty: "" }])}
          className="flex items-center gap-1 text-xs text-[var(--brand)] hover:underline">
          <Plus size={14}/> Add garment
        </button>
        <p className={`font-mono text-sm font-medium ${valid ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
          Remaining: {rem.toFixed(2)}m
        </p>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Cancel</button>
        <button onClick={() => onConfirm(splits.filter(s => parseFloat(s.qty) > 0).map(s => ({ ...s, qty: parseFloat(s.qty) })))}
          disabled={!valid}
          className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50">
          Confirm Split
        </button>
      </div>
    </>
  );
}

// ─── Tailoring Overlay ────────────────────────────────────────
export function TailoringOverlay({ group, onClose, onSuccess }) {
  const [assignments, setAssignments] = useState([]);
  const [splitItem, setSplitItem] = useState(null);
  const [articleTypes, setArticleTypes] = useState(ARTICLE_TYPES);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    getSettings().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.article_types) && s.article_types.length > 0) setArticleTypes(s.article_types);
    }).catch(() => {});

    // Items awaiting assignment = no order_no or tailoring_status is Awaiting Order
    const awaiting = group.items.filter(i =>
      !i.order_no || i.order_no === "N/A" || i.tailoring_status === "Awaiting Order"
    );
    setAssignments(awaiting.map(item => ({
      item_id: item.id, barcode: item.barcode, qty: item.qty,
      article_type: item.article_type !== "N/A" ? item.article_type : "Shirt",
      embroidery_status: item.embroidery_status !== "N/A" ? item.embroidery_status : "Not Required",
      order_no: "", delivery_date: "", selected: true,
    })));
  }, [group]);

  const update = (i, f, v) => setAssignments(p => p.map((a, j) => j === i ? { ...a, [f]: v } : a));

  const handleSplitConfirm = async (splits) => {
    try {
      await splitTailoring({ item_id: splitItem.item_id, splits });
      setSplitItem(null);
      setMsg({ type: "success", text: "Split done — update order details below if needed" });
    } catch {
      setMsg({ type: "error", text: "Split failed" });
    }
  };

  const handleAssign = async () => {
    const sel = assignments.filter(a => a.selected);
    if (!sel.length) { setMsg({ type: "error", text: "Select at least one item" }); return; }
    const missing = sel.filter(a => !a.order_no || !a.delivery_date);
    if (missing.length) { setMsg({ type: "error", text: "Order No & Delivery Date required for all selected items" }); return; }
    setSaving(true);
    try {
      const groups = {};
      sel.forEach(a => {
        const k = `${a.order_no}|${a.delivery_date}`;
        if (!groups[k]) groups[k] = { order_no: a.order_no, delivery_date: a.delivery_date, items: [] };
        groups[k].items.push({ item_id: a.item_id, article_type: a.article_type, embroidery_status: a.embroidery_status });
      });
      for (const g of Object.values(groups)) {
        await assignTailoring({
          item_ids: g.items.map(i => i.item_id),
          order_no: g.order_no,
          delivery_date: g.delivery_date,
          assignments: g.items,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.detail || "Assignment failed" });
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-t-lg sm:rounded-sm shadow-2xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-shrink-0 bg-[#5C8A9E08]">
          <div>
            <h3 className="font-heading text-base font-medium flex items-center gap-2">
              <Scissors size={16}/> Assign Tailoring Order
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              <span className="font-mono text-[var(--brand)]">{group.ref}</span> · {group.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--bg)] rounded-sm text-[var(--text-secondary)]"><X size={16}/></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {msg && (
            <div className={`mb-3 p-3 rounded-sm text-sm border ${msg.type === "success" ? "bg-[#455D4A10] border-[var(--success)] text-[var(--success)]" : "bg-[#9E473D10] border-[var(--error)] text-[var(--error)]"}`}>
              {msg.text}
            </div>
          )}
          {assignments.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--text-secondary)]">
              No items awaiting tailoring assignment for this order.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[var(--bg)] border-b border-[var(--border-subtle)]">
                    <th className="px-2 py-2 w-8"></th>
                    <th className="text-left px-2 py-2">Item</th>
                    <th className="text-right px-2 py-2 whitespace-nowrap">Qty (m)</th>
                    <th className="text-left px-2 py-2 whitespace-nowrap">Order No.</th>
                    <th className="text-left px-2 py-2">Delivery</th>
                    <th className="text-left px-2 py-2">Article</th>
                    <th className="text-left px-2 py-2">Emb.</th>
                    <th className="text-center px-2 py-2">Split</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a, i) => (
                    <tr key={i} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="px-2 py-2">
                        <input type="checkbox" checked={a.selected} onChange={e => update(i, "selected", e.target.checked)}
                          className="w-4 h-4 accent-[var(--brand)]"/>
                      </td>
                      <td className="px-2 py-2 font-mono text-[var(--brand)]">{a.barcode}</td>
                      <td className="px-2 py-2 text-right font-mono">{a.qty}m</td>
                      <td className="px-2 py-2">
                        <input type="text" value={a.order_no} onChange={e => update(i, "order_no", e.target.value)}
                          placeholder="e.g. 801"
                          className="w-20 px-2 py-1 border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]"/>
                      </td>
                      <td className="px-2 py-2">
                        <input type="date" value={a.delivery_date} onChange={e => update(i, "delivery_date", e.target.value)}
                          className="w-32 px-2 py-1 border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]"/>
                      </td>
                      <td className="px-2 py-2">
                        <select value={a.article_type} onChange={e => update(i, "article_type", e.target.value)}
                          className="px-2 py-1 border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]">
                          {articleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select value={a.embroidery_status} onChange={e => update(i, "embroidery_status", e.target.value)}
                          className="px-2 py-1 border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]">
                          {EMB_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => setSplitItem(a)} title="Split fabric"
                          className="p-1.5 text-[var(--brand)] hover:bg-[#C86B4D10] rounded-sm">
                          <ArrowsSplit size={14}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-subtle)] flex justify-end gap-2 flex-shrink-0 bg-[var(--bg)]">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--surface)]">Cancel</button>
          <button onClick={handleAssign} disabled={saving || assignments.length === 0}
            className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50 flex items-center gap-2">
            {saving ? "Saving…" : <><Check size={14}/> Assign Order</>}
          </button>
        </div>
      </div>

      {/* Split sub-modal */}
      {splitItem && (
        <div className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4" onClick={() => setSplitItem(null)}>
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm max-w-lg w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="font-heading text-lg font-medium">Split Fabric</h3>
              <p className="text-sm text-[var(--text-secondary)]">Total: <span className="font-mono font-medium">{splitItem.qty}m</span> · {splitItem.barcode}</p>
            </div>
            <SplitForm item={splitItem} articleTypes={articleTypes} onConfirm={handleSplitConfirm} onCancel={() => setSplitItem(null)}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Add-on Overlay ───────────────────────────────────────────
export function AddOnOverlay({ group, onClose, onSuccess }) {
  const [articles, setArticles] = useState(group.items || []);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [addonItems, setAddonItems] = useState(DEFAULT_ADDON_ITEMS);
  const [addons, setAddons] = useState(DEFAULT_ADDON_ITEMS.map(n => ({ name: n, checked: false, price: "" })));
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.addon_items) && s.addon_items.length > 0) {
        setAddonItems(s.addon_items);
        setAddons(s.addon_items.map(n => ({ name: n, checked: false, price: "" })));
      }
    }).catch(() => {});
  }, []);

  const toggle = idx => setAddons(p => p.map((a, i) => i === idx ? { ...a, checked: !a.checked, price: !a.checked ? a.price : "" } : a));

  const handleSave = async () => {
    if (!selectedArticle) { setMsg({ type: "error", text: "Select an article first" }); return; }
    const sel = addons.filter(a => a.checked && a.price);
    if (!sel.length) { setMsg({ type: "error", text: "Select at least one add-on with a price" }); return; }
    setSaving(true);
    try {
      const res = await addAddons({
        item_id: selectedArticle.id,
        addons: sel.map(a => ({ name: a.name, price: parseFloat(a.price) })),
      });
      setMsg({ type: "success", text: `Add-ons saved! Total: ₹${res.data.addon_amount}` });
      setAddons(addonItems.map(n => ({ name: n, checked: false, price: "" })));
      invalidateItemsCache();
      const fresh = await getItems({ ref: group.ref });
      const items = fresh.data.items || [];
      setArticles(items);
      const updated = items.find(a => a.id === selectedArticle.id);
      if (updated) setSelectedArticle(updated);
      onSuccess();
    } catch {
      setMsg({ type: "error", text: "Failed to save add-ons" });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-t-lg sm:rounded-sm shadow-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-shrink-0 bg-[#C86B4D08]">
          <div>
            <h3 className="font-heading text-base font-medium flex items-center gap-2">
              <Tag size={16}/> Add-ons
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              <span className="font-mono text-[var(--brand)]">{group.ref}</span> · {group.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--bg)] rounded-sm text-[var(--text-secondary)]"><X size={16}/></button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
          {/* Article list */}
          <div className="sm:w-1/2 border-b sm:border-b-0 sm:border-r border-[var(--border-subtle)] overflow-y-auto">
            <div className="px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg)] flex-shrink-0">
              <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">Articles ({articles.length})</p>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {articles.map(art => (
                <button key={art.id}
                  onClick={() => { setSelectedArticle(art); setAddons(addonItems.map(n => ({ name: n, checked: false, price: "" }))); }}
                  className={`w-full text-left px-4 py-3 transition-colors ${selectedArticle?.id === art.id ? "bg-[#C86B4D10]" : "hover:bg-[var(--bg)]"}`}>
                  <p className="text-xs font-medium font-mono text-[var(--brand)]">{art.barcode}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    ₹{art.price} × {art.qty}m · {art.article_type !== "N/A" ? art.article_type : "—"}
                  </p>
                  {art.addon_desc && art.addon_desc !== "N/A" && (
                    <p className="text-[10px] text-[var(--success)] mt-0.5">Added: {art.addon_desc}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Add-on panel */}
          <div className="sm:w-1/2 p-4 space-y-3 overflow-y-auto">
            {msg && (
              <div className={`p-2.5 rounded-sm text-xs border ${msg.type === "success" ? "bg-[#455D4A10] border-[var(--success)] text-[var(--success)]" : "bg-[#9E473D10] border-[var(--error)] text-[var(--error)]"}`}>
                {msg.text}
              </div>
            )}
            {!selectedArticle ? (
              <p className="text-sm text-[var(--text-secondary)] pt-6 text-center">Select an article to add accessories</p>
            ) : (
              <>
                <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">
                  Adding to: <span className="font-mono text-[var(--brand)] normal-case">{selectedArticle.barcode}</span>
                </p>
                {selectedArticle.addon_desc && selectedArticle.addon_desc !== "N/A" && (
                  <div className="bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm p-3">
                    <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] mb-1">Already added</p>
                    <p className="text-xs">{selectedArticle.addon_desc}</p>
                    <p className="text-[10px] font-mono text-[var(--brand)] mt-0.5">₹{selectedArticle.addon_amount}</p>
                  </div>
                )}
                <div className="space-y-1.5">
                  {addons.map((a, i) => (
                    <div key={a.name} className="flex items-center gap-2">
                      <input type="checkbox" checked={a.checked} onChange={() => toggle(i)} className="w-4 h-4 accent-[var(--brand)]"/>
                      <span className="text-xs w-20 flex-shrink-0">{a.name}</span>
                      <input type="number" value={a.price}
                        onChange={e => setAddons(p => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                        disabled={!a.checked} placeholder="Price"
                        className="flex-1 px-2 py-1 text-xs border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)] disabled:bg-[var(--bg)] disabled:text-[var(--text-secondary)] bg-[var(--surface)]"/>
                    </div>
                  ))}
                </div>
                <button onClick={handleSave} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50">
                  {saving ? "Saving…" : <><PlusCircle size={16} weight="bold"/> Save Add-ons</>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
