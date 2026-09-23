'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { BloggerDashboardData } from '@/types';
import AuthGuard from '@/components/auth/AuthGuard';
import ArticleStatusChip from '@/components/article/ArticleStatusChip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils';
import { FileText, Eye, PenSquare, BarChart2, Send, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

function StatCard({ title, value, icon: Icon, color = 'text-foreground' }: {
  title: string; value: number; icon: React.ElementType; color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-3xl font-bold mt-0.5 ${color}`}>{value.toLocaleString()}</p>
          </div>
          <Icon className={`h-8 w-8 opacity-20 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<BloggerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: BloggerDashboardData }>('/blogger/dashboard')
      .then((res) => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Delete a draft (or rejected) article. Server enforces ownership via
  // `global::is-owner` on DELETE /api/articles/:documentId.
  const handleDelete = async (documentId: string, title: string, status: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(documentId);
    try {
      await api.delete(`/articles/${documentId}`);
      // Optimistically update the local view so the user sees it disappear.
      setData((prev) => {
        if (!prev) return prev;
        const recentArticles = prev.recentArticles.filter((a) => a.documentId !== documentId);
        const stats = { ...prev.stats, total: Math.max(0, prev.stats.total - 1) };
        if (status === 'draft') stats.draft = Math.max(0, stats.draft - 1);
        else if (status === 'rejected') stats.rejected = Math.max(0, stats.rejected - 1);
        else if (status === 'pending') stats.pending = Math.max(0, stats.pending - 1);
        else if (status === 'published') stats.published = Math.max(0, stats.published - 1);
        return { ...prev, recentArticles, stats };
      });
      toast.success('Article deleted');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response
        ?.data?.error?.message;
      toast.error(msg || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AuthGuard allowedRoles={['blogger', 'admin']}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">My Dashboard</h1>
          <Button asChild className="gap-1.5">
            <Link href="/write">
              <PenSquare className="h-4 w-4" /> Write Article
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Articles" value={data.stats.total} icon={FileText} />
              <StatCard title="Total Views" value={data.stats.totalViews} icon={Eye} color="text-blue-600" />
              <StatCard title="Published" value={data.stats.published} icon={Send} color="text-green-600" />
              <StatCard title="Pending Review" value={data.stats.pending} icon={BarChart2} color="text-yellow-600" />
            </div>

            {/* Mini status row */}
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Drafts: <strong className="text-foreground">{data.stats.draft}</strong></span>
              <span>Rejected: <strong className="text-destructive">{data.stats.rejected}</strong></span>
            </div>

            {/* Recent articles */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  Recent Articles
                  <Link href="/analytics" className="text-sm text-primary font-normal hover:underline flex items-center gap-1">
                    <BarChart2 className="h-3.5 w-3.5" /> View Analytics
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentArticles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="mb-3">No articles yet.</p>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/write">Write your first article</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y">
                    {data.recentArticles.map((article) => (
                      <div key={article.documentId} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{article.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <ArticleStatusChip status={article.status} />
                            <span className="text-xs text-muted-foreground">{timeAgo(article.updatedAt)}</span>
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Eye className="h-3 w-3" /> {article.viewCount}
                            </span>
                          </div>
                          {article.status === 'rejected' && article.rejectionReason && (
                            <p className="text-xs text-destructive mt-1 truncate">
                              ↳ {article.rejectionReason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/edit/${article.documentId}`}>
                              <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                            </Link>
                          </Button>
                          {(article.status === 'draft' || article.status === 'rejected') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingId === article.documentId}
                              onClick={() => handleDelete(article.documentId, article.title, article.status)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              {deletingId === article.documentId ? 'Deleting…' : 'Delete'}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <p className="text-muted-foreground">Could not load dashboard data.</p>
        )}
      </div>
    </AuthGuard>
  );
}
