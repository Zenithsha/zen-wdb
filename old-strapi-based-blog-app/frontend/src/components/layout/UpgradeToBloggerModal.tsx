'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { PenSquare, X, ShieldAlert, Sparkles, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Two-stage confirmation flow for reader → blogger upgrade:
 *   1. "Would you like to convert your read account to a write account?"
 *   2. Once they agree, a stronger irreversibility warning before
 *      actually flipping the role server-side.
 * The user can still read everything after upgrading — the warning
 * highlights that they're gaining write access, not losing read.
 */
export default function UpgradeToBloggerModal({ open, onClose }: Props) {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [stage, setStage] = useState<'intro' | 'confirm'>('intro');
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal target only exists in the browser.
  useEffect(() => { setMounted(true); }, []);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || !mounted) return null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await api.post('/auth/upgrade-to-blogger');
      await refreshUser();
      toast.success("You're now a blogger! Start writing.");
      onClose();
      router.push('/write');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
        ?.error?.message;
      toast.error(msg || 'Failed to upgrade your account');
    } finally {
      setBusy(false);
    }
  };

  // Portal to <body> so the fixed overlay escapes the navbar's
  // backdrop-filter containing block (which was clamping the modal to
  // the header's height). Now `fixed inset-0` covers the real viewport.
  return createPortal(
    // `overflow-y-auto` + vertical padding means a tall modal scrolls
    // inside the backdrop instead of having its header clipped. `my-auto`
    // keeps it centred when it fits.
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md my-auto rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header with brand gradient */}
        <div className="relative h-24 bg-gradient-to-br from-emerald-200 via-brand-soft to-teal-100 overflow-hidden">
          <div className="absolute inset-0 bg-grid-faint opacity-50" />
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-brand/25 blur-3xl" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/80 hover:bg-white border border-slate-200 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute bottom-3 left-6 right-14 flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-white shadow-sm border border-emerald-100 flex items-center justify-center flex-shrink-0">
              <PenSquare className="h-4.5 w-4.5 text-brand" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 truncate">
              {stage === 'intro' ? 'Become a writer' : 'Confirm conversion'}
            </h2>
          </div>
        </div>

        {stage === 'intro' ? (
          <>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm leading-relaxed text-slate-700">
                You&apos;re signed in as a <strong className="text-emerald-800">reader</strong>.
                Convert to a <strong className="text-emerald-800">writer account</strong> to publish your own blogs.
              </p>
              <ul className="space-y-2.5 text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="h-6 w-6 rounded-lg bg-brand-soft text-brand flex items-center justify-center mt-0.5 flex-shrink-0">
                    <PenSquare className="h-3.5 w-3.5" />
                  </span>
                  <span>Publish articles with the full editor — cover image, tags, code blocks.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-6 w-6 rounded-lg bg-brand-soft text-brand flex items-center justify-center mt-0.5 flex-shrink-0">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <span>Get a public author profile readers can follow.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="h-6 w-6 rounded-lg bg-brand-soft text-brand flex items-center justify-center mt-0.5 flex-shrink-0">
                    <BookOpen className="h-3.5 w-3.5" />
                  </span>
                  <span>Keep everything you do now — reading, reacting and commenting.</span>
                </li>
              </ul>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-200">
              <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button onClick={() => setStage('confirm')} className="gap-1.5 shadow-md shadow-emerald-500/20">
                <PenSquare className="h-4 w-4" /> Continue
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900 leading-relaxed">
                  <strong className="block mb-1">This changes your account role.</strong>
                  Your role becomes <strong className="text-emerald-800">writer</strong> — you can
                  publish articles, and you keep reading, reacting and commenting on every post.
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Need to switch back later? An admin can change your role any time.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 bg-slate-50 border-t border-slate-200">
              <Button variant="outline" onClick={() => setStage('intro')} disabled={busy}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={busy} className="gap-1.5 shadow-md shadow-emerald-500/20">
                <PenSquare className="h-4 w-4" />
                {busy ? 'Converting…' : 'Convert to writer'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
