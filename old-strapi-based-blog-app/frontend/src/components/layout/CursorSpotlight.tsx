'use client';

import { useEffect } from 'react';

/**
 * Tracks the cursor and writes its position into CSS custom properties
 * (`--mx`, `--my`) on the document root. The body's ambient `::before`
 * layer (defined in globals.css) reads those vars to render a soft brand
 * spotlight that follows the cursor — modern, professional, ambient.
 *
 * Mouse moves are throttled with rAF so we never set CSS vars more than
 * once per frame, regardless of how fast the user moves the pointer.
 *
 * Disabled entirely on coarse pointers (touch) — there's no cursor to
 * follow and constantly setting vars on touch-drag wastes work.
 */
export default function CursorSpotlight() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Skip on touch devices and when the user prefers reduced motion.
    const isCoarse = window.matchMedia?.('(pointer: coarse)').matches;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (isCoarse || reduceMotion) return;

    const root = document.documentElement;
    let frame = 0;
    let nextX = 0;
    let nextY = 0;

    const onMove = (e: MouseEvent) => {
      // Convert to viewport-relative percentages so the gradient size
      // stays sensible regardless of viewport dimensions.
      nextX = (e.clientX / window.innerWidth) * 100;
      nextY = (e.clientY / window.innerHeight) * 100;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--mx', `${nextX}%`);
        root.style.setProperty('--my', `${nextY}%`);
        frame = 0;
      });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
