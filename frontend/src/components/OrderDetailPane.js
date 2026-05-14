import React, { useState } from "react";
import { fmt } from "@/lib/fmt";
import { 
  PencilSimple, Trash, X, CaretDown, CaretRight, 
  CheckCircle, CurrencyDollar, Package, Scissors, 
  Tag, Wallet, Info, Receipt, User
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const SectionAccordion = ({ icon: Icon, label, amount, children, onEdit, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md">
      <div 
        className="flex items-center gap-3 px-4 py-3.5 bg-muted/30 cursor-pointer select-none group/acc" 
        onClick={() => setOpen(o => !o)}
      >
        <div className="p-2 rounded-lg bg-primary/10 text-primary transition-all group-hover/acc:bg-primary/20 group-hover/acc:scale-110">
          <Icon size={16} weight="duotone" />
        </div>
        <span className="text-xs font-bold text-foreground flex-1 uppercase tracking-widest">{label}</span>
        {amount > 0 && (
          <Badge variant="secondary" className="font-mono font-bold px-2 py-0.5">
            ₹{fmt(amount)}
          </Badge>
        )}
        <div className="flex items-center gap-1.5 ml-2">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary hover:bg-primary/10"
              onClick={e => { e.stopPropagation(); onEdit(); }}
            >
              <PencilSimple size={14} weight="bold" />
            </Button>
          )}
          <div className={cn("transition-transform duration-300", open ? "rotate-0" : "-rotate-90")}>
            <CaretDown size={14} className="text-muted-foreground" />
          </div>
        </div>
      </div>
      {open && (
        <CardContent className="p-4 space-y-3 border-t border-border/50 bg-background animate-in slide-in-from-top-1 duration-300">
          {children}
        </CardContent>
      )}
    </Card>
  );
};

function ArticleWiseView({ selectedGroups, advances, onEdit, onCancelItem, onDeleteItem }) {
  return (
    <div className="space-y-8 pb-4">
      {selectedGroups.map(group => {
        const refAdvances = advances.filter(a => a.ref === group.ref);
        const totalAdvance = refAdvances.reduce((s, a) => s + a.amount, 0);
        const isSettled = group.totals.total > 0 && group.items.every(item =>
          [[item.fabric_amount, item.fabric_pay_mode],[item.tailoring_amount, item.tailoring_pay_mode],[item.embroidery_amount, item.embroidery_pay_mode],[item.addon_amount, item.addon_pay_mode]]
          .every(([amt, mode]) => !amt || Number(amt) === 0 || String(mode || "").startsWith("Settled"))
        );

        return (
          <div key={group.ref} className="space-y-4">
            {selectedGroups.length > 1 && (
              <div className="flex items-center gap-3 px-1">
                <Badge variant="outline" className="font-mono text-[11px] font-bold text-primary border-primary/20 bg-primary/5 px-2 py-0.5">
                  {group.ref}
                </Badge>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] truncate">{group.name}</span>
                <div className="flex-1 border-t border-border/40 border-dashed" />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {group.items.map(item => {
                const itemTotal = (item.fabric_amount||0) + (item.tailoring_amount||0) + (item.embroidery_amount||0) + (item.addon_amount||0);
                const itemPending =
                  (!String(item.fabric_pay_mode||"").startsWith("Settled") ? (item.fabric_pending||0) : 0) +
                  (!String(item.tailoring_pay_mode||"").startsWith("Settled") ? (item.tailoring_pending||0) : 0) +
                  (!String(item.embroidery_pay_mode||"").startsWith("Settled") ? (item.embroidery_pending||0) : 0) +
                  (!String(item.addon_pay_mode||"").startsWith("Settled") ? (item.addon_pending||0) : 0);
                
                if (itemTotal === 0 && !item.cancelled) return null;

                return (
                  <Card key={item.id} className={cn(
                    "overflow-hidden border-border/50 transition-all group/item",
                    item.cancelled ? "opacity-60" : "hover:border-primary/50 shadow-sm hover:shadow-md"
                  )}>
                    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/20">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className={cn("text-sm font-mono font-bold tracking-tight", item.cancelled ? "line-through text-muted-foreground" : "text-primary")}>
                            {item.barcode || "—"}
                          </p>
                          {item.cancelled && <Badge variant="destructive" className="h-4 text-[9px] px-1 uppercase tracking-tighter">Cancelled</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {item.article_type && item.article_type !== "N/A" && (
                            <Badge variant="outline" className="text-[9px] h-4.5 px-1.5 font-bold uppercase tracking-wider bg-background">
                              {item.article_type}
                            </Badge>
                          )}
                          {item.order_no && item.order_no !== "N/A" && (
                            <Badge variant="outline" className="text-[9px] h-4.5 px-1.5 font-mono font-bold bg-background">
                              #{item.order_no}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono text-sm font-black text-foreground">₹{fmt(itemTotal)}</p>
                        {!item.cancelled && itemPending !== 0 && (
                          <Badge 
                            variant={itemPending < 0 ? "destructive" : "warning"}
                            className="text-[9px] h-4.5 px-1.5 font-bold uppercase tracking-tighter mt-1"
                          >
                            ₹{fmt(itemPending)} PEND
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="px-4 py-3.5 space-y-2.5 bg-background border-t border-border/40">
                      {[
                        { show: item.fabric_amount > 0, icon: Package, label: "Fabric", details: `₹${fmt(item.price)}×${item.qty}m${item.discount>0?` -${item.discount}%`:""}`, value: item.fabric_amount, color: "bg-primary" },
                        { show: item.tailoring_amount > 0, icon: Scissors, label: "Tailoring", details: item.tailoring_status !== "N/A" ? item.tailoring_status : "", value: item.tailoring_amount, color: "bg-info" },
                        { show: item.embroidery_amount > 0, icon: Info, label: "Embroidery", details: item.karigar !== "N/A" ? item.karigar : "", value: item.embroidery_amount, color: "bg-success" },
                        { show: item.addon_amount > 0, icon: Tag, label: "Add-on", details: item.addon_desc !== "N/A" ? item.addon_desc : "", value: item.addon_amount, color: "bg-warning" },
                      ].map((sec, idx) => sec.show && (
                        <div key={idx} className="flex justify-between items-center text-[11px]">
                          <div className="flex items-center gap-2.5">
                            <div className={cn("w-1.5 h-1.5 rounded-full", sec.color)} />
                            <span className="text-muted-foreground font-bold flex items-center gap-2">
                              {sec.label}
                              {sec.details && <span className="text-[9px] font-normal opacity-60">({sec.details})</span>}
                            </span>
                          </div>
                          <span className="font-mono font-bold text-foreground">₹{fmt(sec.value)}</span>
                        </div>
                      ))}
                      
                      {!item.cancelled && (
                        <div className="flex items-center gap-2 pt-3 border-t border-border/40 border-dashed mt-2 opacity-0 group-hover/item:opacity-100 transition-all translate-y-1 group-hover/item:translate-y-0">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="flex-1 h-7 text-[10px] font-bold uppercase tracking-wider gap-1.5"
                            onClick={() => onEdit("items",[item],"item")}
                          >
                            <PencilSimple size={12} weight="bold" /> Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 h-7 text-[10px] font-bold uppercase tracking-wider gap-1.5 border-warning/30 text-warning hover:bg-warning/10"
                            onClick={() => onCancelItem(item)}
                          >
                            <X size={12} weight="bold" /> Cancel
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => onDeleteItem(item)}
                          >
                            <Trash size={14} weight="bold" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Group Summary Card */}
            <Card className="bg-muted/10 border-border/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 opacity-[0.03] rotate-12 pointer-events-none">
                <Receipt size={96} weight="duotone" />
              </div>
              <CardContent className="p-4 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Order Value</span>
                  <span className="font-mono font-black text-sm">₹{fmt(group.totals.total)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Received</span>
                  <span className="font-mono font-black text-success text-sm">₹{fmt(group.totals.received)}</span>
                </div>
                {totalAdvance > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Advance</span>
                    <span className="font-mono font-black text-info text-sm">₹{fmt(totalAdvance)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2.5 border-t border-border/40 mt-1">
                  <span className="text-[10px] uppercase tracking-[0.3em] font-black text-foreground">{isSettled ? "Status" : "Outstanding"}</span>
                  {isSettled
                    ? <Badge variant="success" className="font-black uppercase tracking-tighter text-[11px] gap-1.5 py-1">
                        <CheckCircle size={14} weight="fill"/> Settled
                      </Badge>
                    : <span className={cn(
                        "font-mono font-black text-xl tracking-tighter",
                        group.totals.pending < 0 ? "text-destructive" : "text-warning"
                      )}>
                        ₹{fmt(group.totals.pending)}
                      </span>
                  }
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}

function OrderWiseView({ selectedGroups, advances, onEdit, onCancelItem, onDeleteItem }) {
  return (
    <div className="space-y-6 pb-4">
      {selectedGroups.map(group => {
        const refAdvances = advances.filter(a => a.ref === group.ref);
        const totalAdvance = refAdvances.reduce((s,a) => s + a.amount, 0);
        const isSettled = group.totals.total > 0 && group.items.every(item =>
          [[item.fabric_amount, item.fabric_pay_mode],[item.tailoring_amount, item.tailoring_pay_mode],[item.embroidery_amount, item.embroidery_pay_mode],[item.addon_amount, item.addon_pay_mode]]
          .every(([amt, mode]) => !amt || Number(amt) === 0 || String(mode || "").startsWith("Settled"))
        );

        return (
          <div key={group.ref} className="space-y-4">
            {selectedGroups.length > 1 && (
              <div className="flex items-center gap-3 px-1">
                <Badge variant="outline" className="font-mono text-[11px] font-bold text-primary border-primary/20 bg-primary/5 px-2 py-0.5">
                  {group.ref}
                </Badge>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] truncate">{group.name}</span>
                <div className="flex-1 border-t border-border/40 border-dashed" />
              </div>
            )}

            <div className="space-y-3">
              {/* Fabric */}
              {group.totals.fabric > 0 && (
                <SectionAccordion icon={Package} label="Fabric" amount={group.totals.fabric}
                  onEdit={() => onEdit("items", group.items, "order")}>
                  {group.items.filter(i => i.fabric_amount > 0).map(item => (
                    <div key={item.id} className="group/row py-2.5 border-b border-border/40 last:border-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-xs font-mono font-bold tracking-tight text-primary", item.cancelled && "line-through opacity-50")}>{item.barcode}</p>
                          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">₹{fmt(item.price)} × {item.qty}m{item.discount>0?` (-${item.discount}%)`:""}</p>
                          {item.fabric_pay_mode && item.fabric_pay_mode !== "N/A" && (
                            <Badge variant="secondary" className="text-[9px] h-4 mt-1 px-1 opacity-70">{item.fabric_pay_mode}</Badge>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-mono text-xs font-bold text-foreground">₹{fmt(item.fabric_amount)}</p>
                          {item.fabric_pending !== 0 && (
                            <p className={cn("text-[9px] font-mono font-bold uppercase tracking-tighter mt-0.5", item.fabric_pending < 0 ? "text-destructive" : "text-warning")}>
                              ₹{fmt(item.fabric_pending)} pend
                            </p>
                          )}
                        </div>
                      </div>
                      {!item.cancelled && (
                        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:bg-primary/10" onClick={() => onEdit("items",[item],"item")}><PencilSimple size={12}/></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-warning hover:bg-warning/10" onClick={() => onCancelItem(item)}><X size={12}/></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => onDeleteItem(item)}><Trash size={12}/></Button>
                        </div>
                      )}
                    </div>
                  ))}
                </SectionAccordion>
              )}

              {/* Tailoring */}
              {group.totals.tailoring > 0 && (
                <SectionAccordion icon={Scissors} label="Tailoring" amount={group.totals.tailoring}
                  onEdit={() => onEdit("tailoring", group.items, "order")}>
                  {group.items.filter(i => i.tailoring_amount > 0).map(item => (
                    <div key={item.id} className="group/row py-2.5 border-b border-border/40 last:border-0 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-xs font-mono font-bold tracking-tight text-primary", item.cancelled && "line-through opacity-50")}>{item.barcode}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {item.article_type !== "N/A" && <Badge variant="outline" className="text-[9px] px-1 h-4 bg-background">{item.article_type}</Badge>}
                          {item.order_no && item.order_no !== "N/A" && <Badge variant="outline" className="text-[9px] px-1 h-4 font-mono bg-background">#{item.order_no}</Badge>}
                          {item.tailoring_status && item.tailoring_status !== "N/A" && (
                            <Badge variant="info" className="text-[9px] px-1.5 h-4 uppercase tracking-tighter">{item.tailoring_status}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex items-start gap-2">
                        <div className="text-right">
                          <p className="font-mono text-xs font-bold text-foreground">₹{fmt(item.tailoring_amount)}</p>
                          {item.tailoring_pending !== 0 && (
                            <p className={cn("text-[9px] font-mono font-bold uppercase tracking-tighter mt-0.5", item.tailoring_pending < 0 ? "text-destructive" : "text-warning")}>
                              ₹{fmt(item.tailoring_pending)} pend
                            </p>
                          )}
                        </div>
                        {!item.cancelled && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10 -mt-1 opacity-0 group-hover/row:opacity-100" onClick={() => onEdit("tailoring",[item],"item")}><PencilSimple size={12}/></Button>
                        )}
                      </div>
                    </div>
                  ))}
                </SectionAccordion>
              )}

              {/* Embroidery */}
              {group.totals.embroidery > 0 && (
                <SectionAccordion icon={Info} label="Embroidery" amount={group.totals.embroidery}
                  onEdit={() => onEdit("embroidery", group.items, "order")}>
                  {group.items.filter(i => i.embroidery_amount > 0).map(item => (
                    <div key={item.id} className="group/row py-2.5 border-b border-border/40 last:border-0 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-xs font-mono font-bold tracking-tight text-primary", item.cancelled && "line-through opacity-50")}>{item.barcode}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {item.karigar && item.karigar !== "N/A" && <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider px-1">Karigar: {item.karigar}</span>}
                          {item.embroidery_status && item.embroidery_status !== "N/A" && (
                            <Badge variant="success" className="text-[9px] px-1.5 h-4 uppercase tracking-tighter">{item.embroidery_status}</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 flex items-start gap-2">
                        <div className="text-right">
                          <p className="font-mono text-xs font-bold text-foreground">₹{fmt(item.embroidery_amount)}</p>
                          {item.embroidery_pending !== 0 && (
                            <p className={cn("text-[9px] font-mono font-bold uppercase tracking-tighter mt-0.5", item.embroidery_pending < 0 ? "text-destructive" : "text-warning")}>
                              ₹{fmt(item.embroidery_pending)} pend
                            </p>
                          )}
                        </div>
                        {!item.cancelled && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10 -mt-1 opacity-0 group-hover/row:opacity-100" onClick={() => onEdit("embroidery",[item],"item")}><PencilSimple size={12}/></Button>
                        )}
                      </div>
                    </div>
                  ))}
                </SectionAccordion>
              )}

              {/* Add-on */}
              {group.totals.addon > 0 && (
                <SectionAccordion icon={Tag} label="Add-on" amount={group.totals.addon}
                  onEdit={() => onEdit("addon", group.items, "order")}>
                  {group.items.filter(i => i.addon_amount > 0).map(item => (
                    <div key={item.id} className="group/row py-2.5 border-b border-border/40 last:border-0 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-xs font-mono font-bold tracking-tight text-primary", item.cancelled && "line-through opacity-50")}>{item.barcode}</p>
                        {item.addon_desc && item.addon_desc !== "N/A" && <p className="text-[10px] text-muted-foreground font-bold mt-1 px-1">{item.addon_desc}</p>}
                      </div>
                      <div className="text-right flex-shrink-0 flex items-start gap-2">
                        <div className="text-right">
                          <p className="font-mono text-xs font-bold text-foreground">₹{fmt(item.addon_amount)}</p>
                          {item.addon_pending !== 0 && (
                            <p className={cn("text-[9px] font-mono font-bold uppercase tracking-tighter mt-0.5", item.addon_pending < 0 ? "text-destructive" : "text-warning")}>
                              ₹{fmt(item.addon_pending)} pend
                            </p>
                          )}
                        </div>
                        {!item.cancelled && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10 -mt-1 opacity-0 group-hover/row:opacity-100" onClick={() => onEdit("addon",[item],"item")}><PencilSimple size={12}/></Button>
                        )}
                      </div>
                    </div>
                  ))}
                </SectionAccordion>
              )}

              {/* Advances */}
              <SectionAccordion icon={Wallet} label="Advances" amount={totalAdvance}
                onEdit={() => onEdit("advances", group.items, "order")}>
                {refAdvances.length === 0
                  ? <p className="text-[11px] text-muted-foreground text-center py-4 font-medium italic">No advances recorded</p>
                  : refAdvances.map(adv => (
                    <div key={adv.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-info" />
                        <p className="text-[11px] text-muted-foreground font-bold">{adv.date} <span className="mx-1 opacity-30">|</span> {adv.mode}</p>
                      </div>
                      <p className={cn("font-mono text-xs font-black", adv.amount < 0 ? "text-destructive" : "text-success")}>
                        {adv.amount < 0 ? "-" : "+"}₹{fmt(Math.abs(adv.amount))}
                      </p>
                    </div>
                  ))
                }
              </SectionAccordion>

              {/* Summary */}
              <Card className="bg-muted/10 border-border/50">
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Value</span>
                    <span className="font-mono font-black text-xs text-foreground">₹{fmt(group.totals.total)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Received</span>
                    <span className="font-mono font-black text-xs text-success">₹{fmt(group.totals.received)}</span>
                  </div>
                  {totalAdvance > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Advance</span>
                      <span className="font-mono font-black text-xs text-info">₹{fmt(totalAdvance)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-border/40 mt-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground">{isSettled ? "Status" : "Outstanding"}</span>
                    {isSettled
                      ? <Badge variant="success" className="font-black uppercase tracking-tighter text-[10px] px-1.5 py-0">Settled</Badge>
                      : <span className={cn("font-mono font-black text-sm", group.totals.pending < 0 ? "text-destructive" : "text-warning")}>₹{fmt(group.totals.pending)}</span>
                    }
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetailPane({ selectedGroups, advances, onEdit, onPay, onClose, onCancelItem, onDeleteItem }) {
  const [viewTab, setViewTab] = useState("order");

  if (!selectedGroups.length) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center animate-in fade-in duration-500">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150 animate-pulse" />
        <Package size={64} weight="duotone" className="text-muted-foreground/20 relative" />
      </div>
      <div className="space-y-2 relative">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground/60">No Order Selected</p>
        <p className="text-[11px] text-muted-foreground/40 font-bold max-w-[180px] mx-auto leading-relaxed">
          Select one or more orders from the list to view detailed breakdowns
        </p>
      </div>
      <Badge variant="outline" className="text-[9px] font-bold opacity-30 uppercase tracking-widest border-muted-foreground/20">
        Tip: Hold Ctrl / ⌘ for multi-select
      </Badge>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center gap-4 sticky top-0 z-10">
        <div className="min-w-0 flex-1">
          {selectedGroups.length === 1 ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm font-black text-primary tracking-tight">{selectedGroups[0].ref}</p>
                <Badge variant="secondary" className="h-4 text-[9px] px-1 font-bold bg-primary/5 text-primary border-primary/10">ACTIVE</Badge>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground">
                <User size={12} weight="bold" />
                <span className="truncate uppercase tracking-wider">{selectedGroups[0].name}</span>
                <span className="opacity-20">|</span>
                <span className="font-mono opacity-60 tracking-tighter">{selectedGroups[0].date}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <Package size={16} weight="bold" className="text-primary" />
                {selectedGroups.length} Orders Selected
              </p>
              <p className="text-[10px] text-muted-foreground font-mono truncate opacity-60">
                {selectedGroups.map(g => g.ref).join(", ")}
              </p>
            </div>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose} 
          className="sm:hidden h-9 w-9 text-muted-foreground hover:bg-muted/50 rounded-full"
        >
          <CaretRight size={18} weight="bold" />
        </Button>
      </div>

      {/* View tabs */}
      <div className="flex-shrink-0 px-5 pt-1 bg-background/40 border-b border-border/40">
        <div className="flex gap-6">
          {[
            { k: "order", l: "Order-wise", icon: Receipt },
            { k: "article", l: "Article-wise", icon: Package }
          ].map(t => (
            <button 
              key={t.k} 
              onClick={() => setViewTab(t.k)}
              className={cn(
                "flex items-center gap-2 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 -mb-px relative",
                viewTab === t.k 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground opacity-60 hover:opacity-100"
              )}
            >
              <t.icon size={14} weight={viewTab === t.k ? "bold" : "regular"} />
              {t.l}
              {viewTab === t.k && <div className="absolute inset-x-0 -bottom-px h-0.5 bg-primary blur-[2px] opacity-50" />}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-5">
          {viewTab === "article"
            ? <ArticleWiseView selectedGroups={selectedGroups} advances={advances} onEdit={onEdit} onCancelItem={onCancelItem} onDeleteItem={onDeleteItem} />
            : <OrderWiseView selectedGroups={selectedGroups} advances={advances} onEdit={onEdit} onCancelItem={onCancelItem} onDeleteItem={onDeleteItem} />
          }
        </div>
      </div>

      {/* Pay button */}
      {selectedGroups.some(g => !g.items.every(i => i.cancelled)) && (
        <div className="flex-shrink-0 p-5 bg-background border-t border-border/50 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
          <Button 
            onClick={onPay}
            className="w-full h-11 text-xs font-black uppercase tracking-[0.3em] gap-3 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <CurrencyDollar size={18} weight="bold" />
            {selectedGroups.length > 1 ? `Settle ${selectedGroups.length} Orders` : "Settle Payment"}
          </Button>
        </div>
      )}
    </div>
  );
}
