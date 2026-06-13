// scripts/create-video.js (FIXED - dengan suara pasti)
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
  const today = new Date().getDay();
  const index = today % bgFiles.length;
  return path.join(bgDir, bgFiles[index]);
}

function getMusic() {
  const musicDir = path.join(__dirname, '..', 'assets', 'music');
  if (!fs.existsSync(musicDir)) return null;
  const musicFiles = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
  if (musicFiles.length === 0) return null;
  return path.join(musicDir, musicFiles[0]);
}

async function createVideo() {
  console.log('\n🎬 CREATE VIDEO...\n');
  
  const imagePath = getImagePath();
  if (!fs.existsSync(imagePath)) {
    console.error(`❌ Image not found: ${imagePath}`);
    process.exit(1);
  }
  console.log(`📷 Image: ${path.basename(imagePath)}`);
  
  const bgVideo = getBackground();
  if (bgVideo) {
    console.log(`🎬 Background: ${path.basename(bgVideo)}`);
  }
  
  const musicFile = getMusic();
  if (musicFile) {
    console.log(`🎵 Music: ${path.basename(musicFile)}`);
  } else {
    console.log(`⚠️ No music found, video will be silent`);
  }
  
  const { year, month, day } = getDateInfo();
  const outputDir = path.join(__dirname, '..', 'videos');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, `daily-verse-${year}-${month}-${day}.mp4`);
  
  console.log(`📁 Output: ${outputPath}\n`);
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg();
    
    // Input 0: Background video (mute)
    if (bgVideo) {
      command = command.input(bgVideo).inputOptions(['-stream_loop', '-1', '-an']);
    } else {
      command = command.input('color=c=black:s=1080x1920:d=15').inputOptions(['-f lavfi']);
    }
    
    // Input 1: Gambar
    command = command.input(imagePath);
    
    // Input 2: Musik (kalau ada)
    if (musicFile) {
      command = command.input(musicFile);
    }
    
    // Filter complex: gabung gambar ke background
    const filters = [
      '[0:v]scale=1080:1920:force_original_aspect_ratio=1,pad=1080:1920:(ow-iw)/2:(oh-ih)/2[bg]',
      '[1:v]scale=800:-1:force_original_aspect_ratio=1[img]',
      '[bg][img]overlay=(W-w)/2:(H-h)/2[out]'
    ];
    
    let outputOptions = [
      '-t', '15',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '30',
      '-pix_fmt', 'yuv420p',
      '-map', '[out]'              // Video dari filter complex
    ];
    
    // Kalau ada musik, map audio dari input ke-2
    if (musicFile) {
      outputOptions.push('-map', '2:a');
      outputOptions.push('-c:a', 'aac');
      outputOptions.push('-b:a', '128k');
      outputOptions.push('-shortest');
    } else {
      outputOptions.push('-an');   // No audio
    }
    
    command = command
      .complexFilter(filters, 'out')
      .output(outputPath)
      .outputOptions(outputOptions);
    
    command
      .on('start', (cmd) => {
        console.log('🎥 Rendering...');
        if (process.env.DEBUG) console.log(cmd);
      })
      .on('progress', (p) => {
        if (p.percent) {
          process.stdout.write(`Progress: ${Math.floor(p.percent)}%\r`);
        }
      })
      .on('end', () => {
        console.log('\n✅ Video done!');
        const stats = fs.statSync(outputPath);
        const sizeMB = stats.size / (1024 * 1024);
        console.log(`📦 Size: ${sizeMB.toFixed(2)} MB`);
        console.log(`📁 ${outputPath}\n`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('\n❌ Error:', err.message);
        reject(err);
      })
      .run();
  });
}

createVideo().catch(console.error);
