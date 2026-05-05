import { Check, FloppyDisk } from "@phosphor-icons/react";
import { DatePickerInput } from "@/components/DatePickerInput";

/**
 * PaymentSummaryPanel - Payment modes, totals, and settlement controls
 * 
 * @param {Object} props
 * @param {number} props.grandTotal - Calculated grand total
 * @param {string} props.amountPaid - Amount paid input value
 * @param {string[]} props.selectedModes - Selected payment modes
 * @param {boolean} props.isSettled - Whether bill is marked as settled
 * @param {boolean} props.needsTailoring - Whether bill needs tailoring (sets all items to Awaiting Order)
 * @param {string} props.payDate - Payment date
 * @param {string[]} props.paymentModes - Available payment modes from config
 * @param {boolean} props.canSubmit - Whether form can be submitted
 * @param {boolean} props.saving - Whether save is in progress
 * @param {Object} props.refs - Refs for focus management {amountRef, settledRef, saveBtnRef}
 * @param {Function} props.onAmountPaidChange - Callback for amount paid changes
 * @param {Function} props.onModeToggle - Callback(mode) for payment mode toggle
 * @param {Function} props.onSettledChange - Callback for settled checkbox
 * @param {Function} props.onNeedsTailoringChange - Callback for needs tailoring checkbox
 * @param {Function} props.onPayDateChange - Callback for payment date changes
 * @param {Function} props.onSave - Callback to save the bill
 * @param {Function} props.onKeyNav - Callback for Enter key navigation
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
  const paidAmount = parseFloat(amountPaid) || 0;
  const balance = grandTotal - paidAmount;
  const isOverpaid = balance < -0.01;
  const isUnderpaid = balance > 0.01;

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
      <h3 className="font-heading text-base font-medium">Payment Summary</h3>

      {/* Grand Total Display */}
      <div className="p-4 bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm">
        <div className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">
          Grand Total
        </div>
        <div className="font-mono text-3xl font-semibold text-[var(--text-primary)] mt-1">
          ₹{grandTotal.toLocaleString('en-IN')}
        </div>
      </div>

      {/* Payment Modes */}
      <div>
        <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-2">
          Payment Modes
        </label>
        <div className="flex flex-wrap gap-2">
          {paymentModes.map((mode) => (
            <button
              key={mode}
              onClick={() => onModeToggle(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm border transition-all ${
                selectedModes.includes(mode)
                  ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                  : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--brand)]'
              }`}
              type="button"
            >
              <span className="flex items-center gap-1.5">
                {selectedModes.includes(mode) && <Check size={12} weight="bold" />}
                {mode}
              </span>
            </button>
          ))}
        </div>
        {selectedModes.length === 0 && (
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Select at least one payment mode
          </p>
        )}
      </div>

      {/* Amount Paid & Pay Date */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">
            Amount Paid
          </label>
          <input
            ref={refs.amountRef}
            data-testid="amount-paid-input"
            type="number"
            inputMode="decimal"
            pattern="[0-9]*"
            value={amountPaid}
            onChange={(e) => onAmountPaidChange(e.target.value)}
            placeholder="0"
            min="0"
            className="w-full px-3 py-2 text-sm font-mono border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
            onKeyDown={(e) => onKeyNav(e, 'settled')}
          />
          {/* Balance indicator */}
          {amountPaid && (
            <div className={`mt-1.5 text-xs font-medium ${
              isOverpaid ? 'text-[var(--success)]' : 
              isUnderpaid ? 'text-[var(--warning)]' : 
              'text-[var(--text-secondary)]'
            }`}>
              {isOverpaid ? (
                <>Credit: ₹{Math.abs(balance).toLocaleString('en-IN')}</>
              ) : isUnderpaid ? (
                <>Balance: ₹{balance.toLocaleString('en-IN')}</>
              ) : (
                <>Fully Paid</>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">
            Payment Date
          </label>
          <DatePickerInput
            ref={refs.payDateRef}
            data-testid="pay-date-input"
            value={payDate}
            onChange={onPayDateChange}
            placeholder="Payment date"
          />
        </div>
      </div>

      {/* Needs Tailoring Checkbox */}
      <label className="flex items-center gap-3 p-3 border border-[var(--border-subtle)] rounded-sm cursor-pointer hover:bg-[var(--bg)] transition-colors">
        <input
          ref={refs.tailoringRef}
          data-testid="needs-tailoring-checkbox"
          type="checkbox"
          checked={!!needsTailoring}
          onChange={(e) => onNeedsTailoringChange(e.target.checked)}
          className="w-4 h-4 accent-[var(--brand)]"
        />
        <span className="text-sm font-medium">Needs Tailoring</span>
      </label>

      {/* Settled Checkbox */}
      <label className="flex items-center gap-3 p-3 border border-[var(--border-subtle)] rounded-sm cursor-pointer hover:bg-[var(--bg)] transition-colors">
        <input
          ref={refs.settledRef}
          data-testid="settled-checkbox"
          type="checkbox"
          checked={isSettled}
          onChange={(e) => onSettledChange(e.target.checked)}
          className="w-4 h-4 accent-[var(--brand)]"
        />
        <span className="text-sm font-medium">Mark as Settled</span>
        <span className="text-xs text-[var(--text-secondary)] ml-auto">
          Payment received in full
        </span>
      </label>

      {/* Submit Button */}
      <button
        ref={refs.saveBtnRef}
        data-testid="save-bill-btn"
        onClick={onSave}
        disabled={!canSubmit || saving}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold bg-[var(--success)] text-white rounded-sm hover:bg-[#3d4d3f] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        type="button"
      >
        {saving ? (
          <>
            <span className="animate-spin">⌛</span>
            Saving...
          </>
        ) : (
          <>
            <FloppyDisk size={18} weight="bold" />
            Save Bill
          </>
        )}
      </button>
    </div>
  );
}
