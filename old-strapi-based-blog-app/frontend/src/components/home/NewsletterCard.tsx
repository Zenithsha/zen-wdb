'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Send, CheckCircle2, X } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Newsletter sign-up card for the homepage sidebar.
 * - Captures name (optional) + email.
 * - POSTs to /api/newsletter/subscribe (public endpoint).
 * - Pops a centred success modal on completion. Server returns
 *   `alreadySubscribed: true` if the email was on the list — the modal
 *   shows a friendlier "You're already on the list" copy in that case.
 */
export default function NewsletterCard() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [alreadyIn, setAlreadyIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post<{ data: { alreadySubscribed: boolean } }>(
        '/newsletter/subscribe',
        { email: cleanEmail, name: name.trim() || undefined, source: 'homepage' }
      );
      setAlreadyIn(Boolean(res.data?.data?.alreadySubscribed));
      setOpen(true);
      setName('');
      setEmail('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
        ?.error?.message;
      setError(msg || 'Could not subscribe right now. Try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Lock background scroll while the modal is open and allow Escape to close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-brand-soft via-white to-white p-5">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-8 h-32 w-32 rounded-full bg-emerald-300/30 blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-2 mb-1">
          <div className="h-8 w-8 rounded-full bg-white border border-emerald-200 flex items-center justify-center shadow-sm">
            <Mail className="h-4 w-4 text-brand" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700 font-semibold">
            xBlog newsletter
          </p>
        </div>
        <h3 className="relative text-base font-bold text-slate-900 leading-snug mb-1">
          Stories worth your inbox.
        </h3>
        <p className="relative text-xs text-slate-600 mb-3">
          Join thousands of developers getting one curated digest a week — no spam, unsubscribe anytime.
        </p>

        <form onSubmit={handleSubmit} className="relative space-y-2">
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            disabled={submitting}
            maxLength={80}
            className="h-9 bg-white"
          />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={submitting}
            required
            className="h-9 bg-white"
          />
          {error && <p className="text-[11px] text-rose-600">{error}</p>}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full gap-1.5 shadow-sm shadow-emerald-500/20"
          >
            {submitting ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                Subscribing…
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" /> Yeah, sign me up
              </>
            )}
          </Button>
        </form>
      </div>

      {/* ── Success modal ─────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-emerald-100 overflow-hidden"
          >
            {/* Brand-green top rail */}
            <div className="h-1.5 bg-gradient-to-r from-brand via-emerald-400 to-teal-400" />

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 h-8 w-8 inline-flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-7 text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-brand-soft flex items-center justify-center mb-4 ring-4 ring-brand/15">
                <CheckCircle2 className="h-8 w-8 text-brand" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                {alreadyIn ? "You're already on the list" : 'You’re in!'}
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {alreadyIn
                  ? 'Thanks for the enthusiasm — we’ve already got you covered. Check your inbox each week for the digest.'
                  : 'Thanks for subscribing. Your first weekly digest will arrive in your inbox shortly.'}
              </p>
              <Button
                onClick={() => setOpen(false)}
                className="mt-6 gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                Back to reading
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
