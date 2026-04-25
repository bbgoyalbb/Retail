import { Scissors, ArrowRight } from "@phosphor-icons/react";

export function EmptyState({ title, description, action, onAction, icon: Icon = Scissors }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--bg)] border border-[var(--border-subtle)] flex items-center justify-center mb-4">
        <Icon size={28} className="text-[var(--brand)]" />
      </div>
      <h3 className="font-heading text-base font-medium text-[var(--text-primary)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-xs mb-4">{description}</p>
      {action && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-colors"
        >
          {action} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
