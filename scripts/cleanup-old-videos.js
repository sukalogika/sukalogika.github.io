/**
 * cleanup-old-videos.js
 * Hapus semua video lebih lama dari 4 hari secara otomatis
 * 
 * Usage: node scripts/cleanup-old-videos.js
 */

const fs = require('fs');
const path = require('path');

const VIDEO_DIR = path.join(__dirname, '..', 'vod-video');
const DAYS_TO_KEEP = 4;

async function cleanupOldVideos() {
  try {
    if (!fs.existsSync(VIDEO_DIR)) {
      console.log('⚠️  Folder vod-video tidak ditemukan');
      return;
    }

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - DAYS_TO_KEEP * 24 * 60 * 60 * 1000);

    console.log(`🧹 Cleanup videos lebih lama dari ${DAYS_TO_KEEP} hari`);
    console.log(`📅 Cutoff date: ${cutoffDate.toISOString().split('T')[0]}`);
    console.log(`📅 Today: ${now.toISOString().split('T')[0]}\n`);

    const files = fs.readdirSync(VIDEO_DIR);
    let deletedCount = 0;
    let keptCount = 0;

    for (const file of files) {
      const filePath = path.join(VIDEO_DIR, file);

      // Skip jika bukan file
      if (!fs.statSync(filePath).isFile()) continue;

      // Extract tanggal dari nama file (format: vod_YYYY-MM-DD_*.mp4 atau latest.mp4, latest-meta.json)
      let fileDate = null;

      // Tangkap tanggal dari nama file (vod_2026-10-01_mat_7_1.mp4 atau 2026-06-16.mp4)
      const dateMatch = file.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        fileDate = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
      }

      // Skip file tanpa tanggal (latest.mp4, latest-meta.json)
      if (!fileDate) {
        console.log(`⏭️  Skip (no date): ${file}`);
        keptCount++;
        continue;
      }

      // Hapus jika lebih lama dari cutoff date
      if (fileDate < cutoffDate) {
        try {
          fs.unlinkSync(filePath);
          const size = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
          console.log(`🗑️  Deleted: ${file}`);
          deletedCount++;
        } catch (err) {
          console.error(`❌ Error deleting ${file}:`, err.message);
        }
      } else {
        console.log(`✅ Keep: ${file}`);
        keptCount++;
      }
    }

    console.log(`\n─────────────────────────────`);
    console.log(`✅ Kept: ${keptCount} files`);
    console.log(`🗑️  Deleted: ${deletedCount} files`);
    console.log(`─────────────────────────────\n`);

    if (deletedCount > 0) {
      console.log('🎉 Cleanup selesai! Repository jadi lebih ringan.');
    } else {
      console.log('ℹ️  Tidak ada file yang perlu dihapus.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupOldVideos();
