import { useState, useCallback, useEffect, useRef } from "react";
import { Bug, X, PaperPlaneRight, CheckCircle, Warning, ClipboardText } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { submitBugReport } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * BugReportButton - Floating button to report bugs from anywhere in the app
 * Captures: current page, user agent, recent console logs, user description
 */
export function BugReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [logs, setLogs] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const logsRef = useRef([]);
  const { toast } = useToast();

  // Capture console logs
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
      const entry = { type: "log", message: msg.slice(0, 500), timestamp: new Date().toISOString() };
      logsRef.current = [...logsRef.current.slice(-49), entry];
      setLogs(logsRef.current);
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
      const entry = { type: "error", message: msg.slice(0, 500), timestamp: new Date().toISOString() };
      logsRef.current = [...logsRef.current.slice(-49), entry];
      setLogs(logsRef.current);
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      const msg = args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ");
      const entry = { type: "warn", message: msg.slice(0, 500), timestamp: new Date().toISOString() };
      logsRef.current = [...logsRef.current.slice(-49), entry];
      setLogs(logsRef.current);
      originalWarn.apply(console, args);
    };

    const handleError = (event) => {
      const entry = {
        type: "error",
        message: `Global Error: ${event.message} at ${event.filename}:${event.lineno}`,
        timestamp: new Date().toISOString(),
      };
      logsRef.current = [...logsRef.current.slice(-49), entry];
      setLogs(logsRef.current);
    };

    window.addEventListener("error", handleError);

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener("error", handleError);
    };
  }, []);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setShowSuccess(false);
    setTitle("");
    setDescription("");
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() && !description.trim()) {
      toast({
        title: "Please describe the bug",
        description: "Add a title or description to help us understand the issue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user from session storage
      let username = "anonymous";
      try {
        const userJson = sessionStorage.getItem("user");
        if (userJson) {
          const user = JSON.parse(userJson);
          username = user.username || "anonymous";
        }
      } catch {
        // Ignore
      }

      const bugData = {
        title: title.trim() || "Bug Report",
        description: description.trim(),
        page: window.location.pathname + window.location.search,
        userAgent: navigator.userAgent,
        consoleLogs: logsRef.current.slice(-20), // Send last 20 logs
        username,
        timestamp: new Date().toISOString(),
      };

      await submitBugReport(bugData);

      setShowSuccess(true);
      toast({
        title: "Bug report submitted",
        description: "Thank you! We'll investigate this issue.",
        variant: "success",
      });

      // Close after 2 seconds
      setTimeout(() => {
        setIsOpen(false);
        setShowSuccess(false);
        setTitle("");
        setDescription("");
      }, 2000);

    } catch (error) {
      toast({
        title: "Failed to submit",
        description: error?.message || "Please try again or contact support directly.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [title, description, toast]);

  if (showSuccess) {
    return (
      <div className="fixed bottom-6 right-6 z-[200]">
        <div className="bg-success text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
          <CheckCircle size={24} weight="bold" />
          <div>
            <p className="font-bold">Bug report sent!</p>
            <p className="text-sm opacity-90">Thank you for helping us improve.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={handleOpen}
        className={cn(
          "fixed bottom-6 right-6 z-[150] h-14 w-14 rounded-full shadow-2xl",
          "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600",
          "text-white border-2 border-white/20",
          "transition-transform duration-150 hover:scale-110 hover:shadow-orange-500/30",
          "flex items-center justify-center"
        )}
        title="Report a Bug"
      >
        <Bug size={28} weight="bold" />
      </Button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border/50 overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 px-6 py-4 border-b border-border/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20 text-orange-600">
                  <Bug size={24} weight="bold" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Report a Bug</h2>
                  <p className="text-xs text-muted-foreground">Help us improve your experience</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-9 w-9 rounded-full hover:bg-muted"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Page Info */}
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                <ClipboardText size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="font-medium text-muted-foreground">Current Page</p>
                  <p className="font-mono text-xs truncate">{window.location.pathname}</p>
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">Bug Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., 'Split button not working'"
                  className="w-full h-10 px-3 rounded-md border border-border/50 bg-background focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors outline-none"
                />
              </div>

              {/* Description Input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">What happened? *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you were doing and what went wrong..."
                  rows={4}
                  className="w-full p-3 rounded-md border border-border/50 bg-background focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all outline-none resize-none"
                />
              </div>

              {/* Console Logs Preview */}
              {logsRef.current.filter(l => l.type === "error").length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Warning size={16} className="text-destructive" />
                    <span className="font-medium text-destructive">
                      {logsRef.current.filter(l => l.type === "error").length} error(s) detected in this session
                    </span>
                  </div>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {logsRef.current
                      .filter(l => l.type === "error")
                      .slice(-3)
                      .map((log, i) => (
                        <p key={i} className="text-xs font-mono text-destructive/80 line-clamp-2">
                          {log.message}
                        </p>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border/50 flex justify-end gap-3 bg-muted/30">
              <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || (!title.trim() && !description.trim())}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="animate-spin">⟳</span> Sending...
                  </>
                ) : (
                  <>
                    <PaperPlaneRight size={18} weight="bold" />
                    Send Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BugReportButton;
