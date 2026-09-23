'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function uniqueSlug(baseTitle) {
  const base = slugify(baseTitle) || 'article';
  let candidate = base;
  let n = 1;
  while (await strapi.documents('api::article.article').findFirst({ filters: { slug: candidate } })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  /**
   * Override find/findOne so the role-based output sanitiser doesn't strip
   * `excerpt` and `tags` from responses (which broke the edit flow — the
   * page loaded an article with empty tags, then saved that emptiness back
   * to the DB). We still respect role-based read permissions via the route
   * config; we just don't filter fields out of the response payload.
   */
  async find(ctx) {
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const { results, pagination } = await strapi
      .service('api::article.article')
      .find(sanitizedQuery);
    return this.transformResponse(results, { pagination });
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const sanitizedQuery = await this.sanitizeQuery(ctx);
    const entity = await strapi
      .service('api::article.article')
      .findOne(id, sanitizedQuery);
    return this.transformResponse(entity);
  },

  async create(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Not authenticated');

    const body = ctx.request.body?.data || {};
    if (!body.title) return ctx.badRequest('title is required');

    const slug = body.slug || (await uniqueSlug(body.title));
    strapi.log.info(`[article.create] body=${JSON.stringify(body)}`);

    // Step 1: create the article via Documents API (handles documentId
    // generation, lifecycles, etc.) WITHOUT relations — Documents API
    // sometimes silently no-ops the relation in non-admin context.
    const created = await strapi.documents('api::article.article').create({
      data: {
        title: String(body.title),
        slug,
        content: body.content ?? '',
        excerpt:
          typeof body.excerpt === 'string' && body.excerpt.length ? body.excerpt : null,
        readingTime: typeof body.readingTime === 'number' ? body.readingTime : null,
        status: body.status || 'draft',
        author: userId,
        ...(body.coverImage ? { coverImage: body.coverImage } : {}),
      },
    });

    // Step 2: attach tags via db.query — the lowest-level API. It accepts a
    // plain numeric-id array for many-to-many and reliably writes the link
    // table on every Strapi v5 version.
    if (Array.isArray(body.tags) && body.tags.length) {
      const tagIds = body.tags.filter((x) => typeof x === 'number');
      if (tagIds.length) {
        await strapi.db.query('api::article.article').update({
          where: { id: created.id },
          data: { tags: tagIds },
        });
      }
    }

    // Step 3: read back with relations populated.
    const refreshed = await strapi.documents('api::article.article').findOne({
      documentId: created.documentId,
      populate: {
        author: { populate: { profilePicture: true } },
        tags: true,
        coverImage: true,
      },
    });

    strapi.log.info(
      `[article.create] result.excerpt=${refreshed?.excerpt ?? 'null'} result.tags=${
        refreshed?.tags?.map((t) => t.id).join(',') || 'none'
      }`
    );

    return ctx.send({ data: refreshed });
  },

  async update(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Not authenticated');

    const { id } = ctx.params; // documentId
    if (!id) return ctx.badRequest('Missing article id');

    const body = ctx.request.body?.data || {};
    strapi.log.info(`[article.update] documentId=${id} body=${JSON.stringify(body)}`);

    // Resolve documentId → numeric primary key for db.query.
    const existing = await strapi.db.query('api::article.article').findOne({
      where: { documentId: id },
      select: ['id'],
    });
    if (!existing) return ctx.notFound('Article not found');

    // Build the patch — only include fields the client actually sent so we
    // don't overwrite existing values with undefined.
    const data = {};
    if (typeof body.title === 'string') data.title = body.title;
    if (typeof body.content === 'string') data.content = body.content;
    if ('excerpt' in body) {
      data.excerpt = typeof body.excerpt === 'string' && body.excerpt.length ? body.excerpt : null;
    }
    if (typeof body.readingTime === 'number') data.readingTime = body.readingTime;
    if ('coverImage' in body) data.coverImage = body.coverImage;
    if (Array.isArray(body.tags)) {
      // db.query accepts a numeric-id array for M2M and SETS (replaces) the
      // relation. This is the most reliable shape across Strapi v5 versions —
      // the Documents API equivalent was silently no-op'ing for some bloggers.
      data.tags = body.tags.filter((x) => typeof x === 'number');
    }

    strapi.log.info(`[article.update] applying patch=${JSON.stringify(data)}`);

    await strapi.db.query('api::article.article').update({
      where: { id: existing.id },
      data,
    });

    // Read back via Documents API so we return populated relations + the
    // canonical document shape.
    const refreshed = await strapi.documents('api::article.article').findOne({
      documentId: id,
      populate: {
        author: { populate: { profilePicture: true } },
        tags: true,
        coverImage: true,
      },
    });

    strapi.log.info(
      `[article.update] result.excerpt=${refreshed?.excerpt ?? 'null'} result.tags=${
        refreshed?.tags?.map((t) => t.id).join(',') || 'none'
      }`
    );

    return ctx.send({ data: refreshed });
  },

  /**
   * GET /api/articles/pending
   * Returns all articles with status=pending (admin only)
   */
  async findPending(ctx) {
    await this.validateQuery(ctx);
    const sanitizedQuery = await this.sanitizeQuery(ctx);

    const results = await strapi.documents('api::article.article').findMany({
      ...sanitizedQuery,
      filters: { status: 'pending' },
      populate: ['author', 'tags', 'coverImage'],
      sort: { createdAt: 'desc' },
    });

    const total = await strapi.documents('api::article.article').count({
      filters: { status: 'pending' },
    });

    const sanitizedResults = await this.sanitizeOutput(results, ctx);
    return this.transformResponse(sanitizedResults, {
      pagination: { total },
    });
  },

  /**
   * POST /api/articles/:id/approve
   * Sets status to published (admin only)
   */
  async approve(ctx) {
    const { id } = ctx.params;

    const article = await strapi.documents('api::article.article').findOne({
      documentId: id,
    });

    if (!article) {
      return ctx.notFound('Article not found');
    }

    if (article.status !== 'pending') {
      return ctx.badRequest('Only pending articles can be approved');
    }

    const updated = await strapi.documents('api::article.article').update({
      documentId: id,
      data: {
        status: 'published',
        adminFeedback: ctx.request.body?.data?.adminFeedback || null,
      },
      populate: ['author', 'tags'],
    });

    // Notify the article's author.
    try {
      const { createNotification } = require('../../notification/controllers/notification');
      if (updated.author?.id) {
        await createNotification(strapi, {
          type: 'approval',
          title: `Your article "${updated.title}" was approved 🎉`,
          message: updated.adminFeedback || null,
          link: `/articles/${updated.slug}`,
          recipientId: updated.author.id,
          actorId: ctx.state.user?.id,
        });
      }
    } catch (err) {
      strapi.log.warn(`[article.approve] notification step failed: ${err.message}`);
    }

    const sanitized = await this.sanitizeOutput(updated, ctx);
    return this.transformResponse(sanitized);
  },

  /**
   * POST /api/articles/:id/reject
   * Sets status to rejected with reason (admin only)
   */
  async reject(ctx) {
    const { id } = ctx.params;
    const { rejectionReason, adminFeedback } = ctx.request.body?.data || {};

    if (!rejectionReason) {
      return ctx.badRequest('rejectionReason is required');
    }

    const article = await strapi.documents('api::article.article').findOne({
      documentId: id,
    });

    if (!article) {
      return ctx.notFound('Article not found');
    }

    if (article.status !== 'pending') {
      return ctx.badRequest('Only pending articles can be rejected');
    }

    const updated = await strapi.documents('api::article.article').update({
      documentId: id,
      data: {
        status: 'rejected',
        rejectionReason,
        adminFeedback: adminFeedback || null,
      },
      populate: ['author'],
    });

    // Notify the article's author with the rejection reason.
    try {
      const { createNotification } = require('../../notification/controllers/notification');
      if (updated.author?.id) {
        await createNotification(strapi, {
          type: 'rejection',
          title: `Your article "${updated.title}" needs changes`,
          message: rejectionReason || updated.adminFeedback || null,
          link: `/edit/${updated.documentId}`,
          recipientId: updated.author.id,
          actorId: ctx.state.user?.id,
        });
      }
    } catch (err) {
      strapi.log.warn(`[article.reject] notification step failed: ${err.message}`);
    }

    const sanitized = await this.sanitizeOutput(updated, ctx);
    return this.transformResponse(sanitized);
  },

  /**
   * POST /api/articles/:id/submit
   * Blogger submits draft or rejected article for review
   */
  async submit(ctx) {
    const { id } = ctx.params;

    const article = await strapi.documents('api::article.article').findOne({
      documentId: id,
      populate: ['author'],
    });

    if (!article) {
      return ctx.notFound('Article not found');
    }

    if (!['draft', 'rejected'].includes(article.status)) {
      return ctx.badRequest('Only draft or rejected articles can be submitted for review');
    }

    const updated = await strapi.documents('api::article.article').update({
      documentId: id,
      data: {
        status: 'pending',
        rejectionReason: null,
        adminFeedback: null,
      },
      populate: ['author', 'tags', 'coverImage'],
    });

    const sanitized = await this.sanitizeOutput(updated, ctx);
    return this.transformResponse(sanitized);
  },

  /**
   * GET /api/articles/:id/increment-view
   * Public endpoint to increment view counter
   */
  async incrementView(ctx) {
    const { id } = ctx.params;

    const article = await strapi.documents('api::article.article').findOne({
      documentId: id,
    });

    if (!article) {
      return ctx.notFound('Article not found');
    }

    const updated = await strapi.documents('api::article.article').update({
      documentId: id,
      data: {
        viewCount: (article.viewCount || 0) + 1,
      },
    });

    return ctx.send({ viewCount: updated.viewCount });
  },
}));
