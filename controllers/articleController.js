const Article = require('../models/Article');

exports.getArticles = async (req, res) => {
  try {
    const { category, search, trending, district, limit = 50, page = 1 } = req.query;
    const query = {};

    if (category && category !== 'all' && category !== 'എല്ലാം') {
      query.category = { $regex: category, $options: 'i' };
    }

    if (trending === 'true') {
      query.trending = true;
    }

    if (district && district !== 'all' && district !== 'എല്ലാം') {
      query.district = { $regex: district, $options: 'i' };
    }

    if (search && search.trim()) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { lead: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { district: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let total = await Article.countDocuments(query);

    // Auto-seed if database has 0 articles
    if (total === 0 && Object.keys(query).length === 0) {
      try {
        const { initialArticles } = require('../data/seedData');
        await Article.insertMany(initialArticles);
        total = await Article.countDocuments(query);
      } catch (seedErr) {
        console.error('Auto-seed error:', seedErr.message);
      }
    }

    const articles = await Article.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: articles.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      articles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch articles',
    });
  }
};

exports.getArticleById = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);

    const article = await Article.findOne({
      $or: [{ customId: id }, { _id: isObjectId ? id : null }],
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    res.status(200).json({
      success: true,
      article,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch article',
    });
  }
};

exports.createArticle = async (req, res) => {
  try {
    const body = req.body;

    if (!body.title || !body.lead || !body.category) {
      return res.status(400).json({
        success: false,
        error: 'Title, lead, and category are required',
      });
    }

    const customId =
      body.customId ||
      body.title
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-') +
        '-' +
        Date.now().toString().slice(-4);

    const newArticle = await Article.create({
      customId,
      title: body.title,
      lead: body.lead,
      category: body.category,
      categoryColor: body.categoryColor || '#C8102E',
      imageUrl:
        body.imageUrl ||
        'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
      imageCaption: body.imageCaption || '',
      readTime: body.readTime || '3 മിനിറ്റ് വായന',
      audioDuration: body.audioDuration || '03:00',
      paragraphs: Array.isArray(body.paragraphs) ? body.paragraphs : [body.lead],
      highlights: body.highlights || [],
      author: body.author || {
        name: req.user?.name || 'കേരളദേശം ന്യൂസ് ഡെസ്ക്',
        designation: req.user?.role === 'admin' ? 'ചീഫ് എഡിറ്റർ' : 'സ്റ്റാഫ് റിപ്പോർട്ടർ',
        location: 'കേരളം',
        avatar:
          req.user?.avatar ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        verified: true,
      },
      district: body.district || '',
      country: body.country || '',
      views: '1',
      tags: body.tags || [],
      trending: Boolean(body.trending),
      breaking: Boolean(body.breaking),
      publishedAt: new Date().toLocaleString('ml-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    });

    res.status(201).json({
      success: true,
      message: 'Article created successfully',
      article: newArticle,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create article',
    });
  }
};

exports.updateArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);

    const article = await Article.findOneAndUpdate(
      { $or: [{ customId: id }, { _id: isObjectId ? id : null }] },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Article updated successfully',
      article,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update article',
    });
  }
};

exports.deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);

    const article = await Article.findOneAndDelete({
      $or: [{ customId: id }, { _id: isObjectId ? id : null }],
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Article deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete article',
    });
  }
};
