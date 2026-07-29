const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPENWEATHER_KEY = process.env.OPENWEATHER_API_KEY;
const BINDERBYTE_KEY = process.env.BINDERBYTE_API_KEY;

// Inisialisasi bot TANPA polling (untuk Vercel Webhook)
const bot = new TelegramBot(TOKEN);

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

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      const update = req.body;

      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text || '';
        const name = update.message.from.first_name || 'User';

        // 1. Command /start
        if (text.startsWith('/start')) {
          await bot.sendMessage(
            chatId, 
            `Halo *${name}*! 👋\n\nSelamat datang di *@jagosemuanya_bot*.\nSilakan gunakan tombol menu di bawah atau ketik perintah secara manual:`, 
            { parse_mode: 'Markdown', ...menuKeyboard }
          );
        }
        // 2. Tombol Bantuan
        else if (text.includes('❓ Bantuan')) {
          const helpText = `ℹ️ *PANDUAN PENGGUNAAN BOT*\n\n` +
            `1️⃣ *Cek Cuaca*\nKetik: \`/cuaca <nama_kota>\`\nContoh: \`/cuaca Jakarta\`\n\n` +
            `2️⃣ *Jadwal Sholat*\nKetik: \`/sholat <nama_kota>\`\nContoh: \`/sholat Surabaya\`\n\n` +
            `3️⃣ *Cek Resi*\nKetik: \`/resi <kurir> <no_resi>\`\nContoh: \`/resi jne 1234567890\``;
          await bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
        }
        // 3. Trigger Tombol Menu
        else if (text.includes('🌤 Cek Cuaca')) {
          await bot.sendMessage(chatId, 'Silakan ketik nama kota dengan format:\n`/cuaca <nama_kota>`\n\nContoh: `/cuaca Bandung`', { parse_mode: 'Markdown' });
        }
        else if (text.includes('🕌 Jadwal Sholat')) {
          await bot.sendMessage(chatId, 'Silakan ketik nama kota dengan format:\n`/sholat <nama_kota>`\n\nContoh: `/sholat Yogyakarta`', { parse_mode: 'Markdown' });
        }
        else if (text.includes('📦 Cek Resi')) {
          await bot.sendMessage(chatId, 'Silakan ketik dengan format:\n`/resi <kurir> <no_resi>`\n\nContoh: `/resi jne 0123456789`', { parse_mode: 'Markdown' });
        }
        // 4. Fitur Cek Resi
        else if (text.startsWith('/resi')) {
          const params = text.replace('/resi', '').trim().split(' ');
          if (params.length < 2) {
            await bot.sendMessage(chatId, '❌ *Format salah!*\nGunakan: `/resi <kurir> <no_resi>`\nContoh: `/resi jne 1234567890`', { parse_mode: 'Markdown' });
          } else {
            const courier = params[0].toLowerCase();
            const awb = params[1];
            await bot.sendMessage(chatId, '⏳ Sedang mengecek resi...');
            
            try {
              const url = `https://api.binderbyte.com/v1/track?api_key=${BINDERBYTE_KEY}&courier=${courier}&awb=${awb}`;
              const response = await axios.get(url);
              const data = response.data;

              if (data.status === 200) {
                const summary = data.data.summary;
                const history = data.data.history;
                const latestStatus = history.length > 0 ? history[0] : null;

                let resiMsg = `📦 *HASIL CEK RESI*\n━━━━━━━━━━━━━━━━━━\n` +
                  `🔹 *Kurir:* ${summary.courier.toUpperCase()}\n` +
                  `🔹 *No Resi:* \`${summary.awb}\`\n` +
                  `🔹 *Pengirim:* ${summary.origin || '-'}\n` +
                  `🔹 *Penerima:* ${summary.destination || '-'}\n` +
                  `🔹 *Status:* *${summary.status}*\n\n` +
                  `📌 *Lacak Terakhir:* ${latestStatus ? latestStatus.date : '-'}\n` +
                  `📝 *Keterangan:* ${latestStatus ? latestStatus.desc : '-'}`;
                await bot.sendMessage(chatId, resiMsg, { parse_mode: 'Markdown' });
              } else {
                await bot.sendMessage(chatId, `❌ Resi tidak ditemukan: ${data.message}`);
              }
            } catch (e) {
              await bot.sendMessage(chatId, `❌ *Gagal Cek Resi.* Periksa kembali nama kurir dan nomor resi.`);
            }
          }
        }
        // 5. Fitur Cek Cuaca
        else if (text.startsWith('/cuaca')) {
          const city = text.replace('/cuaca', '').trim();
          if (!city) {
            await bot.sendMessage(chatId, '❌ Masukkan nama kota! Contoh: `/cuaca Bandung`', { parse_mode: 'Markdown' });
          } else {
            try {
              const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${OPENWEATHER_KEY}&units=metric&lang=id`;
              const response = await axios.get(url);
              const data = response.data;

              let weatherMsg = `🌤 *INFORMASI CUACA*\n━━━━━━━━━━━━━━━━━━\n` +
                `📍 *Kota:* ${data.name}, ${data.sys.country}\n` +
                `🌡 *Suhu:* ${data.main.temp}°C (Terasa ${data.main.feels_like}°C)\n` +
                `☁️ *Kondisi:* ${data.weather[0].description.toUpperCase()}\n` +
                `💧 *Kelembapan:* ${data.main.humidity}%`;
              await bot.sendMessage(chatId, weatherMsg, { parse_mode: 'Markdown' });
            } catch (e) {
              await bot.sendMessage(chatId, `❌ *Kota "${city}" tidak ditemukan.* Periksa kembali penulisan nama kota.`);
            }
          }
        }
        // 6. Fitur Jadwal Sholat
        else if (text.startsWith('/sholat')) {
          const city = text.replace('/sholat', '').trim();
          if (!city) {
            await bot.sendMessage(chatId, '❌ Masukkan nama kota! Contoh: `/sholat Surabaya`', { parse_mode: 'Markdown' });
          } else {
            try {
              const searchUrl = `https://api.myquran.com/v2/sholat/kota/cari/${encodeURIComponent(city)}`;
              const searchRes = await axios.get(searchUrl);

              if (!searchRes.data.status || searchRes.data.data.length === 0) {
                await bot.sendMessage(chatId, `❌ *Kota "${city}" tidak ditemukan.*`);
              } else {
                const kotaId = searchRes.data.data[0].id;
                const namaKota = searchRes.data.data[0].lokasi;

                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');

                const jadwalUrl = `https://api.myquran.com/v2/sholat/jadwal/${kotaId}/${yyyy}/${mm}/${dd}`;
                const jadwalRes = await axios.get(jadwalUrl);
                const jadwal = jadwalRes.data.data.jadwal;

                let sholatMsg = `🕌 *JADWAL SHOLAT HARI INI*\n` +
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
                  `🌃 *Isya:* ${jadwal.Isya || jadwal.isya}`;
                await bot.sendMessage(chatId, sholatMsg, { parse_mode: 'Markdown' });
              }
            } catch (e) {
              await bot.sendMessage(chatId, `❌ Gagal mengambil data jadwal sholat.`);
            }
          }
        }
      }

      return res.status(200).send('OK');
    } catch (error) {
      console.error(error);
      return res.status(500).send('Error');
    }
  } else {
    return res.status(200).send('Vercel Bot is running smoothly!');
  }
};
