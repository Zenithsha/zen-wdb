'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Article, StrapiListResponse, Tag } from '@/types';
import { Search, X, ArrowRight, Clock3, Hash, FileText, Command, CornerDownLeft, Sparkles } from 'lucide-react';

const RECENT_KEY = 'xblog:recent-searches';
const RECENT_MAX = 6;

type Scope = 'all' | 'articles' | 'tags';

interface ArticleHit { kind: 'article'; documentId: string; title: string; slug: string; excerpt?: string; }
interface TagHit { kind: 'tag'; documentId: string; name: string; slug: string; articleCount?: number; }
type Hit = ArticleHit | TagHit;

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const q = query.trim();
  if (!q) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark key={i} className="bg-brand/25 text-emerald-900 rounded-sm px-0.5">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

/**
 * Advanced feed search — opens a command-palette-style panel beneath the
 * input. Features:
 *   - Live results across articles + tags as you type (debounced 220ms)
 *   - Filter scope chips (All / Articles / Tags)
 *   - Recent searches persisted to localStorage
 *   - Match-text highlighting on titles and excerpts
 *   - Keyboard navigation (↑/↓/Enter/Esc) plus a global ⌘K / Ctrl+K shortcut
 *   - Empty-state suggestions when the input is blank
 */
export default function FeedSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Hydrate recent searches from localStorage on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch { /* ignore parse errors */ }
  }, []);

  const persistRecent = useCallback((next: string[]) => {
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch { /* storage may be full or disabled */ }
  }, []);

  const recordSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recent.filter((r) => r.toLowerCase() !== trimmed.toLowerCase())].slice(0, RECENT_MAX);
    persistRecent(next);
  }, [recent, persistRecent]);

  const clearRecent = () => persistRecent([]);

  // ── Global ⌘K / Ctrl+K shortcut ──────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Click-outside to close ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // ── Debounced live search ───────────────────────────────────────
  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const q = encodeURIComponent(query.trim());
      try {
        const tasks: Promise<Hit[]>[] = [];

        if (scope === 'all' || scope === 'articles') {
          // Strapi v5 OR across title / excerpt / content
          const params = [
            `filters[$or][0][title][$containsi]=${q}`,
            `filters[$or][1][excerpt][$containsi]=${q}`,
            `filters[$or][2][content][$containsi]=${q}`,
            'filters[status]=published',
            'sort=createdAt:desc',
            'pagination[pageSize]=6',
            'fields[0]=title',
            'fields[1]=slug',
            'fields[2]=excerpt',
            'fields[3]=documentId',
          ].join('&');
          tasks.push(
            api
              .get<StrapiListResponse<Article>>(`/articles?${params}`, { signal: controller.signal })
              .then((res) =>
                (res.data.data || []).map<Hit>((a) => ({
                  kind: 'article',
                  documentId: a.documentId,
                  title: a.title,
                  slug: a.slug,
                  excerpt: a.excerpt,
                }))
              )
              .catch(() => [] as Hit[])
          );
        }

        if (scope === 'all' || scope === 'tags') {
          const params = [
            `filters[$or][0][name][$containsi]=${q}`,
            `filters[$or][1][slug][$containsi]=${q}`,
            'sort=name:asc',
            'pagination[pageSize]=8',
          ].join('&');
          tasks.push(
            api
              .get<{ data: Tag[] }>(`/tags?${params}`, { signal: controller.signal })
              .then((res) =>
                (res.data.data || []).map<Hit>((t) => ({
                  kind: 'tag',
                  documentId: t.documentId,
                  name: t.name,
                  slug: t.slug,
                }))
              )
              .catch(() => [] as Hit[])
          );
        }

        const results = (await Promise.all(tasks)).flat();
        if (!controller.signal.aborted) {
          setHits(results);
          setActiveIdx(0);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [query, scope]);

  // ── Choosing a result ───────────────────────────────────────────
  const navigateTo = useCallback(
    (hit: Hit) => {
      recordSearch(query);
      setOpen(false);
      setQuery('');
      if (hit.kind === 'article') {
        router.push(`/articles/${hit.slug}`);
      } else {
        router.push(`/tags/${hit.slug}`);
      }
    },
    [query, recordSearch, router]
  );

  const submitFreeText = () => {
    const q = query.trim();
    if (!q) return;
    recordSearch(q);
    setOpen(false);
    // Pseudo "all results" — for now, route to tag if that name exists,
    // otherwise focus the first article hit. Falling back to the homepage
    // with no filter is fine.
    if (hits[0]) navigateTo(hits[0]);
  };

  // ── Keyboard nav inside input ───────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(hits.length - 1, i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (hits[activeIdx]) navigateTo(hits[activeIdx]);
      else submitFreeText();
    }
  };

  const grouped = useMemo(() => {
    const articles = hits.filter((h): h is ArticleHit => h.kind === 'article');
    const tags = hits.filter((h): h is TagHit => h.kind === 'tag');
    return { articles, tags };
  }, [hits]);

  const showEmptyState = open && !query.trim();
  const showResults = open && !!query.trim();

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      {/* Input — wrapped in a gradient halo so it pops against the feed
          header. The halo intensifies on focus to make the active state
          unmistakable. */}
      <div
        className={`relative rounded-full feed-search-halo transition-all ${
          open ? 'feed-search-halo-active' : ''
        }`}
      >
        <div
          className={`group relative flex items-center rounded-full border-2 bg-white transition-all ${
            open
              ? 'border-brand shadow-[0_0_0_4px_hsl(var(--brand)/0.15),0_10px_30px_-12px_hsl(var(--brand)/0.4)]'
              : 'border-emerald-200 hover:border-brand shadow-[0_4px_14px_-6px_hsl(var(--brand)/0.25)] hover:shadow-[0_6px_20px_-8px_hsl(var(--brand)/0.35)]'
          }`}
        >
          <span className="absolute left-2.5 h-7 w-7 rounded-full bg-brand text-brand-foreground flex items-center justify-center shadow-sm">
            <Search className="h-3.5 w-3.5" />
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search articles, tags, anything…"
            className="w-full bg-transparent pl-12 pr-24 py-2.5 text-sm font-medium text-slate-900 focus:outline-none placeholder:text-slate-500"
            aria-label="Search the feed"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="absolute right-2 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="rounded-full p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-emerald-200 bg-brand-soft px-1.5 py-0.5 text-[10px] font-mono text-emerald-800 font-semibold">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
        </div>
      </div>

      {/* Dropdown panel */}
      {(showEmptyState || showResults) && (
        <div className="absolute left-0 right-0 top-full mt-2 z-30 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xl shadow-2xl shadow-slate-900/10 overflow-hidden">
          {/* Scope chips */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100">
            {(['all', 'articles', 'tags'] as Scope[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`text-[11px] font-medium rounded-full px-2.5 py-1 transition-colors ${
                  scope === s
                    ? 'bg-brand text-brand-foreground'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {s === 'all' ? 'All' : s === 'articles' ? 'Articles' : 'Tags'}
              </button>
            ))}
            {loading && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-slate-500">
                <span className="h-3 w-3 rounded-full border-2 border-brand border-t-transparent animate-spin" />
                searching…
              </span>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[420px] overflow-y-auto py-1">
            {showEmptyState && (
              <div className="px-2 py-2">
                {recent.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between px-2 pb-1">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">
                        Recent
                      </span>
                      <button
                        type="button"
                        onClick={clearRecent}
                        className="text-[10px] text-slate-400 hover:text-slate-700"
                      >
                        Clear
                      </button>
                    </div>
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => { setQuery(r); inputRef.current?.focus(); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-brand-soft transition-colors text-sm text-slate-700 text-left"
                      >
                        <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                        {r}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-2 py-6 text-center">
                    <Sparkles className="h-6 w-6 mx-auto text-brand/60 mb-2" />
                    <p className="text-sm text-slate-600">Search articles and tags.</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Try <span className="font-mono text-slate-600">react</span>, <span className="font-mono text-slate-600">database</span>, or any <span className="font-mono text-slate-600">#tag</span>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {showResults && hits.length === 0 && !loading && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-700 font-medium">No matches for &ldquo;{query}&rdquo;</p>
                <p className="text-[11px] text-slate-400 mt-1">Try fewer keywords or a different tag.</p>
              </div>
            )}

            {showResults && grouped.articles.length > 0 && (
              <div className="py-1">
                <p className="px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Articles
                </p>
                {grouped.articles.map((hit) => {
                  const idx = hits.indexOf(hit);
                  const active = idx === activeIdx;
                  return (
                    <button
                      key={hit.documentId}
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => navigateTo(hit)}
                      className={`w-full text-left px-3 py-2 flex items-start gap-3 transition-colors ${
                        active ? 'bg-brand-soft' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`mt-0.5 h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 ${active ? 'bg-brand text-brand-foreground' : 'bg-slate-100 text-slate-500'}`}>
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {highlight(hit.title, query)}
                        </p>
                        {hit.excerpt && (
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {highlight(hit.excerpt, query)}
                          </p>
                        )}
                      </div>
                      {active && <ArrowRight className="h-4 w-4 text-brand mt-1 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}

            {showResults && grouped.tags.length > 0 && (
              <div className="py-1 border-t border-slate-100">
                <p className="px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold inline-flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Tags
                </p>
                {grouped.tags.map((hit) => {
                  const idx = hits.indexOf(hit);
                  const active = idx === activeIdx;
                  return (
                    <button
                      key={hit.documentId}
                      type="button"
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => navigateTo(hit)}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-3 transition-colors ${
                        active ? 'bg-brand-soft' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className={`h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 ${active ? 'bg-brand text-brand-foreground' : 'bg-brand-soft text-emerald-700'}`}>
                        <Hash className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm text-slate-800">
                        {highlight(hit.name, query)}
                      </span>
                      {active && <ArrowRight className="h-4 w-4 text-brand ml-auto" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with keyboard hints */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/60 text-[10px] text-slate-500">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-slate-200 bg-white px-1 font-mono">↑</kbd>
                <kbd className="rounded border border-slate-200 bg-white px-1 font-mono">↓</kbd>
                navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-slate-200 bg-white px-1 font-mono inline-flex items-center"><CornerDownLeft className="h-2.5 w-2.5" /></kbd>
                open
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-slate-200 bg-white px-1 font-mono">esc</kbd>
                close
              </span>
            </div>
            <Link href={query ? `/?search=${encodeURIComponent(query)}` : '/'} className="text-brand hover:underline">
              View all →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
