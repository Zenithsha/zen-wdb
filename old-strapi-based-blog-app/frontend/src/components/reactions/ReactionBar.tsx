'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { REACTION_EMOJIS } from '@/lib/utils';
import type { Reaction } from '@/types';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Props {
  articleDocumentId: string;
}

type ReactionType = 'like' | 'love' | 'fire' | 'insightful';

interface ReactionCounts {
  like: number;
  love: number;
  fire: number;
  insightful: number;
}

export default function ReactionBar({ articleDocumentId }: Props) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<ReactionCounts>({ like: 0, love: 0, fire: 0, insightful: 0 });
  const [myReactions, setMyReactions] = useState<Set<ReactionType>>(new Set());
  // Map from reaction type → documentId of the user's own reaction row.
  // Needed so we can DELETE the right row when toggling off.
  const [myReactionIds, setMyReactionIds] = useState<Partial<Record<ReactionType, string>>>({});
  const [loading, setLoading] = useState(true);
  // Synchronous guard — prevents rapid double-clicks from firing duplicate
  // POST/DELETEs before React state updates.
  const inFlightRef = useRef<Set<ReactionType>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams({
      'filters[article][documentId]': articleDocumentId,
      'populate': 'user',
      'pagination[pageSize]': '100',
    });

    api.get<{ data: Reaction[] }>(`/reactions?${params}`)
      .then((res) => {
        const reacts = res.data.data || [];
        const newCounts: ReactionCounts = { like: 0, love: 0, fire: 0, insightful: 0 };
        const mine = new Set<ReactionType>();
        const mineIds: Partial<Record<ReactionType, string>> = {};

        reacts.forEach((r) => {
          if (r.type in newCounts) newCounts[r.type]++;
          if (user && r.user?.id === user.id) {
            mine.add(r.type);
            if (r.documentId) mineIds[r.type] = r.documentId;
          }
        });

        setCounts(newCounts);
        setMyReactions(mine);
        setMyReactionIds(mineIds);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [articleDocumentId, user]);

  const handleReact = async (type: ReactionType) => {
    if (!user) {
      toast.error('Please login to react');
      return;
    }

    if (inFlightRef.current.has(type)) return;
    inFlightRef.current.add(type);

    const alreadyReacted = myReactions.has(type);

    if (alreadyReacted) {
      // ── UNREACT: optimistically remove, then DELETE the row ──
      const docId = myReactionIds[type];
      if (!docId) {
        // No documentId to delete against; bail out gracefully.
        inFlightRef.current.delete(type);
        return;
      }

      setCounts((prev) => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
      setMyReactions((prev) => {
        const next = new Set(prev); next.delete(type); return next;
      });
      setMyReactionIds((prev) => {
        const next = { ...prev }; delete next[type]; return next;
      });

      try {
        await api.delete(`/reactions/${docId}`);
      } catch {
        // Revert on error
        setCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }));
        setMyReactions((prev) => new Set(prev).add(type));
        setMyReactionIds((prev) => ({ ...prev, [type]: docId }));
        toast.error('Failed to undo reaction');
      } finally {
        inFlightRef.current.delete(type);
      }
      return;
    }

    // ── REACT: optimistically add, then POST ──
    setCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }));
    setMyReactions((prev) => new Set(prev).add(type));

    try {
      const res = await api.post<{ data: Reaction }>('/reactions', {
        data: { type, article: articleDocumentId },
      });
      const created = res.data?.data;
      if (created?.documentId) {
        setMyReactionIds((prev) => ({ ...prev, [type]: created.documentId }));
      }
      // Refresh the notification bell immediately — the article author
      // should see the reaction notification within ~1s instead of
      // waiting for the next bell poll.
      try { window.dispatchEvent(new Event('xblog:notifications-ping')); } catch { /* SSR */ }
    } catch {
      // Revert on error
      setCounts((prev) => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
      setMyReactions((prev) => {
        const next = new Set(prev); next.delete(type); return next;
      });
      toast.error('Failed to react');
    } finally {
      inFlightRef.current.delete(type);
    }
  };

  if (loading) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(REACTION_EMOJIS) as ReactionType[]).map((type) => {
        const active = myReactions.has(type);
        return (
          <button
            key={type}
            onClick={() => handleReact(type)}
            aria-pressed={active}
            title={active ? 'Click again to remove your reaction' : 'React'}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all hover:-translate-y-0.5',
              active
                ? 'bg-brand-soft border-brand text-emerald-800 font-medium shadow-sm shadow-emerald-500/15'
                : 'border-slate-200 bg-white hover:border-brand hover:bg-brand-soft/40'
            )}
          >
            <span className="text-base leading-none">{REACTION_EMOJIS[type]}</span>
            <span>{counts[type]}</span>
          </button>
        );
      })}
    </div>
  );
}
