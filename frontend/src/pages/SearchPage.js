import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { DatePickerInput } from "@/components/DatePickerInput";
import { searchItems, getCustomers } from "@/api";
import { fmt } from "@/lib/fmt";
import { MagnifyingGlass, Funnel, FilePdf, X, CaretLeft, CaretRight, ArrowRight } from "@phosphor-icons/react";
import InvoiceModal from "@/components/InvoiceModal";

const _today = new Date();
const _iso = (d) => d.toISOString().split("T")[0];
const SEARCH_DATE_PRESETS = [
  { label: "Today",       from: _iso(_today), to: _iso(_today) },
  { label: "This Week",   from: _iso(new Date(_today - (_today.getDay()||7)*86400000+86400000)), to: _iso(_today) },
  { label: "This Month",  from: _iso(new Date(_today.getFullYear(), _today.getMonth(), 1)), to: _iso(_today) },
  { label: "Last Month",  from: _iso(new Date(_today.getFullYear(), _today.getMonth()-1, 1)), to: _iso(new Date(_today.getFullYear(), _today.getMonth(), 0)) },
  { label: "Last 90 Days",from: _iso(new Date(_today - 89*86400000)), to: _iso(_today) },
];

const ITEMS_PER_PAGE = 100;

export default function SearchPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [error, setError] = useState(null);
  const [invoiceRef, setInvoiceRef] = useState(null);

  useEffect(() => { getCustomers().then(res => setCustomers(res.data)).catch(() => {}); }, []);

  // Pre-fill customer filter when navigated from Reports drill-down
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const c = params.get("customer");
    if (c) { setCustomer(c); setShowFilters(true); setTimeout(() => handleSearch(0, { customer: c }), 100); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(async (page = 0, overrides = {}) => {
    setLoading(true);
    setError(null);
    setCurrentPage(page);
    
    const _customer = overrides.customer !== undefined ? overrides.customer : customer;
    const params = { 
      q: query, 
      limit: ITEMS_PER_PAGE,
      skip: page * ITEMS_PER_PAGE
    };
    if (_customer !== "All") params.customer = _customer;
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
      setError("Search failed. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, customer, dateFrom, dateTo, status, paymentStatus, minAmount, maxAmount, searched]);

  // Debounced search for query changes
  useEffect(() => {
    if (!searched && !query) return;
    const timer = setTimeout(() => {
      if (query || searched) handleSearch(0);
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, handleSearch]);

  const clearFilters = () => {
    setQuery(""); setCustomer("All"); setDateFrom(""); setDateTo("");
    setStatus("All"); setPaymentStatus("All"); setMinAmount(""); setMaxAmount("");
    setResults([]); setTotal(0); setSearched(false); setCurrentPage(0); setError(null);
  };

  const clearSearch = () => {
    setQuery("");
    if (searched) {
      handleSearch(0);
    }
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const hasMore = (currentPage + 1) * ITEMS_PER_PAGE < total;
  const hasPrev = currentPage > 0;


  return (
    <div data-testid="search-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight">Search</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Find any record across all items</p>
      </div>

      {/* Search Bar */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-4 rounded-sm space-y-4">
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <div className="flex-1 min-w-0 relative">
            <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              data-testid="search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Search by name, barcode, reference, article type, karigar..."
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)]"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--error)] p-1 rounded-sm hover:bg-[var(--bg)]"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
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
          <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
          <div className="flex flex-wrap gap-1.5">
            {SEARCH_DATE_PRESETS.map(p => (
              <button key={p.label} onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                className={`px-3 py-1 text-xs font-medium rounded-sm border transition-colors ${
                  dateFrom === p.from && dateTo === p.to
                    ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                    : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]'
                }`}>{p.label}</button>
            ))}
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="px-3 py-1 text-xs rounded-sm border border-[var(--border-subtle)] text-[var(--error)] hover:bg-[#9E473D08]">Clear dates</button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Customer</label>
              <select data-testid="search-customer-filter" value={customer} onChange={e => setCustomer(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm">
                <option value="All">All</option>
                {customers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Date From</label>
              <DatePickerInput value={dateFrom} onChange={setDateFrom} placeholder="From date" className="w-full" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1">Date To</label>
              <DatePickerInput value={dateTo} onChange={setDateTo} placeholder="To date" className="w-full" />
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
                {["All", "Pending", "Settled"].map(s => <option key={s} value={s}>{s}</option>)}
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
          </div>
        )}
      </div>

      {/* Results */}
      {searched && (
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm">
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
            <>
              {/* Mobile card view */}
              <div className="md:hidden divide-y divide-[var(--border-subtle)]">
                {results.map((item, i) => (
                  <div key={i} className="p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium leading-tight">{item.name}</p>
                        <p className="font-mono text-[10px] text-[var(--text-secondary)]">{item.ref} · {item.date}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setInvoiceRef(item.ref)} className="p-1.5 text-[var(--brand)] hover:bg-[#C86B4D10] rounded-sm flex-shrink-0" title="View Invoice">
                          <FilePdf size={16} />
                        </button>
                        <button onClick={() => navigate(`/items?name=${encodeURIComponent(item.name)}&ref=${encodeURIComponent(item.ref)}`)} className="p-1.5 text-[var(--info)] hover:bg-[#5C8A9E10] rounded-sm flex-shrink-0" title="View in Orders">
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
                      <span><span className="font-medium text-[var(--text-primary)]">₹{fmt(item.fabric_amount)}</span> fabric</span>
                      {item.barcode && item.barcode !== 'N/A' && <span>{item.barcode}</span>}
                      {item.article_type && item.article_type !== 'N/A' && <span>{item.article_type}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${item.payment_status === 'Settled' ? 'text-[var(--success)] border-[var(--success)]/30 bg-[var(--success)]/5' : 'text-[var(--warning)] border-[var(--warning)]/30 bg-[var(--warning)]/5'}`}>
                        {item.payment_status || 'Pending'}
                      </span>
                      {item.tailoring_status && item.tailoring_status !== 'N/A' && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm border ${item.tailoring_status === 'Delivered' ? 'text-[var(--success)] border-[var(--success)]/30 bg-[var(--success)]/5' : 'text-[var(--warning)] border-[var(--warning)]/30 bg-[var(--warning)]/5'}`}>
                          {item.tailoring_status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
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
                          <span className={`text-xs ${item.tailoring_status === 'Delivered' ? 'text-[var(--success)]' : item.tailoring_status === 'N/A' ? 'text-[var(--text-secondary)]' : 'text-[var(--warning)]'}`}>{item.tailoring_status}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs ${item.embroidery_status === 'Finished' ? 'text-[var(--success)]' : item.embroidery_status === 'N/A' || item.embroidery_status === 'Not Required' ? 'text-[var(--text-secondary)]' : 'text-[var(--info)]'}`}>{item.embroidery_status}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 text-xs ${item.payment_status === 'Settled' ? 'text-[var(--success)]' : 'text-[var(--warning)]'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${item.payment_status === 'Settled' ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`} />
                            {item.payment_status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setInvoiceRef(item.ref)} className="p-1 text-[var(--brand)] hover:bg-[#C86B4D10] rounded-sm inline-block" title="View Invoice"><FilePdf size={16} /></button>
                            <button onClick={() => navigate(`/items?name=${encodeURIComponent(item.name)}&ref=${encodeURIComponent(item.ref)}`)} className="p-1 text-[var(--info)] hover:bg-[#5C8A9E10] rounded-sm inline-block" title="View in Orders"><ArrowRight size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <div className="text-xs text-[var(--text-secondary)]">
                Showing {currentPage * ITEMS_PER_PAGE + 1} - {Math.min((currentPage + 1) * ITEMS_PER_PAGE, total)} of {total} results
                {loading && <span className="ml-2 text-[var(--brand)]">Loading...</span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSearch(currentPage - 1)}
                  disabled={!hasPrev || loading}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CaretLeft size={14} /> Previous
                </button>
                <span className="text-xs px-2">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => handleSearch(currentPage + 1)}
                  disabled={!hasMore || loading}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next <CaretRight size={14} />
                </button>
              </div>
            </div>
          )}
          
          {error && (
            <div className="p-4 border-t border-[var(--error)] bg-[#9E473D10] text-[var(--error)] text-sm text-center">
              {error}
            </div>
          )}
        </div>
      )}

      {!searched && (
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-16 rounded-sm text-center">
          <MagnifyingGlass size={48} weight="thin" className="mx-auto text-[var(--border-strong)] mb-4" />
          <p className="text-[var(--text-secondary)] text-sm">Enter a search term or apply filters to find records</p>
        </div>
      )}

      {invoiceRef && (
        <InvoiceModal billRef={invoiceRef} onClose={() => setInvoiceRef(null)} />
      )}
    </div>
  );
}
