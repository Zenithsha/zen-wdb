'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { showWelcomeBack } from '@/lib/welcomeToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LayoutDashboard,
  Users,
  FileText,
  Clock,
  MessageSquare,
  LogOut,
  ShieldCheck,
  Loader2,
  Megaphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { User } from '@/types';

const NAV = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/pending', label: 'Pending Review', icon: Clock },
  { href: '/admin/articles', label: 'All Articles', icon: FileText },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/comments', label: 'Comments', icon: MessageSquare },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout, refreshUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [loggingIn, setLoggingIn] = useState(false);
  const [creds, setCreds] = useState({ identifier: '', password: '' });

  useEffect(() => {
    // Auto-redirect non-admin authenticated users away from /admin
    if (!isLoading && user && user.role?.type !== 'admin') {
      // Keep them here so they see the login form (can sign in with admin creds)
    }
  }, [isLoading, user, router]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creds.identifier || !creds.password) {
      toast.error('Enter credentials');
      return;
    }
    setLoggingIn(true);
    try {
      const res = await api.post<{ jwt: string; user: User }>('/admin/login', creds);
      setToken(res.data.jwt);
      await refreshUser();
      showWelcomeBack(res.data.user?.displayName || res.data.user?.username || 'admin');
      router.refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  // ── Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Not admin → show login form
  if (!user || user.role?.type !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md border-slate-200 shadow-lg">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-900 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <CardDescription>
              Sign in with an admin account to access the control panel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Email or Username</label>
                <Input
                  value={creds.identifier}
                  onChange={(e) => setCreds((p) => ({ ...p, identifier: e.target.value }))}
                  placeholder="admin@example.com"
                  autoComplete="username"
                  disabled={loggingIn}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  value={creds.password}
                  onChange={(e) => setCreds((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loggingIn}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loggingIn}>
                {loggingIn ? 'Signing in...' : 'Sign In'}
              </Button>
              {user && user.role?.type !== 'admin' && (
                <p className="text-xs text-center text-muted-foreground">
                  You&apos;re signed in as <strong>{user.username}</strong> ({user.role?.type}). Log in
                  with an admin account instead.{' '}
                  <button type="button" onClick={logout} className="text-primary hover:underline">
                    Sign out
                  </button>
                </p>
              )}
              <p className="text-xs text-center text-muted-foreground pt-2 border-t">
                Not an admin?{' '}
                <Link href="/" className="text-primary hover:underline">
                  Back to site
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Admin shell ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col flex-shrink-0">
        <div className="h-16 px-6 flex items-center gap-2 border-b border-slate-800">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <span className="font-semibold">xBlog Admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-slate-800 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <div className="px-3 py-2 text-xs text-slate-400">
            Signed in as
            <div className="text-slate-200 font-medium truncate">{user.username}</div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              logout();
              router.push('/');
            }}
            className="w-full justify-start gap-2 text-slate-300 hover:text-white hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
          <Link
            href="/"
            className="block mt-1 text-center text-xs text-slate-400 hover:text-slate-200"
          >
            ← Back to public site
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
