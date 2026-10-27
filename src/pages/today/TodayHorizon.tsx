// خط اليوم الكبير في صفحة «اليوم»: الأفق نفسه الذي في رأس كل صفحة، مكبّراً
// وعليه ما يحمله اليوم. الاجتماعات علامات قائمة، والوقت المحجوز شرائط تحت الخط.

import { formatClock, t } from "@/lib/i18n";
import { cx } from "@/ui/cx";
import { DAY_END, DAY_START, dayFraction, useNow } from "@/ui/DayLine";

export interface HorizonItem {
  id: string;
  kind: "meeting" | "block";
  start: number;
  end: number;
  title: string;
}

const HOURS_WIDE = [6, 9, 12, 15, 18, 21, 24];
const HOURS_NARROW = [6, 12, 18, 24];

const clock = (minute: number) => {
  const m = Math.min(minute, 23 * 60 + 59);
  return formatClock(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
};

/** نصّ موضوع على نقطة من الخط: في الوسط، وعند الطرفين يلتصق بالحافة */
function anchor(f: number) {
  if (f < 0.07) return "start-0";
  if (f > 0.93) return "end-0";
  return "-translate-x-1/2 rtl:translate-x-1/2";
}

export function TodayHorizon({ items }: { items: HorizonItem[] }) {
  const now = useNow();
  const minute = now.getHours() * 60 + now.getMinutes();
  const f = dayFraction(minute);
  const live = minute >= DAY_START && minute < DAY_END;
  const meetings = items.filter((i) => i.kind === "meeting");
  const blocks = items.filter((i) => i.kind === "block");

  const label = t(
    `خط اليوم: الساعة الآن ${clock(minute)}. ${meetings.length} اجتماع و${blocks.length} وقت محجوز.`,
    `Day line: it is ${clock(minute)}. ${meetings.length} meetings and ${blocks.length} booked blocks.`,
  );

  return (
    <figure className="m-0" aria-label={label} role="img">
      <div className="relative h-24 sm:h-28">
        {/* «الآن» فوق الخط */}
        {live && (
          <span
            className={cx("tnum absolute top-0 whitespace-nowrap text-xs font-medium text-saffron-ink", f > 0.07 && f < 0.93 ? "-translate-x-1/2 rtl:translate-x-1/2" : "")}
            style={f <= 0.07 ? { insetInlineStart: 0 } : f >= 0.93 ? { insetInlineEnd: 0 } : { insetInlineStart: `${f * 100}%` }}
          >
            {t("الآن", "Now")} {clock(minute)}
          </span>
        )}

        {/* الاجتماعات: علامات قائمة فوق الخط */}
        {meetings.map((m) => {
          const past = m.end <= minute;
          return (
            <span
              key={m.id}
              title={`${clock(m.start)} ${m.title}`}
              className={cx("absolute bottom-[calc(50%-1px)] h-7 w-[2px] rounded-full sm:h-8", past ? "bg-ink-3/60" : "bg-ink")}
              style={{ insetInlineStart: `calc(${dayFraction(m.start) * 100}% - 1px)` }}
            />
          );
        })}

        {/* الخط */}
        <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-line" />
        <div className="dayline-fill absolute start-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-saffron" style={{ width: `${f * 100}%` }} />

        {/* الوقت المحجوز: شرائط تحت الخط */}
        {blocks.map((b) => {
          const s = dayFraction(b.start);
          const e = dayFraction(b.end);
          return (
            <span
              key={b.id}
              title={`${clock(b.start)}–${clock(b.end)} ${b.title}`}
              className={cx("absolute top-[calc(50%+5px)] h-2 rounded-[2px]", b.end <= minute ? "bg-dusk/35" : "bg-dusk/80")}
              style={{ insetInlineStart: `${s * 100}%`, width: `max(3px, calc(${(e - s) * 100}% - 2px))` }}
            />
          );
        })}

        {live && (
          <span
            className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-saffron ring-[6px] ring-saffron/20"
            style={{ insetInlineStart: `calc(${f * 100}% - 6px)` }}
            aria-hidden
          />
        )}

        {/* الساعات */}
        <div className="tnum absolute inset-x-0 bottom-0 h-4 text-[11px] leading-4 text-ink-3" aria-hidden>
          {HOURS_WIDE.map((h) => {
            const p = dayFraction(h * 60);
            return (
              <span key={h} className={cx("absolute whitespace-nowrap", !HOURS_NARROW.includes(h) && "hidden sm:inline", anchor(p))} style={p > 0.07 && p < 0.93 ? { insetInlineStart: `${p * 100}%` } : undefined}>
                {clock(h * 60)}
              </span>
            );
          })}
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-3">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-[2px] rounded-full bg-ink" aria-hidden />
          {t("اجتماع", "Meeting")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-4 rounded-[2px] bg-dusk/80" aria-hidden />
          {t("وقت محجوز", "Booked time")}
        </span>
      </figcaption>
    </figure>
  );
}
