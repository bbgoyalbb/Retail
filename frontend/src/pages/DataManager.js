import { useState, useEffect, useCallback } from "react";
import { importExcel, exportExcelUrl, backupUrl, restoreBackup, getDbStats } from "@/api";
import { Upload, DownloadSimple, Database, ArrowsClockwise, Warning, CheckCircle, FileXls, FileCsv } from "@phosphor-icons/react";

export default function DataManager() {
  const [tab, setTab] = useState("import");
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState(null);
  const [importing, setImporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [importMode, setImportMode] = useState("replace");
  const [dragActive, setDragActive] = useState(false);

  const loadStats = useCallback(() => {
    getDbStats().then(res => setStats(res.data)).catch(console.error);
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleImport = async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsm|xlsx|xls)$/i)) {
      setMessage({ type: "error", text: "Please upload an Excel file (.xlsm or .xlsx)" });
      return;
    }

    setImporting(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await importExcel(formData, importMode);
      setMessage({ type: "success", text: res.data.message });
      loadStats();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Import failed" });
    } finally {
      setImporting(false);
    }
  };

  const handleRestore = async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setMessage({ type: "error", text: "Please upload a .json backup file" });
      return;
    }

    setRestoring(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await restoreBackup(formData);
      setMessage({ type: "success", text: res.data.message });
      loadStats();
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.detail || "Restore failed" });
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
    <div data-testid="data-manager-page" className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-light tracking-tight">Data Manager</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Import Excel data, export records, and backup/restore your database</p>
      </div>

      {/* DB Stats */}
      {stats && (
        <div className="flex gap-4">
          <div className="bg-white border border-[var(--border-subtle)] px-5 py-3 rounded-sm flex items-center gap-3">
            <Database size={20} weight="duotone" className="text-[var(--brand)]" />
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-secondary)]">Database</p>
              <p className="font-mono text-sm font-medium">{stats.items_count} items, {stats.advances_count} advances</p>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div data-testid="data-message" className={`p-4 border rounded-sm text-sm flex items-center gap-3 ${message.type === 'success' ? 'bg-[#455D4A10] border-[var(--success)] text-[var(--success)]' : 'bg-[#9E473D10] border-[var(--error)] text-[var(--error)]'}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <Warning size={20} />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        {[
          { key: "import", label: "Import Excel", icon: Upload },
          { key: "export", label: "Export Data", icon: DownloadSimple },
          { key: "backup", label: "Backup & Restore", icon: ArrowsClockwise },
        ].map(t => (
          <button
            key={t.key}
            data-testid={`data-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
              ${tab === t.key ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Import Tab */}
      {tab === "import" && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
            <h3 className="font-heading text-base font-medium">Import from Excel</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Upload your <code className="bg-[var(--bg)] px-1.5 py-0.5 rounded text-xs font-mono">New Retail Book.xlsm</code> file.
              The file must have <strong>"Item Details"</strong> and <strong>"Advances"</strong> sheets with the same column structure.
            </p>

            {/* Import Mode */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)]">Import Mode</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="importMode" value="replace" checked={importMode === "replace"} onChange={() => setImportMode("replace")} className="accent-[var(--brand)]" />
                  <span className="text-sm">Replace all data</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="importMode" value="append" checked={importMode === "append"} onChange={() => setImportMode("append")} className="accent-[var(--brand)]" />
                  <span className="text-sm">Append to existing</span>
                </label>
              </div>
              {importMode === "replace" && (
                <p className="text-xs text-[var(--warning)] flex items-center gap-1"><Warning size={14} /> This will delete all existing data before importing</p>
              )}
            </div>

            {/* Drop Zone */}
            <div
              data-testid="import-drop-zone"
              className={`border-2 border-dashed rounded-sm p-10 text-center transition-colors cursor-pointer
                ${dragActive ? 'border-[var(--brand)] bg-[#C86B4D08]' : 'border-[var(--border-strong)] hover:border-[var(--brand)]'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => handleDrop(e, handleImport)}
              onClick={() => document.getElementById('import-file-input')?.click()}
            >
              <FileXls size={40} weight="duotone" className="mx-auto text-[var(--brand)] mb-3" />
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {importing ? "Importing..." : "Drag & drop your Excel file here"}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">or click to browse (.xlsm, .xlsx)</p>
              <input
                id="import-file-input"
                data-testid="import-file-input"
                type="file"
                accept=".xlsm,.xlsx,.xls"
                className="hidden"
                onChange={(e) => handleImport(e.target.files?.[0])}
              />
            </div>
          </div>
        </div>
      )}

      {/* Export Tab */}
      {tab === "export" && (
        <div className="max-w-2xl space-y-4">
          <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
            <h3 className="font-heading text-base font-medium">Export to Excel</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Download all your data as an Excel file with the same column structure as your original workbook.
              Contains "Item Details" and "Advances" sheets.
            </p>
            <div className="flex gap-3">
              <a
                href={exportExcelUrl()}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="export-excel-btn"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] transition-all duration-200 hover:translate-y-[-1px]"
              >
                <FileXls size={18} weight="bold" /> Download Excel (.xlsx)
              </a>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              {stats && `Will export ${stats.items_count} items and ${stats.advances_count} advances`}
            </p>
          </div>
        </div>
      )}

      {/* Backup & Restore Tab */}
      {tab === "backup" && (
        <div className="max-w-2xl space-y-4">
          {/* Backup */}
          <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
            <h3 className="font-heading text-base font-medium">Create Backup</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Download a complete backup of your database as a JSON file. You can restore from this file later.
            </p>
            <a
              href={backupUrl()}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="backup-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-[var(--success)] text-white rounded-sm hover:opacity-90 transition-all duration-200 hover:translate-y-[-1px]"
            >
              <DownloadSimple size={18} weight="bold" /> Download Backup (.json)
            </a>
          </div>

          {/* Restore */}
          <div className="bg-white border border-[var(--border-subtle)] p-6 rounded-sm space-y-4">
            <h3 className="font-heading text-base font-medium">Restore from Backup</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Upload a previously downloaded backup file to restore your data.
            </p>
            <p className="text-xs text-[var(--error)] flex items-center gap-1">
              <Warning size={14} /> This will replace ALL existing data with the backup
            </p>
            <div
              data-testid="restore-drop-zone"
              className={`border-2 border-dashed rounded-sm p-8 text-center transition-colors cursor-pointer
                ${dragActive ? 'border-[var(--warning)] bg-[#D4984208]' : 'border-[var(--border-strong)] hover:border-[var(--warning)]'}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={(e) => handleDrop(e, handleRestore)}
              onClick={() => document.getElementById('restore-file-input')?.click()}
            >
              <ArrowsClockwise size={32} weight="duotone" className="mx-auto text-[var(--warning)] mb-2" />
              <p className="text-sm font-medium">{restoring ? "Restoring..." : "Drop backup .json file here"}</p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">or click to browse</p>
              <input
                id="restore-file-input"
                data-testid="restore-file-input"
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => handleRestore(e.target.files?.[0])}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
