require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('node-cron');
const Database = require('better-sqlite3');

// Config Environment
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY;
const BINDERBYTE_KEY = process.env.BINDERBYTE_API_KEY;

const bot = new TelegramBot(TOKEN, { polling: true });
const db = new Database('database.db');

// Inisialisasi Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    chat_id TEXT PRIMARY KEY,
    kota_id TEXT,
    nama_kota TEXT
  );
  CREATE TABLE IF NOT EXISTS tracked_resi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT,
    courier TEXT,
    awb TEXT,
    last_status TEXT,
    is_delivered INTEGER DEFAULT 0,
    UNIQUE(chat_id, awb)
  );
`);

console.log('Bot @jagosemuanya_bot dengan Auto-Notifikasi berjalan...');

// Command /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const text = `Halo *${msg.from.first_name}*! 👋\n\nSelamat datang di *@jagosemuanya_bot*.\n\n` +
    `🚚 *Cek & Auto-Track Resi:*\n` +
    `• Cek Sekali: \`/resi <kurir> <no_resi>\`\n` +
    `• Auto-Track (Dapat Notif Update): \`/track <kurir> <no_resi>\`\n` +
    `• Lihat Resi Di-track: \`/myresi\`\n` +
    `• Hapus Track Resi: \`/untrack <no_resi>\`\n\n` +
    `🕌 *Jadwal Sholat & Auto-Notif:*\n` +
    `• Cek Jadwal: \`/sholat <nama_kota>\`\n` +
    `• Set Lokasi Notif Otomatis: \`/setlokasi <nama_kota>\`\n\n` +
    `🌤 *Cek Cuaca:*\n` +
    `• Cek Cuaca: \`/cuaca <nama_kota>\``;

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// ==========================================
// 1. FITUR AUTO-NOTIFIKASI JADWAL SHOLAT
// ==========================================

// Set Lokasi Sholat Otomatis
bot.onText(/\/setlokasi (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const city = match[1];

  try {
    const searchUrl = `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(city)}`;
    const searchRes = await axios.get(searchUrl);

    if (!searchRes.data.status || searchRes.data.data.length === 0) {
      return bot.sendMessage(chatId, `❌ *Kota "${city}" tidak ditemukan.*`, { parse_mode: 'Markdown' });
    }

    const kotaId = searchRes.data.data[0].id;
    const namaKota = searchRes.data.data[0].lokasi;

    const stmt = db.prepare('INSERT OR REPLACE INTO users (chat_id, kota_id, nama_kota) VALUES (?, ?, ?)');
    stmt.run(chatId.toString(), kotaId, namaKota);

    bot.sendMessage(chatId, `✅ *Lokasi berhasil diatur ke ${namaKota}!*\nKamu akan menerima notifikasi otomatis setiap kali masuk waktu sholat.`, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengatur lokasi.`, { parse_mode: 'Markdown' });
  }
});

// Cek Jadwal Sholat Manual
bot.onText(/\/sholat (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const city = match[1];

  try {
    const searchUrl = `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(city)}`;
    const searchRes = await axios.get(searchUrl);

    if (!searchRes.data.status || searchRes.data.data.length === 0) {
      return bot.sendMessage(chatId, `❌ *Kota "${city}" tidak ditemukan.*`, { parse_mode: 'Markdown' });
    }

    const kotaId = searchRes.data.data[0].id;
    const namaKota = searchRes.data.data[0].lokasi;

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');

    const jadwalUrl = `https://api.myquran.com/v2/sholat/jadwal/${kotaId}/${yyyy}/${mm}/${dd}`;
    const jadwalRes = await axios.get(jadwalUrl);
    const jadwal = jadwalRes.data.data.jadwal;

    const sholatMessage = `🕌 *JADWAL SHOLAT HARI INI*\n` +
      `📍 *Lokasi:* ${namaKota}\n` +
      `📅 *Tanggal:* ${jadwal.tanggal}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🌅 *Imsak:* ${jadwal.imsak}\n` +
      `🌄 *Subuh:* ${jadwal.subuh}\n` +
      `☀️ *Terbit:* ${jadwal.terbit}\n` +
      `🌤 *Dhuha:* ${jadwal.dhuha}\n` +
      `☀️ *Dzuhur:* ${jadwal.dzuhur}\n` +
      `🌤 *Ashar:* ${jadwal.ashar}\n` +
      `🌆 *Maghrib:* ${jadwal.maghrib}\n` +
      `🌃 *Isya:* ${jadwal.isya}`;

    bot.sendMessage(chatId, sholatMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal mengambil data jadwal sholat.`, { parse_mode: 'Markdown' });
  }
});

// Cron Job: Pengecekan Waktu Sholat Setiap Menit
cron.schedule('* * * * *', async () => {
  const users = db.prepare('SELECT * FROM users').all();
  if (users.length === 0) return;

  const now = new Date();
  const options = { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit' };
  const currentTime = now.toLocaleTimeString('id-ID', options).replace('.', ':');

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  for (const user of users) {
    try {
      const jadwalUrl = `https://api.myquran.com/v2/sholat/jadwal/${user.kota_id}/${yyyy}/${mm}/${dd}`;
      const jadwalRes = await axios.get(jadwalUrl);
      const jadwal = jadwalRes.data.data.jadwal;

      const waktuSholatList = {
        'Subuh': jadwal.subuh,
        'Dzuhur': jadwal.dzuhur,
        'Ashar': jadwal.ashar,
        'Maghrib': jadwal.maghrib,
        'Isya': jadwal.isya
      };

      for (const [namaWaktu, jam] of Object.entries(waktuSholatList)) {
        if (currentTime === jam) {
          bot.sendMessage(
            user.chat_id,
            `🕌 *WAKTU SHOLAT TIBI!*\n\n` +
            `Telah masuk waktu *${namaWaktu}* (${jam} WIB) untuk wilayah *${user.nama_kota}* dan sekitarnya.\n` +
            `Mari sejenak menunaikan ibadah sholat. 🙏`,
            { parse_mode: 'Markdown' }
          );
        }
      }
    } catch (err) {
      console.error(`Gagal mengecek jadwal sholat user ${user.chat_id}:`, err.message);
    }
  }
});

// ==========================================
// 2. FITUR AUTO-TRACKING RESI
// ==========================================

// Cek Resi Sekali
bot.onText(/\/resi (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const params = match[1].split(' ');

  if (params.length < 2) {
    return bot.sendMessage(chatId, '❌ *Format salah!*\nGunakan: `/resi <kurir> <no_resi>`', { parse_mode: 'Markdown' });
  }

  const courier = params[0].toLowerCase();
  const awb = params[1];

  bot.sendMessage(chatId, '⏳ Sedang mengecek resi...');

  try {
    const url = `https://api.binderbyte.com/v1/track?api_key=${BINDERBYTE_KEY}&courier=${courier}&awb=${awb}`;
    const response = await axios.get(url);
    const data = response.data;

    if (data.status === 200) {
      const summary = data.data.summary;
      const history = data.data.history;
      const latestStatus = history.length > 0 ? history[0] : null;

      let resiMessage = `📦 *HASIL CEK RESI*\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🔹 *Kurir:* ${summary.courier.toUpperCase()}\n` +
        `🔹 *No Resi:* \`${summary.awb}\`\n` +
        `🔹 *Status:* *${summary.status}*\n\n` +
        `📌 *Lacak Terakhir:* ${latestStatus ? latestStatus.date : '-'}\n` +
        `📝 *Keterangan:* ${latestStatus ? latestStatus.desc : '-'}`;

      bot.sendMessage(chatId, resiMessage, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `❌ Resi tidak ditemukan: ${data.message}`);
    }
  } catch (error) {
    bot.sendMessage(chatId, `❌ *Gagal Cek Resi.*`, { parse_mode: 'Markdown' });
  }
});

// Tambah Resi Ke Auto-Track
bot.onText(/\/track (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const params = match[1].split(' ');

  if (params.length < 2) {
    return bot.sendMessage(chatId, '❌ *Format salah!*\nGunakan: `/track <kurir> <no_resi>`\nContoh: `/track jne 1234567890`', { parse_mode: 'Markdown' });
  }

  const courier = params[0].toLowerCase();
  const awb = params[1];

  bot.sendMessage(chatId, '⏳ Memverifikasi resi...');

  try {
    const url = `https://api.binderbyte.com/v1/track?api_key=${BINDERBYTE_KEY}&courier=${courier}&awb=${awb}`;
    const response = await axios.get(url);
    const data = response.data;

    if (data.status === 200) {
      const history = data.data.history;
      const lastDesc = history.length > 0 ? history[0].desc : 'Belum ada status';
      const isDelivered = data.data.summary.status.toLowerCase().includes('delivered') ? 1 : 0;

      const stmt = db.prepare('INSERT OR REPLACE INTO tracked_resi (chat_id, courier, awb, last_status, is_delivered) VALUES (?, ?, ?, ?, ?)');
      stmt.run(chatId.toString(), courier, awb, lastDesc, isDelivered);

      if (isDelivered) {
        bot.sendMessage(chatId, `📦 Resi \`${awb}\` sudah berketerangan *DELIVERED/TERIMA*. Auto-track tidak diaktifkan.`, { parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(chatId, `✅ *Berhasil menambahkan resi \`${awb}\` ke Auto-Track!*\nBot akan memberikan notifikasi pesan jika ada update pergerakan paket.`, { parse_mode: 'Markdown' });
      }
    } else {
      bot.sendMessage(chatId, `❌ Resi tidak valid: ${data.message}`);
    }
  } catch (error) {
    bot.sendMessage(chatId, `❌ Gagal memverifikasi resi.`, { parse_mode: 'Markdown' });
  }
});

// Lihat daftar resi milik user
bot.onText(/\/myresi/, (msg) => {
  const chatId = msg.chat.id;
  const resis = db.prepare('SELECT * FROM tracked_resi WHERE chat_id = ? AND is_delivered = 0').all(chatId.toString());

  if (resis.length === 0) {
    return bot.sendMessage(chatId, '📭 Kamu tidak memiliki resi yang sedang di-track secara aktif.');
  }

  let text = '📋 *DAFTAR AUTO-TRACK RESI AKTIF:*\n━━━━━━━━━━━━━━━━━━\n';
  resis.forEach((r, idx) => {
    text += `${idx + 1}. *${r.courier.toUpperCase()}* - \`${r.awb}\`\n Status Terakhir: _${r.last_status}_\n\n`;
  });

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// Hapus resi dari tracking
bot.onText(/\/untrack (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const awb = match[1].trim();

  const stmt = db.prepare('DELETE FROM tracked_resi WHERE chat_id = ? AND awb = ?');
  const result = stmt.run(chatId.toString(), awb);

  if (result.changes > 0) {
    bot.sendMessage(chatId, `✅ Resi \`${awb}\` berhasil dihapus dari daftar Auto-Track.`, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(chatId, `❌ Resi \`${awb}\` tidak ditemukan dalam daftar kamu.`, { parse_mode: 'Markdown' });
  }
});

// Cron Job: Pengecekan Update Resi Otomatis Setiap 30 Menit
cron.schedule('*/30 * * * *', async () => {
  const resiList = db.prepare('SELECT * FROM tracked_resi WHERE is_delivered = 0').all();
  if (resiList.length === 0) return;

  for (const item of resiList) {
    try {
      const url = `https://api.binderbyte.com/v1/track?api_key=${BINDERBYTE_KEY}&courier=${item.courier}&awb=${item.awb}`;
      const response = await axios.get(url);
      const data = response.data;

      if (data.status === 200) {
        const summary = data.data.summary;
        const history = data.data.history;
        const latestHistory = history.length > 0 ? history[0] : null;

        if (latestHistory && latestHistory.desc !== item.last_status) {
          const isDelivered = summary.status.toLowerCase().includes('delivered') ? 1 : 0;

          // Update DB
          db.prepare('UPDATE tracked_resi SET last_status = ?, is_delivered = ? WHERE id = ?')
            .run(latestHistory.desc, isDelivered, item.id);

          // Kirim Notifikasi
          let notifMsg = `🚚 *UPDATE PERGERAKAN PAKET!*\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `🔹 *Kurir:* ${summary.courier.toUpperCase()}\n` +
            `🔹 *No Resi:* \`${summary.awb}\`\n` +
            `🔹 *Status:* *${summary.status}*\n\n` +
            `📌 *Waktu:* ${latestHistory.date}\n` +
            `📝 *Keterangan Baru:* ${latestHistory.desc}`;

          if (isDelivered) {
            notifMsg += `\n\n🎉 *Paket telah sampai/diterima! Auto-tracking dikentikan.*`;
          }

          bot.sendMessage(item.chat_id, notifMsg, { parse_mode: 'Markdown' });
        }
      }
    } catch (err) {
      console.error(`Gagal mengecek update resi ${item.awb}:`, err.message);
    }
  }
});

// ==========================================
// 3. FITUR CEK CUACA
// ==========================================

bot.onText(/\/cuaca (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const city = match[1];

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_KEY}&units=metric&lang=id`;
    const response = await axios.get(url);
    const data = response.data;

    const weatherMessage = `🌤 *INFORMASI CUACA*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📍 *Kota:* ${data.name}, ${data.sys.country}\n` +
      `🌡 *Suhu:* ${data.main.temp}°C (Terasa seperti ${data.main.feels_like}°C)\n` +
      `☁️ *Cuaca:* ${data.weather[0].description.toUpperCase()}\n` +
      `💧 *Kelembapan:* ${data.main.humidity}%\n` +
      `💨 *Kecepatan Angin:* ${data.wind.speed} m/s`;

    bot.sendMessage(chatId, weatherMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ *Kota "${city}" tidak ditemukan.*`, { parse_mode: 'Markdown' });
  }
});
