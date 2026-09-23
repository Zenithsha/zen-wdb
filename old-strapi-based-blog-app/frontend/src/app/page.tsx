'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api, getStrapiMediaUrl } from '@/lib/api';
import type { Article, Tag, StrapiListResponse } from '@/types';
import ArticleCard from '@/components/article/ArticleCard';
import ArticleMeta from '@/components/article/ArticleMeta';
import Sidebar from '@/components/layout/Sidebar';
import HeroAnnouncementCard from '@/components/home/HeroAnnouncementCard';
import FeedSearch from '@/components/home/FeedSearch';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Flame, Sparkles, Clock3, TrendingUp, PenLine, Zap, BookOpen, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type SortKey = 'latest' | 'popular';

function ArticleCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-48 w-full" />
      <CardContent className="p-4 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

/**
 * Magazine-style hero card for the top story. Big cover image, overlayed title,
 * generous whitespace. Distinct from the grid cards below.
 */
function FeaturedArticle({ article }: { article: Article }) {
  const coverUrl = article.coverImage
    ? getStrapiMediaUrl(
        article.coverImage.formats?.large?.url ||
        article.coverImage.formats?.medium?.url ||
        article.coverImage.url
      )
    : null;

  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group block relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 text-white shadow-sm hover:shadow-xl transition-all"
    >
      <div className="relative h-[380px] md:h-[460px]">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={article.title}
            fill
            priority
            className="object-cover opacity-80 group-hover:opacity-90 group-hover:scale-[1.02] transition-all duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
          <div className="flex items-center gap-2 mb-4">
            <Badge className="bg-brand text-brand-foreground hover:bg-brand border-0 gap-1 shadow-lg shadow-emerald-500/30">
              <Sparkles className="h-3 w-3" /> Featured
            </Badge>
            {article.tags?.slice(0, 2).map((tag) => (
              <Badge
                key={tag.documentId}
                variant="outline"
                className="border-white/40 text-white bg-white/10 backdrop-blur-sm"
              >
                #{tag.name}
              </Badge>
            ))}
          </div>

          <h2 className="text-3xl md:text-5xl font-bold leading-[1.1] tracking-tight mb-4 max-w-3xl group-hover:text-emerald-200 transition-colors">
            {article.title}
          </h2>

          {article.excerpt && (
            <p className="text-base md:text-lg text-slate-200 max-w-2xl mb-5 line-clamp-2">
              {article.excerpt}
            </p>
          )}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="[&_*]:!text-slate-200 [&_.text-muted-foreground]:!text-slate-200">
              <ArticleMeta article={article} />
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-300 group-hover:gap-2.5 transition-all">
              Read story <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState<SortKey>('latest');
  const [activeTag, setActiveTag] = useState<string | null>(null); // tag slug
  const [quickTags, setQuickTags] = useState<Tag[]>([]);
  const [totalStories, setTotalStories] = useState<number | null>(null);

  // Tally popular tags by pulling published articles with full tag relations.
  // Plain `populate=tags` avoids the v5 per-field populate quirk that was
  // returning tags without `slug`, which broke the dedupe.
  useEffect(() => {
    const params = [
      'filters[status]=published',
      'populate=tags',
      'pagination[pageSize]=200',
    ].join('&');
    api
      .get<{ data: ({ id: number } & { tags?: Tag[] })[] }>(`/articles?${params}`)
      .then((res) => {
        const counts = new Map<string, Tag & { _count: number }>();
        for (const a of res.data.data || []) {
          for (const t of a.tags || []) {
            if (!t?.slug) continue;
            const key = t.documentId || String(t.id);
            const prev = counts.get(key);
            if (prev) prev._count += 1;
            else counts.set(key, { ...t, _count: 1 });
          }
        }
        const ranked = Array.from(counts.values())
          .sort((a, b) => b._count - a._count)
          .slice(0, 10);
        setQuickTags(ranked);
      })
      .catch(() => {});
  }, []);

  const fetchArticles = useCallback(
    async (pageNum: number, sortKey: SortKey, tagSlug: string | null) => {
      const parts = [
        'filters[status]=published',
        'populate[author][populate][0]=profilePicture',
        'populate[tags]=true',
        'populate[coverImage]=true',
        sortKey === 'popular' ? 'sort[0]=viewCount:desc' : 'sort[0]=createdAt:desc',
        'sort[1]=createdAt:desc',
        `pagination[page]=${pageNum}`,
        'pagination[pageSize]=9',
      ];
      if (tagSlug) parts.push(`filters[tags][slug][$eq]=${encodeURIComponent(tagSlug)}`);
      const res = await api.get<StrapiListResponse<Article>>(`/articles?${parts.join('&')}`);
      return res.data;
    },
    []
  );

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchArticles(1, sort, activeTag)
      .then((data) => {
        setArticles(data.data);
        setHasMore(data.meta.pagination.page < data.meta.pagination.pageCount);
        setTotalStories(data.meta.pagination.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchArticles, sort, activeTag]);

  const loadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const data = await fetchArticles(nextPage, sort, activeTag);
      setArticles((prev) => [...prev, ...data.data]);
      setPage(nextPage);
      setHasMore(nextPage < data.meta.pagination.pageCount);
    } finally {
      setLoadingMore(false);
    }
  };

  // Editorial layout: 1 hero, next 2 as side-by-side highlights, rest as grid.
  const featured = articles[0];
  const highlights = articles.slice(1, 3);
  const rest = articles.slice(3);

  return (
    <div className="relative">
      {/* ─── Soft brand-tinted backdrop ──────────────────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[640px] overflow-hidden -z-10">
        <div className="absolute inset-0 bg-grid-faint" />
        <div className="absolute inset-0 bg-brand-radial" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,transparent_0%,hsl(var(--background))_75%)]" />
      </div>

      {/* ─── Hero (split panel, StackLookup-aligned) ─────────────── */}
      <section className="container mx-auto px-4 pt-12 pb-12">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          {/* Copy column */}
          <div className="lg:col-span-7 relative z-10">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-emerald-900 bg-brand-soft border border-emerald-200 rounded-full px-3 py-1 mb-6 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
              {totalStories !== null ? `${totalStories.toLocaleString()} developer stories and counting` : 'A community of developer stories'}
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-[4.25rem] font-bold tracking-tight leading-[1.02] text-slate-900">
              Where curious developers{' '}
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                  ship&nbsp;ideas.
                </span>
                <span aria-hidden className="absolute inset-x-0 bottom-1 h-3 bg-brand/20 -z-0 rounded-sm" />
              </span>
            </h1>

            <p className="mt-6 text-base md:text-lg text-slate-600 max-w-2xl leading-relaxed">
              Deep dives, scrappy notes, and hard-won lessons from people shipping
              real code. No algorithm. No paywall. Just stories worth reading.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <Button asChild size="lg" className="gap-1.5 shadow-lg shadow-emerald-500/20 h-12 px-6">
                  <Link href="/write">
                    <PenLine className="h-4 w-4" /> Write a story
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="gap-1.5 shadow-lg shadow-emerald-500/20 h-12 px-6">
                  <Link href="/register">
                    <PenLine className="h-4 w-4" /> Start writing — it&apos;s free
                  </Link>
                </Button>
              )}
              <Button
                asChild
                variant="outline"
                size="lg"
                className="gap-1.5 bg-white/70 backdrop-blur h-12 px-6 border-slate-300 hover:border-brand hover:text-brand"
              >
                <a href="#feed">
                  Browse the feed <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>

            {/* Trust strip */}
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-brand" /> Fast, distraction-free reads
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-brand" /> Long-form & quick notes
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Search className="h-4 w-4 text-brand" /> Topic-scoped feeds
              </span>
            </div>
          </div>

          {/* Visual column — live admin announcement OR motivational quote */}
          <div className="lg:col-span-5 relative">
            <HeroAnnouncementCard />
          </div>
        </div>
      </section>


      {/* ─── "All topics" pill — always visible above the feed ──────
          Highlighted brand-green when no tag filter is active (i.e. the
          feed is showing everything). When a tag filter IS active it
          renders as an outlined pill that, when clicked, clears the
          filter and returns to the unfiltered view. */}
      <section className="container mx-auto px-4 pb-4">
        <button
          onClick={() => setActiveTag(null)}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
            !activeTag
              ? 'bg-brand text-brand-foreground border-brand shadow-sm shadow-emerald-500/20'
              : 'bg-white text-slate-700 border-slate-200 hover:border-brand hover:text-brand'
          }`}
        >
          All topics
        </button>
      </section>

      {/* ─── Feed ────────────────────────────────────────────────── */}
      <section id="feed" className="container mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Section header — title · search · sort toggle */}
            <div className="flex items-end justify-between gap-3 flex-wrap border-b border-slate-200 pb-3">
              <div className="flex-shrink-0">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-1">The Feed</p>
                <h2 className="text-2xl font-bold tracking-tight">
                  {activeTag
                    ? `#${activeTag}`
                    : sort === 'popular'
                    ? 'Most read this week'
                    : 'Fresh off the keyboard'}
                </h2>
              </div>

              {/* Advanced search occupying the empty middle space */}
              <div className="flex-1 min-w-[220px] max-w-md mx-auto sm:mx-0">
                <FeedSearch />
              </div>

              <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-sm shadow-sm">
                <button
                  onClick={() => setSort('latest')}
                  className={`px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 font-medium transition-all ${
                    sort === 'latest'
                      ? 'bg-brand text-brand-foreground shadow-sm shadow-emerald-500/30'
                      : 'text-slate-600 hover:text-brand'
                  }`}
                >
                  <Clock3 className="h-3.5 w-3.5" /> Latest
                </button>
                <button
                  onClick={() => setSort('popular')}
                  className={`px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 font-medium transition-all ${
                    sort === 'popular'
                      ? 'bg-brand text-brand-foreground shadow-sm shadow-emerald-500/30'
                      : 'text-slate-600 hover:text-brand'
                  }`}
                >
                  <Flame className="h-3.5 w-3.5" /> Popular
                </button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-6">
                <Skeleton className="h-[420px] w-full rounded-2xl" />
                <div className="grid gap-6 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <ArticleCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            ) : articles.length === 0 ? (
              <div className="text-center py-20 rounded-2xl border-2 border-dashed border-slate-200 bg-white/50">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 text-slate-400" />
                <p className="text-lg font-medium mb-1">Nothing here yet</p>
                <p className="text-sm text-muted-foreground">
                  {activeTag
                    ? 'No published stories tagged this way. Try another topic.'
                    : 'Be the first to share your story!'}
                </p>
              </div>
            ) : (
              <>
                {/* Featured — magazine hero */}
                {featured && <FeaturedArticle article={featured} />}

                {/* Highlights — two large editorial cards side by side.
                    `auto-rows-fr` forces row heights to match so the two
                    feature cards are pixel-identical. */}
                {highlights.length > 0 && (
                  <div className="grid gap-6 md:grid-cols-2 auto-rows-fr">
                    {highlights.map((article) => (
                      <ArticleCard key={article.documentId} article={article} />
                    ))}
                  </div>
                )}

                {/* Inline editorial divider — adds rhythm between sections */}
                {rest.length > 0 && (
                  <div className="flex items-center gap-4 pt-2">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      More to read
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                  </div>
                )}

                {/* Rest grid — denser 3-up on wide screens.
                    `auto-rows-fr` makes every row equal height regardless
                    of how much content each card has, so every card is
                    identical. */}
                {rest.length > 0 && (
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 auto-rows-fr">
                    {rest.map((article) => (
                      <ArticleCard key={article.documentId} article={article} />
                    ))}
                  </div>
                )}

                {/* Mid-feed "Write" CTA strip — full-width row inside the grid area */}
                {!user && rest.length >= 3 && (
                  <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-brand-soft via-white to-white p-6 md:p-8">
                    <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/15 blur-3xl" />
                    <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />
                    <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 font-semibold">
                          Have a story to tell?
                        </p>
                        <h3 className="mt-1 text-xl md:text-2xl font-bold text-slate-900">
                          Publish your first post in minutes.
                        </h3>
                        <p className="mt-1 text-sm text-slate-600 max-w-xl">
                          Markdown editor, code blocks with syntax highlighting,
                          and a community of readers waiting.
                        </p>
                      </div>
                      <Button asChild size="lg" className="gap-1.5 shrink-0 shadow-lg shadow-emerald-500/20">
                        <Link href="/register">
                          <PenLine className="h-4 w-4" /> Start writing
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}

                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="gap-2 bg-white/60 backdrop-blur"
                    >
                      {loadingMore ? 'Loading...' : (
                        <>Load more stories <ArrowRight className="h-4 w-4" /></>
                      )}
                    </Button>
                  </div>
                )}

                {/* End-of-feed CTA — slim glass strip with a sweeping shine
                    on hover, gradient-text headline, glowing animated icon
                    tile, and a brand-green gradient border ring. */}
                {!hasMore && articles.length > 0 && (
                  <a
                    href={user ? '/write' : '/register'}
                    className="group relative block overflow-hidden rounded-2xl mt-4 cta-glass focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    {/* Animated gradient border ring — sits ABOVE the glass via
                        a 1px mask so we get a "lit edge" effect. */}
                    <span aria-hidden className="cta-glass-ring" />

                    {/* Soft brand glows that bleed through the frost */}
                    <div className="absolute -right-12 -top-14 h-40 w-40 rounded-full bg-brand/25 blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-teal-300/25 blur-3xl pointer-events-none" />

                    {/* Decorative sparkle dots */}
                    <Sparkles aria-hidden className="absolute top-2 right-3 h-3.5 w-3.5 text-brand/70 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-transform" />
                    <span aria-hidden className="absolute top-3 right-12 h-1 w-1 rounded-full bg-brand/50 blur-[0.5px]" />
                    <span aria-hidden className="absolute bottom-3 left-12 h-1 w-1 rounded-full bg-emerald-400/50 blur-[0.5px]" />

                    {/* Shine sweep — light bar that slides across on hover */}
                    <span aria-hidden className="cta-glass-shine" />

                    <div className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 backdrop-blur-xl bg-white/40">
                      {/* Glowing icon tile */}
                      <span className="relative h-11 w-11 flex-shrink-0">
                        <span aria-hidden className="absolute inset-0 rounded-xl bg-brand/30 blur-md group-hover:bg-brand/50 transition-colors" />
                        <span className="relative h-11 w-11 rounded-xl bg-white/90 border border-white/70 shadow-sm flex items-center justify-center">
                          <PenLine className="h-4.5 w-4.5 text-brand group-hover:rotate-[-8deg] transition-transform" />
                        </span>
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-bold leading-snug bg-gradient-to-r from-slate-900 via-emerald-800 to-slate-900 bg-clip-text text-transparent">
                          {user
                            ? 'Your turn — start your first blog.'
                            : 'Got something to say? Start your first blog — it’s free.'}
                        </p>
                        <p className="text-xs text-slate-600 leading-snug mt-0.5">
                          Markdown editor · code blocks · publish in minutes.
                        </p>
                      </div>

                      {/* Pill-shaped call-to-action with arrow that nudges
                          right on hover */}
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand text-brand-foreground text-sm font-medium px-4 py-2 shadow-md shadow-emerald-500/30 group-hover:shadow-emerald-500/50 group-hover:gap-2.5 transition-all flex-shrink-0">
                        {user ? 'Write a story' : 'Get started'}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </a>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-20">
              <Sidebar />
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
