import { X, CheckCircle, WarningCircle } from "@phosphor-icons/react";

export function StatusBanner({ message, onDismiss, showDismiss = true }) {
  if (!message) return null;

  const isSuccess = message.type === "success";
  const isError = message.type === "error";

  return (
    <div
      className={`p-4 border rounded-sm text-sm flex items-start justify-between gap-3 ${
        isSuccess
          ? "bg-[#455D4A10] border-[var(--success)] text-[var(--success)]"
          : isError
            ? "bg-[#9E473D10] border-[var(--error)] text-[var(--error)]"
            : "bg-[#5C8A9E10] border-[var(--info)] text-[var(--info)]"
      }`}
    >
      <div className="flex items-start gap-2">
        {isSuccess && <CheckCircle size={18} weight="fill" className="mt-0.5 flex-shrink-0" />}
        {isError && <WarningCircle size={18} weight="fill" className="mt-0.5 flex-shrink-0" />}
        <span>{message.text}</span>
      </div>
      {showDismiss && onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded-sm hover:bg-black/5 flex-shrink-0"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
