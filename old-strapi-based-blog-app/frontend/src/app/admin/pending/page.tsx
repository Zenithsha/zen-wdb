'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Article, StrapiListResponse } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Check, X, Eye, Clock } from 'lucide-react';

export default function AdminPendingPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<StrapiListResponse<Article>>(
        '/articles/pending?populate[author][populate][0]=profilePicture&populate[tags]=true&sort=createdAt:asc'
      )
      .then((res) => setArticles(res.data.data || []))
      .catch(() => toast.error('Failed to load pending articles'))
      .finally(() => setLoading(false));
  }, []);

  const approve = async (documentId: string) => {
    setProcessing(documentId);
    try {
      await api.post(`/articles/${documentId}/approve`, {
        data: { adminFeedback: feedback[documentId] || '' },
      });
      toast.success('✅ Article approved and published!');
      setArticles((prev) => prev.filter((a) => a.documentId !== documentId));
    } catch {
      toast.error('Failed to approve article');
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (documentId: string) => {
    const reason = feedback[documentId]?.trim();
    if (!reason) {
      toast.error('Please enter a rejection reason before rejecting');
      return;
    }
    setProcessing(documentId);
    try {
      await api.post(`/articles/${documentId}/reject`, {
        data: { rejectionReason: reason },
      });
      toast.success('Article rejected');
      setArticles((prev) => prev.filter((a) => a.documentId !== documentId));
    } catch {
      toast.error('Failed to reject article');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="max-w-4xl">
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Clock className="h-5 w-5 text-yellow-600" />
          <h1 className="text-2xl font-bold">Pending Articles</h1>
          {articles.length > 0 && (
            <span className="px-2 py-0.5 text-sm bg-yellow-100 text-yellow-700 rounded-full font-medium">
              {articles.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border rounded-lg bg-muted/20">
            <Check className="h-10 w-10 mx-auto mb-3 text-green-500 opacity-60" />
            <p className="font-medium">All caught up!</p>
            <p className="text-sm">No articles waiting for review.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {articles.map((article) => (
              <div key={article.documentId} className="border rounded-xl p-6 bg-card shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold leading-snug">{article.title}</h2>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span>by <strong className="text-foreground">{article.author?.username}</strong></span>
                      <span>·</span>
                      <span>{timeAgo(article.updatedAt)}</span>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="flex-shrink-0">
                    <Link href={`/articles/${article.slug}`} target="_blank">
                      <Eye className="h-4 w-4 mr-1" /> Preview
                    </Link>
                  </Button>
                </div>

                {/* Tags */}
                {article.tags && article.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {article.tags.map((tag) => (
                      <Badge key={tag.documentId} variant="secondary" className="text-xs">
                        #{tag.name}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Excerpt */}
                {article.excerpt && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{article.excerpt}</p>
                )}

                {/* Feedback textarea */}
                <div className="mb-4">
                  <Textarea
                    placeholder="Admin feedback / rejection reason (required for rejection)..."
                    value={feedback[article.documentId] || ''}
                    onChange={(e) =>
                      setFeedback((prev) => ({ ...prev, [article.documentId]: e.target.value }))
                    }
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => approve(article.documentId)}
                    disabled={processing === article.documentId}
                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="h-4 w-4" />
                    {processing === article.documentId ? 'Processing...' : 'Approve & Publish'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => reject(article.documentId)}
                    disabled={processing === article.documentId}
                    className="gap-1.5"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
