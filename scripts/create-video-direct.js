// scripts/create-video-direct.js (dengan debug)
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

function getDateInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return { year, month, day };
}

function getImagePath() {
  const { year, month, day } = getDateInfo();
  return path.join(__dirname, '..', 'vod-image', String(year), month, `vod-${day}.png`);
}

function getBackground() {
  const bgDir = path.join(__dirname, '..', 'assets', 'backgrounds');
  if (!fs.existsSync(bgDir)) return null;
  const bgFiles = fs.readdirSync(bgDir).filter(f => f.endsWith('.mp4'));
  if (bgFiles.length === 0) return null;
  return path.join(bgDir, bgFiles[0]);
}

function getMusic() {
  const musicDir = path.join(__dirname, '..', 'assets', 'music');
  if (!fs.existsSync(musicDir)) return null;
  const musicFiles = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
  if (musicFiles.length === 0) return null;
  return path.join(musicDir, musicFiles[0]);
}

async function createVideoDirect() {
  console.log('\n🎬 START CREATING VIDEO...\n');
  
  // 1. Cek gambar
  const imagePath = getImagePath();
  console.log(`📷 Cek gambar: ${imagePath}`);
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Gambar tidak ditemukan!`);
    process.exit(1);
  }
  console.log(`✅ Gambar OK: ${path.basename(imagePath)}`);
  
  // 2. Cek background
  const bgVideo = getBackground();
  if (!bgVideo) {
    console.error(`❌ Background tidak ditemukan!`);
    process.exit(1);
  }
  console.log(`✅ Background OK: ${path.basename(bgVideo)}`);
  
  // 3. Cek musik (opsional)
  const musicFile = getMusic();
  if (musicFile) {
    console.log(`✅ Musik OK: ${path.basename(musicFile)}`);
  } else {
    console.log(`⚠️ Musik tidak ditemukan, video tanpa suara`);
  }
  
  // 4. Siapkan output
  const { year, month, day } = getDateInfo();
  const outputDir = path.join(__dirname, '..', 'videos');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Folder videos dibuat`);
  }
  const outputPath = path.join(outputDir, `daily-verse-${year}-${month}-${day}.mp4`);
  console.log(`📁 Output: ${outputPath}`);
  
  console.log('\n🎥 Memulai rendering...');
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    
    // Input background (mute)
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
        '-pix_fmt yuv420p'
      ]);
    
    if (musicFile) {
      command = command.outputOptions(['-c:a aac', '-shortest']);
    } else {
      command = command.outputOptions(['-an']); // no audio
    }
    
    command
      .on('start', (cmd) => {
        console.log(`🔧 Command: ${cmd.substring(0, 200)}...`);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`   Progress: ${Math.floor(progress.percent)}%\r`);
        }
      })
      .on('end', () => {
        console.log('\n   ✅ Video selesai!');
        
        // Cek apakah file beneran ada
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          const fileSizeMB = stats.size / (1024 * 1024);
          console.log(`   📦 Ukuran file: ${fileSizeMB.toFixed(2)} MB`);
          console.log(`   📁 Lokasi: ${outputPath}`);
          resolve(outputPath);
        } else {
          console.error(`   ❌ File video tidak ditemukan setelah render!`);
          reject(new Error('Video file not found'));
        }
      })
      .on('error', (err) => {
        console.error('\n   ❌ FFmpeg Error:', err.message);
        reject(err);
      })
      .run();
  });
}

createVideoDirect().catch(error => {
  console.error('\n❌ GAGAL:', error.message);
  process.exit(1);
});
