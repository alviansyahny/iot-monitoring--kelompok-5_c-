// public/app.js - Logika Dashboard Monitoring IoT Greenhouse (Mendukung Multi-device & Custom Threshold)

let sensorChart = null;
let currentThreshold = 35.0; // Default batas suhu panas
let selectedDevice = 'all';

// Format Waktu Lokal (WIB)
function formatTime(isoString) {
  if (!isoString) return '-';
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
  
  const tempGrad = ctx.createLinearGradient(0, 0, 0, 300);
  tempGrad.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
  tempGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');

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
        legend: { display: false },
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

// Ambil Ambang Batas Suhu dari Server/Database
async function fetchThreshold() {
  try {
    const res = await fetch('/api/settings/threshold');
    const result = await res.json();
    if (result.status === 'sukses' && result.data) {
      currentThreshold = parseFloat(result.data.temp_threshold) || 35.0;
      const input = document.getElementById('thresholdInput');
      if (input) input.value = currentThreshold.toFixed(1);
    }
  } catch (err) {
    console.error('Gagal mengambil ambang batas:', err);
  }
}

// Simpan Ambang Batas Suhu ke Server/Database
async function saveThreshold() {
  const input = document.getElementById('thresholdInput');
  const btn = document.getElementById('btnSaveThreshold');
  const val = parseFloat(input.value);

  if (isNaN(val) || val < -40 || val > 80) {
    alert('Masukkan angka suhu yang valid antara -40 dan 80 °C!');
    return;
  }

  btn.disabled = true;
  btn.textContent = '...';

  try {
    const res = await fetch('/api/settings/threshold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp_threshold: val })
    });
    const result = await res.json();
    if (res.ok) {
      currentThreshold = val;
      btn.textContent = 'Tersimpan!';
      setTimeout(() => { btn.textContent = 'Simpan'; btn.disabled = false; }, 1500);
      refreshDashboard();
    } else {
      alert(result.pesan || 'Gagal menyimpan ambang batas');
      btn.textContent = 'Simpan';
      btn.disabled = false;
    }
  } catch (err) {
    console.error('Error simpan ambang batas:', err);
    btn.textContent = 'Simpan';
    btn.disabled = false;
  }
}

// Ambil Daftar Semua Device untuk Dropdown
async function fetchDevices() {
  try {
    const res = await fetch('/api/devices');
    const result = await res.json();
    if (result.status === 'sukses' && Array.isArray(result.data)) {
      const select = document.getElementById('deviceSelect');
      const currentVal = select.value;
      
      select.innerHTML = '<option value="all">Semua Perangkat</option>';
      result.data.forEach(dev => {
        const opt = document.createElement('option');
        opt.value = dev;
        opt.textContent = `Perangkat ${dev}`;
        select.appendChild(opt);
      });

      if (result.data.includes(currentVal)) {
        select.value = currentVal;
      }
    }
  } catch (err) {
    console.error('Gagal mengambil daftar device:', err);
  }
}

// 1. Ambil Data Terbaru untuk Kartu Nilai & Status Online
async function fetchLatestReading() {
  try {
    const query = selectedDevice !== 'all' ? `?device_id=${encodeURIComponent(selectedDevice)}` : '';
    const res = await fetch(`/api/readings/latest${query}`);
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

    // Ambang Batas Suhu Dinamis: Berubah merah jika suhu > ambang batas aktif, hijau jika normal
    if (data.suhu > currentThreshold) {
      tempCard.className = 'metric-card card-state-hot';
      tempBadge.className = 'status-chip chip-hot';
      tempBadge.textContent = 'Panas';
    } else {
      tempCard.className = 'metric-card card-state-normal';
      tempBadge.className = 'status-chip chip-normal';
      tempBadge.textContent = 'Normal';
    }

    // Status Online/Offline: "Online" jika data < 30 detik
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
    const query = selectedDevice !== 'all' ? `?device_id=${encodeURIComponent(selectedDevice)}` : '';
    const res = await fetch(`/api/stats${query}`);
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
    const query = selectedDevice !== 'all' ? `&device_id=${encodeURIComponent(selectedDevice)}` : '';
    const res = await fetch(`/api/readings?limit=20${query}`);
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
            <span class="status-chip ${r.suhu > currentThreshold ? 'chip-hot' : 'chip-normal'}">
              ${r.suhu > currentThreshold ? 'Panas' : 'Normal'}
            </span>
          </td>
          <td class="cell-mono" style="color: #64748b;">${formatTime(r.created_at)}</td>
        </tr>
      `).join('');
    }

    // Update Chart.js
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
    fetchDevices(),
    fetchLatestReading(),
    fetchStats(),
    fetchHistory()
  ]);
}

// Jalankan saat dokumen siap
document.addEventListener('DOMContentLoaded', async () => {
  initChart();
  await fetchThreshold();
  await refreshDashboard();

  // Event Listener Ganti Dropdown Device
  const deviceSelect = document.getElementById('deviceSelect');
  if (deviceSelect) {
    deviceSelect.addEventListener('change', (e) => {
      selectedDevice = e.target.value;
      refreshDashboard();
    });
  }

  // Event Listener Simpan Ambang Batas Suhu
  const btnSaveThreshold = document.getElementById('btnSaveThreshold');
  if (btnSaveThreshold) {
    btnSaveThreshold.addEventListener('click', saveThreshold);
  }

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
