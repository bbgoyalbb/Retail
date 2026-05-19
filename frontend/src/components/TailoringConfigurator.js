import React, { useState, useEffect, useMemo } from "react";
import { X, Check, Plus, Trash, Scissors, ArrowsSplit, Package, Info, CheckCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerInput } from "@/components/DatePickerInput";
import { cn } from "@/lib/utils";
import { getSettings } from "@/api";

const EMB_OPTIONS = ["Not Required", "Required"];

// ─── Split Form Sub-component ─────────────────────────────────
function SplitForm({ item, articleTypes, onConfirm, onCancel }) {
  const [splits, setSplits] = useState([{ article_type: "N/A", qty: "" }]);
  const used = splits.reduce((s, sp) => s + (parseFloat(sp.qty) || 0), 0);
  const rem = Math.round((item.qty - used) * 100) / 100;
  const valid = Math.abs(rem) < 0.01 && splits.some(s => parseFloat(s.qty) > 0);

  const update = (i, f, v) => setSplits(p => p.map((s, j) => j === i ? { ...s, [f]: v } : s));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {splits.map((sp, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              value={sp.article_type}
              onChange={e => update(i, "article_type", e.target.value)}
              className="flex-1 h-9 px-3 text-xs border border-border/50 rounded-lg bg-muted/20 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
            >
              <option value="N/A">N/A</option>
              {articleTypes.filter(t => t !== "N/A").map(t => <option key={t} value={t}>{t}</option>)}
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
          onClick={() => setSplits(p => [...p, { article_type: "N/A", qty: "" }])}
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
          <CheckCircle size={16} /> Confirm Split
        </Button>
      </div>
    </div>
  );
}

// ─── Main Tailoring Configurator Component ──────────────────────
export function TailoringConfigurator({ 
  items, 
  onChange, 
  onSave, 
  onClose, 
  onSplit, // Callback for edit mode to split item in database
  mode = "create", // "create" (NewBill) or "edit" (Item Manager)
  customerName,
  title = "Tailoring Configuration",
  saveButtonText = mode === "create" ? "Save Configuration" : "Confirm Assignment"
}) {
  const [assignments, setAssignments] = useState([]);
  const [splitItem, setSplitItem] = useState(null);
  const [articleTypes, setArticleTypes] = useState([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Normalize items to assignments format
  useEffect(() => {
    getSettings().then(res => {
      const s = res.data || {};
      if (Array.isArray(s.article_types) && s.article_types.length > 0) setArticleTypes(s.article_types);
    }).catch(() => setArticleTypes(["Shirt", "Pant", "Kurta"]));

    // Convert incoming items to assignment format
    const normalized = items.map(item => ({
      item_id: item.id || item._id || `temp_${Date.now()}_${Math.random()}`,
      barcode: item.barcode,
      qty: item.qty,
      article_type: item.tailoring?.article_type || "N/A",
      embroidery_status: item.tailoring?.embroidery_status || item.embroidery_status || "Not Required",
      order_no: item.tailoring?.order_no || "",
      delivery_date: item.tailoring?.delivery_date || "",
      selected: true,
      // Keep reference to original item for callbacks
      _original: item,
      _original_item_id: item.id || item._id
    }));
    setAssignments(normalized);
  }, [items, articleTypes]);

  // Copy order_no and delivery_date from first selected item to all other selected items
  const copyToAll = () => {
    const firstSelected = assignments.find(a => a.selected);
    if (!firstSelected) {
      setMsg({ type: "error", text: "Please select at least one item with values to copy" });
      return;
    }
    if (!firstSelected.order_no || !firstSelected.delivery_date) {
      setMsg({ type: "error", text: "Please fill Order No and Delivery Date in the first selected item" });
      return;
    }
    
    const newAssignments = assignments.map(a => 
      a.selected ? { ...a, order_no: firstSelected.order_no, delivery_date: firstSelected.delivery_date } : a
    );
    setAssignments(newAssignments);
    setMsg({ type: "success", text: `Copied to ${newAssignments.filter(a => a.selected).length} items` });
    setTimeout(() => setMsg(null), 2000);
    
    if (mode === "create" && onChange) {
      onChange(newAssignments.map(({ _original, ...rest }) => ({
        ...rest,
        _original_item_id: rest._original_item_id
      })));
    }
  };

  const update = (i, f, v) => {
    const newAssignments = assignments.map((a, j) => j === i ? { ...a, [f]: v } : a);
    setAssignments(newAssignments);
    // Notify parent of changes (for create mode)
    // Include _original_item_id so parent can map back to original items
    if (mode === "create" && onChange) {
      onChange(newAssignments.map(({ _original, ...rest }) => ({
        ...rest,
        _original_item_id: rest._original_item_id
      })));
    }
  };

  const handleSplitClick = (item) => {
    setSplitItem({
      item_id: item.item_id,
      barcode: item.barcode,
      qty: item.qty,
      originalQty: item.qty
    });
  };

  const handleSplitConfirm = async (splits) => {
    const idx = assignments.findIndex(a => a.item_id === splitItem.item_id);
    if (idx === -1) return;
    
    const original = assignments[idx];
    
    // In edit mode, call API to actually split the item in database
    if (mode === "edit" && onSplit) {
      setSaving(true);
      try {
        // Call the split API - returns new item IDs
        const result = await onSplit({
          item_id: original._original_item_id || original.item_id,
          splits: splits.map(s => ({
            article_type: s.article_type || original.article_type,
            qty: parseFloat(s.qty) || 0
          }))
        });
        
        // The API should return the new split item IDs
        const newItemIds = result?.item_ids || result?.new_item_ids || [];
        
        // Create split assignments with the new database IDs
        const splitAssignments = splits.map((sp, i) => ({
          item_id: newItemIds[i] || `${original.item_id}_split_${i}_${Date.now()}`,
          barcode: original.barcode,
          qty: parseFloat(sp.qty) || 0,
          article_type: sp.article_type || original.article_type,
          embroidery_status: original.embroidery_status,
          order_no: "",
          delivery_date: "",
          selected: true,
          _original_item_id: newItemIds[i] || original._original_item_id || original.item_id
        }));
        
        const newAssignments = [...assignments];
        newAssignments.splice(idx, 1, ...splitAssignments);
        setAssignments(newAssignments);
        setSplitItem(null);
      } catch (err) {
        setMsg({ type: "error", text: err?.message || "Failed to split item" });
      } finally {
        setSaving(false);
      }
      return;
    }
    
    // Create mode: client-side split only
    const originalDbItemId = original._original_item_id || original.item_id;
    
    const splitAssignments = splits.map((sp, i) => ({
      item_id: `${original.item_id}_split_${i}_${Date.now()}`,
      barcode: original.barcode,
      qty: parseFloat(sp.qty) || 0,
      article_type: sp.article_type || original.article_type,
      embroidery_status: original.embroidery_status,
      order_no: "",
      delivery_date: "",
      selected: true,
      _original_item_id: originalDbItemId
    }));
    
    // Replace original with split parts
    const newAssignments = [...assignments];
    newAssignments.splice(idx, 1, ...splitAssignments);
    setAssignments(newAssignments);
    setSplitItem(null);
    
    // Notify parent
    // Include _original_item_id so parent can map back to original items after split
    if (mode === "create" && onChange) {
      onChange(newAssignments.map(({ _original, ...rest }) => ({
        ...rest,
        _original_item_id: rest._original_item_id
      })));
    }
  };

  const handleSave = async () => {
    const sel = assignments.filter(a => a.selected);
    if (!sel.length) { setMsg({ type: "error", text: "Please select at least one item" }); return; }
    const missing = sel.filter(a => !a.order_no || !a.delivery_date);
    if (missing.length) { setMsg({ type: "error", text: "Order No & Delivery Date required for all selected items" }); return; }
    
    setSaving(true);
    try {
      // Build payload for save
      // Use original DB item ID for split items so backend can find them
      const payload = sel.map(a => ({
        item_id: a._original_item_id || a.item_id,
        barcode: a.barcode,
        qty: a.qty,
        article_type: a.article_type,
        embroidery_status: a.embroidery_status,
        order_no: a.order_no,
        delivery_date: a.delivery_date
      }));
      
      await onSave(payload);
      setMsg({ type: "success", text: "Tailoring configuration saved!" });
      setTimeout(() => onClose(), 500);
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[150] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <Card 
        className="w-full sm:max-w-4xl max-h-[94vh] flex flex-col shadow-2xl border-border/50 animate-in zoom-in-95 duration-150 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <CardHeader className="px-6 py-5 border-b border-border/50 bg-info/[0.03] shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10 text-info">
                  <Scissors size={20} weight="duotone" />
                </div>
                <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">{title}</CardTitle>
              </div>
              {customerName && (
                <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground ml-11">
                  <span className="uppercase tracking-widest">{customerName}</span>
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-10 w-10 rounded-full hover:bg-muted/50">
              <X size={20}/>
            </Button>
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
              <p className="text-[11px] font-black uppercase tracking-[0.2em]">No Items Awaiting Configuration</p>
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
                    <tr key={a.item_id} className={cn("hover:bg-muted/10 transition-colors", !a.selected && "opacity-40")}>
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
                        <DatePickerInput 
                          value={a.delivery_date} 
                          onChange={(val) => update(i, "delivery_date", val)} 
                          placeholder="Select date" 
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <select 
                          value={a.article_type} 
                          onChange={e => update(i, "article_type", e.target.value)}
                          className="w-full h-8 px-2 text-[11px] font-bold border border-border/50 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted/20 transition-all outline-none"
                        >
                          <option value="N/A">N/A</option>
                          {articleTypes.filter(t => t !== "N/A").map(t => <option key={t} value={t}>{t}</option>)}
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
                          onClick={() => handleSplitClick(a)}
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

        <CardContent className="px-6 py-4 border-t border-border/50 bg-muted/30 shrink-0 flex justify-between items-center gap-3">
          <Button 
            variant="outline" 
            onClick={copyToAll} 
            disabled={assignments.filter(a => a.selected).length < 2}
            className="h-10 text-[10px] font-black uppercase tracking-widest px-4 gap-2"
            title="Copy Order No and Delivery Date from first selected item to all other selected items"
          >
            <Plus size={14} weight="bold" /> Copy to All Selected
          </Button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} className="h-10 text-[10px] font-black uppercase tracking-widest px-6">
              Cancel
            </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || assignments.length === 0}
            className="h-10 px-10 gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
          >
            {saving ? (
              <>Processing <span className="animate-spin">⟳</span></>
            ) : (
              <><Check size={16} weight="bold"/> {saveButtonText}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Split sub-modal */}
      {splitItem && (
        <div 
          className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          onClick={() => setSplitItem(null)}
        >
          <Card 
            className="max-w-md w-full shadow-2xl border-border/50 animate-in zoom-in-95 duration-150 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
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
              <SplitForm 
                item={splitItem} 
                articleTypes={articleTypes} 
                onConfirm={handleSplitConfirm} 
                onCancel={() => setSplitItem(null)}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default TailoringConfigurator;
