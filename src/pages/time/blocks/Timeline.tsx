// جدول اليوم: ساعات من السادسة (أو أبكر حجز) حتى منتصف الليل، ساعة لكل ٦٤ بكسل.
// الحجز حافّة رفيعة بلون فئته وغسلة خفيفة، والمتكرّر القادم ظلّ باهت، و«الآن» خطّ زعفراني
// بلغة خط اليوم نفسها.

import { Check, Repeat } from "lucide-react";
import { forwardRef, type PointerEvent as ReactPointerEvent } from "react";
import type { Category } from "@/data/types";
import { formatClock, t } from "@/lib/i18n";
import { fromMinutes } from "@/lib/time";
import { cx } from "@/ui/cx";
import { categoryName, CATEGORY_TONE, TONE, type Labels } from "./meta";
import { DAY_TO, layoutLanes, minuteToY, PX_PER_MIN, type Block } from "./schedule";

export const TOP_PAD = 12;
const GUTTER = "3.5rem";

export function clock(minute: number, hour12: boolean): string {
  return formatClock(minute >= DAY_TO ? "00:00" : fromMinutes(minute), hour12);
}

export function hourLabel(h: number, hour12: boolean): string {
  if (!hour12) return `${String(h % 24).padStart(2, "0")}:00`;
  const suffix = h % 24 < 12 ? t("ص", "AM") : t("م", "PM");
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}

export interface Preview {
  start: number;
  length: number;
  moved: boolean;
}

type Bind = (block: Block, id: string) => { "data-drag-id": string; onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void };

export const Timeline = forwardRef<
  HTMLDivElement,
  {
    from: number;
    blocks: Block[];
    hour12: boolean;
    labels: Labels;
    spotlight: Category | null;
    nowMinute: number | null;
    preview: Preview | null;
    activeId: string | null;
    bind: Bind;
    onOpen: (b: Block) => void;
    onEmpty: (minute: number) => void;
    className?: string;
    scrollRef: React.Ref<HTMLDivElement>;
  }
>(function Timeline({ from, blocks, hour12, labels, spotlight, nowMinute, preview, activeId, bind, onOpen, onEmpty, className, scrollRef }, gridRef) {
  const lanes = layoutLanes(blocks.map((b) => ({ key: b.key, start: b.start, end: b.end })));
  const height = minuteToY(DAY_TO, from) + TOP_PAD * 2;
  const hours: number[] = [];
  for (let h = from / 60; h <= 24; h++) hours.push(h);
  const y = (m: number) => minuteToY(m, from) + TOP_PAD;

  return (
    <div ref={scrollRef} className={cx("scroll-thin relative overflow-y-auto overscroll-contain", className)}>
      <div ref={gridRef} data-drop="timeline" className="relative" style={{ height }}>
        {/* خطوط الساعات */}
        {hours.map((h) => (
          <div key={h} className="pointer-events-none absolute inset-x-0" style={{ top: y(h * 60) }} aria-hidden>
            <span className="tnum absolute start-0 w-14 -translate-y-1/2 pe-2 text-end text-[11px] leading-none text-ink-3">{hourLabel(h, hour12)}</span>
            <span className="absolute end-0 h-px bg-line" style={{ insetInlineStart: GUTTER }} />
            {h < 24 && <span className="absolute end-0 h-px bg-line/45" style={{ insetInlineStart: GUTTER, top: 32 }} />}
          </div>
        ))}

        {/* الضغط على وقت فارغ يفتح الإضافة على تلك الساعة */}
        <div
          className="absolute bottom-0 end-0 top-0 cursor-copy"
          style={{ insetInlineStart: GUTTER }}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const m = from + Math.floor((e.clientY - r.top - TOP_PAD) / PX_PER_MIN / 30) * 30;
            onEmpty(Math.max(0, Math.min(DAY_TO - 30, m)));
          }}
          aria-hidden
        />

        {/* الحجوزات */}
        <div className="pointer-events-none absolute bottom-0 top-0 end-1.5" style={{ insetInlineStart: `calc(${GUTTER} + 4px)` }}>
          {blocks.map((b) => {
            const lane = lanes.get(b.key) ?? { lane: 0, lanes: 1 };
            const tone = TONE[CATEGORY_TONE[b.task.category]];
            const h = Math.max(18, (b.end - b.start) * PX_PER_MIN - 2);
            const compact = h < 40;
            const dim = spotlight && b.task.category !== spotlight;
            const dragId = `b:${b.task.id}`;
            const drag = !b.ghost && !b.done ? bind(b, dragId) : null;
            const range = `${clock(b.start, hour12)} – ${clock(b.end, hour12)}`;
            const label = b.ghost
              ? t(`موعد متكرّر قادم: ${b.task.title}، ${range}`, `Upcoming repeat: ${b.task.title}, ${range}`)
              : t(`${b.task.title}، ${range}، ${categoryName(b.task.category, labels)}${b.done ? "، أُنجزت" : ""}`, `${b.task.title}, ${range}, ${categoryName(b.task.category, labels)}${b.done ? ", done" : ""}`);
            return (
              <button
                key={b.key}
                type="button"
                {...(drag ?? {})}
                data-start={b.start}
                aria-label={label}
                onClick={() => onOpen(b)}
                className={cx(
                  "pointer-events-auto absolute overflow-hidden rounded-sm border-s-[3px] text-start transition-opacity duration-200",
                  drag && "waf-draggable",
                  b.ghost ? cx("border border-dashed border-line-strong bg-sheet/60", "border-s-[3px] border-s-current", tone.text) : cx(tone.wash, tone.edge),
                  b.done && "opacity-60",
                  dim && "opacity-25",
                  activeId === dragId && "waf-drag-source",
                )}
                style={{
                  top: y(b.start) + 1,
                  height: h,
                  insetInlineStart: `calc(${(lane.lane / lane.lanes) * 100}% + ${lane.lane ? 2 : 0}px)`,
                  width: `calc(${100 / lane.lanes}% - ${lane.lanes > 1 ? 2 : 0}px)`,
                }}
              >
                <span className={cx("flex h-full min-w-0 px-2", compact ? "items-center gap-2 py-0" : "flex-col py-1.5")}>
                  <span className={cx("flex min-w-0 items-start gap-1.5 text-ink", compact ? "flex-1" : "")}>
                    {b.ghost && <Repeat className="mt-[3px] size-3 shrink-0 text-ink-3" strokeWidth={2} aria-hidden />}
                    {b.done && <Check className="mt-[3px] size-3.5 shrink-0 text-palm" strokeWidth={2.25} aria-hidden />}
                    <span
                      dir="auto"
                      className={cx(
                        "min-w-0 text-start text-[13px] font-medium leading-snug [overflow-wrap:anywhere]",
                        compact ? "truncate" : h < 64 ? "line-clamp-1" : h < 96 ? "line-clamp-2" : "line-clamp-3",
                        b.done && "line-through decoration-ink-3",
                        b.ghost && "text-ink-2",
                      )}
                    >
                      {b.task.title}
                    </span>
                  </span>
                  <span className={cx("tnum shrink-0 truncate text-[11px] leading-snug text-ink-2", !compact && "mt-0.5")}>{range}</span>
                </span>
              </button>
            );
          })}

          {preview && (
            <div
              className={cx("absolute inset-x-0 rounded-sm border-2 border-dashed", "border-dusk/60 bg-dusk-wash/50")}
              style={{ top: y(preview.start) + 1, height: Math.max(18, preview.length * PX_PER_MIN - 2) }}
              aria-hidden
            >
              <span className="tnum absolute -top-5 start-1 whitespace-nowrap rounded-sm bg-sheet px-1.5 text-[11px] font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]">
                {clock(preview.start, hour12)}
                {preview.moved && <span className="ms-1.5 font-normal text-ink-2">{t("أول وقت فارغ", "first free slot")}</span>}
              </span>
            </div>
          )}
        </div>

        {/* الآن */}
        {nowMinute !== null && nowMinute >= from && nowMinute < DAY_TO && (
          <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: y(nowMinute) }} aria-hidden>
            <span className="absolute end-0 h-0.5 -translate-y-1/2 bg-saffron" style={{ insetInlineStart: GUTTER }} />
            <span className="absolute size-2.5 -translate-y-1/2 rounded-full bg-saffron ring-4 ring-saffron/20" style={{ insetInlineStart: `calc(${GUTTER} - 5px)` }} />
            <span className="tnum absolute start-0 w-14 -translate-y-1/2 bg-sheet pe-2 text-end text-[11px] font-semibold leading-tight text-saffron-ink">
              {clock(nowMinute, hour12).replace(/\s?(ص|م|AM|PM)$/, "")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
