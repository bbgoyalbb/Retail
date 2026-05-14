import { useState, useEffect, useCallback, useRef } from "react";
import { listAuditLogs, listUsers } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowClockwise, Funnel, X, ShieldCheck, 
  User, Activity, Clock, Info, CaretDown,
  ArrowLeft, ArrowRight
} from "@phosphor-icons/react";
import { DatePickerInput } from "@/components/DatePickerInput";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ACTION_COLORS = {
  create: "text-success bg-success/10 border-success/20",
  update: "text-info bg-info/10 border-info/20",
  delete: "text-destructive bg-destructive/10 border-destructive/20",
  login:  "text-primary bg-primary/10 border-primary/20",
  logout: "text-muted-foreground bg-muted/30 border-border/50",
};

function ActionBadge({ action = "" }) {
  const key = Object.keys(ACTION_COLORS).find(k => action.toLowerCase().includes(k)) || "update";
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-none transition-all",
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
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary truncate">Security Audit</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium truncate">Comprehensive ledger of all system interactions and modifications</p>
        </div>
        <div className="flex items-center gap-3">
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
            className="h-10 w-10 rounded-full shadow-sm hover:rotate-180 transition-transform duration-500"
          >
            <ArrowClockwise size={18} weight="bold" className={loading ? "animate-spin text-primary" : ""} />
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden animate-in slide-in-from-top-4 duration-300">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Agent Identity</label>
                <div className="relative group">
                  <select 
                    value={filterUser} 
                    onChange={e => setFilterUser(e.target.value)}
                    className="w-full h-11 pl-4 pr-10 text-xs font-bold bg-muted/30 border border-border/50 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer group-hover:border-primary/50"
                  >
                    <option value="">Global (All Agents)</option>
                    {users.map(u => <option key={u.username} value={u.username}>{u.full_name} ({u.username})</option>)}
                  </select>
                  <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Operation Type</label>
                <div className="relative group">
                  <select 
                    value={filterAction} 
                    onChange={e => setFilterAction(e.target.value)}
                    className="w-full h-11 pl-4 pr-10 text-xs font-bold bg-muted/30 border border-border/50 rounded-xl appearance-none focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer group-hover:border-primary/50"
                  >
                    <option value="">Global (All Operations)</option>
                    {ACTION_TYPES.map(a => <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
                  </select>
                  <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">From Timeline</label>
                <DatePickerInput value={filterDateFrom} onChange={setFilterDateFrom} placeholder="Start date" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">To Timeline</label>
                <DatePickerInput value={filterDateTo} onChange={setFilterDateTo} placeholder="End date" />
              </div>
            </div>
            
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/50">
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="h-10 px-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground hover:text-destructive hover:bg-destructive/5"
              >
                <X size={14} weight="bold" className="mr-2" /> Reset Engine
              </Button>
              <Button
                onClick={() => { setPage(0); fetchLogs(0); }}
                className="h-10 px-8 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
              >
                Execute Protocol
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-xl shadow-black/5 overflow-hidden bg-background min-h-[400px]">
        <CardHeader className="px-6 py-4 border-b border-border/50 bg-background/50 backdrop-blur-md flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <ShieldCheck size={18} weight="duotone" />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Audit Sequence</CardTitle>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{loading ? "Querying Database..." : `${totalLogs} Total Events Logged`}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 px-6 text-center animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                <Activity size={40} className="text-muted-foreground opacity-40" weight="duotone" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-[0.2em] text-foreground mb-2">No Sequence Detected</h3>
              <p className="text-sm text-muted-foreground font-medium max-w-[280px] leading-relaxed">
                The current audit filters returned zero operational sequences. Try expanding your timeline.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/50">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left"><div className="flex items-center gap-2"><Clock size={12} weight="bold" /> Temporal Stamp</div></th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left"><div className="flex items-center gap-2"><User size={12} weight="bold" /> Operational Agent</div></th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left"><div className="flex items-center gap-2"><Activity size={12} weight="bold" /> Execution Action</div></th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Protocol Details</th>
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
                      <td className="px-6 py-4 max-w-md">
                        <div 
                          className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors truncate cursor-help flex items-center gap-2"
                          title={
                            log.details && typeof log.details === "object"
                              ? Object.entries(log.details).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ")
                              : (log.details || log.message || "")
                          }
                        >
                          <Info size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" weight="duotone" />
                          <span className="truncate">
                            {log.details && typeof log.details === "object"
                              ? Object.entries(log.details).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ") || "—"
                              : (log.details || log.message || "—")}
                          </span>
                        </div>
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
        <div className="flex items-center justify-between gap-4 animate-in fade-in duration-700">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => goPage(page - 1)}
            className="h-10 px-6 font-black uppercase tracking-widest text-[10px] rounded-xl border-border/50 hover:border-primary/50 transition-all disabled:opacity-20"
          >
            <ArrowLeft size={14} weight="bold" className="mr-2" /> Previous Sequence
          </Button>
          
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="h-10 px-6 rounded-full bg-muted/50 border-border/50 font-mono text-xs font-black">
              Page {page + 1}
            </Badge>
            {totalLogs > 0 && (
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">
                {totalLogs} Records Synchronized
              </span>
            )}
          </div>

          <Button
            variant="outline"
            disabled={!hasMore}
            onClick={() => goPage(page + 1)}
            className="h-10 px-6 font-black uppercase tracking-widest text-[10px] rounded-xl border-border/50 hover:border-primary/50 transition-all disabled:opacity-20"
          >
            Next Sequence <ArrowRight size={14} weight="bold" className="ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
