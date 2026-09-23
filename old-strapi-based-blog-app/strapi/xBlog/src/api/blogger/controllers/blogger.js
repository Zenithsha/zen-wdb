'use strict';

module.exports = {
  /**
   * GET /api/blogger/dashboard
   * Returns the authenticated blogger's article stats and recent articles
   */
  async dashboard(ctx) {
    const userId = ctx.state.user.id;

    const [draft, pending, published, rejected] = await Promise.all([
      strapi.documents('api::article.article').count({
        filters: { author: { id: userId }, status: 'draft' },
      }),
      strapi.documents('api::article.article').count({
        filters: { author: { id: userId }, status: 'pending' },
      }),
      strapi.documents('api::article.article').count({
        filters: { author: { id: userId }, status: 'published' },
      }),
      strapi.documents('api::article.article').count({
        filters: { author: { id: userId }, status: 'rejected' },
      }),
    ]);

    const recentArticles = await strapi.documents('api::article.article').findMany({
      filters: { author: { id: userId } },
      sort: { updatedAt: 'desc' },
      limit: 10,
      populate: ['tags', 'coverImage'],
    });

    // Calculate total views across all articles
    const allArticles = await strapi.documents('api::article.article').findMany({
      filters: { author: { id: userId } },
      fields: ['viewCount'],
    });
    const totalViews = allArticles.reduce((sum, a) => sum + (a.viewCount || 0), 0);

    return ctx.send({
      data: {
        stats: {
          draft,
          pending,
          published,
          rejected,
          total: draft + pending + published + rejected,
          totalViews,
        },
        recentArticles,
      },
    });
  },

  /**
   * GET /api/blogger/analytics
   * Returns detailed analytics for the blogger's published articles
   */
  async analytics(ctx) {
    const userId = ctx.state.user.id;

    const articles = await strapi.documents('api::article.article').findMany({
      filters: { author: { id: userId }, status: 'published' },
      sort: { viewCount: 'desc' },
      populate: ['reactions', 'tags'],
    });

    const allArticlesForComments = await strapi.documents('api::article.article').findMany({
      filters: { author: { id: userId }, status: 'published' },
      populate: ['comments'],
    });

    const totalViews = articles.reduce((sum, a) => sum + (a.viewCount || 0), 0);
    const totalReactions = articles.reduce((sum, a) => sum + (a.reactions?.length || 0), 0);
    const totalComments = allArticlesForComments.reduce(
      (sum, a) => sum + (a.comments?.length || 0),
      0
    );

    const topArticles = articles.slice(0, 5).map((a) => ({
      documentId: a.documentId,
      title: a.title,
      slug: a.slug,
      viewCount: a.viewCount || 0,
      reactionCount: a.reactions?.length || 0,
      tags: a.tags?.map((t) => t.name) || [],
    }));

    // Tag popularity across author's articles
    const tagCounts = {};
    articles.forEach((a) => {
      a.tags?.forEach((tag) => {
        tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1;
      });
    });
    const popularTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return ctx.send({
      data: {
        overview: {
          totalArticles: articles.length,
          totalViews,
          totalReactions,
          totalComments,
        },
        topArticles,
        popularTags,
      },
    });
  },
};
