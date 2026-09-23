'use strict';

/**
 * Generic ownership policy — supports article, comment, and reaction
 * routes. Previously this was hardcoded to look up an article by
 * `:id`, which meant the same policy applied to `/comments/:id` and
 * `/reactions/:id` always failed (no article matched that documentId)
 * and every non-admin DELETE silently returned 403.
 *
 * Now the policy:
 *   1. Lets admins through unconditionally (kept from old behaviour).
 *   2. Sniffs the route URL to figure out which model is being touched.
 *   3. Looks up THAT model by documentId and compares the appropriate
 *      ownership relation (`author` for articles, `user` for comments
 *      and reactions).
 */
module.exports = async (policyContext, config, { strapi }) => {
  const user = policyContext.state.user;
  if (!user) return false;

  // Admins can act on any resource.
  if (user.role && user.role.type === 'admin') return true;

  const resourceId = policyContext.params?.id;
  if (!resourceId) return false;

  // Detect the resource type from the request URL.
  const url = String(policyContext.request?.url || '');
  let info = null;
  if (/^\/api\/articles\//.test(url) || url === '/api/articles') {
    info = { uid: 'api::article.article', field: 'author' };
  } else if (/^\/api\/comments\//.test(url) || url === '/api/comments') {
    info = { uid: 'api::comment.comment', field: 'user' };
  } else if (/^\/api\/reactions\//.test(url) || url === '/api/reactions') {
    info = { uid: 'api::reaction.reaction', field: 'user' };
  }

  if (!info) {
    strapi.log.warn(`[is-owner] no model mapping for url=${url}`);
    return false;
  }

  const entity = await strapi.documents(info.uid).findOne({
    documentId: resourceId,
    populate: { [info.field]: true },
  });

  if (!entity) return false;

  const owner = entity[info.field];
  return !!owner && owner.id === user.id;
};
