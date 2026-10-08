import { useCallback, useEffect, useRef } from "react";

/**
 * سحبٌ باللمس لصفحة حجز الوقت.
 *
 * سحب HTML5 (`draggable`) لا يعمل باللمس في أغلب متصفّحات الجوّال، فيُبنى هنا
 * من أحداث اللمس نفسها: ضغطة مطوّلة تلتقط العنصر، والإصبع يحرّك شبحه، ورفعه
 * يُسقطه على ما تحته.
 *
 * والضغطة المطوّلة لا اللمسة هي ما يبدأ: القائمة والجدول يُمرَّران بالإصبع
 * نفسه، ولمسةٌ تلتقط فوراً تجعل الصفحة لا تُمرَّر. فمن تحرّك قبل المهلة يمرّر،
 * ومن ثبت يسحب.
 */

/** ساعة في الجدول، أو منطقة الإسقاط أسفله. */
export type DropTarget = number | "zone";

export const HOLD_MS = 260;
/** حركةٌ دون هذا ارتجافُ إصبع لا تمريرة. */
const SLOP = 10;
/** قرب حافّة الشاشة يُمرَّر الجدول تلقائياً، وإلا لا تُبلَغ ساعةٌ خارج الإطار. */
const EDGE = 96;
const MAX_SPEED = 16;

interface Session {
  id: string;
  x: number;
  y: number;
  timer: number;
  frame: number;
  active: boolean;
  source: HTMLElement;
  ghost: HTMLElement | null;
  target: DropTarget | null;
  cleanup: () => void;
}

function targetAt(x: number, y: number): DropTarget | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const row = el.closest<HTMLElement>("[data-hour]");
  if (row) return Number(row.dataset.hour);
  return el.closest(".tbk-dropzone") ? "zone" : null;
}

/** ما يُمرَّر تحت الإصبع: صندوق الجدول إن كان له تمرير (المكتب والآيباد)، وإلا الصفحة. */
function scrollerOf(): { el: Element | null; top: number; bottom: number } {
  const box = document.querySelector(".tbk-timeline");
  if (box && box.scrollHeight > box.clientHeight + 1) {
    const rect = box.getBoundingClientRect();
    return { el: box, top: rect.top, bottom: rect.bottom };
  }
  return { el: document.scrollingElement, top: 0, bottom: window.innerHeight };
}

export function useTouchDrag(options: {
  onOver: (target: DropTarget | null) => void;
  onDrop: (id: string, target: DropTarget) => void;
}) {
  // الصفحة تُعيد الرسم مع كل حجز؛ المرجع يُبقي الجلسة على آخر نسخة من الدالّتين.
  const handlers = useRef(options);
  handlers.current = options;
  const session = useRef<Session | null>(null);

  const stop = useCallback(() => {
    const current = session.current;
    if (!current) return;
    session.current = null;
    window.clearTimeout(current.timer);
    window.cancelAnimationFrame(current.frame);
    current.cleanup();
    current.ghost?.remove();
    current.source.style.opacity = "";
    document.documentElement.classList.remove("tbk-dragging");
    if (current.active) handlers.current.onOver(null);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    (event: React.TouchEvent<HTMLElement>, id: string, label: string, tone: string) => {
      if (event.touches.length !== 1) return stop();
      // زرّ داخل الصفّ (المربّع، المقبض) له ضغطته؛ الضغطة المطوّلة عليه ليست سحباً.
      if ((event.target as HTMLElement).closest(".tbk-check, .tbk-drag")) return;
      stop();

      const touch = event.touches[0];
      const source = event.currentTarget;

      const look = (current: Session) => {
        const next = targetAt(current.x, current.y);
        if (next !== current.target) {
          current.target = next;
          handlers.current.onOver(next);
        }
      };

      const tick = () => {
        const current = session.current;
        if (!current?.active) return;
        const { el, top, bottom } = scrollerOf();
        const up = top + EDGE - current.y;
        const down = current.y - (bottom - EDGE);
        const pull = up > 0 ? -up : down > 0 ? down : 0;
        if (el && pull) {
          el.scrollTop += Math.sign(pull) * Math.min(MAX_SPEED, Math.ceil(Math.abs(pull) / 5));
          // التمرير يبدّل ما تحت إصبعٍ ثابت، فيُعاد النظر.
          look(current);
        }
        current.frame = window.requestAnimationFrame(tick);
      };

      const activate = () => {
        const current = session.current;
        if (!current) return;
        current.active = true;
        const ghost = document.createElement("div");
        ghost.className = "tbk-dragghost";
        ghost.dataset.tone = tone;
        ghost.textContent = label;
        ghost.style.transform = `translate(${current.x}px, ${current.y}px)`;
        // داخل البوّابة ليرث ألوان الصفحة ووضعها الفاتح؛ والجسم احتياط.
        (document.querySelector(".tbk-portal") ?? document.body).appendChild(ghost);
        current.ghost = ghost;
        current.source.style.opacity = "0.4";
        document.documentElement.classList.add("tbk-dragging");
        navigator.vibrate?.(12);
        look(current);
        current.frame = window.requestAnimationFrame(tick);
      };

      const onMove = (move: TouchEvent) => {
        const current = session.current;
        const point = move.touches[0];
        if (!current || !point) return;
        if (!current.active) {
          // تحرّك قبل المهلة: هذه تمريرة، فتُترك للمتصفّح.
          if (Math.hypot(point.clientX - current.x, point.clientY - current.y) > SLOP) stop();
          return;
        }
        // يمنع التمرير الأصليّ: الإصبع الآن يحمل شيئاً.
        move.preventDefault();
        current.x = point.clientX;
        current.y = point.clientY;
        if (current.ghost) current.ghost.style.transform = `translate(${current.x}px, ${current.y}px)`;
        look(current);
      };

      const onEnd = (end: TouchEvent) => {
        const current = session.current;
        if (!current) return;
        const dropped = current.active ? current.target : null;
        // يمنع النقرة التي يولّدها المتصفّح بعد اللمس: كانت ستفتح نافذة الحجز.
        if (current.active && end.cancelable) end.preventDefault();
        const taskId = current.id;
        stop();
        if (dropped !== null) handlers.current.onDrop(taskId, dropped);
      };

      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onEnd, { passive: false });
      document.addEventListener("touchcancel", stop);
      // الضغطة المطوّلة تفتح قائمة السياق في أندرويد؛ وهي هنا بداية سحب.
      const onMenu = (menu: Event) => menu.preventDefault();
      document.addEventListener("contextmenu", onMenu);

      session.current = {
        id,
        x: touch.clientX,
        y: touch.clientY,
        timer: window.setTimeout(activate, HOLD_MS),
        frame: 0,
        active: false,
        source,
        ghost: null,
        target: null,
        cleanup: () => {
          document.removeEventListener("touchmove", onMove);
          document.removeEventListener("touchend", onEnd);
          document.removeEventListener("touchcancel", stop);
          document.removeEventListener("contextmenu", onMenu);
        },
      };
    },
    [stop],
  );

  /** هل إصبعٌ على عنصر الآن؟ يُسأل ليُمنع سحب HTML5 أن يبدأ معه (أندرويد يبدؤه بالضغطة المطوّلة). */
  const busy = useCallback(() => session.current !== null, []);

  return { start, busy };
}
