'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Tag, Article } from '@/types';
import NewsletterCard from '@/components/home/NewsletterCard';

type TagWithCount = Tag & { articleCount: number };
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Hash } from 'lucide-react';

export default function Sidebar() {
  const { user } = useAuth();
  const [tags, setTags] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Two-pass strategy so tags ALWAYS appear when they exist in Strapi:
    //   (1) primary: fetch every tag from /tags. This guarantees visibility
    //       even when the only articles using a tag are still drafts.
    //   (2) enhancement: tally usage over published articles client-side.
    //       Tags that appear there get an articleCount badge; the rest
    //       keep articleCount = 0.
    let cancelled = false;

    Promise.all([
      api.get<{ data: Tag[] }>('/tags?sort=name:asc&pagination[pageSize]=100'),
      api.get<{ data: (Pick<Article, 'id'> & { tags?: Tag[] })[] }>(
        '/articles?filters[status]=published&populate=tags&pagination[pageSize]=200'
      ).catch(() => ({ data: { data: [] } } as { data: { data: [] } })),
    ])
      .then(([tagsRes, articlesRes]) => {
        if (cancelled) return;
        const allTags = tagsRes.data.data || [];
        // Build count map from published articles
        const counts = new Map<string, number>();
        for (const article of articlesRes.data.data || []) {
          for (const t of article.tags || []) {
            const key = t.documentId || String(t.id);
            counts.set(key, (counts.get(key) || 0) + 1);
          }
        }
        const enriched: TagWithCount[] = allTags
          .filter((t) => t?.slug)
          .map((t) => ({ ...t, articleCount: counts.get(t.documentId || String(t.id)) || 0 }))
          // Show tags-with-usage first, then alphabetic for unused ones.
          .sort((a, b) => {
            if (b.articleCount !== a.articleCount) return b.articleCount - a.articleCount;
            return a.name.localeCompare(b.name);
          })
          .slice(0, 20);
        setTags(enriched);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[Sidebar] tag fetch failed', err?.response || err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Hash className="h-4 w-4" /> Popular Tags
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          ) : tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Link key={tag.documentId} href={`/tags/${tag.slug}`}>
                  <Badge
                    variant="secondary"
                    className="cursor-pointer rounded-full border border-transparent bg-brand-soft text-emerald-800 hover:bg-brand hover:text-brand-foreground hover:border-brand transition-colors gap-1 px-2.5"
                    style={tag.color ? { borderLeftColor: tag.color, borderLeftWidth: 3 } : undefined}
                    title={`${tag.articleCount} article${tag.articleCount === 1 ? '' : 's'}`}
                  >
                    <span>#{tag.name}</span>
                    <span className="text-[10px] opacity-70">{tag.articleCount}</span>
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No published articles are tagged yet. Add tags to a published article in Strapi to see them here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Join CTA — only for logged-out visitors */}
      {!user && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              xBlog is a community for developers to share ideas, learn, and connect.
              <Link href="/register" className="text-primary hover:underline ml-1">
                Join today →
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Newsletter signup — public, anyone can subscribe (logged in or not) */}
      <NewsletterCard />
    </div>
  );
}
