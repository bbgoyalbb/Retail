import { useState, useEffect, useRef } from "react";
import { getSettings, updateSettings, uploadLogo, BACKEND_URL } from "@/api";
import { FloppyDisk, Plus, Trash, Gear, CheckCircle, Warning } from "@phosphor-icons/react";

const getLogoUrl = (path) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${BACKEND_URL}${path}`;
  return path;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [savedSettings, setSavedSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [newArticle, setNewArticle] = useState("");
  const [newMode, setNewMode] = useState("");
  const [newAddon, setNewAddon] = useState("");
  const [logoPreview, setLogoPreview] = useState(null);
  const msgTimerRef = useRef(null);

  const isDirty = settings && savedSettings && JSON.stringify(settings) !== JSON.stringify(savedSettings);

  // Warn on page/tab close with unsaved changes
  useEffect(() => {
    const handler = (e) => { if (isDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Clear timeout on unmount to prevent memory leak
  useEffect(() => () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current); }, []);

  const showMessage = (msg) => {
    setMessage(msg);
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => { getSettings().then(res => { setSettings(res.data); setSavedSettings(res.data); }).catch(() => {}); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateSettings(settings);
      setSettings(res.data);
      setSavedSettings(res.data);
      showMessage({ type: "success", text: "Settings saved successfully!" });
    } catch (err) {
      showMessage({ type: "error", text: err.message || "Failed to save settings" });
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

  if (!settings) return <div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div>;

  return (
    <div data-testid="settings-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Settings</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Configure article types, rates, payment modes, and more</p>
        </div>
        <button data-testid="save-settings-btn" onClick={save} disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-sm transition-all disabled:opacity-50 ${
            isDirty ? 'bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] ring-2 ring-[var(--brand)] ring-offset-2' : 'bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)]'
          }`}>
          {saving ? "Saving..." : <><FloppyDisk size={16} weight="bold" /> {isDirty ? "Save Changes ●" : "Save Settings"}</>}
        </button>
      </div>

      {message && (
        <div className={`p-3 border rounded-sm text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <Warning size={16} />} {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Article Types & Rates */}
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
          <h3 className="font-heading text-base font-medium">Article Types & Rates</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] px-1">
              <span className="col-span-4">Type</span>
              <span className="col-span-3">Tailoring (₹)</span>
              <span className="col-span-3">Labour (₹)</span>
              <span className="col-span-2"></span>
            </div>
            {settings.article_types?.map(type => (
              <div key={type} className="grid grid-cols-12 gap-2 items-center">
                <span className="col-span-4 text-sm font-medium">{type}</span>
                <input type="number" value={settings.tailoring_rates?.[type]?.tailoring || 0} onChange={e => updateRate(type, "tailoring", e.target.value)} className="col-span-3 px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
                <input type="number" value={settings.tailoring_rates?.[type]?.labour || 0} onChange={e => updateRate(type, "labour", e.target.value)} className="col-span-3 px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
                <button onClick={() => removeArticle(type)} className="col-span-2 p-1 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm"><Trash size={14} /></button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <input value={newArticle} onChange={e => setNewArticle(e.target.value)} placeholder="New article type" onKeyDown={e => e.key === "Enter" && addArticle()} className="flex-1 px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
              <button onClick={addArticle} className="px-3 py-1.5 text-xs bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]"><Plus size={14} /></button>
            </div>
          </div>
        </div>

        {/* Payment Modes */}
        <div className="space-y-6">
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-3">
            <h3 className="font-heading text-base font-medium">Payment Modes</h3>
            <div className="flex flex-wrap gap-2">
              {settings.payment_modes?.map(m => (
                <div key={m} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm">
                  <span>{m}</span>
                  <button onClick={() => removeMode(m)} className="text-[var(--error)] hover:bg-[#9E473D10] rounded-sm p-0.5"><Trash size={12} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newMode} onChange={e => setNewMode(e.target.value)} placeholder="New mode" onKeyDown={e => e.key === "Enter" && addMode()} className="flex-1 px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
              <button onClick={addMode} className="px-3 py-1.5 text-xs bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]"><Plus size={14} /></button>
            </div>
          </div>

          {/* Add-on Items */}
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-3">
            <h3 className="font-heading text-base font-medium">Add-on Items</h3>
            <div className="flex flex-wrap gap-2">
              {settings.addon_items?.map(a => (
                <div key={a} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--bg)] border border-[var(--border-subtle)] rounded-sm">
                  <span>{a}</span>
                  <button onClick={() => removeAddon(a)} className="text-[var(--error)] hover:bg-[#9E473D10] rounded-sm p-0.5"><Trash size={12} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newAddon} onChange={e => setNewAddon(e.target.value)} placeholder="New add-on" onKeyDown={e => e.key === "Enter" && addAddonItem()} className="flex-1 px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
              <button onClick={addAddonItem} className="px-3 py-1.5 text-xs bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)]"><Plus size={14} /></button>
            </div>
          </div>

          {/* Firm Info */}
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-sm space-y-3">
            <h3 className="font-heading text-base font-medium">Firm Details (Invoice)</h3>
            <div className="space-y-3">
              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">Company Logo</label>
                <div className="flex items-center gap-3">
                  {(logoPreview || settings.firm_logo) && (
                    <img 
                      src={getLogoUrl(logoPreview) || getLogoUrl(settings.firm_logo)} 
                      alt="Logo preview" 
                      className="w-16 h-16 object-contain border border-[var(--border-subtle)] rounded-sm"
                    />
                  )}
                  <div className="flex-1">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={async e => {
                        const file = e.target.files[0];
                        if (!file) return;
                        // Validate file size (max 1MB)
                        if (file.size > 1024 * 1024) {
                          showMessage({ type: "error", text: "Logo image too large. Maximum size is 1MB." });
                          return;
                        }
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          showMessage({ type: "success", text: "Uploading logo..." });
                          const res = await uploadLogo(formData);
                          setLogoPreview(res.data.url);
                          setSettings(p => ({...p, firm_logo: res.data.url}));
                          showMessage({ type: "success", text: "Logo uploaded. Click Save Settings to apply." });
                        } catch (err) {
                          showMessage({ type: "error", text: err.message || "Failed to upload logo" });
                        }
                      }}
                      className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:text-xs file:bg-[var(--brand)] file:text-white hover:file:bg-[var(--brand-hover)]"
                    />
                  </div>
                  {(logoPreview || settings.firm_logo) && (
                    <button 
                      onClick={() => { setLogoPreview(null); setSettings(p => ({...p, firm_logo: ''})); }}
                      className="p-1.5 text-[var(--error)] hover:bg-[#9E473D10] rounded-sm"
                      title="Remove logo"
                    >
                      <Trash size={16} />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-[var(--text-secondary)]">Upload PNG/JPG logo (recommended: 200x200px, will be auto-resized)</p>
              </div>

              <input value={settings.firm_name || ""} onChange={e => setSettings(p => ({...p, firm_name: e.target.value}))} placeholder="Firm Name" className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
              
              {/* Company Name Styling */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary)] block mb-1">Font Color</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={settings.firm_name_color || '#C86B4D'} 
                      onChange={e => setSettings(p => ({...p, firm_name_color: e.target.value}))}
                      className="w-8 h-8 rounded-sm border border-[var(--border-subtle)] cursor-pointer"
                    />
                    <input 
                      type="text" 
                      value={settings.firm_name_color || '#C86B4D'} 
                      onChange={e => setSettings(p => ({...p, firm_name_color: e.target.value}))}
                      className="flex-1 px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm"
                      placeholder="#C86B4D"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary)] block mb-1">Font Size</label>
                  <select 
                    value={settings.firm_name_size || '16'} 
                    onChange={e => setSettings(p => ({...p, firm_name_size: e.target.value}))}
                    className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]"
                  >
                    <option value="14">Small (14pt)</option>
                    <option value="16">Medium (16pt)</option>
                    <option value="18">Large (18pt)</option>
                    <option value="20">Extra Large (20pt)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-secondary)] block mb-1">Case</label>
                  <select 
                    value={settings.firm_name_case || 'uppercase'} 
                    onChange={e => setSettings(p => ({...p, firm_name_case: e.target.value}))}
                    className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]"
                  >
                    <option value="uppercase">UPPERCASE</option>
                    <option value="capitalize">Capitalize</option>
                    <option value="normal">As Typed</option>
                  </select>
                </div>
              </div>

              <input value={settings.firm_address || ""} onChange={e => setSettings(p => ({...p, firm_address: e.target.value}))} placeholder="Address" className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
              <div className="grid grid-cols-2 gap-2">
                <input value={settings.firm_phones || ""} onChange={e => setSettings(p => ({...p, firm_phones: e.target.value}))} placeholder="Phone numbers" className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
                <input value={settings.firm_gstin || ""} onChange={e => setSettings(p => ({...p, firm_gstin: e.target.value}))} placeholder="GSTIN" className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">GST Rate %</label>
                <input type="number" value={settings.gst_rate || 5} onChange={e => setSettings(p => ({...p, gst_rate: parseFloat(e.target.value) || 0}))} className="w-20 px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
