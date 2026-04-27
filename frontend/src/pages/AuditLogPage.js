import { useState, useEffect, useCallback } from "react";
import { listAuditLogs, listUsers } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { ArrowClockwise, Funnel, X } from "@phosphor-icons/react";

const ACTION_COLORS = {
  create: "text-[var(--success)] bg-[#455D4A10]",
  update: "text-[var(--info)] bg-[#5C8A9E10]",
  delete: "text-[var(--error)] bg-[#9E473D10]",
  login:  "text-[var(--brand)] bg-[#C86B4D10]",
  logout: "text-[var(--text-secondary)] bg-[var(--bg)]",
};

function badge(action = "") {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k)) || "update";
  return `inline-block px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-wider ${ACTION_COLORS[key]}`;
}

const ACTION_TYPES = ["create", "update", "delete", "login", "logout"];

export default function AuditLogPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalLogs, setTotalLogs] = useState(0);
  const PAGE_SIZE = 50;
  
  // Filter states
  const [users, setUsers] = useState([]);
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Load users for filter dropdown
  useEffect(() => {
    listUsers().then(res => setUsers(res || [])).catch(() => setUsers([]));
  }, []);

  const fetchLogs = useCallback(async (pageNum = 0, currentFilters = null) => {
    setLoading(true);
    try {
      const filters = currentFilters || { filterUser, filterAction, filterDateFrom, filterDateTo };
      const params = { 
        limit: PAGE_SIZE, 
        skip: pageNum * PAGE_SIZE,
        ...(filters.filterUser && { user: filters.filterUser }),
        ...(filters.filterAction && { action: filters.filterAction }),
        ...(filters.filterDateFrom && { date_from: filters.filterDateFrom }),
        ...(filters.filterDateTo && { date_to: filters.filterDateTo }),
      };
      const res = await listAuditLogs(params);
      const items = res.data.logs ?? [];
      setLogs(items);
      setTotalLogs(res.data.total || 0);
      setHasMore(items.length === PAGE_SIZE);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, filterUser, filterAction, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setFilterUser("");
    setFilterAction("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(0);
    fetchLogs(0, { filterUser: "", filterAction: "", filterDateFrom: "", filterDateTo: "" });
  };

  // Initial fetch only on mount
  useEffect(() => { 
    fetchLogs(0); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goPage = (n) => { setPage(n); fetchLogs(n); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight text-[var(--text-primary)]">Audit Log</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">All actions performed in the system</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-sm transition-colors ${showFilters ? 'bg-[var(--brand)] text-white border-[var(--brand)]' : 'border-[var(--border-subtle)] hover:bg-[var(--bg)] text-[var(--text-secondary)]'}`}
          >
            <Funnel size={15} />
            Filters {(filterUser || filterAction || filterDateFrom || filterDateTo) && <span className="ml-1 w-2 h-2 bg-[var(--warning)] rounded-full" />}
          </button>
          <button
            onClick={() => { setPage(0); fetchLogs(0); }}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] text-[var(--text-secondary)] transition-colors"
          >
            <ArrowClockwise size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">User</label>
              <select 
                value={filterUser} 
                onChange={e => setFilterUser(e.target.value)}
                className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)] min-w-[140px]"
              >
                <option value="">All Users</option>
                {users.map(u => <option key={u.username} value={u.username}>{u.full_name} ({u.username})</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">Action</label>
              <select 
                value={filterAction} 
                onChange={e => setFilterAction(e.target.value)}
                className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)] min-w-[140px]"
              >
                <option value="">All Actions</option>
                {ACTION_TYPES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">From Date</label>
              <input 
                type="date" 
                value={filterDateFrom} 
                onChange={e => setFilterDateFrom(e.target.value)}
                className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">To Date</label>
              <input 
                type="date" 
                value={filterDateTo} 
                onChange={e => setFilterDateTo(e.target.value)}
                className="px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              />
            </div>
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--error)] transition-colors"
            >
              <X size={14} /> Clear
            </button>
            <button
              onClick={() => { setPage(0); fetchLogs(0); }}
              className="flex items-center gap-1 px-3 py-2 text-xs bg-[var(--brand)] text-white rounded-sm hover:opacity-90 transition-opacity"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[var(--border-subtle)]">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                <div className="h-4 w-24 bg-[var(--border-subtle)] rounded-sm" />
                <div className="h-4 w-16 bg-[var(--border-subtle)] rounded-sm" />
                <div className="h-4 flex-1 bg-[var(--border-subtle)] rounded-sm" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-sm text-[var(--text-secondary)] py-16">No audit logs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg)] border-b border-[var(--border-subtle)]">
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)] whitespace-nowrap">Timestamp</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">User</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Action</th>
                  <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.1em] font-semibold text-[var(--text-secondary)]">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-[var(--bg)] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{log.username || log.user || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={badge(log.action)}>{log.action || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] max-w-xs truncate" title={
                      log.details && typeof log.details === "object"
                        ? Object.entries(log.details).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
                        : (log.details || log.message || "")
                    }>
                      {log.details && typeof log.details === "object"
                        ? Object.entries(log.details).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ") || "—"
                        : (log.details || log.message || "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && (logs.length > 0 || page > 0) && (
        <div className="flex items-center justify-between gap-2">
          <button
            disabled={page === 0}
            onClick={() => goPage(page - 1)}
            className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] disabled:opacity-40 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-sm text-[var(--text-secondary)]">
            Page {page + 1} {totalLogs > 0 && <span className="text-[var(--text-secondary)]/60">({totalLogs} total)</span>}
          </span>
          <button
            disabled={!hasMore}
            onClick={() => goPage(page + 1)}
            className="px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] disabled:opacity-40 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
