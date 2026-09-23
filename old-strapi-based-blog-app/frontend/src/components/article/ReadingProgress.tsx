'use client';

import { useEffect, useRef, useState } from 'react';

interface SectionTick {
  id: string;
  text: string;
  /** 0-100 — horizontal position on the bar */
  pos: number;
}

interface Props {
  /**
   * CSS selector for the article body. The bar reads heading positions from
   * here to render section ticks and the floating "current section" label.
   * If omitted, the bar still works as a plain scroll progress indicator.
   */
  containerSelector?: string;
}

const NAV_OFFSET = 96; // sticky-navbar reading line — must match ArticleToc

/**
 * Reading progress bar — a 6px-tall track at the top of the viewport with:
 *   - a brand-green gradient fill that tracks scroll progress
 *   - an animated shimmer sliding across the fill (CSS keyframe)
 *   - a glowing "comet" head pulsing at the leading edge
 *   - a tick for every H2/H3 in the article body (also clickable shortcuts)
 *   - a floating chip near the comet showing the current section's name
 *
 * Reading progress is computed against the article body itself (so the bar
 * fills to 100% when you finish reading, not just when you've scrolled
 * past the footer). When no `containerSelector` is provided we fall back
 * to whole-document scroll progress.
 */
export default function ReadingProgress({ containerSelector }: Props) {
  const [progress, setProgress] = useState(0);
  const [ticks, setTicks] = useState<SectionTick[]>([]);
  // Track the heading the reader is currently inside (`currentSection`)
  // AND the heading immediately after (`nextSection`). The progress bar
  // colors each tick differently based on its relationship to these two.
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [nextSection, setNextSection] = useState<string | null>(null);
  const frame = useRef(0);
  const lastContainer = useRef<HTMLElement | null>(null);
  const lastHeadings = useRef<HTMLElement[]>([]);

  // Cache the container + headings on mount; refresh when DOM signals change.
  useEffect(() => {
    if (!containerSelector) return;
    const grab = () => {
      const root = document.querySelector<HTMLElement>(containerSelector);
      lastContainer.current = root;
      lastHeadings.current = root
        ? Array.from(root.querySelectorAll<HTMLElement>('h2, h3'))
        : [];
    };
    grab();
    // Re-grab once after content has likely settled (helps when article
    // content streams in or HMR re-renders the body).
    const t = window.setTimeout(grab, 600);
    return () => window.clearTimeout(t);
  }, [containerSelector]);

  useEffect(() => {
    const compute = () => {
      frame.current = 0;

      // ── Progress fill ──────────────────────────────────────────────
      const container = lastContainer.current;
      let pct: number;
      if (container) {
        const rect = container.getBoundingClientRect();
        const total = rect.height;
        // viewport top relative to container top
        const scrolled = -rect.top + NAV_OFFSET;
        const visible = window.innerHeight - NAV_OFFSET;
        const denom = Math.max(1, total - visible);
        pct = Math.min(100, Math.max(0, (scrolled / denom) * 100));
      } else {
        const doc = document.documentElement;
        const scrollTop = window.scrollY || doc.scrollTop;
        const max = doc.scrollHeight - doc.clientHeight;
        pct = max > 0 ? Math.min(100, (scrollTop / max) * 100) : 0;
      }
      setProgress(pct);

      // ── Ticks + current section ─────────────────────────────────────
      const headings = lastHeadings.current;
      if (container && headings.length) {
        const rect = container.getBoundingClientRect();
        const total = Math.max(1, rect.height - (window.innerHeight - NAV_OFFSET));
        const containerTopAbs = window.scrollY + rect.top;

        // Build a tick entry for EVERY heading. Don't filter on missing
        // id — instead inject a stable generated id when one is absent.
        // The TOC component does this independently; we mirror it here so
        // the chip logic is correct even on screens where the TOC doesn't
        // mount (xl+ only) and no one else injected ids.
        const slugify = (s: string) =>
          s
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
        const used = new Set<string>();
        const computed: SectionTick[] = headings.map((h, idx) => {
          const text = (h.textContent || '').trim() || `Section ${idx + 1}`;
          let id = h.id;
          if (!id) {
            id = slugify(text) || `section-${idx + 1}`;
            let n = 2;
            let candidate = id;
            while (used.has(candidate)) candidate = `${id}-${n++}`;
            id = candidate;
            h.id = id; // inject so anchor links + TOC work too
          }
          used.add(id);
          const absTop = window.scrollY + h.getBoundingClientRect().top;
          const offsetWithin = absTop - containerTopAbs - NAV_OFFSET;
          const pos = Math.min(100, Math.max(0, (offsetWithin / total) * 100));
          return { id, text, pos };
        });

        setTicks((prev) => {
          // Avoid noisy state updates when nothing meaningful changed.
          if (
            prev.length === computed.length &&
            prev.every((p, i) => p.id === computed[i].id && Math.abs(p.pos - computed[i].pos) < 0.5)
          ) {
            return prev;
          }
          return computed;
        });

        // Match by INDEX (heading ids can get wiped by dangerouslySet-
        // InnerHTML re-renders). currentIndex = last heading whose top
        // has crossed above the reading line. nextIndex = currentIndex + 1.
        let currentIndex = -1;
        for (let i = 0; i < headings.length; i++) {
          if (headings[i].getBoundingClientRect().top - NAV_OFFSET <= 0) {
            currentIndex = i;
          } else {
            break;
          }
        }
        // currentIndex === -1 means we're above the very first heading.
        // Treat the first heading as the "current target" so the bar is
        // never blank at the top of the page.
        const effectiveCurrent = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = currentIndex + 1 < headings.length ? currentIndex + 1 : null;
        setCurrentSection(computed[effectiveCurrent]?.id ?? null);
        setNextSection(nextIndex !== null ? computed[nextIndex]?.id ?? null : null);
      }
    };

    const onScroll = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  const currentText = currentSection
    ? ticks.find((t) => t.id === currentSection)?.text ?? null
    : null;
  const nextText = nextSection
    ? ticks.find((t) => t.id === nextSection)?.text ?? null
    : null;

  const scrollToTick = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = window.scrollY + el.getBoundingClientRect().top - NAV_OFFSET;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div aria-hidden className="fixed top-0 left-0 right-0 z-[60] pointer-events-none">
      {/* Track — visible slate underlay so the bar reads as a real component */}
      <div className="relative h-1.5 bg-slate-200/70 backdrop-blur-sm">
        {/* Fill — brand gradient with animated shimmer overlay */}
        <div
          className="rp-fill absolute inset-y-0 left-0 bg-gradient-to-r from-brand via-emerald-400 to-teal-400 shadow-[0_0_14px_hsl(var(--brand)/0.65)] transition-[width] duration-100"
          style={{ width: `${progress}%` }}
        />

        {/* Section ticks — four visual states:
            - finished (passed)   → solid brand-green, small
            - current (reading)   → big white-on-brand dot with halo + pulse
            - next  (upcoming)    → amber outline ring to draw the eye
            - future              → plain slate dot                        */}
        {ticks.map((t) => {
          const isCurrent = t.id === currentSection;
          const isNext = t.id === nextSection;
          const passed = progress >= t.pos - 0.2;
          let className =
            'pointer-events-auto absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-300';
          if (isCurrent) {
            className +=
              ' h-4 w-4 bg-brand border-2 border-white shadow-[0_0_0_3px_hsl(var(--brand)/0.45),0_0_14px_hsl(var(--brand)/0.6)] rp-comet';
          } else if (isNext) {
            // Amber outline — visually distinct from passed (green) and
            // future (slate) so the user immediately spots what's coming.
            className +=
              ' h-3 w-3 bg-white border-2 border-amber-400 shadow-[0_0_0_2px_rgb(251_191_36_/_0.35)] hover:scale-125';
          } else if (passed) {
            className += ' h-2 w-2 bg-brand hover:scale-150';
          } else {
            className += ' h-1.5 w-1.5 bg-slate-300 hover:bg-slate-400 hover:scale-150';
          }

          // Center the dot precisely under its position regardless of size.
          const size = isCurrent ? 16 : isNext ? 12 : passed ? 8 : 6;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => scrollToTick(t.id)}
              title={`${isCurrent ? '▶ Now reading: ' : isNext ? '⏭ Up next: ' : ''}${t.text}`}
              className={className}
              style={{ left: `calc(${t.pos}% - ${size / 2}px)` }}
            />
          );
        })}

        {/* Comet head — sits at the leading edge of the fill, with a pulsing
            glow ring. */}
        {progress > 0.5 && progress < 99.5 && (
          <span
            className="rp-comet pointer-events-none absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_0_3px_hsl(var(--brand)/0.55),0_0_14px_hsl(var(--brand)/0.7)]"
            style={{ left: `calc(${progress}% - 5px)` }}
          />
        )}
      </div>

      {/* ── Two independent floating labels with smooth transitions ────
          • NOW   tracks the comet horizontally and stays visible until the
                  end of the article.
          • NEXT  is anchored above the next-section tick. As the reader's
                  progress closes in on it, the label SMOOTHLY FADES OUT
                  (and the NOW label glides into that same spot because
                  the reader has just entered the new section).
          Both use a long CSS transition on `left` + `opacity`, so the
          handover feels like one fluid motion rather than a swap. */}

      {(() => {
        const nextTick = ticks.find((t) => t.id === nextSection);
        // Distance between the reader's current position (`progress`)
        // and the next section's tick. When sections are very close
        // together, the two separate chips would overlap — so once we
        // dip below `MERGE_AT`, we switch to a SINGLE combined chip
        // that shows both "NOW: X → NEXT: Y" at the NOW position.
        const FADE_START = 22; // % distance where fade of the separate NEXT begins
        const MERGE_AT = 18;   // % distance where the two chips combine
        const FADE_END = 2;    // legacy — for distances < MERGE_AT we don't show separate NEXT
        const distance = nextTick ? Math.max(0, nextTick.pos - progress) : 0;
        const nextOpacity = nextTick
          ? Math.min(1, Math.max(0, (distance - MERGE_AT) / (FADE_START - MERGE_AT)))
          : 0;
        const merged = nextTick && distance <= MERGE_AT && distance > 0;
        void FADE_END; // referenced only in comment above

        return (
          <>
            {/* Overlap guard: each label is ~180px wide. If the NOW and
                NEXT positions are closer than that on the bar, the
                labels would overlap. We progressively fade NEXT out
                starting earlier (proximity-based) so by the time the
                two would collide horizontally, NEXT is already gone. */}
            {/* MERGED chip — when NOW and NEXT are too close to fit two
                separate pills, we combine them into a single wider chip
                anchored at NOW position. Smooth fade-in for the merge. */}
            {merged && currentText && nextText && (() => {
              const leftValue = `min(calc(100% - 320px), max(8px, calc(${progress}% - 150px)))`;
              return (
                <div
                  className="pointer-events-none absolute top-3"
                  style={{
                    left: leftValue,
                    transition: 'left 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms ease',
                    opacity: 1,
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rotate-45 bg-slate-900/95"
                  />
                  <div className="relative inline-flex items-center gap-2 rounded-full bg-slate-900/95 text-white text-[11px] font-medium px-3 py-1 shadow-lg shadow-emerald-900/20 backdrop-blur">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                      <span className="opacity-60 text-[10px] uppercase tracking-wider">Now</span>
                      <span className="max-w-[110px] truncate">{currentText}</span>
                    </span>
                    <span aria-hidden className="text-white/30">→</span>
                    <span className="inline-flex items-center gap-1.5 text-amber-100">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span className="opacity-60 text-[10px] uppercase tracking-wider">Next</span>
                      <span className="max-w-[110px] truncate">{nextText}</span>
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* NOW (separate) — only when NOT merged. At the very end,
                pin to the last tick so the label hugs its dot rather
                than clipping at the right edge. */}
            {!merged && currentText && (() => {
              const lastTick = ticks[ticks.length - 1];
              const pinToLast = progress >= 96 && !nextTick && !!lastTick;
              const leftValue = pinToLast
                ? `min(calc(100% - 200px), max(8px, calc(${lastTick.pos}% - 90px)))`
                : `min(calc(100% - 200px), max(8px, calc(${progress}% - 90px)))`;
              return (
                <div
                  className="pointer-events-none absolute top-3"
                  style={{
                    left: leftValue,
                    transition: 'left 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease',
                    opacity: progress > 0.5 ? 1 : 0,
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rotate-45 bg-slate-900/95"
                  />
                  <div className="relative inline-flex items-center gap-1.5 rounded-full bg-slate-900/95 text-white text-[11px] font-medium px-3 py-1 shadow-lg shadow-emerald-900/20 backdrop-blur">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                    <span className="opacity-60 text-[10px] uppercase tracking-wider">Now</span>
                    <span className="max-w-[140px] truncate">{currentText}</span>
                  </div>
                </div>
              );
            })()}

            {/* NEXT (separate) — only when NOT merged AND still far away. */}
            {!merged && nextText && nextTick && nextOpacity > 0.01 && (
              <div
                className="pointer-events-none absolute top-3"
                style={{
                  left: `min(calc(100% - 200px), max(8px, calc(${nextTick.pos}% - 90px)))`,
                  opacity: nextOpacity,
                  transition: 'left 600ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms ease, transform 350ms ease',
                  transform: `translateY(${(1 - nextOpacity) * -6}px)`,
                }}
              >
                <span
                  aria-hidden
                  className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rotate-45 bg-slate-900/95 border-l border-t border-amber-400/30"
                />
                <div className="relative inline-flex items-center gap-1.5 rounded-full bg-slate-900/95 text-amber-100 text-[11px] font-medium px-3 py-1 shadow-lg shadow-amber-900/20 backdrop-blur border border-amber-400/30">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="opacity-60 text-[10px] uppercase tracking-wider">Next</span>
                  <span className="max-w-[140px] truncate">{nextText}</span>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
