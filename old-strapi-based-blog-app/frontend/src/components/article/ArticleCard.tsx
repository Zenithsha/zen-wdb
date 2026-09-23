import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import ArticleMeta from './ArticleMeta';
import type { Article } from '@/types';
import { getStrapiMediaUrl } from '@/lib/api';
import { ArrowUpRight, Eye } from 'lucide-react';

interface Props {
  article: Article;
  showStatus?: boolean;
  /** "feature" lays out a wider editorial card, "default" is the grid card */
  variant?: 'default' | 'feature';
}

export default function ArticleCard({ article, variant = 'default' }: Props) {
  const coverUrl = article.coverImage
    ? getStrapiMediaUrl(
        article.coverImage.formats?.medium?.url ||
          article.coverImage.formats?.small?.url ||
          article.coverImage.url
      )
    : null;

  const isFeature = variant === 'feature';

  return (
    // Wrapping the full card in a Link makes the entire surface clickable
    // (modern blog UX) while inner Links (tags) still work because they stop
    // propagation via their own href.
    <Link
      href={`/articles/${article.slug}`}
      // `h-full` lets the link fill its grid cell. Paired with the parent
      // grid's `auto-rows-fr` (in page.tsx) this guarantees every card —
      // across every row — renders at exactly the same height.
      className="group relative flex h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-2xl"
    >
      {/* Soft brand glow that fades in on hover. Sits behind the card so
          the card itself stays clean and readable. */}
      <span
        aria-hidden
        className="absolute -inset-px rounded-2xl bg-gradient-to-br from-brand/0 via-brand/0 to-brand/0 group-hover:from-brand/15 group-hover:via-brand/0 group-hover:to-brand/10 transition-all duration-500 blur-xl opacity-0 group-hover:opacity-100"
      />

      <article
        className={`relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 group-hover:-translate-y-1 group-hover:border-brand/40 group-hover:shadow-[0_20px_40px_-20px_rgba(16,185,129,0.35)] ${
          isFeature ? 'md:flex-row' : ''
        }`}
      >
        {/* ── Cover ──────────────────────────────────────────────────
            Always rendered (placeholder when no image) so cards with and
            without cover images line up exactly. */}
        <div
          className={`relative overflow-hidden flex-shrink-0 ${
            isFeature ? 'md:w-2/5 md:min-h-[280px] h-56' : 'h-48'
          }`}
        >
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            // Subtle brand-tinted placeholder for cover-less posts
            <div className="absolute inset-0 bg-gradient-to-br from-brand-soft via-white to-emerald-50">
              <div className="absolute inset-0 bg-grid-faint opacity-50" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-5xl font-bold text-brand/30 select-none">
                  {article.title.slice(0, 1).toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {/* Subtle gradient at the top so floating chips read against any image */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/30 to-transparent pointer-events-none" />

          {/* Floating "open" affordance — appears on hover */}
          <div className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/95 backdrop-blur shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:translate-x-0 translate-x-1 transition-all duration-300">
            <ArrowUpRight className="h-4 w-4 text-brand" />
          </div>

          {/* View counter chip on cover (only when worth showing) */}
          {(article.viewCount ?? 0) > 0 && (
            <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur px-2 py-0.5 text-[11px] font-medium text-white">
              <Eye className="h-3 w-3" /> {article.viewCount}
            </div>
          )}
        </div>

        {/* ── Body ──────────────────────────────────────────────────
            Every slot has a reserved height (min-h on title/excerpt,
            min-h on the tag row) so cards stay identical even when one
            article has no tags / no excerpt. */}
        <div className={`flex flex-1 flex-col p-5 ${isFeature ? 'md:p-7' : ''}`}>
          {/* Tag row — fixed height even when empty so the rest of the
              layout doesn't shift up. */}
          <div className="mb-3 flex flex-wrap gap-1.5 min-h-[1.625rem]">
            {article.tags && article.tags.length > 0 &&
              article.tags.slice(0, 3).map((tag) => (
                <Link
                  key={tag.documentId}
                  href={`/tags/${tag.slug}`}
                  onClick={(e) => e.stopPropagation()}
                  className="z-10 relative"
                >
                  <Badge
                    variant="secondary"
                    className="cursor-pointer rounded-full border border-transparent bg-brand-soft text-emerald-800 hover:border-brand hover:bg-brand hover:text-brand-foreground transition-colors text-[11px] font-medium px-2.5"
                  >
                    #{tag.name}
                  </Badge>
                </Link>
              ))}
          </div>

          {/* Title — always reserves 2 lines */}
          <h2
            className={`font-bold leading-tight tracking-tight text-slate-900 group-hover:text-brand transition-colors line-clamp-2 ${
              isFeature ? 'text-2xl md:text-3xl mb-3 min-h-[4.25rem]' : 'text-lg mb-2 min-h-[2.75rem]'
            }`}
          >
            {article.title}
          </h2>

          {/* Excerpt — always reserves 2 lines (renders a non-breaking
              space when empty so the layout block is preserved). */}
          <p
            className={`text-slate-600 line-clamp-2 ${
              isFeature ? 'text-base mb-5 min-h-[3rem]' : 'text-sm mb-4 min-h-[2.5rem]'
            }`}
          >
            {article.excerpt || ' '}
          </p>

          {/* Meta — pinned to the bottom so cards align */}
          <div className="mt-auto pt-1">
            <ArticleMeta article={article} />
          </div>
        </div>
      </article>
    </Link>
  );
}
