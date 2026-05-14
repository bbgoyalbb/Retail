import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { createBill, getCustomers, getInvoiceUrl, getSettings, invalidateCustomersCache, getNextBillRef } from "@/api";
import { invalidate } from "@/lib/dataEvents";
import { 
  Plus, FloppyDisk, Spinner, WifiSlash, ArrowsSplit, User, 
  ShoppingCart, CreditCard, X, Trash, Receipt, Calendar, ArrowRight, CheckCircle 
} from "@phosphor-icons/react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { DatePickerInput } from "@/components/DatePickerInput";
import BarcodeScanner from "@/components/BarcodeScanner";
import InvoiceModal from "@/components/InvoiceModal";
import { BillLineItemRow, ItemInputForm, PaymentSummaryPanel, BillSuccessPanel } from "@/components/bill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewBill() {
  const navigate = useNavigate();
  const { toast } = useToast();
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
        .catch((err) => {
          toast({ title: "Error", description: err.message || "Failed to get next bill reference", variant: "destructive" });
        });
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderDate, toast]);

  useEffect(() => {
    getCustomers()
      .then(res => setConfig(p => ({ ...p, customers: res.data || [] })))
      .catch((err) => {
        toast({ title: "Error", description: err.message || "Failed to load customers", variant: "destructive" });
      });
    getSettings()
      .then(res => {
        const s = res.data || {};
        setConfig(p => ({
          ...p,
          ...(Array.isArray(s.article_types) && s.article_types.length > 0 ? { articleTypes: s.article_types } : {}),
          ...(Array.isArray(s.addon_items)    && s.addon_items.length > 0    ? { addonItems: s.addon_items }       : {}),
          ...(Array.isArray(s.payment_modes)  && s.payment_modes.length > 0  ? { paymentModes: s.payment_modes }   : {}),
        }));
      })
      .catch((err) => {
        toast({ title: "Error", description: err.message || "Failed to load settings", variant: "destructive" });
      });
  }, [toast]);

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
      toast({ title: "Validation Error", description: "Please enter customer name and at least one item", variant: "destructive" });
      return;
    }
    if (parseFloat(amountPaid) > 0 && selectedModes.length === 0) {
      toast({ title: "Validation Error", description: "Please select a payment mode when entering an amount paid", variant: "destructive" });
      return;
    }
    if (isSettled && selectedModes.length === 0) {
      toast({ title: "Validation Error", description: "Please select at least one payment mode when settling", variant: "destructive" });
      return;
    }
    if (!validateTailoringRows()) {
      toast({ title: "Validation Error", description: "Please complete all tailoring details (Order #, Delivery Date)", variant: "destructive" });
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
      toast({ title: "Success", description: `Invoice ${res.data.ref} created successfully` });
      invalidate("dashboard");
      invalidate("daybook");
      invalidateCustomersCache();
      getCustomers().then(res => setConfig(p => ({ ...p, customers: res.data || [] }))).catch(() => {});
      resetFormFields();
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.detail || "Failed to save bill", variant: "destructive" });
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
    window.dispatchEvent(new CustomEvent("modal:open"));
    setShowTailoringModal(true);
  };

  const openAddonConfig = () => {
    if (!items.length) {
      setMessage({ type: "error", text: "Add at least one article first" });
      return;
    }
    window.dispatchEvent(new CustomEvent("modal:open"));
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
    <div data-testid="new-bill-page" className="space-y-8 pb-32 lg:pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary truncate">Checkout</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium truncate">Generate digital invoice and record inventory exit</p>
        </div>
        {!isOnline && (
          <Badge variant="destructive" className="animate-pulse px-4 py-1 font-black uppercase tracking-widest gap-2">
            <WifiSlash size={16} weight="bold" /> Offline Mode
          </Badge>
        )}
      </div>

      {/* Mobile step indicator */}
      {!showPostSave && (
        <div className="lg:hidden flex items-stretch bg-card border border-muted-foreground/10 rounded-xl overflow-hidden shadow-sm">
          {[
            { label: "Customer", icon: User },
            { label: "Inventory", icon: ShoppingCart },
            { label: "Settlement", icon: CreditCard },
          ].map(({ label, icon: Icon }, idx) => (
            <div key={label} className="contents">
              <div className={`flex-1 flex flex-col items-center justify-center gap-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                idx === billStep
                  ? "bg-primary text-white"
                  : idx < billStep
                  ? "bg-success/10 text-success"
                  : "bg-muted/50 text-muted-foreground"
              }`}>
                <Icon size={20} weight={idx <= billStep ? "fill" : "duotone"} />
                <span>{label}</span>
              </div>
              {idx < 2 && <div className="w-px bg-muted-foreground/10" />}
            </div>
          ))}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Customer & Items */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-lg border-muted-foreground/10 overflow-hidden">
            <CardHeader className="bg-muted/20 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User size={20} className="text-primary" weight="duotone" />
                </div>
                <CardTitle className="text-lg font-black uppercase tracking-tight">Client Intelligence</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="sm:col-span-1 col-span-1 space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground block ml-1">Customer Entity</label>
                  <div ref={nameWrapRef} className="relative group">
                    <Input 
                      ref={nameRef} 
                      data-testid="customer-name-input" 
                      value={customerName}
                      onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); }}
                      onFocus={e => { if (e.target.value.trim()) setShowSuggestions(true); }}
                      onKeyDown={e => { if (e.key === 'Escape') setShowSuggestions(false); else enterNav(e, dateRef); }}
                      maxLength={100} 
                      autoComplete="off"
                      className="h-11 font-bold focus:border-primary border-2" 
                      placeholder="Name or ID..." 
                    />
                    {showSuggestions && nameSuggestions.length > 0 && (
                      <Card className="absolute z-50 left-0 right-0 top-full mt-2 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="max-h-64 overflow-y-auto p-1">
                          {nameSuggestions.map(c => (
                            <div key={c}
                              onMouseDown={e => { e.preventDefault(); setCustomerName(c); setShowSuggestions(false); setTimeout(() => dateRef.current?.focus(), 50); }}
                              className="px-4 py-3 text-sm font-bold cursor-pointer hover:bg-primary/5 rounded-md transition-colors flex items-center justify-between group/item">
                              {c}
                              <ArrowRight size={14} className="opacity-0 group-hover/item:opacity-100 transition-opacity text-primary" />
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground block ml-1">Order Date</label>
                  <DatePickerInput 
                    ref={dateRef}
                    data-testid="order-date-input"
                    value={orderDate} 
                    onChange={setOrderDate} 
                    onKeyDown={e => enterNav(e, barcodeRef)}
                    className="h-11 font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground block ml-1">
                    Invoice Reference
                    {refEdited && customRef !== refPreview && (
                      <Badge variant="warning" onClick={() => { setCustomRef(refPreview); setRefEdited(false); }} className="ml-2 text-[8px] cursor-pointer hover:scale-105 transition-transform">RESET</Badge>
                    )}
                  </label>
                  <Input
                    data-testid="bill-ref-input"
                    value={customRef}
                    onChange={e => { setCustomRef(e.target.value); setRefEdited(true); }}
                    placeholder={refPreview || "Auto-generating..."}
                    className={`h-11 font-mono font-black tracking-wider ${
                      refEdited && customRef !== refPreview
                        ? 'border-warning bg-warning/[0.03] text-warning'
                        : 'border-2'
                    }`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-muted-foreground/10 overflow-hidden">
            <CardHeader className="bg-muted/20 pb-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <ShoppingCart size={20} className="text-primary" weight="duotone" />
                  </div>
                  <CardTitle className="text-lg font-black uppercase tracking-tight">Inventory Exit</CardTitle>
                </div>
                {items.length > 0 && <Badge variant="info" className="font-black px-3 py-1 uppercase tracking-widest">{items.length} Articles</Badge>}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-6 sm:p-8 bg-muted/[0.02]">
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
                  <div className="flex justify-end mt-4">
                    <Button variant="ghost" size="sm" onClick={resetItemForm} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive">
                      Discard Changes <X size={12} weight="bold" className="ml-2" />
                    </Button>
                  </div>
                )}
              </div>

              {showScanner && <BarcodeScanner onScan={(code) => { setBarcode(code); setShowScanner(false); setTimeout(() => qtyRef.current?.focus(), 100); }} onClose={() => setShowScanner(false)} />}

              {items.length > 0 && (
                <div className="border-t border-muted-foreground/10 bg-background" data-testid="bill-items-list">
                  <div className="divide-y divide-muted/50 max-h-[400px] overflow-y-auto p-4 sm:p-6 space-y-4">
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
                  </div>
                  <div className="flex justify-between items-center px-8 py-5 text-sm bg-muted/20 border-t">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Cart Valuation</span>
                    <span className="font-mono text-xl font-black text-primary tracking-tighter">
                      ₹{items.reduce((s, it) => s + it.total, 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment Panel */}
        <div className="lg:sticky lg:top-24 h-fit">
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
      </div>

      {/* Mobile sticky summary bar - visible only on small screens */}
      <div 
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-muted-foreground/10 p-4 shadow-2xl z-50 animate-in slide-in-from-bottom-full duration-500"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
      >
        <div className="flex items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Total Valuation</p>
            <p className="font-heading text-2xl font-black text-primary tracking-tighter">
              ₹{grandTotal.toLocaleString('en-IN')}
            </p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={saving || items.length === 0 || !isOnline} 
            size="lg"
            className="h-14 px-8 text-base font-black uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all gap-3"
          >
            {saving ? <Spinner size={20} className="animate-spin" /> : (
              <>
                {!isOnline && <WifiSlash size={20} weight="bold" />}
                <FloppyDisk size={20} weight="bold" /> 
                Save Bill
              </>
            )}
          </Button>
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

      {/* Add-on Modal */}
      {showAddonModal && (
        <div 
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddonModal(false); }}
        >
          <Card className="w-full max-w-5xl border-none shadow-2xl shadow-black/40 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
            <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-success/10 text-success">
                  <Plus size={20} weight="duotone" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-widest">Article Add-ons</CardTitle>
                  <p className="text-xs text-muted-foreground font-medium">Extra charges for embroidery, buttons, etc.</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAddonModal(false)} className="rounded-full">
                <X size={20} />
              </Button>
            </CardHeader>
            
            <CardContent className="p-0 overflow-auto flex-1 custom-scrollbar">
              {/* Mobile View */}
              <div className="sm:hidden p-4 space-y-4">
                {items.map((item, idx) => (
                  <Card key={`addon-mob-${idx}`} className={cn(
                    "border-border/50 shadow-none overflow-hidden",
                    (item.addon?.items?.length > 0) ? "bg-success/[0.02] border-success/20" : "bg-muted/10"
                  )}>
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-black text-primary">#{item.barcode}</span>
                        <Badge variant="outline" className="font-mono text-[10px] font-black">{item.qty}m</Badge>
                      </div>

                      <div className="space-y-3">
                        {(item.addon?.items || []).map((addon, addonIdx) => (
                          <div key={addonIdx} className="flex items-center gap-2 p-2 bg-background border border-border/50 rounded-xl shadow-sm">
                            <select
                              value={addon.name}
                              onChange={e => updateAddonItem(idx, addonIdx, { name: e.target.value })}
                              className="flex-1 h-9 px-3 text-xs font-bold bg-transparent outline-none cursor-pointer"
                            >
                              {addonItems.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                            <div className="relative w-24">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground">₹</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                value={addon.amount}
                                onChange={e => updateAddonItem(idx, addonIdx, { amount: e.target.value })}
                                className="w-full h-9 pl-6 pr-3 text-xs font-mono font-black border-none bg-muted/20 rounded-lg focus:ring-1 focus:ring-success/30 transition-all outline-none"
                                placeholder="0"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeAddonItem(idx, addonIdx)}
                              className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-lg"
                            >
                              <Trash size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addAddonItem(idx)}
                        className="w-full h-10 font-black uppercase tracking-widest text-[10px] border-dashed border-2 hover:border-success/50 hover:bg-success/5 hover:text-success gap-2 rounded-xl transition-all"
                      >
                        <Plus size={14} weight="bold" /> Add Add-on
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop View */}
              <div className="hidden sm:block">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/50">
                      <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Article</th>
                      <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Qty</th>
                      <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Extra Add-ons</th>
                      <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Extra</th>
                      <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {items.map((item, idx) => (
                      <tr key={`addon-row-${idx}`} className="group hover:bg-success/[0.01] transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-black text-primary">#{item.barcode}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-foreground">{item.qty}m</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {(item.addon?.items || []).map((addon, addonIdx) => (
                              <div key={addonIdx} className="flex items-center gap-2 p-1 bg-background border border-border/50 rounded-xl shadow-sm animate-in fade-in zoom-in-95">
                                <select
                                  value={addon.name}
                                  onChange={e => updateAddonItem(idx, addonIdx, { name: e.target.value })}
                                  className="h-8 pl-3 pr-1 text-xs font-bold bg-transparent outline-none cursor-pointer hover:text-success transition-colors"
                                >
                                  {addonItems.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                                <div className="relative w-24">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground opacity-40">₹</span>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    value={addon.amount}
                                    onChange={e => updateAddonItem(idx, addonIdx, { amount: e.target.value })}
                                    className="w-full h-8 pl-6 pr-2 text-xs font-mono font-black border-none bg-muted/20 rounded-lg focus:ring-1 focus:ring-success/30 transition-all outline-none"
                                    placeholder="0"
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeAddonItem(idx, addonIdx)}
                                  className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                                >
                                  <Trash size={14} />
                                </Button>
                              </div>
                            ))}
                            {(item.addon?.items || []).length === 0 && (
                              <span className="text-xs text-muted-foreground/40 font-bold uppercase tracking-widest italic py-2">No extra charges</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-mono text-sm font-black text-success tracking-tighter">
                            ₹{(item.addon?.items || []).reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addAddonItem(idx)}
                            className="h-9 px-4 font-black uppercase tracking-widest text-[10px] border-dashed border-2 hover:border-success/50 hover:bg-success/5 hover:text-success gap-2 rounded-xl transition-all"
                          >
                            <Plus size={14} weight="bold" /> Add
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
            
            <CardFooter className="border-t border-border/50 bg-muted/20 px-6 py-4 flex justify-end gap-3">
              <Button onClick={() => setShowAddonModal(false)} className="h-10 px-8 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-primary/20">
                Finalize Add-ons
              </Button>
            </CardFooter>
          </Card>
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (splitItem) setSplitItem(null);
        else onClose();
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

    newItems[splitItem.itemIdx] = {
      ...originalItem,
      qty: parseFloat(splitData[0].qty),
      total: splitData[0].total,
      tailoring: {
        enabled: true,
        article_type: splitData[0].article_type,
        order_no: "",
        delivery_date: "",
        embroidery_status: "Not Required"
      }
    };

    for (let i = 1; i < splitData.length; i++) {
      newItems.splice(splitItem.itemIdx + i, 0, {
        ...originalItem,
        id: `${originalItem.barcode}_split_${i}_${Date.now()}`,
        qty: parseFloat(splitData[i].qty),
        total: splitData[i].total,
        tailoring: {
          enabled: true,
          article_type: splitData[i].article_type,
          order_no: "",
          delivery_date: "",
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
        className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300"
        onClick={(e) => { if (e.target === e.currentTarget) setSplitItem(null); }}
      >
        <Card className="w-full max-w-2xl border-none shadow-2xl animate-in zoom-in-95 duration-300">
          <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-widest">Split Article: #{items[splitItem.itemIdx]?.barcode}</CardTitle>
              <div className="flex items-center gap-4 mt-1">
                <Badge variant="outline" className="font-mono text-[10px] font-black">Qty: {splitItem.originalQty}</Badge>
                <Badge variant="outline" className="font-mono text-[10px] font-black">Amount: ₹{splitItem.originalTotal?.toLocaleString()}</Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSplitItem(null)} className="rounded-full">
              <X size={20} />
            </Button>
          </CardHeader>
          
          <CardContent className="p-6 max-h-[60vh] overflow-auto custom-scrollbar">
            <div className="space-y-4">
              {splitItem.splits.map((split, idx) => {
                const ratio = splitItem.originalQty > 0 ? (parseFloat(split.qty) || 0) / splitItem.originalQty : 0;
                const splitAmount = Math.round((splitItem.originalTotal || 0) * ratio);
                return (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-muted/30 border border-border/50 rounded-2xl animate-in fade-in slide-in-from-left-2 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="w-24 space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        value={split.qty}
                        onChange={e => updateSplitPart(idx, { qty: e.target.value })}
                        className="w-full h-10 px-3 text-sm font-mono font-black bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Type</label>
                      <select
                        value={split.article_type}
                        onChange={e => updateSplitPart(idx, { article_type: e.target.value })}
                        className="w-full h-10 px-3 text-sm font-bold bg-background border border-border/50 rounded-xl outline-none cursor-pointer"
                      >
                        {articleTypes.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div className="w-28 text-right space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount</label>
                      <p className="font-mono text-base font-black tracking-tighter">₹{splitAmount.toLocaleString()}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={splitItem.splits.length <= 1}
                      onClick={() => removeSplitPart(idx)}
                      className="mt-5 h-10 w-10 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                    >
                      <Trash size={18} />
                    </Button>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={addSplitPart}
                className="font-black uppercase tracking-widest text-[10px] border-dashed border-2 rounded-xl gap-2 h-10"
              >
                <Plus size={14} weight="bold" /> Add Split Part
              </Button>
              <div className={cn(
                "px-4 py-2 rounded-xl font-mono text-xs font-black tracking-widest uppercase",
                isBalanced ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive animate-pulse"
              )}>
                {currentTotal.toFixed(2)} / {splitItem.originalQty} {isBalanced ? '✓' : '⚠️'}
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="border-t border-border/50 bg-muted/20 px-6 py-4 flex justify-between gap-3">
            <Button variant="ghost" onClick={() => { setSplitItem(null); setSplitError(null); }} className="h-10 px-6 font-black uppercase tracking-widest text-[10px] rounded-xl">
              Cancel
            </Button>
            <Button 
              onClick={applySplit} 
              disabled={!isBalanced}
              className="h-10 px-8 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-primary/20"
            >
              Apply Split Logic
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Card ref={trapRef} className="w-full max-w-6xl border-none shadow-2xl shadow-black/40 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300">
        <CardHeader className="border-b border-border/50 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-info/10 text-info">
              <Scissors size={20} weight="duotone" />
            </div>
            <div>
              <CardTitle className="text-lg font-black uppercase tracking-widest">Tailoring Configuration</CardTitle>
              <p className="text-xs text-muted-foreground font-medium">Customer: <span className="text-foreground font-bold">{customerName || 'Standard Partner'}</span></p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X size={20} />
          </Button>
        </CardHeader>
        
        <CardContent className="p-0 overflow-auto flex-1 custom-scrollbar">
          {/* Mobile View */}
          <div className="sm:hidden p-4 space-y-4">
            {items.map((item, idx) => (
              <Card key={`tail-mob-${idx}`} className={cn(
                "border-border/50 shadow-none overflow-hidden",
                item.tailoring?.enabled ? "bg-info/[0.02] border-info/20" : "bg-muted/10"
              )}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        checked={!!item.tailoring?.enabled} 
                        onChange={e => updateItemTailoring(idx, { enabled: e.target.checked })} 
                        className="w-5 h-5 rounded-md border-border/50 accent-info transition-all cursor-pointer"
                      />
                      <span className="font-mono text-sm font-black text-primary">#{item.barcode}</span>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] font-black">{item.qty}m</Badge>
                  </div>
                  
                  {item.tailoring?.enabled && (
                    <div className="space-y-4 pt-4 border-t border-border/30 animate-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Order #</label>
                          <input 
                            value={item.tailoring?.order_no || ""} 
                            onChange={e => updateItemTailoring(idx, { order_no: e.target.value })} 
                            className="w-full h-10 px-3 text-sm font-mono font-black bg-background border border-border/50 rounded-xl outline-none focus:ring-2 focus:ring-info/20 transition-all"
                            placeholder="TL-XXX"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Delivery</label>
                          <DatePickerInput 
                            value={item.tailoring?.delivery_date || ""} 
                            onChange={(val) => updateItemTailoring(idx, { delivery_date: val })} 
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Type</label>
                          <select 
                            value={item.tailoring?.article_type || (articleTypes[0] || "Shirt")} 
                            onChange={e => updateItemTailoring(idx, { article_type: e.target.value })} 
                            className="w-full h-10 px-3 text-sm font-bold bg-background border border-border/50 rounded-xl outline-none"
                          >
                            {articleTypes.map(type => <option key={type} value={type}>{type}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Embroidery</label>
                          <select 
                            value={item.tailoring?.embroidery_status || "Not Required"} 
                            onChange={e => updateItemTailoring(idx, { embroidery_status: e.target.value })} 
                            className="w-full h-10 px-3 text-sm font-bold bg-background border border-border/50 rounded-xl outline-none"
                          >
                            <option value="Not Required">None</option>
                            <option value="Required">Required</option>
                          </select>
                        </div>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSplit(idx)}
                        disabled={item.qty <= 0}
                        className="w-full h-10 font-black uppercase tracking-widest text-[10px] border-dashed border-2 rounded-xl gap-2 hover:bg-info/5 hover:text-info hover:border-info/30"
                      >
                        <ArrowsSplit size={14} weight="bold" /> Split Article
                      </Button>
                    </div>
                  )}
                  
                  {!item.tailoring?.enabled && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-center py-2 italic">Tailoring not enabled</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Desktop View */}
          <div className="hidden sm:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                  <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-16">Apply</th>
                  <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Article</th>
                  <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-20">Qty</th>
                  <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-40">Order No</th>
                  <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-48">Delivery</th>
                  <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-44">Type</th>
                  <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground w-40">Embroidery</th>
                  <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {items.map((item, idx) => (
                  <tr key={`tail-row-${idx}`} className={cn(
                    "group transition-colors",
                    item.tailoring?.enabled ? "bg-info/[0.01]" : "opacity-60"
                  )}>
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        checked={!!item.tailoring?.enabled} 
                        onChange={e => updateItemTailoring(idx, { enabled: e.target.checked })} 
                        className="w-5 h-5 rounded-md border-border/50 accent-info transition-all cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-mono text-sm font-black text-primary">#{item.barcode}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-bold text-foreground">{item.qty}m</span>
                    </td>
                    <td className="px-4 py-4">
                      <input 
                        value={item.tailoring?.order_no || ""} 
                        onChange={e => updateItemTailoring(idx, { order_no: e.target.value })} 
                        disabled={!item.tailoring?.enabled} 
                        className="w-full h-10 px-3 text-sm font-mono font-black bg-background border border-border/50 rounded-xl outline-none focus:ring-2 focus:ring-info/20 disabled:bg-muted/30 disabled:opacity-50 transition-all"
                        placeholder="TL-XXX"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <DatePickerInput 
                        value={item.tailoring?.delivery_date || ""} 
                        onChange={(val) => updateItemTailoring(idx, { delivery_date: val })} 
                        disabled={!item.tailoring?.enabled}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <select 
                        value={item.tailoring?.article_type || (articleTypes[0] || "Shirt")} 
                        onChange={e => updateItemTailoring(idx, { article_type: e.target.value })} 
                        disabled={!item.tailoring?.enabled} 
                        className="w-full h-10 px-3 text-sm font-bold bg-background border border-border/50 rounded-xl outline-none disabled:bg-muted/30 disabled:opacity-50"
                      >
                        {articleTypes.map(type => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <select 
                        value={item.tailoring?.embroidery_status || "Not Required"} 
                        onChange={e => updateItemTailoring(idx, { embroidery_status: e.target.value })} 
                        disabled={!item.tailoring?.enabled} 
                        className="w-full h-10 px-3 text-sm font-bold bg-background border border-border/50 rounded-xl outline-none disabled:bg-muted/30 disabled:opacity-50"
                      >
                        <option value="Not Required">Not Required</option>
                        <option value="Required">Required</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSplit(idx)}
                        disabled={item.qty <= 0 || !item.tailoring?.enabled}
                        className="h-9 px-4 font-black uppercase tracking-widest text-[10px] border-dashed border-2 rounded-xl gap-2 hover:bg-info/5 hover:text-info hover:border-info/30 transition-all disabled:opacity-30"
                      >
                        <ArrowsSplit size={14} weight="bold" /> Split
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
        
        <CardFooter className="border-t border-border/50 bg-muted/20 px-6 py-4 flex justify-end gap-3">
          <Button onClick={onClose} className="h-10 px-8 font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-info/20 bg-info hover:bg-info/90">
            Confirm Configuration
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
