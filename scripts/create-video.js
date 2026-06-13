// scripts/create-video.js
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// Utility: Ambil tanggal sekarang
function getDateInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return { year, month, day };
}

// Utility: Path gambar berdasarkan tanggal
function getImagePath() {
  const { year, month, day } = getDateInfo();
  return path.join(__dirname, '..', 'vod-image', String(year), month, `vod-${day}.png`);
}

// Main function
async function createVideo() {
  console.log('\n🎬 START CREATING VIDEO...\n');
  
  // 1. Cari gambar yang udah digenerate
  const imagePath = getImagePath();
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Gambar tidak ditemukan: ${imagePath}`);
    console.log('   Jalankan generate-quote.js dulu ya bro!');
    process.exit(1);
  }
  console.log(`🖼️  Gambar: ${path.basename(imagePath)}`);
  
  // 2. Siapin output
  const { year, month, day } = getDateInfo();
  const outputDir = path.join(__dirname, '..', 'videos');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `daily-verse-${year}-${month}-${day}.mp4`);
  
  // 3. Cari background video (opsional)
  const bgDir = path.join(__dirname, '..', 'assets', 'backgrounds');
  let bgVideo = null;
  if (fs.existsSync(bgDir)) {
    const bgFiles = fs.readdirSync(bgDir).filter(f => f.endsWith('.mp4'));
    if (bgFiles.length > 0) {
      const seed = parseInt(`${year}${month}${day}`);
      const index = seed % bgFiles.length;
      bgVideo = path.join(bgDir, bgFiles[index]);
      console.log(`🎨 Background: ${path.basename(bgVideo)}`);
    }
  }
  
  // 4. Cari musik (opsional)
  const musicDir = path.join(__dirname, '..', 'assets', 'music');
  let musicFile = null;
  if (fs.existsSync(musicDir)) {
    const musicFiles = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
    if (musicFiles.length > 0) {
      musicFile = path.join(musicDir, musicFiles[0]);
      console.log(`🎵 Musik: ${path.basename(musicFile)}`);
    }
  }
  
  console.log('\n🎥 Rendering video...');
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    
    // INPUT: Background (atau hitam polos)
    if (bgVideo && fs.existsSync(bgVideo)) {
      command = command.input(bgVideo);
    } else {
      command = command.input('color=c=black:s=1080x1920:d=20').inputOptions(['-f lavfi']);
    }
    
    // INPUT: Gambar yang udah jadi
    command = command.input(imagePath);
    
    // INPUT: Musik
    if (musicFile && fs.existsSync(musicFile)) {
      command = command.input(musicFile);
    }
    
    // 🔥 FILTER SIMPLE: resize background + overlay gambar di tengah
    // GAK ADA TEKS TAMBAHAN! Langsung pake gambar jadi.
    const filters = [
      // Resize background ke fullscreen 1080x1920
      '[0:v]scale=1080:1920:force_original_aspect_ratio=1,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[bg]',
      
      // Resize gambar jadi 800px lebar (jaga rasio)
      '[1:v]scale=800:-1:force_original_aspect_ratio=1[img]',
      
      // Overlay gambar di tengah background
      '[bg][img]overlay=(W-w)/2:(H-h)/2[out]'
    ];
    
    command = command
      .complexFilter(filters, 'out')
      .output(outputPath)
      .outputOptions([
        '-t 15',                    // 15 detik
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-c:a aac'
      ]);
    
    if (musicFile && fs.existsSync(musicFile)) {
      command = command.outputOptions(['-shortest']);
    }
    
    command
      .on('start', (cmd) => {
        console.log(`   Processing...`);
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
