const { createCanvas } = require('canvas');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Background patterns (sama persis kayak HTML lo)
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
  {
    name: 'Fine Grid',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      const step = 50;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
    }
  },
  {
    name: 'Crosshatch',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#040404';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      const gap = 30;
      for (let i = -h; i < w + h; i += gap) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + h, 0); ctx.stroke();
      }
    }
  },
  {
    name: 'Noise Scatter',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#030303';
      ctx.fillRect(0, 0, w, h);
      const count = 700;
      for (let i = 0; i < count; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = Math.random() * 2.5 + 0.5;
        const a = Math.random() * 0.14 + 0.03;
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
];

function getRandomPattern() {
  const idx = Math.floor(Math.random() * backgroundPatterns.length);
  return backgroundPatterns[idx];
}

function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine + word + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine.trim());
  return lines;
}

function cleanText(text) {
  if (!text) return '';
  let cleaned = text.replace(/^"|"$/g, '');
  cleaned = cleaned.replace(/\\"/g, '"');
  return cleaned.trim();
}

function getFormattedDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return {
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    fullDate: `${year}-${month}-${day}`,
    timestamp: `${year}${month}${day}_${hours}${minutes}${seconds}`
  };
}

async function fetchVerseData() {
  try {
    console.log('  → Mencoba mengambil dari API SABDA...');
    const response = await axios.get('https://alkitab.sabda.org/api/vod.php?format=json', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GitHubAction/1.0)'
      }
    });
    
    if (response.data && response.data.html && response.data.html.text) {
      console.log('  ✓ Berhasil mengambil dari API');
      return response.data;
    }
    throw new Error('Data tidak lengkap');
  } catch (error) {
    console.log('  → API gagal, menggunakan data sampel...');
    // Data sampel kalo API mati
    return {
      html: {
        text: "Janganlah hendaknya kamu kuatir tentang apapun juga, tetapi nyatakanlah dalam segala hal keinginanmu kepada Allah dalam doa dan permohonan dengan ucapan syukur.",
        passage: "Filipi 4:6",
        abbr: "Flp",
        chapter: "4",
        verse: "6"
      }
    };
  }
}

async function generateImage() {
  console.log('\n🚀 START GENERATING IMAGE...\n');
  
  // Ambil data ayat
  console.log('📡 Step 1: Fetching verse data');
  const verseData = await fetchVerseData();
  
  let rawText = verseData.html?.text || '';
  let passage = verseData.html?.passage || 'Alkitab';
  let cleanVerseText = cleanText(rawText);
  let titleText = passage;
  
  // Fallback terakhir
  if (!cleanVerseText) {
    cleanVerseText = "Tetapi buah Roh ialah: kasih, sukacita, damai sejahtera, kesabaran, kemurahan, kebaikan, kesetiaan.";
    titleText = "Galatia 5:22";
  }
  
  console.log(`  ✓ Ayat: ${titleText}`);
  console.log(`  ✓ Teks: ${cleanVerseText.substring(0, 50)}...`);
  
  // Buat canvas
  console.log('\n🎨 Step 2: Creating canvas (1080x1920)');
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext('2d');
  
  // Pilih pattern random
  const pattern = getRandomPattern();
  console.log(`  ✓ Pattern: ${pattern.name}`);
  
  // Draw background pattern
  console.log('  → Drawing background pattern...');
  pattern.draw(ctx, canvas.width, canvas.height);
  
  // Vignette effect
  const vignette = ctx.createRadialGradient(540, 960, 200, 540, 960, 1100);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Big quote mark
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 200px "Segoe UI", Arial, sans-serif';
  ctx.fillText('"', 80, 250);
  
  // Title / passage
  console.log('  → Drawing title...');
  ctx.font = 'bold 55px "Segoe UI", Arial, sans-serif';
  let yPos = 420;
  let titleLines = wrapText(ctx, titleText, 880);
  for (const line of titleLines) {
    ctx.fillText(line, 100, yPos);
    yPos += 75;
  }
  
  // Verse content
  console.log('  → Drawing verse text...');
  ctx.font = '46px "Segoe UI", Arial, sans-serif';
  const contentLines = wrapText(ctx, cleanVerseText, 880);
  yPos += 50;
  for (const line of contentLines) {
    ctx.fillText(line, 100, yPos);
    yPos += 70;
  }
  
  // Watermark
  ctx.font = '34px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#888888';
  ctx.fillText('@sukalogika', 100, 1820);
  
// Step 3: Saving image
console.log('\n💾 Step 3: Saving image');
const buffer = canvas.toBuffer('image/png');

const date = getFormattedDate();
const yearStr = String(date.year);
const monthStr = String(date.month).padStart(2, '0');
const dayStr = String(date.day).padStart(2, '0');

// Folder: vod-image/2026/06/
const dirPath = path.join(__dirname, '../vod-image', yearStr, monthStr);

// Buat folder kalau belum ada
if (!fs.existsSync(dirPath)) {
  fs.mkdirSync(dirPath, { recursive: true });
  console.log(`  → Created directory: ${dirPath}`);
}

// Nama file berdasarkan TANGGAL (bukan nomor urut)
const filename = `vod-${dayStr}.png`;  // vod-13.png, vod-14.png, dst
const filePath = path.join(dirPath, filename);

// Kalau sudah ada, bakal KETIMPA (tapi karena lo run sekali sehari, gak masalah)
fs.writeFileSync(filePath, buffer);

console.log('\n✅ SUCCESS!');
console.log(`📁 Location: ${dirPath}`);
console.log(`📄 Filename: ${filename}`);
console.log(`🎨 Pattern: ${pattern.name}`);
console.log(`📅 Date: ${date.fullDate} ${date.hours}:${date.minutes}:${date.seconds}\n`);

// Eksekusi
generateImage().catch(error => {
  console.error('\n❌ ERROR:', error.message);
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
});
