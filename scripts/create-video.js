// scripts/create-video.js
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Utility: Ambil ayat dari API SABDA
async function fetchVerseData() {
  try {
    const response = await axios.get('https://alkitab.sabda.org/api/vod.php?format=json', {
      timeout: 10000
    });
    if (response.data && response.data.html && response.data.html.text) {
      return {
        text: response.data.html.text,
        passage: response.data.html.passage
      };
    }
    throw new Error('Data tidak lengkap');
  } catch (error) {
    // Fallback ayat
    return {
      text: "Janganlah hendaknya kamu kuatir tentang apapun juga, tetapi nyatakanlah dalam segala hal keinginanmu kepada Allah dalam doa dan permohonan dengan ucapan syukur.",
      passage: "Filipi 4:6"
    };
  }
}

// Utility: Ambil tanggal sekarang
function getDateInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return { year, month, day };
}

// Utility: Cari file gambar terbaru
function findLatestImage() {
  const { year, month } = getDateInfo();
  const imageDir = path.join(__dirname, '..', 'vod-image', String(year), month);
  
  if (!fs.existsSync(imageDir)) {
    return null;
  }
  
  const files = fs.readdirSync(imageDir).filter(f => f.endsWith('.png'));
  if (files.length === 0) return null;
  
  // Urutkan berdasarkan nama file (yang paling baru)
  files.sort().reverse();
  return path.join(imageDir, files[0]);
}

// Main function: Bikin video
async function createVideo() {
  console.log('\n🎬 START CREATING VIDEO...\n');
  
  // 1. Ambil ayat
  console.log('📖 Fetching verse...');
  const verse = await fetchVerseData();
  console.log(`   Ayat: ${verse.passage}`);
  
  // 2. Cari gambar yang udah digenerate
  console.log('🖼️ Looking for image...');
  const imagePath = findLatestImage();
  if (!imagePath) {
    console.error('❌ No image found! Run generate-quote.js first.');
    process.exit(1);
  }
  console.log(`   Image: ${path.basename(imagePath)}`);
  
  // 3. Siapin output path
  const { year, month, day } = getDateInfo();
  const outputDir = path.join(__dirname, '..', 'videos');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `daily-verse-${year}-${month}-${day}.mp4`);
  
  // 4. Cari background video (opsional)
  const bgDir = path.join(__dirname, '..', 'assets', 'backgrounds');
  let bgVideo = null;
  if (fs.existsSync(bgDir)) {
    const bgFiles = fs.readdirSync(bgDir).filter(f => f.endsWith('.mp4'));
    if (bgFiles.length > 0) {
      // Pilih random atau berdasarkan tanggal
      const seed = parseInt(`${year}${month}${day}`);
      const index = seed % bgFiles.length;
      bgVideo = path.join(bgDir, bgFiles[index]);
      console.log(`🎨 Background: ${path.basename(bgVideo)}`);
    }
  }
  
  // 5. Cari musik (opsional)
  const musicDir = path.join(__dirname, '..', 'assets', 'music');
  let musicFile = null;
  if (fs.existsSync(musicDir)) {
    const musicFiles = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
    if (musicFiles.length > 0) {
      musicFile = path.join(musicDir, musicFiles[0]);
      console.log(`🎵 Music: ${path.basename(musicFile)}`);
    }
  }
  
  // 6. Persiapan teks untuk overlay
  // Bersihkan dan batasi teks
  let verseText = verse.text;
  if (verseText.length > 200) {
    verseText = verseText.substring(0, 197) + '...';
  }
  
  // 7. Build command FFmpeg
  console.log('\n🎥 Rendering video...');
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    
    // Input: background video atau fallback ke background hitam
    if (bgVideo && fs.existsSync(bgVideo)) {
      command = command.input(bgVideo);
    } else {
      // Fallback: bikin background solid hitam pake lavfi
      command = command.input('color=c=black:s=1080x1920:d=20').inputOptions(['-f lavfi']);
    }
    
    // Input: gambar verse
    command = command.input(imagePath);
    
    // Input: musik (jika ada)
    if (musicFile && fs.existsSync(musicFile)) {
      command = command.input(musicFile);
    }
    
    // Complex filter: resize gambar, overlay ke background, tambah teks
    let filterComplex = [
      // Resize gambar ke 1080x1920 (maintain aspect ratio, center crop)
      '[1:v]scale=1080:1920:force_original_aspect_ratio=1,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[img]',
      // Overlay gambar ke background (atau ke color source)
      `[0:v][img]overlay=(W-w)/2:(H-h)/2,drawtext=text='${verseText.replace(/'/g, "\\'")}':fontcolor=white:fontsize=42:fontfile=${path.join(__dirname, '..', 'assets', 'fonts', 'Roboto-Regular.ttf')}:x=(w-text_w)/2:y=600,drawtext=text='${verse.passage.replace(/'/g, "\\'")}':fontcolor=#FFD700:fontsize=38:fontfile=${path.join(__dirname, '..', 'assets', 'fonts', 'Roboto-Bold.ttf')}:x=(w-text_w)/2:y=700,drawtext=text='@sukalogika':fontcolor=#888888:fontsize=28:x=20:y=1820[out]`
    ];
    
    // Setup output
    command = command
      .complexFilter(filterComplex, 'out')
      .output(outputPath)
      .outputOptions([
        '-t 15',                    // Durasi 15 detik
        '-c:v libx264',             // Codec video
        '-preset fast',             // Cepat
        '-crf 23',                  // Kualitas
        '-pix_fmt yuv420p',         // Kompatibilitas
        '-c:a aac'                  // Codec audio
      ]);
    
    // Kalau ada musik, potong sesuai durasi video
    if (musicFile && fs.existsSync(musicFile)) {
      command = command.outputOptions(['-shortest']);
    }
    
    command
      .on('start', (cmd) => {
        console.log(`   Command: ${cmd.substring(0, 200)}...`);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`   Progress: ${Math.floor(progress.percent)}%\r`);
        }
      })
      .on('end', () => {
        console.log('\n   ✅ Video selesai!');
        const stats = fs.statSync(outputPath);
        const fileSizeMB = stats.size / (1024 * 1024);
        console.log(`   📦 Ukuran: ${fileSizeMB.toFixed(2)} MB`);
        console.log(`   📁 ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('\n   ❌ Error:', err.message);
        reject(err);
      })
      .run();
  });
}

// Eksekusi
createVideo().catch(error => {
  console.error('\n❌ GAGAL:', error.message);
  process.exit(1);
});
