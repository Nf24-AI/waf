import React, { useState } from "react";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AddTaskModal from "./AddTaskModal";

function Host() {
  const [, setTick] = useState(0);
  return (
    <>
      <button type="button" onClick={() => setTick(t => t + 1)}>rerender</button>
      <AddTaskModal pending={false} error={null} projects={[]} onClose={() => {}}
        onSubmit={() => {}} onCreateProject={async () => null} />
    </>
  );
}

describe("AddTaskModal focus", () => {
  afterEach(cleanup);
  it("keeps focus on the description", () => {
    vi.useFakeTimers();
    render(<Host />);
    act(() => { vi.advanceTimersByTime(100); });
    const title = screen.getByPlaceholderText("مثال: إعداد العرض التقديمي");
    expect(title).toHaveFocus();
    fireEvent.change(title, { target: { value: "x" } });
    const desc = screen.getByPlaceholderText(/أضف تفاصيل/);
    act(() => { desc.focus(); });
    fireEvent.click(screen.getByText("rerender"));
    act(() => { desc.focus(); vi.advanceTimersByTime(500); });
    expect(desc).toHaveFocus();
    vi.useRealTimers();
  });
});
