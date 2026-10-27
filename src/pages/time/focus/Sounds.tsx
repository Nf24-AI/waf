// أصوات الخلفية (مولَّدة)، وبثّ الموسيقى من Spotify أو YouTube.

import * as PO from "@radix-ui/react-popover";
import { AudioLines, AudioWaveform, CloudRain, Coffee, Flame, Headphones, Music, Trees, Waves, X, type LucideIcon } from "lucide-react";
import { useId, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { cx } from "@/ui/cx";
import { Input } from "@/ui/Field";
import { AMBIENTS, ambient, audioSupported, type Ambient } from "./audio";
import { parseMusicUrl, type Embed } from "./embed";
import { readJson, writeJson } from "./ticker";

const NAMES: Record<Ambient, [string, string, LucideIcon]> = {
  rain: ["مطر", "Rain", CloudRain],
  sea: ["بحر", "Sea", Waves],
  forest: ["غابة", "Forest", Trees],
  cafe: ["مقهى", "Café", Coffee],
  fire: ["موقد", "Fireplace", Flame],
  brown: ["ضجيج بنّي", "Brown noise", AudioWaveform],
  white: ["ضجيج أبيض", "White noise", AudioLines],
};

const VOLUME_KEY = "waf:focus-volume";
const STREAM_KEY = "waf:focus-stream";

/** زرّ في شريط الأدوات السفلي: أيقونة، وتسمية تظهر من الشاشة المتوسطة */
export function ToolButton({ icon: Icon, label, active, className, ...rest }: { icon: LucideIcon; label: string; active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        "press relative inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-sm px-2.5 text-sm font-medium transition-colors duration-150 hover:bg-sunk hover:text-ink",
        active ? "text-ink" : "text-ink-2",
        className,
      )}
      {...rest}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="hidden lg:inline">{label}</span>
      {active && <span className="focus-tab-dot absolute top-2 end-2 lg:static lg:-ms-0.5" aria-hidden />}
    </button>
  );
}

function Pop({ trigger, children, label }: { trigger: ReactNode; children: ReactNode; label: string }) {
  return (
    <PO.Root>
      <PO.Trigger asChild>{trigger}</PO.Trigger>
      <PO.Portal>
        <PO.Content
          side="top"
          sideOffset={10}
          collisionPadding={12}
          aria-label={label}
          className="focus-pop z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-md border border-line bg-sheet p-4 text-sm text-ink shadow-[var(--shadow-float)]"
        >
          {children}
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  );
}

export function AmbientMenu() {
  const [current, setCurrent] = useState<Ambient | null>(ambient.current);
  const [volume, setVolume] = useState<number>(() => {
    const v = readJson(VOLUME_KEY);
    return typeof v === "number" && v >= 0 && v <= 100 ? v : 50;
  });
  const vid = useId();

  const toggle = (k: Ambient) => {
    if (current === k) {
      ambient.stop();
      setCurrent(null);
    } else if (ambient.play(k, (volume / 100) ** 2)) setCurrent(k);
  };

  const label = t("أصوات للتركيز", "Focus sounds");
  if (!audioSupported()) return null;
  return (
    <Pop label={label} trigger={<ToolButton icon={Headphones} label={current ? `${label}: ${t(NAMES[current][0], NAMES[current][1])}` : label} active={!!current} />}>
      <p className="font-display text-base font-semibold">{label}</p>
      <p className="mt-0.5 text-xs text-ink-3">{t("صوت واحد في كل مرة. اضغطه مرة أخرى ليتوقّف.", "One at a time. Press it again to stop.")}</p>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {AMBIENTS.map((k) => {
          const [ar, en, Icon] = NAMES[k];
          const on = current === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(k)}
              className={cx(
                "press flex h-11 items-center gap-2 rounded-sm border px-3 text-start transition-colors duration-150",
                on ? "border-saffron bg-saffron-wash text-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
              )}
            >
              <Icon className={cx("size-4 shrink-0", on && "text-saffron-ink")} strokeWidth={1.75} aria-hidden />
              <span className="truncate">{t(ar, en)}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <label htmlFor={vid} className="shrink-0 text-xs font-medium text-ink-2">
          {t("الصوت", "Volume")}
        </label>
        <input
          id={vid}
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            writeJson(VOLUME_KEY, v);
            ambient.setVolume((v / 100) ** 2);
          }}
          className="focus-range w-full"
        />
        <span className="tnum w-8 shrink-0 text-end text-xs text-ink-3">{volume}</span>
      </div>
    </Pop>
  );
}

export function MusicMenu({ onPlay, playing }: { onPlay: (e: Embed) => void; playing: boolean }) {
  const [url, setUrl] = useState<string>(() => {
    const v = readJson(STREAM_KEY);
    return typeof v === "string" ? v : "";
  });
  const [touched, setTouched] = useState(false);
  const embed = parseMusicUrl(url);
  const bad = (touched || url.trim().length > 14) && url.trim() !== "" && !embed;
  const id = useId();
  const label = t("بثّ الموسيقى", "Stream music");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!embed) return;
    writeJson(STREAM_KEY, url.trim());
    onPlay(embed);
  };

  return (
    <Pop label={label} trigger={<ToolButton icon={Music} label={label} active={playing} />}>
      <form onSubmit={submit}>
        <label htmlFor={id} className="font-display text-base font-semibold">
          {label}
        </label>
        <p className="mt-0.5 text-xs text-ink-3">{t("الصق رابط Spotify أو YouTube ليعمل وأنت تركّز.", "Paste a Spotify or YouTube link to play while you focus.")}</p>
        <Input
          id={id}
          dir="ltr"
          inputMode="url"
          type="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://open.spotify.com/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={bad || undefined}
          aria-describedby={bad ? `${id}-err` : undefined}
          className="mt-3 h-11 text-start"
        />
        {bad && (
          <p id={`${id}-err`} className="mt-1.5 text-xs text-ember" role="alert">
            {t("هذا ليس رابط Spotify أو YouTube يبدأ بـ https.", "That isn’t a Spotify or YouTube link starting with https.")}
          </p>
        )}
        <button type="submit" disabled={!embed} className="press mt-3 h-11 w-full rounded-sm bg-inverse text-sm font-medium text-on-inverse disabled:opacity-40">
          {t("شغّل", "Play")}
        </button>
      </form>
    </Pop>
  );
}

/** المشغّل المضمَّن: يطفو في الزاوية ويبقى حتى يُغلق */
export function MusicDock({ embed, onClose, hidden }: { embed: Embed; onClose: () => void; hidden?: boolean }) {
  return (
    <div
      className={cx(
        "focus-swap fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 overflow-hidden rounded-md border border-line bg-sheet shadow-[var(--shadow-float)] sm:inset-x-auto sm:end-4 sm:bottom-20 sm:w-[22rem]",
        hidden && "pointer-events-none opacity-0",
      )}
    >
      <div className="flex h-9 items-center justify-between ps-3 pe-1 text-xs text-ink-2">
        <span>{embed.kind === "spotify" ? "Spotify" : "YouTube"}</span>
        <button type="button" onClick={onClose} className="press inline-flex size-9 items-center justify-center rounded-sm hover:bg-sunk hover:text-ink" aria-label={t("أغلق المشغّل", "Close the player")}>
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>
      <iframe
        title={t("مشغّل الموسيقى", "Music player")}
        src={embed.src}
        width="100%"
        height={embed.height}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        className="block border-0"
      />
    </div>
  );
}
