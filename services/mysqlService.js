const { query } = require('../config/mysql');
const bcrypt = require('bcryptjs');

/**
 * Normalizes a raw MySQL article row into a full frontend-ready Article object.
 * Properly parses JSON paragraphs, highlights, tags, and ensures clean types.
 */
function normalizeArticleRow(row) {
  if (!row) return null;
  let paragraphs = [];
  let highlights = [];
  let tags = [];

  try {
    paragraphs = typeof row.paragraphs === 'string' ? JSON.parse(row.paragraphs) : row.paragraphs || [];
    if (!Array.isArray(paragraphs)) paragraphs = [String(paragraphs)];
  } catch {
    paragraphs = typeof row.paragraphs === 'string' && row.paragraphs.trim() ? [row.paragraphs.trim()] : [];
  }

  try {
    highlights = typeof row.highlights === 'string' ? JSON.parse(row.highlights) : row.highlights || [];
    if (!Array.isArray(highlights)) highlights = [];
  } catch {
    highlights = [];
  }

  try {
    tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [];
    if (!Array.isArray(tags)) tags = [];
  } catch {
    tags = [];
  }

  return {
    _id: String(row.custom_id || row.id),
    id: String(row.custom_id || row.id),
    customId: String(row.custom_id || row.id),
    title: row.title || '',
    lead: row.lead || '',
    category: row.category || 'പ്രധാനം',
    categoryColor: row.category_color || '#006b9a',
    imageUrl: row.image_url || '',
    imageCaption: row.image_caption || '',
    readTime: row.read_time || '3 മിനിറ്റ് വായന',
    audioDuration: row.audio_duration || '03:00',
    paragraphs,
    highlights,
    author: {
      name: (row.author_name || 'കേരളദേശം ന്യൂസ് ഡെസ്ക്').replace(/chief\s*/i, '').replace(/ചീഫ്\s*/, '').trim() || 'എഡിറ്റർ',
      designation: (row.author_designation || 'എഡിറ്റർ').replace(/chief\s*/i, '').replace(/ചീഫ്\s*/, '').trim() || 'എഡിറ്റർ',
      location: row.author_location || 'കേരളം',
      avatar: row.author_avatar || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80',
      verified: Boolean(row.author_verified),
    },
    district: row.district || '',
    country: row.country || '',
    views: String(row.views || row.views_count || '1'),
    viewsCount: Number(row.views_count || 1),
    likesCount: Number(row.likes_count || 0),
    tags,
    isBreaking: Boolean(row.is_breaking),
    isTrending: Boolean(row.is_trending),
    isHeadline: Boolean(row.is_headline),
    publishedAt: row.published_at || (row.created_at ? new Date(row.created_at).toISOString() : ''),
    createdAt: row.created_at,
  };
}

// ----------------- AUTH SERVICE -----------------
async function getUserByEmail(email) {
  if (!email) return null;
  const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase().trim()]);
  if (!rows || rows.length === 0) return null;

  const u = rows[0];
  return {
    _id: String(u.id),
    id: String(u.id),
    name: (u.name || 'എഡിറ്റർ').replace(/chief\s*/i, '').replace(/ചീഫ്\s*/, '').trim() || 'എഡിറ്റർ',
    email: u.email,
    password: u.password,
    role: u.role || 'editor',
    avatar: u.avatar || '',
    matchPassword: async function (enteredPassword) {
      if (!enteredPassword || !this.password) return false;
      return bcrypt.compare(enteredPassword, this.password);
    },
  };
}

async function getUserById(id) {
  if (!id) return null;
  const rows = await query('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ? LIMIT 1', [id]);
  if (!rows || rows.length === 0) return null;

  const u = rows[0];
  return {
    _id: String(u.id),
    id: String(u.id),
    name: (u.name || 'എഡിറ്റർ').replace(/chief\s*/i, '').replace(/ചീഫ്\s*/, '').trim() || 'എഡിറ്റർ',
    email: u.email,
    role: u.role || 'editor',
    avatar: u.avatar || '',
  };
}

async function createUser({ name, email, password, role, avatar }) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const av = avatar || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80';
  const cleanName = (name || 'എഡിറ്റർ').replace(/chief\s*/i, '').replace(/ചീഫ്\s*/, '').trim() || 'എഡിറ്റർ';

  const result = await query(
    'INSERT INTO users (name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)',
    [cleanName, email.toLowerCase().trim(), hashedPassword, role || 'editor', av]
  );

  return {
    _id: String(result.insertId),
    id: String(result.insertId),
    name: cleanName,
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    role: role || 'editor',
    avatar: av,
    matchPassword: async function (enteredPassword) {
      if (!enteredPassword || !this.password) return false;
      return bcrypt.compare(enteredPassword, this.password);
    },
  };
}

// ----------------- ARTICLES SERVICE -----------------
async function getArticles({ category, district, search, trending, limit = 50, page = 1 }) {
  let whereClauses = [];
  let params = [];

  if (category && category !== 'all' && category !== 'എല്ലാം') {
    whereClauses.push('LOWER(category) LIKE ?');
    params.push(`%${category.toLowerCase().trim()}%`);
  }

  if (district && district !== 'all' && district !== 'എല്ലാം') {
    whereClauses.push('LOWER(district) LIKE ?');
    params.push(`%${district.toLowerCase().trim()}%`);
  }

  if (trending === 'true' || trending === true) {
    whereClauses.push('is_trending = 1');
  }

  if (search && search.trim()) {
    const s = `%${search.trim().toLowerCase()}%`;
    whereClauses.push('(LOWER(title) LIKE ? OR LOWER(`lead`) LIKE ? OR LOWER(district) LIKE ?)');
    params.push(s, s, s);
  }

  const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRows = await query(`SELECT COUNT(*) as total FROM articles ${whereSQL}`, params);
  const total = (countRows && countRows[0]?.total) || 0;

  const parsedLimit = Math.max(1, parseInt(limit) || 50);
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const offset = (parsedPage - 1) * parsedLimit;
  const selectParams = [...params, parsedLimit, offset];

  const rows = await query(
    `SELECT * FROM articles ${whereSQL} ORDER BY is_headline DESC, id DESC LIMIT ? OFFSET ?`,
    selectParams
  );

  const articles = (rows || []).map(normalizeArticleRow);
  return { articles, total };
}

async function getArticleById(id) {
  const rows = await query(
    'SELECT * FROM articles WHERE custom_id = ? OR id = ? LIMIT 1',
    [id, isNaN(Number(id)) ? 0 : Number(id)]
  );
  if (!rows || rows.length === 0) return null;

  query('UPDATE articles SET views_count = views_count + 1 WHERE id = ?', [rows[0].id]).catch(() => {});
  return normalizeArticleRow(rows[0]);
}

async function createArticle(data) {
  const customId = data.customId || `news-${Date.now()}`;
  const isHeadline = Boolean(data.isHeadline);

  if (isHeadline) {
    await query('UPDATE articles SET is_headline = 0 WHERE is_headline = 1');
  }

  const paragraphsJson = JSON.stringify(data.paragraphs || []);
  const highlightsJson = JSON.stringify(data.highlights || []);
  const tagsJson = JSON.stringify(data.tags || []);

  const author = data.author || {};
  const authorName = (author.name || 'കേരളദേശം ന്യൂസ് ഡെസ്ക്').replace(/chief\s*/i, '').replace(/ചീഫ്\s*/, '').trim() || 'എഡിറ്റർ';
  const authorDesignation = (author.designation || 'എഡിറ്റർ').replace(/chief\s*/i, '').replace(/ചീഫ്\s*/, '').trim() || 'എഡിറ്റർ';
  const authorLocation = author.location || 'കേരളം';
  const authorAvatar = author.avatar || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80';
  const authorVerified = author.verified !== undefined ? author.verified : true;

  const result = await query(
    `INSERT INTO articles (
      custom_id, title, \`lead\`, category, category_color, image_url, image_caption,
      read_time, audio_duration, paragraphs, highlights, author_name, author_designation,
      author_location, author_avatar, author_verified, district, country, views,
      views_count, likes_count, tags, is_breaking, is_trending, is_headline, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customId,
      data.title,
      data.lead || '',
      data.category,
      data.categoryColor || '#006b9a',
      data.imageUrl || '',
      data.imageCaption || '',
      data.readTime || '3 മിനിറ്റ് വായന',
      data.audioDuration || '03:00',
      paragraphsJson,
      highlightsJson,
      authorName,
      authorDesignation,
      authorLocation,
      authorAvatar,
      authorVerified ? 1 : 0,
      data.district || '',
      data.country || '',
      data.views || '1',
      data.viewsCount || 1,
      data.likesCount || 0,
      tagsJson,
      data.isBreaking ? 1 : 0,
      data.isTrending ? 1 : 0,
      isHeadline ? 1 : 0,
      data.publishedAt || new Date().toISOString(),
    ]
  );

  return await getArticleById(result.insertId);
}

async function updateArticle(id, data) {
  const isHeadline = data.isHeadline !== undefined ? Boolean(data.isHeadline) : undefined;
  if (isHeadline === true) {
    await query('UPDATE articles SET is_headline = 0 WHERE is_headline = 1');
  }

  const updates = [];
  const params = [];

  if (data.title !== undefined) { updates.push('title = ?'); params.push(data.title.trim()); }
  if (data.lead !== undefined) { updates.push('`lead` = ?'); params.push(data.lead.trim()); }
  if (data.category !== undefined) { updates.push('category = ?'); params.push(data.category.trim()); }
  if (data.categoryColor !== undefined) { updates.push('category_color = ?'); params.push(data.categoryColor); }
  if (data.imageUrl !== undefined) { updates.push('image_url = ?'); params.push(data.imageUrl); }
  if (data.imageCaption !== undefined) { updates.push('image_caption = ?'); params.push(data.imageCaption); }
  if (data.readTime !== undefined) { updates.push('read_time = ?'); params.push(data.readTime); }
  if (data.audioDuration !== undefined) { updates.push('audio_duration = ?'); params.push(data.audioDuration); }
  if (data.paragraphs !== undefined) { updates.push('paragraphs = ?'); params.push(JSON.stringify(data.paragraphs)); }
  if (data.highlights !== undefined) { updates.push('highlights = ?'); params.push(JSON.stringify(data.highlights)); }
  if (data.tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(data.tags)); }
  if (data.district !== undefined) { updates.push('district = ?'); params.push(data.district.trim()); }
  if (data.country !== undefined) { updates.push('country = ?'); params.push(data.country.trim()); }
  if (data.isBreaking !== undefined) { updates.push('is_breaking = ?'); params.push(data.isBreaking ? 1 : 0); }
  if (data.isTrending !== undefined) { updates.push('is_trending = ?'); params.push(data.isTrending ? 1 : 0); }
  if (isHeadline !== undefined) { updates.push('is_headline = ?'); params.push(isHeadline ? 1 : 0); }

  if (updates.length > 0) {
    params.push(id, isNaN(Number(id)) ? 0 : Number(id));
    await query(`UPDATE articles SET ${updates.join(', ')} WHERE custom_id = ? OR id = ?`, params);
  }

  return await getArticleById(id);
}

async function deleteArticle(id) {
  const result = await query(
    'DELETE FROM articles WHERE custom_id = ? OR id = ?',
    [id, isNaN(Number(id)) ? 0 : Number(id)]
  );
  return result && result.affectedRows > 0;
}

async function likeArticle(id, action = 'like') {
  const inc = action === 'unlike' ? -1 : 1;
  await query(
    'UPDATE articles SET likes_count = GREATEST(0, likes_count + ?) WHERE custom_id = ? OR id = ?',
    [inc, id, isNaN(Number(id)) ? 0 : Number(id)]
  );
  const rows = await query(
    'SELECT likes_count FROM articles WHERE custom_id = ? OR id = ? LIMIT 1',
    [id, isNaN(Number(id)) ? 0 : Number(id)]
  );
  return { likesCount: rows && rows[0] ? rows[0].likes_count : 0 };
}

async function setHeadline(id) {
  const rows = await query(
    'SELECT id, is_headline FROM articles WHERE custom_id = ? OR id = ? LIMIT 1',
    [id, isNaN(Number(id)) ? 0 : Number(id)]
  );
  if (!rows || rows.length === 0) return null;

  const targetState = !rows[0].is_headline;
  if (targetState) {
    await query('UPDATE articles SET is_headline = 0 WHERE is_headline = 1');
  }
  await query('UPDATE articles SET is_headline = ? WHERE id = ?', [targetState ? 1 : 0, rows[0].id]);
  const updated = await getArticleById(rows[0].id);
  return { article: updated, isHeadline: targetState };
}

// ----------------- BREAKING NEWS SERVICE -----------------
async function getBreakingNews() {
  const rows = await query('SELECT * FROM breaking_news WHERE active = 1 ORDER BY priority ASC, id DESC');
  return (rows || []).map((r) => ({
    id: r.id,
    _id: String(r.id),
    headline: r.headline,
    active: Boolean(r.active),
    priority: r.priority || 0,
    createdAt: r.created_at,
  }));
}

async function getAllBreakingNews() {
  const rows = await query('SELECT * FROM breaking_news ORDER BY id DESC');
  return (rows || []).map((r) => ({
    id: r.id,
    _id: String(r.id),
    headline: r.headline,
    active: Boolean(r.active),
    priority: r.priority || 0,
    createdAt: r.created_at,
  }));
}

async function createBreakingNews(headline) {
  const result = await query('INSERT INTO breaking_news (headline, active) VALUES (?, 1)', [headline.trim()]);
  return {
    id: result.insertId,
    _id: String(result.insertId),
    headline: headline.trim(),
    active: true,
    priority: 0,
    createdAt: new Date().toISOString(),
  };
}

async function updateBreakingNews(id, { headline, active }) {
  const updates = [];
  const params = [];
  if (headline !== undefined) { updates.push('headline = ?'); params.push(headline.trim()); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }

  if (updates.length > 0) {
    params.push(id);
    await query(`UPDATE breaking_news SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  const rows = await query('SELECT * FROM breaking_news WHERE id = ? LIMIT 1', [id]);
  if (!rows || rows.length === 0) return null;
  return {
    id: rows[0].id,
    _id: String(rows[0].id),
    headline: rows[0].headline,
    active: Boolean(rows[0].active),
    priority: rows[0].priority,
    createdAt: rows[0].created_at,
  };
}

async function deleteBreakingNews(id) {
  const result = await query('DELETE FROM breaking_news WHERE id = ?', [id]);
  return result && result.affectedRows > 0;
}

// ----------------- VIDEOS SERVICE -----------------
async function getVideos({ category, limit = 20, page = 1 }) {
  let whereClause = '';
  let params = [];

  if (category && category !== 'all' && category !== 'എല്ലാം') {
    whereClause = 'WHERE LOWER(category) LIKE ?';
    params.push(`%${category.toLowerCase().trim()}%`);
  }

  const countRows = await query(`SELECT COUNT(*) as total FROM videos ${whereClause}`, params);
  const total = (countRows && countRows[0]?.total) || 0;

  const parsedLimit = Math.max(1, parseInt(limit) || 20);
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const offset = (parsedPage - 1) * parsedLimit;

  const rows = await query(
    `SELECT * FROM videos ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, parsedLimit, offset]
  );

  const videos = (rows || []).map((r) => ({
    id: String(r.id),
    _id: String(r.id),
    title: r.title,
    videoUrl: r.video_url,
    youtubeId: r.youtube_id,
    category: r.category,
    duration: r.duration,
    views: `${(Number(r.views_count) / 1000).toFixed(1)}k`,
    viewsCount: Number(r.views_count),
    thumbnail: r.thumbnail,
    description: r.description || '',
    createdAt: r.created_at,
  }));
  return { videos, total };
}

async function getVideoById(id) {
  const rows = await query('SELECT * FROM videos WHERE id = ? LIMIT 1', [id]);
  if (!rows || rows.length === 0) return null;

  query('UPDATE videos SET views_count = views_count + 1 WHERE id = ?', [id]).catch(() => {});
  const r = rows[0];
  return {
    id: String(r.id),
    _id: String(r.id),
    title: r.title,
    videoUrl: r.video_url,
    youtubeId: r.youtube_id,
    category: r.category,
    duration: r.duration,
    viewsCount: Number(r.views_count) + 1,
    thumbnail: r.thumbnail,
    description: r.description || '',
    createdAt: r.created_at,
  };
}

async function createVideo(data) {
  const result = await query(
    `INSERT INTO videos (title, video_url, youtube_id, category, duration, views_count, thumbnail, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title.trim(),
      data.videoUrl.trim(),
      data.youtubeId || '',
      data.category ? data.category.trim() : 'വാർത്തകൾ',
      data.duration || '02:30',
      data.viewsCount ? parseInt(data.viewsCount) : 1200,
      data.thumbnail || '',
      data.description || '',
    ]
  );

  return await getVideoById(result.insertId);
}

async function updateVideo(id, data) {
  const updates = [];
  const params = [];
  if (data.title !== undefined) { updates.push('title = ?'); params.push(data.title.trim()); }
  if (data.videoUrl !== undefined) { updates.push('video_url = ?'); params.push(data.videoUrl.trim()); }
  if (data.youtubeId !== undefined) { updates.push('youtube_id = ?'); params.push(data.youtubeId.trim()); }
  if (data.category !== undefined) { updates.push('category = ?'); params.push(data.category.trim()); }
  if (data.duration !== undefined) { updates.push('duration = ?'); params.push(data.duration.trim()); }
  if (data.viewsCount !== undefined) { updates.push('views_count = ?'); params.push(parseInt(data.viewsCount)); }
  if (data.thumbnail !== undefined) { updates.push('thumbnail = ?'); params.push(data.thumbnail); }
  if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description.trim()); }

  if (updates.length > 0) {
    params.push(id);
    await query(`UPDATE videos SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  return await getVideoById(id);
}

async function deleteVideo(id) {
  const result = await query('DELETE FROM videos WHERE id = ?', [id]);
  return result && result.affectedRows > 0;
}

// ----------------- SUBSCRIBERS SERVICE -----------------
async function getSubscribers() {
  const rows = await query('SELECT * FROM subscribers ORDER BY id DESC');
  return (rows || []).map((r) => ({
    id: r.id,
    _id: String(r.id),
    email: r.email,
    active: Boolean(r.active),
    createdAt: r.created_at,
  }));
}

async function createSubscriber(email) {
  await query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [email.toLowerCase().trim()]);
  return { email: email.toLowerCase().trim(), active: true };
}

async function deleteSubscriber(id) {
  const result = await query('DELETE FROM subscribers WHERE id = ?', [id]);
  return result && result.affectedRows > 0;
}

// ----------------- AD INQUIRIES SERVICE -----------------
async function getAdInquiries() {
  const rows = await query('SELECT * FROM ad_inquiries ORDER BY id DESC');
  return (rows || []).map((r) => ({
    id: r.id,
    _id: String(r.id),
    name: r.name,
    companyName: r.company_name,
    phone: r.phone,
    email: r.email,
    adType: r.ad_type,
    budget: r.budget,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
  }));
}

async function createAdInquiry(data) {
  const result = await query(
    `INSERT INTO ad_inquiries (name, company_name, phone, email, ad_type, budget, message, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'New')`,
    [
      data.name.trim(),
      (data.companyName || '').trim(),
      data.phone.trim(),
      (data.email || '').trim(),
      data.adType || 'Digital Banner',
      (data.budget || '').trim(),
      (data.message || '').trim(),
    ]
  );

  return {
    id: result.insertId,
    _id: String(result.insertId),
    name: data.name.trim(),
    companyName: (data.companyName || '').trim(),
    phone: data.phone.trim(),
    email: (data.email || '').trim(),
    adType: data.adType || 'Digital Banner',
    budget: (data.budget || '').trim(),
    message: (data.message || '').trim(),
    status: 'New',
    createdAt: new Date().toISOString(),
  };
}

async function updateAdInquiryStatus(id, status) {
  await query('UPDATE ad_inquiries SET status = ? WHERE id = ?', [status, id]);
  const rows = await query('SELECT * FROM ad_inquiries WHERE id = ? LIMIT 1', [id]);
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    _id: String(r.id),
    name: r.name,
    companyName: r.company_name,
    phone: r.phone,
    email: r.email,
    adType: r.ad_type,
    budget: r.budget,
    message: r.message,
    status: r.status,
    createdAt: r.created_at,
  };
}

async function deleteAdInquiry(id) {
  const result = await query('DELETE FROM ad_inquiries WHERE id = ?', [id]);
  return result && result.affectedRows > 0;
}

// ----------------- PHOTO STORY SERVICE -----------------
async function getPhotoStory() {
  const rows = await query('SELECT * FROM photo_stories ORDER BY id DESC LIMIT 1');
  if (!rows || rows.length === 0) return null;

  const r = rows[0];
  let images = [];
  try {
    images = typeof r.images === 'string' ? JSON.parse(r.images) : r.images || [];
    if (!Array.isArray(images)) images = [];
  } catch {
    images = [];
  }

  return {
    id: r.id,
    tagLabel: r.tag_label || 'PHOTO STORY',
    subtitle: r.subtitle || 'KERALA IN FRAMES',
    title: r.title || '',
    description: r.description || '',
    images,
    updatedAt: r.updated_at,
  };
}

async function updatePhotoStory({ tagLabel, subtitle, title, description, images }) {
  const imgJson = JSON.stringify(Array.isArray(images) ? images : []);
  const story = {
    tagLabel: tagLabel || 'PHOTO STORY',
    subtitle: subtitle || 'KERALA IN FRAMES',
    title: (title || '').trim(),
    description: (description || '').trim(),
    images: Array.isArray(images) ? images : [],
    updatedAt: new Date().toISOString(),
  };

  const rows = await query('SELECT id FROM photo_stories ORDER BY id DESC LIMIT 1');
  if (!rows || rows.length === 0) {
    const res = await query(
      'INSERT INTO photo_stories (tag_label, subtitle, title, description, images) VALUES (?, ?, ?, ?, ?)',
      [story.tagLabel, story.subtitle, story.title, story.description, imgJson]
    );
    story.id = res.insertId;
  } else {
    await query(
      'UPDATE photo_stories SET tag_label = ?, subtitle = ?, title = ?, description = ?, images = ? WHERE id = ?',
      [story.tagLabel, story.subtitle, story.title, story.description, imgJson, rows[0].id]
    );
    story.id = rows[0].id;
  }

  return story;
}

async function deletePhotoStory() {
  try {
    await query('DELETE FROM photo_stories');
    return true;
  } catch (err) {
    console.error('Delete photo story error:', err.message);
    return false;
  }
}

module.exports = {
  // Auth
  getUserByEmail,
  getUserById,
  createUser,
  // Articles
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  likeArticle,
  setHeadline,
  // Breaking
  getBreakingNews,
  getAllBreakingNews,
  createBreakingNews,
  updateBreakingNews,
  deleteBreakingNews,
  // Videos
  getVideos,
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
  // Subscribers
  getSubscribers,
  createSubscriber,
  deleteSubscriber,
  // Ads
  getAdInquiries,
  createAdInquiry,
  updateAdInquiryStatus,
  deleteAdInquiry,
  // Photo Story
  getPhotoStory,
  updatePhotoStory,
  deletePhotoStory,
};
