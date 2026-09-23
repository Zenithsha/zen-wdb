'use client';

import toast from 'react-hot-toast';
import WelcomeIsland from '@/components/ui/WelcomeIsland';

/**
 * Dynamic-Island welcome animation (paper plane CW → message appears →
 * paper plane ACW → message disappears). Use on sign-in / sign-up.
 *
 * `duration: Infinity` because the island self-dismisses; finite duration
 * would cause react-hot-toast to unmount it mid-animation.
 */
export function showWelcomeBack(name?: string) {
  toast.custom((t) => <WelcomeIsland t={t} name={name} mode="welcome" />, {
    duration: Infinity,
    position: 'top-center',
  });
}

/**
 * Same animation, "Goodbye, {name}" wording. Use on sign-out.
 *
 * Trigger this BEFORE clearing the user from state — otherwise we lose the
 * name we want to greet them out with. `AuthContext.logout()` already
 * handles this internally for global sign-outs.
 */
export function showGoodbye(name?: string) {
  toast.custom((t) => <WelcomeIsland t={t} name={name} mode="goodbye" />, {
    duration: Infinity,
    position: 'top-center',
  });
}
