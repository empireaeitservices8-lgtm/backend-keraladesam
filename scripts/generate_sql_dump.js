require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool, query } = require('../config/mysql');

async function exportDump() {
  const p = getPool();
  let dump = `-- Kerala Desam MySQL Database Dump\n-- Generated on: ${new Date().toISOString()}\n-- Compatible with MySQL 5.7+ / 8.0+ / MariaDB / cPanel phpMyAdmin\n\n`;
  dump += `CREATE DATABASE IF NOT EXISTS \`keraladesam_db\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE \`keraladesam_db\`;\n\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n`;

  const tables = ['users', 'articles', 'breaking_news', 'videos', 'subscribers', 'ad_inquiries'];

  for (const table of tables) {
    const [createTableResult] = await p.query(`SHOW CREATE TABLE \`${table}\``);
    dump += `DROP TABLE IF EXISTS \`${table}\`;\n`;
    dump += `${createTableResult[0]['Create Table']};\n\n`;

    const [rows] = await p.query(`SELECT * FROM \`${table}\``);
    if (rows.length > 0) {
      dump += `-- Data for ${table}\n`;
      for (const row of rows) {
        const keys = Object.keys(row).map((k) => `\`${k}\``).join(', ');
        const values = Object.values(row)
          .map((v) => {
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'boolean') return v ? '1' : '0';
            if (typeof v === 'number') return v;
            if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
            return `'${String(v).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
          })
          .join(', ');
        dump += `INSERT INTO \`${table}\` (${keys}) VALUES (${values});\n`;
      }
      dump += `\n`;
    }
  }

  dump += `SET FOREIGN_KEY_CHECKS = 1;\n`;

  const dumpPath = path.join(__dirname, '..', 'keraladesam_db.sql');
  fs.writeFileSync(dumpPath, dump, 'utf8');
  console.log(`Database dump saved to ${dumpPath} (${(dump.length / 1024).toFixed(1)} KB)`);
  process.exit(0);
}

exportDump().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
