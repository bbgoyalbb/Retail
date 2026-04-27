import React, { useState } from "react";
import { fmt } from "@/lib/fmt";
import { PencilSimple, Trash, X, CaretDown, CaretRight, CheckCircle, CurrencyDollar, Package, Scissors, Tag, Wallet } from "@phosphor-icons/react";

// Sparkle not in all builds — use a simple diamond fallback
const Sparkle = ({ size, className }) => <span className={className} style={{fontSize:size,lineHeight:1}}>✦</span>;

export const SectionAccordion = ({ icon: Icon, label, amount, children, onEdit, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[var(--border-subtle)] rounded-sm overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--bg)] cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <Icon size={13} className="text-[var(--text-secondary)] flex-shrink-0" />
        <span className="text-xs font-semibold text-[var(--text-primary)] flex-1">{label}</span>
        {amount > 0 && <span className="font-mono text-xs text-[var(--text-secondary)]">₹{fmt(amount)}</span>}
        {onEdit && (
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-1 text-[var(--info)] hover:bg-[#5C8A9E15] rounded-sm transition-colors flex-shrink-0">
            <PencilSimple size={12} />
          </button>
        )}
        <span className="text-[var(--text-secondary)] flex-shrink-0">{open ? <CaretDown size={12}/> : <CaretRight size={12}/>}</span>
      </div>
      {open && <div className="p-3 space-y-1 border-t border-[var(--border-subtle)] bg-[var(--surface)]">{children}</div>}
    </div>
  );
};

export default function OrderDetailPane({ selectedGroups, advances, onEdit, onPay, onClose, onCancelItem, onDeleteItem }) {
  if (!selectedGroups.length) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)] p-8 text-center">
      <Package size={36} weight="duotone" className="opacity-20"/>
      <p className="text-sm">Select an order to view details</p>
      <p className="text-[10px]">Hold Ctrl / ⌘ to select multiple</p>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg)] flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {selectedGroups.length === 1 ? (
            <>
              <p className="font-mono text-sm font-medium text-[var(--brand)] truncate">{selectedGroups[0].ref}</p>
              <p className="text-xs text-[var(--text-secondary)] truncate">{selectedGroups[0].name} · {selectedGroups[0].date}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">{selectedGroups.length} orders selected</p>
              <p className="text-xs text-[var(--text-secondary)] truncate">{selectedGroups.map(g=>g.ref).join(", ")}</p>
            </>
          )}
        </div>
        <button onClick={onClose} className="sm:hidden p-1.5 hover:bg-[var(--surface)] rounded-sm text-[var(--text-secondary)]">
          <CaretRight size={14}/>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {selectedGroups.map(group => {
          const isCancelled = group.items.some(i => i.cancelled);
          const refAdvances = advances.filter(a => a.ref === group.ref);
          const totalAdvance = refAdvances.reduce((s,a) => s + a.amount, 0);
          const isSettled = group.totals.total > 0 && group.items.every(item =>
            [[item.fabric_amount, item.fabric_pay_mode],[item.tailoring_amount, item.tailoring_pay_mode],[item.embroidery_amount, item.embroidery_pay_mode],[item.addon_amount, item.addon_pay_mode]]
            .every(([amt, mode]) => !amt || Number(amt) === 0 || String(mode || "").startsWith("Settled"))
          );

          return (
            <div key={group.ref} className="space-y-2">
              {selectedGroups.length > 1 && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-mono text-xs text-[var(--brand)] font-medium">{group.ref}</span>
                  <span className="text-[10px] text-[var(--text-secondary)] truncate">{group.name}</span>
                  <div className="flex-1 border-t border-[var(--border-subtle)]"/>
                </div>
              )}

              {/* Fabric */}
              {group.totals.fabric > 0 && (
                <SectionAccordion icon={Package} label="Fabric" amount={group.totals.fabric}
                  onEdit={!isCancelled ? () => onEdit("items", group.items, "order") : null}
                  defaultOpen={selectedGroups.length === 1}>
                  {group.items.filter(i => i.fabric_amount > 0).map(item => (
                    <div key={item.id} className="py-1.5 border-b border-[var(--border-subtle)] last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-mono text-[var(--brand)]">{item.barcode}</p>
                          <p className="text-[10px] text-[var(--text-secondary)]">₹{fmt(item.price)} × {item.qty}m{item.discount>0?` (${item.discount}% off)`:""}</p>
                          {item.fabric_pay_mode && item.fabric_pay_mode !== "N/A" && <p className="text-[10px] text-[var(--text-secondary)]">{item.fabric_pay_mode}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-mono text-xs font-medium">₹{fmt(item.fabric_amount)}</p>
                          {item.fabric_pending !== 0 && <p className={`text-[10px] font-mono ${item.fabric_pending<0?"text-[var(--error)]":"text-[var(--warning)]"}`}>₹{fmt(item.fabric_pending)} pend</p>}
                        </div>
                      </div>
                      {!isCancelled && (
                        <div className="flex items-center gap-0.5 mt-1">
                          <button onClick={() => onEdit("items",[item],"item")} className="p-1 text-[var(--info)] hover:bg-[#5C8A9E15] rounded-sm" title="Edit article"><PencilSimple size={11}/></button>
                          <button onClick={() => onCancelItem(item)} className="p-1 text-[var(--warning)] hover:bg-[#D4984215] rounded-sm" title="Cancel article"><X size={11}/></button>
                          <button onClick={() => onDeleteItem(item)} className="p-1 text-[var(--error)] hover:bg-[#9E473D15] rounded-sm" title="Delete article"><Trash size={11}/></button>
                        </div>
                      )}
                    </div>
                  ))}
                </SectionAccordion>
              )}

              {/* Tailoring */}
              {group.totals.tailoring > 0 && (
                <SectionAccordion icon={Scissors} label="Tailoring" amount={group.totals.tailoring}
                  onEdit={!isCancelled ? () => onEdit("tailoring", group.items, "order") : null}
                  defaultOpen={selectedGroups.length === 1}>
                  {group.items.filter(i => i.tailoring_amount > 0).map(item => (
                    <div key={item.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-[var(--border-subtle)] last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-[var(--brand)]">{item.barcode}</p>
                        <div className="flex flex-wrap gap-x-2 mt-0.5">
                          {item.article_type !== "N/A" && <p className="text-[10px] text-[var(--text-secondary)]">{item.article_type}</p>}
                          {item.order_no && item.order_no !== "N/A" && <p className="text-[10px] font-mono text-[var(--text-secondary)]">#{item.order_no}</p>}
                          {item.tailoring_status && item.tailoring_status !== "N/A" && <p className="text-[10px] px-1 py-0.5 bg-[#5C8A9E15] text-[var(--info)] rounded-sm">{item.tailoring_status}</p>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono text-xs font-medium">₹{fmt(item.tailoring_amount)}</p>
                        {item.tailoring_pending !== 0 && <p className={`text-[10px] font-mono ${item.tailoring_pending<0?"text-[var(--error)]":"text-[var(--warning)]"}`}>₹{fmt(item.tailoring_pending)} pend</p>}
                      </div>
                      {!isCancelled && <button onClick={() => onEdit("tailoring",[item],"item")} className="p-1 text-[var(--info)] hover:bg-[#5C8A9E15] rounded-sm flex-shrink-0"><PencilSimple size={11}/></button>}
                    </div>
                  ))}
                </SectionAccordion>
              )}

              {/* Embroidery */}
              {group.totals.embroidery > 0 && (
                <SectionAccordion icon={({size,className}) => <span className={className} style={{fontSize:size}}>✦</span>} label="Embroidery" amount={group.totals.embroidery}
                  onEdit={!isCancelled ? () => onEdit("embroidery", group.items, "order") : null}
                  defaultOpen={selectedGroups.length === 1}>
                  {group.items.filter(i => i.embroidery_amount > 0).map(item => (
                    <div key={item.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-[var(--border-subtle)] last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-[var(--brand)]">{item.barcode}</p>
                        {item.karigar && item.karigar !== "N/A" && <p className="text-[10px] text-[var(--text-secondary)]">Karigar: {item.karigar}</p>}
                        {item.embroidery_status && item.embroidery_status !== "N/A" && <p className="text-[10px] text-[var(--text-secondary)]">{item.embroidery_status}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono text-xs font-medium">₹{fmt(item.embroidery_amount)}</p>
                        {item.embroidery_pending !== 0 && <p className={`text-[10px] font-mono ${item.embroidery_pending<0?"text-[var(--error)]":"text-[var(--warning)]"}`}>₹{fmt(item.embroidery_pending)} pend</p>}
                      </div>
                      {!isCancelled && <button onClick={() => onEdit("embroidery",[item],"item")} className="p-1 text-[var(--info)] hover:bg-[#5C8A9E15] rounded-sm flex-shrink-0"><PencilSimple size={11}/></button>}
                    </div>
                  ))}
                </SectionAccordion>
              )}

              {/* Add-on */}
              {group.totals.addon > 0 && (
                <SectionAccordion icon={Tag} label="Add-on" amount={group.totals.addon}
                  onEdit={!isCancelled ? () => onEdit("addon", group.items, "order") : null}
                  defaultOpen={selectedGroups.length === 1}>
                  {group.items.filter(i => i.addon_amount > 0).map(item => (
                    <div key={item.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-[var(--border-subtle)] last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-[var(--brand)]">{item.barcode}</p>
                        {item.addon_desc && item.addon_desc !== "N/A" && <p className="text-[10px] text-[var(--text-secondary)]">{item.addon_desc}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono text-xs font-medium">₹{fmt(item.addon_amount)}</p>
                        {item.addon_pending !== 0 && <p className={`text-[10px] font-mono ${item.addon_pending<0?"text-[var(--error)]":"text-[var(--warning)]"}`}>₹{fmt(item.addon_pending)} pend</p>}
                      </div>
                      {!isCancelled && <button onClick={() => onEdit("addon",[item],"item")} className="p-1 text-[var(--info)] hover:bg-[#5C8A9E15] rounded-sm flex-shrink-0"><PencilSimple size={11}/></button>}
                    </div>
                  ))}
                </SectionAccordion>
              )}

              {/* Advances */}
              <SectionAccordion icon={Wallet} label="Advances" amount={totalAdvance}
                onEdit={!isCancelled ? () => onEdit("advances", group.items, "order") : null}>
                {refAdvances.length === 0
                  ? <p className="text-xs text-[var(--text-secondary)] text-center py-2">No advances</p>
                  : refAdvances.map(adv => (
                    <div key={adv.id} className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)] last:border-0">
                      <p className="text-xs text-[var(--text-secondary)]">{adv.date} · {adv.mode}</p>
                      <p className={`font-mono text-xs font-medium ${adv.amount<0?"text-[var(--error)]":"text-[var(--success)]"}`}>₹{fmt(adv.amount)}</p>
                    </div>
                  ))
                }
              </SectionAccordion>

              {/* Summary */}
              <div className="bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm p-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Total</span><span className="font-mono font-medium">₹{fmt(group.totals.total)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Received</span><span className="font-mono text-[var(--success)]">₹{fmt(group.totals.received)}</span></div>
                {totalAdvance > 0 && <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Advance</span><span className="font-mono text-[var(--info)]">₹{fmt(totalAdvance)}</span></div>}
                <div className="flex justify-between pt-1 border-t border-[var(--border-subtle)]">
                  <span className="font-medium">{isSettled ? "Status" : "Pending"}</span>
                  {isSettled
                    ? <span className="text-[var(--success)] flex items-center gap-1 font-medium"><CheckCircle size={12} weight="fill"/>Settled</span>
                    : <span className={`font-mono font-medium ${group.totals.pending<0?"text-[var(--error)]":"text-[var(--warning)]"}`}>₹{fmt(group.totals.pending)}</span>
                  }
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pay button */}
      {selectedGroups.some(g => !g.items.every(i => i.cancelled)) && (
        <div className="flex-shrink-0 p-3 border-t border-[var(--border-subtle)] bg-[var(--bg)]">
          <button onClick={onPay}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-colors">
            <CurrencyDollar size={16} weight="bold"/>
            {selectedGroups.length > 1 ? `Collect Payment (${selectedGroups.length} orders)` : "Collect Payment"}
          </button>
        </div>
      )}
    </div>
  );
}
