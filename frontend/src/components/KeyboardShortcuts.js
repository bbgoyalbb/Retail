import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const SHORTCUTS = [
  { keys: "Ctrl + K",   desc: "Go to Search" },
  { keys: "Ctrl + N",   desc: "New Bill" },
  { keys: "Ctrl + D",   desc: "Dashboard" },
  { keys: "Ctrl + 1",   desc: "Dashboard" },
  { keys: "Ctrl + 2",   desc: "New Bill" },
  { keys: "Ctrl + 3",   desc: "Tailoring" },
  { keys: "Ctrl + 4",   desc: "Settlements" },
  { keys: "Ctrl + 5",   desc: "Daybook" },
  { keys: "Ctrl + 6",   desc: "Items" },
  { keys: "Ctrl + 7",   desc: "Order Status" },
  { keys: "Ctrl + 8",   desc: "Search" },
  { keys: "Ctrl + 9",   desc: "Settings" },
  { keys: "Ctrl + S",   desc: "Save Bill (on New Bill page)" },
  { keys: "?",          desc: "Show this help" },
  { keys: "Esc",        desc: "Close modals / dialogs" },
];

export function KeyboardShortcuts() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      const target = e.target;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true";

      if (e.key === "Escape") { setOpen(false); return; }
      if (!isInput && e.key === "?") { setOpen(o => !o); return; }
      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); navigate("/search"); }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") { e.preventDefault(); navigate("/new-bill"); }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") { e.preventDefault(); navigate("/"); }

      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const map = { "1": "/", "2": "/new-bill", "3": "/tailoring", "4": "/settlements", "5": "/daybook", "6": "/items", "7": "/order-status", "8": "/search", "9": "/settings" };
        if (map[e.key]) navigate(map[e.key]);
      }
    };

    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("shortcuts:open", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("shortcuts:open", onOpen); };
  }, [navigate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm shadow-xl max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-base font-medium">Keyboard Shortcuts</h2>
          <button onClick={() => setOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg leading-none">✕</button>
        </div>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {SHORTCUTS.map(s => (
            <div key={s.keys} className="flex items-center justify-between gap-4 py-1">
              <span className="text-xs text-[var(--text-secondary)]">{s.desc}</span>
              <kbd className="flex-shrink-0 px-2 py-0.5 text-[10px] border border-[var(--border-subtle)] rounded bg-[var(--bg)] font-mono text-[var(--text-primary)]">{s.keys}</kbd>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[10px] text-[var(--text-secondary)] text-center">Press <kbd className="px-1 border border-[var(--border-subtle)] rounded font-mono">?</kbd> or <kbd className="px-1 border border-[var(--border-subtle)] rounded font-mono">Esc</kbd> to toggle</p>
      </div>
    </div>
  );
}
