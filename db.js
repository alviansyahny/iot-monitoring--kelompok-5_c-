const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'readings.db');
const db = new Database(dbPath);

// Aktifkan mode WAL untuk performa baca/tulis konkuren yang lebih baik
db.pragma('journal_mode = WAL');

// Buat tabel readings jika belum ada
db.exec(`
  CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    suhu REAL NOT NULL,
    kelembapan REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
