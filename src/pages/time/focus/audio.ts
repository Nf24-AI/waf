// الأصوات كلها مولَّدة في المتصفّح (WebAudio)، بلا ملفات: جرس النهاية، وأصوات
// الخلفية. صوت خلفية واحد في كل مرة، ويتوقّف حين يغادر المستخدم الصفحة.

export type Ambient = "rain" | "sea" | "forest" | "cafe" | "fire" | "brown" | "white";
export const AMBIENTS: Ambient[] = ["rain", "sea", "forest", "cafe", "fire", "brown", "white"];

type Ctor = typeof AudioContext;
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const C: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!C) return null;
    try {
      ctx = new C();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

/** يُستدعى من ضغطة المستخدم حتى يُسمح بالصوت لاحقاً (عند انتهاء المؤقّت في الخلفية) */
export function unlockAudio() {
  audio();
}

/** جرس النهاية: ثلاث نغمات هادئة تتلاشى */
export function chime() {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + 0.02;
  const notes = [659.25, 830.61, 987.77];
  notes.forEach((f, i) => {
    const t = t0 + i * 0.32;
    const osc = a.createOscillator();
    const over = a.createOscillator();
    const g = a.createGain();
    osc.type = "sine";
    over.type = "sine";
    osc.frequency.value = f;
    over.frequency.value = f * 2.01;
    const og = a.createGain();
    og.gain.value = 0.18;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    osc.connect(g);
    over.connect(og).connect(g);
    g.connect(a.destination);
    osc.start(t);
    over.start(t);
    osc.stop(t + 1.7);
    over.stop(t + 1.7);
  });
}

// ───────── أصوات الخلفية ─────────

function noiseBuffer(a: AudioContext, color: "white" | "brown" | "pink", seconds = 4): AudioBuffer {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (color === "white") d[i] = w * 0.5;
      else if (color === "brown") {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
  }
  return buf;
}

function loop(a: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const s = a.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  return s;
}

function filter(a: AudioContext, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

/** يربط موجة بطيئة بقيمة (للأمواج والريح) */
function lfo(a: AudioContext, target: AudioParam, rate: number, depth: number): OscillatorNode {
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.value = rate;
  g.gain.value = depth;
  o.connect(g).connect(target);
  o.start();
  return o;
}

interface Voice {
  stop(): void;
}

function build(a: AudioContext, kind: Ambient, out: GainNode): Voice {
  const nodes: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];
  const src = (buf: AudioBuffer) => {
    const s = loop(a, buf);
    nodes.push(s);
    s.start();
    return s;
  };
  const every = (fn: () => void, min: number, max: number) => {
    const tick = () => {
      fn();
      timers.push(window.setTimeout(tick, min + Math.random() * (max - min)));
    };
    timers.push(window.setTimeout(tick, min + Math.random() * (max - min)));
  };
  /** دفقة قصيرة: طقطقة نار أو قطرة أو رنّة فنجان */
  const burst = (freq: number, dur: number, gain: number, type: BiquadFilterType = "bandpass", q = 1) => {
    const t = a.currentTime;
    const s = a.createBufferSource();
    s.buffer = white;
    const f = filter(a, type, freq, q);
    const g = a.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 3, dur + 0.05);
  };
  const tone = (freq: number, to: number, dur: number, gain: number) => {
    const t = a.currentTime;
    const o = a.createOscillator();
    const g = a.createGain();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  const white = noiseBuffer(a, "white");

  switch (kind) {
    case "white": {
      const g = a.createGain();
      g.gain.value = 0.35;
      src(white).connect(g).connect(out);
      break;
    }
    case "brown": {
      const g = a.createGain();
      g.gain.value = 0.9;
      src(noiseBuffer(a, "brown")).connect(g).connect(out);
      break;
    }
    case "rain": {
      const g = a.createGain();
      g.gain.value = 0.55;
      src(noiseBuffer(a, "pink")).connect(filter(a, "highpass", 500)).connect(filter(a, "lowpass", 7000)).connect(g).connect(out);
      every(() => burst(2500 + Math.random() * 3000, 0.04, 0.08 + Math.random() * 0.1, "bandpass", 4), 30, 140);
      break;
    }
    case "sea": {
      const lp = filter(a, "lowpass", 600);
      const g = a.createGain();
      g.gain.value = 0.5;
      src(noiseBuffer(a, "brown")).connect(lp).connect(g).connect(out);
      nodes.push(lfo(a, g.gain, 0.09, 0.42));
      nodes.push(lfo(a, lp.frequency, 0.09, 380));
      break;
    }
    case "forest": {
      const lp = filter(a, "lowpass", 900);
      const g = a.createGain();
      g.gain.value = 0.28;
      src(noiseBuffer(a, "pink")).connect(lp).connect(g).connect(out);
      nodes.push(lfo(a, g.gain, 0.05, 0.12));
      every(() => {
        const base = 2200 + Math.random() * 1600;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) timers.push(window.setTimeout(() => tone(base, base * (1.15 + Math.random() * 0.2), 0.12, 0.05), i * 150));
      }, 2500, 7000);
      break;
    }
    case "cafe": {
      const bp = filter(a, "bandpass", 700, 0.6);
      const g = a.createGain();
      g.gain.value = 0.7;
      src(noiseBuffer(a, "pink")).connect(bp).connect(g).connect(out);
      nodes.push(lfo(a, g.gain, 0.3, 0.12));
      nodes.push(lfo(a, bp.frequency, 0.17, 160));
      every(() => tone(2600 + Math.random() * 1400, 2550 + Math.random() * 1400, 0.35, 0.025), 2500, 9000);
      break;
    }
    case "fire": {
      const lp = filter(a, "lowpass", 380);
      const g = a.createGain();
      g.gain.value = 0.85;
      src(noiseBuffer(a, "brown")).connect(lp).connect(g).connect(out);
      nodes.push(lfo(a, g.gain, 0.21, 0.15));
      every(() => burst(1200 + Math.random() * 2500, 0.02 + Math.random() * 0.03, 0.15 + Math.random() * 0.3, "highpass", 1), 60, 600);
      break;
    }
  }

  return {
    stop() {
      timers.forEach((id) => clearTimeout(id));
      nodes.forEach((n) => {
        try {
          n.stop();
        } catch {
          /* توقّف من قبل */
        }
      });
    },
  };
}

class AmbientPlayer {
  private voice: Voice | null = null;
  private out: GainNode | null = null;
  current: Ambient | null = null;

  play(kind: Ambient, volume: number) {
    const a = audio();
    if (!a) return false;
    this.stop();
    const out = a.createGain();
    out.gain.setValueAtTime(0.0001, a.currentTime);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), a.currentTime + 0.6);
    out.connect(a.destination);
    this.out = out;
    this.voice = build(a, kind, out);
    this.current = kind;
    return true;
  }

  setVolume(volume: number) {
    if (this.out && ctx) this.out.gain.setTargetAtTime(Math.max(0.0001, volume), ctx.currentTime, 0.05);
  }

  stop() {
    const voice = this.voice;
    const out = this.out;
    this.voice = null;
    this.out = null;
    this.current = null;
    if (!voice || !out || !ctx) return;
    out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
    window.setTimeout(() => {
      voice.stop();
      out.disconnect();
    }, 400);
  }
}

export const ambient = new AmbientPlayer();

export function audioSupported(): boolean {
  return typeof window !== "undefined" && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
}
