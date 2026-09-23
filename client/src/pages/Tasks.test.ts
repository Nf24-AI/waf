import { describe, expect, it } from "vitest";
import { search } from "./Tasks";
import { stateOf, type Task } from "@shared/tasks";

/**
 * البحث يُخطئ بصمت: كلمة لا تُطابق تُقرأ كـ«لا نتائج»، ولا يعرف صاحبها إن
 * كانت المهمة غير موجودة أم أن المطابقة هي التي فشلت. فتُثبَّت هنا: الجزء
 * من الكلمة يطابق، والوصف يُبحث فيه، والفراغ لا يُخفي شيئاً.
 */

let counter = 0;
function task(title: string, description?: string): Task {
  counter += 1;
  const core = {
    id: `00000000-0000-0000-0000-00000000000${counter}`,
    title,
    description,
    completedSessions: 0,
    createdAt: "2026-09-20T06:00:00.000Z",
  };
  return { ...core, state: stateOf(core) } as Task;
}

const TASKS = [
  task("إعداد العرض التقديمي", "مراجعة المحتوى قبل الاجتماع"),
  task("مكالمة مع الفريق"),
  task("Review the Q4 roadmap"),
];

describe("البحث في المهام", () => {
  it("يطابق جزءاً من العنوان", () => {
    expect(search(TASKS, "العرض").map(t => t.title)).toEqual(["إعداد العرض التقديمي"]);
  });

  it("يبحث في الوصف كما يبحث في العنوان", () => {
    // «الاجتماع» لا ترد في أي عنوان — لو فُقد الوصف لعادت القائمة فارغة.
    expect(search(TASKS, "الاجتماع").map(t => t.title)).toEqual(["إعداد العرض التقديمي"]);
  });

  it("لا يفرّق بين كبير الحروف وصغيرها", () => {
    expect(search(TASKS, "roadmap")).toHaveLength(1);
    expect(search(TASKS, "ROADMAP")).toHaveLength(1);
  });

  it("يعيد كل شيء على كلمة فارغة أو فراغات", () => {
    expect(search(TASKS, "")).toHaveLength(TASKS.length);
    expect(search(TASKS, "   ")).toHaveLength(TASKS.length);
  });

  it("يعيد فارغاً على كلمة لا توجد", () => {
    expect(search(TASKS, "ميزانية")).toEqual([]);
  });
});
