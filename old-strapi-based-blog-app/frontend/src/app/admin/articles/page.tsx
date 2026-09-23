'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Article } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils';
import { Eye, EyeOff, Trash2, Search, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_FILTERS = ['all', 'draft', 'pending', 'published', 'rejected'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending: 'bg-yellow-100 text-yellow-800',
  published: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-100 text-rose-800',
};

export default function AdminArticlesPage() {
  // Honor ?status= from URL so dashboard cards can deep-link to a filter.
  const searchParams = useSearchParams();
  const initialStatus = (() => {
    const s = searchParams.get('status');
    return (STATUS_FILTERS as readonly string[]).includes(s || '') ? (s as StatusFilter) : 'all';
  })();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (q) params.set('q', q);
      const res = await api.get<{ data: Article[] }>(`/admin/articles?${params}`);
      setArticles(res.data.data);
    } catch {
      toast.error('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const unpublish = async (id: string) => {
    setBusy(id);
    try {
      await api.post(`/admin/articles/${id}/unpublish`);
      toast.success('Article unpublished (moved to draft)');
      setArticles((prev) => prev.map((a) => (a.documentId === id ? { ...a, status: 'draft' } : a)));
    } catch {
      toast.error('Failed to unpublish');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this article permanently? This cannot be undone.')) return;
    setBusy(id);
    try {
      await api.delete(`/admin/articles/${id}`);
      toast.success('Article deleted');
      setArticles((prev) => prev.filter((a) => a.documentId !== id));
    } catch {
      toast.error('Failed to delete');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">All Articles</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage every article across the platform.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              status === s
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          className="ml-auto flex gap-2 items-center"
        >
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by title..."
              className="pl-8 w-64"
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : articles.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
              No articles found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Author</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Views</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {articles.map((a) => (
                    <tr key={a.documentId} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium max-w-md truncate">
                        <Link href={`/articles/${a.slug}`} target="_blank" className="hover:text-primary">
                          {a.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.author?.username || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_STYLES[a.status]}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{a.viewCount ?? 0}</td>
                      <td className="px-4 py-3 text-muted-foreground">{timeAgo(a.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button asChild variant="ghost" size="sm" title="Preview">
                            <Link href={`/articles/${a.slug}`} target="_blank">
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          {a.status === 'published' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => unpublish(a.documentId)}
                              disabled={busy === a.documentId}
                              title="Unpublish"
                            >
                              <EyeOff className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(a.documentId)}
                            disabled={busy === a.documentId}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
    </div>
  );
}
