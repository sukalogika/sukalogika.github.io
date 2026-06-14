/**
 * upload-buffer.js
 * Upload video ke Buffer menggunakan GraphQL API (api.buffer.com)
 *
 * Env vars (set di GitHub Secrets):
 *   BUFFER_ACCESS_TOKEN  - Bearer token dari Buffer
 *   BUFFER_CHANNEL_IDS   - Comma-separated channel IDs
 *                          (dapatkan dari script list-channels di bawah)
 *
 * Opsional:
 *   VOD_CAPTION          - Caption custom
 *   BUFFER_VIDEO_URL     - URL publik video (jika tidak mau upload file langsung)
 */

const fs      = require('fs');
const path    = require('path');
const axios   = require('axios');
const FormData = require('form-data');

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT       = path.join(__dirname, '..');
const VIDEO_PATH = path.join(ROOT, 'vod-video', 'latest.mp4');
const META_PATH  = path.join(ROOT, 'vod-video', 'latest-meta.json');

// ─── Config ───────────────────────────────────────────────────────────────────
const TOKEN      = process.env.BUFFER_ACCESS_TOKEN;
const CHANNEL_IDS = (process.env.BUFFER_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const CAPTION    = process.env.VOD_CAPTION || '';
const GQL_URL    = 'https://api.buffer.com';

// ─── GraphQL helper ───────────────────────────────────────────────────────────
async function gql(query, variables = {}) {
  const res = await axios.post(GQL_URL, { query, variables }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    timeout: 30000,
  });

  if (res.data.errors) {
    const msg = res.data.errors.map(e => e.message).join(', ');
    throw new Error(`GraphQL error: ${msg}`);
  }
  return res.data.data;
}

// ─── List channels (untuk cari channel ID) ───────────────────────────────────
async function listChannels() {
  const data = await gql(`
    query {
      channels {
        id
        name
        service
        serviceId
        timezone
      }
    }
  `);
  return data.channels || [];
}

// ─── Upload video file dan dapat URL ─────────────────────────────────────────
// Buffer GraphQL butuh URL video yang accessible publik.
// Opsi 1: upload ke tempat sementara (0x0.st / file.io)
// Opsi 2: pakai GitHub raw URL jika video sudah di-commit ke repo
// Opsi 3: pakai BUFFER_VIDEO_URL jika sudah ada di CDN sendiri
async function getVideoUrl(videoPath) {
  // Jika ada env var URL langsung, pakai itu
  if (process.env.BUFFER_VIDEO_URL) {
    console.log('📎 Pakai URL dari env: ' + process.env.BUFFER_VIDEO_URL);
    return process.env.BUFFER_VIDEO_URL;
  }

  // Upload ke 0x0.st (free, file bertahan 30 hari)
  console.log('📤 Upload video ke hosting sementara (0x0.st)...');
  const form = new FormData();
  form.append('file', fs.createReadStream(videoPath), {
    filename: path.basename(videoPath),
    contentType: 'video/mp4',
  });

  const res = await axios.post('https://0x0.st', form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 120000,
  });

  const url = res.data.trim();
  if (!url.startsWith('http')) throw new Error('Upload ke 0x0.st gagal: ' + url);
  console.log('✅ Video tersedia di: ' + url);
  return url;
}

// ─── Buat post di Buffer ──────────────────────────────────────────────────────
async function createPost(channelId, videoUrl, caption) {
  const data = await gql(`
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            text
            status
            scheduledAt
          }
        }
        ... on MutationError {
          message
          type
        }
      }
    }
  `, {
    input: {
      text: caption,
      channelId: channelId,
      schedulingType: 'automatic',
      mode: 'addToQueue',
      assets: [{ video: { url: videoUrl } }],
    }
  });

  const result = data.createPost;

  // Cek apakah sukses atau error
  if (result.message) {
    throw new Error(`Buffer error: ${result.message} (${result.type || ''})`);
  }
  return result.post;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Validasi
  if (!TOKEN) throw new Error('BUFFER_ACCESS_TOKEN belum di-set di GitHub Secrets!');
  if (CHANNEL_IDS.length === 0) throw new Error('BUFFER_CHANNEL_IDS belum di-set! Jalankan dry run dulu untuk lihat channel IDs.');

  if (!fs.existsSync(VIDEO_PATH)) {
    throw new Error(`Video tidak ditemukan: ${VIDEO_PATH}\nJalankan Step 2 dulu.`);
  }

  // Baca metadata
  let caption = CAPTION;
  if (!caption && fs.existsSync(META_PATH)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
      const today = new Date().toISOString().slice(0, 10);
      caption = `✨ Ayat Hari Ini ✨\n\n${meta.passage || 'Alkitab'}\n\n#alkitab #firmanTuhan #sukalogika #devotional #${today.replace(/-/g, '')}`;
    } catch {}
  }
  if (!caption) caption = '✨ Ayat Hari Ini | @sukalogika';

  console.log(`📋 Caption:\n${caption}\n`);
  console.log(`📦 Video: ${VIDEO_PATH} (${(fs.statSync(VIDEO_PATH).size / 1024 / 1024).toFixed(2)} MB)\n`);

  // Upload video → dapat URL
  const videoUrl = await getVideoUrl(VIDEO_PATH);

  // Post ke tiap channel
  const results = [];
  for (const channelId of CHANNEL_IDS) {
    console.log(`\n📨 Posting ke channel: ${channelId}`);
    try {
      const post = await createPost(channelId, videoUrl, caption);
      console.log(`✅ Sukses! Post ID: ${post.id}, status: ${post.status}`);
      if (post.scheduledAt) console.log(`   Dijadwalkan: ${post.scheduledAt}`);
      results.push({ channelId, success: true, post });
    } catch (err) {
      console.error(`❌ Gagal: ${err.message}`);
      results.push({ channelId, success: false, error: err.message });
    }
  }

  // Summary
  console.log('\n─── Summary ───────────────────────────────');
  results.forEach(r => console.log(`${r.success ? '✅' : '❌'} Channel ${r.channelId}`));

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) throw new Error(`${failed.length} channel gagal.`);

  console.log('\n🎉 Semua channel berhasil dipost ke Buffer!');
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
