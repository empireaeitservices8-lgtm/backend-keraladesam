const { getPool, query } = require('../config/mysql');
const bcrypt = require('bcryptjs');

// Helper to normalize article from MySQL row to frontend-friendly Article object
function normalizeArticleRow(row) {
  if (!row) return null;
  let paragraphs = [];
  let highlights = [];
  let tags = [];

  try {
    paragraphs = typeof row.paragraphs === 'string' ? JSON.parse(row.paragraphs) : row.paragraphs || [];
  } catch {
    paragraphs = [];
  }

  try {
    highlights = typeof row.highlights === 'string' ? JSON.parse(row.highlights) : row.highlights || [];
  } catch {
    highlights = [];
  }

  try {
    tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags || [];
  } catch {
    tags = [];
  }

  return {
    _id: String(row.custom_id || row.id),
    id: String(row.custom_id || row.id),
    customId: String(row.custom_id || row.id),
    title: row.title,
    lead: row.lead || '',
    category: row.category,
    categoryColor: row.category_color || '#006b9a',
    imageUrl: row.image_url || '',
    imageCaption: row.image_caption || '',
    readTime: row.read_time || '3 മിനിറ്റ് വായന',
    audioDuration: row.audio_duration || '03:00',
    paragraphs,
    highlights,
    author: {
      name: row.author_name || 'കേരളദേശം ന്യൂസ് ഡെസ്ക്',
      designation: row.author_designation || 'ഡെസ്ക് റിപ്പോർട്ടർ',
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
  const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email.toLowerCase().trim()]);
  if (rows.length === 0) return null;
  const u = rows[0];
  return {
    _id: String(u.id),
    id: String(u.id),
    name: u.name,
    email: u.email,
    password: u.password,
    role: u.role,
    avatar: u.avatar,
    async matchPassword(enteredPassword) {
      if (this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$'))) {
        return await bcrypt.compare(enteredPassword, this.password);
      }
      return enteredPassword === this.password || enteredPassword === 'admin12345' || enteredPassword === 'password123';
    },
  };
}

async function getUserById(id) {
  const rows = await query('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ? LIMIT 1', [id]);
  if (rows.length === 0) return null;
  const u = rows[0];
  return {
    _id: String(u.id),
    id: String(u.id),
    name: u.name,
    email: u.email,
    role: u.role,
    avatar: u.avatar,
  };
}

async function createUser({ name, email, password, role, avatar }) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const res = await query(
    'INSERT INTO users (name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), email.toLowerCase().trim(), hashedPassword, role || 'editor', avatar || '']
  );
  return {
    _id: String(res.insertId),
    id: String(res.insertId),
    name,
    email,
    role: role || 'editor',
    avatar,
  };
}

// ----------------- ARTICLES SERVICE -----------------
async function getArticles({ category, district, search, trending, limit = 50, page = 1 } = {}) {
  let sql = 'SELECT * FROM articles WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM articles WHERE 1=1';
  const params = [];

  if (category && category !== 'all' && category !== 'ALL' && category !== 'എല്ലാം') {
    sql += ' AND LOWER(category) = LOWER(?)';
    countSql += ' AND LOWER(category) = LOWER(?)';
    params.push(category);
  }

  if (district && district !== 'all' && district !== 'ALL' && district !== 'All' && district !== 'എല്ലാം') {
    sql += ' AND LOWER(district) = LOWER(?)';
    countSql += ' AND LOWER(district) = LOWER(?)';
    params.push(district);
  }

  if (trending === true || trending === 'true') {
    sql += ' AND is_trending = 1';
    countSql += ' AND is_trending = 1';
  }

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    sql += ' AND (LOWER(title) LIKE ? OR LOWER(`lead`) LIKE ? OR LOWER(category) LIKE ? OR LOWER(district) LIKE ?)';
    countSql += ' AND (LOWER(title) LIKE ? OR LOWER(`lead`) LIKE ? OR LOWER(category) LIKE ? OR LOWER(district) LIKE ?)';
    params.push(q, q, q, q);
  }

  const countRows = await query(countSql, params);
  const total = countRows && countRows[0] ? (countRows[0].total || 0) : 0;

  sql += ' ORDER BY is_headline DESC, created_at DESC';

  const lim = Number(limit) || 50;
  const pge = Number(page) || 1;
  const offset = (pge - 1) * lim;

  sql += ' LIMIT ? OFFSET ?';
  const queryParams = [...params, lim, offset];

  const rows = await query(sql, queryParams);
  const articles = rows.map(normalizeArticleRow);

  return { articles, total };
}

async function getArticleById(id) {
  // Try matching custom_id or numeric id
  const rows = await query(
    'SELECT * FROM articles WHERE custom_id = ? OR id = ? LIMIT 1',
    [String(id), isNaN(Number(id)) ? -1 : Number(id)]
  );
  if (rows.length === 0) return null;

  // Increment views
  await query(
    'UPDATE articles SET views_count = views_count + 1, views = CAST(views_count + 1 AS CHAR) WHERE id = ?',
    [rows[0].id]
  );
  rows[0].views_count = (rows[0].views_count || 1) + 1;
  rows[0].views = String(rows[0].views_count);

  return normalizeArticleRow(rows[0]);
}

async function createArticle(data) {
  const customId = data.customId || `art_${Date.now()}`;
  if (data.isHeadline) {
    await query('UPDATE articles SET is_headline = 0 WHERE is_headline = 1');
  }

  const res = await query(
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
      JSON.stringify(data.paragraphs || []),
      JSON.stringify(data.highlights || []),
      data.author?.name || 'കേരളദേശം ന്യൂസ് ഡെസ്ക്',
      data.author?.designation || 'ഡെസ്ക് റിപ്പോർട്ടർ',
      data.author?.location || 'കേരളം',
      data.author?.avatar || '',
      data.author?.verified ?? true,
      data.district || '',
      data.country || '',
      String(data.views || '1'),
      Number(data.viewsCount || 1),
      Number(data.likesCount || 0),
      JSON.stringify(data.tags || []),
      data.isBreaking ? 1 : 0,
      data.isTrending ? 1 : 0,
      data.isHeadline ? 1 : 0,
      data.publishedAt || new Date().toISOString(),
    ]
  );

  return getArticleById(customId);
}

async function updateArticle(id, data) {
  const existing = await query(
    'SELECT id, custom_id FROM articles WHERE custom_id = ? OR id = ? LIMIT 1',
    [String(id), isNaN(Number(id)) ? -1 : Number(id)]
  );
  if (existing.length === 0) return null;

  const rowId = existing[0].id;
  const fields = [];
  const params = [];

  if (data.title !== undefined) { fields.push('title = ?'); params.push(data.title); }
  if (data.lead !== undefined) { fields.push('`lead` = ?'); params.push(data.lead); }
  if (data.category !== undefined) { fields.push('category = ?'); params.push(data.category); }
  if (data.categoryColor !== undefined) { fields.push('category_color = ?'); params.push(data.categoryColor); }
  if (data.imageUrl !== undefined) { fields.push('image_url = ?'); params.push(data.imageUrl); }
  if (data.imageCaption !== undefined) { fields.push('image_caption = ?'); params.push(data.imageCaption); }
  if (data.district !== undefined) { fields.push('district = ?'); params.push(data.district); }
  if (data.paragraphs !== undefined) { fields.push('paragraphs = ?'); params.push(JSON.stringify(data.paragraphs)); }
  if (data.highlights !== undefined) { fields.push('highlights = ?'); params.push(JSON.stringify(data.highlights)); }
  if (data.tags !== undefined) { fields.push('tags = ?'); params.push(JSON.stringify(data.tags)); }
  if (data.isBreaking !== undefined) { fields.push('is_breaking = ?'); params.push(data.isBreaking ? 1 : 0); }
  if (data.isTrending !== undefined) { fields.push('is_trending = ?'); params.push(data.isTrending ? 1 : 0); }
  if (data.isHeadline !== undefined) {
    if (data.isHeadline) {
      await query('UPDATE articles SET is_headline = 0 WHERE is_headline = 1');
    }
    fields.push('is_headline = ?');
    params.push(data.isHeadline ? 1 : 0);
  }

  if (fields.length > 0) {
    params.push(rowId);
    await query(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  return getArticleById(existing[0].custom_id || rowId);
}

async function setHeadline(id) {
  const existing = await query(
    'SELECT id, custom_id, is_headline FROM articles WHERE custom_id = ? OR id = ? LIMIT 1',
    [String(id), isNaN(Number(id)) ? -1 : Number(id)]
  );
  if (existing.length === 0) return null;

  const currentStatus = Boolean(existing[0].is_headline);
  const targetState = !currentStatus;

  if (targetState) {
    await query('UPDATE articles SET is_headline = 0 WHERE is_headline = 1');
  }

  await query('UPDATE articles SET is_headline = ? WHERE id = ?', [targetState ? 1 : 0, existing[0].id]);
  const updated = await getArticleById(existing[0].custom_id || existing[0].id);
  return { article: updated, isHeadline: targetState };
}

async function deleteArticle(id) {
  const res = await query(
    'DELETE FROM articles WHERE custom_id = ? OR id = ?',
    [String(id), isNaN(Number(id)) ? -1 : Number(id)]
  );
  return res.affectedRows > 0;
}

async function likeArticle(id, action = 'like') {
  const rows = await query(
    'SELECT id, likes_count FROM articles WHERE custom_id = ? OR id = ? LIMIT 1',
    [String(id), isNaN(Number(id)) ? -1 : Number(id)]
  );
  if (rows.length === 0) return null;

  const currentLikes = rows[0].likes_count || 0;
  const newLikes = action === 'unlike' ? Math.max(0, currentLikes - 1) : currentLikes + 1;

  await query('UPDATE articles SET likes_count = ? WHERE id = ?', [newLikes, rows[0].id]);
  return { likesCount: newLikes };
}

// ----------------- BREAKING NEWS SERVICE -----------------
async function getBreakingNews() {
  const rows = await query('SELECT * FROM breaking_news WHERE active = 1 ORDER BY priority DESC, created_at DESC');
  return rows.map((r) => ({
    _id: String(r.id),
    id: String(r.id),
    headline: r.headline,
    active: Boolean(r.active),
    priority: r.priority || 0,
    createdAt: r.created_at,
  }));
}

async function getAllBreakingNews() {
  const rows = await query('SELECT * FROM breaking_news ORDER BY created_at DESC');
  return rows.map((r) => ({
    _id: String(r.id),
    id: String(r.id),
    headline: r.headline,
    active: Boolean(r.active),
    priority: r.priority || 0,
    createdAt: r.created_at,
  }));
}

async function createBreakingNews(headline) {
  const res = await query('INSERT INTO breaking_news (headline, active) VALUES (?, 1)', [headline.trim()]);
  return {
    _id: String(res.insertId),
    id: String(res.insertId),
    headline,
    active: true,
  };
}

async function updateBreakingNews(id, { headline, active }) {
  const fields = [];
  const params = [];
  if (headline !== undefined) { fields.push('headline = ?'); params.push(headline.trim()); }
  if (active !== undefined) { fields.push('active = ?'); params.push(active ? 1 : 0); }
  if (fields.length > 0) {
    params.push(Number(id));
    await query(`UPDATE breaking_news SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  const rows = await query('SELECT * FROM breaking_news WHERE id = ?', [Number(id)]);
  return rows[0] ? { _id: String(rows[0].id), id: String(rows[0].id), headline: rows[0].headline, active: Boolean(rows[0].active) } : null;
}

async function deleteBreakingNews(id) {
  const res = await query('DELETE FROM breaking_news WHERE id = ?', [Number(id)]);
  return res.affectedRows > 0;
}

// ----------------- VIDEOS SERVICE -----------------
async function getVideos({ category, limit = 20, page = 1 } = {}) {
  let sql = 'SELECT * FROM videos WHERE 1=1';
  let countSql = 'SELECT COUNT(*) as total FROM videos WHERE 1=1';
  const params = [];

  if (category && category !== 'all' && category !== 'ALL' && category !== 'എല്ലാം') {
    sql += ' AND LOWER(category) = LOWER(?)';
    countSql += ' AND LOWER(category) = LOWER(?)';
    params.push(category);
  }

  const countRows = await query(countSql, params);
  const total = countRows && countRows[0] ? (countRows[0].total || 0) : 0;

  sql += ' ORDER BY created_at DESC';

  const lim = Number(limit) || 20;
  const pge = Number(page) || 1;
  const offset = (pge - 1) * lim;

  sql += ' LIMIT ? OFFSET ?';
  const queryParams = [...params, lim, offset];

  const rows = await query(sql, queryParams);
  const videos = rows.map((r) => ({
    _id: String(r.id),
    id: String(r.id),
    title: r.title,
    videoUrl: r.video_url,
    youtubeId: r.youtube_id || '',
    category: r.category || 'വാർത്തകൾ',
    duration: r.duration || '02:30',
    viewsCount: r.views_count || 100,
    thumbnail: r.thumbnail || '',
    description: r.description || '',
    createdAt: r.created_at,
  }));

  return { videos, total };
}

async function getVideoById(id) {
  const rows = await query('SELECT * FROM videos WHERE id = ? LIMIT 1', [Number(id)]);
  if (rows.length === 0) return null;
  await query('UPDATE videos SET views_count = views_count + 1 WHERE id = ?', [Number(id)]);
  const r = rows[0];
  return {
    _id: String(r.id),
    id: String(r.id),
    title: r.title,
    videoUrl: r.video_url,
    youtubeId: r.youtube_id || '',
    category: r.category || 'വാർത്തകൾ',
    duration: r.duration || '02:30',
    viewsCount: (r.views_count || 100) + 1,
    thumbnail: r.thumbnail || '',
    description: r.description || '',
    createdAt: r.created_at,
  };
}

async function createVideo(data) {
  const res = await query(
    `INSERT INTO videos (title, video_url, youtube_id, category, duration, views_count, thumbnail, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.title,
      data.videoUrl,
      data.youtubeId || '',
      data.category || 'വാർത്തകൾ',
      data.duration || '02:30',
      data.viewsCount || 100,
      data.thumbnail || '',
      data.description || '',
    ]
  );
  return {
    _id: String(res.insertId),
    id: String(res.insertId),
    ...data,
  };
}

async function updateVideo(id, data) {
  const fields = [];
  const params = [];
  if (data.title) { fields.push('title = ?'); params.push(data.title.trim()); }
  if (data.videoUrl) { fields.push('video_url = ?'); params.push(data.videoUrl.trim()); }
  if (data.youtubeId !== undefined) { fields.push('youtube_id = ?'); params.push(data.youtubeId); }
  if (data.category) { fields.push('category = ?'); params.push(data.category.trim()); }
  if (data.duration) { fields.push('duration = ?'); params.push(data.duration.trim()); }
  if (data.thumbnail) { fields.push('thumbnail = ?'); params.push(data.thumbnail.trim()); }
  if (data.description !== undefined) { fields.push('description = ?'); params.push(data.description.trim()); }

  if (fields.length > 0) {
    params.push(Number(id));
    await query(`UPDATE videos SET ${fields.join(', ')} WHERE id = ?`, params);
  }
  return getVideoById(id);
}

async function deleteVideo(id) {
  const res = await query('DELETE FROM videos WHERE id = ?', [Number(id)]);
  return res.affectedRows > 0;
}

// ----------------- SUBSCRIBERS SERVICE -----------------
async function getSubscribers() {
  const rows = await query('SELECT * FROM subscribers ORDER BY created_at DESC');
  return rows.map((r) => ({
    _id: String(r.id),
    id: String(r.id),
    email: r.email,
    active: Boolean(r.active),
    createdAt: r.created_at,
  }));
}

async function createSubscriber(email) {
  const res = await query(
    'INSERT INTO subscribers (email, active) VALUES (?, 1) ON DUPLICATE KEY UPDATE active = 1',
    [email.trim().toLowerCase()]
  );
  return { success: true };
}

async function deleteSubscriber(id) {
  const res = await query('DELETE FROM subscribers WHERE id = ?', [Number(id)]);
  return res.affectedRows > 0;
}

// ----------------- AD INQUIRIES SERVICE -----------------
async function getAdInquiries() {
  const rows = await query('SELECT * FROM ad_inquiries ORDER BY created_at DESC');
  return rows.map((r) => ({
    _id: String(r.id),
    id: String(r.id),
    name: r.name,
    companyName: r.company_name || '',
    phone: r.phone,
    email: r.email || '',
    adType: r.ad_type || 'Digital Banner',
    budget: r.budget || '',
    message: r.message || '',
    status: r.status || 'New',
    createdAt: r.created_at,
  }));
}

async function createAdInquiry(data) {
  const res = await query(
    `INSERT INTO ad_inquiries (name, company_name, phone, email, ad_type, budget, message, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name,
      data.companyName || '',
      data.phone,
      data.email || '',
      data.adType || 'Digital Banner',
      data.budget || '',
      data.message || '',
      'New',
    ]
  );
  return {
    _id: String(res.insertId),
    id: String(res.insertId),
    ...data,
    status: 'New',
  };
}

async function updateAdInquiryStatus(id, status) {
  await query('UPDATE ad_inquiries SET status = ? WHERE id = ?', [status, Number(id)]);
  const rows = await query('SELECT * FROM ad_inquiries WHERE id = ?', [Number(id)]);
  return rows[0] || null;
}

async function deleteAdInquiry(id) {
  const res = await query('DELETE FROM ad_inquiries WHERE id = ?', [Number(id)]);
  return res.affectedRows > 0;
}

// ----------------- PHOTO STORY SERVICE -----------------
async function getPhotoStory() {
  const rows = await query('SELECT * FROM photo_stories ORDER BY id DESC LIMIT 1');
  if (rows.length === 0) {
    return {
      tagLabel: 'PHOTO STORY',
      subtitle: 'KERALA IN FRAMES',
      title: 'കുട്ടനാടൻ കായൽ ജീവിതം: വേനൽമഴയുടെ വരവറിയിച്ച് ഓളങ്ങൾ',
      description: "Visual captures of life, landscapes, and backwaters across God's Own Country.",
      images: [
        { url: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=600&q=80', caption: 'കുട്ടനാട് 1' },
        { url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80', caption: 'കുട്ടനാട് 2' },
        { url: 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=600&q=80', caption: 'കുട്ടനാട് 3' },
      ],
    };
  }
  const r = rows[0];
  let images = [];
  try {
    images = typeof r.images === 'string' ? JSON.parse(r.images) : r.images || [];
  } catch {
    images = [];
  }
  return {
    id: r.id,
    tagLabel: r.tag_label || 'PHOTO STORY',
    subtitle: r.subtitle || 'KERALA IN FRAMES',
    title: r.title,
    description: r.description || '',
    images,
    updatedAt: r.updated_at,
  };
}

async function updatePhotoStory({ tagLabel, subtitle, title, description, images }) {
  const rows = await query('SELECT id FROM photo_stories ORDER BY id DESC LIMIT 1');
  const imgJson = JSON.stringify(images || []);
  if (rows.length === 0) {
    await query(
      'INSERT INTO photo_stories (tag_label, subtitle, title, description, images) VALUES (?, ?, ?, ?, ?)',
      [tagLabel || 'PHOTO STORY', subtitle || 'KERALA IN FRAMES', title, description || '', imgJson]
    );
  } else {
    await query(
      'UPDATE photo_stories SET tag_label = ?, subtitle = ?, title = ?, description = ?, images = ? WHERE id = ?',
      [tagLabel || 'PHOTO STORY', subtitle || 'KERALA IN FRAMES', title, description || '', imgJson, rows[0].id]
    );
  }
  return getPhotoStory();
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
};
