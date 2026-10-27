const express = require('express');
const router = express.Router();
const Article = require('../models/Article');
const BreakingNews = require('../models/BreakingNews');
const Video = require('../models/Video');
const { initialArticles, initialBreaking, initialVideos } = require('../data/seedData');

router.post('/', async (req, res) => {
  try {
    let insertedArticles = 0;
    let existingArticles = 0;

    for (const item of initialArticles) {
      const exists = await Article.findOne({ customId: item.customId });
      if (!exists) {
        await Article.create(item);
        insertedArticles++;
      } else {
        existingArticles++;
      }
    }

    let insertedBreaking = 0;
    const breakingCount = await BreakingNews.countDocuments();
    if (breakingCount === 0) {
      for (const text of initialBreaking) {
        await BreakingNews.create({ headline: text, active: true });
        insertedBreaking++;
      }
    }

    let insertedVideos = 0;
    const videoCount = await Video.countDocuments();
    if (videoCount === 0 && Array.isArray(initialVideos)) {
      for (const vid of initialVideos) {
        await Video.create(vid);
        insertedVideos++;
      }
    }

    const totalInDb = await Article.countDocuments();
    const totalVideos = await Video.countDocuments();

    res.status(200).json({
      success: true,
      message: 'Database seeded successfully',
      insertedArticles,
      existingArticles,
      insertedBreaking,
      insertedVideos,
      totalArticlesInDb: totalInDb,
      totalVideosInDb: totalVideos,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Seeding failed',
    });
  }
});

module.exports = router;
