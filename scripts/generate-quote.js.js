const { createCanvas, registerFont } = require('canvas');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// (Opsional) Daftarkan font Poppins jika ada file .ttf di repo
// registerFont(path.join(__dirname, '../fonts/Poppins-Regular.ttf'), { family: 'Poppins' });
// registerFont(path.join(__dirname, '../fonts/Poppins-Bold.ttf'), { family: 'Poppins', weight: 'bold' });

// Fallback font jika Poppins tidak tersedia
const FONT_TITLE = 'bold 55px "Segoe UI", "Poppins", "Arial"';
const FONT_QUOTE = '46px "Segoe UI", "Poppins", "Arial"';
const FONT_WATERMARK = '34px "Segoe UI", "Poppins", "Arial"';

// Background pattern definitions (sama seperti di HTML)
const backgroundPatterns = [
  {
    name: 'Dot Grid',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      const spacing = 40;
      for (let x = 0; x < w; x += spacing) {
        for (let y = 0; y < h; y += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  },
  {
    name: 'Diagonal Lines',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let i = -h; i < w + h; i += 24) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + h, h);
        ctx.stroke();
      }
    }
  },
  // Tambahkan pattern lainnya dari kode HTML jika diinginkan
];

function getRandomPattern() {
  const idx = Math.floor(Math.random() * backgroundPatterns.length);
  return backgroundPatterns[idx];
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  for (let word of words) {
    const testLine = currentLine + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines;
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/^"|"$/g, '').replace(/\\"/g, '"').trim();
}

async function fetchVerseData() {
  const url = 'https://alkitab.sabda.org/api/vod.php?format=json';
  // API SABDA mungkin perlu header tertentu, gunakan axios langsung (bukan JSONP)
  const response = await axios.get(url, {
    headers: { 'Accept': 'application/json' }
  });
  // Data mungkin dalam bentuk JSON yang berbeda, sesuaikan
  // Contoh response dari API SABDA biasanya: { html: { text, passage, abbr, chapter, verse } }
  return response.data;
}

async function generateImage() {
  try {
    console.log('📡 Mengambil ayat dari API SABDA...');
    const verseData = await fetchVerseData();
    
    let rawText = verseData.html?.text || '';
    let passage = verseData.html?.passage || 'Alkitab';
    let bookAbbr = verseData.html?.abbr || '';
    let chapter = verseData.html?.chapter || '';
    let verse = verseData.html?.verse || '';

    let cleanVerseText = cleanText(rawText);
    let titleText = passage || `${bookAbbr} ${chapter}:${verse}`;
    if (!cleanVerseText) cleanVerseText = "Kamu adalah garam dunia... (Matius 5:13)";

    // Buat canvas 1080x1920
    const canvas = createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');

    // 1. Background pattern acak
    const pattern = getRandomPattern();
    pattern.draw(ctx, canvas.width, canvas.height);

    // 2. Vignette
    const vignette = ctx.createRadialGradient(540, 960, 200, 540, 960, 1100);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Tanda petik besar
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 200px "Segoe UI", "Poppins", "Arial"';
    ctx.fillText('\u201C', 80, 250);

    // 4. Title (passage)
    ctx.font = FONT_TITLE;
    let yPos = 420;
    let titleLines = wrapText(ctx, titleText, 880);
    for (let line of titleLines) {
      ctx.fillText(line, 100, yPos);
      yPos += 75;
    }

    // 5. Teks ayat
    ctx.font = FONT_QUOTE;
    const contentLines = wrapText(ctx, cleanVerseText, 880);
    yPos += 50;
    for (let line of contentLines) {
      ctx.fillText(line, 100, yPos);
      yPos += 70;
    }

    // 6. Watermark
    ctx.font = FONT_WATERMARK;
    ctx.fillStyle = '#888888';
    ctx.fillText('@sukalogika', 100, 1820);

    // Simpan sebagai PNG
    const buffer = canvas.toBuffer('image/png');
    const outputDir = path.join(__dirname, '../generated-images');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const filename = `alkitab_quote_${Date.now()}_${pattern.name.replace(/\s/g, '_')}.png`;
    const filePath = path.join(outputDir, filename);
    fs.writeFileSync(filePath, buffer);
    console.log(`✅ Gambar berhasil disimpan: ${filePath}`);
  } catch (error) {
    console.error('❌ Gagal membuat gambar:', error.message);
    process.exit(1);
  }
}

generateImage();