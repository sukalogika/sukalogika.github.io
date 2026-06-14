/**
 * upload-buffer.js
 * Upload video ke Buffer menggunakan GraphQL API (api.buffer.com)
 *
 * Env vars (set di GitHub Secrets):
 *   BUFFER_ACCESS_TOKEN  - Bearer token dari Buffer
 *   BUFFER_CHANNEL_IDS   - Comma-separated channel IDs
 *                          (jalankan dry run dulu untuk lihat IDs)
 * Opsional:
 *   VOD_CAPTION          - Caption custom
 *   BUFFER_VIDEO_URL     - URL publik video (skip upload ke 0x0.st)
 */

const fs       = require('fs');
const path     = require('path');
const axios    = require('axios');
const FormData = require('form-data');

const ROOT        = path.join(__dirname, '..');
const VIDEO_PATH  = path.join(ROOT, 'vod-video', 'latest.mp4');
const META_PATH   = path.join(ROOT, 'vod-video', 'latest-meta.json');
const TOKEN       = process.env.BUFFER_ACCESS_TOKEN;
const CHANNEL_IDS = (process.env.BUFFER_CHANNEL_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const GQL_URL     = 'https://api.buffer.com';

// ─── GraphQL helper ───────────────────────────────────────────────────────────
async function gql(query, variables = {}) {
  const res = await axios.post(GQL_URL,
    { query, variables },
    { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, timeout: 30000 }
  );
  if (res.data.errors) throw new Error(res.data.errors.map(e => e.message).join(', '));
  return res.data.data;
}

// ─── Step A: Dapat organizationId dari account ────────────────────────────────
async function getOrganizationId() {
  const data = await gql(`
    query {
      account {
        organizations {
          id
          name
        }
      }
    }
  `);
  const orgs = data.account.organizations;
  if (!orgs.length) throw new Error('Tidak ada organisasi di akun Buffer ini.');
  console.log(`🏢 Organisasi: ${orgs[0].name} (ID: ${orgs[0].id})`);
  return orgs[0].id;
}

// ─── Upload video ke hosting sementara ───────────────────────────────────────
// Coba beberapa host secara berurutan (fallback jika satu down)
async function uploadTo0x0(videoPath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(videoPath), {
    filename: path.basename(videoPath),
    contentType: 'video/mp4',
  });
  const res = await axios.post('https://0x0.st', form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 120000,
  });
  const url = res.data.trim();
  if (!url.startsWith('http')) throw new Error('Respons tidak valid: ' + url);
  return url;
}

async function uploadToTmpFiles(videoPath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(videoPath), {
    filename: path.basename(videoPath),
    contentType: 'video/mp4',
  });
  const res = await axios.post('https://tmpfiles.org/api/v1/upload', form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity, maxBodyLength: Infinity, timeout: 120000,
  });
  // tmpfiles.org returns { data: { url: "https://tmpfiles.org/..." } }
  const pageUrl = res.data?.data?.url;
  if (!pageUrl) throw new Error('Respons tmpfiles tidak valid');
  // Convert page URL ke direct download URL
  // https://tmpfiles.org/1234/file.mp4 -> https://tmpfiles.org/dl/1234/file.mp4
  const url = pageUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
  return url;
}

async function getVideoUrl(videoPath) {
  // Prioritas: env var > coba upload ke beberapa host
  if (process.env.BUFFER_VIDEO_URL) {
    console.log('📎 Pakai BUFFER_VIDEO_URL dari env: ' + process.env.BUFFER_VIDEO_URL);
    return process.env.BUFFER_VIDEO_URL;
  }

  const hosts = [
    { name: '0x0.st',       fn: () => uploadTo0x0(videoPath) },
    { name: 'tmpfiles.org', fn: () => uploadToTmpFiles(videoPath) },
  ];

  for (const host of hosts) {
    try {
      console.log(`📤 Upload video ke ${host.name}...`);
      const url = await host.fn();
      console.log(`✅ Video URL: ${url}`);
      return url;
    } catch (err) {
      console.warn(`⚠️  ${host.name} gagal: ${err.message} — coba host berikutnya...`);
    }
  }

  throw new Error(
    'Semua hosting sementara gagal.\n' +
    'Solusi: upload video ke tempat lain (Google Drive, S3, Cloudinary, dll)\n' +
    'lalu set env var BUFFER_VIDEO_URL=https://... di workflow.'
  );
}

// ─── Post ke Buffer ───────────────────────────────────────────────────────────
// Pakai inline query tanpa variables (persis seperti dokumentasi Buffer)
async function createPost(channelId, videoUrl, caption) {
  // Escape teks caption untuk inline GraphQL
  const safeText = caption.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const safeUrl  = videoUrl.trim();

  const query = `
    mutation CreatePost {
      createPost(
        input: {
          text: "${safeText}"
          channelId: "${channelId}"
          schedulingType: automatic
          mode: addToQueue
          assets: [{ video: { url: "${safeUrl}" } }]
        }
      ) {
        ... on PostActionSuccess {
          post {
            id
            text
            assets { source }
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  const res = await axios.post('https://api.buffer.com',
    { query },
    { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` }, timeout: 30000 }
  );

  console.log('Raw response:', JSON.stringify(res.data, null, 2));

  if (res.data.errors) throw new Error(res.data.errors.map(e => e.message).join(', '));

  const result = res.data.data?.createPost;
  if (!result) throw new Error('Respons tidak dikenal: ' + JSON.stringify(res.data));
  if (result.message) throw new Error(`Buffer error: ${result.message}`);
  return result.post;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!TOKEN) throw new Error('BUFFER_ACCESS_TOKEN belum di-set di GitHub Secrets!');
  if (!CHANNEL_IDS.length) throw new Error('BUFFER_CHANNEL_IDS belum di-set! Jalankan dry run dulu.');
  if (!fs.existsSync(VIDEO_PATH)) throw new Error(`Video tidak ditemukan: ${VIDEO_PATH}`);

  // Baca caption dari metadata
  let caption = process.env.VOD_CAPTION || '';
  if (!caption && fs.existsSync(META_PATH)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
      const today = new Date().toISOString().slice(0, 10);
      caption = `✨ Ayat Hari Ini ✨\n\n${meta.passage || 'Alkitab'}\n\n#alkitab #firmanTuhan #sukalogika #devotional #${today.replace(/-/g, '')}`;
    } catch {}
  }
  if (!caption) caption = '✨ Ayat Hari Ini | @sukalogika';

  console.log(`📋 Caption:\n${caption}\n`);
  console.log(`📦 Video: ${(fs.statSync(VIDEO_PATH).size / 1024 / 1024).toFixed(2)} MB\n`);

  const videoUrl = await getVideoUrl(VIDEO_PATH);

  const results = [];
  for (const channelId of CHANNEL_IDS) {
    console.log(`\n📨 Posting ke channel: ${channelId}`);
    try {
      const post = await createPost(channelId, videoUrl, caption);
      console.log(`✅ Sukses! Post ID: ${post.id}, status: ${post.status}`);
      results.push({ channelId, success: true });
    } catch (err) {
      // Tampilkan detail error dari response Buffer jika ada
      const detail = err.response?.data ? JSON.stringify(err.response.data, null, 2) : '';
      console.error(`❌ Gagal: ${err.message}`);
      if (detail) console.error(`   Detail: ${detail}`);
      results.push({ channelId, success: false, error: err.message });
    }
  }

  console.log('\n─── Summary ───────────────────────────────');
  results.forEach(r => console.log(`${r.success ? '✅' : '❌'} Channel ${r.channelId}`));
  if (results.some(r => !r.success)) throw new Error('Ada channel yang gagal.');
  console.log('\n🎉 Semua berhasil dipost ke Buffer!');
}

main().catch(err => { console.error('\n❌ Fatal:', err.message); process.exit(1); });
