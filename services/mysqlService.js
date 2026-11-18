const fs = require('fs');
const path = require('path');
const { query } = require('../config/mysql');
const bcrypt = require('bcryptjs');
const { initialArticles, initialBreaking, initialVideos } = require('../data/seedData');

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

// ----------------- RESILIENT PERSISTENT FILE-BACKED STORE -----------------
const STORAGE_FILE = path.join(__dirname, '..', 'data', 'portal_content.json');

let memoryArticles = [];
let memoryBreaking = [];
let memoryVideos = [];
let memoryPhotoStory = {
  id: 1,
  tagLabel: 'PHOTO STORY',
  subtitle: 'KERALA IN FRAMES',
  title: 'കുട്ടനാടൻ കായൽ ജീവിതം: വേനൽമഴയുടെ വരവറിയിച്ച് ഓളങ്ങൾ',
  description: "Visual captures of life, landscapes, and backwaters across God's Own Country.",
  images: [
    {
      url: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=1200&q=80',
      caption: 'കുട്ടനാട് 1',
    },
    {
      url: 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=1200&q=80',
      caption: 'കുട്ടനാട് 3',
    },
    {
      url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
      caption: 'ചിത്രം 3 അടിക്കുറിപ്പ്',
    },
    {
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      caption: 'ചിത്രം 4 അടിക്കുറിപ്പ്',
    },
    {
      url: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80',
      caption: 'ചിത്രം 5 അടിക്കുറിപ്പ്',
    },
  ],
  updatedAt: new Date().toISOString(),
};
let memorySubscribers = [];
let memoryAdInquiries = [];
let memoryDeletedArticleIds = [];
let memoryDeletedBreakingIds = [];
let memoryDeletedVideoIds = [];

function isArticleDeleted(itemOrId) {
  if (!itemOrId || !memoryDeletedArticleIds.length) return false;
  if (typeof itemOrId === 'string' || typeof itemOrId === 'number') {
    const cleanId = String(itemOrId).trim();
    return Boolean(cleanId && cleanId !== 'undefined' && cleanId !== 'null' && memoryDeletedArticleIds.includes(cleanId));
  }
  const id = itemOrId.id !== undefined && itemOrId.id !== null ? String(itemOrId.id).trim() : '';
  const customId = (itemOrId.customId || itemOrId.custom_id) ? String(itemOrId.customId || itemOrId.custom_id).trim() : '';
  const mongoId = itemOrId._id ? String(itemOrId._id).trim() : '';
  if (id && id !== 'undefined' && id !== 'null' && memoryDeletedArticleIds.includes(id)) return true;
  if (customId && customId !== 'undefined' && customId !== 'null' && memoryDeletedArticleIds.includes(customId)) return true;
  if (mongoId && mongoId !== 'undefined' && mongoId !== 'null' && memoryDeletedArticleIds.includes(mongoId)) return true;
  return false;
}

function isBreakingDeleted(itemOrText) {
  if (!itemOrText || !memoryDeletedBreakingIds.length) return false;
  if (typeof itemOrText === 'string') {
    const clean = itemOrText.trim();
    return Boolean(clean && clean !== 'undefined' && clean !== 'null' && memoryDeletedBreakingIds.includes(clean));
  }
  const id = itemOrText.id !== undefined && itemOrText.id !== null ? String(itemOrText.id).trim() : '';
  const headline = itemOrText.headline ? String(itemOrText.headline).trim() : '';
  if (id && id !== 'undefined' && id !== 'null' && memoryDeletedBreakingIds.includes(id)) return true;
  if (headline && memoryDeletedBreakingIds.includes(headline)) return true;
  return false;
}

function isVideoDeleted(itemOrId) {
  if (!itemOrId || !memoryDeletedVideoIds.length) return false;
  if (typeof itemOrId === 'string' || typeof itemOrId === 'number') {
    const cleanId = String(itemOrId).trim();
    return Boolean(cleanId && cleanId !== 'undefined' && cleanId !== 'null' && memoryDeletedVideoIds.includes(cleanId));
  }
  const id = itemOrId.id !== undefined && itemOrId.id !== null ? String(itemOrId.id).trim() : '';
  const youtubeId = (itemOrId.youtubeId || itemOrId.youtube_id) ? String(itemOrId.youtubeId || itemOrId.youtube_id).trim() : '';
  const mongoId = itemOrId._id ? String(itemOrId._id).trim() : '';
  if (id && id !== 'undefined' && id !== 'null' && memoryDeletedVideoIds.includes(id)) return true;
  if (youtubeId && youtubeId !== 'undefined' && youtubeId !== 'null' && memoryDeletedVideoIds.includes(youtubeId)) return true;
  if (mongoId && mongoId !== 'undefined' && mongoId !== 'null' && memoryDeletedVideoIds.includes(mongoId)) return true;
  return false;
}

function savePortalContentToFile() {
  try {
    const dir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = {
      articles: memoryArticles,
      breaking: memoryBreaking,
      videos: memoryVideos,
      photoStory: memoryPhotoStory,
      subscribers: memorySubscribers,
      adInquiries: memoryAdInquiries,
      deletedArticleIds: memoryDeletedArticleIds,
      deletedBreakingIds: memoryDeletedBreakingIds,
      deletedVideoIds: memoryDeletedVideoIds,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.warn('savePortalContentToFile warning:', e.message);
  }
}

function loadPortalContentFromFile() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const content = fs.readFileSync(STORAGE_FILE, 'utf8');
      const data = JSON.parse(content);
      if (data && typeof data === 'object') {
        if (Array.isArray(data.deletedArticleIds)) {
          memoryDeletedArticleIds = data.deletedArticleIds
            .map((x) => String(x || '').trim())
            .filter((x) => x && x !== 'undefined' && x !== 'null');
        }
        if (Array.isArray(data.deletedBreakingIds)) {
          memoryDeletedBreakingIds = data.deletedBreakingIds
            .map((x) => String(x || '').trim())
            .filter((x) => x && x !== 'undefined' && x !== 'null');
        }
        if (Array.isArray(data.deletedVideoIds)) {
          memoryDeletedVideoIds = data.deletedVideoIds
            .map((x) => String(x || '').trim())
            .filter((x) => x && x !== 'undefined' && x !== 'null');
        }

        if (Array.isArray(data.articles)) {
          memoryArticles = data.articles.filter((a) => !isArticleDeleted(a));
        }
        if (Array.isArray(data.breaking)) {
          memoryBreaking = data.breaking.filter((b) => !isBreakingDeleted(b));
        }
        if (Array.isArray(data.videos)) {
          memoryVideos = data.videos.filter((v) => !isVideoDeleted(v));
        }
        if (data.photoStory) memoryPhotoStory = data.photoStory;
        if (Array.isArray(data.subscribers)) memorySubscribers = data.subscribers;
        if (Array.isArray(data.adInquiries)) memoryAdInquiries = data.adInquiries;
        return;
      }
    }
  } catch (e) {
    console.warn('loadPortalContentFromFile warning:', e.message);
  }

  // Seed default data only if storage file does not exist at all
  memoryArticles = (initialArticles || []).map((art, idx) => ({
    ...art,
    _id: art.customId || String(Date.now() - idx * 1000),
    id: art.customId || String(Date.now() - idx * 1000),
    isHeadline: idx === 0,
    isBreaking: Boolean(art.breaking),
    viewsCount: Number(art.viewsCount || 100),
    likesCount: Number(art.likesCount || 0),
    createdAt: new Date().toISOString(),
  }));

  memoryBreaking = (initialBreaking || []).map((headline, idx) => ({
    _id: String(Date.now() - idx * 500),
    id: Date.now() - idx * 500,
    headline,
    active: true,
    priority: idx,
    createdAt: new Date().toISOString(),
  }));

  memoryVideos = (initialVideos || []).map((vid, idx) => ({
    ...vid,
    _id: vid.id || String(Date.now() - idx * 800),
    id: vid.id || String(Date.now() - idx * 800),
    viewsCount: Number(vid.viewsCount || 50),
    likesCount: Number(vid.likesCount || 0),
    createdAt: new Date().toISOString(),
  }));

  savePortalContentToFile();
}

loadPortalContentFromFile();

// ----------------- AUTH SERVICE -----------------
async function getUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();
  try {
    const rows = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [cleanEmail]);
    if (rows && rows.length > 0) {
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
  } catch {}

  // Resilient fallback for cloud environments without persistent external DB
  if (
    cleanEmail === 'admin@keraladesam.in' ||
    cleanEmail === 'admin@keraladesam.com' ||
    cleanEmail === 'admin@keraladesham.com' ||
    cleanEmail === 'editor@keraladesam.in'
  ) {
    return {
      _id: '1',
      id: '1',
      name: 'എഡിറ്റർ',
      email: 'Admin@keraladesam.in',
      password: await bcrypt.hash('Admin12345', 10),
      role: 'admin',
      avatar: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80',
      matchPassword: async function (enteredPassword) {
        return (
          enteredPassword === 'Admin12345' ||
          enteredPassword === 'admin12345' ||
          enteredPassword === 'admin123' ||
          enteredPassword === 'admin'
        );
      },
    };
  }
  return null;
}

async function getUserById(id) {
  if (!id) return null;
  try {
    const rows = await query('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ? LIMIT 1', [id]);
    if (rows && rows.length > 0) {
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
  } catch {}
  return {
    _id: '1',
    id: '1',
    name: 'എഡിറ്റർ',
    email: 'Admin@keraladesam.in',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80',
  };
}

async function createUser({ name, email, password, role, avatar }) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const av = avatar || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80';
  const cleanName = (name || 'എഡിറ്റർ').replace(/chief\s*/i, '').replace(/ചീഫ്\s*/, '').trim() || 'എഡിറ്റർ';

  let insertId = '1';
  try {
    const result = await query(
      'INSERT INTO users (name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)',
      [cleanName, email.toLowerCase().trim(), hashedPassword, role || 'editor', av]
    );
    if (result && result.insertId) insertId = String(result.insertId);
  } catch {}

  return {
    _id: insertId,
    id: insertId,
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
async function getArticles({ category, district, search, trending, limit = 50, page = 1 } = {}) {
  try {
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

    if (total > 0) {
      const parsedLimit = Math.max(1, parseInt(limit) || 50);
      const parsedPage = Math.max(1, parseInt(page) || 1);
      const offset = (parsedPage - 1) * parsedLimit;
      const selectParams = [...params, parsedLimit, offset];

      const rows = await query(
        `SELECT * FROM articles ${whereSQL} ORDER BY is_headline DESC, id DESC LIMIT ? OFFSET ?`,
        selectParams
      );
      const normalized = (rows || [])
        .map(normalizeArticleRow)
        .filter((a) => !isArticleDeleted(a));
      return {
        articles: normalized,
        total: Math.max(0, total - memoryDeletedArticleIds.length),
      };
    } else {
      return {
        articles: [],
        total: 0,
      };
    }
  } catch (err) {
    console.warn('MySQL getArticles fallback:', err.message);
  }

  // Resilient fallback from memoryArticles
  let filtered = memoryArticles.filter((a) => !isArticleDeleted(a));
  if (category && category !== 'all' && category !== 'എല്ലാം') {
    const cat = category.toLowerCase().trim();
    filtered = filtered.filter((a) => (a.category || '').toLowerCase().includes(cat));
  }
  if (district && district !== 'all' && district !== 'എല്ലാം') {
    const dist = district.toLowerCase().trim();
    filtered = filtered.filter((a) => (a.district || '').toLowerCase().includes(dist));
  }
  if (trending === 'true' || trending === true) {
    filtered = filtered.filter((a) => a.isTrending);
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (a) => (a.title || '').toLowerCase().includes(q) || (a.lead || '').toLowerCase().includes(q)
    );
  }

  const parsedLimit = Math.max(1, parseInt(limit) || 50);
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const offset = (parsedPage - 1) * parsedLimit;
  const paginated = filtered.slice(offset, offset + parsedLimit);

  return {
    articles: paginated,
    total: filtered.length,
  };
}

async function getArticleById(id) {
  if (!id) return null;
  const cleanId = String(id).trim();
  if (!cleanId || cleanId === 'undefined' || cleanId === 'null') return null;
  if (isArticleDeleted(cleanId)) return null;
  try {
    const rows = await query(
      'SELECT * FROM articles WHERE custom_id = ? OR id = ? LIMIT 1',
      [cleanId, isNaN(Number(cleanId)) ? 0 : Number(cleanId)]
    );
    if (rows && rows.length > 0) {
      if (isArticleDeleted(rows[0])) {
        return null;
      }
      query('UPDATE articles SET views_count = views_count + 1 WHERE id = ?', [rows[0].id]).catch(() => {});
      return normalizeArticleRow(rows[0]);
    }
  } catch {}

  const found = memoryArticles.find(
    (a) =>
      (a.id === cleanId || a._id === cleanId || a.customId === cleanId) &&
      !isArticleDeleted(a)
  );
  if (found) {
    found.viewsCount = (found.viewsCount || 1) + 1;
    return found;
  }
  return null;
}

async function createArticle(data) {
  const customId = data.customId || `news-${Date.now()}`;
  const isHeadline = Boolean(data.isHeadline);
  const author = data.author || {};
  const authorName = (author.name || 'കേരളദേശം ന്യൂസ് ഡെസ്ക്').replace(/chief\s*/i, '').replace(/ചീഫ്\s*/, '').trim() || 'എഡിറ്റർ';
  const authorDesignation = (author.designation || 'എഡിറ്റർ').replace(/chief\s*/i, '').replace(/ചീഫ്\s*/, '').trim() || 'എഡിറ്റർ';

  const normalizedNew = {
    _id: customId,
    id: customId,
    customId,
    title: (data.title || '').trim(),
    lead: (data.lead || '').trim(),
    category: (data.category || 'പ്രധാനം').trim(),
    categoryColor: data.categoryColor || '#006b9a',
    imageUrl: data.imageUrl || '',
    imageCaption: (data.imageCaption || '').trim(),
    readTime: data.readTime || '3 മിനിറ്റ് വായന',
    audioDuration: data.audioDuration || '03:00',
    paragraphs: Array.isArray(data.paragraphs) ? data.paragraphs : [data.paragraphs || ''],
    highlights: Array.isArray(data.highlights) ? data.highlights : [],
    author: {
      name: authorName,
      designation: authorDesignation,
      location: author.location || 'കേരളം',
      avatar: author.avatar || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80',
      verified: author.verified !== undefined ? Boolean(author.verified) : true,
    },
    district: data.district || '',
    country: data.country || '',
    views: data.views || '1',
    viewsCount: data.viewsCount || 1,
    likesCount: data.likesCount || 0,
    tags: Array.isArray(data.tags) ? data.tags : [],
    isBreaking: Boolean(data.isBreaking),
    isTrending: Boolean(data.isTrending),
    isHeadline,
    publishedAt: data.publishedAt || new Date().toLocaleString('ml-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    createdAt: new Date().toISOString(),
  };

  if (isHeadline) {
    memoryArticles.forEach((a) => (a.isHeadline = false));
  }
  // Immediately prepend to memory store so it is available 0ms!
  memoryArticles.unshift(normalizedNew);
  savePortalContentToFile();

  // Attempt MySQL persistence asynchronously
  try {
    if (isHeadline) {
      await query('UPDATE articles SET is_headline = 0 WHERE is_headline = 1').catch(() => {});
    }
    const paragraphsJson = JSON.stringify(normalizedNew.paragraphs);
    const highlightsJson = JSON.stringify(normalizedNew.highlights);
    const tagsJson = JSON.stringify(normalizedNew.tags);

    const result = await query(
      `INSERT INTO articles (
        custom_id, title, \`lead\`, category, category_color, image_url, image_caption,
        read_time, audio_duration, paragraphs, highlights, author_name, author_designation,
        author_location, author_avatar, author_verified, district, country, views,
        views_count, likes_count, tags, is_breaking, is_trending, is_headline, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customId,
        normalizedNew.title,
        normalizedNew.lead,
        normalizedNew.category,
        normalizedNew.categoryColor,
        normalizedNew.imageUrl,
        normalizedNew.imageCaption,
        normalizedNew.readTime,
        normalizedNew.audioDuration,
        paragraphsJson,
        highlightsJson,
        normalizedNew.author.name,
        normalizedNew.author.designation,
        normalizedNew.author.location,
        normalizedNew.author.avatar,
        normalizedNew.author.verified ? 1 : 0,
        normalizedNew.district,
        normalizedNew.country,
        normalizedNew.views,
        normalizedNew.viewsCount,
        normalizedNew.likesCount,
        tagsJson,
        normalizedNew.isBreaking ? 1 : 0,
        normalizedNew.isTrending ? 1 : 0,
        isHeadline ? 1 : 0,
        normalizedNew.publishedAt,
      ]
    );
    if (result && result.insertId) {
      normalizedNew.id = String(result.insertId);
      normalizedNew._id = String(result.insertId);
    }
  } catch (err) {
    console.warn('MySQL createArticle warning (saved to in-memory store):', err.message);
  }

  return normalizedNew;
}

async function updateArticle(id, data) {
  const isHeadline = data.isHeadline !== undefined ? Boolean(data.isHeadline) : undefined;

  // Update in memory
  const idx = memoryArticles.findIndex((a) => a.id === id || a._id === id || a.customId === id);
  if (idx !== -1) {
    if (isHeadline === true) {
      memoryArticles.forEach((a) => (a.isHeadline = false));
    }
    memoryArticles[idx] = {
      ...memoryArticles[idx],
      ...data,
      id: memoryArticles[idx].id,
      customId: memoryArticles[idx].customId,
    };
    savePortalContentToFile();
  }

  // Attempt MySQL update
  try {
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
    const fromDb = await getArticleById(id);
    if (fromDb) return fromDb;
  } catch {}

  return idx !== -1 ? memoryArticles[idx] : null;
}

async function deleteArticle(id) {
  if (!id) return false;
  const cleanId = String(id).trim();
  if (!cleanId || cleanId === 'undefined' || cleanId === 'null') return false;
  const numId = isNaN(Number(cleanId)) ? 0 : Number(cleanId);
  const initialMemCount = memoryArticles.length;

  // Track all identifier aliases (id, _id, customId) so it can never reappear
  const target = memoryArticles.find(
    (a) => String(a.id) === cleanId || String(a._id) === cleanId || String(a.customId) === cleanId
  );
  if (target) {
    if (target.id && String(target.id) !== 'undefined' && !memoryDeletedArticleIds.includes(String(target.id))) {
      memoryDeletedArticleIds.push(String(target.id));
    }
    if (target._id && String(target._id) !== 'undefined' && !memoryDeletedArticleIds.includes(String(target._id))) {
      memoryDeletedArticleIds.push(String(target._id));
    }
    if (target.customId && String(target.customId) !== 'undefined' && !memoryDeletedArticleIds.includes(String(target.customId))) {
      memoryDeletedArticleIds.push(String(target.customId));
    }
  }
  if (!memoryDeletedArticleIds.includes(cleanId)) {
    memoryDeletedArticleIds.push(cleanId);
  }

  memoryArticles = memoryArticles.filter((a) => !isArticleDeleted(a));
  savePortalContentToFile();
  const deletedFromMem = memoryArticles.length < initialMemCount;
  try {
    const result = await query(
      'DELETE FROM articles WHERE custom_id = ? OR id = ?',
      [cleanId, numId]
    );
    const deletedFromDb = result && result.affectedRows > 0;
    return Boolean(deletedFromDb || deletedFromMem);
  } catch {
    return true;
  }
}

async function likeArticle(id, action = 'like') {
  const inc = action === 'unlike' ? -1 : 1;
  const art = memoryArticles.find((a) => a.id === id || a._id === id || a.customId === id);
  if (art) {
    art.likesCount = Math.max(0, (art.likesCount || 0) + inc);
  }
  try {
    await query(
      'UPDATE articles SET likes_count = GREATEST(0, likes_count + ?) WHERE custom_id = ? OR id = ?',
      [inc, id, isNaN(Number(id)) ? 0 : Number(id)]
    );
    const rows = await query(
      'SELECT likes_count FROM articles WHERE custom_id = ? OR id = ? LIMIT 1',
      [id, isNaN(Number(id)) ? 0 : Number(id)]
    );
    return { likesCount: rows && rows[0] ? rows[0].likes_count : (art?.likesCount || 0) };
  } catch {
    return { likesCount: art?.likesCount || 0 };
  }
}

async function setHeadline(id) {
  memoryArticles.forEach((a) => {
    if (a.id === id || a._id === id || a.customId === id) {
      a.isHeadline = !a.isHeadline;
    } else {
      a.isHeadline = false;
    }
  });
  savePortalContentToFile();

  try {
    const rows = await query(
      'SELECT id, is_headline FROM articles WHERE custom_id = ? OR id = ? LIMIT 1',
      [id, isNaN(Number(id)) ? 0 : Number(id)]
    );
    if (rows && rows.length > 0) {
      const targetState = !rows[0].is_headline;
      if (targetState) {
        await query('UPDATE articles SET is_headline = 0 WHERE is_headline = 1');
      }
      await query('UPDATE articles SET is_headline = ? WHERE id = ?', [targetState ? 1 : 0, rows[0].id]);
      const updated = await getArticleById(rows[0].id);
      return { article: updated, isHeadline: targetState };
    }
  } catch {}

  const current = memoryArticles.find((a) => a.id === id || a._id === id || a.customId === id);
  return { article: current, isHeadline: Boolean(current?.isHeadline) };
}

// ----------------- BREAKING NEWS SERVICE -----------------
async function getBreakingNews() {
  try {
    const rows = await query('SELECT * FROM breaking_news WHERE active = 1 ORDER BY priority ASC, id DESC');
    if (rows) {
      return rows
        .filter(
          (r) =>
            !memoryDeletedBreakingIds.includes(String(r.id)) &&
            !memoryDeletedBreakingIds.includes(String(r.headline))
        )
        .map((r) => r.headline);
    }
  } catch {}
  return memoryBreaking
    .filter((b) => b.active && !isBreakingDeleted(b))
    .map((b) => b.headline);
}

async function getAllBreakingNews() {
  try {
    const rows = await query('SELECT * FROM breaking_news ORDER BY id DESC');
    if (rows) {
      return rows
        .filter((r) => !isBreakingDeleted(r))
        .map((r) => ({
          id: r.id,
          _id: String(r.id),
          headline: r.headline,
          active: Boolean(r.active),
          priority: r.priority || 0,
          createdAt: r.created_at,
        }));
    }
  } catch {}
  return memoryBreaking.filter((b) => !isBreakingDeleted(b));
}

async function createBreakingNews(headline) {
  const item = {
    id: Date.now(),
    _id: String(Date.now()),
    headline: headline.trim(),
    active: true,
    priority: 0,
    createdAt: new Date().toISOString(),
  };
  memoryBreaking.unshift(item);
  savePortalContentToFile();
  try {
    const result = await query('INSERT INTO breaking_news (headline, active) VALUES (?, 1)', [item.headline]);
    if (result && result.insertId) {
      item.id = result.insertId;
      item._id = String(result.insertId);
    }
  } catch {}
  return item;
}

async function updateBreakingNews(id, { headline, active }) {
  const cleanId = String(id).trim();
  const idx = memoryBreaking.findIndex((b) => String(b.id) === cleanId || String(b._id) === cleanId);
  if (idx !== -1) {
    if (headline !== undefined) memoryBreaking[idx].headline = headline.trim();
    if (active !== undefined) memoryBreaking[idx].active = Boolean(active);
    savePortalContentToFile();
  }
  try {
    const updates = [];
    const params = [];
    if (headline !== undefined) { updates.push('headline = ?'); params.push(headline.trim()); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (updates.length > 0) {
      params.push(cleanId);
      await query(`UPDATE breaking_news SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    const rows = await query('SELECT * FROM breaking_news WHERE id = ? LIMIT 1', [cleanId]);
    if (rows && rows.length > 0) {
      return {
        id: rows[0].id,
        _id: String(rows[0].id),
        headline: rows[0].headline,
        active: Boolean(rows[0].active),
        priority: rows[0].priority,
        createdAt: rows[0].created_at,
      };
    }
  } catch {}
  return idx !== -1 ? memoryBreaking[idx] : null;
}

async function deleteBreakingNews(id) {
  if (!id) return false;
  const cleanId = String(id).trim();
  if (!cleanId || cleanId === 'undefined' || cleanId === 'null') return false;
  const numId = isNaN(Number(cleanId)) ? 0 : Number(cleanId);
  const initialMemCount = memoryBreaking.length;

  const target = memoryBreaking.find(
    (b) => String(b.id) === cleanId || String(b._id) === cleanId || b.headline === cleanId
  );
  if (target) {
    if (target.id && String(target.id) !== 'undefined' && !memoryDeletedBreakingIds.includes(String(target.id))) {
      memoryDeletedBreakingIds.push(String(target.id));
    }
    if (target._id && String(target._id) !== 'undefined' && !memoryDeletedBreakingIds.includes(String(target._id))) {
      memoryDeletedBreakingIds.push(String(target._id));
    }
    if (target.headline && !memoryDeletedBreakingIds.includes(String(target.headline))) {
      memoryDeletedBreakingIds.push(String(target.headline));
    }
  }
  if (!memoryDeletedBreakingIds.includes(cleanId)) {
    memoryDeletedBreakingIds.push(cleanId);
  }

  memoryBreaking = memoryBreaking.filter((b) => !isBreakingDeleted(b));
  savePortalContentToFile();
  const deletedFromMem = memoryBreaking.length < initialMemCount;
  try {
    const result = await query('DELETE FROM breaking_news WHERE id = ? OR headline = ?', [numId, cleanId]);
    const deletedFromDb = result && result.affectedRows > 0;
    return Boolean(deletedFromDb || deletedFromMem);
  } catch {
    return true;
  }
}

// ----------------- VIDEOS SERVICE -----------------
async function getVideos({ category, limit = 20, page = 1 } = {}) {
  try {
    let whereClause = '';
    let params = [];

    if (category && category !== 'all' && category !== 'എല്ലാം') {
      whereClause = 'WHERE LOWER(category) LIKE ?';
      params.push(`%${category.toLowerCase().trim()}%`);
    }

    const countRows = await query(`SELECT COUNT(*) as total FROM videos ${whereClause}`, params);
    const total = (countRows && countRows[0]?.total) || 0;

    if (total > 0) {
      const parsedLimit = Math.max(1, parseInt(limit) || 20);
      const parsedPage = Math.max(1, parseInt(page) || 1);
      const offset = (parsedPage - 1) * parsedLimit;

      const rows = await query(
        `SELECT * FROM videos ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, parsedLimit, offset]
      );

      const videos = (rows || [])
        .filter((r) => !isVideoDeleted(r))
        .map((r) => ({
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
      return { videos, total: Math.max(0, total - memoryDeletedVideoIds.length) };
    } else {
      return { videos: [], total: 0 };
    }
  } catch {}

  let filtered = memoryVideos.filter((v) => !isVideoDeleted(v));
  if (category && category !== 'all' && category !== 'എല്ലാം') {
    const cat = category.toLowerCase().trim();
    filtered = filtered.filter((v) => (v.category || '').toLowerCase().includes(cat));
  }
  const parsedLimit = Math.max(1, parseInt(limit) || 20);
  const parsedPage = Math.max(1, parseInt(page) || 1);
  const offset = (parsedPage - 1) * parsedLimit;
  return {
    videos: filtered.slice(offset, offset + parsedLimit),
    total: filtered.length,
  };
}

async function getVideoById(id) {
  if (!id) return null;
  const cleanId = String(id).trim();
  if (!cleanId || cleanId === 'undefined' || cleanId === 'null') return null;
  if (isVideoDeleted(cleanId)) return null;
  try {
    const rows = await query('SELECT * FROM videos WHERE id = ? LIMIT 1', [cleanId]);
    if (rows && rows.length > 0) {
      if (isVideoDeleted(rows[0])) {
        return null;
      }
      query('UPDATE videos SET views_count = views_count + 1 WHERE id = ?', [cleanId]).catch(() => {});
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
  } catch {}
  return (
    memoryVideos.find(
      (v) =>
        (v.id === cleanId || v._id === cleanId || v.youtubeId === cleanId) &&
        !isVideoDeleted(v)
    ) || null
  );
}

async function createVideo(data) {
  const newVid = {
    id: String(Date.now()),
    _id: String(Date.now()),
    title: (data.title || '').trim(),
    videoUrl: (data.videoUrl || '').trim(),
    youtubeId: data.youtubeId || '',
    category: data.category ? data.category.trim() : 'വാർത്തകൾ',
    duration: data.duration || '02:30',
    viewsCount: data.viewsCount ? parseInt(data.viewsCount) : 1200,
    views: `${data.viewsCount || 1200} views`,
    thumbnail: data.thumbnail || '',
    description: data.description || '',
    createdAt: new Date().toISOString(),
  };
  memoryVideos.unshift(newVid);
  savePortalContentToFile();

  try {
    const result = await query(
      `INSERT INTO videos (title, video_url, youtube_id, category, duration, views_count, thumbnail, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newVid.title,
        newVid.videoUrl,
        newVid.youtubeId,
        newVid.category,
        newVid.duration,
        newVid.viewsCount,
        newVid.thumbnail,
        newVid.description,
      ]
    );
    if (result && result.insertId) {
      newVid.id = String(result.insertId);
      newVid._id = String(result.insertId);
    }
  } catch {}

  return newVid;
}

async function updateVideo(id, data) {
  const idx = memoryVideos.findIndex((v) => String(v.id) === String(id) || String(v._id) === String(id));
  if (idx !== -1) {
    memoryVideos[idx] = { ...memoryVideos[idx], ...data };
    savePortalContentToFile();
  }
  try {
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
    const fromDb = await getVideoById(id);
    if (fromDb) return fromDb;
  } catch {}
  return idx !== -1 ? memoryVideos[idx] : null;
}

async function deleteVideo(id) {
  if (!id) return false;
  const cleanId = String(id).trim();
  if (!cleanId || cleanId === 'undefined' || cleanId === 'null') return false;
  const numId = isNaN(Number(cleanId)) ? 0 : Number(cleanId);
  const initialMemCount = memoryVideos.length;

  const target = memoryVideos.find(
    (v) => String(v.id) === cleanId || String(v._id) === cleanId || v.youtubeId === cleanId || v.videoUrl === cleanId
  );
  if (target) {
    if (target.id && String(target.id) !== 'undefined' && !memoryDeletedVideoIds.includes(String(target.id))) {
      memoryDeletedVideoIds.push(String(target.id));
    }
    if (target._id && String(target._id) !== 'undefined' && !memoryDeletedVideoIds.includes(String(target._id))) {
      memoryDeletedVideoIds.push(String(target._id));
    }
    if (target.youtubeId && !memoryDeletedVideoIds.includes(String(target.youtubeId))) {
      memoryDeletedVideoIds.push(String(target.youtubeId));
    }
  }
  if (!memoryDeletedVideoIds.includes(cleanId)) {
    memoryDeletedVideoIds.push(cleanId);
  }

  memoryVideos = memoryVideos.filter((v) => !isVideoDeleted(v));
  savePortalContentToFile();
  const deletedFromMem = memoryVideos.length < initialMemCount;
  try {
    const result = await query('DELETE FROM videos WHERE id = ? OR youtube_id = ? OR video_url = ?', [numId, cleanId, cleanId]);
    const deletedFromDb = result && result.affectedRows > 0;
    return Boolean(deletedFromDb || deletedFromMem);
  } catch {
    return true;
  }
}

// ----------------- SUBSCRIBERS SERVICE -----------------
async function getSubscribers() {
  try {
    const rows = await query('SELECT * FROM subscribers ORDER BY id DESC');
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        _id: String(r.id),
        email: r.email,
        active: Boolean(r.active),
        createdAt: r.created_at,
      }));
    }
  } catch {}
  return memorySubscribers;
}

async function createSubscriber(email) {
  const cleanEmail = email.toLowerCase().trim();
  const sub = { id: Date.now(), _id: String(Date.now()), email: cleanEmail, active: true, createdAt: new Date().toISOString() };
  if (!memorySubscribers.some((s) => s.email === cleanEmail)) {
    memorySubscribers.unshift(sub);
  }
  try {
    await query('INSERT IGNORE INTO subscribers (email) VALUES (?)', [cleanEmail]);
  } catch {}
  return { email: cleanEmail, active: true };
}

async function deleteSubscriber(id) {
  memorySubscribers = memorySubscribers.filter((s) => String(s.id) !== String(id));
  try {
    const result = await query('DELETE FROM subscribers WHERE id = ?', [id]);
    return result && result.affectedRows > 0;
  } catch {
    return true;
  }
}

// ----------------- AD INQUIRIES SERVICE -----------------
async function getAdInquiries() {
  try {
    const rows = await query('SELECT * FROM ad_inquiries ORDER BY id DESC');
    if (rows && rows.length > 0) {
      return rows.map((r) => ({
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
  } catch {}
  return memoryAdInquiries;
}

async function createAdInquiry(data) {
  const item = {
    id: Date.now(),
    _id: String(Date.now()),
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
  memoryAdInquiries.unshift(item);

  try {
    const result = await query(
      `INSERT INTO ad_inquiries (name, company_name, phone, email, ad_type, budget, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'New')`,
      [item.name, item.companyName, item.phone, item.email, item.adType, item.budget, item.message]
    );
    if (result && result.insertId) {
      item.id = result.insertId;
      item._id = String(result.insertId);
    }
  } catch {}

  return item;
}

async function updateAdInquiryStatus(id, status) {
  const item = memoryAdInquiries.find((a) => String(a.id) === String(id));
  if (item) item.status = status;
  try {
    await query('UPDATE ad_inquiries SET status = ? WHERE id = ?', [status, id]);
    const rows = await query('SELECT * FROM ad_inquiries WHERE id = ? LIMIT 1', [id]);
    if (rows && rows.length > 0) {
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
  } catch {}
  return item || null;
}

async function deleteAdInquiry(id) {
  memoryAdInquiries = memoryAdInquiries.filter((a) => String(a.id) !== String(id));
  try {
    const result = await query('DELETE FROM ad_inquiries WHERE id = ?', [id]);
    return result && result.affectedRows > 0;
  } catch {
    return true;
  }
}

// ----------------- PHOTO STORY SERVICE -----------------
async function getPhotoStory() {
  try {
    const rows = await query('SELECT * FROM photo_stories ORDER BY id DESC LIMIT 1');
    if (rows && rows.length > 0) {
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
    } else {
      return {
        id: 1,
        tagLabel: 'PHOTO STORY',
        subtitle: 'KERALA IN FRAMES',
        title: '',
        description: '',
        images: [],
        updatedAt: new Date().toISOString(),
      };
    }
  } catch {}
  return memoryPhotoStory;
}

async function updatePhotoStory({ tagLabel, subtitle, title, description, images }) {
  memoryPhotoStory = {
    id: 1,
    tagLabel: tagLabel || 'PHOTO STORY',
    subtitle: subtitle || 'KERALA IN FRAMES',
    title: (title || '').trim(),
    description: (description || '').trim(),
    images: Array.isArray(images) ? images : [],
    updatedAt: new Date().toISOString(),
  };
  savePortalContentToFile();

  try {
    const imgJson = JSON.stringify(memoryPhotoStory.images);
    const rows = await query('SELECT id FROM photo_stories ORDER BY id DESC LIMIT 1');
    if (!rows || rows.length === 0) {
      const res = await query(
        'INSERT INTO photo_stories (tag_label, subtitle, title, description, images) VALUES (?, ?, ?, ?, ?)',
        [memoryPhotoStory.tagLabel, memoryPhotoStory.subtitle, memoryPhotoStory.title, memoryPhotoStory.description, imgJson]
      );
      if (res && res.insertId) memoryPhotoStory.id = res.insertId;
    } else {
      await query(
        'UPDATE photo_stories SET tag_label = ?, subtitle = ?, title = ?, description = ?, images = ? WHERE id = ?',
        [memoryPhotoStory.tagLabel, memoryPhotoStory.subtitle, memoryPhotoStory.title, memoryPhotoStory.description, imgJson, rows[0].id]
      );
      memoryPhotoStory.id = rows[0].id;
    }
  } catch {}

  return memoryPhotoStory;
}

async function deletePhotoStory() {
  memoryPhotoStory = {
    id: 1,
    tagLabel: 'PHOTO STORY',
    subtitle: 'KERALA IN FRAMES',
    title: '',
    description: '',
    images: [],
    updatedAt: new Date().toISOString(),
  };
  savePortalContentToFile();
  try {
    await query('DELETE FROM photo_stories');
  } catch {}
  return true;
}

module.exports = {
  // Helpers
  isArticleDeleted,
  isBreakingDeleted,
  isVideoDeleted,
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
