<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Alkitab Quote Generator</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;600&display=swap" rel="stylesheet">
<style>
  body {
    background: #000;
    color: #fff;
    font-family: 'Poppins', sans-serif;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
  .container {
    max-width: 800px;
    width: 100%;
    text-align: center;
  }
  button {
    margin-top: 20px;
    padding: 12px 24px;
    background: #fff;
    color: #000;
    border: none;
    cursor: pointer;
    font-family: 'Poppins', sans-serif;
    font-weight: 600;
    font-size: 16px;
    border-radius: 8px;
    transition: 0.3s;
  }
  button:hover {
    background: #ddd;
  }
  .loading {
    display: none;
    margin-top: 20px;
    font-size: 18px;
    color: #aaa;
  }
  canvas {
    display: none;
  }
  .info {
    margin-top: 30px;
    font-size: 12px;
    color: #555;
  }
</style>
</head>
<body>

<div class="container">
  <h2>🎨 Generator Ayat Alkitab Hari Ini</h2>
  <p style="color:#ccc; font-size:14px;">Klik tombol di bawah untuk mengambil ayat dari API dan membuat gambar quote.</p>
  <button id="generateBtn">✨ GENERATE FROM API ✨</button>
  <div class="loading" id="loadingMsg">Mengambil data dari API... Mohon tunggu.</div>
  <div id="statusMsg" style="margin-top:15px; font-size:14px; color:#ffaa00;"></div>
</div>

<div id="canvas_container"></div>
<div class="info">© SABDA.org | LAI 1974 | Gambar dibuat secara lokal di browser Anda.</div>

<script>
  const apiUrl = 'https://alkitab.sabda.org/api/vod.php?format=jsonp';

  // Fungsi wrapText (sama seperti milik Anda)
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    if (!text) return [];
    var words = text.split(' ');
    var line = '';
    var lines = [];

    for (var n = 0; n < words.length; n++) {
      var testLine = line + words[n] + ' ';
      var metrics = ctx.measureText(testLine);
      var testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        lines.push(line);
        line = words[n] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);
    return lines;
  }

  // Fungsi untuk membersihkan teks dari tanda kutip berlebih dan karakter aneh
  function cleanText(text) {
    if (!text) return '';
    // Hapus tanda kutip di awal dan akhir jika ada
    let cleaned = text.replace(/^"|"$/g, '');
    // Hapus karakter backslash yang tidak perlu
    cleaned = cleaned.replace(/\\"/g, '"');
    return cleaned.trim();
  }

  // Fungsi untuk mengambil data dari API (menggunakan JSONP karena CORS)
  function fetchVerseData() {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_callback_' + Date.now();
      const script = document.createElement('script');
      
      // Definisikan fungsi callback global
      window[callbackName] = (data) => {
        delete window[callbackName];
        document.body.removeChild(script);
        resolve(data);
      };
      
      // Handle error
      script.onerror = () => {
        delete window[callbackName];
        document.body.removeChild(script);
        reject(new Error('Gagal mengambil data dari API. Cek koneksi atau CORS.'));
      };
      
      // Buat URL dengan callback
      script.src = `${apiUrl}&callback=${callbackName}`;
      document.body.appendChild(script);
    });
  }

  // Fungsi untuk membuat gambar dari data ayat
  function generateImageFromVerse(verseData) {
    return new Promise((resolve, reject) => {
      try {
        // Ekstrak data dari respons API
        let rawText = verseData.html?.text || '';
        let passage = verseData.html?.passage || 'Alkitab';
        let bookAbbr = verseData.html?.abbr || '';
        let chapter = verseData.html?.chapter || '';
        let verse = verseData.html?.verse || '';
        
        if (!rawText && !passage) {
          reject(new Error('Data ayat tidak lengkap dari API.'));
          return;
        }
        
        // Bersihkan teks ayat
        let cleanVerseText = cleanText(rawText);
        
        // Format judul (passage)
        let titleText = passage || `${bookAbbr} ${chapter}:${verse}`;
        
        // Jika teks kosong, gunakan teks dari properti 'text' langsung jika ada
        if (!cleanVerseText && verseData.html?.text) {
          cleanVerseText = cleanText(verseData.html.text);
        }
        
        // Fallback jika tetap kosong
        if (!cleanVerseText) {
          cleanVerseText = "Kamu adalah garam dunia... (Matius 5:13)";
        }
        
        // Buat canvas
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1920;
        const ctx = canvas.getContext('2d');
        
        // === 1. BACKGROUND hitam ===
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // === 2. BIG QUOTE tanda petik ===
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 200px 'Poppins', sans-serif";
        ctx.fillText("“", 80, 250);
        
        // === 3. TITLE (passage) ===
        ctx.font = "600 55px 'Poppins', sans-serif";
        let titleLines = wrapText(ctx, titleText, 100, 420, 880, 75);
        let yPos = 420;
        titleLines.forEach(line => {
          ctx.fillText(line, 100, yPos);
          yPos += 75;
        });
        
        // === 4. CONTENT (teks ayat) ===
        ctx.font = "300 46px 'Poppins', sans-serif";
        let contentLines = wrapText(ctx, cleanVerseText, 100, yPos + 50, 880, 70);
        yPos += 50;
        contentLines.forEach(line => {
          ctx.fillText(line, 100, yPos);
          yPos += 70;
        });
        
        // === 5. WATERMARK ===
        ctx.font = "300 34px 'Poppins', sans-serif";
        ctx.fillStyle = "#888888";
        ctx.fillText("@sukalogika", 100, 1820);
        

        
        // Konversi ke URL data
        const dataURL = canvas.toDataURL('image/png');
        resolve({ dataURL, title: titleText });
        
      } catch (err) {
        reject(err);
      }
    });
  }
  
  // Fungsi untuk otomatis mendownload gambar
  function downloadImage(dataURL, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    link.click();
  }
  
  // MAIN PROCESS: Tombol ditekan
  async function onGenerate() {
    const btn = document.getElementById('generateBtn');
    const loadingDiv = document.getElementById('loadingMsg');
    const statusDiv = document.getElementById('statusMsg');
    
    // Disable button sambil loading
    btn.disabled = true;
    btn.style.opacity = '0.5';
    loadingDiv.style.display = 'block';
    statusDiv.innerHTML = '';
    
    try {
      // 1. Ambil data dari API
      statusDiv.innerHTML = '📡 Mengambil ayat dari API SABDA...';
      const verseData = await fetchVerseData();
      console.log('Data dari API:', verseData);
      
      // 2. Generate gambar dari data
      statusDiv.innerHTML = '🎨 Membuat gambar quote...';
      const { dataURL, title } = await generateImageFromVerse(verseData);
      
      // 3. Download gambar
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `alkitab_quote_${safeTitle}.png`;
      downloadImage(dataURL, filename);
      
      // 4. Tampilkan pesan sukses
      statusDiv.innerHTML = `✅ Sukses! Gambar "${title}" sudah didownload.`;
      loadingDiv.style.display = 'none';
      
      // Opsional: preview kecil (bisa ditampilkan jika ingin, tidak wajib)
      // const previewImg = new Image();
      // previewImg.src = dataURL;
      // previewImg.style.width = '200px';
      // document.getElementById('canvas_container').appendChild(previewImg);
      
    } catch (error) {
      console.error('Error:', error);
      statusDiv.innerHTML = `❌ Gagal: ${error.message}. Coba lagi nanti.`;
      loadingDiv.style.display = 'none';
    } finally {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
  
  // Pasang event listener setelah DOM siap
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('generateBtn');
    if (btn) {
      btn.addEventListener('click', onGenerate);
    }
  });
</script>
</body>
</html>