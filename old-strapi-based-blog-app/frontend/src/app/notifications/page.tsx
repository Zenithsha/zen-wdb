'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getStrapiMediaUrl } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Bell, CheckCheck, Trash2, RefreshCw,
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import toast from 'react-hot-toast';
import { TYPE_META, type NotificationItem } from '@/components/layout/NotificationBell';

type FilterKey = 'all' | 'unread' | 'mentions' | 'reactions' | 'comments' | 'approvals';

const FILTERS: { id: FilterKey; label: string; match: (n: NotificationItem) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'unread', label: 'Unread', match: (n) => !n.read },
  { id: 'mentions', label: 'Mentions', match: (n) => n.type === 'mention' },
  { id: 'reactions', label: 'Reactions', match: (n) => n.type === 'reaction' },
  { id: 'comments', label: 'Comments', match: (n) => n.type === 'comment' || n.type === 'reply' },
  { id: 'approvals', label: 'Approvals', match: (n) => n.type === 'approval' || n.type === 'rejection' },
];

function groupByTime(items: NotificationItem[]): { label: string; rows: NotificationItem[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfWeek = startOfToday - 7 * 86_400_000;
  const today: NotificationItem[] = [];
  const yesterday: NotificationItem[] = [];
  const week: NotificationItem[] = [];
  const older: NotificationItem[] = [];
  for (const n of items) {
    const t = new Date(n.createdAt).getTime();
    if (t >= startOfToday) today.push(n);
    else if (t >= startOfYesterday) yesterday.push(n);
    else if (t >= startOfWeek) week.push(n);
    else older.push(n);
  }
  const out: { label: string; rows: NotificationItem[] }[] = [];
  if (today.length) out.push({ label: 'Today', rows: today });
  if (yesterday.length) out.push({ label: 'Yesterday', rows: yesterday });
  if (week.length) out.push({ label: 'This week', rows: week });
  if (older.length) out.push({ label: 'Older', rows: older });
  return out;
}

export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get<{ data: NotificationItem[]; meta: { unread: number } }>('/notifications/me');
      setItems(res.data.data || []);
      setUnread(res.data.meta?.unread || 0);
    } catch {
      if (!silent) toast.error('Failed to load notifications. Restart Strapi if you just added the feature.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { if (!isLoading && user) load(); /* eslint-disable-next-line */ }, [user, isLoading]);

  // Listen for the same custom event the bell broadcasts. Lets the page
  // refresh instantly when the bell dropdown reads or deletes a row.
  useEffect(() => {
    const onPing = () => load({ silent: true });
    window.addEventListener('xblog:notifications-ping', onPing);
    return () => window.removeEventListener('xblog:notifications-ping', onPing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dispatched after EVERY mutation so the NotificationBell in the
  // navbar re-fetches and stays in sync with what the page just changed
  // (read/unread, delete, clear all). The bell listens for this same
  // event already.
  const ping = () => {
    try { window.dispatchEvent(new Event('xblog:notifications-ping')); } catch { /* SSR */ }
  };

  const markRead = async (n: NotificationItem) => {
    if (n.read) return;
    setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try { await api.post(`/notifications/${n.documentId}/read`); } catch { /* ignore */ }
    ping();
  };

  const markAll = async () => {
    const prevItems = items;
    const prevUnread = unread;
    setItems((p) => p.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try {
      await api.post('/notifications/read-all');
      toast.success('All notifications marked as read');
    } catch (err: unknown) {
      // Restore state and show the real reason instead of a generic message.
      setItems(prevItems);
      setUnread(prevUnread);
      const e = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      const msg = e.response?.data?.error?.message;
      const status = e.response?.status;
      toast.error(
        status === 404
          ? 'Server route missing — restart Strapi (rm -rf .strapi).'
          : msg
          ? `Failed: ${msg}`
          : `Failed${status ? ` (${status})` : ''}`
      );
    }
    ping();
  };

  const removeOne = async (n: NotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setItems((p) => p.filter((x) => x.id !== n.id));
    if (!n.read) setUnread((u) => Math.max(0, u - 1));
    try {
      await api.delete(`/notifications/${n.documentId}`);
    } catch {
      toast.error('Failed to delete');
      load({ silent: true });
    }
    ping();
  };

  const clearAll = async () => {
    if (!confirm('Clear ALL notifications? This cannot be undone.')) return;
    const prev = items;
    setItems([]);
    setUnread(0);
    try {
      await api.delete('/notifications/all');
      toast.success('All notifications cleared');
    } catch {
      toast.error('Failed');
      setItems(prev);
    }
    ping();
  };

  const filtered = useMemo(() => {
    const fn = FILTERS.find((f) => f.id === filter)?.match || (() => true);
    return items.filter(fn);
  }, [items, filter]);

  const grouped = useMemo(() => groupByTime(filtered), [filtered]);

  if (!isLoading && !user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        <p>Please <Link href="/login" className="text-brand hover:underline">sign in</Link> to view notifications.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-brand" />
            Notifications
            {unread > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-brand text-brand-foreground text-xs font-semibold h-6 min-w-6 px-2 shadow-[0_0_12px_hsl(var(--brand)/0.5)]">
                {unread}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unread > 0 ? `${unread} unread.` : 'All caught up.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => load({ silent: true })} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {items.length > 0 && unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAll} className="gap-1.5">
              <CheckCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mark all</span>
            </Button>
          )}
          {items.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll} className="gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50">
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="border-b border-slate-200 mb-5 -mx-1 px-1 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 whitespace-nowrap">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const count = items.filter(f.match).length;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`relative px-3 py-2 text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                  active ? 'text-brand' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                  active ? 'bg-brand text-brand-foreground' : 'bg-slate-100 text-slate-600'
                }`}>{count}</span>
                <span className={`absolute left-3 right-3 bottom-0 h-[2px] rounded-full bg-brand transition-all duration-300 ${
                  active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-50'
                }`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed border-slate-200 bg-white/60">
          <Bell className="h-10 w-10 mx-auto mb-3 text-slate-400" />
          <p className="text-lg font-medium mb-1">
            {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
          </p>
          <p className="text-sm text-muted-foreground">
            {filter === 'all'
              ? "When someone reacts, comments, or mentions you — it'll show here."
              : 'Try a different filter to see more.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.label}>
              <h2 className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-2 px-1">
                {group.label}
              </h2>
              <ul className="space-y-2">
                {group.rows.map((n) => {
                  const meta = TYPE_META[n.type] || TYPE_META.announcement;
                  const Icon = meta.Icon;
                  const classes = `relative group block rounded-xl border transition-all overflow-hidden ${
                    n.read
                      ? 'border-slate-200 bg-white hover:border-slate-300'
                      : 'border-emerald-200 bg-brand-soft/40 hover:border-brand hover:bg-brand-soft/60'
                  }`;
                  const body = (
                    <div className="flex items-start gap-3 p-4 pr-12">
                      {n.actor ? (
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={getStrapiMediaUrl(n.actor.profilePicture?.url)} alt={n.actor.displayName} />
                          <AvatarFallback className="text-xs bg-brand-soft text-emerald-800 font-bold">
                            {n.actor.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <span className={`h-10 w-10 rounded-full ${meta.bg} flex items-center justify-center shrink-0`}>
                          <Icon className={`h-5 w-5 ${meta.tint}`} />
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className={`text-sm leading-snug ${n.read ? 'text-slate-600' : 'text-slate-900 font-medium'}`}>
                            {n.title}
                          </p>
                          {!n.read && <span className="mt-1 h-2 w-2 rounded-full bg-brand shadow-[0_0_6px_hsl(var(--brand))] shrink-0" />}
                        </div>
                        {n.message && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{n.message}</p>}
                        <p className="mt-1.5 text-[11px] text-slate-400 inline-flex items-center gap-1.5">
                          <Icon className={`h-3 w-3 ${meta.tint}`} />
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  );

                  // Per-row delete button (visible on hover or on touch).
                  const deleteBtn = (
                    <button
                      type="button"
                      onClick={(e) => removeOne(n, e)}
                      className="absolute top-3 right-3 h-7 w-7 rounded-full bg-white/80 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      aria-label="Delete notification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  );

                  return (
                    <li key={n.id}>
                      <div className={classes}>
                        {n.link ? (
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => { markRead(n); router.push(n.link!); }}
                          >
                            {body}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => markRead(n)}
                          >
                            {body}
                          </button>
                        )}
                        {deleteBtn}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
