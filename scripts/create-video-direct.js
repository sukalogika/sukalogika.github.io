// scripts/create-video-direct.js
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Utility: Ambil tanggal sekarang
function getDateInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return { year, month, day };
}

// Utility: Path gambar
function getImagePath() {
  const { year, month, day } = getDateInfo();
  return path.join(__dirname, '..', 'vod-image', String(year), month, `vod-${day}.png`);
}

// Pilih background berdasarkan hari
function getBackgroundByDay() {
  const today = new Date().getDay();
  const bgMap = {
    0: 'sunday-worship.mp4',
    1: 'monday-nature.mp4',
    2: 'tuesday-ocean.mp4',
    3: 'wednesday-mountain.mp4',
    4: 'thursday-forest.mp4',
    5: 'friday-sunset.mp4',
    6: 'saturday-clouds.mp4'
  };
  
  const bgFile = bgMap[today];
  const bgPath = path.join(__dirname, '..', 'assets', 'backgrounds', bgFile);
  
  if (!fs.existsSync(bgPath)) {
    const bgDir = path.join(__dirname, '..', 'assets', 'backgrounds');
    const bgFiles = fs.readdirSync(bgDir).filter(f => f.endsWith('.mp4'));
    return path.join(bgDir, bgFiles[0]);
  }
  return bgPath;
}

// Pilih musik
function getMusic() {
  const musicDir = path.join(__dirname, '..', 'assets', 'music');
  if (!fs.existsSync(musicDir)) return null;
  const musicFiles = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
  if (musicFiles.length === 0) return null;
  return path.join(musicDir, musicFiles[0]);
}

async function createVideoDirect() {
  console.log('\n🎬 START: GAMBAR → VIDEO + BACKGROUND (MUTE) + MUSIK\n');
  
  const imagePath = getImagePath();
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Gambar tidak ditemukan: ${imagePath}`);
    process.exit(1);
  }
  console.log(`🖼️  Gambar: ${path.basename(imagePath)}`);
  
  const bgVideo = getBackgroundByDay();
  console.log(`🎨 Background: ${path.basename(bgVideo)} (MUTE - suara dimatikan)`);
  
  const musicFile = getMusic();
  if (musicFile) {
    console.log(`🎵 Musik: ${path.basename(musicFile)}`);
  } else {
    console.log(`🎵 Musik: Tidak ada (video tanpa suara)`);
  }
  
  const { year, month, day } = getDateInfo();
  const outputDir = path.join(__dirname, '..', 'videos');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `daily-verse-${year}-${month}-${day}.mp4`);
  
  console.log('\n🎥 Rendering video...');
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    
    // 🔥 INPUT BACKGROUND: MUTE (suara dimatikan)
    command = command.input(bgVideo).inputOptions(['-stream_loop', '-1', '-an']);
    
    // Input gambar
    command = command.input(imagePath);
    
    // Input musik (opsional)
    if (musicFile) {
      command = command.input(musicFile);
    }
    
    // Filter complex
    const filters = [
      '[0:v]scale=1080:1920:force_original_aspect_ratio=1,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[bg]',
      '[1:v]scale=864:-1:force_original_aspect_ratio=1[img]',
      '[bg][img]overlay=(W-w)/2:(H-h)/2[out]'
    ];
    
    command = command
      .complexFilter(filters, 'out')
      .output(outputPath)
      .outputOptions([
        '-t 15',
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-c:a aac'
      ]);
    
    if (musicFile) {
      command = command.outputOptions(['-shortest']);
    }
    
    command
      .on('start', () => console.log('   Processing...'))
      .on('progress', (p) => { if (p.percent) process.stdout.write(`   Progress: ${Math.floor(p.percent)}%\r`); })
      .on('end', () => {
        console.log('\n   ✅ Video selesai! (Background MUTE, Musik tetap jalan)');
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

createVideoDirect().catch(console.error);
