import { Check, FloppyDisk } from "@phosphor-icons/react";
import { DatePickerInput } from "@/components/DatePickerInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * PaymentSummaryPanel - Payment modes, totals, and settlement controls
 */
export default function PaymentSummaryPanel({
  grandTotal,
  amountPaid,
  selectedModes,
  isSettled,
  needsTailoring,
  payDate,
  paymentModes,
  canSubmit,
  saving,
  refs,
  onAmountPaidChange,
  onModeToggle,
  onSettledChange,
  onNeedsTailoringChange,
  onPayDateChange,
  onSave,
  onKeyNav
}) {
  const balance = grandTotal - (parseFloat(amountPaid) || 0);
  const isOverpaid = balance < 0;
  const isUnderpaid = balance > 0;

  return (
    <Card className="shadow-lg border-muted-foreground/10 overflow-hidden">
      <CardContent className="p-4 space-y-4">
        {/* Header row: title + active modes */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Settlement</h3>
          {selectedModes.length > 0 && (
            <div className="flex gap-1 flex-wrap justify-end">
              {selectedModes.map(m => <Badge key={m} variant="success" className="uppercase tracking-widest text-[9px] px-1.5 py-0">{m}</Badge>)}
            </div>
          )}
        </div>

        {/* Grand Total Display */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-primary/[0.04] border border-primary/10 rounded-lg">
          <div className="w-1 h-8 bg-primary rounded-full flex-shrink-0" />
          <div>
            <div className="text-[9px] uppercase tracking-[0.25em] font-black text-muted-foreground leading-none">Total Payable</div>
            <div className="font-mono text-xl font-black text-primary mt-0.5 tracking-tighter leading-none">
              ₹{grandTotal.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Payment Modes */}
        <div className="space-y-2">
          <label className="text-[9px] uppercase tracking-[0.2em] font-black text-muted-foreground block">Accepting via</label>
          <div className="flex flex-wrap gap-1.5">
            {paymentModes.map((mode) => (
              <Button
                key={mode}
                variant={selectedModes.includes(mode) ? "default" : "outline"}
                size="sm"
                onClick={() => onModeToggle(mode)}
                className={`h-7 px-2.5 font-bold uppercase tracking-widest text-[9px] transition-colors active:scale-95 ${
                  selectedModes.includes(mode) ? 'shadow-sm shadow-primary/20' : 'hover:border-primary/50'
                }`}
                type="button"
              >
                {selectedModes.includes(mode) && <Check size={11} weight="bold" className="mr-1" />}
                {mode}
              </Button>
            ))}
          </div>
        </div>

        {/* Amount Paid & Pay Date — side by side on wider screens */}
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <label className="text-[9px] uppercase tracking-[0.2em] font-black text-muted-foreground block">Received Amount</label>
            <div className="relative">
              <Input
                ref={refs.amountRef}
                data-testid="amount-paid-input"
                type="number"
                inputMode="decimal"
                value={amountPaid}
                onChange={(e) => onAmountPaidChange(e.target.value)}
                placeholder="0"
                className="h-10 text-base font-mono font-black pl-7 border-2 focus:border-primary"
                onKeyDown={(e) => onKeyNav(e, 'settled')}
              />
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono font-bold text-sm">₹</div>
            </div>
            {amountPaid && (
              <Badge variant={isOverpaid || !isUnderpaid ? "success" : "warning"} className="px-2 py-0.5 font-black uppercase tracking-widest text-[9px]">
                {isOverpaid ? <>Credit: ₹{Math.abs(balance).toLocaleString('en-IN')}</> : isUnderpaid ? <>Remaining: ₹{balance.toLocaleString('en-IN')}</> : <>Fully Settled</>}
              </Badge>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] uppercase tracking-[0.2em] font-black text-muted-foreground block">Transaction Date</label>
            <DatePickerInput
              ref={refs.payDateRef}
              data-testid="pay-date-input"
              value={payDate}
              onChange={onPayDateChange}
              className="h-10 font-bold"
            />
          </div>
        </div>

        {/* Checkboxes — compact inline rows */}
        <div className="space-y-2">
          <label className={`group flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-colors ${needsTailoring ? 'border-primary/40 bg-primary/[0.03]' : 'border-border hover:border-primary/30 hover:bg-muted/20'}`}>
            <div className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${needsTailoring ? 'bg-primary border-primary' : 'border-muted-foreground/30 bg-background'}`}>
              {needsTailoring && <Check size={12} weight="bold" className="text-white" />}
            </div>
            <input ref={refs.tailoringRef} data-testid="needs-tailoring-checkbox" type="checkbox" checked={!!needsTailoring} onChange={(e) => onNeedsTailoringChange(e.target.checked)} className="sr-only" />
            <div>
              <span className="text-xs font-black uppercase tracking-tight">Tailoring Queue</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold block">In-house production</span>
            </div>
          </label>

          <label className={`group flex items-center gap-3 px-3 py-2.5 border rounded-lg cursor-pointer transition-colors ${isSettled ? 'border-success/40 bg-success/[0.03]' : 'border-border hover:border-success/30 hover:bg-muted/20'}`}>
            <div className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${isSettled ? 'bg-success border-success' : 'border-muted-foreground/30 bg-background'}`}>
              {isSettled && <Check size={12} weight="bold" className="text-white" />}
            </div>
            <input ref={refs.settledRef} data-testid="settled-checkbox" type="checkbox" checked={isSettled} onChange={(e) => onSettledChange(e.target.checked)} className="sr-only" />
            <div>
              <span className="text-xs font-black uppercase tracking-tight">Final Settlement</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold block">Zero Balance Claim</span>
            </div>
          </label>
        </div>

        {/* Submit Button */}
        <Button
          ref={refs.saveBtnRef}
          data-testid="save-bill-btn"
          onClick={onSave}
          disabled={!canSubmit || saving}
          className="w-full h-11 text-sm font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 active:scale-[0.98] transition-colors"
        >
          {saving ? (
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Finalizing…</span>
            </div>
          ) : (
            <><FloppyDisk size={18} weight="bold" className="mr-2" />Commit Invoice</>
          )}
        </Button>
        {!canSubmit && !saving && (
          <p className="text-center text-[11px] text-muted-foreground/70">
            Add at least one item to commit the invoice
          </p>
        )}
      </CardContent>
    </Card>
  );
}
