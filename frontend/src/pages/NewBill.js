import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createBill, getCustomers, getInvoiceUrl, getSettings, invalidateCustomersCache, getNextBillRef } from "@/api";
import { invalidate } from "@/lib/dataEvents";
import { Plus, FloppyDisk, Spinner, WifiSlash, ArrowsSplit, User, ShoppingCart, CreditCard } from "@phosphor-icons/react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { DatePickerInput } from "@/components/DatePickerInput";
import BarcodeScanner from "@/components/BarcodeScanner";
import InvoiceModal from "@/components/InvoiceModal";
import { BillLineItemRow, ItemInputForm, PaymentSummaryPanel, BillSuccessPanel } from "@/components/bill";

export default function NewBill() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  
  // Online/offline state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // App config loaded from settings
  const [config, setConfig] = useState({
    customers: [],
    articleTypes: ["Shirt", "Pant", "Kurta"],
    addonItems: ["Buttons", "Tie", "Bow"],
    paymentModes: ["Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"],
  });

  // Bill-level form fields
  const [billForm, setBillForm] = useState({
    customerName: "",
    orderDate: today,
    payDate: today,
    amountPaid: "",
    selectedModes: [],
    isSettled: false,
    needsTailoring: false,
  });

  // Current item being added/edited
  const [itemForm, setItemForm] = useState({
    barcode: "",
    qty: "",
    price: "",
    discount: "",
    editingIndex: null,
  });

  // Saved items in the bill
  const [items, setItems] = useState([]);

  // Ref preview/override state
  const [refPreview, setRefPreview] = useState("");
  const [customRef, setCustomRef] = useState("");
  const [refEdited, setRefEdited] = useState(false);

  // UI / modal state
  const [ui, setUi] = useState({
    saving: false,
    message: null,
    showScanner: false,
    showPostSave: false,
    showInvoice: false,
    showTailoringModal: false,
    showAddonModal: false,
    dupWarning: null,
    showSuggestions: false,
    lastBillRef: null,
    lastBillTotal: 0,
  });

  // Convenience updaters to avoid spreading manually every time
  const updateBillForm  = (key, val) => setBillForm(p  => ({ ...p, [key]: val }));
  const updateItemForm  = (key, val) => setItemForm(p  => ({ ...p, [key]: val }));
  const updateUi        = (key, val) => setUi(p        => ({ ...p, [key]: val }));

  // Destructure for backwards-compatible local names used throughout the component
  const { customers, articleTypes, addonItems, paymentModes } = config;
  const { customerName, orderDate, payDate, amountPaid, selectedModes, isSettled, needsTailoring } = billForm;
  const { barcode, qty, price, discount, editingIndex } = itemForm;
  const { saving, message, showScanner, showPostSave, showInvoice, showTailoringModal, showAddonModal, dupWarning, showSuggestions, lastBillRef, lastBillTotal } = ui;

  // Setters that match the old individual-useState API so the rest of the file needs no changes
  const setCustomerName    = (v) => updateBillForm("customerName", v);
  const setOrderDate       = (v) => updateBillForm("orderDate", v);
  const setPayDate         = (v) => updateBillForm("payDate", v);
  const setAmountPaid      = (v) => updateBillForm("amountPaid", v);
  const setSelectedModes   = (v) => updateBillForm("selectedModes", typeof v === "function" ? v(selectedModes) : v);
  const setIsSettled       = (v) => updateBillForm("isSettled", v);
  const setNeedsTailoring  = (v) => updateBillForm("needsTailoring", v);
  const setBarcode         = (v) => updateItemForm("barcode", v);
  const setQty             = (v) => updateItemForm("qty", v);
  const setPrice           = (v) => updateItemForm("price", v);
  const setDiscount        = (v) => updateItemForm("discount", v);
  const setEditingIndex    = (v) => updateItemForm("editingIndex", v);
  const setSaving          = (v) => updateUi("saving", v);
  const setMessage         = (v) => updateUi("message", v);
  const setShowScanner     = (v) => updateUi("showScanner", v);
  const setShowPostSave    = (v) => updateUi("showPostSave", v);
  const setShowInvoice     = (v) => updateUi("showInvoice", v);
  const setShowTailoringModal = (v) => updateUi("showTailoringModal", v);
  const setShowAddonModal  = (v) => updateUi("showAddonModal", v);
  const setDupWarning      = (v) => updateUi("dupWarning", v);
  const setShowSuggestions = (v) => updateUi("showSuggestions", v);
  const setLastBillRef     = (v) => updateUi("lastBillRef", v);
  const setLastBillTotal   = (v) => updateUi("lastBillTotal", v);
  const nameWrapRef = useRef(null);

  const nameSuggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    return q
      ? customers.filter(c => c.toLowerCase().includes(q)).slice(0, 8)
      : customers.slice(0, 6);
  }, [customerName, customers]);

  useEffect(() => {
    const handleClick = (e) => { if (nameWrapRef.current && !nameWrapRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('touchstart', handleClick); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nameRef = useRef(null);
  const dateRef = useRef(null);
  const barcodeRef = useRef(null);
  const qtyRef = useRef(null);
  const priceRef = useRef(null);
  const discountRef = useRef(null);
  const amountRef = useRef(null);
  const payDateRef = useRef(null);
  const settledRef = useRef(null);
  const tailoringRef = useRef(null);
  const saveBtnRef = useRef(null);

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 100); }, []);

  // Fetch ref preview whenever order date changes (and user hasn't manually edited it)
  useEffect(() => {
    if (!orderDate) return;
    const timer = setTimeout(() => {
      getNextBillRef(orderDate)
        .then(res => {
          setRefPreview(res.data.ref);
          if (!refEdited) setCustomRef(res.data.ref);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderDate]);

  useEffect(() => {
    getCustomers().then(res => setConfig(p => ({ ...p, customers: res.data || [] }))).catch(() => {});
    getSettings().then(res => {
      const s = res.data || {};
      setConfig(p => ({
        ...p,
        ...(Array.isArray(s.article_types) && s.article_types.length > 0 ? { articleTypes: s.article_types } : {}),
        ...(Array.isArray(s.addon_items)    && s.addon_items.length > 0    ? { addonItems: s.addon_items }       : {}),
        ...(Array.isArray(s.payment_modes)  && s.payment_modes.length > 0  ? { paymentModes: s.payment_modes }   : {}),
      }));
    }).catch(() => {});
  }, []);

  const grandTotal = items.reduce((sum, item) => {
    const addonTotal = (item.addon?.items || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    return sum + item.total + addonTotal;
  }, 0);

  // Get default article type (extracted for dependency clarity)
  const defaultArticleType = articleTypes[0] || "Shirt";

  const defaultTailoring = useMemo(() => ({
    enabled: false,
    order_no: "",
    delivery_date: "",
    article_type: defaultArticleType,
    embroidery_status: "Not Required",
  }), [defaultArticleType]);

  const defaultAddon = useMemo(() => ({
    enabled: false,
    items: [], // Array of {name, amount}
  }), []);

  const resetItemForm = () => {
    setBarcode("");
    setQty("");
    setPrice("");
    setDiscount("");
    setEditingIndex(null);
  };

  const addItem = useCallback(() => {
    if (!barcode || !qty || !price) return;
    const d = parseFloat(discount) || 0;
    const total = Math.round((parseFloat(price) - parseFloat(price) * d / 100) * parseFloat(qty));

    if (editingIndex !== null) {
      setItems(prev => prev.map((row, idx) => (
        idx === editingIndex
          ? { ...row, barcode, qty: parseFloat(qty), price: parseFloat(price), discount: d, total }
          : row
      )));
    } else {
      const isDuplicate = items.some(row => row.barcode === barcode);
      if (isDuplicate && dupWarning !== barcode) {
        setDupWarning(barcode);
        setMessage({ type: "error", text: `Barcode "${barcode}" already in bill. Scan/click Add again to force-add.` });
        setTimeout(() => { setDupWarning(null); setMessage(null); }, 4000);
        return;
      }
      setDupWarning(null);
      setItems(prev => [...prev, {
        barcode,
        qty: parseFloat(qty),
        price: parseFloat(price),
        discount: d,
        total,
        tailoring: { ...defaultTailoring },
        addon: { ...defaultAddon },
      }]);
    }

    resetItemForm();
    setTimeout(() => barcodeRef.current?.focus(), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcode, qty, price, discount, editingIndex, dupWarning, items, defaultTailoring, defaultAddon]);

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) resetItemForm();
    if (editingIndex !== null && index < editingIndex) setEditingIndex(editingIndex - 1);
  };

  const editItem = (index) => {
    const row = items[index];
    setBarcode(row.barcode);
    setQty(String(row.qty));
    setPrice(String(row.price));
    setDiscount(String(row.discount || 0));
    setEditingIndex(index);
    setTimeout(() => barcodeRef.current?.focus(), 50);
  };

  const toggleMode = (mode) => setSelectedModes(prev => prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]);

  const updateItemTailoring = (index, patch) => {
    setItems(prev => prev.map((row, idx) => idx === index ? { ...row, tailoring: { ...(row.tailoring || defaultTailoring), ...patch } } : row));
  };

  const updateItemAddon = (index, patch) => {
    setItems(prev => prev.map((row, idx) => idx === index ? { ...row, addon: { ...(row.addon || defaultAddon), ...patch } } : row));
  };

  const addAddonItem = (itemIndex) => {
    setItems(prev => prev.map((row, idx) => {
      if (idx !== itemIndex) return row;
      const currentItems = row.addon?.items || [];
      return {
        ...row,
        addon: {
          enabled: true,
          items: [...currentItems, { name: addonItems[0] || "Buttons", amount: "" }]
        }
      };
    }));
  };

  const removeAddonItem = (itemIndex, addonIdx) => {
    setItems(prev => prev.map((row, idx) => {
      if (idx !== itemIndex) return row;
      const currentItems = (row.addon?.items || []).filter((_, i) => i !== addonIdx);
      return {
        ...row,
        addon: {
          enabled: currentItems.length > 0,
          items: currentItems
        }
      };
    }));
  };

  const updateAddonItem = (itemIndex, addonIdx, patch) => {
    setItems(prev => prev.map((row, idx) => {
      if (idx !== itemIndex) return row;
      const currentItems = row.addon?.items || [];
      return {
        ...row,
        addon: {
          ...row.addon,
          items: currentItems.map((item, i) => i === addonIdx ? { ...item, ...patch } : item)
        }
      };
    }));
  };

  const validateTailoringRows = () => {
    const invalid = items.find(row => row.tailoring?.enabled && (!row.tailoring.order_no || !row.tailoring.delivery_date || !row.tailoring.article_type));
    return !invalid;
  };

  const isDirty = customerName.trim() !== "" || items.length > 0;

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Escape key handler for AddOnModal
  useEffect(() => {
    if (!showAddonModal) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setShowAddonModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddonModal]);

  // Ctrl+S saves the bill
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (!showPostSave && !saving) saveBtnRef.current?.click();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showPostSave, saving]);

  const handleSave = async () => {
    if (!customerName || items.length === 0) {
      setMessage({ type: "error", text: "Please enter customer name and at least one item" });
      return;
    }
    if (parseFloat(amountPaid) > 0 && selectedModes.length === 0) {
      setMessage({ type: "error", text: "Please select a payment mode when entering an amount paid" });
      return;
    }
    if (isSettled && selectedModes.length === 0) {
      setMessage({ type: "error", text: "Please select at least one payment mode when settling the invoice" });
      return;
    }
    if (!validateTailoringRows()) {
      setMessage({ type: "error", text: "Please complete order number, delivery date and article type for all tailoring-enabled rows" });
      return;
    }

    setSaving(true);
    try {
      const hasTailoringRows = items.some(i => i.tailoring?.enabled);
      const res = await createBill({
        customer_name: customerName,
        date: orderDate,
        payment_date: payDate,
        items: items.map(i => {
          const payload = {
            barcode: i.barcode,
            qty: i.qty,
            price: i.price,
            discount: i.discount,
          };

          if (i.tailoring?.enabled) {
            payload.article_type = i.tailoring.article_type;
            payload.order_no = i.tailoring.order_no;
            payload.delivery_date = i.tailoring.delivery_date;
            payload.embroidery_status = i.tailoring.embroidery_status || "Not Required";
          }

          if (i.addon?.enabled && (i.addon.items || []).length > 0) {
            payload.addons = i.addon.items
              .filter(a => (parseFloat(a.amount) || 0) > 0)
              .map(a => ({
                name: a.name || "Add-on",
                price: parseFloat(a.amount) || 0,
              }));
          }

          return payload;
        }),
        payment_modes: selectedModes,
        amount_paid: parseFloat(amountPaid) || 0,
        is_settled: isSettled,
        needs_tailoring: needsTailoring || hasTailoringRows,
        ...(refEdited && customRef.trim() ? { custom_ref: customRef.trim() } : {}),
      });

      setLastBillRef(res.data.ref);
      setLastBillTotal(res.data.grand_total);
      setShowPostSave(true);
      setMessage(null);
      invalidate("dashboard");
      invalidate("daybook");
      invalidateCustomersCache();
      getCustomers().then(res => setConfig(p => ({ ...p, customers: res.data || [] }))).catch(() => {});
      resetFormFields();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Failed to save bill" });
    } finally {
      setSaving(false);
    }
  };

  const enterNav = (e, nextRef) => {
    if (e.key === "Enter") { e.preventDefault(); nextRef?.current?.focus(); }
  };

  const openTailoringConfig = () => {
    if (!items.length) {
      setMessage({ type: "error", text: "Add at least one article first" });
      return;
    }
    setShowTailoringModal(true);
  };

  const openAddonConfig = () => {
    if (!items.length) {
      setMessage({ type: "error", text: "Add at least one article first" });
      return;
    }
    setShowAddonModal(true);
  };

  const resetFormFields = () => {
    setItems([]);
    setCustomerName("");
    setOrderDate(today);
    setPayDate(today);
    setAmountPaid("");
    setSelectedModes([]);
    setIsSettled(false);
    setNeedsTailoring(false);
    setShowTailoringModal(false);
    setShowAddonModal(false);
    setRefEdited(false);
    setCustomRef("");
    resetItemForm();
  };

  const createAnotherBill = () => {
    setShowPostSave(false);
    setLastBillRef(null);
    setLastBillTotal(0);
    resetFormFields();
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  // Step indicator: 0=customer, 1=items, 2=payment
  const billStep = customerName.trim() === "" ? 0 : items.length === 0 ? 1 : 2;

  return (
    <div data-testid="new-bill-page" className="space-y-6 pb-24 lg:pb-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">New Bill</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Create a new fabric sale entry</p>
      </div>

      {/* Mobile step indicator */}
      {!showPostSave && (
        <div className="lg:hidden flex items-stretch bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm overflow-hidden">
          {[
            { label: "Customer", icon: User },
            { label: "Items",    icon: ShoppingCart },
            { label: "Payment", icon: CreditCard },
          ].map(({ label, icon: Icon }, idx) => (
            <div key={label} className="contents">
              <div className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                idx === billStep
                  ? "bg-[var(--brand)] text-white"
                  : idx < billStep
                  ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "text-[var(--text-secondary)]"
              }`}>
                <Icon size={13} weight={idx <= billStep ? "fill" : "regular"} />
                {label}
              </div>
              {idx < 2 && (
                <span className="flex items-center justify-center w-4 flex-shrink-0 text-[10px] text-[var(--border-strong)] bg-[var(--bg)] border-x border-[var(--border-subtle)]">›</span>
              )}
            </div>
          ))}
        </div>
      )}

      {message && !showPostSave && (
        <div data-testid="bill-message" className={`p-4 border rounded-sm text-sm ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          <span>{message.text}</span>
        </div>
      )}

      {showPostSave && lastBillRef && (
        <BillSuccessPanel
          billRef={lastBillRef}
          total={lastBillTotal}
          onViewInvoice={() => setShowInvoice(true)}
          onPrint={() => window.open(getInvoiceUrl(lastBillRef), '_blank')}
          onCreateAnother={createAnotherBill}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer & Items */}
        <div className="lg:col-span-2 bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
          <h3 className="font-heading text-base font-medium">Customer Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1 col-span-1">
              <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Customer Name</label>
              <div ref={nameWrapRef} className="relative">
                <input ref={nameRef} data-testid="customer-name-input" value={customerName}
                  onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); }}
                  onFocus={e => { if (e.target.value.trim()) setShowSuggestions(true); }}
                  onKeyDown={e => { if (e.key === 'Escape') setShowSuggestions(false); else enterNav(e, dateRef); }}
                  maxLength={100} autoComplete="off"
                  className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]" placeholder="Customer name" />
                {showSuggestions && nameSuggestions.length > 0 && (
                  <ul className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm shadow-lg max-h-48 overflow-y-auto">
                    {nameSuggestions.map(c => (
                      <li key={c}
                        onMouseDown={e => { e.preventDefault(); setCustomerName(c); setShowSuggestions(false); setTimeout(() => dateRef.current?.focus(), 50); }}
                        onTouchEnd={e => { e.preventDefault(); setCustomerName(c); setShowSuggestions(false); setTimeout(() => dateRef.current?.focus(), 50); }}
                        className="px-3 py-2 text-sm cursor-pointer hover:bg-[var(--bg)] active:bg-[var(--bg)]">
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Order Date</label>
              <DatePickerInput 
                ref={dateRef}
                data-testid="order-date-input"
                value={orderDate} 
                onChange={setOrderDate} 
                onKeyDown={e => enterNav(e, barcodeRef)}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">
                Bill Ref
                {refEdited && customRef !== refPreview && (
                  <button onClick={() => { setCustomRef(refPreview); setRefEdited(false); }} className="ml-2 text-[9px] text-[var(--brand)] hover:underline normal-case tracking-normal font-normal">reset</button>
                )}
              </label>
              <input
                data-testid="bill-ref-input"
                value={customRef}
                onChange={e => { setCustomRef(e.target.value); setRefEdited(true); }}
                placeholder={refPreview || "Auto"}
                className={`w-full px-3 py-2 text-sm font-mono border rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] ${
                  refEdited && customRef !== refPreview
                    ? 'border-[var(--warning)] bg-[#D4984210]'
                    : 'border-[var(--border-subtle)]'
                }`}
              />
            </div>
          </div>

          <h3 className="font-heading text-base font-medium pt-2">Add Items</h3>
          <ItemInputForm
            barcode={barcode}
            qty={qty}
            price={price}
            discount={discount}
            editingIndex={editingIndex}
            refs={{ barcodeRef, qtyRef, priceRef, discountRef }}
            onChange={(field, val) => {
              if (field === 'barcode') setBarcode(val);
              else if (field === 'qty') setQty(val);
              else if (field === 'price') setPrice(val);
              else if (field === 'discount') setDiscount(val);
            }}
            onAdd={addItem}
            onOpenScanner={() => setShowScanner(true)}
            onKeyNav={(e, nextRef) => enterNav(e, nextRef)}
          />

          {editingIndex !== null && (
            <div className="flex justify-end">
              <button onClick={resetItemForm} className="text-xs px-2.5 py-1.5 border border-[var(--border-subtle)] rounded-sm text-[var(--text-secondary)] hover:border-[var(--brand)]">Cancel Edit</button>
            </div>
          )}

          {showScanner && <BarcodeScanner onScan={(code) => { setBarcode(code); setShowScanner(false); setTimeout(() => qtyRef.current?.focus(), 100); }} onClose={() => setShowScanner(false)} />}

          {items.length > 0 && (
            <div className="space-y-2" data-testid="bill-items-list">
              {items.map((item, i) => (
                <BillLineItemRow
                  key={i}
                  item={item}
                  index={i}
                  isEditing={editingIndex === i}
                  onEdit={editItem}
                  onRemove={removeItem}
                  onOpenTailoring={(idx) => {
                    setEditingIndex(idx);
                    setShowTailoringModal(true);
                  }}
                  onOpenAddon={(idx) => {
                    setEditingIndex(idx);
                    setShowAddonModal(true);
                  }}
                />
              ))}
              <div className="flex justify-between items-center px-3 py-2 text-sm text-[var(--text-secondary)] border-t border-[var(--border-subtle)] bg-[var(--bg)] rounded-sm">
                <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
                <span className="font-mono font-semibold text-[var(--text-primary)]">
                  ₹{items.reduce((s, it) => s + it.total, 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Payment Panel */}
        <PaymentSummaryPanel
          grandTotal={grandTotal}
          amountPaid={amountPaid}
          selectedModes={selectedModes}
          isSettled={isSettled}
          needsTailoring={needsTailoring}
          payDate={payDate}
          paymentModes={paymentModes}
          canSubmit={items.length > 0}
          saving={saving}
          refs={{ amountRef, settledRef, saveBtnRef, payDateRef, tailoringRef }}
          onAmountPaidChange={setAmountPaid}
          onModeToggle={toggleMode}
          onSettledChange={setIsSettled}
          onNeedsTailoringChange={setNeedsTailoring}
          onPayDateChange={setPayDate}
          onSave={handleSave}
          onKeyNav={(e, nextRef) => enterNav(e, nextRef)}
        />
      </div>

      {/* Mobile sticky summary bar - visible only on small screens */}
      <div 
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border-subtle)] p-3 shadow-lg z-50"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
      >
        {/* Offline indicator */}
        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-[#9E473D10] border border-[var(--error)] rounded-sm text-[var(--error)] text-xs">
            <WifiSlash size={14} />
            <span>You're offline. Connect to save.</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Grand Total</p>
            <p className="font-heading text-xl font-semibold" style={{ color: "var(--brand)" }}>
              ₹{grandTotal.toLocaleString('en-IN')}
            </p>
            {items.length > 0 && (
              <p className="text-xs text-[var(--text-secondary)]">{items.length} item{items.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <button 
            onClick={handleSave} 
            disabled={saving || items.length === 0 || !isOnline} 
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50 whitespace-nowrap"
            title={!isOnline ? "You're offline. Connect to save." : ""}
          >
            {saving ? <Spinner size={16} className="animate-spin" /> : (
              <>
                {!isOnline && <WifiSlash size={16} weight="bold" />}
                <FloppyDisk size={16} weight="bold" /> 
                Save Bill
              </>
            )}
          </button>
        </div>
      </div>

      {showTailoringModal && (
        <TailoringModal
          items={items}
          setItems={setItems}
          customerName={customerName}
          articleTypes={articleTypes}
          onClose={() => setShowTailoringModal(false)}
        />
      )}

      {showInvoice && lastBillRef && (
        <InvoiceModal billRef={lastBillRef} onClose={() => setShowInvoice(false)} />
      )}

      {showAddonModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="addon-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddonModal(false); }}
        >
          <div className="w-full max-w-5xl bg-[var(--surface)] rounded-sm border border-[var(--border-subtle)] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <h3 id="addon-modal-title" className="font-heading text-base">Configure Add-ons for Current Bill ({customerName || 'No Customer'})</h3>
              <button onClick={() => setShowAddonModal(false)} className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg)] rounded-sm" aria-label="Close"><X size={16} /></button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {/* Mobile card view */}
              <div className="sm:hidden space-y-3">
                {items.map((item, idx) => (
                  <div key={`addon-mobile-${idx}`} className="bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{item.barcode}</span>
                        <span className="text-xs text-[var(--text-secondary)] ml-2">{item.qty}m</span>
                      </div>
                      <span className="text-sm font-mono">
                        ₹{(item.addon?.items || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0).toLocaleString()}
                      </span>
                    </div>
                    
                    {(item.addon?.items || []).length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)] italic">No add-ons configured</p>
                    ) : (
                      <div className="space-y-2">
                        {(item.addon?.items || []).map((addon, addonIdx) => (
                          <div key={addonIdx} className="flex items-center gap-2 bg-[var(--surface)] p-2 rounded-sm">
                            <select
                              value={addon.name}
                              onChange={e => updateAddonItem(idx, addonIdx, { name: e.target.value })}
                              className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm"
                            >
                              {addonItems.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                            <input
                              type="number"
                              inputMode="decimal"
                              pattern="[0-9]*"
                              value={addon.amount}
                              onChange={e => updateAddonItem(idx, addonIdx, { amount: e.target.value })}
                              className="w-20 px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm"
                              placeholder="₹"
                            />
                            <button
                              onClick={() => removeAddonItem(idx, addonIdx)}
                              className="p-1.5 text-[var(--error)] hover:bg-[var(--error)]/10 rounded-sm flex-shrink-0"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <button
                      onClick={() => addAddonItem(idx)}
                      className="w-full px-3 py-2 text-xs bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] flex items-center justify-center gap-1"
                    >
                      <Plus size={12} /> Add Add-on
                    </button>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden sm:block overflow-x-auto -mx-4 px-4">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="bg-[var(--bg)]">
                      <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Article</th>
                      <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Qty</th>
                      <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Add-ons</th>
                      <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Total</th>
                      <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Actions</th>
                    </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={`addon-${idx}`} className="border-b border-[var(--border-subtle)]">
                      <td className="px-2 py-2 text-sm font-medium">{item.barcode}</td>
                      <td className="px-2 py-2 text-sm">{item.qty}</td>
                      <td className="px-2 py-2">
                        {(item.addon?.items || []).length === 0 ? (
                          <span className="text-sm text-[var(--text-secondary)]">No add-ons</span>
                        ) : (
                          <div className="space-y-1">
                            {(item.addon?.items || []).map((addon, addonIdx) => (
                              <div key={addonIdx} className="flex items-center gap-2">
                                <select
                                  value={addon.name}
                                  onChange={e => updateAddonItem(idx, addonIdx, { name: e.target.value })}
                                  className="px-2 py-1 text-sm border border-[var(--border-subtle)] rounded-sm"
                                >
                                  {addonItems.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  pattern="[0-9]*"
                                  value={addon.amount}
                                  onChange={e => updateAddonItem(idx, addonIdx, { amount: e.target.value })}
                                  className="w-24 px-2 py-1 text-sm border border-[var(--border-subtle)] rounded-sm"
                                  placeholder="Amount"
                                />
                                <button
                                  onClick={() => removeAddonItem(idx, addonIdx)}
                                  className="p-1 text-[var(--error)] hover:bg-[var(--error)]/10 rounded-sm"
                                >
                                  <Trash size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-sm">
                        ₹{(item.addon?.items || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0).toLocaleString()}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => addAddonItem(idx)}
                          className="px-3 py-1.5 text-xs bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] flex items-center gap-1"
                        >
                          <Plus size={12} /> Add
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex justify-end">
              <button onClick={() => setShowAddonModal(false)} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Tailoring Modal Component with Split Functionality
function TailoringModal({ items, setItems, customerName, articleTypes, onClose }) {
  const [splitItem, setSplitItem] = useState(null);
  const [splitError, setSplitError] = useState(null);
  const trapRef = useFocusTrap(true);

  // Escape key handler for accessibility
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (splitItem) {
          setSplitItem(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, splitItem]);

  const updateItemTailoring = (index, patch) => {
    setItems(prev => prev.map((row, idx) => idx === index ? { ...row, tailoring: { ...(row.tailoring || {}), ...patch } } : row));
  };

  const handleSplit = (itemIdx) => {
    const item = items[itemIdx];
    if (item.qty <= 0) return;
    setSplitItem({
      itemIdx,
      originalQty: item.qty,
      originalTotal: item.total,
      originalPrice: item.price,
      originalDiscount: item.discount,
      // Pre-fill with 2 split parts, user can adjust
      splits: [
        { qty: (item.qty / 2).toFixed(2), article_type: articleTypes[0] || "Shirt" },
        { qty: (item.qty / 2).toFixed(2), article_type: articleTypes[0] || "Shirt" }
      ]
    });
  };

  const addSplitPart = () => {
    if (!splitItem) return;
    setSplitItem(prev => ({
      ...prev,
      splits: [...prev.splits, { qty: "0", article_type: articleTypes[0] || "Shirt" }]
    }));
  };

  const updateSplitPart = (idx, patch) => {
    if (!splitItem) return;
    setSplitItem(prev => ({
      ...prev,
      splits: prev.splits.map((s, i) => i === idx ? { ...s, ...patch } : s)
    }));
  };

  const removeSplitPart = (idx) => {
    if (!splitItem) return;
    setSplitItem(prev => ({ ...prev, splits: prev.splits.filter((_, i) => i !== idx) }));
  };

  const applySplit = () => {
    if (!splitItem) return;
    const totalSplitQty = splitItem.splits.reduce((sum, s) => sum + (parseFloat(s.qty) || 0), 0);
    if (Math.abs(totalSplitQty - splitItem.originalQty) > 0.01) {
      setSplitError(`Total split qty (${totalSplitQty.toFixed(2)}) must equal original qty (${splitItem.originalQty.toFixed(2)})`);
      return;
    }
    setSplitError(null);

    const originalItem = items[splitItem.itemIdx];
    const newItems = [...items];
    const totalQty = splitItem.originalQty;

    // Calculate proportional amounts for each split, remainder-correcting the last part
    let runningTotal = 0;
    const splitData = splitItem.splits.map((split, i) => {
      const isLast = i === splitItem.splits.length - 1;
      const ratio = (parseFloat(split.qty) || 0) / totalQty;
      const splitTotal = isLast
        ? originalItem.total - runningTotal
        : Math.round(originalItem.total * ratio);
      if (!isLast) runningTotal += splitTotal;
      return {
        ...split,
        ratio,
        total: splitTotal,
        price: originalItem.price,
        discount: originalItem.discount
      };
    });

    // Update original item with first split
    newItems[splitItem.itemIdx] = {
      ...originalItem,
      qty: parseFloat(splitData[0].qty),
      total: splitData[0].total,
      tailoring: {
        enabled: true,
        article_type: splitData[0].article_type,
        order_no: "",  // User fills this in main table
        delivery_date: "",  // User fills this in main table
        embroidery_status: "Not Required"
      }
    };

    // Add additional items for remaining splits
    for (let i = 1; i < splitData.length; i++) {
      newItems.splice(splitItem.itemIdx + i, 0, {
        ...originalItem,
        id: `${originalItem.barcode}_split_${i}_${Date.now()}`,
        qty: parseFloat(splitData[i].qty),
        total: splitData[i].total,
        tailoring: {
          enabled: true,
          article_type: splitData[i].article_type,
          order_no: "",  // User fills this in main table
          delivery_date: "",  // User fills this in main table
          embroidery_status: "Not Required"
        }
      });
    }

    setItems(newItems);
    setSplitItem(null);
  };

  if (splitItem) {
    const currentTotal = splitItem.splits.reduce((sum, s) => sum + (parseFloat(s.qty) || 0), 0);
    const isBalanced = Math.abs(currentTotal - splitItem.originalQty) < 0.01;
    return (
      <div 
        className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="split-dialog-title"
        onClick={(e) => { if (e.target === e.currentTarget) setSplitItem(null); }}
      >
        <div className="w-full max-w-2xl bg-[var(--surface)] rounded-sm border border-[var(--border-subtle)] shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div>
              <h3 id="split-dialog-title" className="font-heading text-base">Split Article: {items[splitItem.itemIdx]?.barcode}</h3>
              <p className="text-xs text-[var(--text-secondary)]">Original Qty: {splitItem.originalQty} | Original Amount: ₹{splitItem.originalTotal?.toLocaleString()}</p>
            </div>
            <button onClick={() => setSplitItem(null)} className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg)] rounded-sm" aria-label="Close"><X size={16} /></button>
          </div>
          <div className="p-4 max-h-[60vh] overflow-auto">
            <div className="space-y-3">
              {splitItem.splits.map((split, idx) => {
                const ratio = splitItem.originalQty > 0 ? (parseFloat(split.qty) || 0) / splitItem.originalQty : 0;
                const splitAmount = Math.round((splitItem.originalTotal || 0) * ratio);
                return (
                  <div key={idx} className="flex items-center gap-3 p-3 border border-[var(--border-subtle)] rounded-sm bg-[var(--bg)]">
                    <div className="w-24">
                      <label className="text-xs text-[var(--text-secondary)] block mb-1">Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={split.qty}
                        onChange={e => updateSplitPart(idx, { qty: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-[var(--text-secondary)] block mb-1">Article Type</label>
                      <select
                        value={split.article_type}
                        onChange={e => updateSplitPart(idx, { article_type: e.target.value })}
                        className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm"
                      >
                        {articleTypes.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div className="w-28 text-right">
                      <label className="text-xs text-[var(--text-secondary)] block mb-1">Amount</label>
                      <span className="text-sm font-medium">₹{splitAmount.toLocaleString()}</span>
                    </div>
                    <button
                      onClick={() => removeSplitPart(idx)}
                      disabled={splitItem.splits.length <= 1}
                      className="mt-4 p-1.5 text-[var(--error)] hover:bg-[var(--error)]/10 rounded-sm disabled:opacity-30"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={addSplitPart}
              className="mt-3 px-3 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] flex items-center gap-1"
            >
              <Plus size={12} /> Add Split Part
            </button>
            <div className={`mt-3 text-sm ${isBalanced ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
              Split Total: {currentTotal.toFixed(2)} / {splitItem.originalQty} 
              {!isBalanced && ' (Must equal original quantity)'}
            </div>
          </div>
          {splitError && (
            <div className="mx-4 mb-0 mt-2 px-3 py-2 text-xs text-[var(--error)] bg-[#9E473D10] border border-[var(--error)] rounded-sm">{splitError}</div>
          )}
          <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex justify-between">
            <button onClick={() => { setSplitItem(null); setSplitError(null); }} className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)]">Cancel</button>
            <button 
              onClick={applySplit} 
              disabled={!isBalanced}
              className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50"
            >
              Apply Split
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tailoring-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={trapRef} className="w-full max-w-5xl bg-[var(--surface)] rounded-sm border border-[var(--border-subtle)] shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 id="tailoring-modal-title" className="font-heading text-base">Configure Tailoring for Current Bill ({customerName || 'No Customer'})</h3>
          <button onClick={onClose} className="p-1 text-[var(--text-secondary)] hover:bg-[var(--bg)] rounded-sm" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="p-4 overflow-auto flex-1">
          {/* Mobile card view - visible only on small screens */}
          <div className="sm:hidden space-y-3">
            {items.map((item, idx) => (
              <div key={`tail-mobile-${idx}`} className="bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm p-3 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={!!item.tailoring?.enabled} 
                      onChange={e => updateItemTailoring(idx, { enabled: e.target.checked })} 
                      className="accent-[var(--brand)]"
                    />
                    <span className="text-sm font-medium">{item.barcode}</span>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">{item.qty}m</span>
                </div>
                
                {item.tailoring?.enabled && (
                  <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">Order No</label>
                        <input 
                          value={item.tailoring?.order_no || ""} 
                          onChange={e => updateItemTailoring(idx, { order_no: e.target.value })} 
                          maxLength={30} 
                          className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm"
                          placeholder="TL-2025-XXX"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">Delivery</label>
                        <DatePickerInput 
                          value={item.tailoring?.delivery_date || ""} 
                          onChange={(val) => updateItemTailoring(idx, { delivery_date: val })} 
                          placeholder="Select date"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">Type</label>
                        <select 
                          value={item.tailoring?.article_type || (articleTypes[0] || "Shirt")} 
                          onChange={e => updateItemTailoring(idx, { article_type: e.target.value })} 
                          className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)]"
                        >
                          {articleTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">Embroidery</label>
                        <select 
                          value={item.tailoring?.embroidery_status || "Not Required"} 
                          onChange={e => updateItemTailoring(idx, { embroidery_status: e.target.value })} 
                          className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)]"
                        >
                          <option value="Not Required">Not Required</option>
                          <option value="Required">Required</option>
                        </select>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleSplit(idx)}
                      disabled={item.qty <= 0}
                      className="w-full px-3 py-2 text-xs border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] disabled:opacity-30 flex items-center justify-center gap-1"
                      title="Split this article into multiple tailoring orders"
                    >
                      <ArrowsSplit size={12} /> Split Article
                    </button>
                  </div>
                )}
                
                {!item.tailoring?.enabled && (
                  <p className="text-xs text-[var(--text-secondary)] italic">Enable tailoring to configure</p>
                )}
              </div>
            ))}
          </div>
          
          {/* Desktop table view - hidden on mobile */}
          <div className="hidden sm:block overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[var(--bg)]">
                  <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Apply</th>
                  <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Article</th>
                  <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Qty</th>
                  <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Order No</th>
                  <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Delivery</th>
                  <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Article Type</th>
                  <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Embroidery</th>
                  <th className="text-left px-2 py-2 text-xs uppercase tracking-[0.1em]">Actions</th>
                </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={`tail-${idx}`} className="border-b border-[var(--border-subtle)]">
                  <td className="px-2 py-2"><input type="checkbox" checked={!!item.tailoring?.enabled} onChange={e => updateItemTailoring(idx, { enabled: e.target.checked })} /></td>
                  <td className="px-2 py-2 text-sm">{item.barcode}</td>
                  <td className="px-2 py-2 text-sm">{item.qty}</td>
                  <td className="px-2 py-2"><input value={item.tailoring?.order_no || ""} onChange={e => updateItemTailoring(idx, { order_no: e.target.value })} disabled={!item.tailoring?.enabled} maxLength={30} className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm disabled:opacity-50" /></td>
                  <td className="px-2 py-2">
                        <DatePickerInput 
                          value={item.tailoring?.delivery_date || ""} 
                          onChange={(val) => updateItemTailoring(idx, { delivery_date: val })} 
                          disabled={!item.tailoring?.enabled}
                          placeholder="Select date"
                        />
                      </td>
                  <td className="px-2 py-2">
                    <select value={item.tailoring?.article_type || (articleTypes[0] || "Shirt")} onChange={e => updateItemTailoring(idx, { article_type: e.target.value })} disabled={!item.tailoring?.enabled} className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm disabled:opacity-50">
                      {articleTypes.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select value={item.tailoring?.embroidery_status || "Not Required"} onChange={e => updateItemTailoring(idx, { embroidery_status: e.target.value })} disabled={!item.tailoring?.enabled} className="w-full px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm disabled:opacity-50">
                      <option value="Not Required">Not Required</option>
                      <option value="Required">Required</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => handleSplit(idx)}
                      disabled={item.qty <= 0 || !item.tailoring?.enabled}
                      className="px-2 py-1 text-xs border border-[var(--border-subtle)] rounded-sm hover:border-[var(--brand)] disabled:opacity-30 flex items-center gap-1"
                      title="Split this article into multiple tailoring orders"
                    >
                      <ArrowsSplit size={12} /> Split
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border-subtle)] flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]">Done</button>
        </div>
      </div>
    </div>
  );
}
