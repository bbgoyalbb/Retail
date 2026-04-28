import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export const DEFAULT_NUM_SHORTCUTS = [
  { key: "1", path: "/",            desc: "Dashboard" },
  { key: "2", path: "/new-bill",    desc: "New Bill" },
  { key: "3", path: "/jobwork",     desc: "Job Work" },
  { key: "4", path: "/items",       desc: "Manage Orders" },
  { key: "5", path: "/daybook",     desc: "Daybook" },
  { key: "6", path: "/order-status",desc: "Order Status" },
  { key: "7", path: "/settings",    desc: "Settings" },
];

const FIXED_SHORTCUTS = [
  { keys: "Ctrl + K", desc: "Manage Orders" },
  { keys: "Ctrl + N", desc: "New Bill" },
  { keys: "Ctrl + D", desc: "Dashboard" },
  { keys: "Ctrl + S", desc: "Save Bill (on New Bill page)" },
  { keys: "?",        desc: "Show this help" },
  { keys: "Esc",      desc: "Close modals / dialogs" },
];

function loadNumShortcuts() {
  try {
    const raw = localStorage.getItem("keyboard_shortcuts");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_NUM_SHORTCUTS;
}

export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [numShortcuts, setNumShortcuts] = useState(loadNumShortcuts);

  useEffect(() => {
    const onStorage = () => setNumShortcuts(loadNumShortcuts());
    window.addEventListener("shortcuts:updated", onStorage);
    return () => window.removeEventListener("shortcuts:updated", onStorage);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      const target = e.target;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";

      if (e.key === "Escape") { setOpen(false); return; }
      if (!isInput && e.key === "?") { setOpen(o => !o); return; }
      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); navigate("/items"); }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") { e.preventDefault(); navigate("/new-bill"); }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); navigate("/"); }

      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const sc = numShortcuts.find(s => s.key === e.key);
        if (sc?.path) navigate(sc.path);
      }
    };

    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("shortcuts:open", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("shortcuts:open", onOpen); };
  }, [navigate, numShortcuts]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-base font-medium">Keyboard Shortcuts</h2>
          <button onClick={() => setOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg leading-none">✕</button>
        </div>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {FIXED_SHORTCUTS.map(s => (
            <div key={s.keys} className="flex items-center justify-between gap-4 py-1">
              <span className="text-xs text-[var(--text-secondary)]">{s.desc}</span>
              <kbd className="flex-shrink-0 px-2 py-0.5 text-[10px] border border-[var(--border-subtle)] rounded bg-[var(--bg)] font-mono text-[var(--text-primary)]">{s.keys}</kbd>
            </div>
          ))}
          <p className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] pt-2 pb-0.5">Number shortcuts (Ctrl + 1–9)</p>
          {numShortcuts.map(s => (
            <div key={s.key} className="flex items-center justify-between gap-4 py-1">
              <span className="text-xs text-[var(--text-secondary)]">{s.desc}</span>
              <kbd className="flex-shrink-0 px-2 py-0.5 text-[10px] border border-[var(--border-subtle)] rounded bg-[var(--bg)] font-mono text-[var(--text-primary)]">Ctrl + {s.key}</kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-[var(--text-secondary)] text-center">Configurable in <span className="font-medium">Settings → Keyboard Shortcuts</span></p>
      </div>
    </div>
  );
}
