import { List } from "@phosphor-icons/react";

export default function MobileTopBar({ title, onMenuClick }) {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 bg-[var(--surface)] border-b border-[var(--border-subtle)] flex items-center px-3 gap-3 shadow-sm">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="p-2 rounded-sm hover:bg-[var(--bg)] text-[var(--text-primary)] transition-colors"
      >
        <List size={20} />
      </button>
      <h1 className="font-heading text-base font-semibold flex-1 tracking-tight text-[var(--text-primary)] truncate">
        {title}
      </h1>
    </header>
  );
}
