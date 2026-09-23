'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { List } from 'lucide-react';

interface Heading {
  id: string;
  text: string;
  level: number; // 2 or 3
}

/**
 * Sticky table of contents with reliable click-to-scroll.
 *
 * Why this rewrite works where the previous one didn't:
 *   - Uses plain <a href="#id"> links so the browser handles navigation
 *     natively. Combined with `html { scroll-behavior: smooth;
 *     scroll-padding-top: 96px }` in globals.css, every click lands in the
 *     right spot regardless of in-progress scrolls.
 *   - Manually intercepts the click to force a scroll even when the hash
 *     hasn't changed (Chrome will sometimes noop a same-hash click after
 *     the URL was set by a previous click).
 *   - Re-locates the heading element AT CLICK TIME, so if React re-renders
 *     the article body and replaces nodes, we still find the right one.
 *   - Locks the IntersectionObserver for the duration of the smooth scroll
 *     so it can't "fight" the user's chosen target.
 */
export default function ArticleToc({ containerSelector }: { containerSelector: string }) {
  const [items, setItems] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerLockUntil = useRef(0);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(containerSelector);
    if (!root) return;

    const slugify = (s: string) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // strips emoji, punctuation, etc.
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    const found: Heading[] = [];
    const used = new Set<string>();
    root.querySelectorAll<HTMLElement>('h2, h3').forEach((el) => {
      const text = el.textContent?.trim() || '';
      if (!text) return;
      let id = el.id;
      if (!id) {
        id = slugify(text) || `section-${found.length + 1}`;
        let n = 2;
        let candidate = id;
        while (used.has(candidate)) candidate = `${id}-${n++}`;
        id = candidate;
        el.id = id;
      }
      used.add(id);
      found.push({ id, text, level: el.tagName === 'H3' ? 3 : 2 });
    });
    setItems(found);
    if (found[0]) setActiveId(found[0].id);

    if (found.length === 0) return;

    // ── Scroll-driven active highlighting ──────────────────────────────
    // Each animation frame we query the article body fresh for h2/h3 and
    // match by INDEX in document order (with text as a sanity check) instead
    // of relying on `getElementById`. This survives the case where a re-
    // render replaces innerHTML and wipes our injected ids — which was the
    // reason scroll-driven highlighting kept silently sticking on the first
    // section.
    const ACTIVE_LINE = 120; // px from top of viewport
    let raf = 0;

    const compute = () => {
      raf = 0;
      if (Date.now() < observerLockUntil.current) return;
      const liveRoot = document.querySelector<HTMLElement>(containerSelector);
      if (!liveRoot) return;
      const liveHeadings = liveRoot.querySelectorAll<HTMLElement>('h2, h3');
      if (!liveHeadings.length) return;

      let currentIndex = 0;
      for (let i = 0; i < liveHeadings.length; i++) {
        const top = liveHeadings[i].getBoundingClientRect().top;
        if (top - ACTIVE_LINE <= 0) {
          currentIndex = i;
        } else {
          break;
        }
      }
      // Map back to our items by document order (same order we scanned in).
      const item = found[currentIndex];
      if (item) {
        // Re-inject id if a render wiped it — keeps clicks working too.
        const liveEl = liveHeadings[currentIndex];
        if (liveEl && !liveEl.id) liveEl.id = item.id;
        setActiveId((prev) => (prev === item.id ? prev : item.id));
      }
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(compute);
    };

    compute(); // initial state
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [containerSelector]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, item: Heading) => {
      e.preventDefault();

      // Re-locate the heading. If `dangerouslySetInnerHTML` re-applied after
      // our initial id injection (which can happen during dev HMR or any
      // re-mount), the id is gone — fall back to scanning headings by their
      // text content, then re-inject the id so subsequent clicks are fast.
      let el = document.getElementById(item.id);
      if (!el) {
        const root = document.querySelector<HTMLElement>(containerSelector);
        if (root) {
          const headings = root.querySelectorAll<HTMLElement>('h2, h3');
          for (const h of headings) {
            if ((h.textContent || '').trim() === item.text) {
              el = h;
              el.id = item.id; // re-inject so future clicks are O(1)
              break;
            }
          }
        }
      }

      if (!el) {
        // eslint-disable-next-line no-console
        console.warn('[ArticleToc] heading not found at click time', item);
        return;
      }

      setActiveId(item.id);
      observerLockUntil.current = Date.now() + 900;

      const NAV_OFFSET = 96;
      const top = window.scrollY + el.getBoundingClientRect().top - NAV_OFFSET;
      window.scrollTo({ top, behavior: 'smooth' });
    },
    [containerSelector]
  );

  if (items.length < 2) return null;

  return (
    <nav aria-label="Table of contents" className="hidden xl:block sticky top-24">
      <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-sm shadow-sm overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-brand-soft/60 to-transparent">
          <List className="h-3.5 w-3.5 text-brand" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-900 font-semibold">
            On this page
          </p>
        </div>

        <ul className="py-2">
          {items.map((item, idx) => {
            const active = item.id === activeId;
            const isH3 = item.level === 3;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  onClick={(e) => handleClick(e, item)}
                  className={`group relative w-full text-left flex items-start gap-2.5 py-1.5 pr-3 transition-all
                    ${isH3 ? 'pl-8' : 'pl-4'}
                    ${active ? 'bg-brand-soft/60' : 'hover:bg-slate-50'}
                  `}
                >
                  <span
                    aria-hidden
                    className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full transition-all ${
                      active ? 'bg-brand opacity-100' : 'bg-brand/0 opacity-0'
                    }`}
                  />

                  {isH3 ? (
                    <span
                      aria-hidden
                      className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${
                        active ? 'bg-brand' : 'bg-slate-300 group-hover:bg-slate-400'
                      }`}
                    />
                  ) : (
                    <span
                      className={`shrink-0 font-mono text-[10px] tracking-wide mt-0.5 transition-colors ${
                        active ? 'text-brand' : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  )}

                  <span
                    className={`text-sm leading-snug transition-all duration-200 ${
                      active
                        ? 'text-emerald-900 font-medium translate-x-0'
                        : 'text-slate-600 group-hover:text-slate-900 group-hover:translate-x-0.5'
                    } ${isH3 ? 'text-[13px]' : ''}`}
                  >
                    {item.text}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
