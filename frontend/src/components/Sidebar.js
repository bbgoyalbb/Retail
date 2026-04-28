import React, { useState, useEffect } from "react";

import { useNavigate, useLocation } from "react-router-dom";

import { useTheme } from "@/components/ThemeProvider";

import { useAuth } from "@/context/AuthContext";
import { getDaybookPendingCount, getPublicSettings, BACKEND_URL } from "@/api";

import {

  House, Receipt, Kanban,

  BookOpen, UsersThree,

  Table, ChartBar, Database, Gear, ClipboardText,

  CaretDoubleLeft, CaretDoubleRight, Sun, Moon, SignOut, UserCircle, UsersFour, ClockCounterClockwise, Keyboard

} from "@phosphor-icons/react";



const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: House, path: "/" },
  { key: "section-tx", type: "section", label: "Transactions" },
  { key: "new-bill", label: "New Bill", icon: Receipt, path: "/new-bill" },
  { key: "jobwork", label: "Job Work", icon: Kanban, path: "/jobwork" },
  { key: "section-fin", type: "section", label: "Finances", managerOnly: true },
  { key: "daybook", label: "Daybook", icon: BookOpen, path: "/daybook", managerOnly: true },
  { key: "labour", label: "Labour Payments", icon: UsersThree, path: "/labour", managerOnly: true },
  { key: "section-mgmt", type: "section", label: "Manage" },
  { key: "items", label: "Manage Orders", icon: Table, path: "/items", managerOnly: true },
  { key: "order-status", label: "Order Status", icon: ClipboardText, path: "/order-status" },
  { key: "reports", label: "Reports", icon: ChartBar, path: "/reports", managerOnly: true },
  { key: "data", label: "Data Manager", icon: Database, path: "/data", adminOnly: true },
  { key: "settings", label: "Settings", icon: Gear, path: "/settings", adminOnly: true },
  { key: "users", label: "Users", icon: UsersFour, path: "/users", adminOnly: true },
  { key: "audit", label: "Audit Log", icon: ClockCounterClockwise, path: "/audit", adminOnly: true },
];



export default function Sidebar({ open, setOpen }) {

  const navigate = useNavigate();

  const location = useLocation();

  const { theme, toggle } = useTheme();

  const { user, logout } = useAuth();

  const [confirmLogout, setConfirmLogout] = useState(false);
  const [daybookPending, setDaybookPending] = useState(0);
  const [firmLogo, setFirmLogo] = useState(null);
  const [firmName, setFirmName] = useState("Retail Book");

  useEffect(() => {
    const fetchSettings = () => {
      getPublicSettings().then(s => {
        setFirmLogo(s?.firm_logo || null);
        if (s?.firm_name) setFirmName(s.firm_name);
      }).catch(() => {});
    };
    fetchSettings();
    window.addEventListener("focus", fetchSettings);
    return () => window.removeEventListener("focus", fetchSettings);
  }, []);

  useEffect(() => {
    const fetch = () => getDaybookPendingCount().then(r => setDaybookPending(r.data?.count || 0)).catch(() => {});
    fetch();
    const timer = setInterval(fetch, 60000);
    return () => clearInterval(timer);
  }, []);



  const handleLogout = () => setConfirmLogout(true);



  // Desktop: collapsed = icon-only rail

  const [collapsed, setCollapsed] = useState(() => {

    try { return localStorage.getItem("sidebar_collapsed") === "true"; } catch { return false; }

  });



  const toggleCollapse = () => {

    const next = !collapsed;

    setCollapsed(next);

    try { localStorage.setItem("sidebar_collapsed", String(next)); } catch {}

  };



  return (

    <>

      {/* Mobile overlay */}

      {open && (

        <div

          className="fixed inset-0 bg-black/30 z-40 md:hidden"

          onClick={() => setOpen(false)}

          aria-hidden="true"

        />

      )}



      {/* Sidebar */}

      <aside

        data-testid="sidebar"

        className={`

          fixed md:static inset-y-0 left-0 z-40 bg-[var(--surface)] border-r border-[var(--border-subtle)]

          flex flex-col transition-all duration-200 flex-shrink-0

          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}

          ${collapsed ? 'md:w-[60px]' : 'w-64'}

        `}

      >

        {/* Logo */}

        <div className={`border-b border-[var(--border-subtle)] flex items-center justify-between ${collapsed ? 'p-3' : 'px-4 py-3'}`}>

          <div className={`flex items-center gap-3 overflow-hidden ${collapsed ? 'justify-center w-full' : ''}`}>

            <div className={`flex-shrink-0 flex items-center justify-center ${collapsed ? 'w-9 h-9' : 'w-12 h-12'}`} style={{ background: firmLogo ? "transparent" : "var(--brand)", borderRadius: "8px" }}>

              {firmLogo
                ? <img src={firmLogo.startsWith("http") ? firmLogo : `${BACKEND_URL}${firmLogo}`} alt="logo" className="w-full h-full object-contain" style={{ borderRadius: "8px" }} />
                : <span className="w-full h-full flex items-center justify-center text-white font-serif font-bold text-xl leading-none">{firmName.charAt(0).toUpperCase()}</span>
              }

            </div>

            {!collapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-[var(--text-primary)] leading-tight truncate">{firmName}</p>
                <p className="text-[10px] text-[var(--text-secondary)] leading-tight mt-0.5">Retail Book</p>
              </div>
            )}

          </div>

        </div>



        {/* Nav */}

        <nav className={`flex-1 py-3 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-1.5 space-y-1' : 'px-3 space-y-0.5'}`}>

          {NAV_ITEMS.filter(item => {

            if (item.adminOnly && user?.role !== "admin") return false;

            if (item.managerOnly && !["admin","manager"].includes(user?.role)) return false;

            const allowed = user?.allowed_pages ?? [];

            if (allowed.length > 0 && item.path && !allowed.includes(item.path)) return false;

            return true;

          }).map(item => {

            if (item.type === "section") {

              return collapsed ? null : (

                <p key={item.key} className="px-3 pt-4 pb-1 text-[9px] uppercase tracking-[.18em] font-semibold text-[var(--border-strong)]">{item.label}</p>

              );

            }

            const isActive = location.pathname === item.path;

            const Icon = item.icon;

            return (

              <button

                key={item.key}

                data-testid={`nav-${item.key}`}

                title={collapsed ? item.label : undefined}

                onClick={() => { navigate(item.path); setOpen(false); }}

                className={`

                  relative w-full flex items-center text-sm rounded-sm transition-all duration-150 active:scale-[0.97]

                  ${collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}

                  ${isActive

                    ? 'bg-[var(--brand)] text-white font-medium'

                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text-primary)]'

                  }`}

              >

                <Icon size={20} weight={isActive ? "fill" : "regular"} className="flex-shrink-0" />

                {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                {!collapsed && item.key === 'daybook' && daybookPending > 0 && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0 ${
                    isActive ? 'bg-white text-[var(--brand)]' : 'bg-[var(--brand)] text-white'
                  }`}>{daybookPending > 99 ? '99+' : daybookPending}</span>
                )}
                {collapsed && item.key === 'daybook' && daybookPending > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[var(--brand)] block" />
                )}

              </button>

            );

          })}

        </nav>



        {/* Footer: desktop collapse toggle + theme */}

        <div className={`border-t border-[var(--border-subtle)] ${collapsed ? 'p-2' : 'p-3'}`}>

          <div className={`flex ${collapsed ? 'flex-col' : 'flex-row'} gap-2`}>

            <button

              onClick={toggleCollapse}

              className="hidden md:flex flex-1 items-center justify-center gap-2 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] rounded-sm transition-colors"

              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}

            >

              {collapsed

                ? <CaretDoubleRight size={16} />

                : <><CaretDoubleLeft size={16} /><span>Collapse</span></>

              }

            </button>

            <button

              onClick={toggle}

              className="flex items-center justify-center gap-2 py-2 px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] rounded-sm transition-colors"

              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}

            >

              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}

              {!collapsed && <span>{theme === "light" ? "Dark" : "Light"}</span>}

            </button>

          </div>

          {collapsed ? (
            <button
              onClick={() => { navigate("/new-bill"); setOpen(false); }}
              className="w-full flex items-center justify-center mt-2 py-2 bg-[var(--brand)] text-white rounded-sm hover:opacity-90 active:scale-[0.98] transition-all"
              title="New Bill"
            >
              <Receipt size={18} weight="bold" />
            </button>
          ) : (
            <button
              onClick={() => { navigate("/new-bill"); setOpen(false); }}
              className="w-full flex items-center justify-center gap-2 mt-2 py-2 px-3 bg-[var(--brand)] text-white text-xs font-medium rounded-sm hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Receipt size={14} weight="bold" />
              New Bill
            </button>
          )}

          {/* Keyboard shortcuts hint */}
          {!collapsed && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('shortcuts:open'))}
              className="w-full flex items-center justify-center gap-1.5 mt-1 py-1.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)] rounded-sm transition-colors"
              title="Keyboard shortcuts"
            >
              <Keyboard size={13} />
              <span>Shortcuts</span>
              <kbd className="ml-auto px-1 py-0.5 text-[9px] border border-[var(--border-subtle)] rounded bg-[var(--bg)] font-mono">?</kbd>
            </button>
          )}

          {/* User info + logout */}

          <div className={`mt-2 flex items-center ${collapsed ? 'justify-center' : 'gap-2 px-2'} py-1.5 rounded-sm bg-[var(--bg)]`}>

            <UserCircle size={collapsed ? 20 : 18} className="text-[var(--text-secondary)] flex-shrink-0" />

            {!collapsed && (

              <div className="flex-1 min-w-0">

                <p className="text-xs font-medium text-[var(--text-primary)] truncate">{user?.full_name || user?.username}</p>

                <p className="text-[10px] text-[var(--text-secondary)] uppercase">{user?.role}</p>

              </div>

            )}

            <button

              onClick={handleLogout}

              className="p-1 rounded-sm hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-red-500 transition-colors"

              title="Logout"

            >

              <SignOut size={16} />

            </button>

          </div>

        </div>

      </aside>



      {/* Logout confirmation dialog */}

      {confirmLogout && (

        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">

          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm shadow-xl w-full max-w-xs p-5 space-y-4">

            <div>

              <p className="text-sm font-semibold text-[var(--text-primary)]">Sign out?</p>

              <p className="text-xs text-[var(--text-secondary)] mt-1">You will be returned to the login screen.</p>

            </div>

            <div className="flex gap-2">

              <button

                onClick={() => setConfirmLogout(false)}

                className="flex-1 px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] transition-colors"

              >

                Cancel

              </button>

              <button

                onClick={() => { setConfirmLogout(false); logout(); }}

                className="flex-1 px-3 py-2 text-sm bg-red-500 text-white rounded-sm hover:bg-red-600 transition-colors"

              >

                Sign Out

              </button>

            </div>

          </div>

        </div>

      )}

    </>

  );

}

