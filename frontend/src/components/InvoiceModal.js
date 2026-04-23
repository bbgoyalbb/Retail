import { useEffect } from "react";
import { X, ArrowSquareOut, Printer } from "@phosphor-icons/react";
import { getInvoiceUrl } from "@/api";

export default function InvoiceModal({ billRef, onClose }) {
  const url = getInvoiceUrl(billRef);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-sm w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] flex-shrink-0">
          <p className="font-heading text-sm font-semibold text-[var(--text-primary)]">Invoice Preview — {billRef}</p>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              className="p-1.5 rounded-sm hover:bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowSquareOut size={16} />
            </a>
            <button
              onClick={() => {
                try {
                  const iframe = document.getElementById("invoice-iframe");
                  if (iframe?.contentWindow?.print) {
                    iframe.contentWindow.print();
                  } else {
                    window.open(url, "_blank");
                  }
                } catch {
                  window.open(url, "_blank");
                }
              }}
              title="Print"
              className="p-1.5 rounded-sm hover:bg-[var(--bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Printer size={16} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 rounded-sm hover:bg-[var(--bg)] text-[var(--text-secondary)] hover:text-red-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {/* iframe */}
        <iframe
          id="invoice-iframe"
          src={url}
          title="Invoice"
          className="flex-1 w-full border-0 rounded-b-sm"
        />
      </div>
    </div>
  );
}
