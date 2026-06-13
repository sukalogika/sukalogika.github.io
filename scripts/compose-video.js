/**
 * compose-video.js
 * Compose video VOD dari:
 *   - assets/background/*.mp4   → video pemandangan (loop jika perlu)
 *   - assets/effect/*.mp4       → overlay hitam/effect (alpha blending)
 *   - vod-image/latest.png      → gambar quote (opacity ~0.9)
 *   - assets/music/*.mp3        → background music
 *
 * Output: vod-video/vod_YYYY-MM-DD.mp4
 */

const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT        = path.join(__dirname, '..');
const BG_DIR      = path.join(ROOT, 'assets', 'background');
const EFFECT_DIR  = path.join(ROOT, 'assets', 'effect');
const MUSIC_DIR   = path.join(ROOT, 'assets', 'music');
const IMAGE_PATH  = path.join(ROOT, 'vod-image', 'latest.png');
const META_PATH   = path.join(ROOT, 'vod-image', 'latest-meta.json');
const OUTPUT_DIR  = path.join(ROOT, 'vod-video');

// ─── Durasi video (detik) ─────────────────────────────────────────────────────
const VIDEO_DURATION = parseInt(process.env.VOD_DURATION || '30', 10);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function pickRandom(dir, ext) {
  if (!fs.existsSync(dir)) throw new Error(`Folder tidak ditemukan: ${dir}`);
  const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(ext));
  if (files.length === 0) throw new Error(`Tidak ada file ${ext} di ${dir}`);
  const pick = files[Math.floor(Math.random() * files.length)];
  console.log(`  Dipilih: ${pick}`);
  return path.join(dir, pick);
}

function run(cmd) {
  console.log(`\n$ ${cmd}\n`);
  const result = spawnSync('bash', ['-c', cmd], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Command gagal (exit ${result.status}): ${cmd}`);
}

function getVideoDuration(file) {
  const out = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${file}"`
  ).toString().trim();
  return parseFloat(out);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  ensureDir(OUTPUT_DIR);

  if (!fs.existsSync(IMAGE_PATH)) {
    throw new Error(`Gambar quote tidak ditemukan: ${IMAGE_PATH}\nJalankan generate-quote.js terlebih dulu.`);
  }

  console.log('🎬 Memilih aset secara acak...');
  const bgVideo     = pickRandom(BG_DIR,     '.mp4');
  const effectVideo = pickRandom(EFFECT_DIR, '.mp4');
  const musicFile   = pickRandom(MUSIC_DIR,  '.mp3');

  // Tanggal untuk nama file output
  const today = new Date().toISOString().slice(0, 10);
  let passage = today;
  if (fs.existsSync(META_PATH)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
      passage = meta.passage || today;
    } catch {}
  }
  const safeTitle = passage.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const outFile   = path.join(OUTPUT_DIR, `vod_${today}_${safeTitle}.mp4`);
  const latestOut = path.join(OUTPUT_DIR, 'latest.mp4');

  // ─── Durasi musik ──────────────────────────────────────────────────────────
  const musicDuration = getVideoDuration(musicFile);
  const finalDuration = Math.min(VIDEO_DURATION, musicDuration);
  console.log(`\n⏱  Durasi video: ${finalDuration}s (musik: ${musicDuration}s)`);

  // ─── FFmpeg filter graph ───────────────────────────────────────────────────
  //
  // Input:
  //   [0] background video (loop jika kurang dari finalDuration)
  //   [1] effect video     (alpha blend, loop jika perlu)
  //   [2] gambar quote PNG (fade in/out)
  //   [3] musik MP3
  //
  // Pipeline:
  //   1. Scale BG ke 1080x1920, loop sampai finalDuration  → [bg]
  //   2. Scale effect ke 1080x1920, loop                   → [eff_scaled]
  //   3. effect menggunakan blend=overlay (screen blending) → [bg_eff]
  //   4. Scale gambar ke 1080x1920, terapkan opacity 0.88  → [img]
  //   5. overlay gambar ke atas bg_eff dengan alpha=1       → [v_out]
  //   6. Audio: musik di-fade in/out, loop/trim             → [a_out]
  //
  // Catatan: effect.mp4 diasumsikan adalah video hitam semi-transparan.
  // Karena MP4 tidak menyimpan alpha channel secara native, kita gunakan
  // "multiply" blend mode sehingga area hitam effect menggelapkan BG.
  // Jika effect.mp4 sesungguhnya transparan (RGBA), ganti dengan overlay biasa.

  const ffmpegCmd = `ffmpeg -y \\
  -stream_loop -1 -i "${bgVideo}" \\
  -stream_loop -1 -i "${effectVideo}" \\
  -loop 1 -i "${IMAGE_PATH}" \\
  -i "${musicFile}" \\
  -filter_complex "
    [0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[bg];
    [1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=rgba[eff];
    [bg][eff]blend=all_mode=multiply:all_opacity=0.6[bg_eff];
    [2:v]scale=1080:1920,format=rgba,colorchannelmixer=aa=0.88[img];
    [bg_eff][img]overlay=0:0:format=auto[v_out];
    [3:a]afade=t=in:st=0:d=2,afade=t=out:st=${finalDuration - 3}:d=3,atrim=0:${finalDuration},asetpts=PTS-STARTPTS[a_out]
  " \\
  -map "[v_out]" -map "[a_out]" \\
  -t ${finalDuration} \\
  -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p \\
  -c:a aac -b:a 192k \\
  -movflags +faststart \\
  "${outFile}"`;

  console.log('\n🎥 Menjalankan FFmpeg...');
  run(ffmpegCmd);

  // Salin sebagai latest.mp4
  fs.copyFileSync(outFile, latestOut);

  // Simpan metadata output
  const outputMeta = {
    video: path.basename(outFile),
    date: today,
    passage,
    bg: path.basename(bgVideo),
    effect: path.basename(effectVideo),
    music: path.basename(musicFile),
    duration: finalDuration,
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'latest-meta.json'),
    JSON.stringify(outputMeta, null, 2)
  );

  console.log(`\n✅ Video selesai: ${outFile}`);
  console.log(`✅ Latest: ${latestOut}`);

  // Print ukuran file
  const stat = fs.statSync(outFile);
  console.log(`📦 Ukuran: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
