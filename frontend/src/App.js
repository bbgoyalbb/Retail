import { useState, useEffect, lazy, Suspense } from "react"; // useEffect used in OfflineBanner
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import BackToTop from "@/components/BackToTop";
import MobileTopBar from "@/components/MobileTopBar";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/components/ThemeProvider";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useLocation } from "react-router-dom";

const PAGE_TITLES = {
  "/": "Dashboard",
  "/new-bill": "New Bill",
  "/tailoring": "Tailoring Orders",
  "/addons": "Add-ons",
  "/jobwork": "Job Work",
  "/settlements": "Settlements",
  "/daybook": "Daybook",
  "/labour": "Labour Payments",
  "/items": "Manage Orders",
  "/order-status": "Order Status",
  "/search": "Search",
  "/reports": "Reports",
  "/data": "Data Manager",
  "/settings": "Settings",
  "/users": "Users",
  "/audit": "Audit Log",
};

// Lazy-load all pages for better initial load performance
const Dashboard     = lazy(() => import("@/pages/Dashboard"));
const NewBill       = lazy(() => import("@/pages/NewBill"));
const TailoringOrders = lazy(() => import("@/pages/TailoringOrders"));
const AddOns        = lazy(() => import("@/pages/AddOns"));
const JobWork       = lazy(() => import("@/pages/JobWork"));
const Settlements   = lazy(() => import("@/pages/Settlements"));
const Daybook       = lazy(() => import("@/pages/Daybook"));
const LabourPayments = lazy(() => import("@/pages/LabourPayments"));
const ItemsManager  = lazy(() => import("@/pages/ItemsManager"));
const SearchPage    = lazy(() => import("@/pages/SearchPage"));
const OrderStatus   = lazy(() => import("@/pages/OrderStatus"));
const Reports       = lazy(() => import("@/pages/Reports"));
const DataManager   = lazy(() => import("@/pages/DataManager"));
const SettingsPage  = lazy(() => import("@/pages/SettingsPage"));
const UsersPage     = lazy(() => import("@/pages/UsersPage"));
const AuditLogPage  = lazy(() => import("@/pages/AuditLogPage"));
const LoginPage     = lazy(() => import("@/pages/LoginPage"));

function RequireRole({ roles, path, children }) {
  const { user } = useAuth();
  const roleBlocked = !roles.includes(user?.role);
  const allowedPages = user?.allowed_pages ?? [];
  const pageBlocked = allowedPages.length > 0 && path && !allowedPages.includes(path);
  if (roleBlocked || pageBlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <p className="text-4xl">🔒</p>
        <p className="font-heading text-lg font-semibold text-[var(--text-primary)]">Access Restricted</p>
        <p className="text-sm text-[var(--text-secondary)]">
          {roleBlocked
            ? <>Your role <strong>{user?.role}</strong> does not have permission to view this page.</>
            : "This page has been disabled for your account by the administrator."}
        </p>
      </div>
    );
  }
  return children;
}

function PageLoader() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-[var(--border-subtle)] rounded-sm" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm" />)}
      </div>
      <div className="h-64 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm" />
    </div>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[110] bg-amber-500 text-white text-xs font-medium text-center py-1.5 px-4 shadow-md">
      ⚠ No internet connection — some features may not work
    </div>
  );
}

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem("sidebar_open") !== "false"; } catch { return true; }
  });
  const { user, loading } = useAuth();
  const location = useLocation();

  const handleSetOpen = (v) => {
    setSidebarOpen(v);
    try { localStorage.setItem("sidebar_open", String(v)); } catch {}
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--background)]">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--border-strong)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Toaster />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" state={{ from: location.pathname }} />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" data-testid="app-shell">
      <OfflineBanner />
      <Sidebar open={sidebarOpen} setOpen={handleSetOpen} />
      <BackToTop />
      <main className="flex-1 overflow-y-auto min-w-0">
        <MobileTopBar title={PAGE_TITLES[location.pathname] ?? "Retail Book"} onMenuClick={() => handleSetOpen(!sidebarOpen)} />
        <div className="p-4 pt-16 sm:p-5 sm:pt-16 lg:p-8 lg:pt-8 max-w-[1600px] mx-auto page-in">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <KeyboardShortcuts />
              <Routes>
                {/* All roles */}
                <Route path="/" element={<Dashboard />} />
                <Route path="/new-bill" element={<NewBill />} />
                <Route path="/tailoring" element={<TailoringOrders />} />
                <Route path="/addons" element={<AddOns />} />
                <Route path="/jobwork" element={<JobWork />} />
                <Route path="/order-status" element={<OrderStatus />} />
                <Route path="/search" element={<SearchPage />} />

                {/* Manager + Admin */}
                <Route path="/settlements" element={<RequireRole roles={["admin","manager"]} path="/settlements"><Settlements /></RequireRole>} />
                <Route path="/daybook" element={<RequireRole roles={["admin","manager"]} path="/daybook"><Daybook /></RequireRole>} />
                <Route path="/labour" element={<RequireRole roles={["admin","manager"]} path="/labour"><LabourPayments /></RequireRole>} />
                <Route path="/items" element={<RequireRole roles={["admin","manager"]} path="/items"><ItemsManager /></RequireRole>} />
                <Route path="/reports" element={<RequireRole roles={["admin","manager"]} path="/reports"><Reports /></RequireRole>} />

                {/* Admin only */}
                <Route path="/data" element={<RequireRole roles={["admin"]} path="/data"><DataManager /></RequireRole>} />
                <Route path="/settings" element={<RequireRole roles={["admin"]} path="/settings"><SettingsPage /></RequireRole>} />
                <Route path="/users" element={<RequireRole roles={["admin"]} path="/users"><UsersPage /></RequireRole>} />
                <Route path="/audit" element={<RequireRole roles={["admin"]} path="/audit"><AuditLogPage /></RequireRole>} />

                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;