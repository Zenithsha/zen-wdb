'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Comment, StrapiListResponse } from '@/types';
import CommentItem from './CommentItem';
import CommentForm from './CommentForm';
import { Separator } from '@/components/ui/separator';
import { MessageSquare } from 'lucide-react';

interface Props {
  articleDocumentId: string;
}

/**
 * Recursively walk the reply tree and apply `fn` to every node.
 * Used so updates (new reply, like change, delete) can reach nodes
 * at any depth — not just top-level comments.
 */
function mapTree(nodes: Comment[], fn: (c: Comment) => Comment | null): Comment[] {
  const out: Comment[] = [];
  for (const node of nodes) {
    const mapped = fn(node);
    if (mapped === null) continue; // deleted
    const replies = mapped.replies ? mapTree(mapped.replies, fn) : mapped.replies;
    out.push({ ...mapped, replies });
  }
  return out;
}

/**
 * Insert `reply` under the comment whose documentId matches `parentId`,
 * anywhere in the tree.
 */
function insertReply(nodes: Comment[], parentId: string, reply: Comment): Comment[] {
  return nodes.map((n) => {
    if (n.documentId === parentId) {
      return { ...n, replies: [...(n.replies || []), reply] };
    }
    if (n.replies && n.replies.length) {
      return { ...n, replies: insertReply(n.replies, parentId, reply) };
    }
    return n;
  });
}

export default function CommentList({ articleDocumentId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Populate 3 levels of replies — enough for most threaded discussions.
    // Each level includes user.profilePicture + likedBy (for "liked by me" check).
    const params = [
      `filters[article][documentId]=${articleDocumentId}`,
      'filters[parentComment][id][$null]=true',
      'populate[user][populate][0]=profilePicture',
      'populate[likedBy][fields][0]=id',
      'populate[replies][populate][user][populate][0]=profilePicture',
      'populate[replies][populate][likedBy][fields][0]=id',
      'populate[replies][populate][replies][populate][user][populate][0]=profilePicture',
      'populate[replies][populate][replies][populate][likedBy][fields][0]=id',
      'populate[replies][populate][replies][populate][replies][populate][user][populate][0]=profilePicture',
      'populate[replies][populate][replies][populate][replies][populate][likedBy][fields][0]=id',
      'sort=createdAt:asc',
      'pagination[pageSize]=50',
    ].join('&');

    api
      .get<StrapiListResponse<Comment>>(`/comments?${params}`)
      .then((res) => setComments(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [articleDocumentId]);

  const handleNewComment = (comment: Comment) => {
    setComments((prev) => [...prev, comment]);
  };

  const handleDeleteComment = (documentId: string) => {
    setComments((prev) => mapTree(prev, (c) => (c.documentId === documentId ? null : c)));
  };

  /**
   * Insert a reply anywhere in the tree. Works for replies to top-level
   * comments AND replies to replies (any depth).
   */
  const handleReply = (reply: Comment) => {
    const parentId = reply.parentComment?.documentId;
    if (!parentId) {
      // Shouldn't happen (reply always has parent), but fall back gracefully
      setComments((prev) => [...prev, reply]);
      return;
    }
    setComments((prev) => insertReply(prev, parentId, reply));
  };

  /**
   * Update a single comment's like state in place (any depth).
   */
  const handleLikeChange = (documentId: string, likesCount: number, likedByMe: boolean) => {
    setComments((prev) =>
      mapTree(prev, (c) =>
        c.documentId === documentId
          ? { ...c, likesCount, __likedByMe: likedByMe } as Comment & { __likedByMe?: boolean }
          : c
      )
    );
  };

  // Count all comments in the tree (incl. nested) for the header
  const totalCount = (function count(nodes: Comment[]): number {
    return nodes.reduce((acc, n) => acc + 1 + count(n.replies || []), 0);
  })(comments);

  return (
    <section className="mt-8">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        Comments {totalCount > 0 && `(${totalCount})`}
      </h3>

      <div className="mb-6">
        <CommentForm
          articleDocumentId={articleDocumentId}
          onSuccess={handleNewComment}
        />
      </div>

      <Separator className="mb-6" />

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.documentId}
              comment={comment}
              articleDocumentId={articleDocumentId}
              onDelete={handleDeleteComment}
              onReply={handleReply}
              onLikeChange={handleLikeChange}
              depth={0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
