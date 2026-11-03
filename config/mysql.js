const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
  database: process.env.DB_NAME || 'keraladesam_db',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  charset: 'utf8mb4',
};

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

async function query(sql, params = []) {
  const p = getPool();
  const [results] = await p.query(sql, params);
  return results;
}

async function initMySQLTables() {
  try {
    // Ensure database exists
    const adminConn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
    });
    await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await adminConn.end();

    const p = getPool();

    // 1. Users Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'editor') DEFAULT 'editor',
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Articles Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        custom_id VARCHAR(100) UNIQUE,
        title TEXT NOT NULL,
        \`lead\` TEXT,
        category VARCHAR(100) NOT NULL,
        category_color VARCHAR(50) DEFAULT '#006b9a',
        image_url TEXT,
        image_caption TEXT,
        read_time VARCHAR(50) DEFAULT '3 മിനിറ്റ് വായന',
        audio_duration VARCHAR(20) DEFAULT '03:00',
        paragraphs JSON,
        highlights JSON,
        author_name VARCHAR(150) DEFAULT 'കേരളദേശം ന്യൂസ് ഡെസ്ക്',
        author_designation VARCHAR(150) DEFAULT 'ഡെസ്ക് റിപ്പോർട്ടർ',
        author_location VARCHAR(100) DEFAULT 'കേരളം',
        author_avatar TEXT,
        author_verified BOOLEAN DEFAULT TRUE,
        district VARCHAR(100) DEFAULT '',
        country VARCHAR(100) DEFAULT '',
        views VARCHAR(50) DEFAULT '1',
        views_count INT DEFAULT 1,
        likes_count INT DEFAULT 0,
        tags JSON,
        is_breaking BOOLEAN DEFAULT FALSE,
        is_trending BOOLEAN DEFAULT FALSE,
        is_headline BOOLEAN DEFAULT FALSE,
        published_at VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_district (district)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Breaking News Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS breaking_news (
        id INT AUTO_INCREMENT PRIMARY KEY,
        headline TEXT NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        priority INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Videos Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title TEXT NOT NULL,
        video_url TEXT NOT NULL,
        youtube_id VARCHAR(100),
        category VARCHAR(100) DEFAULT 'വാർത്തകൾ',
        duration VARCHAR(50) DEFAULT '02:30',
        views_count INT DEFAULT 100,
        thumbnail TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Subscribers Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Ad Inquiries Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS ad_inquiries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) DEFAULT '',
        phone VARCHAR(50) NOT NULL,
        email VARCHAR(255) DEFAULT '',
        ad_type VARCHAR(150) DEFAULT 'Digital Banner',
        budget VARCHAR(100) DEFAULT '',
        message TEXT,
        status ENUM('New', 'Contacted', 'Confirmed', 'Closed') DEFAULT 'New',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Photo Stories Table
    await p.query(`
      CREATE TABLE IF NOT EXISTS photo_stories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tag_label VARCHAR(100) DEFAULT 'PHOTO STORY',
        subtitle VARCHAR(150) DEFAULT 'KERALA IN FRAMES',
        title TEXT NOT NULL,
        description TEXT,
        images JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed default photo story if none exists
    const [existingStories] = await p.query('SELECT id FROM photo_stories LIMIT 1');
    if (existingStories.length === 0) {
      const defaultImages = JSON.stringify([
        { url: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=600&q=80', caption: 'കുട്ടനാട് 1' },
        { url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80', caption: 'കുട്ടനാട് 2' },
        { url: 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=600&q=80', caption: 'കുട്ടനാട് 3' },
      ]);
      await p.query(
        'INSERT INTO photo_stories (tag_label, subtitle, title, description, images) VALUES (?, ?, ?, ?, ?)',
        [
          'PHOTO STORY',
          'KERALA IN FRAMES',
          'കുട്ടനാടൻ കായൽ ജീവിതം: വേനൽമഴയുടെ വരവറിയിച്ച് ഓളങ്ങൾ',
          "Visual captures of life, landscapes, and backwaters across God's Own Country.",
          defaultImages,
        ]
      );
    }

    // Seed default admin user if not exists
    const [existingAdmin] = await p.query('SELECT id FROM users WHERE email = ?', ['admin@keraladesam.com']);
    if (existingAdmin.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin12345', salt);
      await p.query(
        'INSERT INTO users (name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?)',
        [
          'ചീഫ് എഡിറ്റർ',
          'admin@keraladesam.com',
          hashedPassword,
          'admin',
          'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80',
        ]
      );
      console.log('✅ Default admin account seeded in MySQL: admin@keraladesam.com');
    }

    console.log(`✅ MySQL Tables Initialized Successfully in database: ${dbConfig.database}`);
    return true;
  } catch (err) {
    console.error('❌ MySQL Initialization Error:', err.message);
    return false;
  }
}

module.exports = {
  getPool,
  query,
  initMySQLTables,
  dbConfig,
};
