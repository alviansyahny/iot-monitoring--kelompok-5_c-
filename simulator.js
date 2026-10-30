// simulator.js -> Jalankan dengan perintah: node simulator.js
// Berkas ini mensimulasikan mikrokontroler ESP32 + sensor DHT22 pada greenhouse

const URL = process.env.TARGET_URL || 'http://localhost:3005/api/readings';

console.log('==================================================');
console.log('  SIMULATOR SENSOR IOT GREENHOUSE (GH-01)');
console.log('  Target URL :', URL);
console.log('  Interval   : Setiap 5 detik');
console.log('  Tekan Ctrl+C untuk menghentikan');
console.log('==================================================\n');

setInterval(async () => {
  // Simulasi pembacaan data sensor suhu dan kelembapan
  const data = {
    device_id: 'GH-01',
    suhu: +(25 + Math.random() * 12).toFixed(1),      // Rentang 25 - 37 °C
    kelembapan: +(60 + Math.random() * 25).toFixed(1) // Rentang 60 - 85 %
  };

  const waktuKirim = new Date().toLocaleTimeString('id-ID');

  try {
    // Kirim data menggunakan fetch method POST dengan header application/json
    const response = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const hasil = await response.json();

    if (response.status === 201) {
      console.log(`[${waktuKirim}] SUKSES (${response.status}) -> ID: ${hasil.data.id} | Device: ${hasil.data.device_id} | Suhu: ${hasil.data.suhu}°C | Kelembapan: ${hasil.data.kelembapan}%`);
    } else {
      console.warn(`[${waktuKirim}] GAGAL (${response.status}) -> ${hasil.pesan || 'Error respons'}`);
    }
  } catch (error) {
    console.error(`[${waktuKirim}] ERROR KONEKSI -> Tidak dapat terhubung ke ${URL}. Pastikan server.js sudah dijalankan!`);
  }
}, 5000);
