
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({
    path: path.join(__dirname, '..', '.env.migration')
});

const DATA_FILE = path.join(
    __dirname,
    '..',
    'data',
    'portal_content_migration.json'
);

const CA_FILE = path.join(
    __dirname,
    '..',
    'certs',
    'tidb-ca.pem'
);

function jsonValue(value) {
    return JSON.stringify(value ?? []);
}

function toDate(value) {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

async function migrate() {
    let connection;

    try {
        if (!fs.existsSync(DATA_FILE)) {
            throw new Error('Migration JSON file not found');
        }

        if (!fs.existsSync(CA_FILE)) {
            throw new Error('TiDB CA certificate not found');
        }

        const rawData = fs.readFileSync(DATA_FILE, 'utf8')
            .replace(/^\uFEFF/, '');

        const data = JSON.parse(rawData);

        if (
            data.articles?.length !== 9 ||
            data.breaking?.length !== 5 ||
            data.videos?.length !== 8 ||
            !data.photoStory?.images?.length
        ) {
            throw new Error('Migration data validation failed');
        }

        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: {
                ca: fs.readFileSync(CA_FILE),
                rejectUnauthorized: true
            },
            connectTimeout: 15000
        });

        console.log('Connected to TiDB Cloud');

        // Protect existing content.
        const tables = [
            'articles',
            'breaking_news',
            'videos',
            'photo_stories'
        ];

        for (const table of tables) {
            const [rows] = await connection.query(
                `SELECT COUNT(*) AS total FROM ${table}`
            );

            if (Number(rows[0].total) !== 0) {
                throw new Error(
                    `${table} is not empty. Migration stopped safely.`
                );
            }
        }

        console.log('All content tables are empty.');

        await connection.beginTransaction();

        // 1. ARTICLES
        const articleSQL = `
      INSERT INTO articles (
        id, custom_id, title, \`lead\`, category,
        category_color, image_url, image_caption,
        read_time, audio_duration, paragraphs, highlights,
        author_name, author_designation, author_location,
        author_avatar, author_verified, district, country,
        views, views_count, likes_count, tags,
        is_breaking, is_trending, is_headline,
        published_at, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `;

        for (const article of data.articles) {
            const author = article.author || {};

            await connection.execute(articleSQL, [
                Number(article.id),
                article.customId,
                article.title,
                article.lead || '',
                article.category || 'വാർത്തകൾ',
                article.categoryColor || '#006b9a',
                article.imageUrl || '',
                article.imageCaption || '',
                article.readTime || '3 മിനിറ്റ് വായന',
                article.audioDuration || '03:00',
                jsonValue(article.paragraphs),
                jsonValue(article.highlights),
                author.name || 'കേരളദേശം ന്യൂസ് ഡെസ്ക്',
                author.designation || 'എഡിറ്റർ',
                author.location || 'കേരളം',
                author.avatar || null,
                author.verified !== false,
                article.district || '',
                article.country || '',
                String(article.views ?? '1'),
                Number(article.viewsCount ?? 1),
                Number(article.likesCount ?? 0),
                jsonValue(article.tags),
                Boolean(article.isBreaking),
                Boolean(article.isTrending),
                Boolean(article.isHeadline),
                article.publishedAt || null,
                toDate(article.createdAt)
            ]);
        }

        // 2. BREAKING NEWS
        for (const item of data.breaking) {
            await connection.execute(
                `INSERT INTO breaking_news
         (headline, active, priority, created_at)
         VALUES (?, ?, ?, ?)`,
                [
                    item.headline,
                    Boolean(item.active),
                    Number(item.priority ?? 0),
                    toDate(item.createdAt)
                ]
            );
        }

        // 3. VIDEOS
        for (const video of data.videos) {
            await connection.execute(
                `INSERT INTO videos (
          title, video_url, youtube_id, category,
          duration, views_count, thumbnail,
          description, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    video.title,
                    video.videoUrl || '',
                    video.youtubeId || null,
                    video.category || 'വാർത്തകൾ',
                    video.duration || '02:30',
                    Number(video.viewsCount ?? 100),
                    video.thumbnail || null,
                    video.description || '',
                    toDate(video.createdAt)
                ]
            );
        }

        // 4. PHOTO STORY
        const photo = data.photoStory;

        await connection.execute(
            `INSERT INTO photo_stories (
        id, tag_label, subtitle, title,
        description, images, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                Number(photo.id || 1),
                photo.tagLabel || 'PHOTO STORY',
                photo.subtitle || 'KERALA IN FRAMES',
                photo.title,
                photo.description || '',
                jsonValue(photo.images),
                toDate(photo.updatedAt),
                toDate(photo.updatedAt)
            ]
        );

        await connection.commit();

        console.log('\nMIGRATION SUCCESSFUL');

        for (const table of tables) {
            const [rows] = await connection.query(
                `SELECT COUNT(*) AS total FROM ${table}`
            );

            console.log(`${table}: ${rows[0].total}`);
        }

        const [users] = await connection.query(
            'SELECT COUNT(*) AS total FROM users'
        );

        console.log(`users: ${users[0].total}`);
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
                console.log('Transaction rolled back.');
            } catch (rollbackError) {
                console.error('Rollback error:', rollbackError.message);
            }
        }

        console.error('\nMIGRATION FAILED:', error.message);
        process.exitCode = 1;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

migrate();
