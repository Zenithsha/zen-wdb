'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { calculateReadingTime } from '@/lib/utils';
import CoverImageUpload from '@/components/article/CoverImageUpload';
import TagSelector, { type SelectedTag } from '@/components/article/TagSelector';
import AuthGuard from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Save,
  Send,
  ChevronLeft,
  Sparkles,
  Clock,
  Type,
  PenLine,
  Image as ImageIcon,
  Tag as TagIcon,
  Quote,
  Maximize2,
  Minimize2,
} from 'lucide-react';

const TipTapEditor = dynamic(() => import('@/components/editor/TipTapEditor'), {
  ssr: false,
  loading: () => <Skeleton className="h-[480px] w-full rounded-xl" />,
});

// Excerpt is controlled via useState below (not react-hook-form) so the
// value is always captured even if rhf's uncontrolled-input wiring hiccups.
const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title too long'),
});

type FormValues = z.infer<typeof schema>;

/** Strips HTML to plain text for word counting. */
function htmlToText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ');
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function slugifyTagName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

/**
 * Resolve a mixed array of (number | string) tag entries into the numeric
 * Strapi ids needed by the article API. Strings represent brand-new tag
 * names that the user staged in the editor — we mint them via `POST /tags`
 * here, NOT when the user pressed Enter, so the writes only happen if the
 * user actually saves the article.
 */
async function resolveStagedTags(entries: SelectedTag[]): Promise<number[]> {
  const ids: number[] = [];
  for (const entry of entries) {
    if (typeof entry === 'number') {
      ids.push(entry);
      continue;
    }
    const name = entry.trim();
    if (!name) continue;
    const res = await api.post<{ data: { id: number } }>('/tags', {
      data: { name, slug: slugifyTagName(name) },
    });
    if (res.data?.data?.id) ids.push(res.data.data.id);
  }
  return ids;
}

export default function WritePage() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  // ── Live-stats float-down ─────────────────────────────────────────
  // While the page is near the top the LIVE STATS card sits in its
  // normal sidebar slot. Once the user scrolls past it, the inline card
  // releases and a compact floating clone appears bottom-right of the
  // viewport so word-count + reading-time stay glanceable without
  // pulling the eye away from the editor. Tags + Cover stay put.
  const [statsFloating, setStatsFloating] = useState(false);
  useEffect(() => {
    const onScroll = () => setStatsFloating(window.scrollY > 320);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Editor fullscreen toggle ──────────────────────────────────────
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  useEffect(() => {
    if (!isEditorFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEditorFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    // Lock body scroll while editor floats fullscreen
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isEditorFullscreen]);
  // Mixed array: numeric ids for existing tags, strings for staged-new tags.
  // Staged-new tags are minted in Strapi only when the user saves.
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([]);
  const [coverImageId, setCoverImageId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlightRef = useRef(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const titleValue = watch('title') || '';
  const excerptValue = excerpt;

  // Live stats — recomputed only when content changes
  const stats = useMemo(() => {
    const text = htmlToText(content).trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const characters = text.length;
    const minutes = calculateReadingTime(content);
    return { words, characters, minutes };
  }, [content]);

  // Progress ring — fills as the article gets fleshed out. 0 → words / target.
  const wordTarget = 400;
  const wordProgress = Math.min(100, (stats.words / wordTarget) * 100);

  const saveArticle = async (values: FormValues, submitAfterSave = false) => {
    if (inFlightRef.current) return;
    if (!content || content === '<p></p>') {
      toast.error('Article content cannot be empty');
      return;
    }
    inFlightRef.current = true;
    if (submitAfterSave) setIsSubmitting(true);
    else setIsSaving(true);
    try {
      const trimmedExcerpt = excerpt.trim();
      // Flush staged tag names to Strapi here, only on save.
      const tagIds = await resolveStagedTags(selectedTags);
      const res = await api.post('/articles', {
        data: {
          title: values.title,
          excerpt: trimmedExcerpt ? trimmedExcerpt : null,
          content,
          tags: tagIds,
          coverImage: coverImageId,
          readingTime: stats.minutes,
        },
      });
      const articleDocumentId = res.data.data.documentId;
      if (submitAfterSave) {
        await api.post(`/articles/${articleDocumentId}/submit`);
        toast.success('🎉 Article submitted for review!');
      } else {
        toast.success('Draft saved!');
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
        ?.error?.message;
      toast.error(msg || 'Failed to save article');
      inFlightRef.current = false;
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  const busy = isSaving || isSubmitting;

  return (
    <AuthGuard allowedRoles={['blogger', 'admin']}>
      <div className="relative pb-32">
        {/* ── Sticky editor header ───────────────────────────────────── */}
        <div className="sticky top-0 z-40 backdrop-blur-md bg-white/75 border-b border-slate-200/60">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3 max-w-6xl">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Dashboard
              </Link>
              <span className="h-4 w-px bg-slate-200" />
              <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft text-emerald-800 px-2.5 py-0.5 text-[11px] font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                New draft
              </div>
              {busy && (
                <span className="text-xs text-slate-500 inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                  {isSubmitting ? 'Submitting…' : 'Saving…'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={handleSubmit((v) => saveArticle(v, false))}
                className="gap-1.5 h-9 border-slate-300 hover:border-brand hover:text-brand"
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">{isSaving ? 'Saving…' : 'Save draft'}</span>
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={handleSubmit((v) => saveArticle(v, true))}
                className="gap-1.5 h-9 shadow-lg shadow-emerald-500/20"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{isSubmitting ? 'Submitting…' : 'Publish for review'}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ── Editorial intro card ───────────────────────────────────── */}
        <div className="container mx-auto px-4 pt-10 max-w-6xl">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-brand-soft via-white to-white p-6 md:p-7 mb-8">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-brand/15 blur-3xl" />
            <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-emerald-300/20 blur-3xl" />
            <div className="relative flex items-start gap-4">
              <div className="hidden sm:flex h-12 w-12 rounded-2xl bg-white shadow-sm border border-emerald-100 items-center justify-center shrink-0">
                <PenLine className="h-5 w-5 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-700 font-semibold">
                  Compose
                </p>
                <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                  Write something worth reading.
                </h1>
                <p className="mt-1 text-sm text-slate-600 max-w-2xl">
                  A clean, distraction-free editor with cover images, tags, and a live
                  reading-time estimate. Save drafts as you go.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Two-column layout: editor + meta sidebar ──────────────── */}
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
            {/* Main editor column */}
            <div className="space-y-8 min-w-0">
              {/* Title — huge, borderless, brand-tinted focus */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Your article title…"
                  {...register('title')}
                  className="w-full bg-transparent text-3xl md:text-5xl font-bold tracking-tight leading-tight text-slate-900 placeholder:text-slate-300 focus:outline-none border-b-2 border-slate-200 focus:border-brand transition-colors pb-3"
                />
                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500">
                  <span>{errors.title?.message || 'A great title is short, specific, and curious.'}</span>
                  <span className={titleValue.length > 70 ? 'text-amber-600' : ''}>
                    {titleValue.length}/200
                  </span>
                </div>
              </div>

              {/* Excerpt — pull-quote styled input */}
              <div className="relative rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Quote className="h-4 w-4 text-brand" />
                  <label className="text-sm font-medium text-slate-700">
                    Excerpt
                    <span className="text-muted-foreground font-normal"> · shown in feeds & previews</span>
                  </label>
                </div>
                <Textarea
                  placeholder="One sentence that makes someone want to click."
                  rows={2}
                  maxLength={300}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  className="resize-none border-0 bg-transparent focus-visible:ring-0 px-0 text-[15px] leading-relaxed"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span></span>
                  <span className={excerptValue.length > 280 ? 'text-amber-600' : ''}>
                    {excerptValue.length}/300
                  </span>
                </div>
              </div>

              {/* Editor card — when expanded becomes a centred floating
                  panel covering ~80% of the viewport. Same body CSS
                  (white background, rounded border, subtle shadow); no
                  dim backdrop. The TipTap editor stays in the same DOM
                  node, so cursor + unsaved content survive the toggle. */}
              <div
                className={
                  isEditorFullscreen
                    ? 'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[80vw] h-[80vh] rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xl flex flex-col'
                    : 'rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm'
                }
              >
                <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Type className="h-4 w-4 text-brand" />
                    <span className="text-sm font-medium text-slate-700">Body</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500">
                      <span>{stats.words.toLocaleString()} words</span>
                      <span>·</span>
                      <span>{stats.minutes} min read</span>
                    </div>
                    {/* Expand / collapse arrow */}
                    <button
                      type="button"
                      onClick={() => setIsEditorFullscreen((v) => !v)}
                      title={isEditorFullscreen ? 'Exit fullscreen (Esc)' : 'Expand editor'}
                      aria-label={isEditorFullscreen ? 'Exit fullscreen' : 'Expand editor'}
                      className="h-8 w-8 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:text-brand hover:border-brand transition-colors"
                    >
                      {isEditorFullscreen ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className={`${isEditorFullscreen ? 'flex-1 overflow-auto' : ''} p-2 md:p-4`}>
                  <TipTapEditor
                    content={content}
                    onChange={setContent}
                    placeholder="Start writing your article…"
                  />
                </div>
              </div>
            </div>

            {/* Sidebar — the aside itself is NOT sticky anymore, so the
                cards scroll with the page. Only the Live-Stats card is
                sticky (`lg:sticky top-24`) so it stays pinned at the top
                of the viewport while the other cards scroll past behind
                it. `z-10` makes sure Live Stats floats ABOVE the other
                boxes as they slide past. */}
            <aside className="lg:self-start space-y-5">
              {/* Live stats card — sticky-pinned to the viewport top once
                  the user starts scrolling; sits in its original sidebar
                  slot when the page is at the top. */}
              <div
                className={`relative overflow-hidden rounded-2xl border bg-white p-5 lg:sticky lg:top-24 z-10 transition-shadow duration-300 ${
                  statsFloating
                    ? 'border-emerald-200 shadow-[0_18px_40px_-18px_rgba(16,185,129,0.35)]'
                    : 'border-slate-200'
                }`}
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-brand/10 blur-2xl" />
                <div className="relative flex items-center gap-4">
                  {/* Word-target ring (SVG) */}
                  <div className="relative h-16 w-16 shrink-0">
                    <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--brand) / 0.15)" strokeWidth="3" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        stroke="hsl(var(--brand))"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${(wordProgress / 100) * (2 * Math.PI * 15.5)} ${2 * Math.PI * 15.5}`}
                        style={{ transition: 'stroke-dasharray 400ms ease' }}
                      />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center text-[11px] font-bold text-emerald-800">
                      {Math.round(wordProgress)}%
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700 font-semibold">
                      Live stats
                    </p>
                    <div className="mt-1 flex items-center gap-4 text-sm text-slate-700">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <Sparkles className="h-3.5 w-3.5 text-brand" />
                        {stats.words.toLocaleString()}
                        <span className="font-normal text-slate-500">words</span>
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {stats.minutes} min read
                      </span>
                    </div>
                  </div>
                </div>
                <p className="relative mt-3 text-[11px] text-slate-500">
                  Target: <strong className="text-slate-700">{wordTarget}</strong> words for a healthy
                  long-form post.
                </p>
              </div>

              {/* Cover — scrolls with the page; Live Stats floats over it. */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ImageIcon className="h-4 w-4 text-brand" />
                  <h3 className="text-sm font-semibold text-slate-700">Cover image</h3>
                </div>
                <CoverImageUpload
                  onUpload={(id) => setCoverImageId(id)}
                  onClear={() => setCoverImageId(null)}
                />
              </div>

              {/* Tags — scrolls with the page. */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TagIcon className="h-4 w-4 text-brand" />
                  <h3 className="text-sm font-semibold text-slate-700">Tags</h3>
                </div>
                <TagSelector selected={selectedTags} onChange={setSelectedTags} />
              </div>

              {/* Feed-card live preview */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Feed preview</h3>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-700 font-semibold">
                    Live
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 hover:border-brand/40 transition-colors">
                  <p className="text-[15px] font-bold leading-tight text-slate-900 line-clamp-2">
                    {titleValue || 'Your title appears here'}
                  </p>
                  <p
                    className={`mt-2 text-xs leading-relaxed line-clamp-2 ${
                      excerptValue ? 'text-slate-600' : 'text-slate-400 italic'
                    }`}
                  >
                    {excerptValue ||
                      'Excerpt missing — readers will only see your title in the feed. Add one above for a stronger preview.'}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="h-5 w-5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500" />
                    <span>You · {stats.minutes} min read</span>
                  </div>
                </div>
              </div>

              {/* Pro-tip card */}
              <div className="rounded-2xl border border-emerald-100 bg-brand-soft/40 p-5 text-sm">
                <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700 font-semibold mb-2">
                  Pro tip
                </p>
                <p className="text-slate-700 leading-relaxed">
                  Use <code className="px-1 py-0.5 rounded bg-white border border-emerald-200 text-emerald-800 text-[12px]">## Section headings</code>
                  {' '}— the article view auto-builds a table of contents from them and shows a
                  scroll progress bar for readers.
                </p>
              </div>
            </aside>
          </div>
        </div>

      </div>
    </AuthGuard>
  );
}
