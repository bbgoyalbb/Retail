import { useState, useEffect, useCallback } from "react";
import { importExcel, exportExcelUrl, backupUrl, restoreBackup, getDbStats, getDbAudit, normalizeDbData, repairDbData } from "@/api";
import { 
  Upload, DownloadSimple, Database, ArrowsClockwise, 
  Warning, CheckCircle, FileXls, FileCsv, Info, 
  Trash, ShieldCheck, Activity, ChartBar, FileJson, X
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function DataManager() {
  const { toast } = useToast();
  const [tab, setTab] = useState("import");
  const [stats, setStats] = useState(null);
  const [importing, setImporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [importMode, setImportMode] = useState("replace");
  const [dragActive, setDragActive] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [pendingRestoreFile, setPendingRestoreFile] = useState(null);
  const [audit, setAudit] = useState(null);
  const [normalizationResult, setNormalizationResult] = useState(null);
  const [repairResult, setRepairResult] = useState(null);

  const loadStats = useCallback(() => {
    getDbStats()
      .then(res => setStats(res.data))
      .catch((err) => {
        console.error("Failed to load DB stats", err);
      });
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const loadAudit = async () => {
    setAuditing(true);
    try {
      const res = await getDbAudit({ limit: 100 });
      setAudit(res.data);
      toast({ title: "Audit Complete", description: "Database consistency scan finished successfully." });
    } catch (err) {
      toast({ title: "Audit Failed", description: err.response?.data?.detail || "Operation failed", variant: "destructive" });
    } finally {
      setAuditing(false);
    }
  };

  const runNormalization = async () => {
    setNormalizing(true);
    try {
      const res = await normalizeDbData({ limit: 100 });
      setNormalizationResult(res.data);
      setAudit(res.data.audit_after);
      toast({ 
        title: "Normalization Applied", 
        description: `Updated ${res.data.items_updated || 0} items and ${res.data.advances_updated || 0} advances.` 
      });
    } catch (err) {
      toast({ title: "Normalization Failed", description: err.response?.data?.detail || "Operation failed", variant: "destructive" });
    } finally {
      setNormalizing(false);
    }
  };

  const runRepair = async () => {
    setRepairing(true);
    try {
      const res = await repairDbData({ limit: 100 });
      setRepairResult(res.data);
      setAudit(res.data.audit_after);
      toast({ 
        title: "Repair Applied", 
        description: `Updated ${res.data.items_updated || 0} items and created ${res.data.advances_created || 0} carry-forward advances.` 
      });
    } catch (err) {
      toast({ title: "Repair Failed", description: err.response?.data?.detail || "Operation failed", variant: "destructive" });
    } finally {
      setRepairing(false);
    }
  };

  const handleImport = async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsm|xlsx|xls)$/i)) {
      toast({ title: "Invalid File", description: "Please upload an Excel file (.xlsm or .xlsx)", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await importExcel(formData, importMode);
      toast({ title: "Import Successful", description: res.data.message });
      loadStats();
    } catch (err) {
      toast({ title: "Import Failed", description: err.response?.data?.detail || "Operation failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleRestore = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      toast({ title: "Invalid File", description: "Please upload a .json backup file", variant: "destructive" });
      return;
    }
    if (!restoreConfirm) {
      setPendingRestoreFile(file);
      setRestoreConfirm(true);
      return;
    }
    setRestoreConfirm(false);
    setPendingRestoreFile(null);

    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await restoreBackup(formData);
      toast({ title: "Restore Successful", description: res.data.message });
      loadStats();
    } catch (err) {
      toast({ title: "Restore Failed", description: err.response?.data?.detail || "Operation failed", variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else setDragActive(false);
  };

  const handleDrop = (e, handler) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handler(e.dataTransfer.files[0]);
  };

  return (
    <div data-testid="data-manager-page" className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary truncate">Data Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium truncate">Control information flow, synchronization, and database integrity</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadStats} className="rounded-full shadow-sm hover:rotate-180 transition-transform duration-500">
          <ArrowsClockwise size={20} className="text-primary" />
        </Button>
      </div>

      {/* DB Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-none shadow-lg shadow-black/5 overflow-hidden group hover:shadow-xl transition-all duration-300">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform duration-300">
              <Database size={24} weight="duotone" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground opacity-60 leading-none mb-2">Items Tracked</p>
              <p className="font-mono text-xl font-black tracking-tighter">{stats?.items_count || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-none shadow-lg shadow-black/5 overflow-hidden group hover:shadow-xl transition-all duration-300">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-success/10 text-success group-hover:scale-110 transition-transform duration-300">
              <Activity size={24} weight="duotone" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground opacity-60 leading-none mb-2">Advances Tracked</p>
              <p className="font-mono text-xl font-black tracking-tighter">{stats?.advances_count || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-primary text-primary-foreground border-none shadow-xl shadow-primary/10 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <ChartBar size={64} weight="duotone" />
          </div>
          <CardContent className="p-5 flex items-center gap-4 relative">
            <div className="p-3 rounded-2xl bg-white/10 text-white">
              <ShieldCheck size={24} weight="duotone" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-black opacity-60 leading-none mb-2">System Integrity</p>
              <p className="font-heading text-xl font-black tracking-tight">Optimized</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 px-1">
        {[
          { key: "import", label: "Import Excel", icon: Upload },
          { key: "export", label: "Export Data", icon: DownloadSimple },
          { key: "backup", label: "Cloud Backup", icon: ArrowsClockwise },
          { key: "audit", label: "Data Integrity", icon: Warning },
        ].map(t => (
          <Button
            key={t.key}
            variant={tab === t.key ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-shrink-0 h-10 px-6 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
              tab === t.key ? "shadow-lg shadow-primary/20" : "bg-card border-border/50 hover:border-primary/50"
            )}
          >
            <t.icon size={16} weight="bold" className="mr-2" />
            {t.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Import Tab */}
        {tab === "import" && (
          <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
            <CardHeader className="p-8 pb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <FileXls size={24} weight="duotone" />
                </div>
                <div className="flex flex-col">
                  <CardTitle className="text-xl font-black uppercase tracking-tight">Excel Synchronization</CardTitle>
                  <p className="text-sm text-muted-foreground font-medium">Synchronize legacy workbook data with the cloud database</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-8">
              <div className="flex items-start gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50">
                <Info size={20} className="text-primary mt-1" weight="duotone" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">Format Requirement</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upload your <code className="bg-primary/5 text-primary px-1.5 py-0.5 rounded font-mono font-bold">New Retail Book.xlsm</code>. 
                    Ensure <span className="text-foreground font-bold">"Item Details"</span> and <span className="text-foreground font-bold">"Advances"</span> sheets maintain their original column protocol.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground ml-1">Execution Mode</label>
                <div className="flex flex-wrap gap-4">
                  {[
                    { id: "replace", label: "Replace Data", desc: "Flush existing records & re-initialize", icon: Trash },
                    { id: "append", label: "Append Data", desc: "Integrate new records with existing", icon: Plus }
                  ].map(mode => (
                    <label 
                      key={mode.id}
                      className={cn(
                        "flex-1 min-w-[240px] flex items-center gap-4 p-5 rounded-2xl border transition-all cursor-pointer select-none",
                        importMode === mode.id ? "bg-primary/5 border-primary shadow-sm" : "bg-background border-border/50 hover:border-primary/30"
                      )}
                    >
                      <input type="radio" name="importMode" value={mode.id} checked={importMode === mode.id} onChange={() => setImportMode(mode.id)} className="hidden" />
                      <div className={cn(
                        "p-2.5 rounded-xl transition-colors",
                        importMode === mode.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                      )}>
                        <mode.icon size={18} weight="bold" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black uppercase tracking-tight">{mode.label}</span>
                        <span className="text-[10px] text-muted-foreground font-medium">{mode.desc}</span>
                      </div>
                      <div className={cn(
                        "ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                        importMode === mode.id ? "border-primary bg-primary" : "border-border"
                      )}>
                        {importMode === mode.id && <CheckCircle size={12} weight="bold" className="text-white" />}
                      </div>
                    </label>
                  ))}
                </div>
                {importMode === "replace" && (
                  <p className="text-[10px] text-destructive font-black uppercase tracking-widest flex items-center gap-2 animate-pulse px-1">
                    <Warning size={14} weight="fill" /> Critical: This operation will permanently discard all current operational data.
                  </p>
                )}
              </div>

              <div
                data-testid="import-drop-zone"
                className={cn(
                  "relative border-2 border-dashed rounded-[2rem] p-16 text-center transition-all duration-500 group cursor-pointer overflow-hidden",
                  dragActive ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={(e) => handleDrop(e, handleImport)}
                onClick={() => document.getElementById('import-file-input')?.click()}
              >
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                    <FileXls size={40} weight="duotone" />
                  </div>
                  <h4 className="text-xl font-black uppercase tracking-tight text-foreground">
                    {importing ? "Processing Protocol..." : "Deploy Excel Asset"}
                  </h4>
                  <p className="text-sm text-muted-foreground font-medium max-w-xs mx-auto leading-relaxed">
                    Drag & drop your workbook here or click to browse your local file system.
                  </p>
                  <Badge variant="secondary" className="mt-4 px-4 py-1 text-[9px] font-black uppercase tracking-widest rounded-full bg-primary/10 text-primary border-none">
                    Supported: .XLSM, .XLSX
                  </Badge>
                </div>
                <input
                  id="import-file-input"
                  data-testid="import-file-input"
                  type="file"
                  accept=".xlsm,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => handleImport(e.target.files?.[0])}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export Tab */}
        {tab === "export" && (
          <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-success" />
            <CardHeader className="p-8 pb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-success/10 text-success">
                  <DownloadSimple size={24} weight="duotone" />
                </div>
                <div className="flex flex-col">
                  <CardTitle className="text-xl font-black uppercase tracking-tight">Data Extraction</CardTitle>
                  <p className="text-sm text-muted-foreground font-medium">Generate a professional Excel report of the entire database</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-8">
              <div className="flex items-start gap-4 p-5 bg-success/5 rounded-2xl border border-success/10">
                <Info size={20} className="text-success mt-1" weight="duotone" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">Export Protocol</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The generated file will replicate the original <span className="text-foreground font-bold">New Retail Book.xlsm</span> structure, including all "Item Details" and "Advances" entries.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center py-12 space-y-6">
                <div className="w-24 h-24 rounded-[2rem] bg-success/10 text-success flex items-center justify-center shadow-lg shadow-success/10 animate-bounce-slow">
                  <FileXls size={48} weight="duotone" />
                </div>
                <div className="text-center space-y-2">
                  <h4 className="text-lg font-black uppercase tracking-tight">Ready for Extraction</h4>
                  <p className="text-sm text-muted-foreground font-medium">
                    {stats ? `Compiling ${stats.items_count} items and ${stats.advances_count} advances...` : "Preparing data package..."}
                  </p>
                </div>
                <Button 
                  asChild 
                  className="h-14 px-12 text-sm font-black uppercase tracking-[0.2em] bg-success hover:bg-success/90 shadow-xl shadow-success/20 gap-3"
                >
                  <a href={exportExcelUrl()} target="_blank" rel="noopener noreferrer">
                    <DownloadSimple size={20} weight="bold" /> Initialize Download
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Backup & Restore Tab */}
        {tab === "backup" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Backup */}
            <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-success" />
              <CardHeader className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-success/10 text-success">
                    <DownloadSimple size={20} weight="duotone" />
                  </div>
                  <CardTitle className="text-lg font-black uppercase tracking-tight text-foreground">Cloud Snapshot</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-6">
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  Generate a complete JSON-formatted architectural snapshot of your operational database for local archiving.
                </p>
                <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 flex flex-col items-center gap-4">
                  <FileJson size={40} className="text-success opacity-40" weight="duotone" />
                  <Button asChild className="w-full h-12 text-[10px] font-black uppercase tracking-widest bg-success hover:bg-success/90 shadow-lg shadow-success/10">
                    <a href={backupUrl()} target="_blank" rel="noopener noreferrer">
                      <DownloadSimple size={16} weight="bold" className="mr-2" /> Download JSON Backup
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Restore */}
            <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-warning" />
              <CardHeader className="p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-warning/10 text-warning">
                    <ArrowsClockwise size={20} weight="duotone" />
                  </div>
                  <CardTitle className="text-lg font-black uppercase tracking-tight text-foreground">Data Restoration</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-6">
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  Restore your entire operational state from a previously generated JSON snapshot. <span className="text-destructive font-black uppercase">Warning: Overwrites current state.</span>
                </p>
                
                <div
                  data-testid="restore-drop-zone"
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer group",
                    dragActive ? 'border-warning bg-warning/5' : 'border-border hover:border-warning/50 hover:bg-muted/30'
                  )}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={(e) => handleDrop(e, handleRestore)}
                  onClick={() => document.getElementById('restore-file-input')?.click()}
                >
                  <div className="w-12 h-12 rounded-xl bg-warning/10 text-warning flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-500">
                    <ArrowsClockwise size={24} weight="duotone" className={restoring ? "animate-spin" : ""} />
                  </div>
                  <p className="text-xs font-black uppercase tracking-tight text-foreground">
                    {restoring ? "Synchronizing..." : "Deploy JSON Snapshot"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">or click to browse</p>
                  <input
                    id="restore-file-input"
                    data-testid="restore-file-input"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => handleRestore(e.target.files?.[0])}
                  />
                </div>

                {restoreConfirm && (
                  <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-2xl space-y-4 animate-in shake duration-500">
                    <div className="flex items-center gap-3">
                      <Warning size={18} className="text-destructive" weight="fill" />
                      <p className="text-[11px] font-black uppercase tracking-widest text-destructive">Destructive Operation Confirm</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                      You are about to permanently overwrite <span className="text-destructive font-bold">ALL current records</span> with <span className="text-foreground font-bold">{pendingRestoreFile?.name}</span>. This sequence is irreversible.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => handleRestore(pendingRestoreFile)}
                        disabled={restoring}
                        className="flex-1 h-9 text-[9px] font-black uppercase tracking-widest"
                      >
                        {restoring ? "Restoring..." : "Yes, Execute Protocol"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setRestoreConfirm(false); setPendingRestoreFile(null); }}
                        className="flex-1 h-9 text-[9px] font-black uppercase tracking-widest"
                      >
                        Abort
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Audit Tab */}
        {tab === "audit" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-warning" />
              <CardHeader className="p-8 pb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-warning/10 text-warning">
                      <ShieldCheck size={24} weight="duotone" />
                    </div>
                    <div className="flex flex-col">
                      <CardTitle className="text-xl font-black uppercase tracking-tight">Integrity Protocol</CardTitle>
                      <p className="text-sm text-muted-foreground font-medium">Scans accounting records for consistency and anomalies</p>
                    </div>
                  </div>
                  <Button
                    data-testid="run-audit-btn"
                    onClick={loadAudit}
                    disabled={auditing}
                    className="h-12 px-8 font-black uppercase tracking-[0.15em] text-xs shadow-lg shadow-warning/20 gap-3"
                  >
                    {auditing ? <ArrowsClockwise size={18} className="animate-spin" /> : <Activity size={18} weight="bold" />}
                    {auditing ? "Scanning Engine..." : "Initialize Audit"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-8 pt-4 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50 hover:border-primary/30 transition-all group">
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase tracking-tight text-foreground">Normalization Protocol</p>
                      <p className="text-[10px] text-muted-foreground font-medium mt-1 leading-relaxed">Fixes low-risk derived field issues & rounding mismatches.</p>
                    </div>
                    <Button
                      data-testid="run-normalize-btn"
                      variant="outline"
                      onClick={runNormalization}
                      disabled={normalizing}
                      className="h-10 px-4 text-[10px] font-black uppercase tracking-widest border-border/50 hover:bg-success/10 hover:text-success hover:border-success/30 group-hover:shadow-md transition-all"
                    >
                      {normalizing ? <ArrowsClockwise size={14} className="animate-spin" /> : "Execute"}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between gap-4 p-5 bg-warning/[0.03] border border-warning/20 rounded-2xl hover:border-warning transition-all group">
                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase tracking-tight text-foreground">Advanced Repair Cycle</p>
                      <p className="text-[10px] text-muted-foreground font-medium mt-1 leading-relaxed">Repairs genuine accounting errors while preserving credit balances.</p>
                    </div>
                    <Button
                      data-testid="run-repair-btn"
                      variant="warning"
                      onClick={runRepair}
                      disabled={repairing}
                      className="h-10 px-4 text-[10px] font-black uppercase tracking-widest shadow-md group-hover:shadow-warning/20 transition-all"
                    >
                      {repairing ? <ArrowsClockwise size={14} className="animate-spin" /> : "Initialize Repair"}
                    </Button>
                  </div>
                </div>

                {audit && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: "Scanned Items", value: audit.scanned?.items || 0, icon: Package },
                      { label: "Scanned Advances", value: audit.scanned?.advances || 0, icon: Wallet },
                      { label: "Issues Detected", value: audit.total_issues || 0, icon: Warning, color: "warning" },
                      { label: "Distinct Types", value: Object.keys(audit.issue_counts || {}).length, icon: Info },
                    ].map((st, i) => (
                      <div key={i} className="p-5 rounded-2xl bg-muted/20 border border-border/50 flex flex-col gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          st.color === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
                        )}>
                          <st.icon size={16} weight="duotone" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60 leading-none mb-1.5">{st.label}</span>
                          <span className={cn("font-mono text-xl font-black tracking-tighter", st.color === "warning" ? "text-warning" : "text-foreground")}>{st.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {audit && (
              <div className="space-y-8">
                <Card className="bg-card border-none shadow-xl shadow-black/5 overflow-hidden">
                  <CardHeader className="p-6 pb-2">
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground">Issue Classification</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    {Object.keys(audit.issue_counts || {}).length === 0 ? (
                      <div className="flex items-center gap-3 p-4 bg-success/5 border border-success/10 rounded-xl">
                        <CheckCircle size={18} className="text-success" weight="fill" />
                        <p className="text-xs font-bold text-success">Optimal Integrity: No issues detected in current sequence.</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(audit.issue_counts || {}).map(([type, count]) => (
                          <Badge 
                            key={type} 
                            variant="outline" 
                            className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-warning/5 border-warning/20 text-warning rounded-xl"
                          >
                            {type}: <span className="ml-1 font-mono text-xs">{count}</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-none shadow-xl shadow-black/5 overflow-hidden bg-background">
                  <CardHeader className="px-6 py-4 border-b border-border/50 bg-background/50 backdrop-blur-md">
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Sequence Anomalies</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {audit.issues?.length ? (
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full min-w-[1000px]">
                          <thead>
                            <tr className="bg-muted/30 border-b border-border/50">
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Protocol Type</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Ref ID</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Client Identity</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Anomaly Details</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Accounting State</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {audit.issues.map((issue, idx) => (
                              <tr key={idx} className="hover:bg-warning/[0.01] transition-colors group">
                                <td className="px-6 py-4">
                                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-none bg-warning/10 text-warning px-2 py-0.5 rounded-md">
                                    {issue.type}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="font-mono text-xs font-black text-primary">#{issue.ref || "—"}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-xs font-bold text-foreground uppercase tracking-tight">{issue.name || "—"}</span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-start gap-2 max-w-sm">
                                    <Info size={14} className="text-muted-foreground mt-0.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                                    <p className="text-[11px] font-medium text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">{issue.message}</p>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40 leading-none">Pnd: ₹{fmt(issue.pending ?? 0)}</span>
                                    <span className="font-mono text-xs font-black text-foreground">Total: ₹{fmt(issue.total ?? 0)}</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-20 text-center">
                        <p className="text-sm text-muted-foreground font-medium italic">Run the integrity protocol to visualize detected anomalies.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
