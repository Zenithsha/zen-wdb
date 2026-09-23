'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, getStrapiMediaUrl, uploadApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Article, StrapiListResponse, StrapiMedia } from '@/types';
import ArticleCard from '@/components/article/ArticleCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
// NOTE: this project pins lucide-react 1.8.0 (very old build). Github,
// Twitter, and Linkedin icons don't exist in that version — using them
// imports `undefined` and crashes the page with "Element type is invalid".
// Substituting with icons that DO exist in 1.8.0 (Code2, AtSign, Briefcase).
import {
  Globe, Code2, AtSign, Briefcase, Edit3, Eye, FileText, Sparkles,
  Calendar, X, Camera, Save, BookOpen, Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProfileData {
  id: number;
  documentId: string;
  username: string;
  displayName: string;
  bio: string | null;
  socialLinks: Record<string, string>;
  profilePicture: { url: string; formats?: StrapiMedia['formats'] } | null;
  role: { type: string; name: string } | null;
  createdAt: string;
  stats: { articles: number; views: number };
}

function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      const progress = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setN(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{n.toLocaleString()}</>;
}

type Tab = 'articles' | 'about';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>('articles');
  // In-page search — scoped to THIS profile's articles only. Fully
  // client-side over the already-loaded list, so every keystroke is
  // instant (no network round trip). Cross-author search lives on the
  // homepage feed; this one stays local.
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Recent profile-search terms — persisted to localStorage so users can
  // re-run a previous search across page reloads.
  const RECENT_KEY = `xblog:profile-search:${username}`;
  const [recent, setRecent] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Keyboard shortcut: `/` focuses the search field (matches GitHub-style
  // UX). Skip when an input/textarea is already focused.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const recordSearch = (q: string) => {
    const t = q.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r.toLowerCase() !== t.toLowerCase())].slice(0, 5);
    setRecent(next);
    try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const isOwn = !!currentUser && currentUser.username === username;

  const load = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await api.get<{ data: ProfileData }>(`/auth/profile/${username}`);
      setProfile(res.data.data);
      const artRes = await api.get<StrapiListResponse<Article>>(
        `/articles?filters[author][username]=${username}&filters[status]=published&populate[author][populate][0]=profilePicture&populate[tags]=true&populate[coverImage]=true&sort=createdAt:desc&pagination[pageSize]=12`
      );
      setArticles(artRes.data.data || []);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (username) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // ── Loading skeleton ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <div className="inline-block rounded-2xl border border-slate-200 bg-white/70 backdrop-blur px-8 py-10">
          <p className="text-3xl font-bold tracking-tight text-slate-900 mb-2">User not found</p>
          <p className="text-sm text-slate-500 mb-5">No one with that username here yet.</p>
          <Button asChild>
            <Link href="/">Back to feed</Link>
          </Button>
        </div>
      </div>
    );
  }

  const avatarUrl = getStrapiMediaUrl(profile.profilePicture?.url);
  const joined = new Date(profile.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  });

  // Normalize stored URLs — if the user typed "www.google.com" or even
  // "google.com" the browser would treat it as a relative path and route
  // them to /profile/google.com. Prepend `https://` whenever a protocol
  // is missing so every link opens as an absolute external URL.
  const ensureAbsoluteUrl = (raw: string): string => {
    const v = raw.trim();
    if (!v) return v;
    if (/^https?:\/\//i.test(v)) return v;
    // Strip a leading // (protocol-relative) and force https
    return `https://${v.replace(/^\/\//, '')}`;
  };

  const social = profile.socialLinks || {};
  type SocialEntry = { key: string; href: string; label: string; Icon: typeof Globe };
  const socialEntries: SocialEntry[] = (
    [
      { key: 'github', href: social.github, label: 'GitHub', Icon: Code2 },
      { key: 'twitter', href: social.twitter, label: 'Twitter / X', Icon: AtSign },
      { key: 'linkedin', href: social.linkedin, label: 'LinkedIn', Icon: Briefcase },
      { key: 'website', href: social.website, label: 'Website', Icon: Globe },
    ] as { key: string; href?: string; label: string; Icon: typeof Globe }[]
  )
    .filter((s): s is SocialEntry => typeof s.href === 'string' && s.href.length > 0)
    .map((s) => ({ ...s, href: ensureAbsoluteUrl(s.href) }));

  const readingTime = Math.max(1, articles.reduce((s, a) => s + (a.readingTime || 0), 0));

  return (
    <div className="relative pb-16">
      <div className="container mx-auto px-4 max-w-6xl pt-8">
        {/* ── SPOTLIGHT HERO ───────────────────────────────────────
            Cinematic centered avatar with multi-ring animated halo,
            orbiting sparkle accents, gradient-text name, and a small
            row of meta. Below: three animated circular stat orbs in
            a row. */}
        <section className="relative pt-6 pb-10 mb-8">
          {/* Ambient backdrop glow specific to the hero */}
          <div aria-hidden className="absolute inset-0 overflow-hidden -z-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-72 w-[640px] max-w-full bg-[radial-gradient(ellipse_at_center,hsl(var(--brand)/0.20),transparent_70%)]" />
            <div className="absolute top-4 left-1/2 -translate-x-1/2 h-48 w-48 bg-grid-faint opacity-30" style={{ WebkitMaskImage: 'radial-gradient(ellipse,black,transparent 70%)', maskImage: 'radial-gradient(ellipse,black,transparent 70%)' }} />
          </div>

          <div className="relative flex flex-col items-center text-center">
            {/* Avatar with multi-layered animated halos */}
            <div className="relative">
              {/* Outer slow-rotating dashed ring */}
              <span aria-hidden className="absolute -inset-6 rounded-full border-2 border-dashed border-brand/30 animate-[spin_18s_linear_infinite]" />
              {/* Soft pulsing glow */}
              <span aria-hidden className="absolute -inset-3 rounded-full bg-gradient-to-br from-brand via-emerald-400 to-teal-400 blur-md opacity-60 profile-avatar-ring" />
              {/* Floating brand-green sparkle accents around the avatar */}
              <span aria-hidden className="absolute -top-3 -right-1 h-2 w-2 rounded-full bg-brand shadow-[0_0_12px_hsl(var(--brand))] animate-pulse" />
              <span aria-hidden className="absolute -bottom-1 -left-2 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_hsl(var(--brand)/0.7)] animate-pulse [animation-delay:.4s]" />
              <span aria-hidden className="absolute top-1/2 -right-4 h-1 w-1 rounded-full bg-teal-400 shadow-[0_0_8px_hsl(var(--brand)/0.6)] animate-pulse [animation-delay:.8s]" />

              <Avatar className="relative h-32 w-32 sm:h-36 sm:w-36 ring-4 ring-white shadow-2xl shadow-emerald-900/20">
                <AvatarImage src={avatarUrl} alt={profile.displayName} />
                <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                  {profile.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Eyebrow */}
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white border border-emerald-200 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-800 font-semibold shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
              xBlog · {profile.role?.type || 'member'}
            </div>

            {/* Gradient-text name with underline accent */}
            <h1 className="mt-3 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] relative inline-block">
              <span className="relative bg-gradient-to-br from-slate-900 via-emerald-800 to-slate-900 bg-clip-text text-transparent">
                {profile.displayName}
              </span>
              <span aria-hidden className="absolute inset-x-3 -bottom-1 h-2.5 bg-brand/15 -z-10 rounded-sm" />
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              @{profile.username} · <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> joined {joined}</span>
            </p>

            {/* Bio */}
            {profile.bio ? (
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-700 whitespace-pre-line">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-5 text-xs text-slate-400 italic">
                {isOwn ? 'No bio yet — click Edit profile to introduce yourself.' : 'No bio yet.'}
              </p>
            )}

            {/* Social orbs — circular hover-glow buttons */}
            {socialEntries.length > 0 && (
              <div className="mt-6 flex justify-center gap-3">
                {socialEntries.map(({ key, href, label, Icon }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={label}
                    className="group relative h-11 w-11 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-brand-foreground flex items-center justify-center transition-all hover:-translate-y-1 hover:scale-110"
                  >
                    <span aria-hidden className="absolute inset-0 rounded-full bg-brand opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span aria-hidden className="absolute -inset-1 rounded-full bg-brand/40 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Icon className="relative h-4.5 w-4.5" />
                  </a>
                ))}
              </div>
            )}

            {isOwn && (
              <Button
                onClick={() => setEditing(true)}
                className="mt-6 gap-1.5 shadow-lg shadow-emerald-500/25"
              >
                <Edit3 className="h-4 w-4" /> Edit profile
              </Button>
            )}
          </div>
        </section>

        {/* ── STAT ORBS ───────────────────────────────────────────
            Three glowing circular SVG progress rings. Each animates
            its stroke from 0 → target on mount via `CountUp` + a
            CSS transition on `stroke-dasharray`. */}
        <section className="mb-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatOrb
            icon={FileText}
            label="Articles"
            value={profile.stats.articles}
            target={Math.max(10, profile.stats.articles)}
            suffix=""
          />
          <StatOrb
            icon={Eye}
            label="Total reads"
            value={profile.stats.views}
            target={Math.max(100, profile.stats.views)}
            suffix=""
          />
          <StatOrb
            icon={BookOpen}
            label="Reading time"
            value={readingTime}
            target={Math.max(20, readingTime)}
            suffix="min"
          />
        </section>

        {/* ── Tabs + content (full width) ─────────────────────────── */}
        <main className="min-w-0">
            {/* Tab strip + inline search */}
            <div className="border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                {([
                  { id: 'articles' as const, label: 'Articles', count: articles.length, Icon: FileText },
                  { id: 'about' as const, label: 'About', Icon: Sparkles },
                ]).map((t) => {
                  const Icon = t.Icon;
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`relative px-4 py-3 text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                        active ? 'text-brand' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                      {typeof t.count === 'number' && (
                        <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                          active ? 'bg-brand text-brand-foreground' : 'bg-slate-100 text-slate-600'
                        }`}>{t.count}</span>
                      )}
                      <span
                        className={`absolute left-3 right-3 bottom-0 h-[2px] rounded-full bg-brand transition-all duration-300 ${
                          active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-50'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Advanced in-profile search — fully client-side. Searches
                  this user's articles across TITLE + EXCERPT + TAG NAMES
                  with relevance-weighted ranking, recent search history,
                  and a `/` keyboard shortcut. Cross-author search lives
                  on the homepage feed; this one stays local. */}
              <div className="relative w-full sm:w-72 mb-2 sm:mb-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value && tab !== 'articles') setTab('articles');
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => {
                    // Delay so a click on a recent-search row registers first.
                    window.setTimeout(() => setSearchOpen(false), 150);
                    recordSearch(searchQuery);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearchQuery('');
                      searchInputRef.current?.blur();
                    }
                  }}
                  placeholder="Search title, excerpt, #tag…"
                  className="w-full h-9 pl-8 pr-16 rounded-full border border-slate-200 bg-white text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all placeholder:text-slate-400"
                  aria-label="Search this profile's articles"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="h-5 w-5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 inline-flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : (
                    <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                      /
                    </kbd>
                  )}
                </div>

                {/* Recent-searches dropdown — only when empty + focused. */}
                {searchOpen && !searchQuery && recent.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">Recent</span>
                      <button
                        type="button"
                        onClick={() => {
                          setRecent([]);
                          try { window.localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-700"
                      >
                        Clear
                      </button>
                    </div>
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSearchQuery(r);
                          if (tab !== 'articles') setTab('articles');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-brand-soft text-left transition-colors"
                      >
                        <Search className="h-3 w-3 text-slate-400" />
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              {tab === 'articles' ? (
                (() => {
                  // ── Advanced client-side ranking ─────────────────
                  // Search across title (weight 6), tag name (weight 3),
                  // and excerpt (weight 1). A `#tag` prefix narrows the
                  // search to tag-only matches. Higher score = higher rank.
                  const raw = searchQuery.trim().toLowerCase();
                  const tagOnly = raw.startsWith('#');
                  const q = tagOnly ? raw.slice(1).trim() : raw;

                  let visible: Article[];
                  if (!q) {
                    visible = articles;
                  } else {
                    const scored = articles
                      .map((a) => {
                        const title = a.title.toLowerCase();
                        const excerpt = (a.excerpt || '').toLowerCase();
                        const tagNames = (a.tags || []).map((t) => t.name.toLowerCase());
                        const tagHit = tagNames.some((n) => n.includes(q));
                        let score = 0;
                        if (!tagOnly) {
                          if (title.includes(q)) score += title.startsWith(q) ? 10 : 6;
                          if (excerpt.includes(q)) score += 1;
                        }
                        if (tagHit) score += 3;
                        return { article: a, score };
                      })
                      .filter((x) => x.score > 0)
                      .sort((a, b) => b.score - a.score);
                    visible = scored.map((s) => s.article);
                  }

                  if (articles.length === 0) {
                    return (
                      <div className="text-center py-16 rounded-2xl border-2 border-dashed border-slate-200 bg-white/60">
                        <FileText className="h-10 w-10 mx-auto mb-3 text-slate-400" />
                        <p className="text-lg font-medium mb-1">Nothing published yet</p>
                        <p className="text-sm text-muted-foreground">
                          {isOwn ? 'Your published stories will appear here.' : 'Check back later for new posts.'}
                        </p>
                      </div>
                    );
                  }
                  if (visible.length === 0) {
                    return (
                      <div className="text-center py-16 rounded-2xl border-2 border-dashed border-slate-200 bg-white/60">
                        <Search className="h-10 w-10 mx-auto mb-3 text-slate-400" />
                        <p className="text-lg font-medium mb-1">No matches</p>
                        <p className="text-sm text-muted-foreground">
                          Nothing in this profile matches <span className="font-mono">&ldquo;{searchQuery}&rdquo;</span>.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {q && (
                        <p className="text-xs text-slate-500 mb-3">
                          Showing <strong className="text-slate-700">{visible.length}</strong> of {articles.length} {tagOnly ? 'tagged' : 'matching'}{' '}
                          <span className="font-mono">&ldquo;{searchQuery}&rdquo;</span>
                          {tagOnly && <span className="text-emerald-700 ml-1">· tag filter</span>}
                        </p>
                      )}
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
                        {visible.map((article) => (
                          <ArticleCard key={article.documentId} article={article} />
                        ))}
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoTile label="Display name" value={profile.displayName} />
                  <InfoTile label="Username" value={`@${profile.username}`} />
                  <InfoTile label="Member since" value={joined} />
                  <InfoTile label="Role" value={profile.role?.type || '—'} capitalize />
                  {socialEntries.length > 0 && (
                    <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-5">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700 font-semibold mb-3">Links</p>
                      <ul className="divide-y divide-slate-100">
                        {socialEntries.map(({ key, href, label, Icon }) => (
                          <li key={key} className="py-2.5 flex items-center justify-between gap-3">
                            <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                              <Icon className="h-4 w-4 text-brand" />
                              {label}
                            </span>
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-brand hover:underline truncate max-w-[60%]"
                            >
                              {href}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
        </main>
      </div>

      {/* ── Edit profile modal ─────────────────────────────────── */}
      {editing && isOwn && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await load();
            await refreshUser();
          }}
        />
      )}
    </div>
  );
}

function StatOrb({
  icon: Icon, label, value, target, suffix,
}: {
  icon: typeof Globe;
  label: string;
  value: number;
  target: number;
  suffix?: string;
}) {
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const [drawn, setDrawn] = useState(0);
  useEffect(() => {
    // Animate the ring from 0 to its target percentage on mount.
    const id = requestAnimationFrame(() => setDrawn(value));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const pct = Math.min(1, drawn / Math.max(1, target));
  const offset = circ * (1 - pct);

  return (
    <div className="group relative rounded-3xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-xl hover:shadow-emerald-500/15 hover:-translate-y-1 hover:border-brand/40 transition-all overflow-hidden">
      {/* Soft brand bloom in the corner that brightens on hover */}
      <div aria-hidden className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-brand/10 blur-3xl group-hover:bg-brand/25 transition-colors" />

      <div className="relative flex items-center gap-5">
        {/* Circular SVG ring */}
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
            <defs>
              <linearGradient id={`orb-grad-${label}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="hsl(var(--brand))" />
                <stop offset="100%" stopColor="rgb(45 212 191)" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--brand) / 0.12)" strokeWidth="6" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={`url(#orb-grad-${label})`}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="h-6 w-6 text-brand" />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700 font-semibold">{label}</p>
          <p className="mt-0.5 text-3xl font-bold tracking-tight text-slate-900 leading-none">
            <CountUp value={value} />
            {suffix && <span className="text-sm font-normal text-slate-500 ml-1">{suffix}</span>}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {label === 'Articles' ? 'published stories' :
              label === 'Total reads' ? 'across all posts' :
              'to read everything'}
          </p>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">{label}</p>
      <p className={`mt-1 text-base font-medium text-slate-900 ${capitalize ? 'capitalize' : ''}`}>{value}</p>
    </div>
  );
}

interface EditProps {
  profile: ProfileData;
  onClose: () => void;
  onSaved: () => void;
}

function EditProfileModal({ profile, onClose, onSaved }: EditProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio || '');
  const [github, setGithub] = useState(profile.socialLinks?.github || '');
  const [twitter, setTwitter] = useState(profile.socialLinks?.twitter || '');
  const [linkedin, setLinkedin] = useState(profile.socialLinks?.linkedin || '');
  const [website, setWebsite] = useState(profile.socialLinks?.website || '');
  const [avatarId, setAvatarId] = useState<number | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(
    profile.profilePicture ? getStrapiMediaUrl(profile.profilePicture.url) : undefined
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('files', file);
      const res = await uploadApi.post<{ id: number; url: string }[]>('/api/upload', form);
      const uploaded = res.data?.[0];
      if (uploaded) {
        setAvatarId(uploaded.id);
        setAvatarPreview(getStrapiMediaUrl(uploaded.url));
        toast.success('Avatar uploaded');
      }
    } catch {
      toast.error('Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  // Prepend `https://` to URLs the user typed without a protocol so they
  // open as absolute external links (not as relative paths under the
  // current page like /profile/www.google.com).
  const normalizeUrl = (raw: string): string => {
    const v = raw.trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v.replace(/^\/\//, '')}`;
  };

  const save = async () => {
    setSaving(true);
    try {
      // PUT is the most universally accepted method for this endpoint
      // (Strapi also accepts PATCH at the same route).
      await api.put('/auth/me', {
        data: {
          displayName: displayName.trim(),
          bio: bio.trim() || null,
          socialLinks: {
            github: normalizeUrl(github),
            twitter: normalizeUrl(twitter),
            linkedin: normalizeUrl(linkedin),
            website: normalizeUrl(website),
          },
          ...(avatarId ? { profilePicture: avatarId } : {}),
        },
      });
      toast.success('Profile updated');
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(msg || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="relative h-24 bg-gradient-to-br from-brand-soft via-emerald-100 to-teal-100 overflow-hidden">
          <div className="absolute inset-0 bg-grid-faint opacity-50" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/80 hover:bg-white border border-slate-200 flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <h2 className="absolute bottom-3 left-6 text-lg font-bold text-slate-900">Edit profile</h2>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Avatar uploader */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16 ring-2 ring-brand/30">
                <AvatarImage src={avatarPreview} />
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-500 text-white font-bold">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-brand text-brand-foreground border-2 border-white shadow flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                <Camera className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" onChange={handleAvatarFile} className="hidden" />
              </label>
            </div>
            <div className="text-xs text-slate-500">
              {uploading ? 'Uploading…' : 'Click the camera to change your avatar. PNG / JPG.'}
            </div>
          </div>

          <Field label="Display name">
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
          </Field>

          <Field label="Bio" hint={`${bio.length}/500`}>
            <Textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              placeholder="A short intro — what you build, what you write about…"
              className="resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="GitHub">
              <Input value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/…" />
            </Field>
            <Field label="Twitter / X">
              <Input value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/…" />
            </Field>
            <Field label="LinkedIn">
              <Input value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://linkedin.com/in/…" />
            </Field>
            <Field label="Website">
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || uploading} className="gap-1.5">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-slate-700">{label}</label>
        {hint && <span className="text-[10px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
