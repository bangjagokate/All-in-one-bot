require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Config Environment
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY;
const BINDERBYTE_KEY = process.env.BINDERBYTE_API_KEY;

const bot = new TelegramBot(TOKEN, { polling: true });

console.log('Bot @jagosemuanya_bot berhasil berjalan dengan Menu Interaktif!');

// Tombol Menu Utama (Reply Keyboard)
const menuKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '🌤 Cek Cuaca' }, { text: '🕌 Jadwal Sholat' }],
      [{ text: '📦 Cek Resi' }, { text: '❓ Bantuan' }]
    ],
    resize_keyboard: true,
    persist_keyboard: true
  }
};

// Command /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const text = `Halo *${msg.from.first_name}*! 👋\n\nSelamat datang di *@jagosemuanya_bot*.\n` +
    `Silakan gunakan tombol menu di bawah atau ketik perintah secara manual:`;

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...menuKeyboard });
});

// Tombol Bantuan / Menu
bot.onText(/❓ Bantuan/, (msg) => {
  const chatId = msg.chat.id;
  const text = `ℹ️ *PANDUAN PENGGUNAAN BOT*\n\n` +
    `1️⃣ *Cek Cuaca*\nKetik: \`/cuaca <nama_kota>\`\nContoh: \`/cuaca Jakarta\`\n\n` +
    `2️⃣ *Jadwal Sholat*\nKetik: \`/sholat <nama_kota>\`\nContoh: \`/sholat Surabaya\`\n\n` +
    `3️⃣ *Cek Resi*\nKetik: \`/resi <kurir> <no_resi>\`\nContoh: \`/resi jne 1234567890\`\n*(Pilihan kurir: jne, jnt, sicepat, pos, tiki, wahana, dll)*`;

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
});

// Trigger dari Tombol Menu Utama
bot.onText(/🌤 Cek Cuaca/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Silakan ketik nama kota dengan format:\n`/cuaca <nama_kota>`\n\nContoh: `/cuaca Bandung`', { parse_mode: 'Markdown' });
});

bot.onText(/🕌 Jadwal Sholat/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Silakan ketik nama kota dengan format:\n`/sholat <nama_kota>`\n\nContoh: `/sholat Yogyakarta`', { parse_mode: 'Markdown' });
});

bot.onText(/📦 Cek Resi/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Silakan ketik dengan format:\n`/resi <kurir> <no_resi>`\n\nContoh: `/resi jne 0123456789`', { parse_mode: 'Markdown' });
});

// ==========================================
// FITUR UTAMA
// ==========================================

// 1. Cek Resi (Binderbyte API)
bot.onText(/\/resi (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const params = match[1].split(' ');

  if (params.length < 2) {
    return bot.sendMessage(chatId, '❌ *Format salah!*\nGunakan: `/resi <kurir> <no_resi>`\nContoh: `/resi jne 1234567890`', { parse_mode: 'Markdown' });
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
        `🔹 *Pengirim:* ${summary.origin || '-'}\n` +
        `🔹 *Penerima:* ${summary.destination || '-'}\n` +
        `🔹 *Status:* *${summary.status}*\n\n` +
        `📌 *Lacak Terakhir:* ${latestStatus ? latestStatus.date : '-'}\n` +
        `📝 *Keterangan:* ${latestStatus ? latestStatus.desc : '-'}`;

      bot.sendMessage(chatId, resiMessage, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `❌ Resi tidak ditemukan: ${data.message}`);
    }
  } catch (error) {
    bot.sendMessage(chatId, `❌ *Gagal Cek Resi.* Periksa kembali nama kurir dan nomor resi.`, { parse_mode: 'Markdown' });
  }
});

// 2. Cek Cuaca (OpenWeatherMap API)
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
    bot.sendMessage(chatId, `❌ *Kota "${city}" tidak ditemukan.* Mohon periksa kembali penulisan nama kota.`, { parse_mode: 'Markdown' });
  }
});

// 3. Jadwal Sholat (MyQuran API)
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
