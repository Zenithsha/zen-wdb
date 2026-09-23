'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getStrapiMediaUrl } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Bell, MessageSquare, Heart, AtSign, CheckCircle, AlertCircle, Sparkles, Megaphone, CheckCheck, X,
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import toast from 'react-hot-toast';

export interface NotificationItem {
  id: number;
  documentId: string;
  type: 'comment' | 'reply' | 'reaction' | 'mention' | 'approval' | 'rejection' | 'submission' | 'announcement';
  title: string;
  message: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
  actor: {
    id: number;
    username: string;
    displayName: string;
    profilePicture: { url: string } | null;
  } | null;
}

export const TYPE_META: Record<NotificationItem['type'], { Icon: typeof Bell; tint: string; bg: string }> = {
  comment: { Icon: MessageSquare, tint: 'text-emerald-700', bg: 'bg-brand-soft' },
  reply: { Icon: MessageSquare, tint: 'text-emerald-700', bg: 'bg-brand-soft' },
  reaction: { Icon: Heart, tint: 'text-rose-600', bg: 'bg-rose-50' },
  mention: { Icon: AtSign, tint: 'text-blue-600', bg: 'bg-blue-50' },
  approval: { Icon: CheckCircle, tint: 'text-emerald-700', bg: 'bg-brand-soft' },
  rejection: { Icon: AlertCircle, tint: 'text-amber-700', bg: 'bg-amber-50' },
  submission: { Icon: Sparkles, tint: 'text-purple-700', bg: 'bg-purple-50' },
  announcement: { Icon: Megaphone, tint: 'text-slate-700', bg: 'bg-slate-100' },
};

// Background polling — every 60s, ONLY while the tab is visible.
// Liveness is provided by:
//   - focus / visibilitychange refreshes (returns + immediate fetch)
//   - the `xblog:notifications-ping` custom event dispatched by comment
//     and reaction posts (instant update for the actor's other tabs)
// So we don't need an aggressive interval — this keeps server traffic
// extremely low while still feeling live in practice.
const POLL_INTERVAL_MS = 60_000;

/**
 * Bell icon + popover preview. Sits in the navbar (own surface, not a
 * dropdown item) so it's always visible. Polls every 25s and:
 *   - Renders a brand-green badge with the unread count.
 *   - Shakes the bell when a new notification arrives.
 *   - Opens a popover with the 5 most recent items + "See all" link.
 *   - Plays a soft toast (`"📬 New notification"`) when count goes up.
 */
export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [shake, setShake] = useState(false);
  const lastUnread = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchNow = async () => {
    try {
      const res = await api.get<{ data: NotificationItem[]; meta: { unread: number } }>('/notifications/me');
      const list = res.data.data || [];
      const u = res.data.meta?.unread || 0;
      setItems(list);
      setUnread(u);
      if (u > lastUnread.current && lastUnread.current >= 0) {
        // New arrival — shake + tiny toast (but only if this isn't first load).
        if (lastUnread.current > 0 || items.length > 0) {
          setShake(true);
          window.setTimeout(() => setShake(false), 800);
          toast(`📬 New notification`, { duration: 2200 });
        }
      }
      lastUnread.current = u;
    } catch {
      // Silent — bell stays at last known state.
    }
  };

  useEffect(() => {
    fetchNow();

    // Polling timer — only runs while the tab is visible. We tear it
    // down on `visibilitychange → hidden` and re-create on `→ visible`,
    // which both saves server load and gives the user a fresh fetch
    // the moment they come back to the tab.
    let timerId: number | null = null;
    const startPolling = () => {
      if (timerId !== null) return;
      timerId = window.setInterval(fetchNow, POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (timerId !== null) { window.clearInterval(timerId); timerId = null; }
    };
    if (document.visibilityState === 'visible') startPolling();

    const onFocus = () => fetchNow();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchNow();
        startPolling();
      } else {
        stopPolling();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    const onPing = () => fetchNow();
    window.addEventListener('xblog:notifications-ping', onPing);

    return () => {
      stopPolling();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('xblog:notifications-ping', onPing);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) fetchNow(); // refresh on open
  };

  // Broadcast after mutating so the /notifications page (if open in
  // another tab or below) syncs immediately too.
  const broadcastPing = () => {
    try { window.dispatchEvent(new Event('xblog:notifications-ping')); } catch { /* SSR */ }
  };

  const markAllRead = async () => {
    setItems((p) => p.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await api.post('/notifications/read-all'); } catch { /* ignore */ }
    broadcastPing();
  };

  const markRead = async (n: NotificationItem) => {
    if (n.read) return;
    setItems((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try { await api.post(`/notifications/${n.documentId}/read`); } catch { /* ignore */ }
    broadcastPing();
  };

  const openItem = (n: NotificationItem) => {
    markRead(n);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  const recent = items.slice(0, 5);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        className={`relative h-9 w-9 rounded-full inline-flex items-center justify-center text-slate-600 hover:text-brand hover:bg-brand-soft transition-colors ${shake ? 'wi-bell-shake' : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-brand text-brand-foreground text-[10px] font-bold h-4 min-w-4 px-1 shadow-[0_0_10px_hsl(var(--brand)/0.7)]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[360px] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-brand-soft/60 to-transparent">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Bell className="h-4 w-4 text-brand" /> Notifications
              {unread > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-brand text-brand-foreground text-[10px] font-bold h-5 min-w-5 px-1.5">{unread}</span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] text-brand hover:underline inline-flex items-center gap-1"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[340px] overflow-y-auto">
            {recent.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <Bell className="h-7 w-7 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-700 font-medium">No notifications yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">You're all caught up.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map((n) => {
                  const meta = TYPE_META[n.type] || TYPE_META.announcement;
                  const Icon = meta.Icon;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={`group w-full text-left px-3 py-3 flex items-start gap-3 transition-colors ${
                          n.read ? 'hover:bg-slate-50' : 'bg-brand-soft/30 hover:bg-brand-soft/60'
                        }`}
                      >
                        {n.actor ? (
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={getStrapiMediaUrl(n.actor.profilePicture?.url)} alt={n.actor.displayName} />
                            <AvatarFallback className="text-[10px] bg-brand-soft text-emerald-800 font-bold">
                              {n.actor.displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <span className={`h-8 w-8 rounded-full ${meta.bg} flex items-center justify-center shrink-0`}>
                            <Icon className={`h-4 w-4 ${meta.tint}`} />
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p className={`text-[13px] leading-snug ${n.read ? 'text-slate-600' : 'text-slate-900 font-medium'} line-clamp-2`}>
                              {n.title}
                            </p>
                            {!n.read && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand shrink-0" />}
                          </div>
                          <p className="mt-0.5 text-[10px] text-slate-400 inline-flex items-center gap-1">
                            <Icon className={`h-3 w-3 ${meta.tint}`} />
                            {timeAgo(n.createdAt)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/60">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-center text-xs font-semibold text-brand hover:bg-brand-soft transition-colors"
            >
              See all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
