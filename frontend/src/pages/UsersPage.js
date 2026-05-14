import { useState, useEffect, useCallback } from "react";
import { listUsers, registerUser, updateUser, deleteUser } from "@/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { 
  UserPlus, PencilSimple, Trash, LockKey, CheckCircle, 
  XCircle, UserCircle, ShieldCheck, Lock, Info, 
  ArrowsClockwise, X, Shield, UsersThree, Key
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ALL_PAGES = [
  { group: "General", pages: [
    { path: "/", label: "Dashboard" },
    { path: "/new-bill", label: "New Bill" },
    { path: "/jobwork", label: "Job Work" },
    { path: "/order-status", label: "Order Status" },
  ]},
  { group: "Finances", pages: [
    { path: "/daybook", label: "Daybook" },
    { path: "/labour", label: "Labour Payments" },
  ]},
  { group: "Manage", pages: [
    { path: "/items", label: "Manage Orders" },
    { path: "/reports", label: "Reports" },
  ]},
];

// Role-based page access mapping - pages each role can potentially access
const ROLE_PAGE_ACCESS = {
  cashier: ["/", "/new-bill", "/jobwork", "/order-status"],
  manager: ["/", "/new-bill", "/jobwork", "/order-status", "/daybook", "/labour", "/items", "/reports"],
  admin: ["/", "/new-bill", "/jobwork", "/order-status", "/daybook", "/labour", "/items", "/reports", "/data", "/settings", "/users", "/audit"],
};

const ROLES = ["admin", "manager", "cashier"];

const EMPTY_FORM = { username: "", password: "", full_name: "", role: "cashier" };

function RoleBadge({ role }) {
  const styles = {
    admin: "text-destructive bg-destructive/10 border-destructive/20",
    manager: "text-info bg-info/10 border-info/20",
    cashier: "text-success bg-success/10 border-success/20",
  };
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border-none transition-all",
        styles[role] || "text-muted-foreground bg-muted/30"
      )}
    >
      {role}
    </Badge>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [pagesUser, setPagesUser] = useState(null);
  const [pagesSelection, setPagesSelection] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.username || !form.password || !form.full_name) return;
    setBusy(true);
    try {
      await registerUser(form);
      toast({ title: "User created", description: `${form.full_name} (${form.username}) added.` });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      fetchUsers();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateUser(editUser.username, { full_name: editUser.full_name, role: editUser.role });
      toast({ title: "User updated" });
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleActive = async (u) => {
    try {
      await updateUser(u.username, { is_active: !u.is_active });
      toast({ title: u.is_active ? "User disabled" : "User enabled" });
      fetchUsers();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openPagesEditor = (u) => {
    setPagesUser(u);
    setPagesSelection(u.allowed_pages?.length > 0 ? [...u.allowed_pages] : ALL_PAGES.flatMap(g => g.pages.map(p => p.path)));
  };

  const togglePage = (path) => {
    setPagesSelection(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
  };

  const handleSavePages = async () => {
    setBusy(true);
    try {
      const allPaths = ALL_PAGES.flatMap(g => g.pages.map(p => p.path));
      const isAll = allPaths.every(p => pagesSelection.includes(p));
      await updateUser(pagesUser.username, { allowed_pages: isAll ? [] : pagesSelection });
      toast({ title: "Page permissions saved" });
      setPagesUser(null);
      fetchUsers();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) return;
    setBusy(true);
    try {
      await updateUser(resetUser.username, { password: newPassword });
      toast({ title: "Password reset", description: `Password updated for ${resetUser.username}.` });
      setResetUser(null);
      setNewPassword("");
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (u) => {
    try {
      await deleteUser(u.username);
      toast({ title: "User deleted" });
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const roleBadge = (role) => {
    const colors = { admin: "bg-red-100 text-red-700", manager: "bg-blue-100 text-blue-700", cashier: "bg-green-100 text-green-700" };
    return <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full ${colors[role] || "bg-gray-100 text-gray-600"}`}>{role}</span>;
  };

  if (me?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6 animate-in zoom-in-95 duration-300">
        <div className="p-6 rounded-full bg-destructive/10 text-destructive">
          <Shield size={48} weight="duotone" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-black uppercase tracking-widest text-destructive">Security Violation</p>
          <p className="text-sm text-muted-foreground font-medium">Access to user protocols is restricted to administrators only.</p>
        </div>
        <Button onClick={() => window.history.back()} variant="outline" className="px-8 font-black uppercase tracking-widest text-xs">
          Return to Base
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl sm:text-4xl font-black tracking-tight text-primary truncate">Personnel</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 font-medium truncate">Control authentication protocols and operational permissions</p>
        </div>
        <Button
          onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); }}
          className="h-12 px-6 font-black uppercase tracking-[0.15em] text-xs shadow-lg shadow-primary/20 gap-2 transition-all active:scale-95"
        >
          <UserPlus size={20} weight="bold" />
          Add Personnel
        </Button>
      </div>

      <Card className="border-none shadow-xl shadow-black/5 overflow-hidden bg-background min-h-[400px]">
        <CardHeader className="px-6 py-4 border-b border-border/50 bg-background/50 backdrop-blur-md flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <UsersThree size={18} weight="duotone" />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Agent Roster</CardTitle>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{loading ? "Synchronizing..." : `${users.length} Active Accounts`}</span>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading} className="h-9 w-9 rounded-full">
            <ArrowsClockwise size={16} className={loading ? "animate-spin" : ""} />
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 px-6 text-center animate-in zoom-in-95 duration-500">
              <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mb-6">
                <UsersThree size={40} className="text-muted-foreground opacity-40" weight="duotone" />
              </div>
              <h3 className="text-lg font-black uppercase tracking-[0.2em] text-foreground mb-2">Roster Empty</h3>
              <p className="text-sm text-muted-foreground font-medium max-w-[280px] leading-relaxed">
                No personnel accounts detected. Initialize your first operational agent.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/50">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Agent Identity</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Clearance</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Operation State</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-left">Initialized</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {users.map(u => (
                    <tr key={u.username} className="hover:bg-primary/[0.01] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground group-hover:border-primary/30 group-hover:text-primary transition-all overflow-hidden">
                            <UserCircle size={24} weight="duotone" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">{u.full_name}</span>
                            <span className="font-mono text-[10px] font-bold text-muted-foreground opacity-60">@{u.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {u.is_active ? (
                            <Badge variant="outline" className="h-6 px-2 bg-success/5 border-success/20 text-success text-[9px] font-black uppercase tracking-widest">
                              <CheckCircle size={10} weight="fill" className="mr-1" /> Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="h-6 px-2 bg-destructive/5 border-destructive/20 text-destructive text-[9px] font-black uppercase tracking-widest">
                              <XCircle size={10} weight="fill" className="mr-1" /> Disabled
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-[11px] font-black text-muted-foreground opacity-60">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditUser({ ...u })} className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full">
                            <PencilSimple size={16} weight="bold" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setResetUser(u)} className="h-8 w-8 text-muted-foreground hover:text-warning hover:bg-warning/10 rounded-full">
                            <Key size={16} weight="bold" />
                          </Button>
                          {u.username !== "admin" && (
                            <Button variant="ghost" size="icon" onClick={() => openPagesEditor(u)} className="h-8 w-8 text-muted-foreground hover:text-info hover:bg-info/10 rounded-full">
                              <ShieldCheck size={16} weight="bold" />
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleToggleActive(u)} 
                            disabled={u.username === "admin"}
                            className={cn(
                              "h-8 w-8 rounded-full",
                              u.is_active ? "text-success hover:bg-success/10" : "text-destructive hover:bg-destructive/10"
                            )}
                          >
                            {u.is_active ? <CheckCircle size={16} weight="bold" /> : <XCircle size={16} weight="bold" />}
                          </Button>
                          {u.username !== "admin" && u.username !== me.username && (
                            <div className="ml-2 flex items-center">
                              {deleteConfirm === u.username ? (
                                <div className="flex items-center gap-1 animate-in slide-in-from-right-2">
                                  <Button size="sm" variant="destructive" onClick={() => handleDelete(u)} className="h-7 px-2 text-[10px] font-black uppercase tracking-widest">Confirm</Button>
                                  <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(null)} className="h-7 px-2 text-[10px] font-black uppercase tracking-widest">X</Button>
                                </div>
                              ) : (
                                <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(u.username)} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full">
                                  <Trash size={16} weight="bold" />
                                </Button>
                              )}
                            </div>
                          )}
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

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="max-w-md w-full shadow-2xl border-border/50 animate-in zoom-in-95 duration-300">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">Initialize Agent</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Identity</label>
                  <input className="w-full h-11 px-4 text-xs font-bold bg-muted/30 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Alexander Pierce" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Agent Username</label>
                  <input className="w-full h-11 px-4 text-xs font-black font-mono bg-muted/30 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") }))} placeholder="e.g. alexp" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Security Key</label>
                  <input type="password" className="w-full h-11 px-4 text-xs font-black font-mono bg-muted/30 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Clearance Role</label>
                  <select className="w-full h-11 px-4 text-[11px] font-black uppercase tracking-widest bg-muted/30 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                    value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setShowAdd(false)} className="flex-1 h-11 font-black uppercase tracking-widest text-[10px]">Abort</Button>
                  <Button type="submit" disabled={busy} className="flex-1 h-11 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                    {busy ? "Processing..." : "Deploy Agent"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="max-w-md w-full shadow-2xl border-border/50 animate-in zoom-in-95 duration-300">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">Modify Agent</CardTitle>
                <Badge variant="outline" className="w-fit font-mono text-[10px] bg-primary/5 text-primary border-primary/20 uppercase">@{editUser.username}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEdit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Full Identity</label>
                  <input className="w-full h-11 px-4 text-xs font-bold bg-muted/30 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={editUser.full_name} onChange={e => setEditUser(u => ({ ...u, full_name: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Clearance Role</label>
                  <select className="w-full h-11 px-4 text-[11px] font-black uppercase tracking-widest bg-muted/30 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none cursor-pointer"
                    value={editUser.role} onChange={e => setEditUser(u => ({ ...u, role: e.target.value }))}
                    disabled={editUser.username === "admin"}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setEditUser(null)} className="flex-1 h-11 font-black uppercase tracking-widest text-[10px]">Discard</Button>
                  <Button type="submit" disabled={busy} className="flex-1 h-11 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                    {busy ? "Processing..." : "Commit Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Page Permissions Modal */}
      {pagesUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="max-w-md w-full shadow-2xl border-border/50 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <CardHeader className="pb-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-info/10 text-info">
                  <ShieldCheck size={22} weight="duotone" />
                </div>
                <div className="flex flex-col">
                  <CardTitle className="text-lg font-black uppercase tracking-tight">Access Control</CardTitle>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">@ {pagesUser.username} ● {pagesUser.role}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-8">
                <div className="flex items-start gap-3 p-4 bg-info/5 border border-info/10 rounded-xl">
                  <Info size={18} className="text-info mt-0.5" weight="duotone" />
                  <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                    Pages marked with <Lock size={10} className="inline mx-1" /> are role-restricted. Administrators can toggle remaining endpoints for this agent.
                  </p>
                </div>

                <div className="space-y-8">
                  {ALL_PAGES.map(group => (
                    <div key={group.group} className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-40 ml-1">{group.group} Endpoints</h4>
                      <div className="grid grid-cols-1 gap-2">
                        {group.pages.map(pg => {
                          const roleAllowed = ROLE_PAGE_ACCESS[pagesUser.role]?.includes(pg.path);
                          const isChecked = pagesSelection.includes(pg.path);
                          return (
                            <label 
                              key={pg.path} 
                              className={cn(
                                "flex items-center justify-between p-3 rounded-xl border transition-all select-none",
                                roleAllowed ? "bg-background border-border/50 hover:border-primary/30 cursor-pointer" : "bg-muted/30 border-border/20 opacity-40 cursor-not-allowed"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                {roleAllowed ? (
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => togglePage(pg.path)}
                                    className="w-4 h-4 rounded border-border/50 text-primary focus:ring-primary/20 accent-primary transition-all"
                                  />
                                ) : (
                                  <div className="w-4 h-4 flex items-center justify-center text-muted-foreground">
                                    <Lock size={14} weight="bold" />
                                  </div>
                                )}
                                <span className={cn(
                                  "text-xs font-black uppercase tracking-tight",
                                  roleAllowed ? "text-foreground" : "text-muted-foreground"
                                )}>
                                  {pg.label}
                                </span>
                              </div>
                              {!roleAllowed && (
                                <Badge variant="outline" className="text-[8px] font-black uppercase tracking-tighter bg-muted/50 border-none text-muted-foreground px-1.5 py-0">
                                  {pagesUser.role} Only
                                </Badge>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <div className="p-6 border-t border-border/50 bg-background/80 backdrop-blur-md">
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setPagesUser(null)} className="flex-1 h-11 font-black uppercase tracking-widest text-[10px]">Cancel</Button>
                <Button onClick={handleSavePages} disabled={busy} className="flex-1 h-11 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                  {busy ? "Syncing..." : "Sync Permissions"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <Card className="max-w-sm w-full shadow-2xl border-border/50 animate-in zoom-in-95 duration-300">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-lg font-black uppercase tracking-[0.2em]">Reset Sequence</CardTitle>
                <Badge variant="outline" className="w-fit font-mono text-[10px] bg-warning/5 text-warning border-warning/20 uppercase">@{resetUser.username}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">New Security Key</label>
                  <input type="password" className="w-full h-11 px-4 text-xs font-black font-mono bg-muted/30 border border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" required autoFocus />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="ghost" onClick={() => { setResetUser(null); setNewPassword(""); }} className="flex-1 h-11 font-black uppercase tracking-widest text-[10px]">Cancel</Button>
                  <Button type="submit" disabled={busy} className="flex-1 h-11 font-black uppercase tracking-widest text-[10px] bg-warning hover:bg-warning/90 shadow-lg shadow-warning/20">
                    {busy ? "Updating..." : "Override Key"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
