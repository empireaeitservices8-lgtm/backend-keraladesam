const BreakingNews = require('../models/BreakingNews');
const mysqlService = require('../services/mysqlService');

exports.getBreakingNews = async (req, res) => {
  try {
    if (process.env.DB_TYPE === 'mysql') {
      const headlines = await mysqlService.getBreakingNews();
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
      return res.status(200).json({
        success: true,
        count: headlines.length,
        headlines,
      });
    }

    let headlines = await BreakingNews.find({ active: true })
      .sort({ createdAt: -1 })
      .lean();

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');

    res.status(200).json({
      success: true,
      count: headlines.length,
      headlines,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch breaking news',
    });
  }
};

exports.addBreakingNews = async (req, res) => {
  try {
    const { headline, category } = req.body;

    if (!headline || !headline.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Headline is required',
      });
    }

    if (process.env.DB_TYPE === 'mysql') {
      const item = await mysqlService.createBreakingNews(headline);
      return res.status(201).json({
        success: true,
        message: 'Breaking news added successfully',
        item,
      });
    }

    const item = await BreakingNews.create({
      headline: headline.trim(),
      category: category || 'തത്സമയം',
      active: true,
    });

    res.status(201).json({
      success: true,
      message: 'Breaking news added successfully',
      item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add breaking news',
    });
  }
};

exports.deleteBreakingNews = async (req, res) => {
  try {
    const { id } = req.params;

    if (process.env.DB_TYPE === 'mysql') {
      const deleted = await mysqlService.deleteBreakingNews(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Breaking news item not found',
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Breaking news deleted successfully',
      });
    }

    const item = await BreakingNews.findByIdAndDelete(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Breaking news item not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Breaking news deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete breaking news',
    });
  }
};

exports.updateBreakingNews = async (req, res) => {
  try {
    const { id } = req.params;
    const { headline, active, category } = req.body;

    if (process.env.DB_TYPE === 'mysql') {
      const item = await mysqlService.updateBreakingNews(id, { headline, active });
      if (!item) {
        return res.status(404).json({
          success: false,
          error: 'Breaking news item not found',
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Breaking news updated successfully',
        item,
      });
    }

    const updateData = {};
    if (headline !== undefined) updateData.headline = headline.trim();
    if (active !== undefined) updateData.active = Boolean(active);
    if (category !== undefined) updateData.category = category.trim();

    const item = await BreakingNews.findByIdAndUpdate(id, updateData, { new: true });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Breaking news item not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Breaking news updated successfully',
      item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update breaking news',
    });
  }
};

