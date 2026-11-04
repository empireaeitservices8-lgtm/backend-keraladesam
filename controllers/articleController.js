const mysqlService = require('../services/mysqlService');
const cloudflareService = require('../services/cloudflareService');

exports.getArticles = async (req, res) => {
  try {
    const { category, search, trending, district, limit = 50, page = 1 } = req.query;

    const { articles, total } = await mysqlService.getArticles({
      category,
      district,
      search,
      trending,
      limit,
      page,
    });

    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');

    return res.status(200).json({
      success: true,
      count: articles.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      articles,
    });
  } catch (error) {
    console.warn('getArticles fallback:', error.message);
    let fallback = { articles: [], total: 0 };
    try {
      fallback = await mysqlService.getArticles({ limit: 50, page: 1 });
    } catch {}
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
    return res.status(200).json({
      success: true,
      count: (fallback.articles || []).length,
      total: fallback.total || 0,
      page: 1,
      totalPages: 1,
      articles: fallback.articles || [],
    });
  }
};

exports.getArticleById = async (req, res) => {
  try {
    const { id } = req.params;

    const article = await mysqlService.getArticleById(id);
    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json({
      success: true,
      article,
    });
  } catch (error) {
    console.error('Get article error:', error);
    return res.status(500).json({
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
    } catch (e) { }
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

    // Image is completely optional - supports Cloudflare R2 / CDN and data URLs
    let imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    if (!imageUrl && req.file) {
      try {
        const uploadResult = await cloudflareService.uploadMedia(req.file.buffer, req.file.originalname, req.file.mimetype);
        imageUrl = uploadResult.url;
      } catch {
        imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }
    }

    const isHeadline = Boolean(body.isHeadline === true || body.isHeadline === 'true');

    const newArticle = await mysqlService.createArticle({
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
          req.user?.name && !req.user.name.toLowerCase().includes('editor')
            ? req.user.name
            : 'കേരളദേശം ന്യൂസ് ഡെസ്ക്',
        designation: req.user?.role === 'admin' ? 'എഡിറ്റർ' : 'ഡെസ്ക് റിപ്പോർട്ടർ',
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
      isTrending: Boolean(body.trending === true || body.trending === 'true'),
      isBreaking: Boolean(body.breaking === true || body.breaking === 'true'),
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

    return res.status(201).json({
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
    if (req.file) {
      try {
        const uploadResult = await cloudflareService.uploadMedia(req.file.buffer, req.file.originalname, req.file.mimetype);
        body.imageUrl = uploadResult.url;
      } catch {
        body.imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }
    }

    const updateData = { ...body };
    if (body.trending !== undefined) updateData.isTrending = Boolean(body.trending === true || body.trending === 'true');
    if (body.breaking !== undefined) updateData.isBreaking = Boolean(body.breaking === true || body.breaking === 'true');
    if (body.isHeadline !== undefined) updateData.isHeadline = Boolean(body.isHeadline === true || body.isHeadline === 'true');

    const article = await mysqlService.updateArticle(id, updateData);
    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }

    return res.status(200).json({
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

    const result = await mysqlService.setHeadline(id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    return res.status(200).json({
      success: true,
      message: result.isHeadline ? 'Article set as main headline' : 'Headline pin removed',
      article: result.article,
      isHeadline: result.isHeadline,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await mysqlService.deleteArticle(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Article not found',
      });
    }
    return res.status(200).json({
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

exports.likeArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body || {};

    const resLikes = await mysqlService.likeArticle(id, action);
    if (!resLikes) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }
    return res.status(200).json({
      success: true,
      likesCount: resLikes.likesCount,
    });
  } catch (error) {
    console.error('Like error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update like' });
  }
};
