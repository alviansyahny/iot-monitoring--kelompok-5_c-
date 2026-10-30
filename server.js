const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware untuk membaca format JSON
app.use(express.json());

// Sajikan berkas statis dari folder public (dashboard web)
app.use(express.static('public'));

/**
 * 1. POST /api/readings
 * Menerima data sensor dari perangkat / simulator
 * Validasi:
 * - suhu dan kelembapan harus berupa angka
 * - suhu berada di rentang -40 s.d. 80 °C
 * - kelembapan berada di rentang 0 s.d. 100 %
 */
app.post('/api/readings', (req, res) => {
  const { device_id, suhu, kelembapan } = req.body;

  // Validasi keberadaan device_id
  if (!device_id || typeof device_id !== 'string') {
    return res.status(400).json({
      status: 'error',
      pesan: 'device_id wajib diisi dan harus berupa teks string'
    });
  }

  // Validasi tipe data angka
  if (typeof suhu !== 'number' || Number.isNaN(suhu)) {
    return res.status(400).json({
      status: 'error',
      pesan: 'Nilai suhu wajib berupa angka yang valid'
    });
  }

  if (typeof kelembapan !== 'number' || Number.isNaN(kelembapan)) {
    return res.status(400).json({
      status: 'error',
      pesan: 'Nilai kelembapan wajib berupa angka yang valid'
    });
  }

  // Validasi rentang nilai suhu (-40 s.d. 80 °C)
  if (suhu < -40 || suhu > 80) {
    return res.status(400).json({
      status: 'error',
      pesan: 'Suhu di luar rentang yang diizinkan (-40 °C hingga 80 °C)'
    });
  }

  // Validasi rentang nilai kelembapan (0 s.d. 100 %)
  if (kelembapan < 0 || kelembapan > 100) {
    return res.status(400).json({
      status: 'error',
      pesan: 'Kelembapan di luar rentang yang diizinkan (0% hingga 100%)'
    });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO readings (device_id, suhu, kelembapan)
      VALUES (?, ?, ?)
    `);
    const info = stmt.run(device_id, suhu, kelembapan);

    const savedData = db.prepare('SELECT * FROM readings WHERE id = ?').get(info.lastInsertRowid);

    return res.status(201).json({
      status: 'sukses',
      pesan: 'Data sensor berhasil disimpan',
      data: savedData
    });
  } catch (err) {
    console.error('Gagal menyimpan data:', err.message);
    return res.status(500).json({
      status: 'error',
      pesan: 'Terjadi kesalahan pada server saat menyimpan data'
    });
  }
});

/**
 * 2. GET /api/readings/latest
 * Mengambil 1 data sensor paling baru untuk kartu nilai
 * Mendukung filter query: ?device_id=GH-01
 */
app.get('/api/readings/latest', (req, res) => {
  try {
    const { device_id } = req.query;
    let latest;
    if (device_id && device_id !== 'all') {
      latest = db.prepare('SELECT * FROM readings WHERE device_id = ? ORDER BY id DESC LIMIT 1').get(device_id);
    } else {
      latest = db.prepare('SELECT * FROM readings ORDER BY id DESC LIMIT 1').get();
    }

    if (!latest) {
      return res.status(200).json({
        status: 'sukses',
        pesan: 'Belum ada data sensor',
        data: null
      });
    }

    return res.status(200).json({
      status: 'sukses',
      data: latest
    });
  } catch (err) {
    console.error('Gagal mengambil data terbaru:', err.message);
    return res.status(500).json({
      status: 'error',
      pesan: 'Terjadi kesalahan pada server'
    });
  }
});

/**
 * 3. GET /api/readings?limit=20&device_id=GH-01
 * Mengambil riwayat N data terakhir untuk grafik dan tabel
 * Mendukung filter device_id
 */
app.get('/api/readings', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const { device_id } = req.query;

    let rows;
    if (device_id && device_id !== 'all') {
      const stmt = db.prepare('SELECT * FROM readings WHERE device_id = ? ORDER BY id DESC LIMIT ?');
      rows = stmt.all(device_id, limit);
    } else {
      const stmt = db.prepare('SELECT * FROM readings ORDER BY id DESC LIMIT ?');
      rows = stmt.all(limit);
    }

    return res.status(200).json({
      status: 'sukses',
      jumlah: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('Gagal mengambil riwayat data:', err.message);
    return res.status(500).json({
      status: 'error',
      pesan: 'Terjadi kesalahan pada server'
    });
  }
});

/**
 * 4. GET /api/stats
 * Mengambil statistik rata-rata, minimum, dan maksimum untuk suhu dan kelembapan
 * Mendukung filter ?device_id=GH-01
 */
app.get('/api/stats', (req, res) => {
  try {
    const { device_id } = req.query;
    let stats;

    if (device_id && device_id !== 'all') {
      stats = db.prepare(`
        SELECT 
          COUNT(id) as total_data,
          ROUND(AVG(suhu), 2) as avg_suhu,
          MIN(suhu) as min_suhu,
          MAX(suhu) as max_suhu,
          ROUND(AVG(kelembapan), 2) as avg_kelembapan,
          MIN(kelembapan) as min_kelembapan,
          MAX(kelembapan) as max_kelembapan
        FROM readings
        WHERE device_id = ?
      `).get(device_id);
    } else {
      stats = db.prepare(`
        SELECT 
          COUNT(id) as total_data,
          ROUND(AVG(suhu), 2) as avg_suhu,
          MIN(suhu) as min_suhu,
          MAX(suhu) as max_suhu,
          ROUND(AVG(kelembapan), 2) as avg_kelembapan,
          MIN(kelembapan) as min_kelembapan,
          MAX(kelembapan) as max_kelembapan
        FROM readings
      `).get();
    }

    return res.status(200).json({
      status: 'sukses',
      data: {
        total_data: stats.total_data || 0,
        suhu: {
          rata_rata: stats.avg_suhu !== null ? stats.avg_suhu : 0,
          minimum: stats.min_suhu !== null ? stats.min_suhu : 0,
          maksimum: stats.max_suhu !== null ? stats.max_suhu : 0
        },
        kelembapan: {
          rata_rata: stats.avg_kelembapan !== null ? stats.avg_kelembapan : 0,
          minimum: stats.min_kelembapan !== null ? stats.min_kelembapan : 0,
          maksimum: stats.max_kelembapan !== null ? stats.max_kelembapan : 0
        }
      }
    });
  } catch (err) {
    console.error('Gagal mengambil statistik:', err.message);
    return res.status(500).json({
      status: 'error',
      pesan: 'Terjadi kesalahan pada server'
    });
  }
});

/**
 * BONUS 1: GET /api/devices
 * Mengambil daftar unik semua device_id yang pernah mengirim data
 */
app.get('/api/devices', (req, res) => {
  try {
    const devices = db.prepare('SELECT DISTINCT device_id FROM readings ORDER BY device_id ASC').all();
    return res.status(200).json({
      status: 'sukses',
      data: devices.map(d => d.device_id)
    });
  } catch (err) {
    console.error('Gagal mengambil daftar device:', err.message);
    return res.status(500).json({
      status: 'error',
      pesan: 'Terjadi kesalahan pada server'
    });
  }
});

/**
 * BONUS 2: GET /api/settings/threshold
 * Mengambil ambang batas suhu saat ini dari database
 */
app.get('/api/settings/threshold', (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'temp_threshold'").get();
    const threshold = row ? parseFloat(row.value) : 35.0;
    return res.status(200).json({
      status: 'sukses',
      data: { temp_threshold: threshold }
    });
  } catch (err) {
    console.error('Gagal mengambil ambang batas:', err.message);
    return res.status(500).json({
      status: 'error',
      pesan: 'Terjadi kesalahan pada server'
    });
  }
});

/**
 * BONUS 2: POST /api/settings/threshold
 * Menyimpan ambang batas suhu baru ke database
 */
app.post('/api/settings/threshold', (req, res) => {
  const { temp_threshold } = req.body;
  const num = parseFloat(temp_threshold);

  if (isNaN(num) || num < -40 || num > 80) {
    return res.status(400).json({
      status: 'error',
      pesan: 'Ambang batas suhu harus berupa angka antara -40 dan 80 °C'
    });
  }

  try {
    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('temp_threshold', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(num.toFixed(1));

    return res.status(200).json({
      status: 'sukses',
      pesan: 'Ambang batas suhu berhasil diperbarui',
      data: { temp_threshold: num }
    });
  } catch (err) {
    console.error('Gagal menyimpan ambang batas:', err.message);
    return res.status(500).json({
      status: 'error',
      pesan: 'Terjadi kesalahan pada server'
    });
  }
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server IoT Monitoring berjalan di http://localhost:${PORT}`);
});
