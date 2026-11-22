// =========================================================================
// Created by : Henky Adlin Shan - 2026
// MIT License
// KONFIGURASI MUDAH: CUKUP UBAH BAGIAN INI SAAT MAU UPDATE GAMBAR ATAU LINK
// =========================================================================
const CONFIG = {
  // Taruh file gambar PNG/JPG Anda di folder "images/" (misal: "images/hero.png")
  // Jika dikosongkan "", website otomatis memakai gambar garis bawaan.
  heroImage: "image/birth-of-jesus-coloring-page.jpg",
  coloringPreviewImage: "image/jesus-calms-the-storm-coloring-page.jpg",
  amazonCoverImage: "image/church-volunteer-coloring-page.jpg", // Contoh: "images/cover-buku-gereja.jpg"
};

const COLORS = [
  { hex: "#fca5a5", name: "Merah Pastel" },
  { hex: "#fdba74", name: "Oranye Pastel" },
  { hex: "#fef08a", name: "Kuning Pastel" },
  { hex: "#bef264", name: "Hijau Muda Pastel" },
  { hex: "#86efac", name: "Hijau Pastel" },
  { hex: "#93c5fd", name: "Biru Pastel" },
  { hex: "#c4b5fd", name: "Ungu Pastel" },
  { hex: "#f9a8d4", name: "Merah Muda Pastel" },
  { hex: "#d6b89e", name: "Cokelat Pastel" },
  { hex: "#d6d3d1", name: "Abu-abu Pastel" },
  { hex: "#78716c", name: "Hitam Pastel (Arang)" },
  { hex: "#ffffff", name: "Putih (Hapus)" },
];

let selectedColor = COLORS[0].hex;
let soundOn = true;
let paintCount = 0;
let audioCtx = null;

function blip() {
  if (!soundOn) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(780, t + 0.08);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  } catch (err) {
    // Ignore restricted audio context errors
  }
}

function bucketSVG(hex) {
  const shade = hex.toLowerCase() === "#ffffff" ? "#e4e4e7" : "rgba(0,0,0,0.16)";
  return `
    <svg viewBox="0 0 64 64" class="w-7 h-7 sm:w-9 sm:h-9 pointer-events-none" aria-hidden="true">
      <path d="M14 24 Q32 -2 50 24" fill="none" stroke="#18181B" stroke-width="3.5" stroke-linecap="round" />
      <path d="M11 24 H53 L47 56 Q32 62 17 56 Z" fill="${hex}" stroke="#18181B" stroke-width="3.2" stroke-linejoin="round" />
      <path d="M20 25 V35 Q20 39 23.5 39 Q27 39 27 34 V25 Z" fill="${hex}" stroke="#18181B" stroke-width="2.4" stroke-linejoin="round" />
      <ellipse cx="32" cy="24" rx="21" ry="5.8" fill="${hex}" stroke="#18181B" stroke-width="3.2" />
      <ellipse cx="32" cy="24" rx="15" ry="3.2" fill="${shade}" />
    </svg>
  `;
}

function bumpCount() {
  paintCount += 1;
  const counterEl = document.getElementById("paint-counter");
  if (counterEl) {
    counterEl.textContent = paintCount + " aksi";
  }
}

// Render 12 Paint Buckets in Dock
function initBuckets() {
  const bucketsEl = document.getElementById("buckets");
  const swatchEl = document.getElementById("active-swatch");
  const nameEl = document.getElementById("active-name");
  if (!bucketsEl) return;

  function renderBuckets() {
    bucketsEl.innerHTML = "";
    COLORS.forEach((c) => {
      const isSelected = c.hex.toLowerCase() === selectedColor.toLowerCase();
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", String(isSelected));
      btn.setAttribute("aria-label", "Ember warna " + c.name);
      btn.title = c.name + " — klik lalu sentuh huruf atau gambar";
      btn.className =
        "shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center cursor-pointer transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 " +
        (isSelected
          ? "bg-zinc-900/10 ring-2 ring-zinc-900 -translate-y-1 scale-105"
          : "hover:-translate-y-0.5 hover:bg-zinc-900/5");
      btn.innerHTML = bucketSVG(c.hex);
      btn.addEventListener("click", () => {
        selectedColor = c.hex;
        if (swatchEl) swatchEl.style.backgroundColor = c.hex;
        if (nameEl) nameEl.textContent = c.name;
        renderBuckets();
      });
      bucketsEl.appendChild(btn);
    });
  }

  renderBuckets();
}

// Render Colorable Letters (white fill + black border, changes color on click)
function initColorableWords() {
  document.querySelectorAll(".colorable-word").forEach((wrap) => {
    const text = wrap.dataset.text || "";
    const size = wrap.dataset.size || "hero";
    wrap.innerHTML = "";

    Array.from(text).forEach((ch) => {
      if (ch === " ") {
        const space = document.createElement("span");
        space.className = "inline-block w-[0.28em]";
        space.setAttribute("aria-hidden", "true");
        space.innerHTML = "&nbsp;";
        wrap.appendChild(space);
        return;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = ch;
      btn.setAttribute("aria-label", 'Warnai huruf "' + ch + '"');
      btn.title = 'Klik untuk mewarnai huruf "' + ch + '"';
      btn.style.color = "#FFFFFF";

      const sizeClasses =
        size === "brand"
          ? "colorable-glyph-sm text-2xl sm:text-[26px] tracking-tight"
          : size === "section"
          ? "colorable-glyph text-3xl sm:text-4xl lg:text-[42px] tracking-tight"
          : "colorable-glyph text-[44px] sm:text-6xl lg:text-[72px] leading-[1.06] tracking-tight";

      btn.className =
        sizeClasses +
        " glyph inline-block cursor-pointer select-none bg-transparent border-0 p-0 mx-[0.015em] hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 rounded-sm";

      btn.addEventListener("click", () => {
        btn.style.color = selectedColor;
        btn.classList.remove("animate-pop-fill");
        void btn.offsetWidth;
        btn.classList.add("animate-pop-fill");
        bumpCount();
        blip();
      });

      wrap.appendChild(btn);
    });
  });

  document.querySelectorAll(".colorable-box").forEach((box) => {
    box.addEventListener("click", () => {
      box.style.backgroundColor = selectedColor;
      bumpCount();
      blip();
    });
  });
}

// Flood-fill Canvas Engine
function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  return [
    parseInt(full.slice(0, 2), 16) || 255,
    parseInt(full.slice(2, 4), 16) || 255,
    parseInt(full.slice(4, 6), 16) || 255,
  ];
}

function floodFill(ctx, orig, sx, sy, hex) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return false;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const o = orig.data;
  const i0 = (sy * w + sx) * 4;

  const isLine = (i) => (o[i] + o[i + 1] + o[i + 2]) / 3 < 95;
  if (isLine(i0)) return false;

  const sr = d[i0];
  const sg = d[i0 + 1];
  const sb = d[i0 + 2];
  const [r, g, b] = hexToRgb(hex);

  if (Math.abs(sr - r) + Math.abs(sg - g) + Math.abs(sb - b) < 12) return false;

  const ok = (i) =>
    Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb) <= 140 &&
    !isLine(i);

  const seen = new Uint8Array(w * h);
  const st = [sx, sy];

  while (st.length) {
    const y = st.pop();
    let x = st.pop();
    let k = y * w + x;

    while (x > 0 && !seen[k - 1] && ok((k - 1) * 4)) {
      x -= 1;
      k -= 1;
    }

    let up = false;
    let dn = false;
    while (x < w && !seen[k] && ok(k * 4)) {
      seen[k] = 1;
      const idx = k * 4;
      d[idx] = r;
      d[idx + 1] = g;
      d[idx + 2] = b;
      d[idx + 3] = 255;

      if (y > 0) {
        const u = k - w;
        if (!seen[u] && ok(u * 4)) {
          if (!up) {
            st.push(x, y - 1);
            up = true;
          }
        } else {
          up = false;
        }
      }

      if (y < h - 1) {
        const v = k + w;
        if (!seen[v] && ok(v * 4)) {
          if (!dn) {
            st.push(x, y + 1);
            dn = true;
          }
        } else {
          dn = false;
        }
      }

      x += 1;
      k += 1;
    }
  }

  ctx.putImageData(img, 0, 0);
  return true;
}

function drawHeroFallback(ctx, w, h) {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#18181B";
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  [210, 178, 146].forEach((r) => {
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.68, r, Math.PI, 0, false);
    ctx.stroke();
  });

  ctx.beginPath();
  ctx.arc(640, 96, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(640 + Math.cos(a) * 54, 96 + Math.sin(a) * 54);
    ctx.lineTo(640 + Math.cos(a) * 74, 96 + Math.sin(a) * 74);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(76, 142);
  ctx.arc(104, 122, 28, Math.PI * 0.85, Math.PI * 1.9);
  ctx.arc(150, 110, 36, Math.PI * 1.05, Math.PI * 1.95);
  ctx.arc(194, 126, 26, Math.PI * 1.2, Math.PI * 0.25);
  ctx.lineTo(76, 150);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, 385);
  ctx.quadraticCurveTo(210, 290, 420, 370);
  ctx.quadraticCurveTo(610, 305, w, 365);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, 440);
  ctx.quadraticCurveTo(260, 375, 520, 445);
  ctx.quadraticCurveTo(670, 480, w, 420);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(318, 286, 164, 118);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(298, 286);
  ctx.lineTo(400, 206);
  ctx.lineTo(502, 286);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(374, 404);
  ctx.lineTo(374, 344);
  ctx.arc(400, 344, 26, Math.PI, 0, false);
  ctx.lineTo(426, 404);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(393, 146);
  ctx.lineTo(407, 146);
  ctx.lineTo(407, 168);
  ctx.lineTo(426, 168);
  ctx.lineTo(426, 182);
  ctx.lineTo(407, 182);
  ctx.lineTo(407, 206);
  ctx.lineTo(393, 206);
  ctx.lineTo(393, 182);
  ctx.lineTo(374, 182);
  ctx.lineTo(374, 168);
  ctx.lineTo(393, 168);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(92, 425);
  ctx.quadraticCurveTo(154, 404, 210, 425);
  ctx.lineTo(210, 520);
  ctx.quadraticCurveTo(154, 500, 92, 520);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(210, 425);
  ctx.quadraticCurveTo(266, 404, 328, 425);
  ctx.lineTo(328, 520);
  ctx.quadraticCurveTo(266, 500, 210, 520);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawArkFallback(ctx, w, h) {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#18181B";
  ctx.lineWidth = 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.arc(540, 96, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(116, 128);
  ctx.quadraticCurveTo(148, 86, 190, 112);
  ctx.quadraticCurveTo(212, 96, 228, 108);
  ctx.quadraticCurveTo(208, 130, 188, 142);
  ctx.quadraticCurveTo(154, 156, 116, 128);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, 355);
  ctx.quadraticCurveTo(160, 285, 320, 355);
  ctx.quadraticCurveTo(480, 290, w, 355);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.rect(200, 226, 240, 82);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(182, 226);
  ctx.lineTo(320, 166);
  ctx.lineTo(458, 226);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(106, 308);
  ctx.lineTo(534, 308);
  ctx.lineTo(482, 404);
  ctx.lineTo(158, 404);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, 408);
  for (let x = 0; x <= w; x += 80) {
    ctx.quadraticCurveTo(x + 40, 378, x + 80, 408);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function setupCanvas(canvasId, imageUrl, fallbackFn) {
  const cv = document.getElementById(canvasId);
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  let orig = null;

  function loadSrc(src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, cv.width, cv.height);
      const s = Math.min((cv.width - 24) / img.width, (cv.height - 24) / img.height);
      const dw = img.width * s;
      const dh = img.height * s;
      ctx.drawImage(img, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
      orig = ctx.getImageData(0, 0, cv.width, cv.height);
    };
    img.onerror = () => {
      fallbackFn(ctx, cv.width, cv.height);
      orig = ctx.getImageData(0, 0, cv.width, cv.height);
    };
    img.src = src;
  }

  if (imageUrl) {
    loadSrc(imageUrl);
  } else {
    fallbackFn(ctx, cv.width, cv.height);
    orig = ctx.getImageData(0, 0, cv.width, cv.height);
  }

  cv.addEventListener("pointerdown", (e) => {
    if (!orig) return;
    const r = cv.getBoundingClientRect();
    const px = Math.floor(((e.clientX - r.left) / r.width) * cv.width);
    const py = Math.floor(((e.clientY - r.top) / r.height) * cv.height);
    if (floodFill(ctx, orig, px, py, selectedColor)) {
      bumpCount();
      blip();
      cv.classList.add("scale-[1.012]");
      setTimeout(() => cv.classList.remove("scale-[1.012]"), 150);
    }
  });

  return {
    reset: () => {
      if (orig) ctx.putImageData(orig, 0, 0);
    },
    fillSeeds: (seeds) => {
      if (!orig) return;
      ctx.putImageData(orig, 0, 0);
      seeds.forEach(([x, y, c]) => floodFill(ctx, orig, x, y, c));
    },
    loadFile: (file) => {
      const url = URL.createObjectURL(file);
      loadSrc(url);
    },
  };
}

function initAmazonCoverSlot() {
  const amzSlot = document.getElementById("amazon-cover-slot");
  if (!amzSlot) return;

  function renderFallback() {
    amzSlot.innerHTML = `
      <svg viewBox="0 0 320 380" class="w-full h-auto block select-none" role="img" aria-label="Ilustrasi buku multimedia gereja yang dapat diklik untuk diwarnai">
        <rect x="24" y="18" width="32" height="344" rx="6" fill="#FFFFFF" stroke="#18181B" stroke-width="4" />
        <rect x="52" y="18" width="244" height="344" rx="10" fill="#FFFFFF" stroke="#18181B" stroke-width="4" />
        <polygon points="116,44 76,170 156,170" fill="#FFFFFF" stroke="#18181B" stroke-width="3" stroke-linejoin="round" />
        <polygon points="232,44 192,170 272,170" fill="#FFFFFF" stroke="#18181B" stroke-width="3" stroke-linejoin="round" />
        <rect x="82" y="86" width="184" height="112" rx="8" fill="#FFFFFF" stroke="#18181B" stroke-width="4" />
        <path d="M 169 106 H 179 V 126 H 197 V 136 H 179 V 178 H 169 V 136 H 151 V 126 H 169 Z" fill="#FFFFFF" stroke="#18181B" stroke-width="3.5" stroke-linejoin="round" />
        <rect x="82" y="222" width="184" height="72" rx="8" fill="#FFFFFF" stroke="#18181B" stroke-width="4" />
        <rect x="104" y="238" width="24" height="40" rx="4" fill="#FFFFFF" stroke="#18181B" stroke-width="3" />
        <rect x="162" y="238" width="24" height="40" rx="4" fill="#FFFFFF" stroke="#18181B" stroke-width="3" />
        <rect x="220" y="238" width="24" height="40" rx="4" fill="#FFFFFF" stroke="#18181B" stroke-width="3" />
        <text x="174" y="330" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="16" fill="#18181B" pointer-events="none">MULTIMEDIA GEREJA</text>
      </svg>
    `;
    amzSlot.querySelectorAll("rect, polygon, path").forEach((el) => {
      el.classList.add("cursor-pointer");
      el.addEventListener("click", () => {
        el.setAttribute("fill", selectedColor);
        bumpCount();
        blip();
      });
    });
  }

  if (CONFIG.amazonCoverImage) {
    const img = document.createElement("img");
    img.src = CONFIG.amazonCoverImage;
    img.alt = "Sampul Buku Multimedia Gereja di Amazon";
    img.referrerPolicy = "no-referrer";
    img.className = "w-full h-auto rounded-xl border-2 border-zinc-900 shadow-[4px_4px_0_#18181B]";
    img.onerror = renderFallback;
    amzSlot.appendChild(img);
  } else {
    renderFallback();
  }
}

async function loadLatestVerse() {
  try {
    const res = await fetch("/vod-image/latest-meta.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (data.text && data.passage) {
      const textEl = document.getElementById("verseText");
      const refEl = document.getElementById("verseRef");
      if (textEl) textEl.textContent = '"' + data.text.replace(/["\u201c\u201d]+$/g, "").trim() + '"';
      if (refEl) refEl.textContent = "— " + data.passage;
    }
  } catch (err) {
    // Fallback to static verse in HTML
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initBuckets();
  initColorableWords();
  initAmazonCoverSlot();

  const heroCanvas = setupCanvas("cv-hero", CONFIG.heroImage, drawHeroFallback);
  const arkCanvas = setupCanvas("cv-ark", CONFIG.coloringPreviewImage, drawArkFallback);

  const btnAuto = document.getElementById("btn-auto");
  if (btnAuto) {
    btnAuto.addEventListener("click", () => {
      const palette = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"];
      document.querySelectorAll(".glyph").forEach((g, idx) => {
        g.style.color = palette[idx % palette.length];
      });
      if (!CONFIG.heroImage) {
        heroCanvas.fillSeeds([
          [40, 40, "#7dd3fc"],
          [640, 96, "#facc15"],
          [400, 120, "#ef4444"],
          [400, 152, "#facc15"],
          [400, 184, "#3b82f6"],
          [120, 360, "#a3e635"],
          [650, 480, "#22c55e"],
          [400, 256, "#ef4444"],
          [350, 340, "#fff7ed"],
          [400, 380, "#92400e"],
          [400, 175, "#facc15"],
          [260, 465, "#fef08a"],
        ]);
      }
      if (!CONFIG.coloringPreviewImage) {
        arkCanvas.fillSeeds([
          [40, 40, "#7dd3fc"],
          [540, 96, "#facc15"],
          [80, 350, "#22c55e"],
          [320, 204, "#ef4444"],
          [320, 265, "#f97316"],
          [320, 355, "#92400e"],
          [320, 450, "#3b82f6"],
        ]);
      }
      blip();
    });
  }

  const btnReset = document.getElementById("btn-reset");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      document.querySelectorAll(".glyph").forEach((g) => {
        g.style.color = "#FFFFFF";
      });
      document.querySelectorAll(".colorable-box").forEach((b) => {
        b.style.backgroundColor = "#FFFFFF";
      });
      heroCanvas.reset();
      arkCanvas.reset();
      paintCount = 0;
      const counterEl = document.getElementById("paint-counter");
      if (counterEl) counterEl.textContent = "0 aksi";
      initAmazonCoverSlot();
      blip();
    });
  }

  const picker = document.getElementById("file-picker");
  const btnUpload = document.getElementById("btn-upload");
  if (btnUpload && picker) {
    btnUpload.addEventListener("click", () => picker.click());
    picker.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) heroCanvas.loadFile(f);
    });
  }

  const btnSound = document.getElementById("btn-sound");
  if (btnSound) {
    btnSound.addEventListener("click", () => {
      soundOn = !soundOn;
      btnSound.textContent = soundOn ? "Suara Nyala" : "Suara Mati";
    });
  }

  loadLatestVerse();
});
