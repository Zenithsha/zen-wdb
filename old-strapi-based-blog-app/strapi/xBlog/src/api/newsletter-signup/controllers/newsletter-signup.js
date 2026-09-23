'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = createCoreController(
  'api::newsletter-signup.newsletter-signup',
  ({ strapi }) => ({
    /**
     * POST /api/newsletter/subscribe
     * Body: { email, name?, source? }
     * Public. Idempotent — re-submitting the same email returns the existing
     * record (we don't tell the caller whether it's new or already on the
     * list, to avoid email-enumeration leaks).
     */
    async subscribe(ctx) {
      const body = ctx.request.body || {};
      const email = String(body.email || '').toLowerCase().trim();
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : null;
      const source = typeof body.source === 'string' ? body.source.slice(0, 60) : 'homepage';

      if (!email || !EMAIL_RE.test(email)) {
        return ctx.badRequest('A valid email address is required.');
      }

      try {
        const existing = await strapi.db
          .query('api::newsletter-signup.newsletter-signup')
          .findOne({ where: { email } });

        if (existing) {
          // Re-activate if previously unsubscribed; otherwise it's a noop.
          if (!existing.isActive) {
            await strapi.db.query('api::newsletter-signup.newsletter-signup').update({
              where: { id: existing.id },
              data: { isActive: true, ...(name ? { name } : {}) },
            });
          }
          return ctx.send({ data: { email, alreadySubscribed: true } });
        }

        await strapi.documents('api::newsletter-signup.newsletter-signup').create({
          data: { email, name, source, isActive: true },
        });

        return ctx.send({ data: { email, alreadySubscribed: false } });
      } catch (err) {
        strapi.log.error('[newsletter.subscribe]', err);
        return ctx.internalServerError('Could not save your subscription. Please try again.');
      }
    },
  })
);
