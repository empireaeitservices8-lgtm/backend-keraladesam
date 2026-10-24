const BreakingNews = require('../models/BreakingNews');

exports.getBreakingNews = async (req, res) => {
  try {
    let headlines = await BreakingNews.find({ active: true }).sort({ createdAt: -1 });

    if (headlines.length === 0) {
      try {
        const { initialBreaking } = require('../data/seedData');
        const items = initialBreaking.map(text => ({ headline: text, active: true }));
        headlines = await BreakingNews.insertMany(items);
      } catch (err) {
        console.error('Breaking auto-seed error:', err.message);
      }
    }

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
