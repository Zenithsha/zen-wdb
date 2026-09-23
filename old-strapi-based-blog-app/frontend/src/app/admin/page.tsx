'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { AdminDashboardData } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils';
import { FileText, Users, Clock, CheckCircle, MessageSquare, Heart, Ban } from 'lucide-react';

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: AdminDashboardData }>('/admin/dashboard')
      .then((res) => setData(res.data.data))
      .catch((err) => {
        const status = err?.response?.status;
        const msg = err?.response?.data?.error?.message || err?.message || 'Unknown error';
        setError(status ? `${status}: ${msg}` : msg);
        // eslint-disable-next-line no-console
        console.error('[admin/dashboard] failed', err?.response || err);
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform activity at a glance.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Articles', value: stats.articles.total, icon: FileText, color: 'text-blue-600', href: '/admin/articles' },
              { label: 'Pending Review', value: stats.articles.pending, icon: Clock, color: 'text-yellow-600', href: '/admin/pending' },
              { label: 'Published', value: stats.articles.published, icon: CheckCircle, color: 'text-emerald-600', href: '/admin/articles?status=published' },
              { label: 'Rejected', value: stats.articles.rejected, icon: Ban, color: 'text-rose-600', href: '/admin/articles?status=rejected' },
              { label: 'Total Users', value: stats.users.total ?? 0, icon: Users, color: 'text-indigo-600', href: '/admin/users' },
              { label: 'Bloggers', value: stats.users.bloggers, icon: Users, color: 'text-purple-600', href: '/admin/users?role=blogger' },
              { label: 'Comments', value: stats.totalComments, icon: MessageSquare, color: 'text-cyan-600', href: '/admin/comments' },
              { label: 'Reactions', value: stats.totalReactions, icon: Heart, color: 'text-pink-600', href: '/admin/articles' },
            ].map(({ label, value, icon: Icon, color, href }) => (
              <Link
                key={label}
                href={href}
                className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded-lg"
              >
                <Card className="border-slate-200 transition-all group-hover:border-slate-400 group-hover:shadow-sm group-hover:-translate-y-0.5 cursor-pointer">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className={`text-3xl font-bold mt-0.5 ${color}`}>{value}</p>
                      </div>
                      <Icon className={`h-7 w-7 opacity-20 group-hover:opacity-40 transition-opacity ${color}`} />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  Needs Review
                  <Link href="/admin/pending" className="text-sm text-primary font-normal hover:underline">
                    View all →
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentPending.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All caught up! No pending articles.</p>
                ) : (
                  <div className="divide-y">
                    {data.recentPending.map((article) => (
                      <div key={article.documentId} className="py-2.5">
                        <p className="text-sm font-medium truncate">{article.title}</p>
                        <p className="text-xs text-muted-foreground">
                          by {article.author?.username} · {timeAgo(article.updatedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Recently Published</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentPublished.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No published articles yet.</p>
                ) : (
                  <div className="divide-y">
                    {data.recentPublished.map((article) => (
                      <div key={article.documentId} className="py-2.5">
                        <Link
                          href={`/articles/${article.slug}`}
                          target="_blank"
                          className="text-sm font-medium hover:text-primary transition-colors truncate block"
                        >
                          {article.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          by {article.author?.username} · {timeAgo(article.updatedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm">
          <p className="font-medium text-rose-900">Could not load admin dashboard data.</p>
          {error && <p className="mt-1 font-mono text-xs text-rose-700">{error}</p>}
          <p className="mt-2 text-xs text-rose-700">
            Check the browser console and Strapi logs for the full stack trace.
          </p>
        </div>
      )}
    </div>
  );
}
