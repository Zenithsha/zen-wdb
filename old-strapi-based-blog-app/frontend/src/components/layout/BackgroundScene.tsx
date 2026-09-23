/**
 * Ambient brand-aurora background — a fixed, pointer-event-less layer that
 * sits behind every page. Five blurred brand-green orbs drift independently
 * around the viewport, a cursor-coupled orb softly follows the pointer, and
 * a sparse field of glowing "dust" particles drifts upward.
 *
 * Animation is 100% CSS keyframes (see `.bg-aurora*` in globals.css), so the
 * component itself is a pure-markup tree — no client JS, safe to render as
 * a server component on every page.
 *
 * The light wash on top keeps content legible on every background colour
 * combination, so we don't have to adjust per-page surfaces.
 */
export default function BackgroundScene() {
  return (
    <div className="bg-aurora" aria-hidden>
      {/* Drifting orbs — 5 independently-timed brand-green clouds */}
      <span className="bg-aurora-orb bg-aurora-orb-1" />
      <span className="bg-aurora-orb bg-aurora-orb-2" />
      <span className="bg-aurora-orb bg-aurora-orb-3" />
      <span className="bg-aurora-orb bg-aurora-orb-4" />
      <span className="bg-aurora-orb bg-aurora-orb-5" />

      {/* Cursor-coupled glow — softly chases the pointer via CSS vars */}
      <span className="bg-aurora-cursor" />

      {/* Sparse floating dust particles drifting upward */}
      <span className="bg-aurora-dust bg-aurora-dust-1" />
      <span className="bg-aurora-dust bg-aurora-dust-2" />
      <span className="bg-aurora-dust bg-aurora-dust-3" />
      <span className="bg-aurora-dust bg-aurora-dust-4" />
      <span className="bg-aurora-dust bg-aurora-dust-5" />
      <span className="bg-aurora-dust bg-aurora-dust-6" />
      <span className="bg-aurora-dust bg-aurora-dust-7" />

      {/* Light wash on top so content always stays legible */}
      <span className="bg-aurora-wash" />
    </div>
  );
}
