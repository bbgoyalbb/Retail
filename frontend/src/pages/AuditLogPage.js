import { useState, useEffect, useCallback } from "react";
import { listAuditLogs } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { ArrowClockwise } from "@phosphor-icons/react";

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

export default function AuditLogPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;

  const fetchLogs = useCallback(async (pageNum = 0) => {
    setLoading(true);
    try {
      const res = await listAuditLogs({ limit: PAGE_SIZE, skip: pageNum * PAGE_SIZE });
      const items = res.data.logs ?? [];
      setLogs(items);
      setHasMore(items.length === PAGE_SIZE);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchLogs(0); }, [fetchLogs]);

  const goPage = (n) => { setPage(n); fetchLogs(n); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight text-[var(--text-primary)]">Audit Log</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">All actions performed in the system</p>
        </div>
        <button
          onClick={() => { setPage(0); fetchLogs(0); }}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] text-[var(--text-secondary)] transition-colors"
        >
          <ArrowClockwise size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

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
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{log.user || log.username || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={badge(log.action)}>{log.action || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] max-w-xs truncate" title={log.details || log.message || ""}>
                      {log.details || log.message || "—"}
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
          <span className="text-sm text-[var(--text-secondary)]">Page {page + 1}</span>
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
