import { describe, expect, it } from "vitest";
import type { Task } from "@/data/types";
import { groupMatrix, parseZone, quadrantAfterDrop } from "./sorting";

const task = (p: Partial<Task>): Task => ({
  id: crypto.randomUUID(),
  title: "مهمة",
  notes: "",
  origin: "matrix",
  quadrant: null,
  startsAt: null,
  endsAt: null,
  estimateMinutes: null,
  category: "deep",
  priority: "medium",
  repeatRule: null,
  repeatDays: [],
  sourceMeetingId: null,
  completedAt: null,
  createdAt: "2026-10-27T08:00:00.000Z",
  focusSessions: 0,
  ...p,
});

describe("groupMatrix", () => {
  it("puts open tasks in their quadrant, unclassified in the inbox, finished in done", () => {
    const g = groupMatrix([
      task({ id: "a" }),
      task({ id: "b", quadrant: "do" }),
      task({ id: "c", quadrant: "drop", completedAt: "2026-10-27T09:00:00.000Z" }),
      task({ id: "d", quadrant: "plan" }),
    ]);
    expect(g.inbox.map((t) => t.id)).toEqual(["a"]);
    expect(g.quads.do.map((t) => t.id)).toEqual(["b"]);
    expect(g.quads.plan.map((t) => t.id)).toEqual(["d"]);
    expect(g.quads.drop).toEqual([]);
    expect(g.done.map((t) => t.id)).toEqual(["c"]);
  });

  it("orders newest first, and done by completion time", () => {
    const g = groupMatrix([
      task({ id: "old", createdAt: "2026-10-01T00:00:00.000Z" }),
      task({ id: "new", createdAt: "2026-10-20T00:00:00.000Z" }),
      task({ id: "x", completedAt: "2026-10-26T00:00:00.000Z" }),
      task({ id: "y", completedAt: "2026-10-27T00:00:00.000Z" }),
    ]);
    expect(g.inbox.map((t) => t.id)).toEqual(["new", "old"]);
    expect(g.done.map((t) => t.id)).toEqual(["y", "x"]);
  });

  it("handles no tasks", () => {
    const g = groupMatrix([]);
    expect(g.inbox).toEqual([]);
    expect(g.done).toEqual([]);
  });
});

describe("drop zones", () => {
  it("parses only known zones", () => {
    expect(parseZone("plan")).toBe("plan");
    expect(parseZone("inbox")).toBe("inbox");
    expect(parseZone("timeline")).toBeNull();
    expect(parseZone(undefined)).toBeNull();
  });

  it("returns undefined when nothing changes", () => {
    expect(quadrantAfterDrop({ quadrant: "do" }, "do")).toBeUndefined();
    expect(quadrantAfterDrop({ quadrant: null }, "inbox")).toBeUndefined();
    expect(quadrantAfterDrop({ quadrant: "do" }, "inbox")).toBeNull();
    expect(quadrantAfterDrop({ quadrant: null }, "plan")).toBe("plan");
  });
});
