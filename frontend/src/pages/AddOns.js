import { useState, useEffect } from "react";
import { getCustomers, getRefs, getItems, addAddons } from "@/api";
import { PlusCircle, CheckCircle } from "@phosphor-icons/react";

const ADDON_ITEMS = ["Bow", "Tie", "Cufflinks", "Stall", "Buttons", "Saffa", "Dye", "Malla", "Kalangi"];

export default function AddOns() {
  const [customers, setCustomers] = useState([]);
  const [refs, setRefs] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedRef, setSelectedRef] = useState("");
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [addons, setAddons] = useState(ADDON_ITEMS.map(name => ({ name, checked: false, price: "" })));
  const [message, setMessage] = useState(null);

  useEffect(() => { getCustomers().then(res => setCustomers(res.data)).catch(() => {}); }, []);

  useEffect(() => {
    if (selectedCustomer) {
      getRefs(selectedCustomer).then(res => setRefs(res.data)).catch(() => {});
      setSelectedRef(""); setArticles([]); setSelectedArticle(null);
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (selectedRef) {
      getItems({ name: selectedCustomer, ref: selectedRef })
        .then(res => setArticles(res.data.items))
        .catch(() => {});
      setSelectedArticle(null);
    }
  }, [selectedRef, selectedCustomer]);

  const toggleAddon = (idx) => {
    setAddons(prev => prev.map((a, i) => i === idx ? { ...a, checked: !a.checked, price: !a.checked ? a.price : "" } : a));
  };

  const handleSave = async () => {
    if (!selectedArticle) { setMessage({ type: "error", text: "Please select an article first" }); return; }
    const selected = addons.filter(a => a.checked && a.price);
    if (selected.length === 0) { setMessage({ type: "error", text: "Please select at least one add-on with price" }); return; }

    try {
      const res = await addAddons({
        item_id: selectedArticle.id,
        addons: selected.map(a => ({ name: a.name, price: parseFloat(a.price) })),
      });
      setMessage({ type: "success", text: `Add-ons saved! Total: ₹${res.data.addon_amount}` });
      setAddons(ADDON_ITEMS.map(name => ({ name, checked: false, price: "" })));
      // Refresh articles
      getItems({ name: selectedCustomer, ref: selectedRef }).then(res => setArticles(res.data.items));
    } catch (err) {
      setMessage({ type: "error", text: "Failed to save add-ons" });
    }
  };

  return (
    <div data-testid="addons-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight">Add-ons</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Add accessories to articles</p>
      </div>

      {message && (
        <div className={`p-4 border rounded-sm text-sm ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Customer</label>
                <select data-testid="addon-customer-select" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                  <option value="">Select customer</option>
                  {customers.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">Reference</label>
                <select data-testid="addon-ref-select" value={selectedRef} onChange={e => setSelectedRef(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]">
                  <option value="">Select reference</option>
                  {refs.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Articles */}
          {articles.length > 0 && (
            <div className="bg-white border border-[var(--border-subtle)] rounded-sm">
              <div className="p-4 border-b border-[var(--border-subtle)]">
                <h3 className="font-heading text-sm font-medium">Articles ({articles.length})</h3>
              </div>
              <div className="divide-y divide-[var(--border-subtle)]">
                {articles.map((art, i) => (
                  <button
                    key={i}
                    data-testid={`article-${art.id}`}
                    onClick={() => setSelectedArticle(art)}
                    className={`w-full text-left px-4 py-3 transition-colors ${selectedArticle?.id === art.id ? 'bg-[#C86B4D10]' : 'hover:bg-[var(--bg)]'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{art.barcode}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          ₹{art.price} x {art.qty}m | {art.article_type}
                          {art.addon_desc && art.addon_desc !== "N/A" && ` | ${art.addon_desc}`}
                        </p>
                      </div>
                      <span className="font-mono text-sm">₹{art.fabric_amount}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Add-ons Panel */}
        <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
          <h3 className="font-heading text-base font-medium">Accessories</h3>
          {!selectedArticle ? (
            <p className="text-sm text-[var(--text-secondary)]">Select an article to add accessories</p>
          ) : (
            <>
              <p className="text-xs text-[var(--text-secondary)]">Adding to: <span className="font-medium text-[var(--text-primary)]">{selectedArticle.barcode}</span></p>
              <div className="space-y-2">
                {addons.map((addon, i) => (
                  <div key={addon.name} className="flex items-center gap-3">
                    <input type="checkbox" checked={addon.checked} onChange={() => toggleAddon(i)} className="w-4 h-4 accent-[var(--brand)]" />
                    <span className="text-sm w-24">{addon.name}</span>
                    <input
                      type="number"
                      value={addon.price}
                      onChange={e => setAddons(prev => prev.map((a, idx) => idx === i ? { ...a, price: e.target.value } : a))}
                      disabled={!addon.checked}
                      placeholder="Price"
                      className="flex-1 px-2 py-1.5 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] disabled:bg-[var(--bg)] disabled:text-[var(--text-secondary)]"
                    />
                  </div>
                ))}
              </div>
              <button data-testid="save-addons-btn" onClick={handleSave} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-all duration-200">
                <PlusCircle size={18} weight="bold" /> Save Add-ons
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
