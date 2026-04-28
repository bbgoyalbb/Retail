import { useState, useEffect, useCallback } from "react";
import { listUsers, registerUser, updateUser, deleteUser } from "@/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, PencilSimple, Trash, LockKey, CheckCircle, XCircle, UserCircle, ShieldCheck, Lock, Info } from "@phosphor-icons/react";

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
    return <div className="text-center py-20 text-[var(--text-secondary)]">Access restricted to administrators.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-light tracking-tight text-[var(--text-primary)]">User Management</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Manage who can access the app</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand)] text-white rounded-sm text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <UserPlus size={16} weight="bold" />
          Add User
        </button>
      </div>

      {/* User list */}
      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--text-secondary)] text-sm">Loading...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)] text-sm">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg)]">
                <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-[var(--text-secondary)] font-medium">User</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-[var(--text-secondary)] font-medium">Role</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-[var(--text-secondary)] font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-[var(--text-secondary)] font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.username} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserCircle size={28} className="text-[var(--text-secondary)]" />
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{u.full_name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{roleBadge(u.role)}</td>
                  <td className="px-4 py-3">
                    {u.is_active
                      ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={14} weight="fill" />Active</span>
                      : <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle size={14} weight="fill" />Disabled</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setEditUser({ ...u })} title="Edit" className="p-1.5 rounded-sm hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <PencilSimple size={15} />
                      </button>
                      <button onClick={() => setResetUser(u)} title="Reset password" className="p-1.5 rounded-sm hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                        <LockKey size={15} />
                      </button>
                      {u.username !== "admin" && (
                        <button onClick={() => openPagesEditor(u)} title="Page permissions" className="p-1.5 rounded-sm hover:bg-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--brand)] transition-colors">
                          <ShieldCheck size={15} />
                        </button>
                      )}
                      <button onClick={() => handleToggleActive(u)} title={u.is_active ? "Disable" : "Enable"}
                        className={`p-1.5 rounded-sm hover:bg-[var(--border-subtle)] transition-colors ${u.is_active ? "text-green-600" : "text-red-500"}`}
                        disabled={u.username === "admin"}
                      >
                        {u.is_active ? <CheckCircle size={15} /> : <XCircle size={15} />}
                      </button>
                      {u.username !== "admin" && u.username !== me.username && (
                        deleteConfirm === u.username ? (
                          <span className="flex items-center gap-1 text-xs">
                            <button onClick={() => handleDelete(u)} className="px-2 py-0.5 bg-red-500 text-white rounded-sm text-[10px] hover:bg-red-600">Delete</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-2 py-0.5 border border-[var(--border-subtle)] rounded-sm text-[10px] hover:bg-[var(--bg)]">Cancel</button>
                          </span>
                        ) : (
                          <button onClick={() => setDeleteConfirm(u.username)} title="Delete" className="p-1.5 rounded-sm hover:bg-red-50 text-[var(--text-secondary)] hover:text-red-600 transition-colors">
                            <Trash size={15} />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="font-heading text-lg font-semibold">Add New User</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-medium block mb-1">Full Name</label>
                <input className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. John Doe" required />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-medium block mb-1">Username</label>
                <input className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") }))} placeholder="e.g. john" required />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-medium block mb-1">Password</label>
                <input type="password" className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" required />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-medium block mb-1">Role</label>
                <select className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]"
                  value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] transition-colors">Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {busy ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm w-full max-w-md p-6 space-y-4 shadow-xl">
            <h2 className="font-heading text-lg font-semibold">Edit User — @{editUser.username}</h2>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-medium block mb-1">Full Name</label>
                <input className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  value={editUser.full_name} onChange={e => setEditUser(u => ({ ...u, full_name: e.target.value }))} required />
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-medium block mb-1">Role</label>
                <select className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)] bg-[var(--surface)]"
                  value={editUser.role} onChange={e => setEditUser(u => ({ ...u, role: e.target.value }))}
                  disabled={editUser.username === "admin"}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditUser(null)} className="flex-1 px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] transition-colors">Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {busy ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Page Permissions Modal */}
      {pagesUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={18} className="text-[var(--brand)]" />
              <h2 className="font-heading text-lg font-semibold">Page Access — @{pagesUser.username}</h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-1">Role: <span className="font-medium text-[var(--text-primary)] capitalize">{pagesUser.role}</span></p>
            <div className="flex items-center gap-2 mb-4 p-2 bg-[var(--bg)] rounded-sm border border-[var(--border-subtle)]">
              <Info size={14} className="text-[var(--info)] flex-shrink-0" />
              <p className="text-[11px] text-[var(--text-secondary)]">Pages marked with <Lock size={10} className="inline" /> are unavailable for this user's role. Other pages can be allowed or blocked by admin.</p>
            </div>
            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {ALL_PAGES.map(group => (
                <div key={group.group}>
                  <p className="text-[9px] uppercase tracking-widest font-semibold text-[var(--border-strong)] mb-2">{group.group}</p>
                  <div className="space-y-1">
                    {group.pages.map(pg => {
                      const roleAllowed = ROLE_PAGE_ACCESS[pagesUser.role]?.includes(pg.path);
                      const isChecked = pagesSelection.includes(pg.path);
                      return (
                        <label 
                          key={pg.path} 
                          className={`flex items-center gap-3 px-3 py-2 rounded-sm ${roleAllowed ? 'hover:bg-[var(--bg)] cursor-pointer' : 'bg-[var(--bg)]/50 cursor-not-allowed'}`}
                          title={roleAllowed ? (isChecked ? 'Allowed by admin' : 'Blocked by admin') : `Unavailable for ${pagesUser.role} role`}
                        >
                          {roleAllowed ? (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePage(pg.path)}
                              className="accent-[var(--brand)] w-4 h-4"
                            />
                          ) : (
                            <Lock size={16} className="text-[var(--text-secondary)]" />
                          )}
                          <span className={`text-sm ${roleAllowed ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                            {pg.label}
                          </span>
                          {!roleAllowed && (
                            <span className="ml-auto text-[10px] text-[var(--text-secondary)] bg-[var(--border-subtle)] px-1.5 py-0.5 rounded-sm">
                              {pagesUser.role} only
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setPagesUser(null)} className="flex-1 px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] transition-colors">Cancel</button>
              <button onClick={handleSavePages} disabled={busy} className="flex-1 px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
                {busy ? "Saving..." : "Save Permissions"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] rounded-sm w-full max-w-sm p-6 space-y-4 shadow-xl">
            <h2 className="font-heading text-lg font-semibold">Reset Password — @{resetUser.username}</h2>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-widest text-[var(--text-secondary)] font-medium block mb-1">New Password</label>
                <input type="password" className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)] rounded-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" required autoFocus />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setResetUser(null); setNewPassword(""); }} className="flex-1 px-4 py-2 text-sm border border-[var(--border-subtle)] rounded-sm hover:bg-[var(--bg)] transition-colors">Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 px-4 py-2 text-sm bg-[var(--brand)] text-white rounded-sm hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {busy ? "Saving..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
