import { useState, useEffect } from "react";
import { searchItems, getCustomers, getInvoiceUrl } from "@/api";
import { MagnifyingGlass, Funnel, FilePdf, X } from "@phosphor-icons/react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customer, setCustomer] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("All");
  const [paymentStatus, setPaymentStatus] = useState("All");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [searched, setSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { getCustomers().then(res => setCustomers(res.data)).catch(() => {}); }, []);

  const handleSearch = async () => {
    const params = { q: query, limit: 100 };
    if (customer !== "All") params.customer = customer;
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    if (status !== "All") params.status = status;
    if (paymentStatus !== "All") params.payment_status = paymentStatus;
    if (minAmount) params.min_amount = parseFloat(minAmount);
    if (maxAmount) params.max_amount = parseFloat(maxAmount);

    try {
      const res = await searchItems(params);
      setResults(res.data.items);
      setTotal(res.data.total);
      setSearched(true);
    } catch (err) {
      console.error(err);
    }
  };

  const clearFilters = () => {
    setQuery(""); setCustomer("All"); setDateFrom(""); setDateTo("");
    setStatus("All"); setPaymentStatus("All"); setMinAmount(""); setMaxAmount("");
    setResults([]); setTotal(0); setSearched(false);
  };

  const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

  return (
    <div data-testid="search-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight">Search</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Find any record across all items</p>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-[var(--border-subtle)] p-4 rounded-sm space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              data-testid="search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Search by name, barcode, reference, article type, karigar..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
            />
          </div>
          <button data-testid="search-btn" onClick={handleSearch} className="px-6 py-2.5 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-all duration-200 hover:translate-y-[-1px]">
            Search
          </button>
          <button data-testid="toggle-filters-btn" onClick={() => setShowFilters(!showFilters)} className={`px-3 py-2.5 text-sm border rounded-sm transition-all ${showFilters ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--brand)]'}`}>
            <Funnel size={18} />
          </button>
          {searched && (
            <button onClick={clearFilters} className="px-3 py-2.5 text-sm border border-[var(--border-subtle)] rounded-sm text-[var(--text-secondary)] hover:bg-[var(--bg)]">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[var(--border-subtle)]">
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Customer</label>
              <select data-testid="search-customer-filter" value={customer} onChange={e => setCustomer(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm">
                <option value="All">All</option>
                {customers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Date From</label>
              <input data-testid="search-date-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Date To</label>
              <input data-testid="search-date-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Tailoring Status</label>
              <select data-testid="search-status-filter" value={status} onChange={e => setStatus(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm">
                {["All", "N/A", "Awaiting Order", "Pending", "Stitched", "Delivered"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Payment</label>
              <select data-testid="search-payment-filter" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm">
                {["All", "Settled", "Pending"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Min Amount</label>
              <input data-testid="search-min-amount" type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="₹0" className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Max Amount</label>
              <input data-testid="search-max-amount" type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="₹99999" className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {searched && (
        <div className="bg-white border border-[var(--border-subtle)] rounded-sm">
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <p className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">{total} Results Found</p>
          </div>
          {results.length === 0 ? (
            <div className="p-12 text-center">
              <pre className="text-[var(--border-strong)] text-xs mb-3 font-mono">
{`  (o_o)
  /| |\\
   | |
  No results`}
              </pre>
              <p className="text-sm text-[var(--text-secondary)]">Try a different search term or adjust filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="search-results-table">
                <thead>
                  <tr className="bg-[var(--bg)]">
                    {["Date", "Customer", "Ref", "Item", "Price", "Qty", "Amount", "Article", "Tailoring", "Embroidery", "Payment", "PDF"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((item, i) => (
                    <tr key={i} className="border-b border-[var(--border-subtle)] hover:bg-[#C86B4D05]">
                      <td className="px-3 py-2 font-mono text-xs">{item.date}</td>
                      <td className="px-3 py-2 text-sm font-medium max-w-[140px] truncate">{item.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--text-secondary)]">{item.ref}</td>
                      <td className="px-3 py-2 text-xs max-w-[100px] truncate">{item.barcode}</td>
                      <td className="px-3 py-2 font-mono text-xs text-right">₹{fmt(item.price)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-right">{item.qty}</td>
                      <td className="px-3 py-2 font-mono text-xs text-right font-medium">₹{fmt(item.fabric_amount)}</td>
                      <td className="px-3 py-2 text-xs">{item.article_type !== 'N/A' ? item.article_type : '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs ${item.tailoring_status === 'Delivered' ? 'text-[var(--success)]' : item.tailoring_status === 'N/A' ? 'text-[var(--text-secondary)]' : 'text-[var(--warning)]'}`}>
                          {item.tailoring_status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs ${item.embroidery_status === 'Finished' ? 'text-[var(--success)]' : item.embroidery_status === 'N/A' || item.embroidery_status === 'Not Required' ? 'text-[var(--text-secondary)]' : 'text-[var(--info)]'}`}>
                          {item.embroidery_status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 text-xs ${item.fabric_pay_mode?.startsWith('Settled') ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.fabric_pay_mode?.startsWith('Settled') ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`} />
                          {item.fabric_pay_mode?.startsWith('Settled') ? 'Settled' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <a href={getInvoiceUrl(item.ref)} target="_blank" rel="noopener noreferrer" className="p-1 text-[var(--brand)] hover:bg-[#C86B4D10] rounded-sm inline-block">
                          <FilePdf size={16} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div className="bg-white border border-[var(--border-subtle)] p-16 rounded-sm text-center">
          <MagnifyingGlass size={48} weight="thin" className="mx-auto text-[var(--border-strong)] mb-4" />
          <p className="text-[var(--text-secondary)] text-sm">Enter a search term or apply filters to find records</p>
        </div>
      )}
    </div>
  );
}
