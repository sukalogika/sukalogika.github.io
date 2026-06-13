// scripts/generate-quote.js
const { createCanvas } = require('canvas');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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
  return { year, month, day, fullDate: `${year}-${month}-${day}` };
}

async function fetchVerseData() {
  try {
    const response = await axios.get('https://alkitab.sabda.org/api/vod.php?format=json', {
      timeout: 10000
    });
    if (response.data && response.data.html && response.data.html.text) {
      return response.data;
    }
    throw new Error('Data tidak lengkap');
  } catch (error) {
    return {
      html: {
        text: "Janganlah hendaknya kamu kuatir tentang apapun juga, tetapi nyatakanlah dalam segala hal keinginanmu kepada Allah dalam doa dan permohonan dengan ucapan syukur.",
        passage: "Filipi 4:6"
      }
    };
  }
}

async function generateImage() {
  console.log('\n🚀 GENERATE IMAGE...\n');
  
  const verseData = await fetchVerseData();
  let rawText = verseData.html?.text || '';
  let passage = verseData.html?.passage || 'Alkitab';
  let cleanVerseText = cleanText(rawText);
  let titleText = passage;
  
  if (!cleanVerseText) {
    cleanVerseText = "Tetapi buah Roh ialah: kasih, sukacita, damai sejahtera, kesabaran, kemurahan, kebaikan, kesetiaan.";
    titleText = "Galatia 5:22";
  }
  
  console.log(`Ayat: ${titleText}`);
  
  const canvas = createCanvas(1080, 1920);
  const ctx = canvas.getContext('2d');
  const pattern = getRandomPattern();
  pattern.draw(ctx, canvas.width, canvas.height);
  
  const vignette = ctx.createRadialGradient(540, 960, 200, 540, 960, 1100);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 180px "Segoe UI", Arial, sans-serif';
  ctx.fillText('"', 80, 250);
  
  ctx.font = 'bold 55px "Segoe UI", Arial, sans-serif';
  let yPos = 420;
  let titleLines = wrapText(ctx, titleText, 880);
  for (const line of titleLines) {
    ctx.fillText(line, 100, yPos);
    yPos += 75;
  }
  
  ctx.font = '46px "Segoe UI", Arial, sans-serif';
  const contentLines = wrapText(ctx, cleanVerseText, 880);
  yPos += 50;
  for (const line of contentLines) {
    ctx.fillText(line, 100, yPos);
    yPos += 70;
  }
  
  ctx.font = '34px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#888888';
  ctx.fillText('@sukalogika', 100, 1820);
  
  const buffer = canvas.toBuffer('image/png');
  const date = getFormattedDate();
  const dirPath = path.join(__dirname, '../vod-image', String(date.year), date.month);
  const filename = `vod-${date.day}.png`;
  const filePath = path.join(dirPath, filename);
  
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ Image saved: ${filePath}\n`);
}

generateImage().catch(console.error);
