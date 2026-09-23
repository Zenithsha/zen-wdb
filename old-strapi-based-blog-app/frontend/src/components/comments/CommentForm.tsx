'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api, getStrapiMediaUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import toast from 'react-hot-toast';
import type { Comment } from '@/types';

interface Props {
  articleDocumentId: string;
  parentCommentId?: string;
  onSuccess: (comment: Comment) => void;
  onCancel?: () => void;
  placeholder?: string;
}

interface MentionUser {
  id: number;
  username: string;
  displayName: string;
  profilePicture?: { url: string } | null;
}

export default function CommentForm({ articleDocumentId, parentCommentId, onSuccess, onCancel, placeholder }: Props) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── @mention autocomplete state ──────────────────────────────
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionUser[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionStartRef = useRef<number | null>(null); // caret index of the '@'

  // Detect "@partial" right before the caret. Open dropdown when found.
  const updateMentionState = (value: string, caret: number) => {
    // Walk backwards from caret looking for '@'. Stop at whitespace.
    let i = caret - 1;
    while (i >= 0) {
      const ch = value[i];
      if (ch === '@') {
        // Must be at start of string OR preceded by whitespace, otherwise it's an email-ish thing
        const prev = i > 0 ? value[i - 1] : '';
        if (i === 0 || /\s/.test(prev)) {
          mentionStartRef.current = i;
          setMentionQuery(value.slice(i + 1, caret));
          setMentionIndex(0);
          return;
        }
        break;
      }
      if (/\s/.test(ch)) break;
      i--;
    }
    mentionStartRef.current = null;
    setMentionQuery(null);
    setMentionResults([]);
  };

  // Debounced fetch for the dropdown list. Fires as soon as `@` is typed so the
  // viewer sees the article author + prior commenters without having to type.
  useEffect(() => {
    if (mentionQuery === null) return;
    let cancelled = false;
    const t = setTimeout(() => {
      const qs = new URLSearchParams({
        q: mentionQuery,
        articleDocumentId,
      }).toString();
      api
        .get<{ data: MentionUser[] }>(`/auth/mention-search?${qs}`)
        .then((res) => {
          if (cancelled) return;
          setMentionResults(res.data.data || []);
          // Reset the highlight whenever the result list changes so the
          // currently-highlighted index can't point past the new length.
          setMentionIndex(0);
        })
        .catch(() => { if (!cancelled) setMentionResults([]); });
    }, 120);
    return () => { cancelled = true; clearTimeout(t); };
  }, [mentionQuery, articleDocumentId]);

  const insertMention = (u: MentionUser) => {
    const ta = textareaRef.current;
    if (!ta) return;

    // Read the live DOM value (`ta.value`) instead of the React `content`
    // state so we never operate on stale closure data. This also makes
    // the function safe to call from any handler (click, keydown, etc.).
    const liveValue = ta.value;
    const caret = ta.selectionStart ?? liveValue.length;

    // Re-derive the `@` start position if the ref got cleared. Walk back
    // from the caret looking for an `@` at start-of-string or preceded
    // by whitespace.
    let start = mentionStartRef.current;
    if (start === null || liveValue[start] !== '@') {
      start = null;
      for (let i = caret - 1; i >= 0; i--) {
        const ch = liveValue[i];
        if (ch === '@') {
          const prev = i > 0 ? liveValue[i - 1] : '';
          if (i === 0 || /\s/.test(prev)) { start = i; }
          break;
        }
        if (/\s/.test(ch)) break;
      }
    }
    // If no `@` is reachable, append the mention at the caret so the
    // click is never a silent no-op.
    if (start === null) start = caret;

    const before = liveValue.slice(0, start);
    const after = liveValue.slice(caret);
    const inserted = `@${u.username} `;
    const next = before + inserted + after;

    setContent(next);
    // Reset mention state
    mentionStartRef.current = null;
    setMentionQuery(null);
    setMentionResults([]);

    // Restore caret right after the inserted mention. setTimeout (0) lets
    // React commit the new `content` value before we set the selection.
    const pos = before.length + inserted.length;
    window.setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionResults.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        // Clamp the index in case results changed while user was navigating.
        const idx = Math.min(Math.max(0, mentionIndex), mentionResults.length - 1);
        const target = mentionResults[idx];
        if (target) insertMention(target);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        setMentionResults([]);
        return;
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);
    updateMentionState(value, e.target.selectionStart ?? value.length);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlightRef.current) return;
    if (!content.trim()) return;
    if (!user) { toast.error('Please login to comment'); return; }

    inFlightRef.current = true;
    setLoading(true);
    try {
      const res = await api.post<{ data: Comment }>('/comments', {
        data: {
          content: content.trim(),
          article: articleDocumentId,
          ...(parentCommentId ? { parentComment: parentCommentId } : {}),
        },
      });
      setContent('');
      const created = res.data.data;
      const normalized: Comment = {
        ...created,
        user: created.user || (user
          ? {
              id: user.id,
              documentId: user.documentId,
              username: user.username,
              displayName: user.displayName,
              profilePicture: user.profilePicture,
            } as Comment['user']
          : undefined),
        parentComment: created.parentComment || (parentCommentId
          ? ({ documentId: parentCommentId } as Comment)
          : undefined),
      };
      onSuccess(normalized);
      // Tell the notification bell to refresh immediately. The
      // mentioned user / article author will see the new notification
      // within ~1s instead of waiting for the next poll tick.
      try { window.dispatchEvent(new Event('xblog:notifications-ping')); } catch { /* SSR / non-DOM */ }
      toast.success(parentCommentId ? 'Reply posted!' : 'Comment posted!');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        <a href="/login" className="text-primary hover:underline">Sign in</a> to leave a comment.
      </p>
    );
  }

  // Show the dropdown anytime the user is in a mention context, even when
  // there are no results yet — otherwise it looks like the feature broke.
  const showMentionDropdown = mentionQuery !== null;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Write a comment... (type @ to mention someone)'}
          rows={3}
          disabled={loading}
          className="resize-none"
        />

        {showMentionDropdown && (
          // `onMouseDown preventDefault` on the WRAPPER stops the click
          // from blurring the textarea before `onClick` on the button
          // runs (the canonical pattern for focus-stealing dropdowns).
          // Then each button uses a normal `onClick` — runs after the
          // browser has stably committed the mouseup, no race.
          <div
            className="absolute left-2 right-2 top-full mt-1 z-10 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg"
            onMouseDown={(e) => e.preventDefault()}
          >
            {mentionResults.length > 0 ? (
              mentionResults.map((u, i) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => insertMention(u)}
                  onMouseEnter={() => setMentionIndex(i)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    i === mentionIndex ? 'bg-brand-soft' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* `pointer-events-none` on every inner element so the
                      click always lands on the parent button, never on
                      an avatar/span which could swallow it. */}
                  <Avatar className="h-6 w-6 pointer-events-none">
                    <AvatarImage src={u.profilePicture ? getStrapiMediaUrl(u.profilePicture.url) : undefined} />
                    <AvatarFallback className="text-[10px]">{u.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium pointer-events-none">{u.displayName}</span>
                  <span className="text-xs text-muted-foreground pointer-events-none">@{u.username}</span>
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-xs text-slate-500">
                {mentionQuery
                  ? <>No matches for <span className="font-mono text-slate-700">@{mentionQuery}</span>. Keep typing to search globally…</>
                  : 'Type a name to mention someone…'}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={loading || !content.trim()}>
          {loading ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </form>
  );
}
