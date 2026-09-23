'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import Link from 'next/link';
import { api, getStrapiMediaUrl } from '@/lib/api';
import type { Article, StrapiListResponse } from '@/types';
import ArticleContent from '@/components/article/ArticleContent';
import ArticleMeta from '@/components/article/ArticleMeta';
import ArticleToc from '@/components/article/ArticleToc';
import ReadingProgress from '@/components/article/ReadingProgress';
import ReactionBar from '@/components/reactions/ReactionBar';
import CommentList from '@/components/comments/CommentList';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ChevronLeft, Quote } from 'lucide-react';

export default function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Depend on stable primitives, not the `user` object identity — otherwise every
  // AuthContext refresh re-fetches the article and resets loading state.
  const userId = user?.id;
  const userRoleType = user?.role?.type;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<StrapiListResponse<Article>>(
        `/articles?filters[slug]=${slug}&populate[author][populate][0]=profilePicture&populate[tags]=true&populate[coverImage]=true&pagination[pageSize]=1`
      )
      .then((res) => {
        if (cancelled) return;
        const found = res.data.data?.[0];
        if (!found) {
          setNotFound(true);
          return;
        }
        // Visibility: published = anyone, non-published = author or admin only
        const isOwner = userId && found.author?.id === userId;
        const isAdmin = userRoleType === 'admin';
        if (found.status !== 'published' && !isOwner && !isAdmin) {
          setNotFound(true);
          return;
        }
        setArticle(found);
        if (found.status === 'published') {
          api.get(`/articles/${found.documentId}/increment-view`).catch(() => {});
        }
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug, userId, userRoleType]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Skeleton className="h-8 w-3/4 mb-4" />
        <Skeleton className="h-4 w-1/2 mb-6" />
        <Skeleton className="h-64 w-full mb-6 rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !article) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Article not found</h1>
        <Link href="/" className="text-primary hover:underline">← Back to home</Link>
      </div>
    );
  }

  const coverUrl = article.coverImage
    ? getStrapiMediaUrl(article.coverImage.formats?.large?.url || article.coverImage.url)
    : null;

  return (
    <>
      {/* Scroll progress along the very top of the viewport — with section
          ticks for each heading + a floating "current section" chip near
          the comet head. */}
      <ReadingProgress containerSelector="#article-body" />

      <article className="container mx-auto px-4 py-8 max-w-7xl">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand mb-8 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Back to feed
          </Link>

          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {article.tags.map((tag) => (
                <Link key={tag.documentId} href={`/tags/${tag.slug}`}>
                  <Badge
                    variant="secondary"
                    className="cursor-pointer rounded-full bg-brand-soft text-emerald-800 border border-transparent hover:bg-brand hover:text-brand-foreground hover:border-brand transition-colors px-3"
                  >
                    #{tag.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-slate-900 mb-6">
            {article.title}
          </h1>

          <ArticleMeta article={article} />
        </div>

        {/* ── Cover image — full-bleed within the wide container ─────── */}
        {coverUrl && (
          <div className="relative w-full aspect-[16/8] rounded-2xl overflow-hidden my-10 shadow-xl shadow-emerald-900/5 border border-slate-200">
            <Image src={coverUrl} alt={article.title} fill className="object-cover" priority />
          </div>
        )}

        {/* ── Body + Sticky TOC grid ─────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-10 xl:gap-14 mt-8">
          <div className="max-w-3xl mx-auto xl:mx-0 xl:justify-self-end xl:w-full">
            {/* Pull-quote excerpt — the watermark Quote icon was rendering
                dark because `text-brand/15` doesn't work on our custom
                `.text-brand` utility (no Tailwind opacity modifier). Use
                an inline HSL color, push to the bottom-right corner where
                it can't overlap text, and lower its size + opacity. */}
            {article.excerpt && (
              <figure className="relative my-6 rounded-2xl bg-brand-soft/60 border border-emerald-100 pl-8 pr-6 py-6 overflow-hidden">
                {/* Brand-green left rail — replaces the giant quote icon as
                    the primary "this is a pull quote" cue. */}
                <span
                  aria-hidden
                  className="absolute left-2 top-4 bottom-4 w-[3px] rounded-full bg-brand"
                />
                {/* Soft watermark in the corner — purely decorative now. */}
                <Quote
                  aria-hidden
                  className="absolute -bottom-3 -right-3 h-20 w-20 -scale-x-100 pointer-events-none"
                  style={{ color: 'hsl(var(--brand) / 0.10)' }}
                />
                <blockquote className="relative text-lg md:text-xl text-slate-800 leading-relaxed font-medium">
                  {article.excerpt}
                </blockquote>
              </figure>
            )}

            {/* Article body — `.article-body` enables drop-cap + h2 marks */}
            <div id="article-body" className="article-body">
              <ArticleContent content={article.content} />
            </div>

            <Separator className="my-10" />

            {/* Reactions */}
            <div className="mb-10">
              <h3 className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold mb-3">
                Reactions
              </h3>
              <ReactionBar articleDocumentId={article.documentId} />
            </div>

            <Separator className="my-10" />

            <CommentList articleDocumentId={article.documentId} />
          </div>

          {/* Sticky TOC — only renders on xl+ and when 2+ headings exist */}
          <aside className="hidden xl:block">
            <ArticleToc containerSelector="#article-body" />
          </aside>
        </div>
      </article>
    </>
  );
}
