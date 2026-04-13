import { useNavigate, useLocation } from "react-router-dom";
import {
  House, Receipt, Scissors, PlusCircle, Kanban,
  CurrencyDollar, BookOpen, UsersThree, List, X,
  MagnifyingGlass, Table, ChartBar, FilePdf, Database
} from "@phosphor-icons/react";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: House, path: "/" },
  { key: "new-bill", label: "New Bill", icon: Receipt, path: "/new-bill" },
  { key: "tailoring", label: "Tailoring Orders", icon: Scissors, path: "/tailoring" },
  { key: "addons", label: "Add-ons", icon: PlusCircle, path: "/addons" },
  { key: "jobwork", label: "Job Work", icon: Kanban, path: "/jobwork" },
  { key: "settlements", label: "Settlements", icon: CurrencyDollar, path: "/settlements" },
  { key: "daybook", label: "Daybook", icon: BookOpen, path: "/daybook" },
  { key: "labour", label: "Labour Payments", icon: UsersThree, path: "/labour" },
  { key: "divider", label: "divider" },
  { key: "items", label: "Manage Items", icon: Table, path: "/items" },
  { key: "search", label: "Search", icon: MagnifyingGlass, path: "/search" },
  { key: "reports", label: "Reports", icon: ChartBar, path: "/reports" },
  { key: "data", label: "Data Manager", icon: Database, path: "/data" },
];

export default function Sidebar({ open, setOpen }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Mobile toggle */}
      <button
        data-testid="sidebar-toggle"
        className="fixed top-3 left-3 z-50 lg:hidden p-2.5 rounded-sm bg-white border border-[var(--border-subtle)] shadow-sm"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <List size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-[var(--border-subtle)] 
          flex flex-col transition-transform duration-200 
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-64'}`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <img
              src="https://static.prod-images.emergentagent.com/jobs/f813632a-d4ef-45e5-9c67-fe9c01175218/images/dc8122dfb61f974926fbd129938ac6d035001c4207717108f9214e4b10d0e9ed.png"
              alt="Logo"
              className="w-8 h-8"
            />
            <div>
              <h1 className="font-heading text-base font-semibold tracking-tight text-[var(--text-primary)]">
                Retail Book
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                Fabric & Tailoring
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            if (item.key === "divider") {
              return <div key="divider" className="my-3 border-t border-[var(--border-subtle)]" />;
            }
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                data-testid={`nav-${item.key}`}
                onClick={() => { navigate(item.path); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-sm transition-all duration-200
                  ${isActive
                    ? 'bg-[var(--brand)] text-white font-medium'
                    : 'text-[var(--text-secondary)] hover:bg-[#F5F3EE] hover:text-[var(--text-primary)]'
                  }`}
              >
                <Icon size={20} weight={isActive ? "fill" : "regular"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-subtle)]">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)] text-center">
            Retail Management v1.0
          </p>
        </div>
      </aside>
    </>
  );
}
