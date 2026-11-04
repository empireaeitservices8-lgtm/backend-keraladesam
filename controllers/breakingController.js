const mysqlService = require('../services/mysqlService');

exports.getBreakingNews = async (req, res) => {
  try {
    const headlines = await mysqlService.getBreakingNews();
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    return res.status(200).json({
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
    const { headline } = req.body;

    if (!headline || !headline.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Headline is required',
      });
    }

    const item = await mysqlService.createBreakingNews(headline);
    return res.status(201).json({
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
    const { headline, active } = req.body;

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
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update breaking news',
    });
  }
};
