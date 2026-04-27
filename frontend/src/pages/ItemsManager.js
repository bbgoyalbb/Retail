import { useState, useEffect, useCallback, useRef } from "react";
import { getItems, getItem, getAdvances, updateItem, deleteItem, createItem, updateAdvance, createAdvance, deleteAdvance, invalidateItemsCache, exportExcelUrl, getSettings } from "@/api";
import { fmt } from "@/lib/fmt";
import { PencilSimple, Trash, X, Printer, CaretDown, CaretRight, Check, Plus, CheckCircle, Funnel, DownloadSimple } from "@phosphor-icons/react";
import InvoiceModal from "@/components/InvoiceModal";
import SettlementPanel from "@/components/SettlementPanel";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

// ==========================================
// SECTION CONFIGURATION
// ==========================================
const SECTIONS = {
  items: {
    label: "Items",
    description: "Basic item details and fabric payment",
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
    ]
  },
  tailoring: {
    label: "Tailoring",
    description: "Tailoring order and labour details",
    fields: [
      { key: "order_no", label: "Order No", type: "text" },
      { key: "article_type", label: "Article Type", type: "select", options: ["N/A", "Shirt", "Pant", "Gurkha Pant", "Kurta", "Pajama", "Blazer", "Safari Shirt", "Indo", "Sherwani", "Jacket", "W Coat"] },
      { key: "delivery_date", label: "Delivery Date", type: "date" },
      { key: "tailoring_status", label: "Tailoring Status", type: "select", options: ["N/A", "Awaiting Order", "Pending", "Stitched", "Delivered"] },
      { key: "tailoring_amount", label: "Tailoring Amount", type: "number" },
      { key: "tailoring_received", label: "Tailoring Received", type: "number" },
      { key: "tailoring_pending", label: "Tailoring Pending", type: "number", computed: true },
      { key: "tailoring_pay_date", label: "Tailoring Pay Date", type: "date" },
      { key: "tailoring_pay_mode", label: "Tailoring Pay Mode", type: "text" },
      { key: "labour_amount", label: "Labour Amount", type: "number" },
      { key: "labour_paid", label: "Labour Paid", type: "select", options: ["N/A", "Yes"] },
      { key: "labour_pay_date", label: "Labour Pay Date", type: "date" },
      { key: "labour_payment_mode", label: "Labour Payment Mode", type: "select", options: ["N/A", "Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"] },
      { key: "tally_tailoring", label: "Tally Tailoring", type: "checkbox" },
    ]
  },
  embroidery: {
    label: "Embroidery",
    description: "Embroidery and karigar details",
    fields: [
      { key: "embroidery_status", label: "Embroidery Status", type: "select", options: ["N/A", "Not Required", "Required", "In Progress", "Finished"] },
      { key: "karigar", label: "Karigar", type: "text" },
      { key: "embroidery_amount", label: "Embroidery Amount", type: "number" },
      { key: "embroidery_received", label: "Embroidery Received", type: "number" },
      { key: "embroidery_pending", label: "Embroidery Pending", type: "number", computed: true },
      { key: "embroidery_pay_date", label: "Embroidery Pay Date", type: "date" },
      { key: "embroidery_pay_mode", label: "Embroidery Pay Mode", type: "text" },
      { key: "emb_labour_amount", label: "Emb. Labour Amount", type: "number" },
      { key: "emb_labour_paid", label: "Emb. Labour Paid", type: "select", options: ["N/A", "Yes"] },
      { key: "emb_labour_date", label: "Emb. Labour Date", type: "date" },
      { key: "emb_labour_payment_mode", label: "Emb. Labour Payment Mode", type: "select", options: ["N/A", "Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"] },
      { key: "tally_embroidery", label: "Tally Embroidery", type: "checkbox" },
    ]
  },
  addon: {
    label: "Add-on",
    description: "Add-on details",
    fields: [
      { key: "addon_desc", label: "Add-on Description", type: "text" },
      { key: "addon_amount", label: "Add-on Amount", type: "number" },
      { key: "addon_received", label: "Add-on Received", type: "number" },
      { key: "addon_pending", label: "Add-on Pending", type: "number", computed: true },
      { key: "addon_pay_date", label: "Add-on Pay Date", type: "date" },
      { key: "addon_pay_mode", label: "Add-on Pay Mode", type: "text" },
      { key: "tally_addon", label: "Tally Add-on", type: "checkbox" },
    ]
  },
  advances: {
    label: "Advances",
    description: "Advance payments for this reference",
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "name", label: "Customer Name", type: "text" },
      { key: "ref", label: "Reference", type: "text" },
      { key: "amount", label: "Amount", type: "number" },
      { key: "mode", label: "Payment Mode", type: "text" },
      { key: "tally", label: "Tally", type: "checkbox" },
    ],
    isAdvanceSection: true
  }
};

// ==========================================
// GRID LAYOUT — single source of truth
// Columns: caret | date | ref | order# | customer | fab | tail | emb | add-on | adv | items | total | rcvd | pending | actions
// ==========================================
const GRID_COLS = "20px 84px 96px 90px 1fr 74px 60px 60px 60px 52px 36px 80px 72px 88px 112px";

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
const computeFabricAmount = (price, qty, discount) => {
  const discountedPrice = price - (price * (discount || 0) / 100);
  return Math.round(discountedPrice * qty);
};

const computePending = (total, received) => Math.round(total - (received || 0));


const FIELD_CLASSES = "w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:border-[var(--brand)] focus:outline-none bg-[var(--surface)] text-[var(--text-primary)]";

const renderFieldInput = (field, itemId, value, onChange) => {
  switch (field.type) {
    case "date":
      return <input type="date" value={value || ""} onChange={e => onChange(itemId, field.key, e.target.value)} className={FIELD_CLASSES} />;
    case "number":
      return (
        <input
          type="number"
          step={field.step || 1}
          value={value ?? 0}
          onChange={e => onChange(itemId, field.key, parseFloat(e.target.value) || 0)}
          disabled={field.computed}
          className={`${FIELD_CLASSES} ${field.computed ? "bg-[var(--bg)] text-[var(--text-secondary)] cursor-not-allowed" : ""}`}
        />
      );
    case "select":
      return (
        <select value={value || ""} onChange={e => onChange(itemId, field.key, e.target.value)} className={FIELD_CLASSES}>
          {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    case "checkbox":
      return <input type="checkbox" checked={!!value} onChange={e => onChange(itemId, field.key, e.target.checked)} className="w-4 h-4 accent-[var(--brand)]" />;
    default:
      return <input type="text" value={value || ""} onChange={e => onChange(itemId, field.key, e.target.value)} className={FIELD_CLASSES} />;
  }
};

export default function ItemsManager() {
  const customerFilterRef = useRef(null);
  const [allItems, setAllItems] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [nameFilter, setNameFilter] = useState("");
  const [debouncedNameFilter, setDebouncedNameFilter] = useState("");
  const [orderFilter, setOrderFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [expanded, setExpanded] = useState({});
  const [message, setMessage] = useState(null);
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(false);

  // Column visibility state (persisted to localStorage)
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem("itemsmanager_columns");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      barcode: true, price: true, qty: true, discount: true, fabric_amount: true,
      article_type: true, order_no: true, delivery_date: true, tailoring_amount: true,
      embroidery_amount: true, addon_desc: true,
    };
  });

  // Edit modal states
  const [showSectionSelector, setShowSectionSelector] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [editMode, setEditMode] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [editData, setEditData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [newItemIds, setNewItemIds] = useState([]);
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Advances editing state
  const [advanceData, setAdvanceData] = useState({});
  const [originalAdvanceData, setOriginalAdvanceData] = useState({});
  const [refAdvances, setRefAdvances] = useState([]);
  const [newAdvances, setNewAdvances] = useState([]);
  const [deletedAdvances, setDeletedAdvances] = useState([]);

  // Tailoring rates from settings (for auto-recalc on article_type change)
  const [tailoringRates, setTailoringRates] = useState({});
  useEffect(() => {
    getSettings().then(res => {
      const rates = res?.data?.tailoring_rates || {};
      setTailoringRates(rates);
    }).catch(() => {});
  }, []);

  // Delete confirmation
  const [delConfirm, setDelConfirm] = useState(null);
  const [delMode, setDelMode] = useState(null);
  const [invoiceRef, setInvoiceRef] = useState(null);
  const [mismatchPrompt, setMismatchPrompt] = useState(null);
  const [reSettlePrompt, setReSettlePrompt] = useState(null);  // { ref, customer, sections[] }
  const [showSettlementPanel, setShowSettlementPanel] = useState(false);

  // Debounce name filter — fire API only 400ms after user stops typing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedNameFilter(nameFilter), 400);
    return () => clearTimeout(t);
  }, [nameFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 500, summary: true };
      if (debouncedNameFilter) params.name     = debouncedNameFilter;
      if (dateFilter)          params.date     = dateFilter;
      if (orderFilter)         params.order_no = orderFilter;
      const [itemsRes, advancesRes] = await Promise.all([
        getItems(params),
        getAdvances()
      ]);
      setAllItems(itemsRes.data.items || []);
      setAdvances(advancesRes.data || []);
    } catch {
      setMessage({ type: "error", text: "Failed to load data. Please try again." });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setLoading(false);
    }
  }, [debouncedNameFilter, dateFilter, orderFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Ctrl+F focuses customer filter
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (customerFilterRef.current) { e.preventDefault(); customerFilterRef.current.focus(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("itemsmanager_columns", JSON.stringify(visibleColumns)); } catch {}
  }, [visibleColumns]);

  const toggleColumn = (colKey) => setVisibleColumns(prev => ({ ...prev, [colKey]: !prev[colKey] }));

  // ==========================================
  // EDIT HANDLERS
  // ==========================================
  const startEdit = async (sectionKey, items, mode = "item") => {
    setSelectedSection(sectionKey);
    setEditMode(mode);
    const itemList = Array.isArray(items) ? items : [items];
    setEditItems(itemList);

    // Fetch full item data for each item — the grid loads with summary=true which
    // omits many fields (pay dates, labour fields, tally flags). Without full data,
    // those fields show blank in the edit modal even though the DB has values.
    const fullItems = await Promise.all(
      itemList.map(item => getItem(item.id).then(r => r.data).catch(() => item))
    );

    const initialData = {};
    const origData = {};
    fullItems.forEach(item => {
      initialData[item.id] = { ...item };
      origData[item.id] = { ...item };
    });
    setEditItems(fullItems);
    setEditData(initialData);
    setOriginalData(origData);

    if (sectionKey === "advances" && itemList.length > 0) {
      const ref = itemList[0].ref;
      try {
        const res = await getAdvances({ ref });
        const advList = res.data || [];
        setRefAdvances(advList);
        const advInitial = {};
        const advOrig = {};
        advList.forEach(adv => {
          advInitial[adv.id] = { ...adv };
          advOrig[adv.id] = { ...adv };
        });
        setAdvanceData(advInitial);
        setOriginalAdvanceData(advOrig);
        setNewAdvances([]);
        setDeletedAdvances([]);
      } catch {
        setRefAdvances([]);
      }
    }
    setShowSectionSelector(false);
  };

  const handleAdvanceChange = (advanceId, fieldKey, value) => {
    setAdvanceData(prev => ({ ...prev, [advanceId]: { ...prev[advanceId], [fieldKey]: value } }));
  };

  const handleNewAdvanceChange = (index, fieldKey, value) => {
    setNewAdvances(prev => { const u = [...prev]; u[index] = { ...u[index], [fieldKey]: value }; return u; });
  };

  const addNewAdvance = () => {
    const ref = editItems[0]?.ref || "";
    const name = editItems[0]?.name || "";
    setNewAdvances(prev => [...prev, {
      id: `new_${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      name, ref, amount: 0, mode: "Cash", tally: false
    }]);
  };

  const removeNewAdvance = (index) => setNewAdvances(prev => prev.filter((_, i) => i !== index));

  const markAdvanceForDelete = (advanceId) => {
    setDeletedAdvances(prev => [...prev, advanceId]);
    setAdvanceData(prev => { const u = { ...prev }; delete u[advanceId]; return u; });
  };

  const handleFieldChange = (itemId, fieldKey, value) => {
    setEditData(prev => {
      const updated = { ...prev, [itemId]: { ...prev[itemId], [fieldKey]: value } };
      const item = updated[itemId];

      // ── Fabric ────────────────────────────────────────────────────────────
      // price / qty / discount → recalculate fabric_amount
      if (["price", "qty", "discount"].includes(fieldKey)) {
        updated[itemId].fabric_amount = computeFabricAmount(
          parseFloat(item.price) || 0, parseFloat(item.qty) || 0, parseFloat(item.discount) || 0
        );
      }
      // fabric_amount or fabric_received → recalculate fabric_pending
      if (["fabric_received", "fabric_amount", "price", "qty", "discount"].includes(fieldKey)) {
        updated[itemId].fabric_pending = computePending(
          parseFloat(updated[itemId].fabric_amount) || 0, parseFloat(updated[itemId].fabric_received) || 0
        );
      }

      // ── Tailoring ─────────────────────────────────────────────────────────
      // article_type → look up rate, set tailoring_amount + labour_amount, then fall through to pending recalc
      if (fieldKey === "article_type") {
        const rateData = tailoringRates[value];
        if (rateData) {
          updated[itemId].tailoring_amount = parseFloat(rateData.tailoring) || 0;
          updated[itemId].labour_amount    = parseFloat(rateData.labour)    || 0;
        }
      }
      // tailoring_amount or tailoring_received (or article_type cascade above) → recalculate tailoring_pending
      if (["tailoring_amount", "tailoring_received", "article_type"].includes(fieldKey)) {
        updated[itemId].tailoring_pending = computePending(
          parseFloat(updated[itemId].tailoring_amount) || 0, parseFloat(updated[itemId].tailoring_received) || 0
        );
      }

      // ── Embroidery ────────────────────────────────────────────────────────
      // embroidery_amount or embroidery_received → recalculate embroidery_pending
      if (["embroidery_amount", "embroidery_received"].includes(fieldKey)) {
        updated[itemId].embroidery_pending = computePending(
          parseFloat(updated[itemId].embroidery_amount) || 0, parseFloat(updated[itemId].embroidery_received) || 0
        );
      }
      // emb_labour_amount or emb_labour_paid changes — no pending field, but
      // default emb_labour_date to today when emb_labour_paid flips to "Yes"
      if (fieldKey === "emb_labour_paid" && value === "Yes" && !updated[itemId].emb_labour_date) {
        updated[itemId].emb_labour_date = new Date().toISOString().split("T")[0];
      }

      // ── Add-on ────────────────────────────────────────────────────────────
      // addon_amount or addon_received → recalculate addon_pending
      if (["addon_amount", "addon_received"].includes(fieldKey)) {
        updated[itemId].addon_pending = computePending(
          parseFloat(updated[itemId].addon_amount) || 0, parseFloat(updated[itemId].addon_received) || 0
        );
      }

      // ── Labour (tailoring) ────────────────────────────────────────────────
      // default labour_pay_date to today when labour_paid flips to "Yes"
      if (fieldKey === "labour_paid" && value === "Yes" && !updated[itemId].labour_pay_date) {
        updated[itemId].labour_pay_date = new Date().toISOString().split("T")[0];
      }

      return updated;
    });
  };

  // Detect sections that were already Settled but whose _amount has now changed
  const detectSettledAmountChanges = (original, current) => {
    const changed = [];
    const check = (amountKey, modeKey, label) => {
      const mode = String(original[modeKey] || "");
      if (!mode.startsWith("Settled")) return;
      const oldAmt = parseFloat(original[amountKey]) || 0;
      const newAmt = parseFloat(current[amountKey]) || 0;
      if (Math.abs(oldAmt - newAmt) > 0.01) changed.push({ label, oldAmt, newAmt });
    };
    check("fabric_amount",     "fabric_pay_mode",     "Fabric");
    check("tailoring_amount",  "tailoring_pay_mode",  "Tailoring");
    check("embroidery_amount", "embroidery_pay_mode",  "Embroidery");
    check("addon_amount",      "addon_pay_mode",       "Add-on");
    return changed;
  };

  const detectMismatches = (itemId, original, current) => {
    const mismatches = [];
    const checkMismatch = (amountKey, receivedKey, modeKey, label) => {
      const originalAmount = parseFloat(original[amountKey]) || 0;
      const newAmount = parseFloat(current[amountKey]) || 0;
      const received = parseFloat(original[receivedKey]) || 0;
      const mode = String(current[modeKey] || original[modeKey] || "");
      if (mode.startsWith("Settled")) return;
      if (newAmount < originalAmount && newAmount < received) {
        mismatches.push({ itemId, ref: original.ref, type: label, oldAmount: originalAmount, newAmount, received, overage: received - newAmount });
      }
    };
    checkMismatch("fabric_amount", "fabric_received", "fabric_pay_mode", "Fabric");
    checkMismatch("tailoring_amount", "tailoring_received", "tailoring_pay_mode", "Tailoring");
    checkMismatch("embroidery_amount", "embroidery_received", "embroidery_pay_mode", "Embroidery");
    checkMismatch("addon_amount", "addon_received", "addon_pay_mode", "Add-on");
    return mismatches;
  };

  const saveEdits = async () => {
    setSaving(true);
    const isAdvanceSection = selectedSection === "advances";

    if (isAdvanceSection) {
      let advSuccess = 0, advFailed = 0;
      for (const advanceId of deletedAdvances) {
        try { await deleteAdvance(advanceId); advSuccess++; } catch { advFailed++; }
      }
      for (const [advanceId, data] of Object.entries(advanceData)) {
        try {
          const original = originalAdvanceData[advanceId];
          const changedFields = {};
          Object.keys(data).forEach(key => {
            if (JSON.stringify(data[key]) !== JSON.stringify(original[key])) changedFields[key] = data[key];
          });
          if (Object.keys(changedFields).length > 0) { await updateAdvance(advanceId, changedFields); advSuccess++; }
        } catch { advFailed++; }
      }
      for (const newAdv of newAdvances) {
        try { const { id, ...data } = newAdv; await createAdvance(data); advSuccess++; } catch { advFailed++; }
      }
      setSaving(false);
      setSelectedSection(null);
      setAdvanceData({}); setOriginalAdvanceData({}); setNewAdvances([]); setDeletedAdvances([]); setRefAdvances([]); setEditItems([]);
      setMessage({ type: advFailed === 0 ? "success" : "error", text: advFailed === 0 ? "Advances saved successfully" : `${advFailed} operation(s) failed, ${advSuccess} succeeded` });
      setTimeout(() => setMessage(null), 3000);
      invalidateItemsCache();
      loadData();
      return;
    }

    const itemIds = Object.keys(editData);
    let success = 0, failed = 0;
    const allMismatches = [];
    const affectedRefs = new Set();
    let reSettleRef = null;
    let reSettleCustomer = null;
    let reSettleSections = [];

    for (const itemId of itemIds) {
      if (newItemIds.includes(itemId)) continue;
      try {
        const original = originalData[itemId];
        const current = editData[itemId];
        const changedFields = {};
        Object.keys(current).forEach(key => {
          if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) changedFields[key] = current[key];
        });
        const mismatches = detectMismatches(itemId, original, current);
        if (mismatches.length > 0) { allMismatches.push(...mismatches); affectedRefs.add(original.ref); }
        // Detect settled sections whose amounts changed — prompt re-settle after save
        const settledChanges = detectSettledAmountChanges(original, current);
        if (settledChanges.length > 0) {
          reSettleRef = original.ref;
          reSettleCustomer = original.name;
          reSettleSections = [...reSettleSections, ...settledChanges];
        }
        if (Object.keys(changedFields).length > 0) { await updateItem(itemId, changedFields); success++; }
      } catch { failed++; }
    }

    for (const itemId of newItemIds) {
      try { const itemData = editData[itemId]; if (itemData) { await createItem(itemData); success++; } }
      catch (err) { console.error("Failed to create item:", err); failed++; }
    }

    setSaving(false);
    setSelectedSection(null); setEditData({}); setOriginalData({}); setEditItems([]); setNewItemIds([]);

    if (failed === 0) {
      if (allMismatches.length > 0) {
        setMismatchPrompt({ refs: Array.from(affectedRefs), mismatches: allMismatches });
      } else if (reSettleRef) {
        // Show re-settle prompt — amounts on already-settled sections have changed
        setReSettlePrompt({ ref: reSettleRef, customer: reSettleCustomer, sections: reSettleSections });
        setMessage({ type: "success", text: `${success} item(s) saved` });
        setTimeout(() => setMessage(null), 2000);
      } else {
        setMessage({ type: "success", text: `${success} item(s) saved successfully` });
        setTimeout(() => setMessage(null), 3000);
      }
    } else {
      setMessage({ type: "error", text: `${failed} operation(s) failed, ${success} succeeded` });
      setTimeout(() => setMessage(null), 3000);
    }
    invalidateItemsCache();
    loadData();
  };

  const cancelEdit = () => {
    setSelectedSection(null); setEditData({}); setOriginalData({}); setEditItems([]); setNewItemIds([]); setShowSectionSelector(false);
    setAdvanceData({}); setOriginalAdvanceData({}); setNewAdvances([]); setDeletedAdvances([]);
  };

  const addNewItem = () => {
    const tempId = `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ref = editItems[0]?.ref || "";
    const name = editItems[0]?.name || "";
    const date = editItems[0]?.date || new Date().toISOString().split("T")[0];
    const newItem = {
      id: tempId, ref, name, date, barcode: "", price: 0, qty: 0, discount: 0,
      fabric_amount: 0, fabric_received: 0, fabric_pending: 0, fabric_pay_date: "", fabric_pay_mode: "N/A",
      tailoring_status: "N/A", article_type: "N/A", order_no: "N/A", delivery_date: "N/A",
      tailoring_amount: 0, tailoring_received: 0, tailoring_pending: 0, tailoring_pay_date: "", tailoring_pay_mode: "N/A",
      embroidery_status: "N/A", karigar: "N/A", embroidery_amount: 0, embroidery_received: 0, embroidery_pending: 0,
      embroidery_pay_date: "", embroidery_pay_mode: "N/A", addon_desc: "N/A", addon_amount: 0,
      addon_received: 0, addon_pending: 0, addon_pay_date: "", addon_pay_mode: "N/A",
      labour_amount: 0, labour_paid: "N/A", labour_pay_date: "", labour_payment_mode: "N/A",
      emb_labour_amount: 0, emb_labour_paid: "N/A", emb_labour_date: "", emb_labour_payment_mode: "N/A",
      tally_fabric: false, tally_tailoring: false, tally_embroidery: false, tally_addon: false,
    };
    setEditItems(prev => [...prev, newItem]);
    setEditData(prev => ({ ...prev, [tempId]: { ...newItem } }));
    setOriginalData(prev => ({ ...prev, [tempId]: { ...newItem } }));
    setNewItemIds(prev => [...prev, tempId]);
  };

  const handleDelete = async () => {
    if (!delConfirm) return;
    try {
      if (delMode === "order") {
        for (const id of delConfirm.items.map(i => i.id)) await deleteItem(id);
        setMessage({ type: "success", text: `Order ${delConfirm.ref} deleted (${delConfirm.items.length} items)` });
      } else {
        await deleteItem(delConfirm.id);
        setMessage({ type: "success", text: "Item deleted" });
      }
      setDelConfirm(null);
      invalidateItemsCache();
      loadData();
    } catch {
      setMessage({ type: "error", text: "Failed to delete" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCancelOrder = async (group) => {
    const zeroFields = {
      cancelled: true,
      cancelled_at: new Date().toISOString(),
      cancelled_ref: group.ref,
      price: 0, qty: 0, discount: 0,
      // Fabric
      fabric_amount: 0, fabric_received: 0, fabric_pending: 0, fabric_pay_mode: "N/A", tally_fabric: false,
      // Tailoring
      tailoring_amount: 0, tailoring_received: 0, tailoring_pending: 0, tailoring_pay_mode: "N/A",
      tailoring_status: "N/A", article_type: "N/A", order_no: "N/A", delivery_date: "N/A",
      labour_amount: 0, labour_paid: "N/A", tally_tailoring: false,
      // Embroidery
      embroidery_amount: 0, embroidery_received: 0, embroidery_pending: 0, embroidery_pay_mode: "N/A",
      embroidery_status: "N/A", karigar: "N/A",
      emb_labour_amount: 0, emb_labour_paid: "N/A", tally_embroidery: false,
      // Add-on
      addon_amount: 0, addon_received: 0, addon_pending: 0, addon_pay_mode: "N/A",
      addon_desc: "N/A", tally_addon: false,
    };
    let success = 0;
    for (const item of group.items) {
      try {
        await updateItem(item.id, zeroFields);
        success++;
      } catch {}
    }
    setMessage({ type: success === group.items.length ? "success" : "error", text: success === group.items.length ? `Order ${group.ref} cancelled — all amounts zeroed out` : `${group.items.length - success} items failed to cancel` });
    setTimeout(() => setMessage(null), 3000);
    setCancelConfirm(null);
    invalidateItemsCache();
    loadData();
  };

  // ==========================================
  // FILTERING & GROUPING
  // ==========================================
  const uniqueDates = [...new Set(allItems.map(i => i.date).filter(Boolean))].sort().reverse();
  const filteredCustomers = [...new Set(allItems.map(i => i.name).filter(Boolean))].sort();
  const filteredItems = allItems;

  const grouped = {};
  filteredItems.forEach(item => {
    const ref = item.ref;
    if (!grouped[ref]) grouped[ref] = {
      ref, name: item.name, date: item.date, items: [],
      totals: { fabric: 0, tailoring: 0, embroidery: 0, addon: 0, advance: 0, total: 0, received: 0, pending: 0 }
    };
    grouped[ref].items.push(item);
    grouped[ref].totals.fabric += item.fabric_amount || 0;
    grouped[ref].totals.tailoring += item.tailoring_amount || 0;
    grouped[ref].totals.embroidery += item.embroidery_amount || 0;
    grouped[ref].totals.addon += item.addon_amount || 0;
    grouped[ref].totals.total += (item.fabric_amount || 0) + (item.tailoring_amount || 0) + (item.embroidery_amount || 0) + (item.addon_amount || 0);
    grouped[ref].totals.received += (item.fabric_received || 0) + (item.tailoring_received || 0) + (item.embroidery_received || 0) + (item.addon_received || 0);
    if (!String(item.fabric_pay_mode || "").startsWith("Settled"))     grouped[ref].totals.pending += (item.fabric_pending || 0);
    if (!String(item.tailoring_pay_mode || "").startsWith("Settled"))  grouped[ref].totals.pending += (item.tailoring_pending || 0);
    if (!String(item.embroidery_pay_mode || "").startsWith("Settled")) grouped[ref].totals.pending += (item.embroidery_pending || 0);
    if (!String(item.addon_pay_mode || "").startsWith("Settled"))      grouped[ref].totals.pending += (item.addon_pending || 0);
  });
  advances.forEach(adv => {
    if (grouped[adv.ref]) grouped[adv.ref].totals.advance += adv.amount || 0;
  });

  const refs = Object.values(grouped).sort((a, b) => {
    let va = a[sortKey] ?? "";
    let vb = b[sortKey] ?? "";
    const dateRx = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRx.test(String(va)) && dateRx.test(String(vb))) {
      const cmp = String(va).localeCompare(String(vb));
      return sortDir === "desc" ? -cmp : cmp;
    }
    if (typeof va === "number" && typeof vb === "number") {
      return sortDir === "desc" ? vb - va : va - vb;
    }
    const cmp = String(va).localeCompare(String(vb));
    return sortDir === "desc" ? -cmp : cmp;
  });

  const orderNos = [...new Set(filteredItems.map(i => i.order_no).filter(o => o && o !== "N/A"))].sort();
  const toggleExpand = (ref) => setExpanded(prev => ({ ...prev, [ref]: !prev[ref] }));
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const _sectionForEdit = selectedSection ? SECTIONS[selectedSection] : null;
  const _isAdvanceEdit = _sectionForEdit?.isAdvanceSection;

  // Sort indicator helper
  const sortIndicator = (key) => sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div data-testid="items-manager-page" className="space-y-5">
      {/* Page Header */}
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Manage Orders</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">View, edit and manage all orders grouped by reference</p>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`p-3 border rounded-sm text-sm ${message.type === "success" ? "bg-[#455D4A10] border-[var(--success)] text-[var(--success)]" : "bg-[#9E473D10] border-[var(--error)] text-[var(--error)]"}`}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-3 rounded-sm flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Date</label>
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-2.5 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]">
            <option value="">All Dates</option>
            {uniqueDates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Customer</label>
          <select ref={customerFilterRef} data-testid="orders-customer-filter" value={nameFilter} onChange={e => setNameFilter(e.target.value)} className="px-2.5 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]">
            <option value="">All Customers</option>
            {filteredCustomers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Order No</label>
          <select data-testid="orders-order-filter" value={orderFilter} onChange={e => setOrderFilter(e.target.value)} className="px-2.5 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]">
            <option value="">All Order Nos</option>
            {orderNos.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <span className="ml-auto text-xs text-[var(--text-secondary)]">{refs.length} refs · {filteredItems.length} items</span>

        <a href={exportExcelUrl()} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors">
          <DownloadSimple size={13} /> Export
        </a>

        {/* Column Visibility Toggle */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] hover:text-[var(--brand)] transition-colors">
              <Funnel size={13} /> Columns
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-3 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm shadow-lg z-50">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)] mb-2">Show / Hide Columns</h4>
            <div className="space-y-1">
              {[
                { key: "barcode", label: "Barcode" },
                { key: "price", label: "Price" },
                { key: "qty", label: "Qty" },
                { key: "discount", label: "Discount %" },
                { key: "fabric_amount", label: "Fabric Amt" },
                { key: "article_type", label: "Article Type" },
                { key: "order_no", label: "Order #" },
                { key: "delivery_date", label: "Delivery Date" },
                { key: "tailoring_amount", label: "Tailoring Amt" },
                { key: "embroidery_amount", label: "Emb. Amt" },
                { key: "addon_desc", label: "Add-on" },
              ].map(col => (
                <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--bg)] px-1 py-0.5 rounded-sm">
                  <input type="checkbox" checked={visibleColumns[col.key]} onChange={() => toggleColumn(col.key)} className="w-3.5 h-3.5 accent-[var(--brand)]" />
                  <span className="text-xs text-[var(--text-primary)]">{col.label}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* ==========================================
          SECTION SELECTOR MODAL
      ========================================== */}
      {showSectionSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b border-[var(--border-subtle)]">
              <h2 className="font-heading text-xl font-medium">Select Section to Edit</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {editMode === "order" ? `Editing order with ${editItems.length} items` : "Editing single item"}
              </p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(SECTIONS).map(([key, section]) => (
                <button key={key} onClick={() => startEdit(key, editItems, editMode)} className="p-4 border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] hover:bg-[#C86B4D08] text-left transition-colors group">
                  <h3 className="font-medium text-[var(--brand)] group-hover:text-[var(--brand-hover)]">{section.label}</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{section.description}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-2 font-mono">{section.fields.length} fields</p>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-[var(--border-subtle)] flex justify-end">
              <button onClick={() => { setShowSectionSelector(false); setEditItems([]); }} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          SECTION EDIT MODAL
      ========================================== */}
      {selectedSection && _sectionForEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm max-w-[96vw] w-full max-h-[92vh] flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-heading text-lg font-medium">{_sectionForEdit.label}</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {editMode === "order" ? `${editItems.length} items` : "1 item"} · {_sectionForEdit.description}
                </p>
              </div>
              <button onClick={cancelEdit} className="p-1.5 hover:bg-[var(--bg)] rounded-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"><X size={18} /></button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4">
              {_isAdvanceEdit ? (
                <div className="overflow-x-auto">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">
                      Advances for: <span className="font-mono font-medium text-[var(--text-primary)]">{editItems[0]?.ref}</span>
                    </span>
                    <button onClick={addNewAdvance} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--success)] text-white rounded-sm hover:opacity-90 transition-opacity">
                      <Plus size={12} /> Add Advance
                    </button>
                  </div>
                  {Object.keys(advanceData).length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Existing Advances</p>
                      <table className="w-full border border-[var(--border-subtle)] rounded-sm overflow-hidden">
                        <thead className="bg-[var(--bg)]">
                          <tr>
                            {_sectionForEdit.fields.map(f => (
                              <th key={f.key} className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">{f.label}</th>
                            ))}
                            <th className="px-3 py-2 text-center text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] w-14">Del</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(advanceData).map(([advId, adv]) => (
                            <tr key={advId} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[#C86B4D04]">
                              {_sectionForEdit.fields.map(f => (
                                <td key={f.key} className="px-2 py-2">{renderFieldInput(f, advId, adv[f.key], handleAdvanceChange)}</td>
                              ))}
                              <td className="px-2 py-2 text-center">
                                <button onClick={() => markAdvanceForDelete(advId)} className="p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm"><Trash size={13} /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {newAdvances.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-[var(--success)] mb-2">New Advances (to be created)</p>
                      <table className="w-full border border-[var(--border-subtle)] rounded-sm overflow-hidden">
                        <thead className="bg-[#455D4A08]">
                          <tr>
                            {_sectionForEdit.fields.map(f => (
                              <th key={f.key} className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">{f.label}</th>
                            ))}
                            <th className="px-3 py-2 w-14 border-b border-[var(--border-subtle)]"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {newAdvances.map((adv, idx) => (
                            <tr key={adv.id} className="border-b border-[var(--border-subtle)] last:border-0 bg-[#455D4A05]">
                              {_sectionForEdit.fields.map(f => (
                                <td key={f.key} className="px-2 py-2">
                                  {renderFieldInput(f, idx, adv[f.key], (i, k, v) => handleNewAdvanceChange(i, k, v))}
                                </td>
                              ))}
                              <td className="px-2 py-2 text-center">
                                <button onClick={() => removeNewAdvance(idx)} className="p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm"><X size={13} /></button>
                              </td>
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
                  {_sectionForEdit?.label === "Items" && editMode === "order" && (
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs text-[var(--text-secondary)]">
                        Editing {editItems.length} items for: <span className="font-mono font-medium text-[var(--text-primary)]">{editItems[0]?.ref}</span>
                      </span>
                      <button onClick={addNewItem} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--success)] text-white rounded-sm hover:opacity-90 transition-opacity">
                        <Plus size={12} /> Add Item
                      </button>
                    </div>
                  )}
                  <table className="w-full border border-[var(--border-subtle)] rounded-sm overflow-hidden">
                    <thead className="bg-[var(--bg)] sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] w-16">#</th>
                        {_sectionForEdit.fields.map(f => (
                          <th key={f.key} className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] min-w-[100px]">
                            {f.label}{f.computed && <span className="ml-1 text-[var(--info)] normal-case">(auto)</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, idx) => (
                        <tr key={item.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[#C86B4D04]">
                          <td className="px-3 py-2 align-top">
                            <div className="text-xs font-mono text-[var(--brand)] font-medium">#{idx + 1}</div>
                            <div className="text-[10px] text-[var(--text-secondary)] truncate max-w-[60px] mt-0.5">{item.barcode}</div>
                          </td>
                          {_sectionForEdit.fields.map(f => (
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

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex justify-between items-center flex-shrink-0 bg-[var(--bg)]">
              <button onClick={() => setShowSectionSelector(true)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--surface)] transition-colors">
                ← Change Section
              </button>
              <div className="flex gap-2">
                <button onClick={cancelEdit} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--surface)] transition-colors">Cancel</button>
                <button onClick={saveEdits} disabled={saving} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50 flex items-center gap-2 transition-colors">
                  {saving ? "Saving…" : <><Check size={14} /> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {delConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDelConfirm(null)}>
          <div data-testid="delete-confirm-modal" className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-medium mb-2">Delete {delMode === "order" ? "Order" : "Item"}?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              {delMode === "order"
                ? <><span className="font-mono font-medium text-[var(--text-primary)]">{delConfirm.ref}</span> — {delConfirm.items?.length || 0} items will be permanently deleted.</>
                : <>Item <span className="font-mono">{delConfirm.barcode}</span> will be permanently deleted.</>}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDelConfirm(null)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Cancel</button>
              <button data-testid="confirm-delete-btn" onClick={handleDelete} className="px-4 py-2 text-sm bg-[var(--error)] text-white rounded-sm hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCancelConfirm(null)}>
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-medium mb-2 text-[var(--warning)]">Cancel Order?</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              <span className="font-mono font-medium text-[var(--text-primary)]">{cancelConfirm.ref}</span> — {cancelConfirm.items?.length || 0} items will be marked cancelled and <strong>all amounts zeroed to ₹0</strong>. The record stays visible in ItemsManager with a CANCELLED badge but will not affect any pending balances, reports, or settlements.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCancelConfirm(null)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Back</button>
              <button onClick={() => handleCancelOrder(cancelConfirm)} className="px-4 py-2 text-sm bg-[var(--warning)] text-white rounded-sm hover:opacity-90">Cancel Order</button>
            </div>
          </div>
        </div>
      )}

      {/* Amount Mismatch Modal */}
      {mismatchPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm max-w-lg w-full max-h-[80vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-[var(--border-subtle)] bg-[#9E473D10] flex-shrink-0">
              <h3 className="font-heading text-lg font-medium text-[var(--error)]">⚠ Amount Mismatch</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">Some amounts were reduced below what has already been received.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-xs">
                <thead className="bg-[var(--bg)] sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-[var(--text-secondary)]">Ref</th>
                    <th className="px-2 py-2 text-left text-[var(--text-secondary)]">Type</th>
                    <th className="px-2 py-2 text-right text-[var(--text-secondary)]">Old</th>
                    <th className="px-2 py-2 text-right text-[var(--text-secondary)]">New</th>
                    <th className="px-2 py-2 text-right text-[var(--text-secondary)]">Rcvd</th>
                    <th className="px-2 py-2 text-right text-[var(--error)]">Over</th>
                  </tr>
                </thead>
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
              <span className="text-xs text-[var(--text-secondary)]">{mismatchPrompt.refs.length} order(s) affected</span>
              <div className="flex gap-2">
                <button onClick={() => setMismatchPrompt(null)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--surface)]">Fix later</button>
                <button onClick={() => { setMismatchPrompt(null); window.location.href = `/settlements?refs=${encodeURIComponent(mismatchPrompt.refs.join(","))}`; }} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]">
                  Go to Settlement →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Re-Settle Prompt Modal */}
      {reSettlePrompt && !showSettlementPanel && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setReSettlePrompt(null)}>
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-medium mb-1 text-[var(--warning)]">Settled amounts have changed</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              The following sections were previously settled but their amounts have been updated. Would you like to re-settle now?
            </p>
            <div className="mb-5 space-y-1.5">
              {reSettlePrompt.sections.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-[var(--bg)] rounded-sm text-sm">
                  <span className="font-medium text-[var(--text-primary)]">{s.label}</span>
                  <span className="font-mono text-xs text-[var(--text-secondary)]">
                    ₹{fmt(s.oldAmt)} → <span className="text-[var(--brand)] font-medium">₹{fmt(s.newAmt)}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setReSettlePrompt(null)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Skip for now</button>
              <button onClick={() => setShowSettlementPanel(true)} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] flex items-center gap-2">
                Settle Now →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Settlement Panel (opens after re-settle prompt) */}
      {reSettlePrompt && showSettlementPanel && (
        <SettlementPanel
          billRef={reSettlePrompt.ref}
          customer={reSettlePrompt.customer}
          onClose={() => { setShowSettlementPanel(false); setReSettlePrompt(null); loadData(); }}
        />
      )}

      {/* ==========================================
          MAIN TABLE
      ========================================== */}
      <div className="space-y-1.5">

        {/* Desktop Header — uses GRID_COLS */}
        <div
          className="hidden sm:grid bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm px-3 py-2 items-center text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]"
          style={{ gridTemplateColumns: GRID_COLS }}
        >
          <span />
          <button onClick={() => handleSort("date")}   className="text-left hover:text-[var(--brand)] transition-colors">Date{sortIndicator("date")}</button>
          <button onClick={() => handleSort("ref")}    className="text-left hover:text-[var(--brand)] transition-colors">Ref{sortIndicator("ref")}</button>
          <button onClick={() => handleSort("order_no")} className="text-left hover:text-[var(--brand)] transition-colors truncate">Order#{sortIndicator("order_no")}</button>
          <button onClick={() => handleSort("name")}   className="text-left hover:text-[var(--brand)] transition-colors">Customer{sortIndicator("name")}</button>
          <span className="text-right">Fabric</span>
          <span className="text-right">Tail.</span>
          <span className="text-right">Emb.</span>
          <span className="text-right">Add-on</span>
          <span className="text-right">Adv.</span>
          <span className="text-center">Qty</span>
          <span className="text-right">Total</span>
          <span className="text-right">Rcvd</span>
          <span className="text-right">Pending</span>
          <span />
        </div>

        {/* Loading skeletons */}
        {loading && (
          <>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-11 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm animate-pulse" />
            ))}
          </>
        )}

        {/* Empty state */}
        {!loading && refs.length === 0 && (
          <div className="py-16 text-center text-sm text-[var(--text-secondary)] border border-dashed border-[var(--border-strong)] rounded-sm">
            No orders found. Adjust the filters above.
          </div>
        )}

        {/* Reference rows */}
        {!loading && refs.map(group => {
          const isCancelled = group.items.some(i => i.cancelled);
          const isSettled = Math.round(group.totals.pending) === 0 && group.totals.total > 0;
          const hasTailoringOrder = group.items.some(i => i.order_no && i.order_no !== "N/A");
          const tailoringOrderNo = hasTailoringOrder
            ? group.items.find(i => i.order_no && i.order_no !== "N/A")?.order_no
            : "-";

          return (
            <div key={group.ref} className={`bg-[var(--surface)] border rounded-sm overflow-hidden transition-colors ${isCancelled ? "border-[var(--border-strong)] opacity-75" : "border-[var(--border-subtle)]"}`}>

              {/* Collapsed row — clickable */}
              <div
                className="cursor-pointer hover:bg-[#C86B4D04] transition-colors"
                onClick={() => toggleExpand(group.ref)}
              >
                {/* ---- MOBILE LAYOUT ---- */}
                <div className="flex sm:hidden items-start gap-2 px-3 py-3">
                  <span className="mt-0.5 text-[var(--text-secondary)] flex-shrink-0">
                    {expanded[group.ref] ? <CaretDown size={14} /> : <CaretRight size={14} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-mono text-xs text-[var(--brand)] font-medium ${isCancelled ? "line-through" : ""}`}>{group.ref}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">{group.date}</span>
                      {isCancelled && <span className="text-[10px] px-1.5 py-0.5 bg-[var(--error)]/10 text-[var(--error)] rounded-sm font-medium">CANCELLED</span>}
                    </div>
                    <div className={`text-sm font-medium truncate mt-0.5 ${isCancelled ? "line-through" : ""}`}>{group.name}</div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                      {group.totals.fabric > 0    && <span className="text-[10px] text-[var(--text-secondary)]">Fab: <span className="font-mono text-[var(--text-primary)]">{fmt(group.totals.fabric)}</span></span>}
                      {group.totals.tailoring > 0 && <span className="text-[10px] text-[var(--text-secondary)]">Tail: <span className="font-mono text-[var(--text-primary)]">{fmt(group.totals.tailoring)}</span></span>}
                      {group.totals.embroidery > 0 && <span className="text-[10px] text-[var(--text-secondary)]">Emb: <span className="font-mono text-[var(--text-primary)]">{fmt(group.totals.embroidery)}</span></span>}
                      {group.totals.addon > 0     && <span className="text-[10px] text-[var(--text-secondary)]">Add-on: <span className="font-mono text-[var(--text-primary)]">{fmt(group.totals.addon)}</span></span>}
                      <span className="text-[10px] text-[var(--text-secondary)]">{group.items.length} items</span>
                    </div>
                    <div className="flex gap-3 mt-1 pt-1 border-t border-[var(--border-subtle)]">
                      <span className="text-[10px] text-[var(--text-secondary)]">Total: <span className="font-mono font-medium text-[var(--text-primary)]">₹{fmt(group.totals.total)}</span></span>
                      <span className="text-[10px] text-[var(--text-secondary)]">Rcvd: <span className="font-mono text-[var(--success)]">₹{fmt(group.totals.received)}</span></span>
                      {isSettled
                        ? <span className="text-[10px] text-[var(--success)] flex items-center gap-0.5"><CheckCircle size={11} weight="fill" />Settled</span>
                        : <span className="text-[10px] text-[var(--text-secondary)]">Pend: <span className={`font-mono ${group.totals.pending < 0 ? "text-[var(--error)]" : "text-[var(--warning)]"}`}>₹{fmt(group.totals.pending)}</span></span>
                      }
                    </div>
                  </div>
                  {/* Mobile action buttons */}
                  <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditItems(group.items); setEditMode("order"); setShowSectionSelector(true); }} className="p-1.5 text-[var(--info)] hover:bg-[#5C8A9E10] rounded-sm" title="Edit"><PencilSimple size={14} /></button>
                    <button onClick={() => setCancelConfirm(group)} className="p-1.5 text-[var(--warning)] hover:bg-[#D4984210] rounded-sm" title="Cancel Order"><X size={14} /></button>
                    <button onClick={() => { setDelConfirm(group); setDelMode("order"); }} className="p-1.5 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm" title="Delete"><Trash size={14} /></button>
                    <button onClick={e => { e.stopPropagation(); setInvoiceRef(group.ref); }} className="p-1.5 text-[var(--brand)] hover:bg-[#C86B4D10] rounded-sm" title="Invoice"><Printer size={14} /></button>
                  </div>
                </div>

                {/* ---- DESKTOP LAYOUT — uses same GRID_COLS as header ---- */}
                <div
                  className="hidden sm:grid items-center px-3 py-2.5"
                  style={{ gridTemplateColumns: GRID_COLS }}
                >
                  {/* Caret */}
                  <span className="text-[var(--text-secondary)] flex-shrink-0">
                    {expanded[group.ref] ? <CaretDown size={13} /> : <CaretRight size={13} />}
                  </span>

                  {/* Date */}
                  <span className={`font-mono text-xs ${isCancelled ? "line-through text-[var(--text-secondary)]" : ""}`}>{group.date}</span>

                  {/* Ref */}
                  <span className={`font-mono text-xs text-[var(--brand)] font-medium ${isCancelled ? "line-through" : ""}`}>{group.ref}</span>

                  {/* Order# */}
                  <span className={`font-mono text-xs truncate ${isCancelled ? "line-through text-[var(--text-secondary)]" : ""}`}>{tailoringOrderNo}</span>

                  {/* Customer */}
                  <span className={`text-sm font-medium truncate pr-2 ${isCancelled ? "line-through text-[var(--text-secondary)]" : ""}`}>
                    {group.name}
                    {isCancelled && <span className="ml-2 text-[10px] font-normal text-[var(--error)] not-italic no-underline">[CANCELLED]</span>}
                  </span>

                  {/* Fabric */}
                  <span className="font-mono text-xs text-right">{group.totals.fabric > 0 ? fmt(group.totals.fabric) : <span className="text-[var(--border-strong)]">—</span>}</span>

                  {/* Tailoring */}
                  <span className="font-mono text-xs text-right">{group.totals.tailoring > 0 ? fmt(group.totals.tailoring) : <span className="text-[var(--border-strong)]">—</span>}</span>

                  {/* Embroidery */}
                  <span className="font-mono text-xs text-right">{group.totals.embroidery > 0 ? fmt(group.totals.embroidery) : <span className="text-[var(--border-strong)]">—</span>}</span>

                  {/* Add-on */}
                  <span className="font-mono text-xs text-right">{group.totals.addon > 0 ? fmt(group.totals.addon) : <span className="text-[var(--border-strong)]">—</span>}</span>

                  {/* Advance */}
                  <span className="font-mono text-xs text-right">{group.totals.advance > 0 ? fmt(group.totals.advance) : <span className="text-[var(--border-strong)]">—</span>}</span>

                  {/* Item count */}
                  <span className="font-mono text-xs text-center">{group.items.length}</span>

                  {/* Total */}
                  <span className="font-mono text-xs text-right font-medium">{fmt(group.totals.total)}</span>

                  {/* Received */}
                  <span className="font-mono text-xs text-right text-[var(--success)]">{fmt(group.totals.received)}</span>

                  {/* Pending */}
                  <span className={`font-mono text-xs text-right flex items-center justify-end gap-1 ${isSettled ? "text-[var(--success)]" : group.totals.pending < 0 ? "text-[var(--error)]" : "text-[var(--warning)]"}`}>
                    {isSettled
                      ? <><CheckCircle size={12} weight="fill" className="flex-shrink-0" /><span>Settled</span></>
                      : fmt(group.totals.pending)
                    }
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 justify-end" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditItems(group.items); setEditMode("order"); setShowSectionSelector(true); }} className="p-1.5 text-[var(--info)] hover:bg-[#5C8A9E10] rounded-sm transition-colors" title="Edit Order"><PencilSimple size={13} /></button>
                    <button onClick={() => setCancelConfirm(group)} className="p-1.5 text-[var(--warning)] hover:bg-[#D4984210] rounded-sm transition-colors" title="Cancel Order"><X size={13} /></button>
                    <button onClick={() => { setDelConfirm(group); setDelMode("order"); }} className="p-1.5 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm transition-colors" title="Delete Order"><Trash size={13} /></button>
                    <button onClick={e => { e.stopPropagation(); setInvoiceRef(group.ref); }} className="p-1.5 text-[var(--brand)] hover:bg-[#C86B4D10] rounded-sm transition-colors" title="Invoice"><Printer size={13} /></button>
                  </div>
                </div>
              </div>

              {/* ==========================================
                  EXPANDED DETAIL ROWS
              ========================================== */}
              {expanded[group.ref] && (
                <div className="border-t border-[var(--border-subtle)]">

                  {/* Mobile: card per item */}
                  <div className="sm:hidden divide-y divide-[var(--border-subtle)]">
                    {group.items.map((item, idx) => (
                      <div key={item.id} className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-[var(--brand)] font-medium">#{idx + 1} {item.barcode}</span>
                          <div className="flex gap-1">
                            <button onClick={() => { setEditItems([item]); setEditMode("item"); setShowSectionSelector(true); }} className="p-1 text-[var(--info)] hover:bg-[#5C8A9E10] rounded-sm"><PencilSimple size={13} /></button>
                            <button onClick={() => { setDelConfirm(item); setDelMode("item"); }} className="p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm"><Trash size={13} /></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                          <span className="text-[var(--text-secondary)]">Article: <span className="text-[var(--text-primary)]">{item.article_type !== "N/A" ? item.article_type : "-"}</span></span>
                          <span className="text-[var(--text-secondary)]">Fabric: <span className="font-mono font-medium">₹{fmt(item.fabric_amount)}</span></span>
                          <span className="text-[var(--text-secondary)]">Price: <span className="font-mono">₹{fmt(item.price)} × {item.qty}</span></span>
                          {item.discount > 0 && <span className="text-[var(--text-secondary)]">Disc: <span className="font-mono">{item.discount}%</span></span>}
                          {item.order_no !== "N/A" && <span className="text-[var(--text-secondary)]">Order#: <span className="font-mono">{item.order_no}</span></span>}
                          {item.delivery_date !== "N/A" && <span className="text-[var(--text-secondary)]">Delivery: <span className="font-mono">{item.delivery_date}</span></span>}
                          {item.tailoring_amount > 0 && <span className="text-[var(--text-secondary)]">Tailoring: <span className="font-mono">₹{fmt(item.tailoring_amount)}</span></span>}
                          {item.embroidery_amount > 0 && <span className="text-[var(--text-secondary)]">Emb: <span className="font-mono">₹{fmt(item.embroidery_amount)}</span></span>}
                          {item.addon_desc && item.addon_desc !== "N/A" && <span className="text-[var(--text-secondary)]">Add-on: <span className="text-[var(--text-primary)]">{item.addon_desc}</span></span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: full table with column visibility */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[var(--bg)] border-b border-[var(--border-subtle)]">
                          {visibleColumns.barcode          && <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Barcode</th>}
                          {visibleColumns.price            && <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Price</th>}
                          {visibleColumns.qty              && <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Qty</th>}
                          {visibleColumns.discount         && <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Disc%</th>}
                          {visibleColumns.fabric_amount    && <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Fabric Amt</th>}
                          {visibleColumns.article_type     && <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Article</th>}
                          {visibleColumns.order_no         && <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Order#</th>}
                          {visibleColumns.delivery_date    && <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Delivery</th>}
                          {visibleColumns.tailoring_amount && <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Tail. Amt</th>}
                          {visibleColumns.embroidery_amount && <th className="text-right px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Emb. Amt</th>}
                          {visibleColumns.addon_desc       && <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Add-on</th>}
                          <th className="text-left px-3 py-2 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(item => (
                          <tr key={item.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[#C86B4D04] transition-colors">
                            {visibleColumns.barcode          && <td className="px-3 py-2 text-xs font-mono max-w-[100px] truncate">{item.barcode || "—"}</td>}
                            {visibleColumns.price            && <td className="px-3 py-2 font-mono text-xs text-right">₹{fmt(item.price)}</td>}
                            {visibleColumns.qty              && <td className="px-3 py-2 font-mono text-xs text-right">{item.qty}</td>}
                            {visibleColumns.discount         && <td className="px-3 py-2 font-mono text-xs text-right">{item.discount ? `${item.discount}%` : "—"}</td>}
                            {visibleColumns.fabric_amount    && <td className="px-3 py-2 font-mono text-xs text-right font-medium">₹{fmt(item.fabric_amount)}</td>}
                            {visibleColumns.article_type     && <td className="px-3 py-2 text-xs">{item.article_type !== "N/A" ? item.article_type : "—"}</td>}
                            {visibleColumns.order_no         && <td className="px-3 py-2 font-mono text-xs">{item.order_no !== "N/A" ? item.order_no : "—"}</td>}
                            {visibleColumns.delivery_date    && <td className="px-3 py-2 font-mono text-xs">{item.delivery_date !== "N/A" ? item.delivery_date : "—"}</td>}
                            {visibleColumns.tailoring_amount && <td className="px-3 py-2 font-mono text-xs text-right">{item.tailoring_amount ? `₹${fmt(item.tailoring_amount)}` : "—"}</td>}
                            {visibleColumns.embroidery_amount && <td className="px-3 py-2 font-mono text-xs text-right">{item.embroidery_amount ? `₹${fmt(item.embroidery_amount)}` : "—"}</td>}
                            {visibleColumns.addon_desc       && <td className="px-3 py-2 text-xs max-w-[80px] truncate">{item.addon_desc !== "N/A" ? item.addon_desc : "—"}</td>}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-0.5">
                                <button onClick={() => { setEditItems([item]); setEditMode("item"); setShowSectionSelector(true); }} className="p-1 text-[var(--info)] hover:bg-[#5C8A9E10] rounded-sm" title="Edit Item"><PencilSimple size={13} /></button>
                                <button onClick={() => { setDelConfirm(item); setDelMode("item"); }} className="p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm" title="Delete Item"><Trash size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {invoiceRef && <InvoiceModal billRef={invoiceRef} onClose={() => setInvoiceRef(null)} />}
    </div>
  );
}
