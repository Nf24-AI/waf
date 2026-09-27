import { describe, expect, it } from "vitest";
import { allProgress, progressLabel, progressOf, type Project } from "./projects";
import { stateOf, type Task } from "./tasks";

/**
 * التقدّم يُقرأ كنسبة ويُصدَّق. ومشروعٌ فارغ يقرأ مئةً يكافئ من لم يبدأ —
 * وهو أسوأ من رقمٍ ناقص، لأنه يقول «انتهيت» لمن لم يفعل شيئاً.
 */

const project = (id: string): Project => ({ id, name: `مشروع ${id}`, color: "accent", createdAt: "2026-09-01T00:00:00.000Z" });

let n = 0;
function task(projectId?: string, done = false): Task {
  n += 1;
  const core = {
    id: `t${n}`,
    title: `مهمة ${n}`,
    projectId,
    completedSessions: 0,
    createdAt: "2026-09-01T06:00:00.000Z",
    completedAt: done ? "2026-09-02T06:00:00.000Z" : undefined,
  };
  return { ...core, state: stateOf(core) } as Task;
}

describe("تقدّم المشروع", () => {
  it("يُحسب من مهامه هو لا من غيرها", () => {
    const tasks = [task("a", true), task("a"), task("b", true), task(undefined, true)];
    const p = progressOf(project("a"), tasks);
    expect(p.total).toBe(2);
    expect(p.done).toBe(1);
    expect(p.percent).toBe(50);
  });

  it("مشروع بلا مهام يقرأ صفراً لا مئة", () => {
    const p = progressOf(project("empty"), [task("a", true)]);
    expect(p.total).toBe(0);
    expect(p.percent).toBe(0);
    expect(progressLabel(p)).toBe("لا مهام بعد");
  });

  it("المنجَز كلّه مئة", () => {
    expect(progressOf(project("a"), [task("a", true), task("a", true)]).percent).toBe(100);
  });

  it("يدوّر النسبة ولا يتركها كسراً", () => {
    const tasks = [task("a", true), task("a"), task("a")];
    expect(progressOf(project("a"), tasks).percent).toBe(33);
  });

  it("يصف العدد كما في المرجع", () => {
    const tasks = [task("a", true), task("a", true), task("a")];
    expect(progressLabel(progressOf(project("a"), tasks))).toBe("2 من 3 مهمة");
  });

  it("يحسب كل المشاريع دفعة واحدة", () => {
    const rows = allProgress([project("a"), project("b")], [task("a", true), task("b")]);
    expect(rows.map(r => r.percent)).toEqual([100, 0]);
  });
});
