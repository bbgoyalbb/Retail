import { useState, useEffect } from "react";
import { getSettings, updateSettings } from "@/api";
import { FloppyDisk, Plus, Trash, Gear, CheckCircle } from "@phosphor-icons/react";

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [newArticle, setNewArticle] = useState("");
  const [newMode, setNewMode] = useState("");
  const [newAddon, setNewAddon] = useState("");

  useEffect(() => { getSettings().then(res => setSettings(res.data)).catch(console.error); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateSettings(settings);
      setSettings(res.data);
      setMessage({ type: "success", text: "Settings saved!" });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to save" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
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

  const addMode = () => { if (!newMode.trim()) return; setSettings(prev => ({ ...prev, payment_modes: [...(prev.payment_modes || []), newMode.trim()] })); setNewMode(""); };
  const removeMode = (m) => setSettings(prev => ({ ...prev, payment_modes: prev.payment_modes.filter(x => x !== m) }));

  const addAddonItem = () => { if (!newAddon.trim()) return; setSettings(prev => ({ ...prev, addon_items: [...(prev.addon_items || []), newAddon.trim()] })); setNewAddon(""); };
  const removeAddon = (a) => setSettings(prev => ({ ...prev, addon_items: prev.addon_items.filter(x => x !== a) }));

  if (!settings) return <div className="p-8 text-center text-[var(--text-secondary)]">Loading...</div>;

  return (
    <div data-testid="settings-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-light tracking-tight">Settings</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Configure article types, rates, payment modes, and more</p>
        </div>
        <button data-testid="save-settings-btn" onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-50 transition-all">
          {saving ? "Saving..." : <><FloppyDisk size={16} weight="bold" /> Save Settings</>}
        </button>
      </div>

      {message && (
        <div className={`p-3 border rounded-sm text-sm flex items-center gap-2 ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          <CheckCircle size={16} /> {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Article Types & Rates */}
        <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
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
          <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-3">
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
          <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-3">
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
          <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-3">
            <h3 className="font-heading text-base font-medium">Firm Details (PDF Invoice)</h3>
            <div className="space-y-2">
              <input value={settings.firm_name || ""} onChange={e => setSettings(p => ({...p, firm_name: e.target.value}))} placeholder="Firm Name" className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:ring-1 focus:ring-[var(--brand)]" />
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
