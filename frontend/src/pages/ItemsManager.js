import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  getItems, getItem, getAdvances, updateItem, deleteItem, createItem,
  updateAdvance, createAdvance, deleteAdvance, invalidateItemsCache,
  invalidateAdvancesCache, getSettings, searchItems, getCustomers,
} from "@/api";
import { fmt } from "@/lib/fmt";
import { DatePickerInput } from "@/components/DatePickerInput";
import {
  PencilSimple, Trash, X, Printer, CaretDown, CaretRight, Check, Plus, CheckCircle,
  CurrencyDollar, Scissors, Tag, MagnifyingGlass, Funnel,
} from "@phosphor-icons/react";
import InvoiceModal from "@/components/InvoiceModal";
import SettlementPanel from "@/components/SettlementPanel";
import OrderDetailPane from "@/components/OrderDetailPane";
import { TailoringOverlay, AddOnOverlay } from "@/components/OrderOverlays";

// ─── Section config ───────────────────────────────────────────
const SECTIONS = {
  items: {
    label: "Items", description: "Basic item details and fabric payment",
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "name", label: "Customer Name", type: "text" },
      { key: "ref", label: "Reference", type: "text" },
      { key: "barcode", label: "Barcode", type: "text" },
      { key: "price", label: "Price", type: "number" },
      { key: "qty", label: "Quantity", type: "number", step: 0.1 },
      { key: "discount", label: "Discount %", type: "number", step: 0.01 },
      { key: "fabric_amount", label: "Fabric Amount", type: "number", computed: true },
      { key: "fabric_received", label: "Fabric Received", type: "number" },
      { key: "fabric_pending", label: "Fabric Pending", type: "number", computed: true },
      { key: "fabric_pay_date", label: "Fabric Pay Date", type: "date" },
      { key: "fabric_pay_mode", label: "Fabric Pay Mode", type: "text" },
      { key: "tally_fabric", label: "Tally Fabric", type: "checkbox" },
    ],
  },
  tailoring: {
    label: "Tailoring", description: "Tailoring order and labour details",
    fields: [
      { key: "order_no", label: "Order No", type: "text" },
      { key: "article_type", label: "Article Type", type: "select", options: ["N/A","Shirt","Pant","Gurkha Pant","Kurta","Pajama","Blazer","Safari Shirt","Indo","Sherwani","Jacket","W Coat"] },
      { key: "delivery_date", label: "Delivery Date", type: "date" },
      { key: "tailoring_status", label: "Tailoring Status", type: "select", options: ["N/A","Awaiting Order","Pending","Stitched","Delivered"] },
      { key: "tailoring_amount", label: "Tailoring Amount", type: "number" },
      { key: "tailoring_received", label: "Tailoring Received", type: "number" },
      { key: "tailoring_pending", label: "Tailoring Pending", type: "number", computed: true },
      { key: "tailoring_pay_date", label: "Tailoring Pay Date", type: "date" },
      { key: "tailoring_pay_mode", label: "Tailoring Pay Mode", type: "text" },
      { key: "labour_amount", label: "Labour Amount", type: "number" },
      { key: "labour_paid", label: "Labour Paid", type: "select", options: ["N/A","Yes"] },
      { key: "labour_pay_date", label: "Labour Pay Date", type: "date" },
      { key: "labour_payment_mode", label: "Labour Payment Mode", type: "select", options: ["N/A","Cash","PhonePe","Google Pay [E]","Google Pay [S]","Bank Transfer"] },
      { key: "tally_tailoring", label: "Tally Tailoring", type: "checkbox" },
    ],
  },
  embroidery: {
    label: "Embroidery", description: "Embroidery and karigar details",
    fields: [
      { key: "embroidery_status", label: "Embroidery Status", type: "select", options: ["N/A","Not Required","Required","In Progress","Finished"] },
      { key: "karigar", label: "Karigar", type: "text" },
      { key: "embroidery_amount", label: "Embroidery Amount", type: "number" },
      { key: "embroidery_received", label: "Embroidery Received", type: "number" },
      { key: "embroidery_pending", label: "Embroidery Pending", type: "number", computed: true },
      { key: "embroidery_pay_date", label: "Embroidery Pay Date", type: "date" },
      { key: "embroidery_pay_mode", label: "Embroidery Pay Mode", type: "text" },
      { key: "emb_labour_amount", label: "Emb. Labour Amount", type: "number" },
      { key: "emb_labour_paid", label: "Emb. Labour Paid", type: "select", options: ["N/A","Yes"] },
      { key: "emb_labour_date", label: "Emb. Labour Date", type: "date" },
      { key: "emb_labour_payment_mode", label: "Emb. Labour Payment Mode", type: "select", options: ["N/A","Cash","PhonePe","Google Pay [E]","Google Pay [S]","Bank Transfer"] },
      { key: "tally_embroidery", label: "Tally Embroidery", type: "checkbox" },
    ],
  },
  addon: {
    label: "Add-on", description: "Add-on accessory details",
    fields: [
      { key: "addon_desc", label: "Add-on Description", type: "text" },
      { key: "addon_amount", label: "Add-on Amount", type: "number" },
      { key: "addon_received", label: "Add-on Received", type: "number" },
      { key: "addon_pending", label: "Add-on Pending", type: "number", computed: true },
      { key: "addon_pay_date", label: "Add-on Pay Date", type: "date" },
      { key: "addon_pay_mode", label: "Add-on Pay Mode", type: "text" },
      { key: "tally_addon", label: "Tally Add-on", type: "checkbox" },
    ],
  },
  advances: {
    label: "Advances", description: "Advance payments for this reference",
    isAdvanceSection: true,
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "name", label: "Customer Name", type: "text" },
      { key: "ref", label: "Reference", type: "text" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "mode", label: "Payment Mode", type: "text" },
      { key: "tally", label: "Tally", type: "checkbox" },
    ],
  },
};

const FC = "w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:border-[var(--brand)] focus:outline-none bg-[var(--surface)] text-[var(--text-primary)]";

const renderFieldInput = (field, itemId, value, onChange) => {
  switch (field.type) {
    case "date":
      return <input type="date" value={value || ""} onChange={e => onChange(itemId, field.key, e.target.value)} className={FC}/>;
    case "number":
      return <input type="number" step={field.step || 1} value={value ?? 0}
        onChange={e => onChange(itemId, field.key, parseFloat(e.target.value) || 0)}
        disabled={field.computed}
        className={`${FC} ${field.computed ? "bg-[var(--bg)] text-[var(--text-secondary)] cursor-not-allowed" : ""}`}/>;
    case "select":
      return <select value={value || ""} onChange={e => onChange(itemId, field.key, e.target.value)} className={FC}>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>;
    case "checkbox":
      return <input type="checkbox" checked={!!value} onChange={e => onChange(itemId, field.key, e.target.checked)} className="w-4 h-4 accent-[var(--brand)]"/>;
    default:
      return <input type="text" value={value || ""} onChange={e => onChange(itemId, field.key, e.target.value)} className={FC}/>;
  }
};

const computeFabric = (price, qty, disc) =>
  Math.round((price - price * (disc || 0) / 100) * qty);
const computePending = (total, received) => Math.round(total - (received || 0));

// ─── Status badge ─────────────────────────────────────────────
const StatusBadge = ({ settled, cancelled, pending }) => {
  if (cancelled) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[var(--error)]/10 text-[var(--error)] font-medium">Cancelled</span>
  );
  if (settled) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#455D4A15] text-[var(--success)] font-medium flex items-center gap-0.5">
      <CheckCircle size={10} weight="fill"/>Settled
    </span>
  );
  return <span className="text-[10px] font-mono text-[var(--warning)]">₹{fmt(pending)}</span>;
};

// ─── Main page ────────────────────────────────────────────────
const SEARCH_DATE_PRESETS = [
  { label: "Today",        from: new Date().toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] },
  { label: "This Week",   from: new Date(Date.now() - ((new Date().getDay()||7)-1)*86400000).toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] },
  { label: "This Month",  from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] },
  { label: "Last Month",  from: new Date(new Date().getFullYear(), new Date().getMonth()-1, 1).toISOString().split("T")[0], to: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split("T")[0] },
  { label: "Last 90 Days",from: new Date(Date.now() - 89*86400000).toISOString().split("T")[0], to: new Date().toISOString().split("T")[0] },
];

export default function ItemsManager() {
  const searchRef = useRef(null);
  const location = useLocation();

  // Data
  const [allItems, setAllItems]     = useState([]);
  const [advances, setAdvances]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [message, setMessage]       = useState(null);

  // Filters
  const [nameFilter, setNameFilter] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  const [settleTab, setSettleTab]   = useState("unsettled");
  const [sortDir, setSortDir]       = useState("desc");

  // Full search state
  const [showFilters, setShowFilters]     = useState(false);
  const [searchDateFrom, setSearchDateFrom] = useState("");
  const [searchDateTo, setSearchDateTo]   = useState("");
  const [searchStatus, setSearchStatus]   = useState("All");
  const [searchPayment, setSearchPayment] = useState("All");
  const [searchMinAmt, setSearchMinAmt]   = useState("");
  const [searchMaxAmt, setSearchMaxAmt]   = useState("");
  const [searchCustomer, setSearchCustomer] = useState("All");
  const [customers, setCustomers]         = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Panel state
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [selectedRefs, setSelectedRefs] = useState(new Set());
  const [detailOpen, setDetailOpen]     = useState(false); // mobile toggle

  // Overlays
  const [settlementOrders, setSettlementOrders] = useState(null);
  const [invoiceRef, setInvoiceRef]             = useState(null);
  const [tailoringGroup, setTailoringGroup]     = useState(null);
  const [addonGroup, setAddonGroup]             = useState(null);

  // Edit modal
  const [selectedSection, setSelectedSection]     = useState(null);
  const [showSectionSelector, setShowSectionSelector] = useState(false);
  const [editMode, setEditMode]                   = useState(null);
  const [editItems, setEditItems]                 = useState([]);
  const [editData, setEditData]                   = useState({});
  const [originalData, setOriginalData]           = useState({});
  const [newItemIds, setNewItemIds]               = useState([]);
  const [saving, setSaving]                       = useState(false);
  const [advanceData, setAdvanceData]             = useState({});
  const [origAdvData, setOrigAdvData]             = useState({});
  const [newAdvances, setNewAdvances]             = useState([]);
  const [deletedAdvances, setDeletedAdvances]     = useState([]);
  const [tailoringRates, setTailoringRates]       = useState({});

  // Confirms
  const [delConfirm, setDelConfirm]         = useState(null);
  const [delMode, setDelMode]               = useState(null);
  const [cancelConfirm, setCancelConfirm]   = useState(null);
  const [mismatchPrompt, setMismatchPrompt] = useState(null);
  const [reSettlePrompt, setReSettlePrompt] = useState(null);

  // Settings
  useEffect(() => {
    getSettings().then(res => {
      const s = res?.data || {};
      setTailoringRates(s.tailoring_rates || {});
      if (Array.isArray(s.article_types) && s.article_types.length > 0) {
        const field = SECTIONS.tailoring.fields.find(f => f.key === "article_type");
        if (field) field.options = ["N/A", ...s.article_types];
      }
    }).catch(() => {});
    getCustomers().then(res => setCustomers(res.data || [])).catch(() => {});
  }, []);

  // Pre-fill search from URL params (Reports drill-down: /items?name=CustomerName)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const n = params.get("name");
    if (n) { setNameFilter(n); setDebouncedName(n); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(nameFilter), 400);
    return () => clearTimeout(t);
  }, [nameFilter]);

  // Ctrl+F
  useEffect(() => {
    const h = e => { if ((e.ctrlKey || e.metaKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Derived: are any advanced filters active?
  const hasAdvancedFilters = searchDateFrom || searchDateTo || searchStatus !== "All" || searchPayment !== "All" || searchMinAmt || searchMaxAmt || searchCustomer !== "All";
  const isSearchMode = !!(debouncedName || hasAdvancedFilters);

  // Full-search via /search API — fetches all matching items (up to 500)
  const runSearch = useCallback(async () => {
    setSearchLoading(true);
    const params = { q: debouncedName || "", limit: 500, skip: 0 };
    if (searchCustomer !== "All") params.customer = searchCustomer;
    if (searchDateFrom) params.date_from = searchDateFrom;
    if (searchDateTo) params.date_to = searchDateTo;
    if (searchStatus !== "All") params.status = searchStatus;
    if (searchPayment !== "All") params.payment_status = searchPayment;
    if (searchMinAmt) params.min_amount = parseFloat(searchMinAmt);
    if (searchMaxAmt) params.max_amount = parseFloat(searchMaxAmt);
    try {
      const res = await searchItems(params);
      setSearchResults(res.data.items || []);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  }, [debouncedName, searchCustomer, searchDateFrom, searchDateTo, searchStatus, searchPayment, searchMinAmt, searchMaxAmt]);

  // Auto-run search when search mode is active
  useEffect(() => {
    if (isSearchMode) { runSearch(); }
    else { setSearchResults([]); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchMode, runSearch]);

  const clearSearch = () => {
    setNameFilter(""); setDebouncedName("");
    setSearchDateFrom(""); setSearchDateTo(""); setSearchStatus("All"); setSearchPayment("All");
    setSearchMinAmt(""); setSearchMaxAmt(""); setSearchCustomer("All");
    setShowFilters(false); setSearchResults([]);
  };

  // Load data (grouped list mode)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 500, summary: true };
      const [itemsRes, advRes] = await Promise.all([getItems(params), getAdvances()]);
      setAllItems(itemsRes.data.items || []);
      setAdvances(advRes.data || []);
    } catch {
      setMessage({ type: "error", text: "Failed to load data" });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Settled = every section with amount > 0 has pay_mode starting with "Settled"
  const isOrderSettled = (group) => {
    return group.items.every(item => {
      const checks = [
        [item.fabric_amount,     item.fabric_pay_mode],
        [item.tailoring_amount,  item.tailoring_pay_mode],
        [item.embroidery_amount, item.embroidery_pay_mode],
        [item.addon_amount,      item.addon_pay_mode],
      ];
      return checks.every(([amt, mode]) => !amt || Number(amt) === 0 || String(mode || "").startsWith("Settled"));
    });
  };

  // Helper: build grouped map from a flat items array
  const buildGrouped = (items, advList) => {
    const g = {};
    items.forEach(item => {
      if (!g[item.ref]) g[item.ref] = {
        ref: item.ref, name: item.name, date: item.date, items: [],
        totals: { fabric: 0, tailoring: 0, embroidery: 0, addon: 0, advance: 0, total: 0, received: 0, pending: 0 },
      };
      const gr = g[item.ref];
      gr.items.push(item);
      gr.totals.fabric      += item.fabric_amount || 0;
      gr.totals.tailoring   += item.tailoring_amount || 0;
      gr.totals.embroidery  += item.embroidery_amount || 0;
      gr.totals.addon       += item.addon_amount || 0;
      gr.totals.total       += (item.fabric_amount || 0) + (item.tailoring_amount || 0) + (item.embroidery_amount || 0) + (item.addon_amount || 0);
      gr.totals.received    += (item.fabric_received || 0) + (item.tailoring_received || 0) + (item.embroidery_received || 0) + (item.addon_received || 0);
      if (!String(item.fabric_pay_mode || "").startsWith("Settled"))     gr.totals.pending += item.fabric_pending || 0;
      if (!String(item.tailoring_pay_mode || "").startsWith("Settled"))  gr.totals.pending += item.tailoring_pending || 0;
      if (!String(item.embroidery_pay_mode || "").startsWith("Settled")) gr.totals.pending += item.embroidery_pending || 0;
      if (!String(item.addon_pay_mode || "").startsWith("Settled"))      gr.totals.pending += item.addon_pending || 0;
    });
    advList.forEach(adv => { if (g[adv.ref]) g[adv.ref].totals.advance += adv.amount || 0; });
    return g;
  };

  const grouped = useMemo(() => buildGrouped(allItems, advances), [allItems, advances]);
  const searchGrouped = useMemo(() => buildGrouped(searchResults, advances), [searchResults, advances]);

  const refs = useMemo(() => {
    // In search mode: get the unique matched refs, then resolve full group data from `grouped`
    // so the order list shows the right refs but detail pane always gets complete items.
    const source = isSearchMode
      ? Object.keys(searchGrouped).map(ref => grouped[ref] || searchGrouped[ref])
      : Object.values(grouped);
    const filtered = isSearchMode ? source.filter(Boolean) : source.filter(g => {
      if (settleTab === "unsettled") return !isOrderSettled(g);
      if (settleTab === "settled")   return isOrderSettled(g) && g.totals.total > 0;
      if (settleTab === "awaiting")  return g.items.some(i => i.tailoring_status === "Awaiting Order");
      return true;
    });
    return filtered.sort((a, b) => {
      const cmp = String(a.date || "").localeCompare(String(b.date || ""));
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [grouped, searchGrouped, isSearchMode, settleTab, sortDir]);

  // Always look up full group from `grouped` so detail pane shows complete order data
  const selectedGroups = useMemo(
    () => Array.from(selectedRefs).map(ref => grouped[ref]).filter(Boolean),
    [selectedRefs, grouped]
  );

  // Select / deselect
  const selectRef = (ref, multi = false) => {
    setSelectedRefs(prev => {
      if (multi) {
        const next = new Set(prev);
        next.has(ref) ? next.delete(ref) : next.add(ref);
        return next;
      }
      if (prev.size === 1 && prev.has(ref)) return new Set();
      return new Set([ref]);
    });
    setDetailOpen(true);
  };

  // ─── Edit handlers ────────────────────────────────────────
  const startEdit = async (sectionKey, items, mode = "item") => {
    setSelectedSection(sectionKey);
    setEditMode(mode);
    const itemList = Array.isArray(items) ? items : [items];
    const full = await Promise.all(itemList.map(i => getItem(i.id).then(r => r.data).catch(() => i)));
    const init = {}, orig = {};
    full.forEach(item => { init[item.id] = { ...item }; orig[item.id] = { ...item }; });
    setEditItems(full); setEditData(init); setOriginalData(orig);
    if (sectionKey === "advances" && itemList.length > 0) {
      try {
        const res = await getAdvances({ ref: itemList[0].ref });
        const list = res.data || [];
        const ai = {}, ao = {};
        list.forEach(a => { ai[a.id] = { ...a }; ao[a.id] = { ...a }; });
        setAdvanceData(ai); setOrigAdvData(ao); setNewAdvances([]); setDeletedAdvances([]);
      } catch { setAdvanceData({}); setOrigAdvData({}); }
    }
    setShowSectionSelector(false);
  };

  const handleFieldChange = (itemId, key, value) => {
    setEditData(prev => {
      const u = { ...prev, [itemId]: { ...prev[itemId], [key]: value } };
      const it = u[itemId];
      if (["price","qty","discount"].includes(key))
        it.fabric_amount = computeFabric(parseFloat(it.price)||0, parseFloat(it.qty)||0, parseFloat(it.discount)||0);
      if (["fabric_amount","fabric_received","price","qty","discount"].includes(key))
        it.fabric_pending = computePending(parseFloat(it.fabric_amount)||0, parseFloat(it.fabric_received)||0);
      if (key === "article_type" && tailoringRates[value]) {
        it.tailoring_amount = parseFloat(tailoringRates[value].tailoring) || 0;
        it.labour_amount    = parseFloat(tailoringRates[value].labour)    || 0;
      }
      if (["tailoring_amount","tailoring_received","article_type"].includes(key))
        it.tailoring_pending = computePending(parseFloat(it.tailoring_amount)||0, parseFloat(it.tailoring_received)||0);
      if (["embroidery_amount","embroidery_received"].includes(key))
        it.embroidery_pending = computePending(parseFloat(it.embroidery_amount)||0, parseFloat(it.embroidery_received)||0);
      if (["addon_amount","addon_received"].includes(key))
        it.addon_pending = computePending(parseFloat(it.addon_amount)||0, parseFloat(it.addon_received)||0);
      if (key === "labour_paid" && value === "Yes" && !it.labour_pay_date)
        it.labour_pay_date = new Date().toISOString().split("T")[0];
      if (key === "emb_labour_paid" && value === "Yes" && !it.emb_labour_date)
        it.emb_labour_date = new Date().toISOString().split("T")[0];
      return u;
    });
  };

  const handleAdvChange    = (id, k, v) => setAdvanceData(p => ({ ...p, [id]: { ...p[id], [k]: v } }));
  const handleNewAdvChange = (idx, k, v) => setNewAdvances(p => { const u=[...p]; u[idx]={...u[idx],[k]:v}; return u; });
  const addNewAdvance      = () => setNewAdvances(p => [...p, { id: `new_${Date.now()}`, date: new Date().toISOString().split("T")[0], name: editItems[0]?.name||"", ref: editItems[0]?.ref||"", amount: 0, mode: "Cash", tally: false }]);
  const removeNewAdvance   = idx => setNewAdvances(p => p.filter((_,i) => i !== idx));
  const markAdvDelete      = id => { setDeletedAdvances(p=>[...p,id]); setAdvanceData(p=>{const u={...p};delete u[id];return u;}); };

  const addNewItem = () => {
    const tempId = `new_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    const ref = editItems[0]?.ref || "", name = editItems[0]?.name || "", date = editItems[0]?.date || new Date().toISOString().split("T")[0];
    const ni = { id:tempId,ref,name,date,barcode:"",price:0,qty:0,discount:0,fabric_amount:0,fabric_received:0,fabric_pending:0,fabric_pay_date:"",fabric_pay_mode:"N/A",tailoring_status:"N/A",article_type:"N/A",order_no:"N/A",delivery_date:"N/A",tailoring_amount:0,tailoring_received:0,tailoring_pending:0,tailoring_pay_date:"",tailoring_pay_mode:"N/A",embroidery_status:"N/A",karigar:"N/A",embroidery_amount:0,embroidery_received:0,embroidery_pending:0,embroidery_pay_date:"",embroidery_pay_mode:"N/A",addon_desc:"N/A",addon_amount:0,addon_received:0,addon_pending:0,addon_pay_date:"",addon_pay_mode:"N/A",labour_amount:0,labour_paid:"N/A",labour_pay_date:"",labour_payment_mode:"N/A",emb_labour_amount:0,emb_labour_paid:"N/A",emb_labour_date:"",emb_labour_payment_mode:"N/A",tally_fabric:false,tally_tailoring:false,tally_embroidery:false,tally_addon:false };
    setEditItems(p=>[...p,ni]); setEditData(p=>({...p,[tempId]:{...ni}})); setOriginalData(p=>({...p,[tempId]:{...ni}})); setNewItemIds(p=>[...p,tempId]);
  };

  const detectSettledChanges = (orig, cur) => {
    const changed = [];
    const chk = (ak, mk, label) => {
      if (!String(orig[mk]||"").startsWith("Settled")) return;
      const o = parseFloat(orig[ak])||0, n = parseFloat(cur[ak])||0;
      if (Math.abs(o-n) > 0.01) changed.push({ label, oldAmt:o, newAmt:n });
    };
    chk("fabric_amount","fabric_pay_mode","Fabric"); chk("tailoring_amount","tailoring_pay_mode","Tailoring");
    chk("embroidery_amount","embroidery_pay_mode","Embroidery"); chk("addon_amount","addon_pay_mode","Add-on");
    return changed;
  };

  const detectMismatches = (orig, cur) => {
    const mm = [];
    const chk = (ak, rk, mk, label) => {
      const oa=parseFloat(orig[ak])||0, na=parseFloat(cur[ak])||0, r=parseFloat(orig[rk])||0;
      if (String(cur[mk]||orig[mk]||"").startsWith("Settled")) return;
      if (na < oa && na < r) mm.push({ ref:orig.ref,type:label,oldAmount:oa,newAmount:na,received:r,overage:r-na });
    };
    chk("fabric_amount","fabric_received","fabric_pay_mode","Fabric");
    chk("tailoring_amount","tailoring_received","tailoring_pay_mode","Tailoring");
    chk("embroidery_amount","embroidery_received","embroidery_pay_mode","Embroidery");
    chk("addon_amount","addon_received","addon_pay_mode","Add-on");
    return mm;
  };

  const saveEdits = async () => {
    setSaving(true);
    // Advances
    if (selectedSection === "advances") {
      let ok=0, fail=0;
      for (const id of deletedAdvances) { try { await deleteAdvance(id); ok++; } catch { fail++; } }
      for (const [id, data] of Object.entries(advanceData)) {
        try {
          const orig=origAdvData[id]; const ch={};
          Object.keys(data).forEach(k=>{ if(JSON.stringify(data[k])!==JSON.stringify(orig?.[k])) ch[k]=data[k]; });
          if (Object.keys(ch).length) await updateAdvance(id, ch); ok++;
        } catch { fail++; }
      }
      for (const a of newAdvances) { try { const {id,...d}=a; await createAdvance(d); ok++; } catch { fail++; } }
      setSaving(false); setSelectedSection(null);
      setAdvanceData({}); setOrigAdvData({}); setNewAdvances([]); setDeletedAdvances([]); setEditItems([]);
      setMessage({ type: fail===0?"success":"error", text: fail===0?`Advances saved`:`${fail} operation(s) failed` });
      setTimeout(()=>setMessage(null),3000);
      invalidateItemsCache(); invalidateAdvancesCache(); loadData();
      return;
    }
    // Items
    let ok=0, fail=0, allMM=[], affRefs=new Set(), reRef=null, reCust=null, reSecs=[];
    for (const id of Object.keys(editData)) {
      if (newItemIds.includes(id)) continue;
      try {
        const orig=originalData[id], cur=editData[id]; const ch={};
        Object.keys(cur).forEach(k=>{ if(JSON.stringify(cur[k])!==JSON.stringify(orig[k])) ch[k]=cur[k]; });
        const mm=detectMismatches(orig,cur); if(mm.length){allMM.push(...mm);affRefs.add(orig.ref);}
        const sc=detectSettledChanges(orig,cur); if(sc.length){reRef=orig.ref;reCust=orig.name;reSecs=[...reSecs,...sc];}
        if (Object.keys(ch).length) await updateItem(id, ch); ok++;
      } catch { fail++; }
    }
    for (const id of newItemIds) { try { if(editData[id]) await createItem(editData[id]); ok++; } catch { fail++; } }
    setSaving(false); setSelectedSection(null); setEditData({}); setOriginalData({}); setEditItems([]); setNewItemIds([]);
    if (fail === 0) {
      if (allMM.length) setMismatchPrompt({ refs: Array.from(affRefs), mismatches: allMM });
      else if (reRef) { setReSettlePrompt({ ref:reRef,customer:reCust,sections:reSecs }); setMessage({ type:"success",text:`${ok} item(s) saved`}); setTimeout(()=>setMessage(null),2000); }
      else { setMessage({ type:"success",text:`${ok} item(s) saved`}); setTimeout(()=>setMessage(null),3000); }
    } else { setMessage({ type:"error",text:`${fail} failed, ${ok} saved`}); setTimeout(()=>setMessage(null),3000); }
    invalidateItemsCache(); loadData();
  };

  const cancelEdit = () => {
    setSelectedSection(null); setEditData({}); setOriginalData({}); setEditItems([]); setNewItemIds([]); setShowSectionSelector(false);
    setAdvanceData({}); setOrigAdvData({}); setNewAdvances([]); setDeletedAdvances([]);
  };

  const handleDelete = async () => {
    if (!delConfirm) return;
    try {
      if (delMode === "order") { for (const id of delConfirm.items.map(i=>i.id)) await deleteItem(id); }
      else await deleteItem(delConfirm.id);
      setMessage({ type:"success", text: delMode==="order"?`Order ${delConfirm.ref} deleted`:"Item deleted" });
    } catch { setMessage({ type:"error", text:"Failed to delete" }); }
    setDelConfirm(null); invalidateItemsCache(); loadData();
    setTimeout(()=>setMessage(null),3000);
  };

  const handleCancelOrder = async (group) => {
    const zero = { cancelled:true,cancelled_at:new Date().toISOString(),price:0,qty:0,discount:0,fabric_amount:0,fabric_received:0,fabric_pending:0,fabric_pay_mode:"N/A",tally_fabric:false,tailoring_amount:0,tailoring_received:0,tailoring_pending:0,tailoring_pay_mode:"N/A",tailoring_status:"N/A",article_type:"N/A",order_no:"N/A",delivery_date:"N/A",labour_amount:0,labour_paid:"N/A",tally_tailoring:false,embroidery_amount:0,embroidery_received:0,embroidery_pending:0,embroidery_pay_mode:"N/A",embroidery_status:"N/A",karigar:"N/A",emb_labour_amount:0,emb_labour_paid:"N/A",tally_embroidery:false,addon_amount:0,addon_received:0,addon_pending:0,addon_pay_mode:"N/A",addon_desc:"N/A",tally_addon:false };
    let ok = 0;
    for (const item of group.items) { try { await updateItem(item.id, zero); ok++; } catch {} }
    setMessage({ type: ok===group.items.length?"success":"error", text: ok===group.items.length?`Order ${group.ref} cancelled`:`${group.items.length-ok} items failed` });
    setTimeout(()=>setMessage(null),3000);
    setCancelConfirm(null); invalidateItemsCache(); loadData();
  };

  const handleCancelItem = async (item) => {
    const zero = { cancelled:true,cancelled_at:new Date().toISOString(),price:0,qty:0,discount:0,fabric_amount:0,fabric_received:0,fabric_pending:0,fabric_pay_mode:"N/A",tally_fabric:false,tailoring_amount:0,tailoring_received:0,tailoring_pending:0,tailoring_pay_mode:"N/A",tailoring_status:"N/A",article_type:"N/A",order_no:"N/A",delivery_date:"N/A",labour_amount:0,labour_paid:"N/A",tally_tailoring:false,embroidery_amount:0,embroidery_received:0,embroidery_pending:0,embroidery_pay_mode:"N/A",embroidery_status:"N/A",karigar:"N/A",emb_labour_amount:0,emb_labour_paid:"N/A",tally_embroidery:false,addon_amount:0,addon_received:0,addon_pending:0,addon_pay_mode:"N/A",addon_desc:"N/A",tally_addon:false };
    try { await updateItem(item.id, zero); setMessage({ type:"success", text:`Article ${item.barcode} cancelled` }); }
    catch { setMessage({ type:"error", text:"Failed to cancel article" }); }
    setTimeout(()=>setMessage(null),3000);
    invalidateItemsCache(); loadData();
  };

  const _sf = selectedSection ? SECTIONS[selectedSection] : null;
  const _isAdv = _sf?.isAdvanceSection;

  // ─── Render ───────────────────────────────────────────────
  return (
    <div data-testid="items-manager-page" className="flex absolute inset-0 top-12 md:top-0 overflow-hidden">

      {/* ── LEFT COLUMN ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

      {/* ── TOP BAR ── */}
      <div className="flex-shrink-0 bg-[var(--surface)] border-b border-[var(--border-subtle)]">
        {/* Row 1: controls left + tabs right */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2">
          {/* Left: sort */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => setSortDir(d => d==="desc"?"asc":"desc")}
              className="flex items-center gap-1.5 px-2 py-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] transition-colors text-xs"
              title="Toggle sort order">
              {sortDir==="desc" ? <CaretDown size={13}/> : <CaretRight size={13} className="-rotate-90"/>}
              <span className="hidden sm:inline">Order Date: {sortDir==="desc" ? "Newest" : "Oldest"}</span>
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1"/>

          {/* Right: tabs */}
          <div className="flex items-center gap-0.5 bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm p-0.5 overflow-x-auto no-scrollbar flex-shrink-0">
            {[{k:"unsettled",l:"Pending"},{k:"awaiting",l:"Awaiting"},{k:"settled",l:"Settled"},{k:"all",l:"All"}].map(t => (
              <button key={t.k} onClick={() => { setSettleTab(t.k); setSelectedRefs(new Set()); }}
                className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-all whitespace-nowrap flex-shrink-0 ${settleTab===t.k?"bg-[var(--brand)] text-white shadow-sm":"text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]"}`}>
                {t.l}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: search bar + filter toggle */}
        <div className="flex items-center gap-2 px-3 sm:px-4 pb-2">
          <div className="relative flex-1 min-w-0">
            <MagnifyingGlass size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none"/>
            <input ref={searchRef} type="text" value={nameFilter} onChange={e => setNameFilter(e.target.value)}
              placeholder="Search by name, barcode, ref, article type, karigar…"
              className="w-full pl-7 pr-6 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]"/>
            {nameFilter && <button onClick={() => setNameFilter("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><X size={11}/></button>}
          </div>
          <button onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-1.5 px-2 py-1.5 text-xs border rounded-sm transition-colors flex-shrink-0 ${(showFilters||hasAdvancedFilters)?"bg-[var(--brand)] text-white border-[var(--brand)]":"border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]"}`}>
            <Funnel size={13}/><span className="hidden sm:inline">Filters{hasAdvancedFilters ? " ·" : ""}</span>
          </button>
          {isSearchMode && <button onClick={clearSearch} className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--error)] border border-[var(--border-subtle)] rounded-sm flex-shrink-0" title="Clear search"><X size={13}/></button>}
          {message && (
            <div className={`text-xs px-2.5 py-1.5 rounded-sm border flex-shrink-0 ${message.type==="success"?"bg-[#455D4A10] border-[var(--success)] text-[var(--success)]":"bg-[#9E473D10] border-[var(--error)] text-[var(--error)]"}`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="px-3 sm:px-4 pb-3 border-t border-[var(--border-subtle)] pt-2.5 space-y-2.5">
            <div className="flex flex-wrap gap-1">
              {SEARCH_DATE_PRESETS.map(p => (
                <button key={p.label} onClick={() => { setSearchDateFrom(p.from); setSearchDateTo(p.to); }}
                  className={`px-2.5 py-1 text-[10px] font-medium rounded-sm border transition-colors ${
                    searchDateFrom === p.from && searchDateTo === p.to
                      ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
                  }`}>{p.label}</button>
              ))}
              {(searchDateFrom || searchDateTo) && (
                <button onClick={() => { setSearchDateFrom(""); setSearchDateTo(""); }}
                  className="px-2.5 py-1 text-[10px] rounded-sm border border-[var(--border-subtle)] text-[var(--error)] hover:bg-[#9E473D08]">Clear dates</button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Customer</label>
                <select value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)]">
                  <option value="All">All</option>
                  {customers.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Date From</label>
                <DatePickerInput value={searchDateFrom} onChange={setSearchDateFrom} placeholder="From date"/>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Date To</label>
                <DatePickerInput value={searchDateTo} onChange={setSearchDateTo} placeholder="To date"/>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Tailoring Status</label>
                <select value={searchStatus} onChange={e => setSearchStatus(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)]">
                  {["All","N/A","Awaiting Order","Pending","Stitched","Delivered"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Payment</label>
                <select value={searchPayment} onChange={e => setSearchPayment(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)]">
                  {["All","Pending","Settled"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Min Amount</label>
                <input type="number" value={searchMinAmt} onChange={e => setSearchMinAmt(e.target.value)} placeholder="₹0" className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)]"/>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Max Amount</label>
                <input type="number" value={searchMaxAmt} onChange={e => setSearchMaxAmt(e.target.value)} placeholder="₹99999" className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)]"/>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Order list */}
        <div className={`flex flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)] overflow-hidden flex-shrink-0
          ${detailOpen ? "hidden sm:flex sm:flex-1" : "flex w-full sm:flex-1"}` }>

          <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg)] flex items-center gap-3">
            <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] flex-shrink-0">
              {isSearchMode ? "Search results" : "Orders"} <span className="font-mono ml-1">{searchLoading ? "…" : refs.length}</span>
            </p>
            <div className="hidden sm:flex items-center gap-3 ml-2 pl-3 border-l border-[var(--border-subtle)]">
              <span className="text-[10px] text-[var(--text-secondary)]">Pending <span className="font-mono text-[var(--warning)] ml-1">₹{fmt(refs.reduce((s,g)=>s+Math.max(0,g.totals.pending),0))}</span></span>
              <span className="text-[10px] text-[var(--text-secondary)]">Value <span className="font-mono ml-1">₹{fmt(refs.reduce((s,g)=>s+g.totals.total,0))}</span></span>
            </div>
            <div className="flex-1"/>
            {selectedRefs.size > 0 && (
              <button onClick={() => setSelectedRefs(new Set())} className="text-[10px] text-[var(--brand)] hover:underline flex-shrink-0">{selectedRefs.size} selected · clear</button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && Array.from({length:5}).map((_,i)=>(
              <div key={i} className="h-16 border-b border-[var(--border-subtle)] animate-pulse bg-[var(--bg)]/50"/>
            ))}

            {!loading && refs.length === 0 && (
              <div className="py-14 px-4 text-center text-sm text-[var(--text-secondary)]">
                {isSearchMode
                  ? searchLoading ? "Searching…" : "No orders match your search"
                  : `No ${settleTab==="unsettled"?"pending":settleTab==="settled"?"settled":settleTab==="awaiting"?"awaiting tailoring":""} orders`}
              </div>
            )}

            {!loading && (() => {
              let lastDate = null;
              return refs.map(group => {
                const isCancelled = group.items.some(i => i.cancelled);
                const isSelected  = selectedRefs.has(group.ref);
                const orderNos    = [...new Set(group.items.map(i=>i.order_no).filter(o=>o&&o!=="N/A"))];
                const showDiv     = group.date !== lastDate;
                lastDate = group.date;

                return (
                  <React.Fragment key={group.ref}>
                    {showDiv && (
                      <div className="px-3 py-1.5 bg-[var(--bg)] border-b border-[var(--border-subtle)] sticky top-0 z-10">
                        <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[var(--text-secondary)]">{group.date || "—"}</p>
                      </div>
                    )}
                    <div
                      className={`border-b border-[var(--border-subtle)] cursor-pointer transition-colors group/row
                        ${isSelected ? "bg-[#C86B4D08] border-l-2 border-l-[var(--brand)]" : "hover:bg-[#C86B4D03] border-l-2 border-l-transparent"}`}
                      onClick={e => selectRef(group.ref, e.ctrlKey || e.metaKey || e.shiftKey)}
                    >
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        {/* Name — takes all available space */}
                        <p className={`text-xs font-medium truncate flex-1 min-w-0 ${isCancelled ? "line-through text-[var(--text-secondary)]" : ""}`}>
                          {group.name}
                        </p>
                        {/* Ref + order# */}
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="font-mono text-[10px] text-[var(--brand)]">{group.ref}</span>
                          {orderNos.length > 0 && <span className="font-mono text-[9px] text-[var(--text-secondary)] leading-tight">#{orderNos[0]}</span>}
                        </div>
                        {/* Actions — always visible */}
                        <div className="flex items-center gap-0 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setTailoringGroup(group)} className="p-1 text-[var(--info)] hover:bg-[#5C8A9E15] rounded-sm" title="Assign Tailoring"><Scissors size={11}/></button>
                          <button onClick={() => setAddonGroup(group)} className="p-1 text-[var(--brand)] hover:bg-[#C86B4D10] rounded-sm" title="Add Add-on"><Tag size={11}/></button>
                          <button onClick={() => setInvoiceRef(group.ref)} className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg)] rounded-sm" title="Invoice"><Printer size={11}/></button>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        </div>

      </div>{/* end BODY */}
      </div>{/* end LEFT COLUMN */}

      {/* Detail pane — full-height sibling column */}
      <div className={`flex-shrink-0 bg-[var(--surface)] overflow-hidden w-full sm:w-72 lg:w-[30vw] flex flex-col ${detailOpen ? "flex" : "hidden sm:flex"}`}>
        <OrderDetailPane
          selectedGroups={selectedGroups}
          advances={advances}
          onEdit={(section, items, mode) => startEdit(section, items, mode)}
          onPay={() => setSettlementOrders(selectedGroups.map(g => ({ ref: g.ref, name: g.name })))}
          onClose={() => setDetailOpen(false)}
          onCancelItem={(item) => handleCancelItem(item)}
          onDeleteItem={(item) => { setDelConfirm(item); setDelMode("item"); }}
        />
      </div>

      {/* Mobile: back to list */}
      {detailOpen && (
        <div className="sm:hidden fixed bottom-4 left-4 z-40">
          <button onClick={() => setDetailOpen(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--surface)] border border-[var(--border-strong)] rounded-full shadow-lg">
            <CaretRight size={14} className="rotate-180"/> Orders
          </button>
        </div>
      )}

      {/* ════ SECTION SELECTOR MODAL ════ */}
      {showSectionSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h2 className="font-heading text-xl font-medium">Select Section to Edit</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">{editMode==="order"?`${editItems.length} items`:"1 item"}</p>
              </div>
              <button onClick={() => { setShowSectionSelector(false); setEditItems([]); }} className="p-1.5 hover:bg-[var(--bg)] rounded-sm text-[var(--text-secondary)]"><X size={16}/></button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(SECTIONS).map(([key, section]) => (
                <button key={key} onClick={() => startEdit(key, editItems, editMode)}
                  className="p-4 border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] hover:bg-[#C86B4D08] text-left transition-colors group">
                  <h3 className="font-medium text-[var(--brand)] group-hover:text-[var(--brand-hover)]">{section.label}</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{section.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════ SECTION EDIT MODAL ════ */}
      {selectedSection && _sf && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm max-w-[96vw] w-full max-h-[92vh] flex flex-col shadow-xl">
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-heading text-lg font-medium">{_sf.label}</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{editMode==="order"?`${editItems.length} items`:"1 item"} · {_sf.description}</p>
              </div>
              <button onClick={cancelEdit} className="p-1.5 hover:bg-[var(--bg)] rounded-sm text-[var(--text-secondary)]"><X size={18}/></button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {_isAdv ? (
                <div className="overflow-x-auto">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">Advances for: <span className="font-mono font-medium">{editItems[0]?.ref}</span></span>
                    <button onClick={addNewAdvance} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--success)] text-white rounded-sm hover:opacity-90"><Plus size={12}/> Add Advance</button>
                  </div>
                  {Object.keys(advanceData).length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Existing</p>
                      <table className="w-full border border-[var(--border-subtle)] rounded-sm overflow-hidden text-xs">
                        <thead className="bg-[var(--bg)]"><tr>
                          {_sf.fields.map(f => <th key={f.key} className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">{f.label}</th>)}
                          <th className="px-3 py-2 w-14 border-b border-[var(--border-subtle)] text-center">Del</th>
                        </tr></thead>
                        <tbody>
                          {Object.entries(advanceData).map(([id, adv]) => (
                            <tr key={id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[#C86B4D04]">
                              {_sf.fields.map(f => <td key={f.key} className="px-2 py-2">{renderFieldInput(f, id, adv[f.key], handleAdvChange)}</td>)}
                              <td className="px-2 py-2 text-center"><button onClick={() => markAdvDelete(id)} className="p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm"><Trash size={13}/></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {newAdvances.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-[var(--success)] mb-2">New (to be created)</p>
                      <table className="w-full border border-[var(--border-subtle)] rounded-sm overflow-hidden text-xs">
                        <thead className="bg-[#455D4A08]"><tr>
                          {_sf.fields.map(f => <th key={f.key} className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">{f.label}</th>)}
                          <th className="px-3 py-2 w-14 border-b border-[var(--border-subtle)]"></th>
                        </tr></thead>
                        <tbody>
                          {newAdvances.map((adv, idx) => (
                            <tr key={adv.id} className="border-b border-[var(--border-subtle)] last:border-0 bg-[#455D4A05]">
                              {_sf.fields.map(f => <td key={f.key} className="px-2 py-2">{renderFieldInput(f, idx, adv[f.key], handleNewAdvChange)}</td>)}
                              <td className="px-2 py-2 text-center"><button onClick={() => removeNewAdvance(idx)} className="p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm"><X size={13}/></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {deletedAdvances.length > 0 && (
                    <div className="mb-3 p-2.5 bg-[#9E473D10] border border-[var(--error)] rounded-sm text-xs text-[var(--error)]">
                      {deletedAdvances.length} advance(s) marked for deletion
                    </div>
                  )}
                  {Object.keys(advanceData).length === 0 && newAdvances.length === 0 && (
                    <div className="p-6 text-center text-sm text-[var(--text-secondary)] border border-dashed border-[var(--border-strong)] rounded-sm">
                      No advances for this reference. Click "Add Advance" to create one.
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {_sf?.label === "Items" && editMode === "order" && (
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs text-[var(--text-secondary)]">Editing {editItems.length} items · <span className="font-mono font-medium">{editItems[0]?.ref}</span></span>
                      <button onClick={addNewItem} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--success)] text-white rounded-sm hover:opacity-90"><Plus size={12}/> Add Item</button>
                    </div>
                  )}
                  <table className="w-full border border-[var(--border-subtle)] rounded-sm overflow-hidden text-xs">
                    <thead className="bg-[var(--bg)] sticky top-0 z-10"><tr>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] w-16">#</th>
                      {_sf.fields.map(f => (
                        <th key={f.key} className="px-3 py-2 text-left font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] min-w-[90px]">
                          {f.label}{f.computed && <span className="ml-1 text-[var(--info)] font-normal normal-case">(auto)</span>}
                        </th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {editItems.map((item, idx) => (
                        <tr key={item.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[#C86B4D04]">
                          <td className="px-3 py-2 align-top">
                            <div className="font-mono text-[var(--brand)] font-medium">#{idx+1}</div>
                            <div className="text-[10px] text-[var(--text-secondary)] truncate max-w-[60px] mt-0.5">{item.barcode}</div>
                          </td>
                          {_sf.fields.map(f => (
                            <td key={f.key} className="px-2 py-2 align-top">
                              {renderFieldInput(f, item.id, editData[item.id]?.[f.key], handleFieldChange)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex justify-between items-center flex-shrink-0 bg-[var(--bg)]">
              <button onClick={() => setShowSectionSelector(true)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--surface)]">
                ← Change Section
              </button>
              <div className="flex gap-2">
                <button onClick={cancelEdit} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--surface)]">Cancel</button>
                <button onClick={saveEdits} disabled={saving} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50 flex items-center gap-2">
                  {saving ? "Saving…" : <><Check size={14}/> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ DELETE CONFIRM ════ */}
      {delConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDelConfirm(null)}>
          <div data-testid="delete-confirm-modal" className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-medium mb-2">Delete {delMode==="order"?"Order":"Item"}?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              {delMode==="order"
                ? <><span className="font-mono font-medium">{delConfirm.ref}</span> — {delConfirm.items?.length||0} items will be permanently deleted.</>
                : <>Item <span className="font-mono">{delConfirm.barcode}</span> will be permanently deleted.</>}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDelConfirm(null)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Cancel</button>
              <button data-testid="confirm-delete-btn" onClick={handleDelete} className="px-4 py-2 text-sm bg-[var(--error)] text-white rounded-sm hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ CANCEL CONFIRM ════ */}
      {cancelConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCancelConfirm(null)}>
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-medium mb-2 text-[var(--warning)]">Cancel Order?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              <span className="font-mono font-medium">{cancelConfirm.ref}</span> — {cancelConfirm.items?.length||0} items will be marked cancelled and all amounts zeroed.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCancelConfirm(null)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Back</button>
              <button onClick={() => handleCancelOrder(cancelConfirm)} className="px-4 py-2 text-sm bg-[var(--warning)] text-white rounded-sm hover:opacity-90">Cancel Order</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MISMATCH PROMPT ════ */}
      {mismatchPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm max-w-lg w-full max-h-[80vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-[var(--border-subtle)] bg-[#9E473D10] flex-shrink-0">
              <h3 className="font-heading text-lg font-medium text-[var(--error)]">⚠ Amount Mismatch</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Some amounts were reduced below what has already been received.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-xs">
                <thead className="bg-[var(--bg)] sticky top-0"><tr>
                  <th className="px-2 py-2 text-left text-[var(--text-secondary)]">Ref</th>
                  <th className="px-2 py-2 text-left text-[var(--text-secondary)]">Type</th>
                  <th className="px-2 py-2 text-right text-[var(--text-secondary)]">Old</th>
                  <th className="px-2 py-2 text-right text-[var(--text-secondary)]">New</th>
                  <th className="px-2 py-2 text-right text-[var(--text-secondary)]">Rcvd</th>
                  <th className="px-2 py-2 text-right text-[var(--error)]">Over</th>
                </tr></thead>
                <tbody>
                  {mismatchPrompt.mismatches.map((m, i) => (
                    <tr key={i} className="border-b border-[var(--border-subtle)]">
                      <td className="px-2 py-2 font-mono">{m.ref}</td>
                      <td className="px-2 py-2">{m.type}</td>
                      <td className="px-2 py-2 text-right font-mono">₹{fmt(m.oldAmount)}</td>
                      <td className="px-2 py-2 text-right font-mono">₹{fmt(m.newAmount)}</td>
                      <td className="px-2 py-2 text-right font-mono text-[var(--success)]">₹{fmt(m.received)}</td>
                      <td className="px-2 py-2 text-right font-mono text-[var(--error)] font-medium">₹{fmt(m.overage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-[var(--border-subtle)] flex justify-between items-center flex-shrink-0 bg-[var(--bg)]">
              <button onClick={() => setMismatchPrompt(null)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--surface)]">Fix later</button>
              <button onClick={() => { const orders=mismatchPrompt.refs.map(r=>{const g=refs.find(x=>x.ref===r);return{ref:r,name:g?.name||""};});setMismatchPrompt(null);setSettlementOrders(orders);}} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]">Settle Now →</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ RE-SETTLE PROMPT ════ */}
      {reSettlePrompt && !settlementOrders && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setReSettlePrompt(null)}>
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-medium mb-1 text-[var(--warning)]">Settled amounts changed</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">These sections were previously settled but amounts have been updated.</p>
            <div className="mb-5 space-y-1.5">
              {reSettlePrompt.sections.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-[var(--bg)] rounded-sm text-sm">
                  <span className="font-medium">{s.label}</span>
                  <span className="font-mono text-xs text-[var(--text-secondary)]">₹{fmt(s.oldAmt)} → <span className="text-[var(--brand)] font-medium">₹{fmt(s.newAmt)}</span></span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReSettlePrompt(null)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Skip for now</button>
              <button onClick={() => { setSettlementOrders([{ref:reSettlePrompt.ref,name:reSettlePrompt.customer}]); setReSettlePrompt(null); }} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]">Settle Now →</button>
            </div>
          </div>
        </div>
      )}

      {/* ════ INVOICE ════ */}
      {invoiceRef && <InvoiceModal billRef={invoiceRef} onClose={() => setInvoiceRef(null)}/>}

      {/* ════ SETTLEMENT ════ */}
      {settlementOrders && (
        <SettlementPanel
          orders={settlementOrders}
          onClose={() => setSettlementOrders(null)}
          onSuccess={() => { invalidateItemsCache(); invalidateAdvancesCache(); setSelectedRefs(new Set()); loadData(); }}
        />
      )}

      {/* ════ TAILORING OVERLAY ════ */}
      {tailoringGroup && (
        <TailoringOverlay
          group={tailoringGroup}
          onClose={() => setTailoringGroup(null)}
          onSuccess={() => { invalidateItemsCache(); loadData(); }}
        />
      )}

      {/* ════ ADD-ON OVERLAY ════ */}
      {addonGroup && (
        <AddOnOverlay
          group={addonGroup}
          onClose={() => setAddonGroup(null)}
          onSuccess={() => loadData()}
        />
      )}
    </div>
  );
}