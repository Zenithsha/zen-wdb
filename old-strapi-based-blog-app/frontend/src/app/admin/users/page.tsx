'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, getStrapiMediaUrl } from '@/lib/api';
import type { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { timeAgo } from '@/lib/utils';
import { Search, UserPlus, Ban, CheckCircle, Users } from 'lucide-react';
import toast from 'react-hot-toast';

type AdminUser = User & {
  articleCount?: number;
};

const ROLE_FILTERS = ['all', 'admin', 'blogger', 'authenticated'] as const;
type RoleFilter = typeof ROLE_FILTERS[number];

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-slate-900 text-white',
  blogger: 'bg-purple-100 text-purple-800',
  authenticated: 'bg-slate-100 text-slate-700',
};

export default function AdminUsersPage() {
  // Honor ?role= from URL so the dashboard "Bloggers" card deep-links here.
  const searchParams = useSearchParams();
  const initialRole = (() => {
    const r = searchParams.get('role');
    return (ROLE_FILTERS as readonly string[]).includes(r || '') ? (r as RoleFilter) : 'all';
  })();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<RoleFilter>(initialRole);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '' });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (role !== 'all') params.set('role', role);
      if (q) params.set('q', q);
      const res = await api.get<{ data: AdminUser[] }>(`/admin/users?${params}`);
      setUsers(res.data.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const block = async (id: number) => {
    setBusy(id);
    try {
      await api.post(`/admin/users/${id}/block`);
      toast.success('User blocked');
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, blocked: true } : u)));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || 'Failed to block');
    } finally {
      setBusy(null);
    }
  };

  const unblock = async (id: number) => {
    setBusy(id);
    try {
      await api.post(`/admin/users/${id}/unblock`);
      toast.success('User reactivated');
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, blocked: false } : u)));
    } catch {
      toast.error('Failed to unblock');
    } finally {
      setBusy(null);
    }
  };

  const setRoleOf = async (id: number, roleType: string) => {
    setBusy(id);
    try {
      const res = await api.post<{ data: AdminUser }>(`/admin/users/${id}/role`, { data: { roleType } });
      toast.success(`Role changed to ${roleType}`);
      // Merge so locally-computed fields (articleCount) aren't wiped by the role-update response
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...res.data.data, articleCount: res.data.data.articleCount ?? u.articleCount } : u)));
    } catch {
      toast.error('Failed to change role');
    } finally {
      setBusy(null);
    }
  };

  const createBlogger = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/admin/users/blogger', { data: form });
      toast.success('Blogger created');
      setForm({ username: '', email: '', password: '', displayName: '' });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage accounts, roles, and access.</p>
      </div>

      <Card className="mb-6 border-slate-200">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Create Blogger Account
          </CardTitle>
          <CardDescription>Provision a writer directly. Password must be changed on first login.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createBlogger} className="grid md:grid-cols-4 gap-3">
            <Input placeholder="Username" value={form.username}
                   onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} required />
            <Input placeholder="Email" type="email" value={form.email}
                   onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
            <Input placeholder="Temp password" value={form.password}
                   onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required minLength={8} />
            <div className="flex gap-2">
              <Input placeholder="Display name (optional)" value={form.displayName}
                     onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))} />
              <Button type="submit" disabled={creating}>
                {creating ? '...' : 'Create'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        {ROLE_FILTERS.map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              role === r
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
        <form
          onSubmit={(e) => { e.preventDefault(); load(); }}
          className="ml-auto flex gap-2 items-center"
        >
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search username or email..." className="pl-8 w-64" />
          </div>
          <Button type="submit" variant="outline">Search</Button>
        </form>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              No users found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Articles</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Joined</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.profilePicture ? getStrapiMediaUrl(u.profilePicture.url) : undefined} />
                            <AvatarFallback className="text-xs">{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{u.username}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role?.type || 'authenticated'}
                          onChange={(e) => setRoleOf(u.id, e.target.value)}
                          disabled={busy === u.id}
                          className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${ROLE_STYLES[u.role?.type || 'authenticated']}`}
                        >
                          <option value="authenticated">Viewer</option>
                          <option value="blogger">Blogger</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.articleCount ?? 0}</td>
                      <td className="px-4 py-3">
                        {u.blocked ? (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-rose-100 text-rose-800 font-medium">Blocked</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 font-medium">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.createdAt ? timeAgo(u.createdAt) : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {u.blocked ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unblock(u.id)}
                            disabled={busy === u.id}
                            className="text-emerald-700 hover:bg-emerald-50 gap-1"
                          >
                            <CheckCircle className="h-4 w-4" /> Reactivate
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => block(u.id)}
                            disabled={busy === u.id}
                            className="text-rose-700 hover:bg-rose-50 gap-1"
                          >
                            <Ban className="h-4 w-4" /> Suspend
                          </Button>
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
    </div>
  );
}
