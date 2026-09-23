'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::article.article', ({ strapi }) => ({
  /**
   * Calculate reading time based on word count (~200 wpm average)
   */
  calculateReadingTime(content) {
    if (!content) return 1;
    const text = content.replace(/<[^>]*>/g, '').replace(/[#*`_~[\]()]/g, '');
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(wordCount / 200));
  },
}));
