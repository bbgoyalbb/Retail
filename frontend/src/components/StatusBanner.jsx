import { useEffect, useState } from "react";
import { X, CheckCircle, WarningCircle } from "@phosphor-icons/react";

export function StatusBanner({ message, onDismiss, showDismiss = true, autoDismiss = 5000 }) {
  const [progress, setProgress] = useState(100);

  // Auto-dismiss success messages after specified time (errors stay until manually dismissed)
  // NOTE: early return must come AFTER all hooks to satisfy Rules of Hooks
  useEffect(() => {
    if (!message) return;
    if (autoDismiss && message.type === "success" && onDismiss) {
      setProgress(100);
      const startTime = Date.now();
      
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / autoDismiss) * 100);
        setProgress(remaining);
      }, 50);

      const timer = setTimeout(() => {
        clearInterval(progressInterval);
        onDismiss();
      }, autoDismiss);

      return () => {
        clearTimeout(timer);
        clearInterval(progressInterval);
      };
    }
  }, [message, autoDismiss, onDismiss]);

  // Early return after all hooks
  if (!message) return null;

  const isSuccess = message.type === "success";
  const isError = message.type === "error";

  return (
    <div
      className={`relative p-4 border rounded-sm text-sm flex items-start justify-between gap-3 ${
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
      {/* Auto-dismiss progress bar */}
      {autoDismiss && isSuccess && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--success)]/20">
          <div
            className="h-full bg-[var(--success)] transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
