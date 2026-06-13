/**
 * upload-buffer.js
 * Upload video hasil compose ke Buffer (social media scheduler).
 *
 * Env vars yang dibutuhkan (set di GitHub Secrets):
 *   BUFFER_ACCESS_TOKEN   - Personal access token dari Buffer
 *   BUFFER_PROFILE_IDS    - Comma-separated profile IDs, misal: "abc123,def456"
 *                           (dapatkan dari: GET https://api.bufferapp.com/1/profiles.json)
 *
 * Opsional:
 *   BUFFER_SCHEDULE_AT    - ISO 8601 datetime untuk jadwal posting.
 *                           Kosongkan = tambah ke queue Buffer.
 *   VOD_CAPTION           - Caption custom. Default = passage dari meta.
 */

const fs   = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT       = path.join(__dirname, '..');
const VIDEO_PATH = path.join(ROOT, 'vod-video', 'latest.mp4');
const META_PATH  = path.join(ROOT, 'vod-video', 'latest-meta.json');

// ─── Config dari env ──────────────────────────────────────────────────────────
const BUFFER_TOKEN   = process.env.BUFFER_ACCESS_TOKEN;
const PROFILE_IDS    = (process.env.BUFFER_PROFILE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const SCHEDULE_AT    = process.env.BUFFER_SCHEDULE_AT || '';
const CUSTOM_CAPTION = process.env.VOD_CAPTION || '';

const BASE_URL = 'https://api.bufferapp.com/1';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function requireEnv(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Environment variable ${name} tidak di-set. Tambahkan ke GitHub Secrets.`);
  return val;
}

async function getProfiles() {
  const res = await axios.get(`${BASE_URL}/profiles.json`, {
    params: { access_token: BUFFER_TOKEN },
  });
  return res.data;
}

/**
 * Upload video ke Buffer menggunakan endpoint media upload.
 * Buffer API v1 mendukung upload video untuk Instagram & TikTok melalui media endpoint.
 *
 * Dokumentasi: https://buffer.com/developers/api/updates
 */
async function uploadMedia(videoPath) {
  console.log('📤 Mengupload video ke Buffer media server...');

  const form = new FormData();
  form.append('access_token', BUFFER_TOKEN);
  form.append('media', fs.createReadStream(videoPath), {
    filename: path.basename(videoPath),
    contentType: 'video/mp4',
  });

  const res = await axios.post(`${BASE_URL}/media/upload.json`, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeout: 120000,
  });

  if (!res.data || !res.data.id) {
    throw new Error(`Upload media gagal: ${JSON.stringify(res.data)}`);
  }

  console.log(`✅ Media uploaded, ID: ${res.data.id}`);
  return res.data.id;
}

/**
 * Buat update/post di Buffer untuk satu profile.
 */
async function createUpdate(profileId, mediaId, caption) {
  const payload = {
    access_token: BUFFER_TOKEN,
    profile_ids: [profileId],
    text: caption,
    media: { video: { id: mediaId } },
  };

  if (SCHEDULE_AT) {
    payload.scheduled_at = SCHEDULE_AT;
  } else {
    payload.now = false; // tambah ke queue
  }

  const res = await axios.post(`${BASE_URL}/updates/create.json`, payload, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    // Buffer API v1 menggunakan form-encoded
    transformRequest: [(data) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v)) {
          v.forEach(item => params.append(`${k}[]`, item));
        } else if (typeof v === 'object') {
          for (const [sk, sv] of Object.entries(v)) {
            if (typeof sv === 'object') {
              for (const [ssk, ssv] of Object.entries(sv)) {
                params.append(`${k}[${sk}][${ssk}]`, ssv);
              }
            } else {
              params.append(`${k}[${sk}]`, sv);
            }
          }
        } else {
          params.append(k, v);
        }
      }
      return params.toString();
    }],
  });

  return res.data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Validasi env
  requireEnv('BUFFER_ACCESS_TOKEN');
  if (PROFILE_IDS.length === 0) {
    throw new Error('BUFFER_PROFILE_IDS tidak di-set atau kosong. Isi dengan ID profil Buffer Anda (pisah koma untuk beberapa profil).');
  }

  // Validasi file
  if (!fs.existsSync(VIDEO_PATH)) {
    throw new Error(`Video tidak ditemukan: ${VIDEO_PATH}\nJalankan compose-video.js terlebih dulu.`);
  }

  // Ambil metadata
  let caption = CUSTOM_CAPTION;
  if (!caption && fs.existsSync(META_PATH)) {
    try {
      const meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
      const today = new Date().toISOString().slice(0, 10);
      caption = `✨ Ayat Hari Ini ✨\n\n${meta.passage || 'Alkitab'}\n\n#alkitab #firmanTuhan #sukalogika #devotional #${today.replace(/-/g, '')}`;
    } catch {}
  }
  if (!caption) caption = `✨ Ayat Hari Ini | @sukalogika`;

  console.log(`📋 Caption:\n${caption}\n`);

  // Tampilkan profile list
  console.log('🔍 Mengambil daftar profil Buffer...');
  let profiles;
  try {
    profiles = await getProfiles();
    console.log('Profil tersedia:');
    profiles.forEach(p => console.log(`  - [${p.id}] ${p.service} / ${p.service_username}`));
  } catch (err) {
    console.warn('⚠️  Tidak bisa fetch profil (lanjut upload):', err.message);
  }

  // Upload media sekali, pakai di semua profil
  const mediaId = await uploadMedia(VIDEO_PATH);

  // Post ke setiap profil
  const results = [];
  for (const profileId of PROFILE_IDS) {
    console.log(`\n📨 Posting ke profil: ${profileId}`);
    try {
      const result = await createUpdate(profileId, mediaId, caption);
      console.log(`✅ Sukses! Update ID: ${result?.updates?.[0]?.id || 'N/A'}`);
      results.push({ profileId, success: true, result });
    } catch (err) {
      const msg = err.response?.data || err.message;
      console.error(`❌ Gagal untuk profil ${profileId}:`, JSON.stringify(msg));
      results.push({ profileId, success: false, error: msg });
    }
  }

  // Summary
  console.log('\n─── Summary ───────────────────────────────');
  results.forEach(r => {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} Profile ${r.profileId}`);
  });

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    throw new Error(`${failed.length} profil gagal diupload.`);
  }

  console.log('\n🎉 Semua profil berhasil diupdate di Buffer!');
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
