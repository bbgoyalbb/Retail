import { useState, useEffect, useCallback } from "react";
import { getItems, getCustomers, updateItem, deleteItem, getAdvances, createAdvance, updateAdvance, deleteAdvance } from "@/api";
import { PencilSimple, Trash, FloppyDisk, X, Printer, CaretDown, CaretRight, MagnifyingGlass, Check, Plus } from "@phosphor-icons/react";
import InvoiceModal from "@/components/InvoiceModal";

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
// UTILITY FUNCTIONS
// ==========================================
const computeFabricAmount = (price, qty, discount) => {
  const discountedPrice = price - (price * (discount || 0) / 100);
  return Math.round(discountedPrice * qty);
};

const computePending = (total, received) => Math.round(total - (received || 0)); // negative = over-payment (credit)

const FIELD_CLASSES = "w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:border-[var(--brand)] focus:outline-none";

const renderFieldInput = (field, itemId, value, onChange) => {
  switch (field.type) {
    case 'date': return <input type="date" value={value || ''} onChange={e => onChange(itemId, field.key, e.target.value)} className={FIELD_CLASSES} />;
    case 'number': return <input type="number" step={field.step || 1} value={value ?? 0} onChange={e => onChange(itemId, field.key, parseFloat(e.target.value) || 0)} disabled={field.computed} className={`${FIELD_CLASSES} ${field.computed ? 'bg-[var(--bg)] text-[var(--text-secondary)]' : ''}`} />;
    case 'select': return <select value={value || ''} onChange={e => onChange(itemId, field.key, e.target.value)} className={FIELD_CLASSES}>{field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>;
    case 'checkbox': return <input type="checkbox" checked={!!value} onChange={e => onChange(itemId, field.key, e.target.checked)} className="w-4 h-4 accent-[var(--brand)]" />;
    default: return <input type="text" value={value || ''} onChange={e => onChange(itemId, field.key, e.target.value)} className={FIELD_CLASSES} />;
  }
};

export default function ItemsManager() {
  const [allItems, setAllItems] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [nameFilter, setNameFilter] = useState("");
  const [orderFilter, setOrderFilter] = useState("");
  const [expanded, setExpanded] = useState({});
  const [message, setMessage] = useState(null);
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [loading, setLoading] = useState(false);
  
  // Edit modal states
  const [showSectionSelector, setShowSectionSelector] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [editMode, setEditMode] = useState(null); // 'item' or 'order'
  const [editItems, setEditItems] = useState([]); // Array of items being edited
  const [editData, setEditData] = useState({}); // { [itemId]: { field: value } }
  const [originalData, setOriginalData] = useState({}); // For cancel
  const [saving, setSaving] = useState(false);
  
  // Advances editing state
  const [advanceData, setAdvanceData] = useState({}); // { [advanceId]: { field: value } }
  const [originalAdvanceData, setOriginalAdvanceData] = useState({});
  const [refAdvances, setRefAdvances] = useState([]);
  const [newAdvances, setNewAdvances] = useState([]); // New advances to be created
  const [deletedAdvances, setDeletedAdvances] = useState([]); // IDs to delete
  
  // Delete confirmation
  const [delConfirm, setDelConfirm] = useState(null);
  const [delMode, setDelMode] = useState(null); // 'item' or 'order'
  const [invoiceRef, setInvoiceRef] = useState(null);
  
  // Amount mismatch detection
  const [mismatchPrompt, setMismatchPrompt] = useState(null); // { refs: [], mismatches: [] }

  useEffect(() => { 
    getCustomers().then(res => setCustomers(res.data)).catch(() => {}); 
  }, []);

  const loadData = useCallback(async () => {
    const params = { limit: 2000 };
    if (nameFilter) params.name = nameFilter;
    if (orderFilter) params.order_no = orderFilter;
    
    setLoading(true);
    try {
      const [itemsRes, advancesRes] = await Promise.all([
        getItems(params),
        nameFilter ? getAdvances({ name: nameFilter }) : getAdvances()
      ]);
      setAllItems(itemsRes.data.items || []);
      setAdvances(advancesRes.data || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load data. Please try again." });
      setTimeout(() => setMessage(null), 4000);
    } finally {
      setLoading(false);
    }
  }, [nameFilter, orderFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // ==========================================
  // EDIT HANDLERS
  // ==========================================
  const startEdit = async (sectionKey, items, mode = 'item') => {
    setSelectedSection(sectionKey);
    setEditMode(mode);
    setEditItems(Array.isArray(items) ? items : [items]);
    
    // Initialize edit data with current values
    const initialData = {};
    const origData = {};
    const itemList = Array.isArray(items) ? items : [items];
    
    itemList.forEach(item => {
      initialData[item.id] = { ...item };
      origData[item.id] = { ...item };
    });
    
    setEditData(initialData);
    setOriginalData(origData);
    
    // If advances section, load advances for this reference
    if (sectionKey === 'advances' && itemList.length > 0) {
      const ref = itemList[0].ref;
      try {
        const res = await getAdvances({ ref });
        const advances = res.data || [];
        setRefAdvances(advances);
        
        // Initialize advance data
        const advInitial = {};
        const advOrig = {};
        advances.forEach(adv => {
          advInitial[adv.id] = { ...adv };
          advOrig[adv.id] = { ...adv };
        });
        setAdvanceData(advInitial);
        setOriginalAdvanceData(advOrig);
        setNewAdvances([]);
        setDeletedAdvances([]);
      } catch (err) {
        // silenced
        setRefAdvances([]);
      }
    }
    
    setShowSectionSelector(false);
  };

  // Handle advance field changes
  const handleAdvanceChange = (advanceId, fieldKey, value) => {
    setAdvanceData(prev => ({
      ...prev,
      [advanceId]: { ...prev[advanceId], [fieldKey]: value }
    }));
  };

  // Handle new advance changes
  const handleNewAdvanceChange = (index, fieldKey, value) => {
    setNewAdvances(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [fieldKey]: value };
      return updated;
    });
  };

  // Add new advance row
  const addNewAdvance = () => {
    const ref = editItems[0]?.ref || '';
    const name = editItems[0]?.name || '';
    setNewAdvances(prev => [...prev, { 
      id: `new_${Date.now()}`, 
      date: new Date().toISOString().split('T')[0], 
      name, 
      ref, 
      amount: 0, 
      mode: 'Cash',
      tally: false 
    }]);
  };

  // Remove new advance (before it's saved)
  const removeNewAdvance = (index) => {
    setNewAdvances(prev => prev.filter((_, i) => i !== index));
  };

  // Mark existing advance for deletion
  const markAdvanceForDelete = (advanceId) => {
    setDeletedAdvances(prev => [...prev, advanceId]);
    setAdvanceData(prev => {
      const updated = { ...prev };
      delete updated[advanceId];
      return updated;
    });
  };

  const handleFieldChange = (itemId, fieldKey, value) => {
    setEditData(prev => {
      const updated = { 
        ...prev, 
        [itemId]: { ...prev[itemId], [fieldKey]: value } 
      };
      
      // Compute dependent fields
      const item = updated[itemId];
      
      // Compute fabric_amount if price, qty, or discount changed
      if (['price', 'qty', 'discount'].includes(fieldKey)) {
        updated[itemId].fabric_amount = computeFabricAmount(
          parseFloat(item.price) || 0,
          parseFloat(item.qty) || 0,
          parseFloat(item.discount) || 0
        );
      }
      
      // Compute pending amounts if total or received changed
      if (fieldKey === 'fabric_received' || fieldKey === 'fabric_amount') {
        updated[itemId].fabric_pending = computePending(
          parseFloat(updated[itemId].fabric_amount) || 0,
          parseFloat(updated[itemId].fabric_received) || 0
        );
      }
      
      if (fieldKey === 'tailoring_received' || fieldKey === 'tailoring_amount') {
        updated[itemId].tailoring_pending = computePending(
          parseFloat(updated[itemId].tailoring_amount) || 0,
          parseFloat(updated[itemId].tailoring_received) || 0
        );
      }
      
      if (fieldKey === 'embroidery_received' || fieldKey === 'embroidery_amount') {
        updated[itemId].embroidery_pending = computePending(
          parseFloat(updated[itemId].embroidery_amount) || 0,
          parseFloat(updated[itemId].embroidery_received) || 0
        );
      }
      
      if (fieldKey === 'addon_received' || fieldKey === 'addon_amount') {
        updated[itemId].addon_pending = computePending(
          parseFloat(updated[itemId].addon_amount) || 0,
          parseFloat(updated[itemId].addon_received) || 0
        );
      }
      
      return updated;
    });
  };

  // Check if any amounts have decreased below what's already received
  const detectMismatches = (itemId, original, current) => {
    const mismatches = [];
    
    const checkMismatch = (amountKey, receivedKey, modeKey, label) => {
      const originalAmount = parseFloat(original[amountKey]) || 0;
      const newAmount = parseFloat(current[amountKey]) || 0;
      const received = parseFloat(original[receivedKey]) || 0;
      const mode = String(current[modeKey] || original[modeKey] || "");
      // Skip already-settled sections — negative pending is intentional there
      if (mode.startsWith("Settled")) return;
      // If amount decreased and is now less than what's received
      if (newAmount < originalAmount && newAmount < received) {
        mismatches.push({
          itemId,
          ref: original.ref,
          type: label,
          oldAmount: originalAmount,
          newAmount,
          received,
          overage: received - newAmount
        });
      }
    };
    
    checkMismatch('fabric_amount', 'fabric_received', 'fabric_pay_mode', 'Fabric');
    checkMismatch('tailoring_amount', 'tailoring_received', 'tailoring_pay_mode', 'Tailoring');
    checkMismatch('embroidery_amount', 'embroidery_received', 'embroidery_pay_mode', 'Embroidery');
    checkMismatch('addon_amount', 'addon_received', 'addon_pay_mode', 'Add-on');
    
    return mismatches;
  };

  const saveEdits = async () => {
    setSaving(true);
    const isAdvanceSection = selectedSection === 'advances';
    
    // Handle advances section
    if (isAdvanceSection) {
      let advSuccess = 0;
      let advFailed = 0;
      
      // Delete marked advances
      for (const advanceId of deletedAdvances) {
        try {
          await deleteAdvance(advanceId);
          advSuccess++;
        } catch (err) {
          // silenced
          advFailed++;
        }
      }
      
      // Update existing advances
      for (const [advanceId, data] of Object.entries(advanceData)) {
        try {
          const original = originalAdvanceData[advanceId];
          const changedFields = {};
          
          Object.keys(data).forEach(key => {
            if (JSON.stringify(data[key]) !== JSON.stringify(original[key])) {
              changedFields[key] = data[key];
            }
          });
          
          if (Object.keys(changedFields).length > 0) {
            await updateAdvance(advanceId, changedFields);
            advSuccess++;
          }
        } catch (err) {
          // silenced
          advFailed++;
        }
      }
      
      // Create new advances
      for (const newAdvance of newAdvances) {
        try {
          const { id, ...data } = newAdvance; // Remove temp id
          await createAdvance(data);
          advSuccess++;
        } catch (err) {
          // silenced
          advFailed++;
        }
      }
      
      setSaving(false);
      setSelectedSection(null);
      setAdvanceData({});
      setOriginalAdvanceData({});
      setNewAdvances([]);
      setDeletedAdvances([]);
      setRefAdvances([]);
      setEditItems([]);
      
      if (advFailed === 0) {
        setMessage({ type: "success", text: `Advances saved successfully` });
      } else {
        setMessage({ type: "error", text: `${advFailed} advance operation(s) failed, ${advSuccess} succeeded` });
      }
      setTimeout(() => setMessage(null), 3000);
      loadData();
      return;
    }
    
    // Handle regular items
    const itemIds = Object.keys(editData);
    let success = 0;
    let failed = 0;
    const allMismatches = [];
    const affectedRefs = new Set();
    
    for (const itemId of itemIds) {
      try {
        // Only send changed fields
        const original = originalData[itemId];
        const current = editData[itemId];
        const changedFields = {};
        
        Object.keys(current).forEach(key => {
          if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) {
            changedFields[key] = current[key];
          }
        });
        
        // Check for amount mismatches before saving
        const mismatches = detectMismatches(itemId, original, current);
        if (mismatches.length > 0) {
          allMismatches.push(...mismatches);
          affectedRefs.add(original.ref);
        }
        
        if (Object.keys(changedFields).length > 0) {
          await updateItem(itemId, changedFields);
          success++;
        }
      } catch (err) {
        // silenced
        failed++;
      }
    }
    
    setSaving(false);
    setSelectedSection(null);
    setEditData({});
    setOriginalData({});
    setEditItems([]);
    
    if (failed === 0) {
      if (allMismatches.length > 0) {
        // Show mismatch prompt instead of success message
        setMismatchPrompt({
          refs: Array.from(affectedRefs),
          mismatches: allMismatches
        });
      } else {
        setMessage({ type: "success", text: `${success} item(s) updated successfully` });
        setTimeout(() => setMessage(null), 3000);
      }
    } else {
      setMessage({ type: "error", text: `${failed} update(s) failed, ${success} succeeded` });
      setTimeout(() => setMessage(null), 3000);
    }
    
    loadData();
  };

  const handleMismatchConfirm = (refsToRedirect) => {
    setMismatchPrompt(null);
    if (refsToRedirect && refsToRedirect.length > 0) {
      const refsParam = refsToRedirect.join(',');
      window.location.href = `/settlements?refs=${encodeURIComponent(refsParam)}`;
    }
  };

  const handleMismatchCancel = () => {
    setMismatchPrompt(null);
  };

  const cancelEdit = () => {
    setSelectedSection(null);
    setEditData({});
    setOriginalData({});
    setEditItems([]);
    setShowSectionSelector(false);
    // Reset advance states
    setAdvanceData({});
    setOriginalAdvanceData({});
    setRefAdvances([]);
    setNewAdvances([]);
    setDeletedAdvances([]);
  };

  // ==========================================
  // DELETE HANDLERS
  // ==========================================
  const handleDelete = async () => {
    if (!delConfirm) return;
    
    try {
      if (delMode === 'order') {
        // Delete all items in the order
        const itemIds = delConfirm.items.map(i => i.id);
        for (const id of itemIds) {
          await deleteItem(id);
        }
        setMessage({ type: "success", text: `Order ${delConfirm.ref} deleted (${itemIds.length} items)` });
      } else {
        // Delete single item
        await deleteItem(delConfirm.id);
        setMessage({ type: "success", text: "Item deleted" });
      }
      setDelConfirm(null);
      loadData();
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  // Group items by reference
  const grouped = {};
  allItems.forEach(item => {
    const ref = item.ref;
    if (!grouped[ref]) grouped[ref] = { ref, name: item.name, date: item.date, items: [], totals: { fabric: 0, tailoring: 0, embroidery: 0, addon: 0, advance: 0 } };
    grouped[ref].items.push(item);
    grouped[ref].totals.fabric += item.fabric_amount || 0;
    grouped[ref].totals.tailoring += item.tailoring_amount || 0;
    grouped[ref].totals.embroidery += item.embroidery_amount || 0;
    grouped[ref].totals.addon += item.addon_amount || 0;
  });
  advances.forEach(adv => {
    if (grouped[adv.ref]) grouped[adv.ref].totals.advance += adv.amount || 0;
  });

  const refs = Object.values(grouped).sort((a, b) => {
    let va = a[sortKey];
    let vb = b[sortKey];
    
    // Handle missing values
    if (va === undefined || va === null) va = "";
    if (vb === undefined || vb === null) vb = "";
    
    // Check if values are dates (YYYY-MM-DD format)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const isDateA = dateRegex.test(String(va));
    const isDateB = dateRegex.test(String(vb));
    
    if (isDateA && isDateB) {
      // Compare dates using localeCompare for proper sorting
      const cmp = String(va).localeCompare(String(vb));
      return sortDir === "desc" ? -cmp : cmp;
    }
    
    // Check if numeric
    if (typeof va === "number" && typeof vb === "number") {
      const cmp = va - vb;
      return sortDir === "desc" ? -cmp : cmp;
    }
    
    // Default string comparison
    const cmp = String(va).localeCompare(String(vb));
    return sortDir === "desc" ? -cmp : cmp;
  });

  const orderNos = [...new Set(allItems.map(i => i.order_no).filter(o => o && o !== "N/A"))].sort();

  const toggleExpand = (ref) => setExpanded(prev => ({ ...prev, [ref]: !prev[ref] }));
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };
  const fmt = (n) => n ? new Intl.NumberFormat('en-IN').format(Math.round(n)) : "-";

  // Section selector and edit modals are rendered inline in the return to avoid
  // inner-component remount bug that causes input focus loss on every keystroke.
  const _sectionForEdit = selectedSection ? SECTIONS[selectedSection] : null;
  const _isAdvanceEdit = _sectionForEdit?.isAdvanceSection;

  return (
    <div data-testid="items-manager-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Manage Orders</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">View, edit and manage all orders grouped by reference</p>
      </div>

      {message && (
        <div className={`p-3 border rounded-sm text-sm ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>{message.text}</div>
      )}

      {/* Filters */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-4 rounded-sm flex flex-wrap gap-3 items-center">
        <select data-testid="orders-customer-filter" value={nameFilter} onChange={e => setNameFilter(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
          <option value="">All Customers</option>
          {customers.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select data-testid="orders-order-filter" value={orderFilter} onChange={e => setOrderFilter(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
          <option value="">All Order Nos</option>
          {orderNos.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="ml-auto text-xs text-[var(--text-secondary)]">{refs.length} references, {allItems.length} items</span>
      </div>

      {/* Section Selector Modal - inline to preserve input focus */}
      {showSectionSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[var(--border-subtle)]">
              <h2 className="font-heading text-xl font-medium">Select Section to Edit</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {editMode === 'order' ? `Editing order with ${editItems.length} items` : 'Editing single item'}
              </p>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(SECTIONS).map(([key, section]) => (
                <button key={key} onClick={() => startEdit(key, editItems, editMode)} className="p-4 border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] hover:bg-[#C86B4D08] text-left transition-colors">
                  <h3 className="font-medium text-[var(--brand)]">{section.label}</h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{section.description}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-2">{section.fields.length} fields</p>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-[var(--border-subtle)] flex justify-end">
              <button onClick={() => { setShowSectionSelector(false); setEditItems([]); }} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Section Edit Modal - inline to preserve input focus */}
      {selectedSection && _sectionForEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm max-w-[95vw] w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-medium">{_sectionForEdit.label}</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  {editMode === 'order' ? `Editing ${editItems.length} items` : 'Editing 1 item'} • {_sectionForEdit.description}
                </p>
              </div>
              <button onClick={cancelEdit} className="p-1 hover:bg-[var(--bg)] rounded-sm"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {_isAdvanceEdit ? (
                <div className="overflow-x-auto">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">Editing advances for: <span className="font-mono font-medium">{editItems[0]?.ref}</span></span>
                    <button onClick={addNewAdvance} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--success)] text-white rounded-sm hover:bg-[#3d4a3f]"><Plus size={12} /> Add Advance</button>
                  </div>
                  {Object.keys(advanceData).length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Existing Advances</h4>
                      <table className="w-full border border-[var(--border-subtle)]">
                        <thead className="bg-[var(--bg)] sticky top-0"><tr>
                          {_sectionForEdit.fields.map(f => <th key={f.key} className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">{f.label}</th>)}
                          <th className="px-2 py-2 text-center text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] w-16">Action</th>
                        </tr></thead>
                        <tbody>
                          {Object.entries(advanceData).map(([advId, adv]) => (
                            <tr key={advId} className="border-b border-[var(--border-subtle)] last:border-0">
                              {_sectionForEdit.fields.map(f => <td key={f.key} className="px-2 py-2">{renderFieldInput(f, advId, adv[f.key], handleAdvanceChange)}</td>)}
                              <td className="px-2 py-2 text-center"><button onClick={() => markAdvanceForDelete(advId)} className="p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm"><Trash size={14} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {newAdvances.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-[var(--success)] mb-2">New Advances (to be created)</h4>
                      <table className="w-full border border-[var(--border-subtle)]">
                        <thead className="bg-[var(--bg)] sticky top-0"><tr>
                          {_sectionForEdit.fields.map(f => <th key={f.key} className="px-2 py-2 text-left text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">{f.label}</th>)}
                          <th className="px-2 py-2 text-center text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] w-16">Action</th>
                        </tr></thead>
                        <tbody>
                          {newAdvances.map((adv, idx) => (
                            <tr key={adv.id} className="border-b border-[var(--border-subtle)] last:border-0 bg-[#455D4A08]">
                              {_sectionForEdit.fields.map(f => <td key={f.key} className="px-2 py-2">{renderFieldInput(f, idx, adv[f.key], (i, k, v) => handleNewAdvanceChange(i, k, v))}</td>)}
                              <td className="px-2 py-2 text-center"><button onClick={() => removeNewAdvance(idx)} className="p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm"><X size={14} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {deletedAdvances.length > 0 && (
                    <div className="mb-3 p-2 bg-[#9E473D10] border border-[var(--error)] rounded-sm text-xs">
                      <span className="text-[var(--error)]">{deletedAdvances.length} advance(s) marked for deletion</span>
                    </div>
                  )}
                  {Object.keys(advanceData).length === 0 && newAdvances.length === 0 && (
                    <div className="p-4 text-center text-sm text-[var(--text-secondary)] border border-dashed border-[var(--border-subtle)] rounded-sm">No advances for this reference. Click "Add Advance" to create one.</div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border border-[var(--border-subtle)]">
                    <thead className="bg-[var(--bg)] sticky top-0"><tr>
                      <th className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] w-20">Item</th>
                      {_sectionForEdit.fields.map(f => (
                        <th key={f.key} className="px-3 py-2 text-left text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] min-w-[100px]">
                          {f.label} {f.computed && <span className="text-[var(--info)]">(auto)</span>}
                        </th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {editItems.map((item, idx) => (
                        <tr key={item.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[#C86B4D05]">
                          <td className="px-3 py-2 align-top">
                            <div className="text-xs font-mono text-[var(--brand)]">#{idx + 1}</div>
                            <div className="text-[10px] text-[var(--text-secondary)] truncate max-w-[100px]">{item.barcode}</div>
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
            <div className="p-4 border-t border-[var(--border-subtle)] flex justify-between items-center">
              <button onClick={() => setShowSectionSelector(true)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">← Change Section</button>
              <div className="flex gap-3">
                <button onClick={cancelEdit} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)]">Cancel</button>
                <button onClick={saveEdits} disabled={saving} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50 flex items-center gap-2">
                  {saving ? 'Saving...' : <><Check size={14} /> Confirm Changes</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {delConfirm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setDelConfirm(null)}>
          <div data-testid="delete-confirm-modal" className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-heading text-lg font-medium mb-2">
              Delete {delMode === 'order' ? 'Order' : 'Item'}?
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {delMode === 'order' ? (
                <>
                  Order: <span className="font-mono font-medium">{delConfirm.ref}</span><br/>
                  <span className="text-xs">{delConfirm.items?.length || 0} items will be deleted</span>
                </>
              ) : (
                <>Item: <span className="font-mono">{delConfirm.barcode}</span></>
              )}
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDelConfirm(null)} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm">Cancel</button>
              <button
                data-testid="confirm-delete-btn"
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-[var(--error)] text-white rounded-sm hover:bg-[var(--error)]/90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Amount Mismatch Prompt */}
      {mismatchPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[var(--border-subtle)] bg-[#9E473D10]">
              <h3 className="font-heading text-lg font-medium text-[var(--error)]">⚠️ Amount Mismatch Detected</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Some amounts were reduced below what has already been received. You need to reconfigure the settlement.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-xs">
                <thead className="bg-[var(--bg)] sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">Ref</th>
                    <th className="px-2 py-2 text-left">Type</th>
                    <th className="px-2 py-2 text-right">Old</th>
                    <th className="px-2 py-2 text-right">New</th>
                    <th className="px-2 py-2 text-right">Received</th>
                    <th className="px-2 py-2 text-right text-[var(--error)]">Overage</th>
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
            <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg)] flex justify-between items-center">
              <span className="text-xs text-[var(--text-secondary)]">
                {mismatchPrompt.refs.length} order(s) affected
              </span>
              <div className="flex gap-3">
                <button 
                  onClick={handleMismatchCancel}
                  className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--surface)]"
                >
                  I'll fix it later
                </button>
                <button 
                  onClick={() => handleMismatchConfirm(mismatchPrompt.refs)}
                  className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] flex items-center gap-2"
                >
                  Go to Settlement →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grouped References */}
      <div className="space-y-2">
        {/* Header row — desktop only */}
        <div className="hidden sm:grid bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm px-4 py-2 items-center text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]" style={{gridTemplateColumns:'24px 96px 96px 1fr repeat(5,88px) 48px 88px'}}>
          <span></span>
          <button onClick={() => handleSort("date")} className="text-left hover:text-[var(--brand)]">Date {sortKey === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button>
          <button onClick={() => handleSort("ref")} className="text-left hover:text-[var(--brand)]">Ref {sortKey === 'ref' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button>
          <button onClick={() => handleSort("name")} className="text-left hover:text-[var(--brand)]">Customer {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button>
          <span className="text-right">Fabric</span>
          <span className="text-right">Tailoring</span>
          <span className="text-right">Emb.</span>
          <span className="text-right">Add-on</span>
          <span className="text-right">Advance</span>
          <span className="text-center">Items</span>
          <span></span>
        </div>

        {loading ? (
          <>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-12 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm animate-pulse" />
            ))}
          </>
        ) : (
          <>
            {refs.map(group => (
          <div key={group.ref} className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm overflow-hidden">
            {/* Collapsed Reference Row */}
            <div className="px-3 py-3 cursor-pointer hover:bg-[#C86B4D05] transition-colors" onClick={() => toggleExpand(group.ref)}>
              {/* Mobile layout */}
              <div className="flex sm:hidden items-start gap-2">
                <span className="mt-1 text-[var(--text-secondary)] flex-shrink-0">{expanded[group.ref] ? <CaretDown size={14} /> : <CaretRight size={14} />}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-[var(--brand)] font-medium">{group.ref}</span>
                    <span className="text-xs text-[var(--text-secondary)]">{group.date}</span>
                  </div>
                  <div className="text-sm font-medium truncate mt-0.5">{group.name}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {group.totals.fabric > 0 && <span className="text-[10px] text-[var(--text-secondary)]">Fab: <span className="font-mono text-[var(--text-primary)]">{fmt(group.totals.fabric)}</span></span>}
                    {group.totals.tailoring > 0 && <span className="text-[10px] text-[var(--text-secondary)]">Tail: <span className="font-mono text-[var(--text-primary)]">{fmt(group.totals.tailoring)}</span></span>}
                    {group.totals.embroidery > 0 && <span className="text-[10px] text-[var(--text-secondary)]">Emb: <span className="font-mono text-[var(--text-primary)]">{fmt(group.totals.embroidery)}</span></span>}
                    {group.totals.addon > 0 && <span className="text-[10px] text-[var(--text-secondary)]">Add-on: <span className="font-mono text-[var(--text-primary)]">{fmt(group.totals.addon)}</span></span>}
                    <span className="text-[10px] text-[var(--text-secondary)]">{group.items.length} items</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditItems(group.items); setEditMode('order'); setShowSectionSelector(true); }} className="p-1.5 text-[var(--info)] hover:bg-[#5C8A9E10] rounded-sm" title="Edit Order"><PencilSimple size={14} /></button>
                  <button onClick={() => { setDelConfirm(group); setDelMode('order'); }} className="p-1.5 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm" title="Delete Order"><Trash size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); setInvoiceRef(group.ref); }} className="p-1.5"><Printer size={15} className="text-[var(--brand)] inline" /></button>
                </div>
              </div>
              {/* Desktop layout */}
              <div className="hidden sm:grid items-center" style={{gridTemplateColumns:'24px 96px 96px 1fr repeat(5,88px) 48px 88px'}}>
                <span className="text-[var(--text-secondary)]">{expanded[group.ref] ? <CaretDown size={14} /> : <CaretRight size={14} />}</span>
                <span className="font-mono text-xs">{group.date}</span>
                <span className="font-mono text-xs text-[var(--brand)] font-medium">{group.ref}</span>
                <span className="text-sm font-medium truncate pr-2">{group.name}</span>
                <span className="font-mono text-xs text-right">{group.totals.fabric > 0 ? fmt(group.totals.fabric) : '-'}</span>
                <span className="font-mono text-xs text-right">{group.totals.tailoring > 0 ? fmt(group.totals.tailoring) : '-'}</span>
                <span className="font-mono text-xs text-right">{group.totals.embroidery > 0 ? fmt(group.totals.embroidery) : '-'}</span>
                <span className="font-mono text-xs text-right">{group.totals.addon > 0 ? fmt(group.totals.addon) : '-'}</span>
                <span className="font-mono text-xs text-right">{group.totals.advance > 0 ? fmt(group.totals.advance) : '-'}</span>
                <span className="text-center font-mono text-xs">{group.items.length}</span>
                <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditItems(group.items); setEditMode('order'); setShowSectionSelector(true); }} className="p-1.5 text-[var(--info)] hover:bg-[#5C8A9E10] rounded-sm" title="Edit Order"><PencilSimple size={14} /></button>
                  <button onClick={() => { setDelConfirm(group); setDelMode('order'); }} className="p-1.5 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm" title="Delete Order"><Trash size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); setInvoiceRef(group.ref); }} className="p-1.5"><Printer size={15} className="text-[var(--brand)] hover:text-[var(--brand-hover)]" /></button>
                </div>
              </div>
            </div>

            {/* Expanded Detail Rows */}
            {expanded[group.ref] && (
              <div className="border-t border-[var(--border-subtle)]">
                {/* Mobile: card per item */}
                <div className="sm:hidden divide-y divide-[var(--border-subtle)]">
                  {group.items.map((item, idx) => (
                    <div key={item.id} className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-[var(--brand)] font-medium">#{idx+1} {item.barcode}</span>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditItems([item]); setEditMode('item'); setShowSectionSelector(true); }} className="p-1 text-[var(--info)] hover:bg-[#5C8A9E10] rounded-sm"><PencilSimple size={14} /></button>
                          <button onClick={() => { setDelConfirm(item); setDelMode('item'); }} className="p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm"><Trash size={14} /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                        <span className="text-[var(--text-secondary)]">Article: <span className="text-[var(--text-primary)]">{item.article_type !== 'N/A' ? item.article_type : '-'}</span></span>
                        <span className="text-[var(--text-secondary)]">Fabric: <span className="font-mono text-[var(--text-primary)] font-medium">₹{fmt(item.fabric_amount)}</span></span>
                        <span className="text-[var(--text-secondary)]">Price: <span className="font-mono text-[var(--text-primary)]">₹{fmt(item.price)} × {item.qty}</span></span>
                        {item.discount > 0 && <span className="text-[var(--text-secondary)]">Disc: <span className="font-mono text-[var(--text-primary)]">{item.discount}%</span></span>}
                        {item.order_no !== 'N/A' && <span className="text-[var(--text-secondary)]">Order#: <span className="font-mono text-[var(--text-primary)]">{item.order_no}</span></span>}
                        {item.delivery_date !== 'N/A' && <span className="text-[var(--text-secondary)]">Delivery: <span className="font-mono text-[var(--text-primary)]">{item.delivery_date}</span></span>}
                        {item.tailoring_amount > 0 && <span className="text-[var(--text-secondary)]">Tailoring: <span className="font-mono text-[var(--text-primary)]">₹{fmt(item.tailoring_amount)}</span></span>}
                        {item.embroidery_amount > 0 && <span className="text-[var(--text-secondary)]">Emb: <span className="font-mono text-[var(--text-primary)]">₹{fmt(item.embroidery_amount)}</span></span>}
                        {item.addon_desc && item.addon_desc !== 'N/A' && <span className="text-[var(--text-secondary)]">Add-on: <span className="text-[var(--text-primary)]">{item.addon_desc}</span></span>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: full table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[var(--bg)]">
                        {["Barcode", "Price", "Qty", "Disc%", "Fabric Amt", "Article", "Order#", "Delivery", "Tail. Amt", "Emb. Amt", "Add-on", "Actions"].map(h => (
                          <th key={h} className="text-left px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(item => (
                        <tr key={item.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[#C86B4D05]">
                          <td className="px-3 py-2 text-xs max-w-[100px] truncate">{item.barcode}</td>
                          <td className="px-3 py-2 font-mono text-xs">₹{fmt(item.price)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.qty}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.discount ? `${item.discount}%` : "-"}</td>
                          <td className="px-3 py-2 font-mono text-xs font-medium">₹{fmt(item.fabric_amount)}</td>
                          <td className="px-3 py-2 text-xs">{item.article_type !== "N/A" ? item.article_type : "-"}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.order_no !== "N/A" ? item.order_no : "-"}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.delivery_date !== "N/A" ? item.delivery_date : "-"}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.tailoring_amount ? `₹${fmt(item.tailoring_amount)}` : "-"}</td>
                          <td className="px-3 py-2 font-mono text-xs">{item.embroidery_amount ? `₹${fmt(item.embroidery_amount)}` : "-"}</td>
                          <td className="px-3 py-2 text-xs max-w-[80px] truncate">{item.addon_desc !== "N/A" ? item.addon_desc : "-"}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => { setEditItems([item]); setEditMode('item'); setShowSectionSelector(true); }} className="p-1 text-[var(--info)] hover:bg-[#5C8A9E10] rounded-sm" title="Edit Item"><PencilSimple size={14} /></button>
                              <button onClick={() => { setDelConfirm(item); setDelMode('item'); }} className="p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm" title="Delete Item"><Trash size={14} /></button>
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
            ))}
          </>
        )}
      </div>

      {invoiceRef && (
        <InvoiceModal billRef={invoiceRef} onClose={() => setInvoiceRef(null)} />
      )}
    </div>
  );
}
