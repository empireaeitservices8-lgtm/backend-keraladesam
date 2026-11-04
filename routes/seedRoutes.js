const express = require('express');
const router = express.Router();
const mysqlService = require('../services/mysqlService');
const { initialArticles, initialBreaking, initialVideos } = require('../data/seedData');
const { query } = require('../config/mysql');

router.post('/', async (req, res) => {
  try {
    let insertedArticles = 0;
    let existingArticles = 0;

    for (const item of initialArticles) {
      const rows = await query('SELECT id FROM articles WHERE custom_id = ? LIMIT 1', [item.customId]);
      if (rows.length === 0) {
        await mysqlService.createArticle(item);
        insertedArticles++;
      } else {
        existingArticles++;
      }
    }

    let insertedBreaking = 0;
    const breakingRows = await query('SELECT COUNT(*) as count FROM breaking_news');
    if (breakingRows[0].count === 0) {
      for (const text of initialBreaking) {
        await mysqlService.createBreakingNews(text);
        insertedBreaking++;
      }
    }

    let insertedVideos = 0;
    const videoRows = await query('SELECT COUNT(*) as count FROM videos');
    if (videoRows[0].count === 0 && Array.isArray(initialVideos)) {
      for (const vid of initialVideos) {
        await mysqlService.createVideo(vid);
        insertedVideos++;
      }
    }

    const totalArticlesRows = await query('SELECT COUNT(*) as count FROM articles');
    const totalVideosRows = await query('SELECT COUNT(*) as count FROM videos');

    res.status(200).json({
      success: true,
      message: 'MySQL Database seeded successfully',
      insertedArticles,
      existingArticles,
      insertedBreaking,
      insertedVideos,
      totalArticlesInDb: totalArticlesRows[0]?.count || 0,
      totalVideosInDb: totalVideosRows[0]?.count || 0,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Seeding failed',
    });
  }
});

module.exports = router;
