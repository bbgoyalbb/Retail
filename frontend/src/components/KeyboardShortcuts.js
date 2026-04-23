import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function KeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      // Ignore when typing in inputs/textareas
      const target = e.target;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true";
      if (isInput) return;

      // Ctrl/Cmd + K → Search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        navigate("/search");
      }

      // Ctrl/Cmd + N → New Bill
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        navigate("/new-bill");
      }

      // Ctrl/Cmd + D → Dashboard
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        navigate("/");
      }

      // Ctrl/Cmd + 1-9 → Quick nav
      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const map = {
          "1": "/",
          "2": "/new-bill",
          "3": "/tailoring",
          "4": "/settlements",
          "5": "/daybook",
          "6": "/items",
          "7": "/order-status",
          "8": "/search",
          "9": "/settings",
        };
        if (map[e.key]) navigate(map[e.key]);
      }

      // Esc → Close modals (handled by individual pages, but could be global)
      if (e.key === "Escape") {
        // Could dispatch a global event here if needed
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return null;
}
