import { useState, useEffect, useCallback, useRef } from "react";
import { listAuditLogs, listUsers } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowClockwise, Funnel, X, ShieldCheck, 
  User, Clock, Info, CaretDown,
  ArrowLeft, ArrowRight, DownloadSimple
} from "@phosphor-icons/react";
import { DatePickerInput } from "@/components/DatePickerInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ACTION_COLORS = {
  create: "text-success bg-success/20 border-success/30",
  update: "text-info bg-info/20 border-info/30",
  delete: "text-destructive bg-destructive/15 border-destructive/30",
  login:  "text-primary bg-primary/15 border-primary/30",
  logout: "text-muted-foreground bg-muted/50 border-border/60",
};

function ActionBadge({ action = "" }) {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k)) || "update";
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest transition-all",
        ACTION_COLORS[key]
      )}
    >
      {action}
    </Badge>
  );
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

  const filtersRef = useRef({ filterUser, filterAction, filterDateFrom, filterDateTo });
  useEffect(() => { filtersRef.current = { filterUser, filterAction, filterDateFrom, filterDateTo }; }, [filterUser, filterAction, filterDateFrom, filterDateTo]);

  // Load users for filter dropdown
  useEffect(() => {
    listUsers().then(res => setUsers(res || [])).catch(() => setUsers([]));
  }, []);

  const fetchLogs = useCallback(async (pageNum = 0, overrideFilters = null) => {
    setLoading(true);
    try {
      const filters = overrideFilters ?? filtersRef.current;
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
  }, [toast]);

  const clearFilters = () => {
    const cleared = { filterUser: "", filterAction: "", filterDateFrom: "", filterDateTo: "" };
    setFilterUser("");
    setFilterAction("");
    setFilterDateFrom("");
    setFilterDateTo("");
    filtersRef.current = cleared;
    setPage(0);
    fetchLogs(0, cleared);
  };

  useEffect(() => { fetchLogs(0); }, [fetchLogs]);

  const goPage = (n) => { setPage(n); fetchLogs(n); };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary truncate">Security Audit</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium line-clamp-2">Comprehensive ledger of all system interactions and modifications</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!logs.length) return;
              const headers = ["Timestamp", "User", "Action", "Resource", "Resource ID", "Details"];
              const rows = logs.map(l => [
                l.timestamp ? new Date(l.timestamp).toLocaleString("en-IN") : "",
                l.username || "",
                l.action || "",
                l.resource || "",
                l.resource_id || "",
                JSON.stringify(l.details || {}),
              ]);
              const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
              a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
              a.click();
            }}
            disabled={!logs.length}
            className="h-10 px-4 font-black uppercase tracking-widest text-[10px] rounded-xl gap-2"
          >
            <DownloadSimple size={16} weight="bold" /> Export CSV
          </Button>
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "h-10 px-4 font-black uppercase tracking-widest text-[10px] rounded-xl transition-all",
              showFilters && "shadow-lg shadow-primary/20"
            )}
          >
            <Funnel size={16} weight="bold" className="mr-2" />
            Filters {(filterUser || filterAction || filterDateFrom || filterDateTo) && <span className="ml-2 w-2 h-2 bg-warning rounded-full animate-pulse" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => { setPage(0); fetchLogs(0); }}
            className="h-10 w-10 rounded-full shadow-sm hover:rotate-180 transition-transform duration-300"
          >
            <ArrowClockwise size={18} weight="bold" className={loading ? "animate-spin text-primary" : ""} />
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">User</label>
                <div className="relative group">
                  <select 
                    value={filterUser} 
                    onChange={e => setFilterUser(e.target.value)}
                    className="w-full h-11 pl-4 pr-10 text-xs font-bold bg-muted/30 border border-border/50 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer group-hover:border-primary/50"
                  >
                    <option value="">All Users</option>
                    {users.map(u => <option key={u.username} value={u.username}>{u.full_name} ({u.username})</option>)}
                  </select>
                  <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Action Type</label>
                <div className="relative group">
                  <select 
                    value={filterAction} 
                    onChange={e => setFilterAction(e.target.value)}
                    className="w-full h-11 pl-4 pr-10 text-xs font-bold bg-muted/30 border border-border/50 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer group-hover:border-primary/50"
                  >
                    <option value="">All Actions</option>
                    {ACTION_TYPES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                  </select>
                  <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">From Date</label>
                <DatePickerInput value={filterDateFrom} onChange={setFilterDateFrom} placeholder="Start date" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">To Date</label>
                <DatePickerInput value={filterDateTo} onChange={setFilterDateTo} placeholder="End date" />
              </div>
            </div>
            
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/50">
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="h-10 px-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/5"
              >
                <X size={14} weight="bold" className="mr-2" /> Clear Filters
              </Button>
              <Button
                onClick={() => { setPage(0); fetchLogs(0); }}
                className="h-10 px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
              >
                Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-xl shadow-black/5 overflow-hidden bg-background min-h-[400px]">
        <CardHeader className="px-6 py-4 border-b border-border/50 bg-background/50 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ShieldCheck size={18} weight="duotone" />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Audit Log</CardTitle>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{loading ? "Loading..." : `${totalLogs} events`}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
              <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                <Clock size={40} className="text-muted-foreground opacity-40" weight="duotone" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-[0.2em] text-foreground mb-2">No Events Found</h3>
              <p className="text-sm text-muted-foreground font-medium max-w-[280px] leading-relaxed">
                No audit events match the current filters. Try adjusting your date range or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/50">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left whitespace-nowrap"><div className="flex items-center gap-2"><Clock size={12} weight="bold" /> Timestamp</div></th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left whitespace-nowrap"><div className="flex items-center gap-2"><User size={12} weight="bold" /> User</div></th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left whitespace-nowrap"><div className="flex items-center gap-2"><Info size={12} weight="bold" /> Action</div></th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left whitespace-nowrap">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-primary/[0.01] transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-mono text-[11px] font-black text-muted-foreground group-hover:text-primary transition-colors">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="font-black uppercase tracking-widest text-[10px] border-border/50 bg-muted/30 px-2 py-0.5 group-hover:border-primary/20 group-hover:bg-primary/5 transition-all">
                          {log.username || log.user || "—"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-6 py-4 max-w-sm">
                        {log.details && typeof log.details === "object" && Object.keys(log.details).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(log.details).map(([k, v]) => {
                              const val = Array.isArray(v) ? v.join(", ") : String(v ?? "");
                              if (!val || val === "undefined") return null;
                              const labelMap = { customer: "Customer", items: "Items", total: "Total", ip: "IP", ref: "Ref", bill_ref: "Bill", action: null };
                              const label = labelMap[k] !== undefined ? labelMap[k] : k.replace(/_/g, " ");
                              if (!label) return null;
                              const isMonetary = k === "total";
                              const isCount = k === "items";
                              return (
                                <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 border border-border/40 text-[10px] font-bold text-foreground/70 whitespace-nowrap">
                                  <span className="text-muted-foreground/60 font-medium">{label}</span>
                                  <span className={cn("font-black", isMonetary ? "text-success" : isCount ? "text-info" : "text-foreground/80")}>
                                    {isMonetary ? `₹${Number(val).toLocaleString("en-IN")}` : val}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50 italic">
                            {typeof log.details === "string" && log.details ? log.details : (log.message || "—")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && (logs.length > 0 || page > 0) && (
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => goPage(page - 1)}
            className="h-10 px-6 font-black uppercase tracking-widest text-[10px] rounded-xl border-border/50 hover:border-primary/50 transition-all disabled:opacity-20"
          >
            <ArrowLeft size={14} weight="bold" className="mr-2" /> Previous
          </Button>
          
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="h-10 px-6 rounded-full bg-muted/50 border-border/50 font-mono text-xs font-black">
              Page {page + 1}
            </Badge>
            {totalLogs > 0 && (
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                {totalLogs} total
              </span>
            )}
          </div>

          <Button
            variant="outline"
            disabled={!hasMore}
            onClick={() => goPage(page + 1)}
            className="h-10 px-6 font-black uppercase tracking-widest text-[10px] rounded-xl border-border/50 hover:border-primary/50 transition-all disabled:opacity-20"
          >
            Next <ArrowRight size={14} weight="bold" className="ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
