import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HOLD_MS, useTouchDrag, type DropTarget } from "./useTouchDrag";

const over: (DropTarget | null)[] = [];
const drops: [string, DropTarget][] = [];

function Board() {
  const touch = useTouchDrag({
    onOver: target => over.push(target),
    onDrop: (id, target) => drops.push([id, target]),
  });
  return (
    <div>
      <div data-testid="task" onTouchStart={event => touch.start(event, "t1", "مهمة", "blue")}>
        <button className="tbk-check">✓</button>
        مهمة
      </div>
      <div data-testid="row" data-hour="14" />
      <button data-testid="zone" className="tbk-dropzone" />
    </div>
  );
}

const at = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] });

/** jsdom بلا تخطيط: ما «تحت الإصبع» يُحدَّد هنا. */
function under(testId: string | null) {
  document.elementFromPoint = () => (testId ? screen.getByTestId(testId) : null);
}

function hold() {
  act(() => {
    vi.advanceTimersByTime(HOLD_MS + 10);
  });
}

/** حدث لمسٍ خام، ليُسأل بعده: هل مُنع تمريره؟ */
function rawMove(x: number, y: number) {
  const event = new Event("touchmove", { cancelable: true, bubbles: true }) as Event & { touches?: unknown };
  event.touches = [{ clientX: x, clientY: y }];
  document.dispatchEvent(event);
  return event;
}

describe("useTouchDrag", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    over.length = 0;
    drops.length = 0;
    render(<Board />);
    under(null);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("ضغطة مطوّلة ثم سحب إلى ساعة تُسقط المهمة عليها", () => {
    fireEvent.touchStart(screen.getByTestId("task"), at(10, 10));
    hold();
    expect(document.querySelector(".tbk-dragghost")?.textContent).toBe("مهمة");

    under("row");
    fireEvent.touchMove(document, at(40, 200));
    expect(over.at(-1)).toBe(14);

    fireEvent.touchEnd(document, { touches: [] });
    expect(drops).toEqual([["t1", 14]]);
    expect(document.querySelector(".tbk-dragghost")).toBeNull();
    expect(over.at(-1)).toBeNull();
  });

  it("الإسقاط على منطقة الإسقاط يُبلَّغ zone", () => {
    fireEvent.touchStart(screen.getByTestId("task"), at(10, 10));
    hold();
    under("zone");
    fireEvent.touchMove(document, at(40, 300));
    fireEvent.touchEnd(document, { touches: [] });
    expect(drops).toEqual([["t1", "zone"]]);
  });

  it("حركة قبل المهلة تمريرةٌ لا سحب", () => {
    fireEvent.touchStart(screen.getByTestId("task"), at(10, 10));
    fireEvent.touchMove(document, at(10, 60));
    hold();
    under("row");
    fireEvent.touchMove(document, at(10, 200));
    fireEvent.touchEnd(document, { touches: [] });
    expect(document.querySelector(".tbk-dragghost")).toBeNull();
    expect(drops).toEqual([]);
  });

  it("لمسة قصيرة لا تُسقط شيئاً", () => {
    fireEvent.touchStart(screen.getByTestId("task"), at(10, 10));
    under("row");
    fireEvent.touchEnd(document, { touches: [] });
    hold();
    expect(drops).toEqual([]);
    expect(document.querySelector(".tbk-dragghost")).toBeNull();
  });

  it("الرفع خارج أي ساعة يُلغي بلا إسقاط", () => {
    fireEvent.touchStart(screen.getByTestId("task"), at(10, 10));
    hold();
    fireEvent.touchMove(document, at(300, 300));
    fireEvent.touchEnd(document, { touches: [] });
    expect(drops).toEqual([]);
  });

  it("الضغطة المطوّلة على زرّ داخل الصفّ ليست سحباً", () => {
    fireEvent.touchStart(screen.getByText("✓"), at(10, 10));
    hold();
    expect(document.querySelector(".tbk-dragghost")).toBeNull();
  });

  it("السحب يمنع التمرير الأصليّ، وما قبله يتركه", () => {
    fireEvent.touchStart(screen.getByTestId("task"), at(10, 10));
    expect(rawMove(12, 12).defaultPrevented).toBe(false);

    hold();
    expect(rawMove(12, 80).defaultPrevented).toBe(true);
    fireEvent.touchEnd(document, { touches: [] });
  });
});
