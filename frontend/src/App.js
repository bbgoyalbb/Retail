import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import NewBill from "@/pages/NewBill";
import TailoringOrders from "@/pages/TailoringOrders";
import AddOns from "@/pages/AddOns";
import JobWork from "@/pages/JobWork";
import Settlements from "@/pages/Settlements";
import Daybook from "@/pages/Daybook";
import LabourPayments from "@/pages/LabourPayments";
import ItemsManager from "@/pages/ItemsManager";
import SearchPage from "@/pages/SearchPage";
import Reports from "@/pages/Reports";
import DataManager from "@/pages/DataManager";
import { seedData } from "@/api";

function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState("dashboard");

  useEffect(() => {
    seedData().catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" data-testid="app-shell">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className={`flex-1 overflow-y-auto transition-all duration-200`}>
        <div className="p-4 pt-14 sm:p-6 sm:pt-6 lg:p-8 max-w-[1600px] mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new-bill" element={<NewBill />} />
            <Route path="/tailoring" element={<TailoringOrders />} />
            <Route path="/addons" element={<AddOns />} />
            <Route path="/jobwork" element={<JobWork />} />
            <Route path="/settlements" element={<Settlements />} />
            <Route path="/daybook" element={<Daybook />} />
            <Route path="/labour" element={<LabourPayments />} />
            <Route path="/items" element={<ItemsManager />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/data" element={<DataManager />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
