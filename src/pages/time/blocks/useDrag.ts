// سحب بأحداث المؤشّر يعمل بالفأرة واللمس معاً.
// الفأرة: يبدأ السحب بعد ٥ بكسل. اللمس: ضغطة مطوّلة (٢٦٠ مللي ثانية) ثم سحب، وإن تحرّك
// الإصبع قبلها فهو تمرير عادي. نسخة طافية تتبع المؤشّر بـ transform، وعند الإفلات
// تستقرّ على مكانها الجديد بحركة قصيرة، أو تعود إلى مكانها إن لم يُقبل الإفلات.

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { dragSpeed } from "./dragMath";
import "./drag.css";

export interface DragState<T> {
  item: T;
  id: string;
  x: number;
  y: number;
  /** بُعد نقطة الإمساك عن أعلى العنصر الأصلي ويساره */
  grabX: number;
  grabY: number;
  /** أقرب [data-drop] تحت المؤشّر */
  target: HTMLElement | null;
  pointerType: string;
}

export interface DropResult {
  /** محدِّد العنصر الذي تستقرّ عليه النسخة بعد تحديث الواجهة */
  settle?: string;
}

export interface DragOptions<T> {
  onMove?: (s: DragState<T>) => void;
  /** يعيد null حين يُرفض الإفلات فتعود النسخة إلى مكانها */
  onDrop: (s: DragState<T>) => DropResult | null;
  onEnd?: () => void;
  longPressMs?: number;
  /** حاويات تمرير تتحرّك تلقائياً حين يقترب المؤشّر من حافّتها */
  scrollers?: () => (HTMLElement | null)[];
  disabled?: boolean;
}

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

interface Live {
  dragging: boolean;
  cleanup: () => void;
  cancel: () => void;
}

export function useDrag<T>(options: DragOptions<T>) {
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const live = useRef<Live | null>(null);

  useEffect(() => {
    // يمنع التمرير أثناء السحب باللمس. يلزم مستمع غير سلبي على المستند.
    const onTouchMove = (e: TouchEvent) => {
      if (live.current?.dragging && e.cancelable) e.preventDefault();
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      live.current?.cancel();
    };
  }, []);

  const start = useCallback((e: ReactPointerEvent<HTMLElement>, item: T, id: string) => {
    if (opts.current.disabled || live.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!e.isPrimary) return;
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;

    const el = e.currentTarget;
    const pid = e.pointerId;
    const type = e.pointerType;
    const sx = e.clientX;
    const sy = e.clientY;
    let x = sx;
    let y = sy;
    let rect: DOMRect | null = null;
    let wrap: HTMLDivElement | null = null;
    let lift: HTMLDivElement | null = null;
    let target: HTMLElement | null = null;
    let raf = 0;
    let timer = 0;

    const state = (): DragState<T> => ({ item, id, x, y, grabX: rect ? sx - rect.left : 0, grabY: rect ? sy - rect.top : 0, target, pointerType: type });

    const position = () => {
      if (!wrap) return;
      wrap.style.transform = `translate3d(${x - sx}px, ${y - sy}px, 0)`;
      const under = document.elementFromPoint(x, y) as HTMLElement | null;
      target = under?.closest<HTMLElement>("[data-drop]") ?? null;
      opts.current.onMove?.(state());
    };

    const autoScroll = () => {
      let moved = false;
      for (const s of opts.current.scrollers?.() ?? []) {
        if (!s) continue;
        const r = s.getBoundingClientRect();
        if (x < r.left || x > r.right || y < r.top - 40 || y > r.bottom + 40) continue;
        const v = dragSpeed(y, r.top, r.bottom);
        if (v) {
          const before = s.scrollTop;
          s.scrollTop += v;
          moved ||= s.scrollTop !== before;
        }
      }
      const v = dragSpeed(y, 0, window.innerHeight);
      if (v) {
        const before = window.scrollY;
        window.scrollBy(0, v);
        moved ||= window.scrollY !== before;
      }
      if (moved) position();
      raf = requestAnimationFrame(autoScroll);
    };

    const begin = () => {
      if (!el.isConnected) return cleanup();
      self.dragging = true;
      rect = el.getBoundingClientRect();
      try {
        el.setPointerCapture(pid);
      } catch {
        /* المؤشّر انتهى */
      }
      wrap = document.createElement("div");
      wrap.className = "waf-drag-clone";
      Object.assign(wrap.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      lift = document.createElement("div");
      lift.className = "waf-drag-lift";
      lift.style.borderRadius = getComputedStyle(el).borderRadius || "6px";
      const clone = el.cloneNode(true) as HTMLElement;
      clone.removeAttribute("data-drag-id");
      clone.removeAttribute("id");
      clone.setAttribute("aria-hidden", "true");
      lift.appendChild(clone);
      wrap.appendChild(lift);
      document.body.appendChild(wrap);
      if (!reduced()) lift.animate([{ transform: "scale(1)" }, { transform: "scale(1.03)" }], { duration: 160, easing: EASE, fill: "forwards" });
      document.body.classList.add("waf-dragging");
      if (type === "touch") navigator.vibrate?.(8);
      setActiveId(id);
      position();
      raf = requestAnimationFrame(autoScroll);
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      x = ev.clientX;
      y = ev.clientY;
      if (!self.dragging) {
        const d = Math.hypot(x - sx, y - sy);
        if (type === "touch") {
          if (d > 8) cleanup();
        } else if (d > 5) begin();
        return;
      }
      ev.preventDefault();
      position();
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      if (self.dragging) finish(ev.type === "pointercancel");
      else cleanup();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && self.dragging) {
        ev.preventDefault();
        ev.stopPropagation();
        finish(true);
      }
    };
    const onContext = (ev: Event) => {
      if (type !== "mouse") ev.preventDefault();
    };

    function cleanup() {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("contextmenu", onContext, true);
      document.body.classList.remove("waf-dragging");
      try {
        if (el.hasPointerCapture?.(pid)) el.releasePointerCapture(pid);
      } catch {
        /* لا شيء */
      }
      if (live.current === self) live.current = null;
    }

    function swallowClick() {
      const stop = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener("click", stop, { capture: true, once: true });
      window.addEventListener("dblclick", stop, { capture: true, once: true });
      setTimeout(() => {
        window.removeEventListener("click", stop, true);
        window.removeEventListener("dblclick", stop, true);
      }, 350);
    }

    async function finish(cancelled: boolean) {
      const s = state();
      cleanup();
      swallowClick();
      let result: DropResult | null = null;
      if (!cancelled) {
        try {
          result = opts.current.onDrop(s);
        } catch {
          result = null;
        }
      }
      const w = wrap!;
      const l = lift!;
      const from = w.style.transform;
      const done = () => {
        w.remove();
        setActiveId(null);
        opts.current.onEnd?.();
      };
      if (reduced()) {
        if (result?.settle) {
          await nextFrame();
          await nextFrame();
        }
        return done();
      }
      if (result?.settle) {
        let dest: HTMLElement | null = null;
        for (let i = 0; i < 24 && !dest; i++) {
          await nextFrame();
          dest = document.querySelector<HTMLElement>(result.settle);
        }
        if (dest && rect) {
          const r = dest.getBoundingClientRect();
          const to = `translate3d(${r.left - rect.left}px, ${r.top - rect.top}px, 0) scale(${r.width / rect.width}, ${r.height / rect.height})`;
          dest.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: 220, easing: EASE });
          l.animate([{ transform: "scale(1.03)" }, { transform: "scale(1)" }], { duration: 200, easing: EASE, fill: "forwards" });
          await w.animate([{ transform: from, opacity: 1 }, { transform: to, opacity: 1, offset: 0.6 }, { transform: to, opacity: 0 }], { duration: 220, easing: EASE, fill: "forwards" }).finished.catch(() => undefined);
          return done();
        }
        await w.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: EASE, fill: "forwards" }).finished.catch(() => undefined);
        return done();
      }
      // مرفوض: تعود النسخة إلى مكانها
      await w.animate([{ transform: from }, { transform: "translate3d(0,0,0)" }], { duration: 200, easing: EASE, fill: "forwards" }).finished.catch(() => undefined);
      done();
    }

    const self: Live = {
      dragging: false,
      cleanup,
      cancel: () => {
        cleanup();
        wrap?.remove();
      },
    };
    live.current = self;
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("contextmenu", onContext, true);
    if (type !== "mouse") timer = window.setTimeout(begin, opts.current.longPressMs ?? 260);
  }, []);

  /** خصائص العنصر القابل للسحب */
  const bind = useCallback(
    (item: T, id: string) => ({
      "data-drag-id": id,
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => start(e, item, id),
    }),
    [start],
  );

  return { bind, activeId };
}
