const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { getPool } = require('../config/mysql');
const Article = require('../models/Article');
const BreakingNews = require('../models/BreakingNews');
const Video = require('../models/Video');
const Subscriber = require('../models/Subscriber');
const AdInquiry = require('../models/AdInquiry');
const User = require('../models/User');

async function migrate() {
  console.log('🔄 Connecting to MongoDB to fetch current data...');
  await mongoose.connect(process.env.MONGODB_URL);
  console.log('✅ Connected to MongoDB.');

  const pool = getPool();

  // 1. Migrate Users
  const users = await User.find().select('+password');
  console.log(`👤 Found ${users.length} users in MongoDB.`);
  for (const u of users) {
    try {
      await pool.query(
        `INSERT INTO users (name, email, password, role, avatar)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), avatar = VALUES(avatar);`,
        [u.name, u.email, u.password, u.role || 'editor', u.avatar || '']
      );
    } catch (err) {
      console.error(`Error migrating user ${u.email}:`, err.message);
    }
  }

  // 2. Migrate Articles
  const articles = await Article.find();
  console.log(`📰 Found ${articles.length} articles in MongoDB.`);
  for (const art of articles) {
    try {
      const customId = art.customId || String(art._id);
      await pool.query(
        `INSERT INTO articles (
          custom_id, title, \`lead\`, category, category_color, image_url, image_caption,
          read_time, audio_duration, paragraphs, highlights, author_name, author_designation,
          author_location, author_avatar, author_verified, district, country, views,
          views_count, likes_count, tags, is_breaking, is_trending, is_headline, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          views_count = VALUES(views_count),
          likes_count = VALUES(likes_count);`,
        [
          customId,
          art.title,
          art.lead || '',
          art.category,
          art.categoryColor || '#006b9a',
          art.imageUrl || '',
          art.imageCaption || '',
          art.readTime || '3 മിനിറ്റ് വായന',
          art.audioDuration || '03:00',
          JSON.stringify(art.paragraphs || []),
          JSON.stringify(art.highlights || []),
          art.author?.name || 'കേരളദേശം ന്യൂസ് ഡെസ്ക്',
          art.author?.designation || 'ഡെസ്ക് റിപ്പോർട്ടർ',
          art.author?.location || 'കേരളം',
          art.author?.avatar || '',
          art.author?.verified ?? true,
          art.district || '',
          art.country || '',
          String(art.views || '1'),
          art.viewsCount || 1,
          art.likesCount || 0,
          JSON.stringify(art.tags || []),
          art.isBreaking ? 1 : 0,
          art.isTrending ? 1 : 0,
          art.isHeadline ? 1 : 0,
          art.publishedAt || new Date().toISOString(),
        ]
      );
    } catch (err) {
      console.error(`Error migrating article ${art.title}:`, err.message);
    }
  }

  // 3. Migrate Breaking News
  const breakingList = await BreakingNews.find();
  console.log(`🚨 Found ${breakingList.length} breaking news in MongoDB.`);
  for (const brk of breakingList) {
    try {
      await pool.query(
        `INSERT INTO breaking_news (headline, active, priority)
         VALUES (?, ?, ?)`,
        [brk.headline, brk.active ? 1 : 0, brk.priority || 0]
      );
    } catch (err) {
      console.error(`Error migrating breaking news:`, err.message);
    }
  }

  // 4. Migrate Videos
  const videos = await Video.find();
  console.log(`🎬 Found ${videos.length} videos in MongoDB.`);
  for (const vid of videos) {
    try {
      await pool.query(
        `INSERT INTO videos (title, video_url, youtube_id, category, duration, views_count, thumbnail, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vid.title,
          vid.videoUrl || vid.youtubeUrl || '',
          vid.youtubeId || '',
          vid.category || 'വാർത്തകൾ',
          vid.duration || '02:30',
          vid.viewsCount || 100,
          vid.thumbnail || '',
          vid.description || '',
        ]
      );
    } catch (err) {
      console.error(`Error migrating video:`, err.message);
    }
  }

  // 5. Migrate Subscribers
  const subscribers = await Subscriber.find();
  console.log(`✉️ Found ${subscribers.length} subscribers in MongoDB.`);
  for (const sub of subscribers) {
    try {
      await pool.query(
        `INSERT INTO subscribers (email, active)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE active = VALUES(active)`,
        [sub.email, sub.active ? 1 : 0]
      );
    } catch (err) {
      console.error(`Error migrating subscriber:`, err.message);
    }
  }

  // 6. Migrate Ad Inquiries
  const inquiries = await AdInquiry.find();
  console.log(`📢 Found ${inquiries.length} ad inquiries in MongoDB.`);
  for (const ad of inquiries) {
    try {
      await pool.query(
        `INSERT INTO ad_inquiries (name, company_name, phone, email, ad_type, budget, message, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ad.name,
          ad.companyName || '',
          ad.phone,
          ad.email || '',
          ad.adType || 'Digital Banner',
          ad.budget || '',
          ad.message || '',
          ad.status || 'New',
        ]
      );
    } catch (err) {
      console.error(`Error migrating ad inquiry:`, err.message);
    }
  }

  console.log('🎉 ALL DATA MIGRATED SUCCESSFULLY FROM MONGODB TO MYSQL!');
  await mongoose.disconnect();
  await pool.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
