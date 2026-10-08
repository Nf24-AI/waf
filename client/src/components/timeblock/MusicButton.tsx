import React, { useEffect, useRef, useState } from "react";
import { Music, Pause, Play, Upload } from "lucide-react";
import {
  AMBIENCE,
  playingAmbience,
  setAmbienceVolume,
  stopAmbience,
  toggleAmbience,
  type AmbienceId,
} from "@/lib/ambience";
import { pair, pick, t, type Pair } from "@/lib/i18n";

/**
 * موسيقى التركيز.
 *
 * المرجع يفتح ملفاً من الجهاز وحده. وفي واف أصواتٌ تُولَّد في المتصفّح لصفحة
 * التركيز، فتُعرض هنا أيضاً: من يخطّط يومه لا يحتاج أن يبحث عن ملف ليسمع
 * مطراً. والملف باقٍ لمن يريد موسيقاه.
 */

const SOUNDS: { id: AmbienceId; label: Pair }[] = [
  { id: "rain", label: pair("مطر", "Rain") },
  { id: "ocean", label: pair("بحر", "Ocean") },
  { id: "forest", label: pair("غابة", "Forest") },
  { id: "cafe", label: pair("مقهى", "Café") },
  { id: "fireplace", label: pair("موقد", "Fireplace") },
  { id: "brown", label: pair("ضجيج بنّي", "Brown noise") },
];

export default function MusicButton() {
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState<AmbienceId | null>(() => playingAmbience()[0] ?? null);
  const [file, setFile] = useState<string | null>(null);
  const [filePlaying, setFilePlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // الملف يتوقّف مع مغادرة الصفحة: عنصر صوتٍ بلا واجهة لا يُعرف كيف يُسكَت.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
    },
    [],
  );

  function pickSound(id: AmbienceId) {
    audioRef.current?.pause();
    setSound(toggleAmbience(id) ? id : null);
  }

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    stopAmbience();
    setSound(null);
    audioRef.current?.pause();
    if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);

    const audio = new Audio(URL.createObjectURL(chosen));
    audio.loop = true;
    audio.volume = volume;
    audio.onplay = () => setFilePlaying(true);
    audio.onpause = () => setFilePlaying(false);
    audioRef.current = audio;
    setFile(chosen.name);
    void audio.play().catch(() => setFilePlaying(false));
  }

  function toggleFile() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      stopAmbience();
      setSound(null);
      void audio.play().catch(() => {});
    } else audio.pause();
  }

  function changeVolume(next: number) {
    setVolume(next);
    setAmbienceVolume(next);
    if (audioRef.current) audioRef.current.volume = next;
  }

  const on = Boolean(sound) || filePlaying;
  const known = SOUNDS.find(item => item.id === sound);
  const label = sound ? (known ? pick(known.label) : AMBIENCE.find(item => item.id === sound)?.label) : filePlaying ? file : null;

  return (
    <div className="tbk-music-wrap" ref={wrapRef}>
      <button
        type="button"
        className="tbk-music"
        data-on={on}
        aria-expanded={open}
        aria-label={t("موسيقى التركيز", "Focus music")}
        onClick={() => setOpen(current => !current)}
      >
        <Music size={16} aria-hidden="true" />
        <span>{label ?? t("موسيقى التركيز", "Focus music")}</span>
      </button>
      <input ref={inputRef} type="file" accept="audio/*" hidden onChange={pickFile} />

      {open && (
        <div className="tbk-pop" role="dialog" aria-label={t("موسيقى التركيز", "Focus music")}>
          <h3>{t("أصوات للتركيز", "Sounds for focus")}</h3>
          <div className="tbk-sounds">
            {SOUNDS.map(item => (
              <button key={item.id} type="button" aria-pressed={sound === item.id} onClick={() => pickSound(item.id)}>
                {pick(item.label)}
              </button>
            ))}
          </div>
          <label className="tbk-pop-row">
            {t("مستوى الصوت", "Volume")}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={event => changeVolume(Number(event.target.value))}
            />
          </label>
          {file && (
            <button type="button" className="tbk-pop-file" onClick={toggleFile}>
              {filePlaying ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              {file}
            </button>
          )}
          <button type="button" className="tbk-pop-file" onClick={() => inputRef.current?.click()}>
            <Upload size={14} aria-hidden="true" />
            {t("ملف من جهازك", "File from your device")}
          </button>
        </div>
      )}
    </div>
  );
}
