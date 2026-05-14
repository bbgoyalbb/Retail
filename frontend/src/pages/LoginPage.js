import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/components/ThemeProvider";
import { getPublicSettings, BACKEND_URL } from "@/api";
import { useToast } from "@/hooks/use-toast";
import { Scissors, Eye, EyeSlash, Lock, User, ArrowsClockwise, ShieldCheck } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { login, sessionExpired } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { theme } = useTheme();
  const [firmName, setFirmName] = useState("Retail Book");
  const [firmLogo, setFirmLogo] = useState(null);
  const [firmLogoDark, setFirmLogoDark] = useState(null);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    getPublicSettings().then(s => {
      if (s?.firm_name) setFirmName(s.firm_name);
      if (s?.firm_logo) setFirmLogo(s.firm_logo.startsWith("http") ? s.firm_logo : `${BACKEND_URL}${s.firm_logo}`);
      if (s?.firm_logo_dark) setFirmLogoDark(s.firm_logo_dark.startsWith("http") ? s.firm_logo_dark : `${BACKEND_URL}${s.firm_logo_dark}`);
    }).catch(() => {});
  }, []);

  const activeLogo = theme === 'dark' ? (firmLogoDark || firmLogo) : firmLogo;

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
    <div className="min-h-screen flex bg-background overflow-hidden selection:bg-primary/20">
      {/* Left side - Login form */}
      <div className="relative flex-1 flex items-center justify-center p-6 lg:p-12 z-10">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="relative w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          {/* Brand mark */}
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-3xl bg-primary/5 p-1 mb-6 shadow-2xl shadow-primary/10 border border-primary/10 transition-transform hover:scale-105 duration-500 overflow-hidden flex items-center justify-center">
              {activeLogo ? (
                <img src={activeLogo} alt={firmName} className="w-full h-full object-contain p-2" />
              ) : (
                <div className="w-full h-full bg-primary flex items-center justify-center">
                  <span className="text-white font-black text-4xl">{firmName.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
            <h1 className="font-heading text-3xl font-black tracking-tighter text-foreground mb-1">
              {firmName}
            </h1>
            <p className="text-[10px] uppercase tracking-[0.4em] font-black text-muted-foreground/60 flex items-center gap-2">
              <Scissors size={12} weight="bold" /> Fabric & Tailoring
            </p>
          </div>

          <Card className="border-none shadow-2xl shadow-black/10 bg-card/50 backdrop-blur-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
            <CardHeader className="pb-4 pt-8">
              {sessionExpired && (
                <div className="mb-6 p-4 rounded-xl bg-warning/10 border border-warning/20 flex items-center gap-3 animate-in shake duration-500">
                  <div className="p-1.5 rounded-full bg-warning text-white">
                    <ArrowsClockwise size={12} weight="bold" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-warning">Session Expired ● Sign In</p>
                </div>
              )}
              <CardTitle className="text-xl font-black uppercase tracking-tight text-foreground">Sign In</CardTitle>
              <p className="text-xs text-muted-foreground font-medium mt-1">Initialize your operational session</p>
            </CardHeader>
            <CardContent className="pb-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="username" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground ml-1 flex items-center gap-2">
                    <User size={12} weight="bold" /> Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    placeholder="Enter identity"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="w-full h-12 px-4 text-sm font-bold bg-muted/30 border border-border/50 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/30"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground ml-1 flex items-center gap-2">
                    <Lock size={12} weight="bold" /> Security Key
                  </label>
                  <div className="relative group">
                    <input
                      id="password"
                      type={showPwd ? "text" : "password"}
                      placeholder="Enter credentials"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full h-12 px-4 pr-12 text-sm font-bold bg-muted/30 border border-border/50 rounded-2xl focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/30"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPwd(p => !p)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {showPwd ? <EyeSlash size={18} weight="bold" /> : <Eye size={18} weight="bold" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={busy || !username || !password}
                  className="w-full h-14 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 gap-3 transition-all active:scale-[0.98] mt-4"
                >
                  {busy ? (
                    <div className="flex items-center gap-2">Authenticating <ArrowsClockwise size={20} className="animate-spin" /></div>
                  ) : (
                    <><ShieldCheck size={20} weight="bold" /> Access System</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="flex flex-col items-center gap-4 pt-4">
            <p className="text-[9px] uppercase tracking-[0.3em] font-black text-muted-foreground/40">
              Retail Management Engine v2.0
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Decorative visual panel */}
      <div className="hidden lg:flex lg:flex-1 relative bg-[#1a1917] overflow-hidden">
        {/* Professional architectural background */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #C86B4D 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />
        
        <div className="absolute inset-0 flex items-center justify-center p-20">
          <div className="relative w-full max-w-lg aspect-square border border-primary/10 rounded-[4rem] flex items-center justify-center animate-in zoom-in-95 duration-1000">
            <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full" />
            <div className="relative text-center space-y-6 p-12">
              <div className="w-16 h-1 bg-primary mx-auto rounded-full mb-8" />
              <h2 className="font-heading text-5xl font-black tracking-tighter text-white leading-none">
                Precision <span className="text-primary italic">Craftsmanship</span>
              </h2>
              <p className="text-lg text-white/50 font-medium leading-relaxed">
                A world-class administrative suite designed specifically for the fabric industry. Manage inventory, tailoring protocols, and financial settlements with surgical precision.
              </p>
              <div className="pt-8 flex items-center justify-center gap-8">
                {[
                  { label: "Inventory", icon: Scissors },
                  { label: "Ledger", icon: Receipt },
                  { label: "Security", icon: ShieldCheck },
                ].map(item => (
                  <div key={item.label} className="flex flex-col items-center gap-2">
                    <div className="p-3 rounded-2xl bg-white/5 text-primary border border-white/5">
                      <item.icon size={20} weight="duotone" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom branding */}
        <div className="absolute bottom-12 left-12 flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/20" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Premium Enterprise Edition</span>
            <span className="text-[9px] font-medium text-white/30">Proprietary Software Protocol</span>
          </div>
        </div>
      </div>
    </div>
  );
}
