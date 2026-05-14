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
      <CardContent className="p-6 sm:p-8 space-y-8">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl font-black uppercase tracking-tight text-primary">Settlement</h3>
          {selectedModes.length > 0 && (
            <div className="flex gap-1.5">
              {selectedModes.map(m => <Badge key={m} variant="success" className="uppercase tracking-widest text-[9px]">{m}</Badge>)}
            </div>
          )}
        </div>

        {/* Grand Total Display */}
        <div className="p-6 bg-primary/[0.03] border border-primary/10 rounded-xl relative overflow-hidden group transition-all hover:bg-primary/[0.05]">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
          <div className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground">
            Total Payable
          </div>
          <div className="font-mono text-4xl sm:text-5xl font-black text-primary mt-1 tracking-tighter">
            ₹{grandTotal.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Payment Modes */}
        <div className="space-y-4">
          <label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground block ml-1">
            Accepting via
          </label>
          <div className="flex flex-wrap gap-2.5">
            {paymentModes.map((mode) => (
              <Button
                key={mode}
                variant={selectedModes.includes(mode) ? "default" : "outline"}
                size="sm"
                onClick={() => onModeToggle(mode)}
                className={`h-10 px-4 font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95 ${
                  selectedModes.includes(mode) ? 'shadow-md shadow-primary/20' : 'hover:border-primary/50'
                }`}
                type="button"
              >
                {selectedModes.includes(mode) && <Check size={14} weight="bold" className="mr-2" />}
                {mode}
              </Button>
            ))}
          </div>
        </div>

        {/* Amount Paid & Pay Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground block ml-1">
              Received Amount
            </label>
            <div className="relative">
              <Input
                ref={refs.amountRef}
                data-testid="amount-paid-input"
                type="number"
                inputMode="decimal"
                value={amountPaid}
                onChange={(e) => onAmountPaidChange(e.target.value)}
                placeholder="0"
                className="h-12 text-lg font-mono font-black pl-8 border-2 focus:border-primary"
                onKeyDown={(e) => onKeyNav(e, 'settled')}
              />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono font-bold">₹</div>
            </div>
            {/* Balance indicator */}
            {amountPaid && (
              <div className="pt-1">
                <Badge variant={isOverpaid || !isUnderpaid ? "success" : "warning"} className="px-3 py-1 font-black uppercase tracking-widest text-[9px]">
                  {isOverpaid ? (
                    <>Credit Balance: ₹{Math.abs(balance).toLocaleString('en-IN')}</>
                  ) : isUnderpaid ? (
                    <>Remaining: ₹{balance.toLocaleString('en-IN')}</>
                  ) : (
                    <>Fully Settled</>
                  )}
                </Badge>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground block ml-1">
              Transaction Date
            </label>
            <DatePickerInput
              ref={refs.payDateRef}
              data-testid="pay-date-input"
              value={payDate}
              onChange={onPayDateChange}
              className="h-12 font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Needs Tailoring Checkbox */}
          <label className={`group flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${needsTailoring ? 'border-primary bg-primary/[0.03] shadow-inner' : 'border-muted hover:border-primary/30 hover:bg-muted/30'}`}>
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${needsTailoring ? 'bg-primary border-primary rotate-0' : 'border-muted-foreground/30 bg-background rotate-12 group-hover:rotate-0'}`}>
              {needsTailoring && <Check size={16} weight="bold" className="text-white" />}
            </div>
            <input
              ref={refs.tailoringRef}
              data-testid="needs-tailoring-checkbox"
              type="checkbox"
              checked={!!needsTailoring}
              onChange={(e) => onNeedsTailoringChange(e.target.checked)}
              className="sr-only"
            />
            <div className="flex flex-col">
              <span className="text-sm font-black uppercase tracking-tight">Tailoring Queue</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">In-house production</span>
            </div>
          </label>

          {/* Settled Checkbox */}
          <label className={`group flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${isSettled ? 'border-success bg-success/[0.03] shadow-inner' : 'border-muted hover:border-success/30 hover:bg-muted/30'}`}>
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSettled ? 'bg-success border-success rotate-0' : 'border-muted-foreground/30 bg-background rotate-12 group-hover:rotate-0'}`}>
              {isSettled && <Check size={16} weight="bold" className="text-white" />}
            </div>
            <input
              ref={refs.settledRef}
              data-testid="settled-checkbox"
              type="checkbox"
              checked={isSettled}
              onChange={(e) => onSettledChange(e.target.checked)}
              className="sr-only"
            />
            <div className="flex flex-col">
              <span className="text-sm font-black uppercase tracking-tight">Final Settlement</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Zero Balance Claim</span>
            </div>
          </label>
        </div>

        {/* Submit Button */}
        <Button
          ref={refs.saveBtnRef}
          data-testid="save-bill-btn"
          onClick={onSave}
          disabled={!canSubmit || saving}
          size="lg"
          className="w-full h-16 text-xl font-black uppercase tracking-[0.3em] shadow-2xl shadow-primary/20 hover:shadow-primary/40 active:scale-[0.98] transition-all"
        >
          {saving ? (
            <div className="flex items-center gap-4">
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Finalizing…</span>
            </div>
          ) : (
            <>
              <FloppyDisk size={24} weight="bold" className="mr-2" />
              Commit Invoice
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
