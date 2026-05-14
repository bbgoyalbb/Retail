import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getSettings, updateSettings, uploadLogo, invalidatePublicSettingsCache, invalidateSettingsCache, BACKEND_URL } from "@/api";
import { 
  FloppyDisk, Plus, Trash, CheckCircle, Warning, Keyboard, 
  Storefront, CreditCard, Tag, FileText, Image, Palette, 
  ArrowRight, ArrowsClockwise, Info
} from "@phosphor-icons/react";
import { DEFAULT_NUM_SHORTCUTS, DEFAULT_LETTER_SHORTCUTS, loadLetterShortcuts } from "@/components/KeyboardShortcuts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const getLogoUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${BACKEND_URL}${path}`;
  return path;
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [settings, setSettings] = useState(null);
  const [savedSettings, setSavedSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [newArticle, setNewArticle] = useState("");
  const [newMode, setNewMode] = useState("");
  const [newAddon, setNewAddon] = useState("");
  const [logoPreview, setLogoPreview] = useState(null);

  // Keyboard shortcuts (stored in localStorage only, not backend)
  const [numShortcuts, setNumShortcuts] = useState(() => {
    try { const r = localStorage.getItem("keyboard_shortcuts"); if (r) return JSON.parse(r); } catch {}
    return DEFAULT_NUM_SHORTCUTS;
  });
  const [letterShortcuts, setLetterShortcuts] = useState(loadLetterShortcuts);

  const PAGE_OPTIONS = [
    { path: "/",             label: "Dashboard" },
    { path: "/new-bill",     label: "New Bill" },
    { path: "/jobwork",      label: "Job Work" },
    { path: "/items",        label: "Manage Orders" },
    { path: "/daybook",      label: "Daybook" },
    { path: "/order-status", label: "Order Status" },
    { path: "/reports",      label: "Reports" },
    { path: "/labour",       label: "Labour Payments" },
    { path: "/data",         label: "Data Manager" },
    { path: "/settings",     label: "Settings" },
    { path: "/users",        label: "Users" },
    { path: "/audit",        label: "Audit Log" },
  ];

  const saveShortcuts = (shortcuts) => {
    localStorage.setItem("keyboard_shortcuts", JSON.stringify(shortcuts));
    window.dispatchEvent(new CustomEvent("shortcuts:updated"));
    toast({ title: "Shortcuts Saved", description: "Numerical keyboard shortcuts updated locally." });
  };

  const saveLetterShortcuts = (shortcuts) => {
    localStorage.setItem("keyboard_letter_shortcuts", JSON.stringify(shortcuts));
    window.dispatchEvent(new CustomEvent("shortcuts:updated"));
    toast({ title: "Shortcuts Saved", description: "Alpha keyboard shortcuts updated locally." });
  };

  const updateShortcut = (key, path) => {
    const label = PAGE_OPTIONS.find(p => p.path === path)?.label || path;
    const updated = numShortcuts.map(s => s.key === key ? { ...s, path, desc: label } : s);
    setNumShortcuts(updated);
  };

  const updateLetterShortcut = (key, path) => {
    const label = PAGE_OPTIONS.find(p => p.path === path)?.label || path;
    const updated = letterShortcuts.map(s => s.key === key ? { ...s, path, desc: label } : s);
    setLetterShortcuts(updated);
  };

  const [navConfirm, setNavConfirm] = useState(null);
  const isDirty = settings && savedSettings && JSON.stringify(settings) !== JSON.stringify(savedSettings);

  // Warn on page/tab close with unsaved changes
  useEffect(() => {
    const handler = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Intercept sidebar/link navigation when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      if (e.detail?.path) { e.preventDefault(); setNavConfirm(e.detail.path); }
    };
    window.addEventListener("navigate:request", handler);
    return () => window.removeEventListener("navigate:request", handler);
  }, [isDirty]);

  const loadSettings = useCallback(() => {
    setLoadError(null);
    return getSettings()
      .then(res => { setSettings(res.data); setSavedSettings(res.data); })
      .catch((err) => {
        const msg = err?.message || "Failed to load settings";
        setLoadError(msg);
        toast({ title: "Error", description: msg, variant: "destructive" });
      });
  }, [toast]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateSettings(settings);
      setSettings(res.data);
      setSavedSettings(res.data);
      invalidatePublicSettingsCache();
      invalidateSettingsCache();
      window.dispatchEvent(new CustomEvent("settings:updated"));
      toast({ title: "Settings Saved", description: "Global application configuration has been updated." });
    } catch (err) {
      toast({ title: "Error", description: err.message || "Failed to save settings", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateRate = (type, field, value) => {
    setSettings(prev => ({
      ...prev,
      tailoring_rates: { ...prev.tailoring_rates, [type]: { ...prev.tailoring_rates[type], [field]: parseFloat(value) || 0 } }
    }));
  };

  const addArticle = () => {
    if (!newArticle.trim()) return;
    setSettings(prev => ({
      ...prev,
      article_types: [...(prev.article_types || []), newArticle.trim()],
      tailoring_rates: { ...(prev.tailoring_rates || {}), [newArticle.trim()]: { tailoring: 0, labour: 0 } }
    }));
    setNewArticle("");
  };

  const removeArticle = (type) => {
    setSettings(prev => {
      const rates = { ...(prev.tailoring_rates || {}) };
      delete rates[type];
      return { ...prev, article_types: prev.article_types.filter(t => t !== type), tailoring_rates: rates };
    });
  };

  const addMode = () => { if (!newMode.trim()) return; if ((prev => (prev.payment_modes || []).map(m => m.toLowerCase()).includes(newMode.trim().toLowerCase()))(settings)) return; setSettings(prev => ({ ...prev, payment_modes: [...(prev.payment_modes || []), newMode.trim()] })); setNewMode(""); };
  const removeMode = (m) => setSettings(prev => ({ ...prev, payment_modes: prev.payment_modes.filter(x => x !== m) }));

  const addAddonItem = () => { if (!newAddon.trim()) return; if ((prev => (prev.addon_items || []).map(a => a.toLowerCase()).includes(newAddon.trim().toLowerCase()))(settings)) return; setSettings(prev => ({ ...prev, addon_items: [...(prev.addon_items || []), newAddon.trim()] })); setNewAddon(""); };
  const removeAddon = (a) => setSettings(prev => ({ ...prev, addon_items: prev.addon_items.filter(x => x !== a) }));

  if (!settings) {
    if (loadError) {
      return (
        <div className="flex flex-col items-center justify-center py-32 gap-6 animate-in zoom-in-95 duration-300">
          <div className="p-6 rounded-full bg-destructive/10 text-destructive">
            <Warning size={48} weight="duotone" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-bold">Failed to load settings</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
          </div>
          <Button onClick={loadSettings} size="lg" className="px-8">
            Retry Connection
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-[400px] rounded-xl" />
          <div className="space-y-8">
            <Skeleton className="h-[200px] rounded-xl" />
            <Skeleton className="h-[200px] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="settings-page" className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary truncate">Settings</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium truncate">Global system configuration and identity management</p>
        </div>
        <Button 
          data-testid="save-settings-btn" 
          onClick={save} 
          disabled={saving}
          className={cn(
            "h-12 px-6 font-black uppercase tracking-[0.15em] text-xs shadow-lg transition-all active:scale-95 gap-2",
            isDirty ? "bg-primary shadow-primary/20 ring-2 ring-primary ring-offset-2" : "bg-primary shadow-primary/10"
          )}
        >
          {saving ? (
            <div className="flex items-center gap-2">Saving <ArrowsClockwise size={18} className="animate-spin" /></div>
          ) : (
            <><FloppyDisk size={18} weight="bold" /> {isDirty ? "Save Changes ●" : "Save Settings"}</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Article Types & Rates */}
        <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden flex flex-col h-fit">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-primary" />
          <CardHeader className="pb-4 pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary transition-transform group-hover:rotate-12 duration-300">
                <Storefront size={22} weight="duotone" />
              </div>
              <div className="flex flex-col">
                <CardTitle className="text-lg font-black uppercase tracking-tight">Article Management</CardTitle>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Types & Commercial Rates</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="overflow-hidden border border-border/50 rounded-2xl bg-muted/5">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border/50">
                      <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Article Discipline</th>
                      <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Retail (₹)</th>
                      <th className="px-4 py-4 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Labour (₹)</th>
                      <th className="px-4 py-4 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {settings.article_types?.map(type => (
                      <tr key={type} className="hover:bg-background/50 transition-colors group">
                        <td className="px-4 py-3">
                          <span className="text-sm font-black text-foreground group-hover:text-primary transition-colors">{type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            inputMode="decimal" 
                            value={settings.tailoring_rates?.[type]?.tailoring || 0} 
                            onChange={e => updateRate(type, "tailoring", e.target.value)} 
                            className="w-full h-9 px-3 text-sm font-mono font-black border border-border/50 rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            inputMode="decimal" 
                            value={settings.tailoring_rates?.[type]?.labour || 0} 
                            onChange={e => updateRate(type, "labour", e.target.value)} 
                            className="w-full h-9 px-3 text-sm font-mono font-black border border-border/50 rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removeArticle(type)} 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-full"
                          >
                            <Trash size={14} weight="bold" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="flex gap-3 p-4 bg-primary/5 rounded-2xl border border-primary/10">
              <input 
                value={newArticle} 
                onChange={e => setNewArticle(e.target.value)} 
                placeholder="New article type (e.g. Waistcoat)" 
                onKeyDown={e => e.key === "Enter" && addArticle()} 
                className="flex-1 h-10 px-4 text-xs font-bold border border-primary/20 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-primary/30" 
              />
              <Button onClick={addArticle} className="h-10 px-4 font-black uppercase tracking-widest text-[10px] gap-2 shadow-md">
                <Plus size={14} weight="bold" /> Add Article
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {/* Payment Modes */}
          <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden">
            <CardHeader className="pb-4 pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-success/10 text-success">
                  <CreditCard size={22} weight="duotone" />
                </div>
                <div className="flex flex-col">
                  <CardTitle className="text-lg font-black uppercase tracking-tight">Financial Channels</CardTitle>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Settlement Methods</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-wrap gap-2">
                {settings.payment_modes?.map(m => (
                  <Badge 
                    key={m} 
                    variant="secondary" 
                    className="group px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl bg-muted/50 text-foreground border border-border/50 hover:border-primary/30 transition-all"
                  >
                    {m}
                    <button 
                      onClick={() => removeMode(m)} 
                      className="ml-2 p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                    >
                      <X size={10} weight="bold" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-3">
                <input 
                  value={newMode} 
                  onChange={e => setNewMode(e.target.value)} 
                  placeholder="New payment mode" 
                  onKeyDown={e => e.key === "Enter" && addMode()} 
                  className="flex-1 h-10 px-4 text-xs font-bold border border-border/50 rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                />
                <Button onClick={addMode} variant="secondary" className="h-10 px-4 font-black uppercase tracking-widest text-[10px] shadow-sm">
                  <Plus size={14} weight="bold" /> Add Channel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Add-on Items */}
          <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden">
            <CardHeader className="pb-4 pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-warning/10 text-warning">
                  <Tag size={22} weight="duotone" />
                </div>
                <div className="flex flex-col">
                  <CardTitle className="text-lg font-black uppercase tracking-tight">Accessories & Extras</CardTitle>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Managed Add-on Inventory</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-wrap gap-2">
                {settings.addon_items?.map(a => (
                  <Badge 
                    key={a} 
                    variant="secondary" 
                    className="group px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl bg-muted/50 text-foreground border border-border/50 hover:border-primary/30 transition-all"
                  >
                    {a}
                    <button 
                      onClick={() => removeAddon(a)} 
                      className="ml-2 p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                    >
                      <X size={10} weight="bold" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-3">
                <input 
                  value={newAddon} 
                  onChange={e => setNewAddon(e.target.value)} 
                  placeholder="New accessory item" 
                  onKeyDown={e => e.key === "Enter" && addAddonItem()} 
                  className="flex-1 h-10 px-4 text-xs font-bold border border-border/50 rounded-xl bg-background focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                />
                <Button onClick={addAddonItem} variant="secondary" className="h-10 px-4 font-black uppercase tracking-widest text-[10px] shadow-sm">
                  <Plus size={14} weight="bold" /> Add Item
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Firm Details */}
      <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden">
        <CardHeader className="pb-4 pt-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <FileText size={22} weight="duotone" />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-lg font-black uppercase tracking-tight">Enterprise Identity</CardTitle>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Firm Details & Invoice Branding</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
            <div className="space-y-8">
              {/* Logo Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground flex items-center gap-2">
                    <Image size={14} weight="bold" /> Standard Brandmark
                  </label>
                  <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-dashed border-border/50 group hover:border-primary/30 transition-all">
                    {(logoPreview || settings.firm_logo) ? (
                      <div className="relative group/img">
                        <img 
                          src={getLogoUrl(logoPreview) || getLogoUrl(settings.firm_logo)} 
                          alt="Logo" 
                          className="w-20 h-20 object-contain bg-white rounded-xl border border-border/50 shadow-sm"
                        />
                        <button 
                          onClick={() => { setLogoPreview(null); setSettings(p => ({...p, firm_logo: ''})); }}
                          className="absolute -top-2 -right-2 p-1.5 bg-destructive text-white rounded-full shadow-lg opacity-0 group-hover/img:opacity-100 transition-all scale-75 group-hover/img:scale-100"
                        >
                          <Trash size={12} weight="bold" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-background border border-border/50 flex items-center justify-center text-muted-foreground/20">
                        <Image size={32} />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <input 
                        type="file" 
                        accept="image/*"
                        id="logo-upload"
                        className="hidden"
                        onChange={async e => {
                          const file = e.target.files[0];
                          if (!file) return;
                          if (file.size > 1024 * 1024) { toast({ title: "Error", description: "Logo image too large (max 1MB)", variant: "destructive" }); return; }
                          try {
                            const formData = new FormData();
                            formData.append("file", file);
                            const res = await uploadLogo(formData);
                            const logoUrl = res.data.url;
                            setLogoPreview(logoUrl);
                            const updatedSettings = { ...settings, firm_logo: logoUrl };
                            setSettings(updatedSettings);
                            await updateSettings(updatedSettings);
                            setSavedSettings(updatedSettings);
                            invalidatePublicSettingsCache();
                            invalidateSettingsCache();
                            window.dispatchEvent(new CustomEvent("settings:updated"));
                            toast({ title: "Logo Updated", description: "Standard brandmark has been synchronized." });
                          } catch (err) {
                            toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
                          }
                        }}
                      />
                      <label htmlFor="logo-upload" className="inline-flex h-9 px-4 items-center justify-center rounded-xl bg-background border border-border/50 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-muted/50 transition-colors">
                        Select Image
                      </label>
                      <p className="text-[9px] text-muted-foreground font-medium">PNG/JPG (Max 1MB)</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground flex items-center gap-2">
                    <Palette size={14} weight="bold" /> Dark Mode Variant
                  </label>
                  <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-dashed border-border/50 group hover:border-primary/30 transition-all">
                    {settings.firm_logo_dark ? (
                      <div className="relative group/img">
                        <img 
                          src={getLogoUrl(settings.firm_logo_dark)} 
                          alt="Dark Logo" 
                          className="w-20 h-20 object-contain bg-[#1a1917] rounded-xl border border-border/50 shadow-sm"
                        />
                        <button 
                          onClick={() => setSettings(p => ({...p, firm_logo_dark: ''}))}
                          className="absolute -top-2 -right-2 p-1.5 bg-destructive text-white rounded-full shadow-lg opacity-0 group-hover/img:opacity-100 transition-all scale-75 group-hover/img:scale-100"
                        >
                          <Trash size={12} weight="bold" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-[#1a1917] border border-border/50 flex items-center justify-center text-white/5">
                        <Image size={32} />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <input 
                        type="file" 
                        accept="image/*"
                        id="logo-dark-upload"
                        className="hidden"
                        onChange={async e => {
                          const file = e.target.files[0];
                          if (!file) return;
                          if (file.size > 1024 * 1024) { toast({ title: "Error", description: "Logo image too large (max 1MB)", variant: "destructive" }); return; }
                          try {
                            const formData = new FormData();
                            formData.append("file", file);
                            const res = await uploadLogo(formData);
                            const logoUrl = res.data.url;
                            const updatedSettings = { ...settings, firm_logo_dark: logoUrl };
                            setSettings(updatedSettings);
                            await updateSettings(updatedSettings);
                            setSavedSettings(updatedSettings);
                            invalidatePublicSettingsCache();
                            invalidateSettingsCache();
                            window.dispatchEvent(new CustomEvent("settings:updated"));
                            toast({ title: "Logo Updated", description: "Dark mode brandmark has been synchronized." });
                          } catch (err) {
                            toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
                          }
                        }}
                      />
                      <label htmlFor="logo-dark-upload" className="inline-flex h-9 px-4 items-center justify-center rounded-xl bg-background border border-border/50 text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-muted/50 transition-colors">
                        Select Image
                      </label>
                      <p className="text-[9px] text-muted-foreground font-medium">Shown on dark surfaces</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Company Styling */}
              <div className="space-y-4 p-6 bg-muted/20 rounded-2xl border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Palette size={16} className="text-primary" weight="duotone" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Typography & Visuals</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Brand Color</label>
                    <div className="flex items-center gap-2 h-10 px-2 bg-background border border-border/50 rounded-xl">
                      <input 
                        type="color" 
                        value={settings.firm_name_color || '#C86B4D'} 
                        onChange={e => setSettings(p => ({...p, firm_name_color: e.target.value}))}
                        className="w-7 h-7 rounded-lg border-none cursor-pointer bg-transparent"
                      />
                      <input 
                        type="text" 
                        value={settings.firm_name_color || '#C86B4D'} 
                        onChange={e => setSettings(p => ({...p, firm_name_color: e.target.value.toUpperCase()}))}
                        className="flex-1 min-w-0 bg-transparent text-xs font-mono font-black outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Font Scale</label>
                    <select 
                      value={settings.firm_name_size || '16'} 
                      onChange={e => setSettings(p => ({...p, firm_name_size: e.target.value}))}
                      className="w-full h-10 px-3 text-[11px] font-black uppercase tracking-widest bg-background border border-border/50 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                    >
                      <option value="14">Small (14pt)</option>
                      <option value="16">Medium (16pt)</option>
                      <option value="18">Large (18pt)</option>
                      <option value="20">X-Large (20pt)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Text Case</label>
                    <select 
                      value={settings.firm_name_case || 'uppercase'} 
                      onChange={e => setSettings(p => ({...p, firm_name_case: e.target.value}))}
                      className="w-full h-10 px-3 text-[11px] font-black uppercase tracking-widest bg-background border border-border/50 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                    >
                      <option value="uppercase">UPPERCASE</option>
                      <option value="capitalize">Capitalize</option>
                      <option value="normal">As Typed</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Legal Entity Name</label>
                <input 
                  value={settings.firm_name || ""} 
                  onChange={e => setSettings(p => ({...p, firm_name: e.target.value}))} 
                  placeholder="Official Firm Name" 
                  className="w-full h-12 px-4 text-sm font-bold bg-muted/10 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Headquarters Address</label>
                <input 
                  value={settings.firm_address || ""} 
                  onChange={e => setSettings(p => ({...p, firm_address: e.target.value}))} 
                  placeholder="Complete postal address" 
                  className="w-full h-12 px-4 text-sm font-bold bg-muted/10 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contact Channels</label>
                  <input 
                    value={settings.firm_phones || ""} 
                    onChange={e => setSettings(p => ({...p, firm_phones: e.target.value}))} 
                    placeholder="Phones (e.g. +91 98...)" 
                    className="w-full h-12 px-4 text-sm font-bold bg-muted/10 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">GST Identification (GSTIN)</label>
                  <input 
                    value={settings.firm_gstin || ""} 
                    onChange={e => setSettings(p => ({...p, firm_gstin: e.target.value}))} 
                    placeholder="GSTIN Number" 
                    className="w-full h-12 px-4 text-sm font-bold font-mono bg-muted/10 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all uppercase" 
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 p-4 bg-muted/20 rounded-2xl border border-border/50 max-w-xs">
                <div className="flex flex-col flex-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Applicable GST</span>
                  <span className="text-xs font-bold text-foreground">Standard Indirect Tax %</span>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    value={settings.gst_rate || 5} 
                    onChange={e => setSettings(p => ({...p, gst_rate: parseFloat(e.target.value) || 0}))} 
                    className="w-16 h-10 px-3 text-center text-sm font-black font-mono bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" 
                  />
                  <span className="text-sm font-black text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts */}
      <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden">
        <CardHeader className="pb-4 pt-6 border-b border-border/50 bg-muted/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Keyboard size={22} weight="duotone" />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-lg font-black uppercase tracking-tight">Rapid Access Protocol</CardTitle>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Numerical & Alpha Keyboard Mappings</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-12">
          {/* Alpha shortcuts */}
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <h4 className="text-sm font-black uppercase tracking-widest text-foreground">Alpha Mapping <Badge variant="outline" className="ml-2 font-mono text-[9px] bg-primary/5 border-primary/20 text-primary">CTRL + [A-Z]</Badge></h4>
                <p className="text-xs text-muted-foreground font-medium mt-1">Strategic navigation via primary character keys.</p>
              </div>
              <Button size="sm" onClick={() => saveLetterShortcuts(letterShortcuts)} className="h-9 px-4 font-black uppercase tracking-widest text-[10px] gap-2">
                <FloppyDisk size={14} weight="bold" /> Sync Alpha
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {letterShortcuts.map(sc => (
                <div key={sc.key} className="flex items-center gap-2 group">
                  <kbd className="flex-shrink-0 w-16 h-10 flex items-center justify-center text-[10px] font-black border border-border/50 rounded-xl bg-muted/30 text-muted-foreground group-hover:border-primary/30 group-hover:text-primary transition-all uppercase tracking-widest">
                    Ctrl+{sc.key}
                  </kbd>
                  <div className="relative flex-1">
                    <select
                      value={sc.path}
                      onChange={e => updateLetterShortcut(sc.key, e.target.value)}
                      className="w-full h-10 pl-3 pr-8 text-[11px] font-black uppercase tracking-widest bg-background border border-border/50 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer group-hover:border-primary/20"
                    >
                      {PAGE_OPTIONS.map(p => <option key={p.path} value={p.path}>{p.label}</option>)}
                    </select>
                    <CaretDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50" />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                if (window.confirm("Reset all alpha shortcuts to defaults?")) {
                  setLetterShortcuts(DEFAULT_LETTER_SHORTCUTS);
                  saveLetterShortcuts(DEFAULT_LETTER_SHORTCUTS);
                }
              }}
              className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors flex items-center gap-2"
            >
              <Warning size={14} /> Reset Alpha Defaults
            </button>
          </div>

          <div className="border-t border-border/50" />

          {/* Numerical shortcuts */}
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <h4 className="text-sm font-black uppercase tracking-widest text-foreground">Numerical Mapping <Badge variant="outline" className="ml-2 font-mono text-[9px] bg-primary/5 border-primary/20 text-primary">CTRL + [1-9]</Badge></h4>
                <p className="text-xs text-muted-foreground font-medium mt-1">Rapid command center via numerical index.</p>
              </div>
              <Button size="sm" onClick={() => saveShortcuts(numShortcuts)} className="h-9 px-4 font-black uppercase tracking-widest text-[10px] gap-2">
                <FloppyDisk size={14} weight="bold" /> Sync Numeric
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {numShortcuts.map(sc => (
                <div key={sc.key} className="flex items-center gap-2 group">
                  <kbd className="flex-shrink-0 w-16 h-10 flex items-center justify-center text-[10px] font-black border border-border/50 rounded-xl bg-muted/30 text-muted-foreground group-hover:border-primary/30 group-hover:text-primary transition-all uppercase tracking-widest">
                    Ctrl+{sc.key}
                  </kbd>
                  <div className="relative flex-1">
                    <select
                      value={sc.path}
                      onChange={e => updateShortcut(sc.key, e.target.value)}
                      className="w-full h-10 pl-3 pr-8 text-[11px] font-black uppercase tracking-widest bg-background border border-border/50 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer group-hover:border-primary/20"
                    >
                      {PAGE_OPTIONS.map(p => <option key={p.path} value={p.path}>{p.label}</option>)}
                    </select>
                    <CaretDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50" />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                if (window.confirm("Reset all numeric shortcuts to defaults?")) {
                  setNumShortcuts(DEFAULT_NUM_SHORTCUTS);
                  saveShortcuts(DEFAULT_NUM_SHORTCUTS);
                }
              }}
              className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors flex items-center gap-2"
            >
              <Warning size={14} /> Reset Numeric Defaults
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Unsaved changes navigation guard */}
      {navConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="max-w-sm w-full shadow-2xl border-destructive/20 animate-in zoom-in-95 duration-300">
            <CardHeader className="text-center pb-2">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
                <Warning size={24} weight="bold" />
              </div>
              <CardTitle className="text-lg font-black uppercase tracking-widest text-destructive">Unsaved Protocol</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-xs text-muted-foreground font-bold leading-relaxed px-4">
                You have modified system configurations. Navigating away will <span className="uppercase text-destructive">discard</span> all pending updates.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button variant="destructive" onClick={() => { setNavConfirm(null); navigate(navConfirm); }} className="w-full font-black uppercase tracking-widest text-[10px] h-11">Discard & Proceed</Button>
                <Button variant="ghost" onClick={() => setNavConfirm(null)} className="w-full font-black uppercase tracking-widest text-[10px] h-11">Stay & Sync</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
    </div>
  );
}
