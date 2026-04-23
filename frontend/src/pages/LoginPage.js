import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getPublicSettings } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { login, sessionExpired } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [firmName, setFirmName] = useState("Retail Book");

  useEffect(() => {
    getPublicSettings().then(s => { if (s?.firm_name) setFirmName(s.firm_name); }).catch(() => {});
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-950 rounded-2xl shadow-xl p-8">
        {sessionExpired && (
          <div className="mb-5 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center">
            ⏱ Your session has expired. Please sign in again.
          </div>
        )}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {firmName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Sign in to your account
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  );
}
