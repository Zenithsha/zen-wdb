'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Article, Tag, StrapiListResponse } from '@/types';
import ArticleCard from '@/components/article/ArticleCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Hash } from 'lucide-react';

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tag, setTag] = useState<Tag | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    // Fetch tag info
    api.get<StrapiListResponse<Tag>>(`/tags?filters[slug]=${slug}&pagination[pageSize]=1`)
      .then((res) => {
        const found = res.data.data?.[0];
        if (found) setTag(found);
      })
      .catch(() => {});

    // Fetch articles for this tag
    api
      .get<StrapiListResponse<Article>>(
        `/articles?filters[status]=published&filters[tags][slug]=${slug}&populate[author][populate][0]=profilePicture&populate[tags]=true&populate[coverImage]=true&sort=createdAt:desc&pagination[page]=1&pagination[pageSize]=9`
      )
      .then((res) => {
        setArticles(res.data.data || []);
        setHasMore(res.data.meta.pagination.page < res.data.meta.pagination.pageCount);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const loadMore = async () => {
    const nextPage = page + 1;
    const res = await api.get<StrapiListResponse<Article>>(
      `/articles?filters[status]=published&filters[tags][slug]=${slug}&populate[author][populate][0]=profilePicture&populate[tags]=true&populate[coverImage]=true&sort=createdAt:desc&pagination[page]=${nextPage}&pagination[pageSize]=9`
    );
    setArticles((prev) => [...prev, ...(res.data.data || [])]);
    setPage(nextPage);
    setHasMore(nextPage < res.data.meta.pagination.pageCount);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ChevronLeft className="h-4 w-4" /> Back to feed
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Hash className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">#{tag?.name || slug}</h1>
          {tag?.description && (
            <p className="text-muted-foreground text-sm">{tag.description}</p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No articles with this tag yet.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
            {articles.map((article) => (
              <ArticleCard key={article.documentId} article={article} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-8">
              <Button variant="outline" onClick={loadMore}>Load More</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
