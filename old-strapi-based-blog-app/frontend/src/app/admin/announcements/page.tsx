'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, Trash2, Power, PowerOff, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { timeAgo } from '@/lib/utils';

interface Announcement {
  id: number;
  documentId: string;
  title: string;
  body: string;
  tag?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const EMPTY = { title: '', body: '', tag: '', ctaLabel: '', ctaUrl: '' };

export default function AdminAnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Announcement[] }>(
        '/announcements?sort=createdAt:desc&pagination[pageSize]=50'
      );
      setList(res.data.data || []);
    } catch (err: unknown) {
      // Surface the actual reason instead of a generic toast so we can
      // tell apart "Strapi not restarted" (404) from "permission missing"
      // (403) from "Strapi offline" (Network Error).
      const e = err as { response?: { status?: number; data?: { error?: { message?: string } } }; message?: string };
      const status = e.response?.status;
      const msg = e.response?.data?.error?.message;
      if (status === 404) {
        toast.error('Announcements API not found — restart Strapi (rm -rf .strapi).');
      } else if (status === 403) {
        toast.error('Forbidden — admin permissions not seeded yet. Restart Strapi.');
      } else if (status === 401) {
        toast.error('Not authorized — sign in again.');
      } else {
        toast.error(`Failed to load announcements${status ? ` (${status})` : ''}${msg ? `: ${msg}` : ''}`);
      }
      // eslint-disable-next-line no-console
      console.error('[admin/announcements] load failed', e.response || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setCreating(true);
    try {
      // Strapi v5 wraps writes in `{ data: ... }`
      await api.post('/announcements', {
        data: {
          title: form.title.trim(),
          body: form.body.trim(),
          tag: form.tag.trim() || null,
          ctaLabel: form.ctaLabel.trim() || null,
          ctaUrl: form.ctaUrl.trim() || null,
          isActive: true,
        },
      });
      toast.success('Announcement posted');
      setForm(EMPTY);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
        ?.error?.message;
      toast.error(msg || 'Failed to post');
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (a: Announcement) => {
    setBusy(a.documentId);
    try {
      await api.put(`/announcements/${a.documentId}`, {
        data: { isActive: !a.isActive },
      });
      setList((prev) =>
        prev.map((x) => (x.documentId === a.documentId ? { ...x, isActive: !a.isActive } : x))
      );
    } catch {
      toast.error('Failed to update');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (a: Announcement) => {
    if (!confirm(`Delete "${a.title}"?`)) return;
    setBusy(a.documentId);
    try {
      await api.delete(`/announcements/${a.documentId}`);
      setList((prev) => prev.filter((x) => x.documentId !== a.documentId));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="h-7 w-7 text-brand" /> Announcements
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Post messages that show up in the homepage hero. The most recently created{' '}
          <span className="font-medium text-foreground">active</span> announcement is the one
          visitors see.
        </p>
      </div>

      {/* ── Create form ───────────────────────────────────────── */}
      <Card className="border-slate-200 mb-8">
        <CardHeader>
          <CardTitle className="text-base">New announcement</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Title *</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="A new chapter for xBlog…"
                  maxLength={120}
                  disabled={creating}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Message *</label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Share what's new, what you're shipping, what readers should care about."
                  rows={3}
                  maxLength={500}
                  disabled={creating}
                  className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {form.body.length}/500
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Tag (optional)</label>
                <Input
                  value={form.tag}
                  onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                  placeholder="#launch"
                  maxLength={40}
                  disabled={creating}
                />
              </div>
              <div>
                <label className="text-sm font-medium">CTA label (optional)</label>
                <Input
                  value={form.ctaLabel}
                  onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                  placeholder="Read more"
                  maxLength={40}
                  disabled={creating}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">CTA URL (optional)</label>
                <Input
                  value={form.ctaUrl}
                  onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))}
                  placeholder="https://… or /articles/some-slug"
                  disabled={creating}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={creating} className="gap-1.5 shadow-sm shadow-emerald-500/20">
                <Send className="h-4 w-4" />
                {creating ? 'Posting…' : 'Post announcement'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── List ──────────────────────────────────────────────── */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">All announcements</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No announcements yet. The hero will show a rotating motivational quote until you post one.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {list.map((a) => (
                <li key={a.documentId} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          a.isActive
                            ? 'bg-brand-soft text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {a.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {a.tag && (
                        <span className="text-[11px] text-slate-500">{a.tag}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 font-semibold text-slate-900 truncate">{a.title}</p>
                    <p className="text-sm text-slate-600 line-clamp-2">{a.body}</p>
                    {a.ctaLabel && a.ctaUrl && (
                      <p className="mt-1 text-xs text-brand">
                        ↗ {a.ctaLabel} → {a.ctaUrl}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      title={a.isActive ? 'Deactivate' : 'Activate'}
                      disabled={busy === a.documentId}
                      onClick={() => toggleActive(a)}
                    >
                      {a.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4 text-brand" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete"
                      disabled={busy === a.documentId}
                      onClick={() => remove(a)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
