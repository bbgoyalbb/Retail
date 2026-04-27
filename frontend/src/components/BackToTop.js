import { useState, useEffect } from "react";
import { ArrowUp } from "@phosphor-icons/react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const onScroll = () => setVisible(main.scrollTop > 300);
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  const handleClick = () => {
    const main = document.querySelector("main");
    if (main) main.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 p-2.5 bg-[var(--brand)] text-white rounded-full shadow-lg hover:bg-[var(--brand-hover)] transition-all duration-200 hover:translate-y-[-2px]"
      title="Back to top"
    >
      <ArrowUp size={18} weight="bold" />
    </button>
  );
}
