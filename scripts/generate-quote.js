/**
 * generate-quote.js
 * Ambil ayat dari API SABDA, lalu render ke gambar PNG 1080x1920
 * pakai node-canvas + font Poppins (didownload otomatis).
 */

const { createCanvas, registerFont } = require('canvas');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Paths ────────────────────────────────────────────────────────────────────
const OUTPUT_DIR = path.join(__dirname, '..', 'vod-image');
const FONT_DIR   = path.join(__dirname, '..', 'fonts');
const FONT_LIGHT = path.join(FONT_DIR, 'Poppins-Light.ttf');
const FONT_SEMI  = path.join(FONT_DIR, 'Poppins-SemiBold.ttf');
const FONT_BOLD  = path.join(FONT_DIR, 'Poppins-Bold.ttf');

// ─── Google Fonts URL ─────────────────────────────────────────────────────────
const FONT_URLS = {
  light:    'https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLDz8Z1xlFQ.woff2',
  semibold: 'https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLGT9Z1xlFQ.woff2',
  bold:     'https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLCz7Z1xlFQ.woff2',
};

// Poppins tersedia lewat npm package juga — kita pakai TTF langsung dari sini
const FONT_TTF_URLS = {
  light:    'https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Light.ttf',
  semibold: 'https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-SemiBold.ttf',
  bold:     'https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) return resolve();
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/^"|"$/g, '').replace(/\\"/g, '"').trim();
}

// ─── Ayat fallback jika API SABDA tidak bisa diakses ─────────────────────────
const FALLBACK_VERSES = [
  { passage: 'Yoh 3:16',  text: 'Karena begitu besar kasih Allah akan dunia ini, sehingga Ia telah mengaruniakan Anak-Nya yang tunggal, supaya setiap orang yang percaya kepada-Nya tidak binasa, melainkan beroleh hidup yang kekal.' },
  { passage: 'Fil 4:13',  text: 'Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku.' },
  { passage: 'Yer 29:11', text: 'Sebab Aku ini mengetahui rancangan-rancangan apa yang ada pada-Ku mengenai kamu, demikianlah firman TUHAN, yaitu rancangan damai sejahtera dan bukan rancangan kecelakaan, untuk memberikan kepadamu hari depan yang penuh harapan.' },
  { passage: 'Mat 6:33',  text: 'Tetapi carilah dahulu Kerajaan Allah dan kebenarannya, maka semuanya itu akan ditambahkan kepadamu.' },
  { passage: 'Mzm 23:1',  text: 'TUHAN adalah gembalaku, takkan kekurangan aku.' },
  { passage: 'Ams 3:5-6', text: 'Percayalah kepada TUHAN dengan segenap hatimu, dan janganlah bersandar kepada pengertianmu sendiri. Akuilah Dia dalam segala lakumu, maka Ia akan meluruskan jalanmu.' },
  { passage: 'Yes 40:31', text: 'Tetapi orang-orang yang menanti-nantikan TUHAN mendapat kekuatan baru: mereka seumpama rajawali yang naik terbang dengan kekuatan sayapnya; mereka berlari dan tidak menjadi lesu, mereka berjalan dan tidak menjadi lelah.' },
  { passage: 'Rm 8:28',   text: 'Kita tahu sekarang, bahwa Allah turut bekerja dalam segala sesuatu untuk mendatangkan kebaikan bagi mereka yang mengasihi Dia, yaitu bagi mereka yang terpanggil sesuai dengan rencana Allah.' },
  { passage: 'Gal 2:20',  text: 'Namun aku hidup, tetapi bukan lagi aku sendiri yang hidup, melainkan Kristus yang hidup di dalam aku.' },
  { passage: 'Ibr 11:1',  text: 'Iman adalah dasar dari segala sesuatu yang kita harapkan dan bukti dari segala sesuatu yang tidak kita lihat.' },
];

function getFallbackVerse() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const verse = FALLBACK_VERSES[dayOfYear % FALLBACK_VERSES.length];
  console.log(`  Fallback: ${verse.passage}`);
  return { html: { passage: verse.passage, text: verse.text } };
}

// ─── Fetch Verse dengan retry ─────────────────────────────────────────────────
async function fetchVerse() {
  const endpoints = [
    'https://alkitab.sabda.org/api/vod.php?format=json',
    'https://alkitab.sabda.org/api/vod.php?format=jsonp',
  ];

  for (let attempt = 1; attempt <= 3; attempt++) {
    for (const url of endpoints) {
      try {
        console.log(`  Percobaan ${attempt}/3 → ${url}`);
        const res = await axios.get(url, {
          timeout: 30000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; sukalogika-bot/1.0)' },
        });

        // Kalau JSONP, strip wrapper
        if (typeof res.data === 'string') {
          const match = res.data.match(/^\w+\((.+)\)\s*;?\s*$/s);
          if (match) return JSON.parse(match[1]);
        }

        if (res.data && (res.data.html || res.data.text)) return res.data;
        console.log(`  Respons tidak valid, coba endpoint lain...`);
      } catch (err) {
        console.log(`  Gagal: ${err.message}`);
      }
    }

    if (attempt < 3) {
      console.log(`  Tunggu 5 detik sebelum retry...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Semua percobaan gagal — pakai fallback
  console.log('⚠️  API SABDA tidak dapat dijangkau. Menggunakan ayat fallback...');
  return getFallbackVerse();
}

// ─── Generate Image ───────────────────────────────────────────────────────────
function generateImage(verseData) {
  const W = 1080, H = 1920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background hitam
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  const html = verseData.html || verseData;
  let rawText  = html.text     || '';
  let passage  = html.passage  || html.abbr ? `${html.abbr} ${html.chapter}:${html.verse}` : 'Alkitab';
  let verseText = cleanText(rawText) || 'Kamu adalah garam dunia... (Matius 5:13)';

  const MARGIN  = 100;
  const MAX_W   = W - MARGIN * 2;

  // ── Big quote mark ──
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 200px "Poppins"';
  ctx.fillText('\u201C', 80, 250);

  // ── Passage (judul) ──
  ctx.font = '600 55px "Poppins"';
  const titleLines = wrapText(ctx, passage, MAX_W);
  let y = 420;
  for (const line of titleLines) {
    ctx.fillText(line, MARGIN, y);
    y += 75;
  }

  // ── Verse text ──
  ctx.font = '300 46px "Poppins"';
  y += 30;
  const contentLines = wrapText(ctx, verseText, MAX_W);
  for (const line of contentLines) {
    ctx.fillText(line, MARGIN, y);
    y += 70;
  }

  // ── Watermark ──
  ctx.font = '300 34px "Poppins"';
  ctx.fillStyle = '#888888';
  ctx.fillText('@sukalogika', MARGIN, 1820);

  return { canvas, passage };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📂 Menyiapkan folder...');
  ensureDir(OUTPUT_DIR);
  ensureDir(FONT_DIR);

  console.log('🔤 Mengunduh font Poppins...');
  await Promise.all([
    downloadFile(FONT_TTF_URLS.light,    FONT_LIGHT),
    downloadFile(FONT_TTF_URLS.semibold, FONT_SEMI),
    downloadFile(FONT_TTF_URLS.bold,     FONT_BOLD),
  ]);

  registerFont(FONT_LIGHT, { family: 'Poppins', weight: '300' });
  registerFont(FONT_SEMI,  { family: 'Poppins', weight: '600' });
  registerFont(FONT_BOLD,  { family: 'Poppins', weight: '700', style: 'bold' });

  console.log('📡 Mengambil ayat dari API SABDA...');
  const verseData = await fetchVerse();
  console.log('Data diterima:', JSON.stringify(verseData).slice(0, 200));

  console.log('🎨 Membuat gambar...');
  const { canvas, passage } = generateImage(verseData);

  const safeTitle = passage.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const today     = new Date().toISOString().slice(0, 10);
  const filename  = `vod_${today}_${safeTitle}.png`;
  const outPath   = path.join(OUTPUT_DIR, filename);

  // Juga simpan sebagai "latest.png" biar mudah dirujuk di workflow berikutnya
  const latestPath = path.join(OUTPUT_DIR, 'latest.png');

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  fs.writeFileSync(latestPath, buffer);

  // Simpan metadata (untuk workflow ffmpeg)
  const meta = {
    filename,
    passage,
    date: today,
    text: (verseData.html || verseData).text || '',
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'latest-meta.json'), JSON.stringify(meta, null, 2));

  console.log(`✅ Gambar disimpan: ${outPath}`);
  console.log(`✅ Latest: ${latestPath}`);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
