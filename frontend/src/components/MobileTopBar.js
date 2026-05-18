import { useState, useEffect } from "react";
import { List } from "@phosphor-icons/react";
import { getPublicSettings, BACKEND_URL } from "@/api";

export default function MobileTopBar({ title, onMenuClick }) {
  const [logo, setLogo] = useState(null);
  const [firmName, setFirmName] = useState("");

  useEffect(() => {
    getPublicSettings().then(s => {
      setLogo(s?.firm_logo || null);
      setFirmName(s?.firm_name || "R");
    }).catch(() => {});
  }, []);

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-16 bg-card/90 border-b border-border/50 flex items-center px-4 gap-4 shadow-sm">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-muted/30 text-foreground active:scale-90 transition-colors"
      >
        <List size={22} weight="bold" />
      </button>
      
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-lg bg-primary flex-shrink-0 flex items-center justify-center overflow-hidden">
          {typeof logo === "string" && logo ? (
            <img src={logo.startsWith("http") ? logo : `${BACKEND_URL}${logo}`} alt="logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-white font-black text-sm uppercase">{firmName.charAt(0)}</span>
          )}
        </div>
        <h1 className="font-heading text-sm font-black uppercase tracking-widest text-foreground truncate">
          {title}
        </h1>
      </div>
      
      <div className="w-10" /> {/* Spacer for symmetry */}
    </header>
  );
}
