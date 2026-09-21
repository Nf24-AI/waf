/**
 * لوحة صفحة الهبوط: صورة تُقرأ خليةً خلية وتُعاد رسماً بالحروف.
 *
 * الوصفة من 21st.dev/community/ascii بإعدادات «Forest»، بتعديلين: الرمادي
 * مُطفأ فتبقى ألوان الصورة، والتشبّع مرفوع قليلاً ليعوّض ما تأكله الشبكة.
 * الصورة كحلية بنوافذ ذهبية، وهي ألوان ثيم navy نفسها — فاللوحة هوية لا زينة.
 *
 * الألوان كلها من رموز واف، تُقرأ من العنصر وقت التشغيل لا تُكتب هنا. الاستثناء
 * الوحيد قناعا القناتين في الزيغ اللوني: هما فيزياء عدسة لا خيار لوني.
 *
 * jsdom لا يعطي سياق 2d، فيرجع المحرّك خاملاً بدل أن يرمي — الاختبارات ترسم
 * الصفحة ولا تعنيها اللوحة.
 */

import { prefersReducedMotion } from "./motion";

export type RenderMode = "characters" | "dots" | "mosaic" | "halfblocks";

/** سلّم قياسي: من الفراغ إلى أكثف محرف. */
const RAMP = " .:-=+*#%@";

/** إعدادات الوصفة. أسماؤها كما في المصدر حتى تبقى قابلة للمقارنة به. */
const P = {
  bgBlur: 2,
  bgOpacity: 90,
  cellSize: 10,
  coverage: 100,
  invert: false,
  brightness: 0,
  contrast: 128,
  density: 0,
  saturation: 12,
  grayscale: 0,
  blurAmount: 30,
  tiltFocus: 35,
  tiltPosition: 50,
  tiltFeather: 15,
  chromatic: 20,
  halftone: 20,
  filmDust: 20,
  animIntensity: 60,
  animSpeed: 100,
} as const;

/** أقنعة القناتين: أحمر وأزرق خالصان، لا لونان من اللوحة. */
const CHANNEL_RED = "#ff3b3b";
const CHANNEL_BLUE = "#3b7bff";

export interface AsciiStageOptions {
  /** مقاس صندوق الاسم بالبكسل، ليُبحث له عن فراغ يسعه. */
  getBrandBox: () => { width: number; height: number } | null;
  /** مركز الفراغ المختار، نسبةً مئوية من اللوحة. */
  onPlace: (xPercent: number, yPercent: number) => void;
}

export interface AsciiStage {
  setMode(mode: RenderMode): void;
  /** يُعاد النداء حين يتغيّر مقاس الاسم — بعد حلول الخط أو انتهاء الكتابة. */
  reposition(): void;
  destroy(): void;
}

function token(el: Element, name: string, fallback: string) {
  const value = getComputedStyle(el).getPropertyValue(name).trim();
  return value || fallback;
}

function clamp255(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export function createAsciiStage(
  canvas: HTMLCanvasElement,
  src: string,
  options: AsciiStageOptions,
): AsciiStage {
  // jsdom لا يعطي سياقاً. الإسناد إلى ثابت بعد الفحص يُبقي التضييق داخل
  // الإغلاقات، وإلا عاد النوع nullable في كل دالة أدناه.
  const maybeCtx = canvas.getContext("2d", { alpha: false });
  if (!maybeCtx) {
    return { setMode() {}, reposition() {}, destroy() {} };
  }
  const ctx = maybeCtx;

  const grid = document.createElement("canvas");
  const gridCtx = grid.getContext("2d", { willReadFrequently: true })!;
  const layer = document.createElement("canvas");
  const layerCtx = layer.getContext("2d")!;
  const scratch = document.createElement("canvas");
  const scratchCtx = scratch.getContext("2d")!;
  const plain = document.createElement("canvas");
  const plainCtx = plain.getContext("2d")!;

  const reduced = prefersReducedMotion();

  let mode: RenderMode = "characters";
  let cols = 0;
  let rows = 0;
  let cell = P.cellSize;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let lum: Float32Array | null = null;
  let rgb: Uint8Array | null = null;
  let halftone: CanvasPattern | null = null;
  let dust: { x: number; y: number; len: number; angle: number; opacity: number }[] = [];
  let ready = false;
  let running = false;
  let frame = 0;
  let startedAt = 0;
  let lastDraw = 0;
  let resizeTimer = 0;
  const pointer = { x: 0, y: 0, on: false };

  const ink = {
    sunken: token(canvas, "--surface-sunken", "#08111F"),
    primary: token(canvas, "--text-primary", "#F4F8FF"),
    accent: token(canvas, "--accent", "#D4B06A"),
  };

  const image = new Image();

  /* ── تعديل اللون: سطوع ← تباين ← تشبّع ← رمادي ── */
  function adjust(r: number, g: number, b: number): [number, number, number] {
    const bump = (P.brightness / 100) * 255;
    r += bump;
    g += bump;
    b += bump;

    const c = P.contrast / 100;
    r = (r - 128) * c + 128;
    g = (g - 128) * c + 128;
    b = (b - 128) * c + 128;

    let l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const s = 1 + P.saturation / 100;
    r = l + (r - l) * s;
    g = l + (g - l) * s;
    b = l + (b - l) * s;

    if (P.grayscale > 0) {
      const k = P.grayscale / 100;
      l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r += (l - r) * k;
      g += (l - g) * k;
      b += (l - b) * k;
    }
    return [clamp255(r), clamp255(g), clamp255(b)];
  }

  /** نطاق حادّ بعرض tiltFocus حول tiltPosition، وحوله ريشة. */
  function focusWeight(y: number) {
    const centre = P.tiltPosition / 100;
    const half = P.tiltFocus / 100 / 2;
    const feather = Math.max(0.001, P.tiltFeather / 100);
    const d = Math.abs(y - centre);
    return d <= half ? 1 : Math.max(0, 1 - (d - half) / feather);
  }

  function measure() {
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    dpr = Math.min(window.devicePixelRatio || 1, box.width < 520 ? 1.5 : 2);
    cell = P.cellSize;
    cols = Math.max(12, Math.floor(box.width / cell));
    rows = Math.max(12, Math.floor(box.height / cell));
    width = cols * cell;
    height = rows * cell;
    for (const c of [canvas, layer, scratch, plain]) {
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
    }
    for (const c of [ctx, layerCtx, scratchCtx, plainCtx]) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    grid.width = cols;
    grid.height = rows;
    return true;
  }

  function sample() {
    // قصّ تغطية منحاز للأسفل: الجبال والقرية تبقى داخل الإطار.
    const ar = width / height;
    const ia = image.width / image.height;
    let sx: number, sy: number, sw: number, sh: number;
    if (ia > ar) {
      sh = image.height;
      sw = sh * ar;
      sx = (image.width - sw) / 2;
      sy = 0;
    } else {
      sw = image.width;
      sh = sw / ar;
      sx = 0;
      sy = (image.height - sh) * 0.93;
    }

    gridCtx.clearRect(0, 0, cols, rows);
    gridCtx.drawImage(image, sx, sy, sw, sh, 0, 0, cols, rows);
    const data = gridCtx.getImageData(0, 0, cols, rows).data;
    const n = cols * rows;

    lum = new Float32Array(n);
    rgb = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) {
      const [r, g, b] = adjust(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      rgb[i * 3] = r;
      rgb[i * 3 + 1] = g;
      rgb[i * 3 + 2] = b;
      lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    }

    // الصورة ليلية: بلا فرد المدى ينحشر السلّم كلّه في طرفه المظلم. المئين
    // ٢ و٩٨ يمنعان نافذة مضيئة واحدة من ابتلاع المدى.
    const sorted = Float32Array.from(lum).sort();
    const lo = sorted[Math.floor(n * 0.02)];
    const hi = sorted[Math.floor(n * 0.98)];
    const span = Math.max(0.06, hi - lo);
    for (let i = 0; i < n; i++) {
      const v = (lum[i] - lo) / span;
      lum[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }

    // الخلفية: نسخة مموّهة من الصورة نفسها.
    plainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    plainCtx.clearRect(0, 0, width, height);
    plainCtx.fillStyle = ink.sunken;
    plainCtx.fillRect(0, 0, width, height);
    plainCtx.save();
    plainCtx.filter = `blur(${P.bgBlur}px) contrast(${P.contrast}%) saturate(${100 + P.saturation}%)`;
    plainCtx.globalAlpha = P.bgOpacity / 100;
    plainCtx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    plainCtx.restore();

    buildHalftone();
    buildDust();
  }

  function buildHalftone() {
    const size = 3;
    const tile = document.createElement("canvas");
    tile.width = size;
    tile.height = size;
    const tc = tile.getContext("2d");
    if (!tc) return;
    tc.fillStyle = ink.sunken;
    tc.beginPath();
    tc.arc(size / 2, size / 2, 0.78, 0, Math.PI * 2);
    tc.fill();
    halftone = ctx.createPattern(tile, "repeat");
  }

  function buildDust() {
    dust = [];
    const n = Math.round((P.filmDust / 100) * 30);
    for (let i = 0; i < n; i++) {
      dust.push({
        x: Math.random(),
        y: Math.random(),
        len: Math.random() < 0.26 ? 6 + Math.random() * 30 : 0,
        angle: Math.random() * Math.PI,
        opacity: 0.08 + Math.random() * 0.2,
      });
    }
  }

  /**
   * الفراغ يُعرَّف قياساً لا تخميناً: أقلّ منطقة حافّةً وأخفضها ضوءاً. البيوت
   * والأسطح والنوافذ هي أعلى ما في الصورة في الاثنين، فلا يقع عليها الاختيار.
   */
  function placeBrand() {
    if (!lum || !cols || !rows) return;
    const box = options.getBrandBox();
    const stage = canvas.getBoundingClientRect();
    if (!box || !box.width || !stage.width || !stage.height) return;

    const bw = Math.min(0.92, box.width / stage.width);
    const bh = Math.min(0.9, box.height / stage.height);
    const padX = Math.min(0.5, bw / 2 + 0.03);
    const padY = Math.min(0.5, bh / 2 + 0.045);

    let best: { score: number; x: number; y: number } | null = null;
    const step = 0.03;
    for (let cy = padY; cy <= 1 - padY + 1e-9; cy += step) {
      for (let cx = padX; cx <= 1 - padX + 1e-9; cx += step) {
        const x0 = Math.max(0, Math.floor((cx - bw / 2 - 0.015) * cols));
        const x1 = Math.min(cols - 1, Math.ceil((cx + bw / 2 + 0.015) * cols));
        const y0 = Math.max(0, Math.floor((cy - bh / 2 - 0.025) * rows));
        const y1 = Math.min(rows - 1, Math.ceil((cy + bh / 2 + 0.025) * rows));

        let edge = 0;
        let sum = 0;
        let n = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = y * cols + x;
            const l = lum[i];
            edge += Math.abs(l - lum[i + 1]) + Math.abs(l - lum[i + cols]);
            sum += l;
            n++;
          }
        }
        if (!n) continue;
        edge /= n;
        sum /= n;

        // الحافّة تحكم، والضوء يليها، ثم ميل خفيف نحو وسط اللوحة.
        const dx = cx - 0.5;
        const dy = cy - 0.44;
        const score = edge * 4.4 + sum * 1.15 + Math.sqrt(dx * dx + dy * dy) * 0.5;
        if (!best || score < best.score) best = { score, x: cx, y: cy };
      }
    }
    if (best) options.onPlace(best.x * 100, best.y * 100);
  }

  /* ── الرسم ── */
  function draw(now: number) {
    if (!ready || !lum || !rgb) return;
    const t = running && !reduced ? (now - startedAt) / 1000 : 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink.sunken;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(plain, 0, 0, width, height);

    layerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layerCtx.clearRect(0, 0, width, height);
    drawCells(layerCtx, t);

    ctx.drawImage(layer, 0, 0, width, height);
    applyTilt();
    applyChromatic();
    applyHalftone();
    applyDust(t);
    if (pointer.on) applyReveal();
  }

  function drawCells(c: CanvasRenderingContext2D, t: number) {
    if (!lum || !rgb) return;
    const steps = RAMP.length;
    const amp = running && !reduced ? (P.animIntensity / 100) * 0.2 : 0;
    const speed = (P.animSpeed / 100) * 1.7;
    const dens = 1 + P.density / 100;
    const cov = P.coverage / 100;

    // التجميع بالحرف ولون مكمَّم: تبديل الحالة يبقى بالمئات لا بالآلاف.
    const groups = new Map<number, number[]>();
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let l = lum[i];
        if (amp > 0) {
          const wave = Math.sin(x * 0.55 + y * 0.33 - t * speed * 2);
          const fine = Math.sin(x * 2.7 - y * 1.9 + t * speed * 5);
          l += (wave * 0.6 + fine * 0.4) * amp;
        }
        l *= dens;
        if (P.invert) l = 1 - l;
        l = l < 0 ? 0 : l > 1 ? 1 : l;
        if (cov < 1 && ((x * 7919 + y * 104729) % 1000) / 1000 > cov) continue;

        const idx = Math.round(l * (steps - 1));
        if (idx <= 0 && mode === "characters") continue;

        // لون الخلية الأصلي، مرفوع إلى مستوى ضوئها بعد فرد المدى.
        const r = rgb[i * 3];
        const g = rgb[i * 3 + 1];
        const b = rgb[i * 3 + 2];
        const base = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 || 0.001;
        const gain = Math.min(1.55, (0.12 + l * 0.72) / base);
        const key =
          idx * 4096 + ((clamp255(r * gain) >> 4) << 8) + ((clamp255(g * gain) >> 4) << 4) + (clamp255(b * gain) >> 4);

        let bucket = groups.get(key);
        if (!bucket) {
          bucket = [];
          groups.set(key, bucket);
        }
        bucket.push(x, y);
      }
    }

    c.textAlign = "center";
    c.textBaseline = "middle";
    groups.forEach((list, key) => {
      const idx = Math.floor(key / 4096);
      const rest = key % 4096;
      const l = idx / (steps - 1);
      c.fillStyle = `rgb(${(rest >> 8) * 16 + 8},${((rest >> 4) & 15) * 16 + 8},${(rest & 15) * 16 + 8})`;

      if (mode === "characters") {
        const size = cell * (0.78 + 0.3 * l);
        c.font = `500 ${size.toFixed(1)}px ${getComputedStyle(canvas).getPropertyValue("--font-mono") || "monospace"}`;
        const ch = RAMP[idx];
        for (let m = 0; m < list.length; m += 2) {
          c.fillText(ch, list[m] * cell + cell / 2, list[m + 1] * cell + cell / 2);
        }
      } else if (mode === "dots") {
        const r = (cell / 2) * (0.18 + 0.82 * l);
        c.beginPath();
        for (let m = 0; m < list.length; m += 2) {
          const cx = list[m] * cell + cell / 2;
          const cy = list[m + 1] * cell + cell / 2;
          c.moveTo(cx + r, cy);
          c.arc(cx, cy, r, 0, Math.PI * 2);
        }
        c.fill();
      } else if (mode === "mosaic") {
        for (let m = 0; m < list.length; m += 2) {
          const s = cell * (0.3 + 0.7 * l);
          const off = (cell - s) / 2;
          c.fillRect(list[m] * cell + off, list[m + 1] * cell + off, s, s);
        }
      } else {
        for (let m = 0; m < list.length; m += 2) {
          const x = list[m] * cell;
          const y = list[m + 1] * cell;
          c.fillRect(x, y, cell, cell * 0.5 * (0.38 + 0.62 * l));
          c.fillRect(x, y + cell * 0.5, cell, cell * 0.5 * (0.22 + 0.78 * l));
        }
      }
    });
  }

  function applyTilt() {
    const maxBlur = (P.blurAmount / 100) * (cell * 0.42);
    if (maxBlur < 0.25) return;
    scratchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scratchCtx.globalCompositeOperation = "source-over";
    scratchCtx.clearRect(0, 0, width, height);
    scratchCtx.filter = `blur(${maxBlur.toFixed(2)}px)`;
    scratchCtx.drawImage(layer, 0, 0, width, height);
    scratchCtx.filter = "none";

    const g = scratchCtx.createLinearGradient(0, 0, 0, height);
    for (let s = 0; s <= 20; s++) {
      const y = s / 20;
      g.addColorStop(y, `rgba(0,0,0,${(1 - focusWeight(y)).toFixed(3)})`);
    }
    scratchCtx.globalCompositeOperation = "destination-in";
    scratchCtx.fillStyle = g;
    scratchCtx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(scratch, 0, 0, width, height);
  }

  function tintLayer(color: string) {
    scratchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scratchCtx.globalCompositeOperation = "source-over";
    scratchCtx.clearRect(0, 0, width, height);
    scratchCtx.drawImage(layer, 0, 0, width, height);
    scratchCtx.globalCompositeOperation = "multiply";
    scratchCtx.fillStyle = color;
    scratchCtx.fillRect(0, 0, width, height);
    scratchCtx.globalCompositeOperation = "destination-in";
    scratchCtx.drawImage(layer, 0, 0, width, height);
    scratchCtx.globalCompositeOperation = "source-over";
  }

  function applyChromatic() {
    const d = (P.chromatic / 100) * 4.5;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.3;
    tintLayer(CHANNEL_RED);
    ctx.drawImage(scratch, d, 0, width, height);
    tintLayer(CHANNEL_BLUE);
    ctx.drawImage(scratch, -d, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function applyHalftone() {
    if (!halftone) return;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = (P.halftone / 100) * 0.34;
    ctx.fillStyle = halftone;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function applyDust(t: number) {
    const seed = Math.floor(t * 3);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = ink.primary;
    ctx.fillStyle = ink.primary;
    dust.forEach((p, i) => {
      const j = ((i * 7 + seed * 13) % 17) / 17;
      const x = (p.x + j * 0.012) * width;
      const y = (p.y + (((i * 3 + seed * 5) % 11) / 11) * 0.012) * height;
      ctx.globalAlpha = p.opacity * (0.45 + j * 0.55);
      if (p.len > 0) {
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(p.angle) * p.len, y + Math.sin(p.angle) * p.len);
        ctx.stroke();
      } else {
        ctx.fillRect(x, y, 1.1, 1.1);
      }
    });
    ctx.restore();
  }

  /** نافذة ترجع إلى الصورة نفسها تحت المؤشر — القناع الذي تركته الوصفة مطفأً. */
  function applyReveal() {
    const r = Math.min(width, height) * 0.26;
    scratchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scratchCtx.globalCompositeOperation = "source-over";
    scratchCtx.clearRect(0, 0, width, height);
    scratchCtx.drawImage(plain, 0, 0, width, height);
    const g = scratchCtx.createRadialGradient(pointer.x, pointer.y, r * 0.12, pointer.x, pointer.y, r);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.6, "rgba(0,0,0,.7)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    scratchCtx.globalCompositeOperation = "destination-in";
    scratchCtx.fillStyle = g;
    scratchCtx.fillRect(0, 0, width, height);

    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(scratch, 0, 0, width, height);
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = ink.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function loop(now: number) {
    if (!running) return;
    if (now - lastDraw > 33) {
      lastDraw = now;
      draw(now);
    }
    frame = requestAnimationFrame(loop);
  }

  function onPointerMove(event: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    pointer.x = (event.clientX - box.left) * (width / box.width);
    pointer.y = (event.clientY - box.top) * (height / box.height);
    pointer.on = true;
    if (!running) draw(performance.now());
  }

  function onPointerLeave() {
    pointer.on = false;
    if (!running) draw(performance.now());
  }

  function onResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (ready && measure()) {
        sample();
        draw(performance.now());
        placeBrand();
      }
    }, 200);
  }

  image.onload = () => {
    if (!measure()) {
      window.setTimeout(() => image.onload?.(new Event("load")), 90);
      return;
    }
    sample();
    ready = true;
    draw(performance.now());
    placeBrand();
    if (!reduced) {
      running = true;
      startedAt = performance.now();
      frame = requestAnimationFrame(loop);
    }
  };
  image.src = src;

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("resize", onResize);

  return {
    setMode(next) {
      mode = next;
      draw(performance.now());
    },
    reposition() {
      placeBrand();
    },
    destroy() {
      running = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(resizeTimer);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
      image.onload = null;
    },
  };
}
