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
  PencilSimple, Trash, X, Printer, CaretRight, Check, Plus,
  Scissors, Tag, Copy, ArrowsClockwise, Package, Info, Wallet, Receipt
} from "@phosphor-icons/react";
import { useToast } from "@/hooks/use-toast";
import InvoiceModal from "@/components/InvoiceModal";
import SettlementPanel from "@/components/SettlementPanel";
import OrderDetailPane from "@/components/OrderDetailPane";
import { TailoringOverlay, AddOnOverlay } from "@/components/OrderOverlays";
import { ItemsFilterBar } from "@/components/items";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

const FC = "w-full h-8 px-2 text-[11px] border border-border/50 rounded-md focus:ring-2 focus:ring-primary/20 focus:border-primary bg-muted/20 transition-all outline-none text-foreground font-medium";

const renderFieldInput = (field, itemId, value, onChange) => {
  switch (field.type) {
    case "date":
      return <DatePickerInput value={value || ""} onChange={(val) => onChange(itemId, field.key, val)} placeholder={field.label} />;
    case "number":
      return <input type="number" step={field.step || 1} value={value ?? 0}
        onChange={e => onChange(itemId, field.key, parseFloat(e.target.value) || 0)}
        disabled={field.computed}
        className={cn(FC, field.computed && "bg-muted text-muted-foreground cursor-not-allowed opacity-70")}/>;
    case "select":
      return <select value={value || ""} onChange={e => onChange(itemId, field.key, e.target.value)} className={FC}>
        {field.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>;
    case "checkbox":
      return <input type="checkbox" checked={!!value} onChange={e => onChange(itemId, field.key, e.target.checked)} className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary/20 accent-primary transition-all"/>;
    default:
      return <input type="text" value={value || ""} onChange={e => onChange(itemId, field.key, e.target.value)} className={FC}/>;
  }
};

const ITEM_DEFAULTS = {
  price:0, qty:0, discount:0,
  fabric_amount:0, fabric_received:0, fabric_pending:0, fabric_pay_mode:"N/A", fabric_pay_date:"", tally_fabric:false,
  tailoring_amount:0, tailoring_received:0, tailoring_pending:0, tailoring_pay_mode:"N/A", tailoring_pay_date:"",
  tailoring_status:"N/A", article_type:"N/A", order_no:"N/A", delivery_date:"N/A",
  labour_amount:0, labour_paid:"N/A", labour_pay_date:"", labour_payment_mode:"N/A", tally_tailoring:false,
  embroidery_amount:0, embroidery_received:0, embroidery_pending:0, embroidery_pay_mode:"N/A", embroidery_pay_date:"",
  embroidery_status:"N/A", karigar:"N/A", emb_labour_amount:0, emb_labour_paid:"N/A", emb_labour_date:"", emb_labour_payment_mode:"N/A", tally_embroidery:false,
  addon_amount:0, addon_received:0, addon_pending:0, addon_pay_mode:"N/A", addon_pay_date:"", addon_desc:"N/A", tally_addon:false,
};

const CANCEL_ZERO_PAYLOAD = { ...ITEM_DEFAULTS, cancelled: true };

const computeFabric = (price, qty, disc) =>
  Math.round((price - price * (disc || 0) / 100) * qty * 100) / 100;
const computePending = (total, received) => Math.round((total - (received || 0)) * 100) / 100;

// ─── Main page ────────────────────────────────────────────────
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

  const { toast } = useToast();
  const [articleTypeOptions, setArticleTypeOptions] = useState(SECTIONS.tailoring.fields.find(f => f.key === "article_type")?.options || []);

  // Settings
  useEffect(() => {
    getSettings().then(res => {
      const s = res?.data || {};
      setTailoringRates(s.tailoring_rates || {});
      if (Array.isArray(s.article_types) && s.article_types.length > 0) {
        setArticleTypeOptions(["N/A", ...s.article_types]);
      }
    }).catch((err) => {
      toast({ title: "Error", description: err.message || "Failed to load settings", variant: "destructive" });
    });
    getCustomers().then(res => setCustomers(res.data || [])).catch((err) => {
      toast({ title: "Error", description: err.message || "Failed to load customers", variant: "destructive" });
    });
  }, [toast]);

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

  // Full-search via /search API — fetches first 50 matching items
  const runSearch = useCallback(async () => {
    setSearchLoading(true);
    const params = { q: debouncedName || "", limit: 50, skip: 0 };
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
      const itemsRes = await getItems(params);
      const items = itemsRes.data.items || [];
      setAllItems(items);
      // Scope advances to the refs actually loaded — avoids full-table scan
      const uniqueRefs = [...new Set(items.map(i => i.ref).filter(Boolean))];
      const advRes = uniqueRefs.length > 0
        ? await getAdvances({ refs: uniqueRefs })
        : { data: [] };
      setAdvances(advRes.data || []);
    } catch {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

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

  // Pre-compute settled status per ref so the refs memo doesn't call isOrderSettled N×M times
  const settledMap = useMemo(() => {
    const m = {};
    Object.values(grouped).forEach(g => { m[g.ref] = isOrderSettled(g); });
    return m;
  }, [grouped]); // eslint-disable-line react-hooks/exhaustive-deps

  const refs = useMemo(() => {
    const source = isSearchMode
      ? Object.keys(searchGrouped).map(ref => grouped[ref] || searchGrouped[ref])
      : Object.values(grouped);
    const filtered = isSearchMode ? source.filter(Boolean) : source.filter(g => {
      if (settleTab === "unsettled") return !settledMap[g.ref];
      if (settleTab === "settled")   return settledMap[g.ref] && g.totals.total > 0;
      if (settleTab === "awaiting")  return g.items.some(i => i.tailoring_status === "Awaiting Order");
      return true;
    });
    return filtered.sort((a, b) => {
      const cmp = String(a.date || "").localeCompare(String(b.date || ""));
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [grouped, searchGrouped, settledMap, isSearchMode, settleTab, sortDir]);

  // Always look up full group from `grouped` so detail pane shows complete order data
  const selectedGroups = useMemo(
    () => Array.from(selectedRefs).map(ref => grouped[ref] || searchGrouped[ref]).filter(Boolean),
    [selectedRefs, grouped, searchGrouped]
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
    window.dispatchEvent(new CustomEvent("modal:open"));
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
    const ni = { id:tempId, ref, name, date, barcode:"", ...ITEM_DEFAULTS };
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
      toast({ title: fail===0?"Success":"Partial Success", description: fail===0?`Advances saved`:`${fail} operations failed`, variant: fail===0?"default":"destructive" });
      invalidateItemsCache(); invalidateAdvancesCache(); loadData();
      return;
    }
    // Items
    let ok=0, fail=0, allMM=[], affRefs=new Set(), reRef=null, reCust=null, reSecs=[];
    const existingIds = Object.keys(editData).filter(id => !newItemIds.includes(id));
    const existingResults = await Promise.allSettled(existingIds.map(async id => {
      const orig=originalData[id], cur=editData[id]; const ch={};
      Object.keys(cur).forEach(k=>{ if(JSON.stringify(cur[k])!==JSON.stringify(orig[k])) ch[k]=cur[k]; });
      const mm=detectMismatches(orig,cur); if(mm.length){allMM.push(...mm);affRefs.add(orig.ref);}
      const sc=detectSettledChanges(orig,cur); if(sc.length){reRef=orig.ref;reCust=orig.name;reSecs=[...reSecs,...sc];}
      if (Object.keys(ch).length) await updateItem(id, ch);
    }));
    existingResults.forEach(r => r.status === "fulfilled" ? ok++ : fail++);
    const newResults = await Promise.allSettled(newItemIds.map(id => editData[id] ? createItem(editData[id]) : Promise.resolve()));
    newResults.forEach(r => r.status === "fulfilled" ? ok++ : fail++);
    setSaving(false); setSelectedSection(null); setEditData({}); setOriginalData({}); setEditItems([]); setNewItemIds([]);
    if (fail === 0) {
      if (allMM.length) setMismatchPrompt({ refs: Array.from(affRefs), mismatches: allMM });
      else if (reRef) { setReSettlePrompt({ ref:reRef,customer:reCust,sections:reSecs }); toast({ title:"Success", description:`${ok} items saved` }); }
      else { toast({ title:"Success", description:`${ok} items saved` }); }
    } else { toast({ title:"Partial Success", description:`${fail} failed, ${ok} saved`, variant: "destructive" }); }
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
      toast({ title: "Deleted", description: delMode==="order"?`Order ${delConfirm.ref} deleted`:"Item deleted" });
    } catch { toast({ title: "Error", description: "Failed to delete", variant: "destructive" }); }
    setDelConfirm(null); invalidateItemsCache(); loadData();
  };

  const handleCancelOrder = async (group) => {
    const zero = { ...CANCEL_ZERO_PAYLOAD, cancelled: true, cancelled_at: new Date().toISOString(), cancelled_ref: group.ref };
    const results = await Promise.allSettled(group.items.map(item => updateItem(item.id, zero)));
    const ok = results.filter(r => r.status === "fulfilled").length;
    toast({ 
      title: ok===group.items.length?"Cancelled":"Partial Cancel", 
      description: ok===group.items.length?`Order ${group.ref} cancelled`:`${group.items.length-ok} items failed`,
      variant: ok===group.items.length?"default":"destructive"
    });
    setCancelConfirm(null); invalidateItemsCache(); loadData();
  };

  const handleCancelItem = async (item) => {
    const zero = { ...CANCEL_ZERO_PAYLOAD, cancelled: true, cancelled_at: new Date().toISOString(), cancelled_ref: item.ref };
    try { 
      await updateItem(item.id, zero); 
      toast({ title: "Article Cancelled", description: `Article ${item.barcode} cancelled` }); 
    } catch { 
      toast({ title: "Error", description: "Failed to cancel article", variant: "destructive" }); 
    }
    invalidateItemsCache(); loadData();
  };

  const _sf = selectedSection ? (
    selectedSection === "tailoring"
      ? { ...SECTIONS.tailoring, fields: SECTIONS.tailoring.fields.map(f => f.key === "article_type" ? { ...f, options: articleTypeOptions } : f) }
      : SECTIONS[selectedSection]
  ) : null;
  const _isAdv = _sf?.isAdvanceSection;

  // ─── Render ───────────────────────────────────────────────
  return (
    <div data-testid="items-manager-page" className="flex absolute inset-0 top-12 md:top-0 overflow-hidden bg-background">

      {/* ── LEFT COLUMN ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-border/50">

      {/* ── TOP BAR ── */}
      <ItemsFilterBar
        nameFilter={nameFilter} setNameFilter={setNameFilter}
        settleTab={settleTab} setSettleTab={setSettleTab} setSelectedRefs={setSelectedRefs}
        sortDir={sortDir} setSortDir={setSortDir}
        showFilters={showFilters} setShowFilters={setShowFilters} hasAdvancedFilters={hasAdvancedFilters}
        isSearchMode={isSearchMode} clearSearch={clearSearch}
        message={message}
        searchRef={searchRef}
        searchDateFrom={searchDateFrom} setSearchDateFrom={setSearchDateFrom}
        searchDateTo={searchDateTo} setSearchDateTo={setSearchDateTo}
        searchCustomer={searchCustomer} setSearchCustomer={setSearchCustomer}
        searchStatus={searchStatus} setSearchStatus={setSearchStatus}
        searchPayment={searchPayment} setSearchPayment={setSearchPayment}
        searchMinAmt={searchMinAmt} setSearchMinAmt={setSearchMinAmt}
        searchMaxAmt={searchMaxAmt} setSearchMaxAmt={setSearchMaxAmt}
        customers={customers}
      />

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-muted/10">

        {/* Order list */}
        <div className={cn(
          "flex flex-col bg-background overflow-hidden flex-shrink-0 transition-all duration-300",
          detailOpen ? "hidden sm:flex sm:flex-1" : "flex w-full sm:flex-1"
        )}>

          <div className="flex-shrink-0 px-4 py-3 border-b border-border/50 bg-background/50 backdrop-blur-sm flex items-center gap-4">
            <div className="flex items-center gap-2">
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">
                {isSearchMode ? "Search Results" : "Orders"}
              </p>
              <Badge variant="secondary" className="font-mono text-[10px] h-4.5 px-1.5 font-bold">
                {searchLoading ? "…" : refs.length}
              </Badge>
            </div>
            
            <div className="hidden lg:flex items-center gap-4 pl-4 border-l border-border/50">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/60 leading-none mb-1">Total Pending</span>
                <span className="font-mono text-[11px] font-black text-warning">₹{fmt(refs.reduce((s,g)=>s+Math.max(0,g.totals.pending),0))}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/60 leading-none mb-1">Total Value</span>
                <span className="font-mono text-[11px] font-black text-foreground">₹{fmt(refs.reduce((s,g)=>s+g.totals.total,0))}</span>
              </div>
            </div>

            <div className="flex-1"/>
            
            {selectedRefs.size > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedRefs(new Set())}
                className="h-7 text-[10px] font-bold text-primary hover:bg-primary/5 px-2"
              >
                {selectedRefs.size} selected · clear
              </Button>
            )}
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { invalidateItemsCache(); invalidateAdvancesCache(); loadData(); }}
                className={cn("h-8 w-8 text-muted-foreground hover:text-primary transition-all", loading && "animate-spin")}
                title="Refresh"
              >
                <ArrowsClockwise size={16} />
              </Button>
              {refs.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    const lines = refs.map(g => {
                      const orderNos = [...new Set(g.items.map(i=>i.order_no).filter(o=>o&&o!=="N/A"))];
                      return `${g.ref} — ${g.name}${orderNos.length ? ` (#${orderNos.join(", #")})` : ""} — ₹${fmt(g.totals.pending)} pending`;
                    });
                    const text = `Orders Summary (${new Date().toLocaleDateString("en-IN")})\n${"─".repeat(40)}\n${lines.join("\n")}`;
                    navigator.clipboard.writeText(text).then(() => toast({ title: "Copied", description: `${refs.length} orders copied to clipboard` }));
                  }}
                  className="h-8 w-8 text-muted-foreground hover:text-primary transition-all"
                  title="Copy summary"
                >
                  <Copy size={16} />
                </Button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading && (
              <div className="p-4 space-y-3">
                {Array.from({length:8}).map((_,i)=>(
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            )}

            {!loading && refs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-6">
                  <Package size={32} className="text-muted-foreground/30" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground/70 mb-2">
                  {isSearchMode ? (searchLoading ? "Searching..." : "No Matches Found") : "Empty Inventory"}
                </h3>
                <p className="text-[11px] text-muted-foreground/60 font-bold max-w-[240px] leading-relaxed mb-6">
                  {isSearchMode 
                    ? "Try adjusting your filters or search terms to find what you're looking for." 
                    : `No ${settleTab} orders are currently in the system.`}
                </p>
                {(isSearchMode || nameFilter) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSearch}
                    className="h-9 px-6 font-bold uppercase tracking-widest text-[10px] border-primary/20 text-primary hover:bg-primary/5"
                  >
                    Clear All Filters
                  </Button>
                )}
              </div>
            )}

            {!loading && (() => {
              let lastDate = null;
              return refs.map(group => {
                const isCancelled = group.items.every(i => i.cancelled);
                const isSelected  = selectedRefs.has(group.ref);
                const orderNos    = [...new Set(group.items.map(i=>i.order_no).filter(o=>o&&o!=="N/A"))];
                const showDiv     = group.date !== lastDate;
                lastDate = group.date;

                return (
                  <React.Fragment key={group.ref}>
                    {showDiv && (
                      <div className="px-5 py-2.5 bg-muted/30 border-b border-border/40 sticky top-0 z-10 backdrop-blur-md">
                        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground/70">{group.date || "—"}</p>
                      </div>
                    )}
                    <div
                      className={cn(
                        "group/row border-b border-border/40 cursor-pointer transition-all duration-200 relative",
                        isSelected 
                          ? "bg-primary/[0.03] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary shadow-sm" 
                          : "hover:bg-muted/30 border-l-4 border-l-transparent"
                      )}
                      onClick={e => selectRef(group.ref, e.ctrlKey || e.metaKey || e.shiftKey)}
                    >
                      <div className="flex items-center gap-4 px-5 py-4">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className={cn(
                            "text-xs font-bold uppercase tracking-wide truncate",
                            isCancelled ? "line-through text-muted-foreground/50" : "text-foreground group-hover/row:text-primary transition-colors"
                          )}>
                            {group.name}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[9px] h-4 px-1.5 font-bold text-primary border-primary/20 bg-primary/5">
                              {group.ref}
                            </Badge>
                            {orderNos.length > 0 && (
                              <span className="font-mono text-[9px] font-black text-muted-foreground/40 leading-none">
                                #{orderNos[0]}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={cn(
                            "font-mono text-[11px] font-black tracking-tighter",
                            group.totals.pending > 0 ? "text-warning" : group.totals.pending < 0 ? "text-destructive" : "text-success"
                          )}>
                            {group.totals.pending !== 0 ? `₹${fmt(group.totals.pending)}` : "SETTLED"}
                          </span>
                          <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                            ₹{fmt(group.totals.total)} TOTAL
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-all translate-x-2 group-hover/row:translate-x-0" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-info hover:bg-info/10" onClick={() => setTailoringGroup(group)} title="Tailoring"><Scissors size={14} weight="bold"/></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10" onClick={() => setAddonGroup(group)} title="Add-on"><Tag size={14} weight="bold"/></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted/50" onClick={() => setInvoiceRef(group.ref)} title="Invoice"><Printer size={14} weight="bold"/></Button>
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

      {/* Detail pane */}
      <div className={cn(
        "flex-shrink-0 bg-background overflow-hidden border-l border-border/50 transition-all duration-300",
        detailOpen ? "w-full sm:w-[50%] lg:w-[40%] xl:w-[35%]" : "w-0 sm:w-[50%] lg:w-[40%] xl:w-[35%]"
      )}>
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


      {/* ════ SECTION SELECTOR MODAL ════ */}
      {showSectionSelector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="max-w-2xl w-full shadow-2xl border-border/50 animate-in zoom-in-95 duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-border/50">
              <div className="space-y-1">
                <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">Select Section</CardTitle>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{editMode==="order"?`${editItems.length} items selected`:"Single item editing"}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setShowSectionSelector(false); setEditItems([]); }} className="h-8 w-8 rounded-full"><X size={18}/></Button>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(SECTIONS).map(([key, section]) => (
                <button key={key} onClick={() => startEdit(key, editItems, editMode)}
                  className="group relative p-5 border border-border/50 rounded-xl hover:border-primary/50 hover:bg-primary/[0.02] text-left transition-all hover:shadow-lg">
                  <div className="p-2 w-fit rounded-lg bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors mb-4">
                    {key === "items" && <Package size={20} weight="duotone" />}
                    {key === "tailoring" && <Scissors size={20} weight="duotone" />}
                    {key === "embroidery" && <Info size={20} weight="duotone" />}
                    {key === "addon" && <Tag size={20} weight="duotone" />}
                    {key === "advances" && <Wallet size={20} weight="duotone" />}
                  </div>
                  <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-foreground group-hover:text-primary transition-colors">{section.label}</h3>
                  <p className="text-[10px] text-muted-foreground font-bold mt-1.5 leading-relaxed opacity-60">{section.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════ SECTION EDIT MODAL ════ */}
      {selectedSection && _sf && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="max-w-[96vw] w-full max-h-[94vh] flex flex-col shadow-2xl border-border/50 animate-in zoom-in-95 duration-300 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">{_sf.label}</CardTitle>
                  <Badge variant="outline" className="text-[10px] h-5 px-2 font-bold uppercase tracking-widest bg-primary/5 text-primary border-primary/20">
                    {editMode==="order"?`${editItems.length} Articles`:"Single Article"}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.15em] opacity-60">{_sf.description}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-9 w-9 rounded-full"><X size={20}/></Button>
            </CardHeader>

            <div className="flex-1 overflow-auto p-6 bg-muted/5">
              {_isAdv ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between bg-background p-4 rounded-xl border border-border/50 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-info/10 text-info">
                        <Wallet size={18} weight="duotone" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Reference</span>
                        <span className="font-mono text-sm font-black text-primary">{editItems[0]?.ref}</span>
                      </div>
                    </div>
                    <Button onClick={addNewAdvance} className="h-9 gap-2 font-bold uppercase tracking-widest text-[10px] bg-success hover:bg-success/90">
                      <Plus size={14} weight="bold"/> Add Advance
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {Object.keys(advanceData).length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-2">Existing Advances</p>
                        <div className="overflow-hidden border border-border/50 rounded-xl bg-background shadow-sm">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/30"><tr>
                              {_sf.fields.map(f => <th key={f.key} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50">{f.label}</th>)}
                              <th className="px-4 py-3 w-14 border-b border-border/50"></th>
                            </tr></thead>
                            <tbody className="divide-y divide-border/50">
                              {Object.entries(advanceData).map(([id, adv]) => (
                                <tr key={id} className="hover:bg-muted/20 transition-colors">
                                  {_sf.fields.map(f => <td key={f.key} className="px-3 py-2.5">{renderFieldInput(f, id, adv[f.key], handleAdvChange)}</td>)}
                                  <td className="px-3 py-2.5 text-center">
                                    <Button variant="ghost" size="icon" onClick={() => markAdvDelete(id)} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash size={14}/></Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {newAdvances.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-success/70 px-2">New Entries</p>
                        <div className="overflow-hidden border border-success/30 rounded-xl bg-success/[0.02] shadow-sm">
                          <table className="w-full text-xs">
                            <tbody className="divide-y divide-success/20">
                              {newAdvances.map((adv, idx) => (
                                <tr key={adv.id} className="hover:bg-success/[0.05] transition-colors">
                                  {_sf.fields.map(f => <td key={f.key} className="px-3 py-2.5">{renderFieldInput(f, idx, adv[f.key], handleNewAdvChange)}</td>)}
                                  <td className="px-3 py-2.5 text-center">
                                    <Button variant="ghost" size="icon" onClick={() => removeNewAdvance(idx)} className="h-8 w-8 text-destructive hover:bg-destructive/10"><X size={14}/></Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {deletedAdvances.length > 0 && (
                      <Badge variant="destructive" className="w-full py-2.5 justify-center rounded-lg gap-2 font-bold uppercase tracking-widest text-[10px]">
                        <Info size={14} weight="bold"/> {deletedAdvances.length} advance(s) will be removed
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {_sf?.label === "Items" && editMode === "order" && (
                    <div className="flex items-center justify-between bg-background p-4 rounded-xl border border-border/50 shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Reference</span>
                        <span className="font-mono text-sm font-black text-primary">{editItems[0]?.ref}</span>
                      </div>
                      <Button onClick={addNewItem} className="h-9 gap-2 font-bold uppercase tracking-widest text-[10px] bg-success hover:bg-success/90">
                        <Plus size={14} weight="bold"/> Add New Article
                      </Button>
                    </div>
                  )}

                  <div className="overflow-hidden border border-border/50 rounded-xl bg-background shadow-xl">
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-xs min-w-[800px]">
                        <thead className="bg-muted/50 sticky top-0 z-20"><tr>
                          <th className="px-4 py-3.5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 w-20">Article</th>
                          {_sf.fields.map(f => (
                            <th key={f.key} className="px-4 py-3.5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border/50 min-w-[120px]">
                              <div className="flex items-center gap-1.5">
                                {f.label}
                                {f.computed && <Info size={12} className="text-info opacity-70" />}
                              </div>
                            </th>
                          ))}
                        </tr></thead>
                        <tbody className="divide-y divide-border/50">
                          {editItems.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3 align-top bg-muted/5">
                                <div className="flex flex-col gap-1">
                                  <span className="font-mono text-[11px] font-black text-primary">#{idx+1}</span>
                                  <span className="text-[9px] font-black text-muted-foreground opacity-60 uppercase tracking-tighter truncate max-w-[60px]">{item.barcode}</span>
                                </div>
                              </td>
                              {_sf.fields.map(f => (
                                <td key={f.key} className="px-3 py-3 align-top">
                                  {renderFieldInput(f, item.id, editData[item.id]?.[f.key], handleFieldChange)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <CardContent className="px-6 py-4 border-t border-border/50 flex justify-between items-center bg-background/80 backdrop-blur-md">
              <Button variant="outline" onClick={() => setShowSectionSelector(true)} className="h-10 gap-2 font-black uppercase tracking-widest text-[10px]">
                <CaretRight size={14} className="rotate-180" /> Change Section
              </Button>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={cancelEdit} className="h-10 font-black uppercase tracking-widest text-[10px]">Cancel</Button>
                <Button onClick={saveEdits} disabled={saving} className="h-10 px-8 gap-2 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                  {saving ? (
                    <>Saving Changes <ArrowsClockwise size={14} className="animate-spin" /></>
                  ) : (
                    <><Check size={16} weight="bold"/> Commit Updates</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════ DELETE CONFIRM ════ */}
      {delConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="max-w-sm w-full shadow-2xl border-destructive/20 animate-in zoom-in-95 duration-300">
            <CardHeader className="text-center pb-2">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
                <Trash size={24} weight="bold" />
              </div>
              <CardTitle className="text-lg font-black uppercase tracking-widest text-destructive">Delete Confirmation</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-xs text-muted-foreground font-bold leading-relaxed px-4">
                {delMode==="order"
                  ? <>Order <span className="font-mono font-black text-foreground">{delConfirm.ref}</span> and all its {delConfirm.items?.length||0} articles will be permanently removed.</>
                  : <>Article <span className="font-mono font-black text-foreground">{delConfirm.barcode}</span> will be permanently deleted from the system.</>}
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button variant="destructive" onClick={handleDelete} className="w-full font-black uppercase tracking-widest text-[10px] h-11">Confirm Deletion</Button>
                <Button variant="ghost" onClick={() => setDelConfirm(null)} className="w-full font-black uppercase tracking-widest text-[10px] h-11">Keep It</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════ CANCEL CONFIRM ════ */}
      {cancelConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="max-w-sm w-full shadow-2xl border-warning/20 animate-in zoom-in-95 duration-300">
            <CardHeader className="text-center pb-2">
              <div className="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto mb-4">
                <X size={24} weight="bold" />
              </div>
              <CardTitle className="text-lg font-black uppercase tracking-widest text-warning">Cancel Order?</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-xs text-muted-foreground font-bold leading-relaxed px-4">
                Order <span className="font-mono font-black text-foreground">{cancelConfirm.ref}</span> will be marked as cancelled. All amounts will be zeroed out.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={() => handleCancelOrder(cancelConfirm)} className="w-full bg-warning hover:bg-warning/90 font-black uppercase tracking-widest text-[10px] h-11">Yes, Cancel Order</Button>
                <Button variant="ghost" onClick={() => setCancelConfirm(null)} className="w-full font-black uppercase tracking-widest text-[10px] h-11">No, Go Back</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ════ MISMATCH PROMPT ════ */}
      {mismatchPrompt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="max-w-lg w-full shadow-2xl border-destructive/30 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-5 bg-destructive/10 flex items-center gap-4 border-b border-destructive/20">
              <div className="w-10 h-10 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center flex-shrink-0">
                <Info size={20} weight="bold" />
              </div>
              <div>
                <h3 className="font-black uppercase tracking-[0.2em] text-destructive text-sm">Amount Mismatch Detected</h3>
                <p className="text-[10px] font-bold text-destructive/70 uppercase tracking-widest mt-0.5">Amounts reduced below received values</p>
              </div>
            </div>
            <div className="p-0 max-h-[50vh] overflow-y-auto custom-scrollbar">
              <table className="w-full text-[11px]">
                <thead className="bg-muted/50 sticky top-0"><tr>
                  <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-muted-foreground/60">Ref</th>
                  <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-muted-foreground/60">Type</th>
                  <th className="px-4 py-3 text-right font-black uppercase tracking-widest text-muted-foreground/60">New</th>
                  <th className="px-4 py-3 text-right font-black uppercase tracking-widest text-muted-foreground/60">Rcvd</th>
                  <th className="px-4 py-3 text-right font-black uppercase tracking-widest text-destructive">Overage</th>
                </tr></thead>
                <tbody className="divide-y divide-border/50">
                  {mismatchPrompt.mismatches.map((m, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-mono font-black text-primary">{m.ref}</td>
                      <td className="px-4 py-3 font-bold uppercase text-muted-foreground">{m.type}</td>
                      <td className="px-4 py-3 text-right font-mono font-black">₹{fmt(m.newAmount)}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-success">₹{fmt(m.received)}</td>
                      <td className="px-4 py-3 text-right font-mono font-black text-destructive">₹{fmt(m.overage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-muted/30 border-t border-border/50 flex justify-between items-center">
              <Button variant="ghost" onClick={() => setMismatchPrompt(null)} className="font-black uppercase tracking-widest text-[10px]">Fix Later</Button>
              <Button onClick={() => { 
                const orders = mismatchPrompt.refs.map(r => {
                  const g = refs.find(x => x.ref === r);
                  return { ref: r, name: g?.name || "" };
                });
                setMismatchPrompt(null);
                setSettlementOrders(orders);
              }} className="gap-2 font-black uppercase tracking-widest text-[10px] px-6">
                Settle Imbalance <CaretRight size={14} weight="bold" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ════ RE-SETTLE PROMPT ════ */}
      {reSettlePrompt && !settlementOrders && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="max-w-md w-full shadow-2xl border-warning/30 animate-in zoom-in-95 duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-black uppercase tracking-[0.2em] text-warning">Settlement Required</CardTitle>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Amounts changed for previously settled articles</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {reSettlePrompt.sections.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                    <span className="text-[10px] font-black uppercase tracking-widest">{s.label}</span>
                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-muted-foreground/50 line-through">₹{fmt(s.oldAmt)}</span>
                      <span className="text-primary font-black">₹{fmt(s.newAmt)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" onClick={() => setReSettlePrompt(null)} className="flex-1 font-black uppercase tracking-widest text-[10px]">Ignore</Button>
                <Button onClick={() => { 
                  setSettlementOrders([{ref:reSettlePrompt.ref, name:reSettlePrompt.customer}]); 
                  setReSettlePrompt(null); 
                }} className="flex-1 font-black uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-primary/20">
                  Update Settlement <CaretRight size={14} weight="bold" />
                </Button>
              </div>
            </CardContent>
          </Card>
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
