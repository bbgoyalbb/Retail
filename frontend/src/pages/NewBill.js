import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { createBill, getCustomers, getInvoiceUrl, getSettings, invalidateCustomersCache, getNextBillRef } from "@/api";
import { invalidate } from "@/lib/dataEvents";
import { 
  Plus, FloppyDisk, CircleNotch as Spinner, WifiSlash, ArrowsSplit, User, 
  ShoppingCart, CreditCard, X, Trash, Receipt, Calendar, ArrowRight, CheckCircle 
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { TailoringConfigurator } from "@/components/TailoringConfigurator";
import { AddOnConfigurator } from "@/components/AddOnConfigurator";
import { DatePickerInput } from "@/components/DatePickerInput";
import InvoiceModal from "@/components/InvoiceModal";
import { BillLineItemRow, ItemInputForm, PaymentSummaryPanel, BillSuccessPanel } from "@/components/bill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const BarcodeScanner = lazy(() => import("@/components/BarcodeScanner"));

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
    tailoringRates: {},
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
  const updateBillForm  = useCallback((key, val) => setBillForm(p  => ({ ...p, [key]: val })), []);
  const updateItemForm  = useCallback((key, val) => setItemForm(p  => ({ ...p, [key]: val })), []);
  const updateUi        = useCallback((key, val) => setUi(p        => ({ ...p, [key]: val })), []);

  // Destructure for backwards-compatible local names used throughout the component
  const { customers, articleTypes, addonItems, paymentModes, tailoringRates } = config;
  const { customerName, orderDate, payDate, amountPaid, selectedModes, isSettled, needsTailoring } = billForm;
  const { barcode, qty, price, discount, editingIndex } = itemForm;
  const { saving, message, showScanner, showPostSave, showInvoice, showTailoringModal, showAddonModal, dupWarning, showSuggestions, lastBillRef, lastBillTotal } = ui;

  // Setters that match the old individual-useState API so the rest of the file needs no changes
  const setCustomerName    = useCallback((v) => updateBillForm("customerName", v), [updateBillForm]);
  const setOrderDate       = useCallback((v) => updateBillForm("orderDate", v), [updateBillForm]);
  const setPayDate         = useCallback((v) => updateBillForm("payDate", v), [updateBillForm]);
  const setAmountPaid      = useCallback((v) => updateBillForm("amountPaid", v), [updateBillForm]);
  const setSelectedModes   = useCallback((v) => updateBillForm("selectedModes", typeof v === "function" ? v(selectedModes) : v), [updateBillForm, selectedModes]);
  const setIsSettled       = useCallback((v) => updateBillForm("isSettled", v), [updateBillForm]);
  const setNeedsTailoring  = useCallback((v) => updateBillForm("needsTailoring", v), [updateBillForm]);
  const setBarcode         = useCallback((v) => updateItemForm("barcode", v), [updateItemForm]);
  const setQty             = useCallback((v) => updateItemForm("qty", v), [updateItemForm]);
  const setPrice           = useCallback((v) => updateItemForm("price", v), [updateItemForm]);
  const setDiscount        = useCallback((v) => updateItemForm("discount", v), [updateItemForm]);
  const setEditingIndex    = useCallback((v) => updateItemForm("editingIndex", v), [updateItemForm]);
  const setSaving          = useCallback((v) => updateUi("saving", v), [updateUi]);
  const setMessage         = useCallback((v) => updateUi("message", v), [updateUi]);
  const setShowScanner     = useCallback((v) => updateUi("showScanner", v), [updateUi]);
  const setShowPostSave    = useCallback((v) => updateUi("showPostSave", v), [updateUi]);
  const setShowInvoice     = useCallback((v) => updateUi("showInvoice", v), [updateUi]);
  const setShowTailoringModal = useCallback((v) => updateUi("showTailoringModal", v), [updateUi]);
  const setShowAddonModal  = useCallback((v) => updateUi("showAddonModal", v), [updateUi]);
  const setDupWarning      = useCallback((v) => updateUi("dupWarning", v), [updateUi]);
  const setShowSuggestions = useCallback((v) => updateUi("showSuggestions", v), [updateUi]);
  const setLastBillRef     = useCallback((v) => updateUi("lastBillRef", v), [updateUi]);
  const setLastBillTotal   = useCallback((v) => updateUi("lastBillTotal", v), [updateUi]);
  const nameWrapRef = useRef(null);

  const nameSuggestions = useMemo(() => {
    const q = customerName.trim().toLowerCase();
    if (!customers || !Array.isArray(customers)) return [];
    return q
      ? customers.filter(c => c && typeof c === 'string' && c.toLowerCase().includes(q)).slice(0, 8)
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
          ...(s.tailoring_rates ? { tailoringRates: s.tailoring_rates } : {}),
        }));
      })
      .catch((err) => {
        toast({ title: "Error", description: err.message || "Failed to load settings", variant: "destructive" });
      });
  }, [toast]);

  const grandTotal = useMemo(() => items.reduce((sum, item) => {
    const addonTotal = (item.addon?.items || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
    // Get tailoring amount from settings based on article type
    const articleType = item.tailoring?.article_type;
    const tailoringRate = articleType ? (tailoringRates[articleType]?.tailoring || 0) : 0;
    const tailoringTotal = item.tailoring?.enabled ? tailoringRate : 0;
    return sum + item.total + addonTotal + tailoringTotal;
  }, 0), [items, tailoringRates]);

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

  const resetItemForm = useCallback(() => {
    setBarcode("");
    setQty("");
    setPrice("");
    setDiscount("");
    setEditingIndex(null);
  }, [setBarcode, setQty, setPrice, setDiscount, setEditingIndex]);

  const addItem = useCallback(() => {
    if (!barcode || !qty || !price) return;
    const parsedPrice = parseFloat(price) || 0;
    if (parsedPrice === 0 && editingIndex === null && dupWarning !== `zero_${barcode}`) {
      setDupWarning(`zero_${barcode}`);
      setMessage({ type: "error", text: `Price is ₹0 for "${barcode}". Add again to confirm zero-price item.` });
      setTimeout(() => { setDupWarning(null); setMessage(null); }, 4000);
      return;
    }
    const d = parseFloat(discount) || 0;
    const total = Math.round((parsedPrice - parsedPrice * d / 100) * parseFloat(qty));

    if (editingIndex !== null) {
      setItems(prev => prev.map((row, idx) => (
        idx === editingIndex
          ? { ...row, barcode, qty: parseFloat(qty), price: parsedPrice, discount: d, total }
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
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
  }, [barcode, qty, price, discount, editingIndex, dupWarning, items, defaultTailoring, defaultAddon, resetItemForm, setDupWarning, setMessage]);

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
    <div data-testid="new-bill-page" className="space-y-8 pb-32 lg:pb-12">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary truncate">Checkout</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium line-clamp-2">Generate digital invoice and record inventory exit</p>
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
          <Card className="shadow-lg border-muted-foreground/10">
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
                <div className="sm:col-span-1 col-span-1 space-y-2 overflow-visible">
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
                      <Card className="absolute z-50 left-0 top-full mt-2 shadow-2xl min-w-[320px] w-max max-w-[480px]">
                        <div className="relative">
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
                          {nameSuggestions.length > 4 && (
                            <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none rounded-b-lg bg-gradient-to-t from-card to-transparent" />
                          )}
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

              {showScanner && (
                <Suspense fallback={null}>
                  <BarcodeScanner onScan={(code) => { setBarcode(code); setShowScanner(false); setTimeout(() => qtyRef.current?.focus(), 100); }} onClose={() => setShowScanner(false)} />
                </Suspense>
              )}

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
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-muted-foreground/10 p-4 pb-[env(safe-area-inset-bottom,16px)] shadow-2xl z-50"
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
        <AddOnModal
          items={items}
          setItems={setItems}
          customerName={customerName}
          onClose={() => setShowAddonModal(false)}
        />
      )}
    </div>
  );
}

// Tailoring Modal - Thin wrapper around shared TailoringConfigurator for "create" mode (New Bill)
function TailoringModal({ items, setItems, customerName, articleTypes, onClose }) {
  // Convert bill items to configurator format
  const configuratorItems = items.map(item => ({
    id: item.id,
    barcode: item.barcode,
    qty: item.qty,
    tailoring: item.tailoring || {
      enabled: false,
      article_type: articleTypes[0] || "Shirt",
      embroidery_status: "Not Required",
      order_no: "",
      delivery_date: ""
    }
  }));

  // Handle changes from configurator (split updates, etc.)
  const handleChange = (assignments) => {
    // Map assignments back to bill items format
    // Use _original_item_id to find the correct item after splits
    const newItems = assignments.map((a, idx) => {
      const lookupId = a._original_item_id || a.item_id;
      const existing = items.find(i => i.id === lookupId) || {};
      // Recalculate total when qty changes (e.g., after split) to prevent double-counting
      const price = parseFloat(existing.price) || 0;
      const discount = parseFloat(existing.discount) || 0;
      const qty = parseFloat(a.qty) || 0;
      const total = Math.round((price - price * discount / 100) * qty);
      // Generate unique ID for split pieces to ensure they're tracked separately
      const uniqueId = a.item_id || `${lookupId}_split_${idx}_${Date.now()}`;
      return {
        ...existing,
        id: uniqueId, // Use assignment's unique ID, not the original
        barcode: a.barcode,
        qty: qty,
        total: total, // Recalculated based on new qty
        tailoring: {
          enabled: true,
          article_type: a.article_type,
          embroidery_status: a.embroidery_status,
          order_no: a.order_no,
          delivery_date: a.delivery_date
        }
      };
    });
    setItems(newItems);
  };

  // Save just closes the modal - data is already in items state
  const handleSave = async () => {
    onClose();
    return Promise.resolve();
  };

  return (
    <TailoringConfigurator
      items={configuratorItems}
      onChange={handleChange}
      onSave={handleSave}
      onClose={onClose}
      mode="create"
      customerName={customerName}
      title="Tailoring Configuration"
      saveButtonText="Confirm Configuration"
    />
  );
}

// Add-on Modal - Thin wrapper around shared AddOnConfigurator for "create" mode (New Bill)
function AddOnModal({ items, setItems, customerName, onClose }) {
  // Convert bill items to configurator format
  const configuratorItems = items.map(item => ({
    id: item.id,
    barcode: item.barcode,
    qty: item.qty,
    addon: item.addon || { items: [] }
  }));

  // Handle changes from configurator
  const handleChange = (assignments) => {
    // Map assignments back to bill items format
    // Use _original_item_id to find the correct item
    const newItems = assignments.map(a => {
      const lookupId = a._original_item_id || a.item_id;
      const existing = items.find(i => i.id === lookupId) || {};
      return {
        ...existing,
        id: lookupId,
        barcode: a.barcode,
        qty: a.qty,
        addon: {
          enabled: a.addons.length > 0,
          items: a.addons.map(x => ({ name: x.name, amount: x.price }))
        }
      };
    });
    setItems(newItems);
  };

  // Save just closes the modal - data is already in items state
  const handleSave = async () => {
    onClose();
    return Promise.resolve();
  };

  return (
    <AddOnConfigurator
      items={configuratorItems}
      onChange={handleChange}
      onSave={handleSave}
      onClose={onClose}
      mode="create"
      customerName={customerName}
      title="Article Add-ons"
      saveButtonText="Confirm Add-ons"
    />
  );
}
