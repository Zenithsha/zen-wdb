'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Comment } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/utils';
import { Trash2, MessageSquare, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: Comment[] }>('/admin/comments')
      .then((res) => setComments(res.data.data))
      .catch(() => toast.error('Failed to load comments'))
      .finally(() => setLoading(false));
  }, []);

  const remove = async (id: string) => {
    if (!confirm('Delete this comment?')) return;
    setBusy(id);
    try {
      await api.delete(`/admin/comments/${id}`);
      toast.success('Comment deleted');
      setComments((prev) => prev.filter((c) => c.documentId !== id));
    } catch {
      toast.error('Failed to delete');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Comments</h1>
        <p className="text-muted-foreground text-sm mt-1">Moderate user comments across the site.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : comments.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
            No comments yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <Card key={c.documentId} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                      <strong className="text-foreground">{c.user?.username || 'Deleted user'}</strong>
                      <span>·</span>
                      <span>{timeAgo(c.createdAt)}</span>
                      {c.article?.slug && (
                        <>
                          <span>on</span>
                          <Link
                            href={`/articles/${c.article.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-0.5 text-primary hover:underline"
                          >
                            {c.article.title}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </>
                      )}
                      {c.isEdited && <span className="italic">(edited)</span>}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(c.documentId)}
                    disabled={busy === c.documentId}
                    className="text-rose-600 hover:bg-rose-50 flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
