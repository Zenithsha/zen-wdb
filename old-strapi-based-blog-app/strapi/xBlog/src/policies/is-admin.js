'use strict';

module.exports = async (policyContext, config, { strapi }) => {
  let user = policyContext.state.user;

  if (!user) {
    strapi.log.warn('[is-admin] reject — no ctx.state.user (JWT missing or invalid)');
    return false;
  }

  // Strapi's users-permissions auth sometimes hands us a user without `role`
  // populated (depends on middleware path). Re-fetch with role if missing.
  if (!user.role || !user.role.type) {
    const full = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      populate: ['role'],
    });
    if (full) {
      user = full;
      policyContext.state.user = full;
    }
  }

  const type = user?.role?.type;
  if (type === 'admin') return true;

  strapi.log.warn(
    `[is-admin] reject — user.id=${user?.id} username=${user?.username} role.type=${type}`
  );
  return false;
};
