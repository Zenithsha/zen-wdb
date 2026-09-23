'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const VALID_TYPES = ['like', 'love', 'fire', 'insightful'];

module.exports = createCoreController('api::reaction.reaction', ({ strapi }) => ({
  /**
   * Override find/findOne so the role-based output sanitiser doesn't strip
   * the `user` relation from responses. Without this the ReactionBar can't
   * tell which reactions are mine, so it sends a duplicate `POST /reactions`
   * on every click and the server rejects with "already reacted" → frontend
   * surfaces "Failed to react" even though the row exists in the DB.
   */
  async find(ctx) {
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const { results, pagination } = await strapi
      .service('api::reaction.reaction')
      .find(sanitizedQuery);
    return this.transformResponse(results, { pagination });
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const entity = await strapi
      .service('api::reaction.reaction')
      .findOne(id, sanitizedQuery);
    return this.transformResponse(entity);
  },

  async create(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in to react');
    const userId = ctx.state.user.id;
    const { article, type } = ctx.request.body?.data || {};

    if (!article || !type) return ctx.badRequest('article and type are required');
    if (!VALID_TYPES.includes(type)) return ctx.badRequest('Invalid reaction type');

    // Prevent duplicate (user, article, type)
    const existing = await strapi.documents('api::reaction.reaction').findMany({
      filters: {
        user: { id: userId },
        article: { documentId: article },
        type,
      },
    });
    if (existing && existing.length > 0) {
      return ctx.badRequest('You have already reacted with this type on this article');
    }

    const created = await strapi.documents('api::reaction.reaction').create({
      data: { type, article, user: userId },
      populate: ['user', 'article'],
    });

    // Notify the article's author about the new reaction.
    try {
      const { createNotification } = require('../../notification/controllers/notification');
      const articleDoc = await strapi.documents('api::article.article').findOne({
        documentId: article,
        populate: { author: { fields: ['id'] } },
        fields: ['title', 'slug'],
      });
      const actorName = ctx.state.user.displayName || ctx.state.user.username;
      if (articleDoc?.author?.id) {
        await createNotification(strapi, {
          type: 'reaction',
          title: `${actorName} reacted with ${type} to "${articleDoc.title}"`,
          link: `/articles/${articleDoc.slug}`,
          recipientId: articleDoc.author.id,
          actorId: userId,
        });
      }
    } catch (err) {
      strapi.log.warn(`[reaction.create] notification step failed: ${err.message}`);
    }

    return ctx.send({ data: created });
  },
}));
