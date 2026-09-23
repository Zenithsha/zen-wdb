'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Sparkles, Quote, ArrowUpRight } from 'lucide-react';

interface Announcement {
  id: number;
  documentId: string;
  title: string;
  body: string;
  tag?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  isActive: boolean;
  createdAt: string;
}

// Curated motivational quotes used as a fallback when no announcement is live.
// Pulled from well-known engineers/designers/writers — short, sharp, and on-brand.
const QUOTES: { quote: string; author: string }[] = [
  { quote: 'The best way to predict the future is to invent it.', author: 'Alan Kay' },
  { quote: 'Programs must be written for people to read, and only incidentally for machines to execute.', author: 'Harold Abelson' },
  { quote: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
  { quote: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
  { quote: 'The only way to go fast is to go well.', author: 'Robert C. Martin' },
  { quote: 'First, solve the problem. Then, write the code.', author: 'John Johnson' },
  { quote: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
  { quote: 'Any fool can write code that a computer can understand. Good programmers write code that humans can understand.', author: 'Martin Fowler' },
  { quote: 'Done is better than perfect.', author: 'Sheryl Sandberg' },
  { quote: 'Ship early, ship often.', author: 'Eric S. Raymond' },
];

// Pick the quote deterministically from the local-day index so every reload on
// the same calendar day shows the same quote, and it rotates at midnight.
// We use the number of days since the Unix epoch (in *local* time, not UTC,
// so the change happens at the user's local midnight).
function pickDailyQuote() {
  const now = new Date();
  const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayIndex = Math.floor(localMidnight.getTime() / 86_400_000);
  return QUOTES[dayIndex % QUOTES.length];
}

export default function HeroAnnouncementCard() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const fallback = useMemo(pickDailyQuote, []);

  useEffect(() => {
    api
      .get<{ data: Announcement | null }>('/announcements/active')
      .then((res) => setAnnouncement(res.data.data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Compose URL safely — accept either external (https://) or internal (/path)
  const ctaHref = announcement?.ctaUrl?.trim() || null;
  const isExternal = ctaHref?.startsWith('http');

  return (
    <div className="relative aspect-[4/5] max-w-md mx-auto">
      {/* Backing brand panel — same as before for continuity */}
      <div className="absolute inset-x-6 inset-y-4 bg-brand rounded-[2rem] rotate-3 shadow-xl shadow-emerald-600/20" />

      {/* Front floating card */}
      <div className="absolute inset-0 bg-white rounded-[2rem] border border-slate-200 shadow-2xl -rotate-2 overflow-hidden flex flex-col">
        <div className="h-2 bg-gradient-to-r from-brand via-emerald-400 to-teal-400" />

        <div className="p-6 md:p-7 flex-1 flex flex-col">
          {!loaded ? (
            // Skeleton — keeps layout stable while we resolve which mode to render
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-24 bg-slate-100 rounded-full" />
              <div className="h-7 w-full bg-slate-100 rounded" />
              <div className="h-4 w-5/6 bg-slate-100 rounded" />
              <div className="h-4 w-2/3 bg-slate-100 rounded" />
            </div>
          ) : announcement ? (
            // ── Real announcement from admin ────────────────────
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-soft text-emerald-800 font-medium">
                  <Sparkles className="h-3 w-3" />
                  {announcement.tag || 'Announcement'}
                </span>
                <span className="text-slate-400">From the team</span>
              </div>
              <h3 className="mt-4 text-2xl font-bold leading-tight text-slate-900 line-clamp-3">
                {announcement.title}
              </h3>
              <p className="mt-3 text-sm text-slate-600 line-clamp-5 whitespace-pre-line">
                {announcement.body}
              </p>
              <div className="mt-auto pt-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">xBlog admin</p>
                    <p className="text-xs text-slate-500">
                      {new Date(announcement.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                {ctaHref && announcement.ctaLabel && (
                  isExternal ? (
                    <a
                      href={ctaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:gap-1.5 transition-all"
                    >
                      {announcement.ctaLabel}
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  ) : (
                    <Link
                      href={ctaHref}
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:gap-1.5 transition-all"
                    >
                      {announcement.ctaLabel}
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  )
                )}
              </div>
            </>
          ) : (
            // ── Motivational fallback ───────────────────────────
            <>
              {/* Faint brand-tinted background watermark — pushed to the
                  bottom-right corner so it never collides with quote text,
                  no matter how many lines the quote runs. Inline style is
                  used because our `.text-brand` is a static class and
                  Tailwind's `/opacity` modifier doesn't apply to it. */}
              <Quote
                aria-hidden
                className="absolute -bottom-2 -right-2 h-28 w-28 -scale-x-100 pointer-events-none"
                style={{ color: 'hsl(var(--brand) / 0.08)' }}
              />

              <div className="relative flex items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-soft text-emerald-800 font-medium">
                  <Quote className="h-3 w-3" /> Daily fuel
                </span>
                <span className="text-slate-400">For builders</span>
              </div>
              <p className="relative mt-6 text-xl md:text-2xl font-bold leading-snug text-slate-900">
                &ldquo;{fallback.quote}&rdquo;
              </p>
              <p className="relative mt-3 text-sm text-slate-500">— {fallback.author}</p>
              <div className="relative mt-auto pt-5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">xBlog community</p>
                  <p className="text-xs text-slate-500">Keep building</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating chips */}
      <div className="absolute -top-4 -right-2 bg-white border border-slate-200 rounded-full shadow-lg px-3 py-1.5 text-xs font-medium text-slate-700 flex items-center gap-1.5 rotate-6">
        <Sparkles className="h-3.5 w-3.5 text-brand" /> New stories daily
      </div>
      <div className="absolute -bottom-3 -left-2 bg-slate-900 text-white rounded-full shadow-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 -rotate-3">
        {announcement ? '📣 Latest from admin' : '✨ Stay inspired'}
      </div>
    </div>
  );
}
