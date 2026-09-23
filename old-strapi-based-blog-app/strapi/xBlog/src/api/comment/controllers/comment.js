'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

// Populate used on every read so commenter identity (username/displayName/avatar)
// is returned even for the public (logged-out) role. The default users-permissions
// output sanitizer strips these fields for unauthenticated callers, so we bypass
// sanitizeOutput and hand back the service results directly (Comment has no
// sensitive fields of its own).
const USER_POPULATE = {
  fields: ['id', 'documentId', 'username', 'displayName'],
  populate: { profilePicture: true },
};

const REPLY_POPULATE = {
  user: USER_POPULATE,
  likedBy: { fields: ['id'] },
  parentComment: { fields: ['documentId'] },
};

const FIND_POPULATE = {
  user: USER_POPULATE,
  likedBy: { fields: ['id'] },
  parentComment: { fields: ['documentId'] },
  replies: {
    populate: {
      ...REPLY_POPULATE,
      replies: {
        populate: {
          ...REPLY_POPULATE,
          replies: { populate: REPLY_POPULATE },
        },
      },
    },
  },
};

module.exports = createCoreController('api::comment.comment', ({ strapi }) => ({
  async find(ctx) {
    // sanitizeQuery coerces qs-parsed values correctly (e.g. `$null=true` → boolean)
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const { results, pagination } = await strapi.service('api::comment.comment').find({
      ...sanitizedQuery,
      populate: FIND_POPULATE,
    });
    // Skip sanitizeOutput so user.username/displayName survive for public callers
    return this.transformResponse(results, { pagination });
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const entity = await strapi.service('api::comment.comment').findOne(id, {
      ...sanitizedQuery,
      populate: FIND_POPULATE,
    });
    return this.transformResponse(entity);
  },

  async create(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in to comment');

    const { content, article, parentComment } = ctx.request.body?.data || {};
    if (!content || !String(content).trim()) return ctx.badRequest('Content is required');
    if (!article) return ctx.badRequest('Article is required');

    const trimmed = String(content).trim();
    const actorId = ctx.state.user.id;
    const created = await strapi.documents('api::comment.comment').create({
      data: {
        content: trimmed,
        article,
        user: actorId,
        ...(parentComment ? { parentComment } : {}),
        likesCount: 0,
      },
      populate: {
        user: {
          fields: ['id', 'documentId', 'username', 'displayName'],
          populate: { profilePicture: true },
        },
        parentComment: { fields: ['documentId'] },
        likedBy: { fields: ['id'] },
      },
    });

    // ── Notifications ──────────────────────────────────────────────
    // Priority order:
    //   1. MENTIONS win first. Anyone @-mentioned (including the article
    //      author themselves) gets a "mention" notification — never the
    //      generic "comment" one.
    //   2. The article author gets a comment/reply notification, BUT
    //      only if they weren't already mentioned in this comment.
    //   3. The parent comment's author (on replies) gets a reply
    //      notification, again only if they weren't already mentioned
    //      and aren't the article author already covered.
    // All three skip the actor (no self-notifying).
    try {
      const { createNotification } = require('../../notification/controllers/notification');
      const actor = ctx.state.user;
      const actorName = actor.displayName || actor.username;

      const articleDoc = await strapi.documents('api::article.article').findOne({
        documentId: article,
        populate: { author: { fields: ['id'] } },
        fields: ['title', 'slug', 'documentId'],
      });
      const articleTitle = articleDoc?.title || 'a post';
      const articleSlug = articleDoc?.slug || '';
      const authorId = articleDoc?.author?.id || null;

      // ── 1. Mentions (highest priority) ──────────────────────────
      // Strapi usernames can be mixed-case; the user may type any case.
      // Match each mention case-INSENSITIVELY via $eqi so "@Aniket"
      // resolves to the row stored as "aniket" (or vice versa).
      const mentionedUsernames = Array.from(
        new Set((trimmed.match(/@([A-Za-z0-9_.-]+)/g) || []).map((m) => m.slice(1)))
      );
      const mentionedIds = new Set();
      if (mentionedUsernames.length) {
        // One query per username with $eqi so we exactly match the
        // username insensitively (and catch typos like extra capitals).
        for (const uname of mentionedUsernames) {
          const u = await strapi.db.query('plugin::users-permissions.user').findOne({
            where: { username: { $eqi: uname } },
            select: ['id', 'username'],
          });
          if (!u) continue;
          if (u.id === actorId) continue; // never notify yourself
          if (mentionedIds.has(u.id)) continue;
          mentionedIds.add(u.id);
          await createNotification(strapi, {
            type: 'mention',
            title: `${actorName} mentioned you in "${articleTitle}"`,
            message: trimmed.slice(0, 140),
            link: `/articles/${articleSlug}`,
            recipientId: u.id,
            actorId,
          });
        }
      }

      // ── 2. Article author gets a comment/reply UNLESS they were
      //      already mentioned (in which case the mention above is
      //      the more specific notification).
      if (authorId && authorId !== actorId && !mentionedIds.has(authorId)) {
        await createNotification(strapi, {
          type: parentComment ? 'reply' : 'comment',
          title: `${actorName} ${parentComment ? 'replied to a comment on' : 'commented on'} "${articleTitle}"`,
          message: trimmed.slice(0, 140),
          link: `/articles/${articleSlug}`,
          recipientId: authorId,
          actorId,
        });
      }

      // ── 3. Parent comment's author on replies ───────────────────
      if (parentComment) {
        const parent = await strapi.documents('api::comment.comment').findOne({
          documentId: parentComment,
          populate: { user: { fields: ['id'] } },
        });
        const parentUserId = parent?.user?.id;
        if (
          parentUserId &&
          parentUserId !== actorId &&
          parentUserId !== authorId && // article author already handled above
          !mentionedIds.has(parentUserId)
        ) {
          await createNotification(strapi, {
            type: 'reply',
            title: `${actorName} replied to your comment on "${articleTitle}"`,
            message: trimmed.slice(0, 140),
            link: `/articles/${articleSlug}`,
            recipientId: parentUserId,
            actorId,
          });
        }
      }
    } catch (err) {
      strapi.log.warn(`[comment.create] notification step failed: ${err.message}`);
    }

    return ctx.send({ data: created });
  },

  async update(ctx) {
    if (!ctx.state.user) return ctx.unauthorized();
    const { documentId } = ctx.params;
    if (!documentId) return ctx.badRequest('Missing comment id');
    const { content } = ctx.request.body?.data || {};
    if (content === undefined) return ctx.badRequest('Content is required');

    const updated = await strapi.documents('api::comment.comment').update({
      documentId,
      data: {
        content: String(content),
        isEdited: true,
      },
      populate: {
        user: {
          fields: ['id', 'documentId', 'username', 'displayName'],
          populate: { profilePicture: true },
        },
      },
    });

    return ctx.send({ data: updated });
  },

  /**
   * POST /comments/:documentId/toggle-like
   * Toggles the current user's like on a comment.
   * Returns { data: { likesCount, likedByMe } }.
   */
  async toggleLike(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in to like');
    const { documentId } = ctx.params;
    if (!documentId) return ctx.badRequest('Missing comment id');

    const comment = await strapi.documents('api::comment.comment').findOne({
      documentId,
      populate: ['likedBy'],
    });
    if (!comment) return ctx.notFound('Comment not found');

    const userId = ctx.state.user.id;
    const likedBy = comment.likedBy || [];
    const alreadyLiked = likedBy.some((u) => u.id === userId);

    const nextLikedBy = alreadyLiked
      ? likedBy.filter((u) => u.id !== userId).map((u) => u.id)
      : [...likedBy.map((u) => u.id), userId];

    const updated = await strapi.documents('api::comment.comment').update({
      documentId,
      data: {
        likedBy: nextLikedBy,
        likesCount: nextLikedBy.length,
      },
      populate: ['likedBy'],
    });

    return ctx.send({
      data: {
        documentId,
        likesCount: updated.likesCount || nextLikedBy.length,
        likedByMe: !alreadyLiked,
      },
    });
  },
}));
