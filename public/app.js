// public/app.js - Logika Dashboard Monitoring IoT Greenhouse

let sensorChart = null;

// Format Waktu Lokal (WIB)
function formatTime(isoString) {
  if (!isoString) return '-';
  // SQLite CURRENT_TIMESTAMP disimpan dalam format UTC "YYYY-MM-DD HH:MM:SS"
  const d = new Date(isoString.replace(' ', 'T') + 'Z');
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Inisialisasi Chart.js
function initChart() {
  const ctx = document.getElementById('sensorChart').getContext('2d');
  
  // Gradien Suhu
  const tempGrad = ctx.createLinearGradient(0, 0, 0, 300);
  tempGrad.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
  tempGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

  // Gradien Kelembapan
  const humGrad = ctx.createLinearGradient(0, 0, 0, 300);
  humGrad.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
  humGrad.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

  sensorChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Suhu (°C)',
          data: [],
          borderColor: '#ef4444',
          backgroundColor: tempGrad,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#ef4444',
          tension: 0.35,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Kelembapan (%)',
          data: [],
          borderColor: '#2563eb',
          backgroundColor: humGrad,
          borderWidth: 2.5,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2563eb',
          tension: 0.35,
          fill: true,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false // Menggunakan legend kustom yang sudah kita buat di HTML
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleFont: { family: 'Plus Jakarta Sans', size: 12 },
          bodyFont: { family: 'JetBrains Mono', size: 13 },
          padding: 10,
          cornerRadius: 8
        }
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'JetBrains Mono', size: 11 }, color: '#64748b' }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Suhu (°C)', color: '#ef4444', font: { weight: 'bold' } },
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'JetBrains Mono' }, color: '#64748b' },
          suggestedMin: 20,
          suggestedMax: 40
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Kelembapan (%)', color: '#2563eb', font: { weight: 'bold' } },
          grid: { drawOnChartArea: false },
          ticks: { font: { family: 'JetBrains Mono' }, color: '#64748b' },
          suggestedMin: 50,
          suggestedMax: 100
        }
      }
    }
  });
}

// 1. Ambil Data Terbaru untuk Kartu Nilai & Status Online
async function fetchLatestReading() {
  try {
    const res = await fetch('/api/readings/latest');
    const result = await res.json();
    const data = result.data;

    const tempCard = document.getElementById('tempCard');
    const tempValue = document.getElementById('tempValue');
    const tempBadge = document.getElementById('tempBadge');
    const tempLastUpdated = document.getElementById('tempLastUpdated');

    const humidityValue = document.getElementById('humidityValue');
    const humidityLastUpdated = document.getElementById('humidityLastUpdated');

    const statusDot = document.getElementById('statusDot');
    const deviceStatusText = document.getElementById('deviceStatusText');
    const lastSeenText = document.getElementById('lastSeenText');

    if (!data) {
      tempValue.textContent = '--';
      humidityValue.textContent = '--';
      statusDot.className = 'pulse-dot offline';
      deviceStatusText.textContent = 'Offline (Belum Ada Data)';
      return;
    }

    tempValue.textContent = Number(data.suhu).toFixed(1);
    humidityValue.textContent = Number(data.kelembapan).toFixed(1);

    const formattedTime = formatTime(data.created_at);
    tempLastUpdated.textContent = `Pembaruan: ${formattedTime}`;
    humidityLastUpdated.textContent = `Pembaruan: ${formattedTime}`;
    lastSeenText.textContent = `${data.device_id}`;

    // Ketentuan Soal: Kartu suhu berubah warna merah jika suhu > 35 °C (status "Panas"), hijau jika normal
    if (data.suhu > 35) {
      tempCard.className = 'metric-card card-state-hot';
      tempBadge.className = 'status-chip chip-hot';
      tempBadge.textContent = 'Panas';
    } else {
      tempCard.className = 'metric-card card-state-normal';
      tempBadge.className = 'status-chip chip-normal';
      tempBadge.textContent = 'Normal';
    }

    // Ketentuan Soal: Indikator status perangkat: "Online" jika data terakhir < 30 detik, selain itu "Offline"
    const dataTime = new Date(data.created_at.replace(' ', 'T') + 'Z').getTime();
    const nowTime = Date.now();
    const diffSeconds = Math.round((nowTime - dataTime) / 1000);

    if (diffSeconds < 30) {
      statusDot.className = 'pulse-dot online';
      deviceStatusText.textContent = 'Online';
      deviceStatusText.style.color = '#059669';
    } else {
      statusDot.className = 'pulse-dot offline';
      deviceStatusText.textContent = `Offline (${diffSeconds}s lalu)`;
      deviceStatusText.style.color = '#ef4444';
    }
  } catch (err) {
    console.error('Gagal mengambil data terbaru:', err);
  }
}

// 2. Ambil Statistik Sensor
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const result = await res.json();
    if (result.status === 'sukses' && result.data) {
      const { total_data, suhu, kelembapan } = result.data;
      document.getElementById('statTotalData').textContent = `${total_data} Data`;
      document.getElementById('statTempAvg').textContent = `${suhu.rata_rata}°C`;
      document.getElementById('statTempMinMax').textContent = `Min: ${suhu.minimum}°C | Max: ${suhu.maksimum}°C`;
      document.getElementById('statHumAvg').textContent = `${kelembapan.rata_rata}%`;
      document.getElementById('statHumMinMax').textContent = `Min: ${kelembapan.minimum}% | Max: ${kelembapan.maksimum}%`;
    }
  } catch (err) {
    console.error('Gagal mengambil statistik:', err);
  }
}

// 3. Ambil Riwayat 20 Data untuk Grafik & 10 Data untuk Tabel
async function fetchHistory() {
  try {
    const res = await fetch('/api/readings?limit=20');
    const result = await res.json();
    const rows = result.data || [];

    // Update Tabel Riwayat (10 Data Terakhir)
    const tbody = document.getElementById('readingsTableBody');
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="cell-loading">Belum ada pembacaan sensor yang masuk</td></tr>';
    } else {
      const tableData = rows.slice(0, 10);
      tbody.innerHTML = tableData.map(r => `
        <tr>
          <td class="cell-mono">#${r.id}</td>
          <td><strong class="cell-mono">${r.device_id}</strong></td>
          <td class="cell-mono cell-bold">${r.suhu.toFixed(1)} °C</td>
          <td class="cell-mono">${r.kelembapan.toFixed(1)} %</td>
          <td>
            <span class="status-chip ${r.suhu > 35 ? 'chip-hot' : 'chip-normal'}">
              ${r.suhu > 35 ? 'Panas' : 'Normal'}
            </span>
          </td>
          <td class="cell-mono" style="color: #64748b;">${formatTime(r.created_at)}</td>
        </tr>
      `).join('');
    }

    // Update Chart.js (Urutkan dari data terlama ke terbaru agar grafik linier bergerak ke kanan)
    if (sensorChart && rows.length > 0) {
      const chartRows = [...rows].reverse();
      sensorChart.data.labels = chartRows.map(r => formatTime(r.created_at));
      sensorChart.data.datasets[0].data = chartRows.map(r => r.suhu);
      sensorChart.data.datasets[1].data = chartRows.map(r => r.kelembapan);
      sensorChart.update();
    }
  } catch (err) {
    console.error('Gagal mengambil riwayat pembacaan:', err);
  }
}

// Fungsi Pembaruan Seluruh Komponen Dashboard
async function refreshDashboard() {
  await Promise.all([
    fetchLatestReading(),
    fetchStats(),
    fetchHistory()
  ]);
}

// Jalankan saat halaman siap
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  refreshDashboard();

  // Tombol Refresh Manual
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      btnRefresh.style.opacity = '0.5';
      refreshDashboard().then(() => {
        setTimeout(() => { btnRefresh.style.opacity = '1'; }, 300);
      });
    });
  }

  // Polling Otomatis Setiap 5 Detik Sesuai Ketentuan Modul
  setInterval(refreshDashboard, 5000);
});
