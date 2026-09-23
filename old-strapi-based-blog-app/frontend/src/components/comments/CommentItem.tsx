'use client';

import { useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getStrapiMediaUrl } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import type { Comment } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import CommentForm from './CommentForm';
import toast from 'react-hot-toast';
import { Heart, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  comment: Comment & { __likedByMe?: boolean };
  articleDocumentId: string;
  onDelete: (id: string) => void;
  onReply: (comment: Comment) => void;
  onLikeChange?: (documentId: string, likesCount: number, likedByMe: boolean) => void;
  depth?: number;
}

// Hard cap on visual indentation — beyond this we still allow replies but stop indenting
const MAX_INDENT_DEPTH = 4;

// Regex matches "@username" tokens — letters, digits, underscore, dot, hyphen.
// Captures into a single group so we can wrap them as styled spans.
const MENTION_RE = /(@[A-Za-z0-9_.-]+)/g;

function renderWithMentions(text: string): React.ReactNode[] {
  if (!text) return [text];
  const parts = text.split(MENTION_RE);
  return parts.map((part, i) => {
    if (MENTION_RE.test(part)) {
      // Reset regex state because /g is sticky
      MENTION_RE.lastIndex = 0;
      return (
        <span
          key={i}
          className="text-primary font-medium bg-primary/5 rounded px-0.5"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function CommentItem({
  comment,
  articleDocumentId,
  onDelete,
  onReply,
  onLikeChange,
  depth = 0,
}: Props) {
  const { user } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [displayContent, setDisplayContent] = useState(comment.content);
  const [edited, setEdited] = useState<boolean>(Boolean(comment.isEdited));
  const [saving, setSaving] = useState(false);
  const editInFlight = useRef(false);

  // Derive "liked by me" from either the transient flag (after optimistic update)
  // or the populated likedBy array from the initial fetch.
  const initialLikedByMe =
    comment.__likedByMe ??
    Boolean(user && comment.likedBy?.some((u) => u.id === user.id));

  const [likedByMe, setLikedByMe] = useState<boolean>(initialLikedByMe);
  const [likesCount, setLikesCount] = useState<number>(comment.likesCount || 0);
  const likeInFlight = useRef(false);

  const isOwner = user && comment.user?.id === user.id;
  const isAdmin = user?.role?.type === 'admin';

  const handleDelete = async () => {
    if (editInFlight.current) return;
    if (!confirm('Delete this comment?')) return;
    editInFlight.current = true;
    try {
      await api.delete(`/comments/${comment.documentId}`);
      onDelete(comment.documentId);
      toast.success('Comment deleted');
    } catch {
      toast.error('Failed to delete');
      editInFlight.current = false;
    }
  };

  const handleEdit = async () => {
    if (editInFlight.current) return;
    const trimmed = editContent.trim();
    if (!trimmed) { toast.error('Comment cannot be empty'); return; }
    editInFlight.current = true;
    setSaving(true);
    try {
      await api.put(`/comments/${comment.documentId}`, {
        data: { content: trimmed },
      });
      setDisplayContent(trimmed);
      setEdited(true);
      setIsEditing(false);
      toast.success('Comment updated');
    } catch {
      toast.error('Failed to update');
    } finally {
      editInFlight.current = false;
      setSaving(false);
    }
  };

  const handleToggleLike = async () => {
    if (!user) { toast.error('Please login to like comments'); return; }
    if (likeInFlight.current) return;

    likeInFlight.current = true;
    const prevLiked = likedByMe;
    const prevCount = likesCount;

    // Optimistic update
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));
    setLikedByMe(nextLiked);
    setLikesCount(nextCount);

    try {
      const res = await api.post<{ data: { likesCount: number; likedByMe: boolean } }>(
        `/comments/${comment.documentId}/toggle-like`
      );
      const data = res.data.data;
      setLikedByMe(data.likedByMe);
      setLikesCount(data.likesCount);
      onLikeChange?.(comment.documentId, data.likesCount, data.likedByMe);
    } catch {
      // Revert
      setLikedByMe(prevLiked);
      setLikesCount(prevCount);
      toast.error('Failed to update like');
    } finally {
      likeInFlight.current = false;
    }
  };

  const displayName = comment.user?.displayName || comment.user?.username || 'User';

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
        <AvatarImage src={getStrapiMediaUrl(comment.user?.profilePicture?.url)} alt={displayName} />
        <AvatarFallback className="text-xs">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{displayName}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
          {edited && <span className="text-xs text-muted-foreground">(edited)</span>}
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full text-sm border rounded p-2 resize-none"
              rows={3}
              disabled={saving}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEdit} disabled={saving || !editContent.trim()}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={saving}
                onClick={() => { setEditContent(displayContent); setIsEditing(false); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground/90 whitespace-pre-line">{renderWithMentions(displayContent)}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5">
          {/* Like button */}
          <button
            type="button"
            onClick={handleToggleLike}
            className={cn(
              'inline-flex items-center gap-1 text-xs transition-colors',
              likedByMe
                ? 'text-rose-600 hover:text-rose-700'
                : 'text-muted-foreground hover:text-rose-600'
            )}
            aria-label={likedByMe ? 'Unlike comment' : 'Like comment'}
          >
            <Heart className={cn('h-3.5 w-3.5', likedByMe && 'fill-current')} />
            <span>{likesCount > 0 ? likesCount : ''} {likedByMe ? 'Liked' : 'Like'}</span>
          </button>

          <button
            className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
            onClick={() => setShowReplyForm((v) => !v)}
          >
            <CornerDownRight className="h-3.5 w-3.5" />
            Reply
          </button>

          {(isOwner || isAdmin) && !isEditing && (
            <>
              {isOwner && (
                <button
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setIsEditing(true)}
                >
                  Edit
                </button>
              )}
              <button
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                onClick={handleDelete}
              >
                Delete
              </button>
            </>
          )}
        </div>

        {showReplyForm && (
          <div className="mt-3">
            <CommentForm
              articleDocumentId={articleDocumentId}
              parentCommentId={comment.documentId}
              onSuccess={(reply) => {
                // Ensure parent link is present for tree insertion
                const replyWithParent = reply.parentComment
                  ? reply
                  : { ...reply, parentComment: { documentId: comment.documentId } as Comment };
                onReply(replyWithParent);
                setShowReplyForm(false);
              }}
              onCancel={() => setShowReplyForm(false)}
              placeholder={`Reply to ${displayName}...`}
            />
          </div>
        )}

        {/* Nested replies — recurse */}
        {comment.replies && comment.replies.length > 0 && (
          <div
            className={cn(
              'mt-3 space-y-4',
              depth < MAX_INDENT_DEPTH ? 'pl-4 border-l-2 border-border' : 'pl-2 border-l border-border/50'
            )}
          >
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.documentId}
                comment={reply}
                articleDocumentId={articleDocumentId}
                onDelete={onDelete}
                onReply={onReply}
                onLikeChange={onLikeChange}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
