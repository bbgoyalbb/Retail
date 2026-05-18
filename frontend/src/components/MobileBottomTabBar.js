import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { House, Receipt, BookOpen, Table, DotsThree, Kanban, ClipboardText, UsersThree } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * MobileBottomTabBar - Persistent bottom tab bar for mobile navigation
 */
export default function MobileBottomTabBar({ onOpenSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  const role = user?.role || "cashier";
  const isManager = ["admin", "manager"].includes(role);

  const getTabs = () => {
    const tabs = [
      { key: "home", label: "Home", icon: House, path: "/" },
      { key: "bill", label: "Bill", icon: Receipt, path: "/new-bill" },
    ];

    if (isManager) {
      tabs.push({ key: "daybook", label: "Ledger", icon: BookOpen, path: "/daybook" });
      tabs.push({ key: "labour", label: "Labour", icon: UsersThree, path: "/labour" });
    } else {
      tabs.push({ key: "jobwork", label: "Jobs", icon: Kanban, path: "/jobwork" });
      tabs.push({ key: "status", label: "Status", icon: ClipboardText, path: "/order-status" });
    }

    tabs.push({ key: "more", label: "More", icon: DotsThree, path: null, action: "sidebar" });
    return tabs;
  };

  const tabs = getTabs();

  const handleClick = (tab) => {
    if (tab.action === "sidebar") {
      onOpenSidebar();
    } else if (tab.path) {
      navigate(tab.path);
    }
  };

  const isActive = (tab) => {
    if (tab.action === "sidebar") return false;
    return location.pathname === tab.path;
  };

  return (
    <nav 
      data-testid="mobile-bottom-tab-bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/90 border-t border-border/50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab);
          
          return (
            <button
              key={tab.key}
              onClick={() => handleClick(tab)}
              className={cn(
                "relative flex flex-col items-center justify-center flex-1 h-full min-w-0 transition-colors duration-100 active:scale-90",
                active ? "text-primary" : "text-muted-foreground opacity-60 hover:opacity-100"
              )}
              aria-label={tab.label}
            >
              {active && (
                <div className="absolute top-1 w-8 h-1 bg-primary rounded-full" />
              )}
              <Icon 
                size={22} 
                weight={active ? "duotone" : "bold"} 
                className="flex-shrink-0"
              />
              <span className="text-[9px] font-black uppercase tracking-widest mt-1 truncate max-w-full px-1">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
