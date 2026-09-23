'use client';

import { useEffect } from 'react';
import { Send } from 'lucide-react';
import toast, { Toast } from 'react-hot-toast';

type Mode = 'welcome' | 'goodbye';

interface Props {
  t: Toast;
  name?: string;
  mode?: Mode;
}

// Must match the total duration of every wi-* @keyframes in globals.css.
const TOTAL_DURATION_MS = 4200;

/**
 * Cinematic welcome / goodbye scene.
 *
 *   ▸ Floating cloud / island blooms in
 *   ▸ Paper plane peeks from behind the cloud, dives toward the popup
 *   ▸ Popup blooms in; plane slips behind it
 *   ▸ Plane emerges from BOTTOM of popup → diagonal to TOP-RIGHT
 *     → circles BEHIND the popup
 *   ▸ Brief disappearance, then plane re-enters from the same direction
 *   ▸ Wrap motion: plane circles the popup, popup gets a brand-green glow ring
 *   ▸ Everything dissolves into the sky with motion blur
 *
 * Choreography is fully CSS-keyframe-driven — every sub-element shares the
 * same 4.2s timeline so we don't need JS state machines to sync them.
 */
export default function WelcomeIsland({ t, name, mode = 'welcome' }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(() => toast.dismiss(t.id), TOTAL_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [t.id]);

  const leading = mode === 'goodbye' ? 'Goodbye' : 'Welcome back';

  return (
    <div className="wi-scene">
      {/* Floating cloud / island */}
      <div className="wi-cloud" aria-hidden>
        <div className="wi-cloud-blob wi-cloud-blob-1" />
        <div className="wi-cloud-blob wi-cloud-blob-2" />
        <div className="wi-cloud-blob wi-cloud-blob-3" />
      </div>

      {/* Ambient sparkle particles */}
      <span aria-hidden className="wi-particle wi-particle-1" />
      <span aria-hidden className="wi-particle wi-particle-2" />
      <span aria-hidden className="wi-particle wi-particle-3" />
      <span aria-hidden className="wi-particle wi-particle-4" />

      {/* Paper plane */}
      <Send aria-hidden className="wi-plane" />

      {/* Welcome / goodbye popup */}
      <div className="wi-popup" role="status" aria-live="polite">
        <span className="wi-popup-text">
          {leading}
          {name ? <>, <strong>{name}</strong></> : null}
        </span>
      </div>
    </div>
  );
}
