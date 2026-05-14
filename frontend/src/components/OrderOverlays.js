import React, { useState, useEffect } from "react";
import { getSettings, addAddons, assignTailoring, splitTailoring, getItems, invalidateItemsCache } from "@/api";
import { DatePickerInput } from "@/components/DatePickerInput";
import { X, Check, Plus, Trash, Scissors, Tag, PlusCircle, ArrowsSplit, Package, Info, User, Calendar, CaretDown, CaretRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const EMB_OPTIONS = ["Not Required", "Required"];

// ─── Split sub-form ───────────────────────────────────────────
function SplitForm({ item, articleTypes, onConfirm, onCancel }) {
  const [splits, setSplits] = useState([{ article_type: articleTypes[0] || "Shirt", qty: "" }]);
  const used = splits.reduce((s, sp) => s + (parseFloat(sp.qty) || 0), 0);
  const rem = Math.round((item.qty - used) * 100) / 100;
  const valid = Math.abs(rem) < 0.01 && splits.some(s => parseFloat(s.qty) > 0);

  const update = (i, f, v) => setSplits(p => p.map((s, j) => j === i ? { ...s, [f]: v } : s));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {splits.map((sp, i) => (
          <div key={i} className="flex gap-2 items-center animate-in slide-in-from-left-2 duration-200">
            <select
              value={sp.article_type}
              onChange={e => update(i, "article_type", e.target.value)}
              className="flex-1 h-9 px-3 text-xs border border-border/50 rounded-lg bg-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
            >
              {articleTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="relative w-32">
              <input
                type="number"
                step="0.1"
                value={sp.qty}
                onChange={e => update(i, "qty", e.target.value)}
                placeholder="Qty (m)"
                className="w-full h-9 pl-3 pr-8 text-xs border border-border/50 rounded-lg bg-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-mono"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">m</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSplits(p => p.filter((_, j) => j !== i))}
              disabled={splits.length <= 1}
              className="h-9 w-9 text-destructive hover:bg-destructive/10 shrink-0"
            >
              <Trash size={16} />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSplits(p => [...p, { article_type: articleTypes[0] || "Shirt", qty: "" }])}
          className="h-8 gap-2 text-[10px] font-bold uppercase tracking-widest border-primary/20 text-primary hover:bg-primary/5"
        >
          <Plus size={14} weight="bold" /> Add Garment
        </Button>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground/60 mb-1">Remaining</p>
          <p className={cn("font-mono text-sm font-black", valid ? "text-success" : "text-destructive")}>
            {rem.toFixed(2)}m
          </p>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-border/50">
        <Button variant="ghost" onClick={onCancel} className="h-10 text-[10px] font-black uppercase tracking-widest px-6">
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm(splits.filter(s => parseFloat(s.qty) > 0).map(s => ({ ...s, qty: parseFloat(s.qty) })))}
          disabled={!valid}
          className="h-10 px-8 gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
        >
          Confirm Split
        </Button>
      </div>
    </div>
  );
}

// ─── Tailoring Overlay ────────────────────────────────────────
export function TailoringOverlay({ group, onClose, onSuccess }) {
  const [assignments, setAssignments] = useState([]);
  const [splitItem, setSplitItem] = useState(null);
  const [articleTypes, setArticleTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    getSettings().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.article_types) && s.article_types.length > 0) setArticleTypes(s.article_types);
    }).catch(() => setArticleTypes(["Shirt"]));

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
      setMsg({ type: "success", text: "Split successful! Update order details below." });
      
      invalidateItemsCache();
      const res = await getItems({ ref: group.ref });
      const items = res.data.items || [];
      const awaiting = items.filter(i =>
        !i.order_no || i.order_no === "N/A" || i.tailoring_status === "Awaiting Order"
      );
      setAssignments(awaiting.map(item => ({
        item_id: item.id, barcode: item.barcode, qty: item.qty,
        article_type: item.article_type !== "N/A" ? item.article_type : "Shirt",
        embroidery_status: item.embroidery_status !== "N/A" ? item.embroidery_status : "Not Required",
        order_no: "", delivery_date: "", selected: true,
      })));
    } catch {
      setMsg({ type: "error", text: "Split failed" });
    }
  };

  const handleAssign = async () => {
    const sel = assignments.filter(a => a.selected);
    if (!sel.length) { setMsg({ type: "error", text: "Please select at least one item" }); return; }
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300" onClick={onClose}>
      <Card className="w-full sm:max-w-4xl max-h-[94vh] flex flex-col shadow-2xl border-border/50 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <CardHeader className="px-6 py-5 border-b border-border/50 bg-info/[0.03] shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10 text-info">
                  <Scissors size={20} weight="duotone" />
                </div>
                <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">Tailoring Assignment</CardTitle>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground ml-11">
                <Badge variant="outline" className="font-mono text-[10px] h-5 px-2 bg-background border-primary/20 text-primary">
                  {group.ref}
                </Badge>
                <span className="opacity-30">|</span>
                <span className="uppercase tracking-widest">{group.name}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full hover:bg-muted/50"><X size={20}/></Button>
          </div>
        </CardHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {msg && (
            <Badge 
              variant={msg.type === "success" ? "success" : "destructive"} 
              className="w-full py-3 justify-center mb-6 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-2"
            >
              {msg.type === "success" ? <CheckCircle className="mr-2" size={14}/> : <Info className="mr-2" size={14}/>}
              {msg.text}
            </Badge>
          )}

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <Package size={48} weight="duotone" className="mb-4" />
              <p className="text-[11px] font-black uppercase tracking-[0.2em]">No Items Awaiting Assignment</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50 shadow-sm">
              <table className="w-full text-xs min-w-[850px]">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-4 py-3.5 w-10 border-b border-border/50"></th>
                    <th className="text-left px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">Article</th>
                    <th className="text-right px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">Qty (m)</th>
                    <th className="text-left px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-24">Order No</th>
                    <th className="text-left px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-44">Delivery Date</th>
                    <th className="text-left px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-32">Article Type</th>
                    <th className="text-left px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-36">Embroidery</th>
                    <th className="text-center px-4 py-3.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-16">Split</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 bg-background">
                  {assignments.map((a, i) => (
                    <tr key={i} className={cn("hover:bg-muted/10 transition-colors", !a.selected && "opacity-40")}>
                      <td className="px-4 py-3.5">
                        <input 
                          type="checkbox" 
                          checked={a.selected} 
                          onChange={e => update(i, "selected", e.target.checked)}
                          className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary/20 accent-primary transition-all"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-black text-primary">{a.barcode}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-mono text-xs font-bold">{a.qty}m</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <input 
                          type="text" 
                          value={a.order_no} 
                          onChange={e => update(i, "order_no", e.target.value)}
                          placeholder="e.g. 801"
                          className="w-full h-8 px-2 text-[11px] font-mono border border-border/50 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted/20 transition-all outline-none"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <DatePickerInput value={a.delivery_date} onChange={(val) => update(i, "delivery_date", val)} placeholder="Select date" />
                      </td>
                      <td className="px-4 py-3.5">
                        <select 
                          value={a.article_type} 
                          onChange={e => update(i, "article_type", e.target.value)}
                          className="w-full h-8 px-2 text-[11px] font-bold border border-border/50 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted/20 transition-all outline-none"
                        >
                          {articleTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3.5">
                        <select 
                          value={a.embroidery_status} 
                          onChange={e => update(i, "embroidery_status", e.target.value)}
                          className="w-full h-8 px-2 text-[11px] font-bold border border-border/50 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted/20 transition-all outline-none"
                        >
                          {EMB_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSplitItem(a)}
                          className="h-8 w-8 text-primary hover:bg-primary/10"
                          title="Split article"
                        >
                          <ArrowsSplit size={14} weight="bold" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <CardContent className="px-6 py-4 border-t border-border/50 bg-muted/30 shrink-0 flex justify-end items-center gap-3">
          <Button variant="ghost" onClick={onClose} className="h-10 text-[10px] font-black uppercase tracking-widest px-6">
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={saving || assignments.length === 0}
            className="h-10 px-10 gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
          >
            {saving ? (
              <>Processing <ArrowsClockwise size={14} className="animate-spin" /></>
            ) : (
              <><Check size={16} weight="bold"/> Confirm Assignment</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Split sub-modal */}
      {splitItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setSplitItem(null)}>
          <Card className="max-w-md w-full shadow-2xl border-border/50 animate-in zoom-in-95 duration-300 overflow-hidden" onClick={e => e.stopPropagation()}>
            <CardHeader className="px-6 py-5 border-b border-border/50 bg-primary/[0.03]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <ArrowsSplit size={18} weight="duotone" />
                </div>
                <CardTitle className="text-base font-black uppercase tracking-[0.2em]">Split Fabric</CardTitle>
              </div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1.5 ml-11">
                Total available: <span className="font-mono text-foreground">{splitItem.qty}m</span> · <span className="font-mono">{splitItem.barcode}</span>
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <SplitForm item={splitItem} articleTypes={articleTypes} onConfirm={handleSplitConfirm} onCancel={() => setSplitItem(null)}/>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Add-on Overlay ───────────────────────────────────────────
export function AddOnOverlay({ group, onClose, onSuccess }) {
  const [articles, setArticles] = useState(group.items || []);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [addonItems, setAddonItems] = useState([]);
  const [addons, setAddons] = useState([]);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.addon_items) && s.addon_items.length > 0) {
        setAddonItems(s.addon_items);
        setAddons(s.addon_items.map(n => ({ name: n, checked: false, price: "" })));
      }
    }).catch((err) => {
      setAddonItems([]);
      setAddons([]);
      setMsg({ type: "error", text: err.message || "Failed to load add-on items" });
    });
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300" onClick={onClose}>
      <Card className="w-full sm:max-w-4xl max-h-[94vh] flex flex-col shadow-2xl border-border/50 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 overflow-hidden" onClick={e => e.stopPropagation()}>
        
        <CardHeader className="px-6 py-5 border-b border-border/50 bg-warning/[0.03] shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10 text-warning">
                  <Tag size={20} weight="duotone" />
                </div>
                <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">Order Add-ons</CardTitle>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground ml-11">
                <Badge variant="outline" className="font-mono text-[10px] h-5 px-2 bg-background border-primary/20 text-primary">
                  {group.ref}
                </Badge>
                <span className="opacity-30">|</span>
                <span className="uppercase tracking-widest">{group.name}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full hover:bg-muted/50"><X size={20}/></Button>
          </div>
        </CardHeader>

        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden bg-background">
          {/* Article list */}
          <div className="sm:w-2/5 border-b sm:border-b-0 sm:border-r border-border/50 flex flex-col bg-muted/5">
            <div className="px-5 py-3 border-b border-border/50 bg-muted/10">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Articles ({articles.length})</p>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-border/40">
              {articles.map(art => (
                <button 
                  key={art.id}
                  onClick={() => { setSelectedArticle(art); setAddons(addonItems.map(n => ({ name: n, checked: false, price: "" }))); }}
                  className={cn(
                    "w-full text-left px-5 py-4 transition-all relative group",
                    selectedArticle?.id === art.id 
                      ? "bg-primary/[0.04] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary" 
                      : "hover:bg-muted/20"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className={cn("text-xs font-mono font-black transition-colors", selectedArticle?.id === art.id ? "text-primary" : "text-foreground")}>
                      {art.barcode}
                    </p>
                    {art.addon_desc && art.addon_desc !== "N/A" && <Badge variant="success" className="h-3.5 px-1 text-[8px] uppercase tracking-tighter">Added</Badge>}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    <span>{art.article_type !== "N/A" ? art.article_type : "Article"}</span>
                    <span className="opacity-30">·</span>
                    <span className="font-mono">{art.qty}m</span>
                  </div>
                  {art.addon_desc && art.addon_desc !== "N/A" && (
                    <p className="text-[9px] font-medium text-success mt-2 truncate max-w-full italic">
                      {art.addon_desc}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Add-on panel */}
          <div className="flex-1 p-6 flex flex-col overflow-hidden">
            {msg && (
              <Badge 
                variant={msg.type === "success" ? "success" : "destructive"} 
                className="w-full py-2.5 justify-center mb-6 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-2"
              >
                {msg.text}
              </Badge>
            )}

            {!selectedArticle ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                <Package size={48} weight="duotone" className="mb-4" />
                <p className="text-[11px] font-black uppercase tracking-[0.2em] max-w-[200px]">Select an article from the list to manage add-ons</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Configuring Add-ons for</p>
                    <p className="font-mono text-sm font-black text-primary">{selectedArticle.barcode}</p>
                  </div>
                  {selectedArticle.addon_amount > 0 && (
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Current Total</p>
                      <p className="font-mono text-sm font-black text-success">₹{fmt(selectedArticle.addon_amount)}</p>
                    </div>
                  )}
                </div>

                {selectedArticle.addon_desc && selectedArticle.addon_desc !== "N/A" && (
                  <Card className="bg-muted/10 border-border/40 shadow-none">
                    <CardContent className="p-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-1.5">Previously Added</p>
                      <p className="text-[11px] font-bold text-muted-foreground leading-relaxed">
                        {selectedArticle.addon_desc}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                  {addons.map((a, i) => (
                    <div 
                      key={a.name} 
                      className={cn(
                        "flex items-center gap-4 p-3 rounded-xl border transition-all",
                        a.checked ? "border-primary/30 bg-primary/[0.02] shadow-sm" : "border-border/50 hover:border-border"
                      )}
                    >
                      <input 
                        type="checkbox" 
                        checked={a.checked} 
                        onChange={() => toggle(i)} 
                        className="w-4.5 h-4.5 rounded border-border/50 text-primary focus:ring-primary/20 accent-primary transition-all shrink-0"
                      />
                      <span className={cn("text-xs font-bold uppercase tracking-wide flex-1", a.checked ? "text-foreground" : "text-muted-foreground/60")}>
                        {a.name}
                      </span>
                      <div className="relative w-28">
                        <input 
                          type="number" 
                          value={a.price}
                          onChange={e => setAddons(p => p.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                          disabled={!a.checked} 
                          placeholder="Price"
                          className="w-full h-8 pl-6 pr-2 text-xs font-mono border border-border/50 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background transition-all outline-none disabled:opacity-30 disabled:bg-muted/50"
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">₹</span>
                      </div>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="w-full h-11 gap-3 text-[10px] font-black uppercase tracking-[0.3em] shadow-lg shadow-primary/20"
                >
                  {saving ? (
                    <>Saving Changes <ArrowsClockwise size={16} className="animate-spin" /></>
                  ) : (
                    <><PlusCircle size={18} weight="bold"/> Update Add-ons</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
