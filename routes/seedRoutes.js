const express = require('express');
const router = express.Router();
const mysqlService = require('../services/mysqlService');
const { initialArticles, initialBreaking, initialVideos } = require('../data/seedData');
const { query } = require('../config/mysql');

const handleSeed = async (req, res) => {
  try {
    let insertedArticles = 0;
    let existingArticles = 0;

    for (const item of initialArticles) {
      try {
        if (mysqlService.isArticleDeleted && mysqlService.isArticleDeleted(item.customId)) {
          continue;
        }
        const rows = await query('SELECT id FROM articles WHERE custom_id = ? LIMIT 1', [item.customId]);
        if (!rows || rows.length === 0) {
          await mysqlService.createArticle(item);
          insertedArticles++;
        } else {
          existingArticles++;
        }
      } catch (err) {
        console.warn('Seed article skip:', err.message);
      }
    }

    let insertedBreaking = 0;
    try {
      const breakingRows = await query('SELECT COUNT(*) as count FROM breaking_news');
      if (breakingRows && breakingRows[0]?.count === 0) {
        for (const text of initialBreaking) {
          await mysqlService.createBreakingNews(text);
          insertedBreaking++;
        }
      }
    } catch (err) {
      console.warn('Seed breaking news skip:', err.message);
    }

    let insertedVideos = 0;
    try {
      const videoRows = await query('SELECT COUNT(*) as count FROM videos');
      if (videoRows && videoRows[0]?.count === 0 && Array.isArray(initialVideos)) {
        for (const vid of initialVideos) {
          await mysqlService.createVideo(vid);
          insertedVideos++;
        }
      }
    } catch (err) {
      console.warn('Seed videos skip:', err.message);
    }

    let totalArticlesInDb = 0;
    let totalVideosInDb = 0;
    try {
      const totalArticlesRows = await query('SELECT COUNT(*) as count FROM articles');
      const totalVideosRows = await query('SELECT COUNT(*) as count FROM videos');
      totalArticlesInDb = totalArticlesRows[0]?.count || 0;
      totalVideosInDb = totalVideosRows[0]?.count || 0;
    } catch {}

    return res.status(200).json({
      success: true,
      message: 'Seed completed or resiliently cached',
      insertedArticles,
      existingArticles,
      insertedBreaking,
      insertedVideos,
      totalArticlesInDb,
      totalVideosInDb,
      sampleArticlesAvailable: initialArticles.length,
      sampleVideosAvailable: initialVideos.length,
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      warning: error.message,
      message: 'Database not reachable or using local cache. For persistent storage across container restarts, set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in environment variables.',
      sampleArticlesAvailable: initialArticles.length,
    });
  }
};

router.post('/', handleSeed);
router.get('/', handleSeed);

module.exports = router;
