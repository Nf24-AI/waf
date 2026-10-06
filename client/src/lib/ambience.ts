/**
 * أصوات الاسترخاء — تُولَّد في المتصفّح ولا تُحمَّل.
 *
 * بلا ملفّات صوت: كل صوت ضجيجٌ يمرّ بمرشّحات، وفوقه أحداثٌ عشوائية حين يلزم
 * (طقطقة نار، رعد، تغريد). فلا شيء يُنزَّل ولا شيء يُرخَّص، والأصوات تعمل بلا
 * شبكة. وهي تقريب لا تسجيل: مطرٌ يُشبه المطر، لا مطر بعينه.
 */

export const AMBIENCE = [
  { id: "fireplace", label: "Fireplace" },
  { id: "nature", label: "Nature" },
  { id: "ocean", label: "Ocean" },
  { id: "rain", label: "Rain" },
  { id: "cafe", label: "Café" },
  { id: "forest", label: "Forest" },
  { id: "brown", label: "Brown Noise" },
  { id: "white", label: "White Noise" },
  { id: "thunder", label: "Thunder" },
  { id: "keyboard", label: "Keyboard" },
  { id: "fan", label: "Fan" },
  { id: "theta", label: "Theta Waves" },
] as const;

export type AmbienceId = (typeof AMBIENCE)[number]["id"];

let context: AudioContext | null = null;
let master: GainNode | null = null;
const playing = new Map<AmbienceId, () => void>();
const buffers = new Map<string, AudioBuffer>();

function audio(): { ctx: AudioContext; out: GainNode } {
  if (!context) {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    context = new Context();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
  }
  // المتصفّح يعلّق السياق حتى أول لمسة؛ النداء يأتي من ضغطة فيُستأنف.
  if (context.state === "suspended") void context.resume();
  return { ctx: context, out: master! };
}

/** أربع ثوانٍ من الضجيج تُكرَّر: أطول من أن يُسمع تكرارها، وأقصر من أن تُثقل الذاكرة. */
function noiseBuffer(ctx: AudioContext, kind: "white" | "pink" | "brown"): AudioBuffer {
  const cached = buffers.get(kind);
  if (cached) return cached;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  const pink = [0, 0, 0];
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    if (kind === "white") data[i] = white;
    else if (kind === "brown") {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      pink[0] = 0.99765 * pink[0] + white * 0.099046;
      pink[1] = 0.963 * pink[1] + white * 0.2965164;
      pink[2] = 0.57 * pink[2] + white * 1.0526913;
      data[i] = (pink[0] + pink[1] + pink[2] + white * 0.1848) * 0.2;
    }
  }
  buffers.set(kind, buffer);
  return buffer;
}

interface Voice {
  nodes: AudioNode[];
  timers: number[];
  alive: boolean;
}

function build(ctx: AudioContext, out: AudioNode, id: AmbienceId): Voice {
  const voice: Voice = { nodes: [], timers: [], alive: true };
  const bus = ctx.createGain();
  bus.gain.value = 0;
  bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.6);
  bus.connect(out);
  voice.nodes.push(bus);

  const keep = <T extends AudioNode>(node: T): T => {
    voice.nodes.push(node);
    return node;
  };

  /** ضجيج متّصل عبر مرشّح، وبتموّج بطيء في شدّته إن طُلب. */
  const bed = (
    kind: "white" | "pink" | "brown",
    gain: number,
    filter?: { type: BiquadFilterType; frequency: number; q?: number },
    sway?: { rate: number; depth: number },
  ) => {
    const source = keep(ctx.createBufferSource());
    source.buffer = noiseBuffer(ctx, kind);
    source.loop = true;
    let tail: AudioNode = source;
    if (filter) {
      const node = keep(ctx.createBiquadFilter());
      node.type = filter.type;
      node.frequency.value = filter.frequency;
      node.Q.value = filter.q ?? 0.7;
      tail.connect(node);
      tail = node;
    }
    const level = keep(ctx.createGain());
    level.gain.value = gain;
    if (sway) {
      const lfo = keep(ctx.createOscillator());
      const depth = keep(ctx.createGain());
      lfo.frequency.value = sway.rate;
      depth.gain.value = gain * sway.depth;
      lfo.connect(depth).connect(level.gain);
      lfo.start();
    }
    tail.connect(level).connect(bus);
    source.start();
  };

  /** حدثٌ يتكرّر على فترات عشوائية حتى يُوقَف الصوت. */
  const every = (minMs: number, maxMs: number, fire: () => void) => {
    const loop = () => {
      if (!voice.alive) return;
      fire();
      voice.timers.push(window.setTimeout(loop, minMs + Math.random() * (maxMs - minMs)));
    };
    voice.timers.push(window.setTimeout(loop, Math.random() * maxMs));
  };

  /** نفخة ضجيج قصيرة: طقطقة، نقرة مفتاح، أو هزيم رعد إن طالت. */
  const burst = (kind: "white" | "brown", type: BiquadFilterType, frequency: number, peak: number, seconds: number) => {
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer(ctx, kind);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const level = ctx.createGain();
    const at = ctx.currentTime;
    level.gain.setValueAtTime(0.0001, at);
    level.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.05, seconds / 4));
    level.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    source.connect(filter).connect(level).connect(bus);
    source.start(at, Math.random() * 3);
    source.stop(at + seconds + 0.05);
  };

  /** صفرة تنزلق بين تردّدين: تغريدة أو رنّة كوب. */
  const chirp = (from: number, to: number, peak: number, seconds: number) => {
    const tone = ctx.createOscillator();
    const level = ctx.createGain();
    const at = ctx.currentTime;
    tone.frequency.setValueAtTime(from, at);
    tone.frequency.exponentialRampToValueAtTime(to, at + seconds);
    level.gain.setValueAtTime(0.0001, at);
    level.gain.exponentialRampToValueAtTime(peak, at + 0.02);
    level.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    tone.connect(level).connect(bus);
    tone.start(at);
    tone.stop(at + seconds + 0.05);
  };

  switch (id) {
    case "white":
      bed("white", 0.12);
      break;
    case "brown":
      bed("brown", 0.55);
      break;
    case "fan":
      bed("brown", 0.5, { type: "lowpass", frequency: 420 });
      bed("white", 0.02, { type: "bandpass", frequency: 1800, q: 0.4 });
      break;
    case "rain":
      bed("white", 0.1, { type: "highpass", frequency: 900 });
      bed("pink", 0.25, { type: "lowpass", frequency: 2200 });
      break;
    case "thunder":
      bed("white", 0.08, { type: "highpass", frequency: 900 });
      bed("pink", 0.22, { type: "lowpass", frequency: 2200 });
      every(7000, 22000, () => burst("brown", "lowpass", 140, 0.9, 3 + Math.random() * 2.5));
      break;
    case "ocean":
      bed("brown", 0.55, { type: "lowpass", frequency: 650 }, { rate: 0.09, depth: 0.75 });
      bed("white", 0.04, { type: "highpass", frequency: 2500 }, { rate: 0.09, depth: 0.9 });
      break;
    case "forest":
      bed("pink", 0.3, { type: "bandpass", frequency: 520, q: 0.5 }, { rate: 0.13, depth: 0.6 });
      every(2500, 9000, () => chirp(2600 + Math.random() * 900, 3400 + Math.random() * 900, 0.03, 0.14));
      break;
    case "nature":
      bed("pink", 0.1, { type: "lowpass", frequency: 1400 }, { rate: 0.2, depth: 0.4 });
      every(700, 3200, () => {
        const base = 2200 + Math.random() * 1800;
        chirp(base, base * (1.1 + Math.random() * 0.4), 0.045, 0.09 + Math.random() * 0.1);
      });
      break;
    case "fireplace":
      bed("brown", 0.4, { type: "lowpass", frequency: 320 }, { rate: 0.4, depth: 0.25 });
      every(60, 420, () => burst("white", "highpass", 1800 + Math.random() * 2500, 0.05 + Math.random() * 0.12, 0.03));
      break;
    case "cafe":
      bed("pink", 0.35, { type: "bandpass", frequency: 800, q: 0.45 }, { rate: 0.7, depth: 0.3 });
      bed("brown", 0.2, { type: "lowpass", frequency: 260 });
      every(2500, 9000, () => chirp(2100 + Math.random() * 700, 1900, 0.025, 0.25));
      break;
    case "keyboard":
      every(70, 320, () => burst("white", "bandpass", 1600 + Math.random() * 1400, 0.1 + Math.random() * 0.08, 0.035));
      break;
    case "theta": {
      // 200 و206 هرتز، كلٌّ في أذن: الفرق ستّة — وهو ما تسمعه نبضاً.
      [200, 206].forEach((frequency, index) => {
        const tone = keep(ctx.createOscillator());
        const pan = keep(ctx.createStereoPanner());
        const level = keep(ctx.createGain());
        tone.frequency.value = frequency;
        pan.pan.value = index === 0 ? -1 : 1;
        level.gain.value = 0.09;
        tone.connect(level).connect(pan).connect(bus);
        tone.start();
      });
      break;
    }
  }

  return voice;
}

/** يشغّل الصوت أو يوقفه؛ يعود بحاله بعد الضغطة. */
export function toggleAmbience(id: AmbienceId): boolean {
  const stop = playing.get(id);
  if (stop) {
    stop();
    return false;
  }
  try {
    const { ctx, out } = audio();
    const voice = build(ctx, out, id);
    playing.set(id, () => {
      voice.alive = false;
      voice.timers.forEach(timer => window.clearTimeout(timer));
      voice.nodes.forEach(node => {
        try {
          (node as AudioScheduledSourceNode).stop?.();
        } catch {
          /* لم يبدأ بعد أو أُوقف قبلاً. */
        }
        node.disconnect();
      });
      playing.delete(id);
    });
    return true;
  } catch {
    return false;
  }
}

export function playingAmbience(): AmbienceId[] {
  return Array.from(playing.keys());
}

export function stopAmbience(): void {
  Array.from(playing.values()).forEach(stop => stop());
}

/** من صفر إلى واحد. */
export function setAmbienceVolume(volume: number): void {
  if (master && context) master.gain.setTargetAtTime(Math.min(1, Math.max(0, volume)), context.currentTime, 0.05);
}
