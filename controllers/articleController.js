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
      const cleanSearch = search.trim();
      const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const orConditions = [
        { title: { $regex: escaped, $options: 'i' } },
        { lead: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } },
        { district: { $regex: escaped, $options: 'i' } },
      ];

      const words = cleanSearch
        .replace(/['"`’‘“”.,;:!?।\-_/\\()]+/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

      if (words.length > 1) {
        words.slice(0, 5).forEach((w) => {
          orConditions.push({ title: { $regex: w, $options: 'i' } });
        });
      }

      query.$or = orConditions;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let total = await Article.countDocuments(query);

    const articles = await Article.find(query)
      .select('-imageData')
      .sort({ isHeadline: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Vercel Edge CDN Caching: 15s edge cache, 60s stale-while-revalidate for super fast load times
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');

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
    const isObjectId = id && id.match(/^[0-9a-fA-F]{24}$/);

    const article = isObjectId
      ? await Article.findById(id).select('-imageData').lean()
      : await Article.findOne({ customId: id }).select('-imageData').lean();

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    // Increment view count asynchronously in background without delaying HTTP response
    Article.updateOne({ _id: article._id }, { $inc: { viewsCount: 1 } }).catch(() => {});

    // Cache article page at Edge for 30s
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');

    res.status(200).json({
      success: true,
      article,
    });

    // Keep views string synced with viewsCount
    if (article.viewsCount) {
      article.views = String(article.viewsCount);
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

// Helper to parse paragraphs robustly from string, array, or JSON
function parseParagraphs(input, fallbackLead = '') {
  if (Array.isArray(input)) {
    const list = input
      .map((p) => (typeof p === 'string' ? p.trim() : String(p || '').trim()))
      .filter(Boolean);
    if (list.length > 0) return list;
  } else if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        const list = parsed
          .map((p) => (typeof p === 'string' ? p.trim() : String(p || '').trim()))
          .filter(Boolean);
        if (list.length > 0) return list;
      }
    } catch (e) {
      // Not JSON, treat as multiline text
    }
    const list = input
      .split(/\n\s*\n|\r\n\s*\r\n|\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (list.length > 0) return list;
  }
  return fallbackLead ? [fallbackLead.trim()] : [];
}

// Helper to parse string or array tags/highlights
function parseStringArray(input, separator = ',') {
  if (Array.isArray(input)) {
    return input.map((t) => (typeof t === 'string' ? t.trim() : String(t || '').trim())).filter(Boolean);
  }
  if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.map((t) => (typeof t === 'string' ? t.trim() : String(t || '').trim())).filter(Boolean);
      }
    } catch (e) {}
    return input
      .split(separator)
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);
  }
  return [];
}

exports.createArticle = async (req, res) => {
  try {
    const body = req.body || {};

    if (!body.title || !body.category) {
      return res.status(400).json({
        success: false,
        error: 'Title and category are required',
      });
    }

    // Robust paragraph parsing so full pasted content is never lost
    const paragraphs = parseParagraphs(body.paragraphs || body.content, body.lead);
    const lead = (body.lead && body.lead.trim()) || (paragraphs[0] ? paragraphs[0].slice(0, 300) : body.title.trim());

    // Generate safe, collision-proof customId even with Malayalam titles
    let customId = body.customId;
    if (!customId) {
      const cleanEnglish = (body.title || '')
        .toLowerCase()
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      const uniqueSuffix = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
      customId = cleanEnglish ? `${cleanEnglish.slice(0, 35)}-${uniqueSuffix}` : `news-${uniqueSuffix}`;
    }

    // Image is completely optional - no forced placeholders
    let imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    if (!imageUrl && req.file) {
      imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const isHeadline = Boolean(body.isHeadline === true || body.isHeadline === 'true');
    if (isHeadline) {
      await Article.updateMany({ isHeadline: true }, { isHeadline: false });
    }

    const newArticle = await Article.create({
      customId,
      title: body.title.trim(),
      lead,
      category: body.category.trim(),
      categoryColor: body.categoryColor || '#C8102E',
      imageUrl,
      imageCaption: body.imageCaption ? body.imageCaption.trim() : '',
      readTime: body.readTime || '3 മിനിറ്റ് വായന',
      audioDuration: body.audioDuration || '03:00',
      paragraphs,
      highlights: parseStringArray(body.highlights, '\n'),
      author: body.author || {
        name:
          req.user?.name && req.user.name !== 'Chief Editor'
            ? req.user.name
            : 'കേരളദേശം ന്യൂസ് ഡെസ്ക്',
        designation: req.user?.role === 'admin' ? 'ചീഫ് എഡിറ്റർ' : 'ഡെസ്ക് റിപ്പോർട്ടർ',
        location: 'കേരളം',
        avatar:
          req.user?.avatar && !req.user.avatar.includes('534528741775')
            ? req.user.avatar
            : 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80',
        verified: true,
      },
      district: body.district ? body.district.trim() : '',
      country: body.country ? body.country.trim() : '',
      views: '1',
      viewsCount: 1,
      tags: parseStringArray(body.tags, ','),
      trending: Boolean(body.trending === true || body.trending === 'true'),
      breaking: Boolean(body.breaking === true || body.breaking === 'true'),
      isHeadline,
      publishedAt: new Date().toLocaleString('ml-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    });

    res.status(201).json({
      success: true,
      message: 'Article created successfully',
      article: newArticle,
    });
  } catch (error) {
    console.error('Create article error:', error);
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
    const body = { ...(req.body || {}) };

    if (body.paragraphs) {
      body.paragraphs = parseParagraphs(body.paragraphs, body.lead);
    }
    if (body.tags) {
      body.tags = parseStringArray(body.tags, ',');
    }
    if (body.highlights) {
      body.highlights = parseStringArray(body.highlights, '\n');
    }
    if (body.trending !== undefined) {
      body.trending = Boolean(body.trending === true || body.trending === 'true');
    }
    if (body.breaking !== undefined) {
      body.breaking = Boolean(body.breaking === true || body.breaking === 'true');
    }
    if (body.isHeadline !== undefined) {
      const isH = Boolean(body.isHeadline === true || body.isHeadline === 'true');
      if (isH) {
        await Article.updateMany({ isHeadline: true }, { isHeadline: false });
      }
      body.isHeadline = isH;
    }

    if (!body.imageUrl && req.file) {
      body.imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const article = await Article.findOneAndUpdate(
      { $or: [{ customId: id }, { _id: isObjectId ? id : null }] },
      { $set: body },
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
    console.error('Update article error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update article',
    });
  }
};

exports.setHeadline = async (req, res) => {
  try {
    const { id } = req.params;
    const isObjectId = id.match(/^[0-9a-fA-F]{24}$/);
    const filter = { $or: [{ customId: id }, { _id: isObjectId ? id : null }] };
    const article = await Article.findOne(filter);
    if (!article) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    const targetState = !article.isHeadline;
    if (targetState) {
      await Article.updateMany({ isHeadline: true }, { isHeadline: false });
    }
    article.isHeadline = targetState;
    await article.save();
    res.status(200).json({
      success: true,
      message: targetState ? 'Article set as main headline' : 'Headline pin removed',
      article,
      isHeadline: targetState,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
