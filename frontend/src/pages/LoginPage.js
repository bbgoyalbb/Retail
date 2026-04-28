import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getPublicSettings, BACKEND_URL } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { Scissors, Eye, EyeSlash } from "@phosphor-icons/react";

export default function LoginPage() {
  const { login, sessionExpired } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [firmName, setFirmName] = useState("Retail Book");
  const [firmLogo, setFirmLogo] = useState(null);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    getPublicSettings().then(s => {
      if (s?.firm_name) setFirmName(s.firm_name);
      if (s?.firm_logo) setFirmLogo(s.firm_logo.startsWith("http") ? s.firm_logo : `${BACKEND_URL}${s.firm_logo}`);
    }).catch(() => {});
  }, []);

  const from = location.state?.from || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setBusy(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      toast({
        title: "Login failed",
        description: err?.response?.data?.detail || err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">
      {/* Left side - Login form */}
      <div className="flex-1 flex items-center justify-center p-4 lg:p-8">
        {/* Subtle background texture */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none lg:hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-[0.04]" style={{ background: "var(--brand)" }} />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-[0.04]" style={{ background: "var(--brand)" }} />
        </div>

        <div className="relative w-full max-w-sm">
          {/* Brand mark */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-sm flex items-center justify-center mb-4 shadow-sm overflow-hidden" style={{ background: firmLogo ? "transparent" : "var(--brand)" }}>
              {firmLogo
                ? <img src={firmLogo} alt={firmName} className="w-full h-full object-contain" style={{ borderRadius: "6px" }} />
                : <span className="text-white font-serif font-bold text-4xl leading-none">{firmName.charAt(0).toUpperCase()}</span>
              }
            </div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              {firmName}
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)] mt-1 flex items-center gap-1.5">
              <Scissors size={10} /> Fabric &amp; Tailoring
            </p>
          </div>

          {/* Card */}
          <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm shadow-sm p-8 space-y-6">
          {sessionExpired && (
            <div className="px-4 py-3 rounded-sm bg-[#D4984210] border border-[var(--warning)] text-[var(--warning)] text-sm text-center">
              ⏱ Your session has expired. Please sign in again.
            </div>
          )}

          <div>
            <h2 className="font-heading text-base font-medium text-[var(--text-primary)]">Sign in</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                className="w-full px-3 py-2.5 text-sm border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition-colors"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs uppercase tracking-[0.15em] font-semibold text-[var(--text-secondary)] block mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 pr-10 text-sm border border-[var(--border-subtle)] rounded-sm bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] transition-colors"
                />
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  {showPwd ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 text-sm font-semibold bg-[var(--brand)] text-white rounded-sm hover:bg-[var(--brand-hover)] disabled:opacity-60 transition-all duration-150 active:scale-[0.99] tracking-wide mt-2"
            >
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-[var(--text-secondary)] mt-6 tracking-[0.1em] uppercase">
          Retail Management System
        </p>
        </div>
      </div>

      {/* Right side - decorative panel (desktop only) */}
      <div className="hidden lg:block lg:flex-1 relative bg-[#2D2A26] overflow-hidden">
        {/* CSS-only woven fabric pattern — no external dependency */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            #C86B4D 0px, #C86B4D 1px,
            transparent 1px, transparent 12px
          ), repeating-linear-gradient(
            -45deg,
            #C86B4D 0px, #C86B4D 1px,
            transparent 1px, transparent 12px
          )`
        }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2D2A26] via-[#2D2A26]/40 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="font-heading text-2xl font-light tracking-tight mb-2">Crafted for Fabric Professionals</p>
          <p className="text-sm text-white/70">Manage inventory, tailoring, and settlements in one elegant ledger.</p>
        </div>
      </div>
    </div>
  );
}
