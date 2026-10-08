import { afterEach, describe, expect, it } from "vitest";
import { errorText } from "./error-text";
import { setLang } from "./i18n";

const fail = (message: string, code?: string) => Object.assign(new Error(message), code ? { data: { code } } : {});

describe("نصّ الخطأ", () => {
  afterEach(() => setLang("ar"));

  it("بالعربية: رسالة الخادم كما هي", () => {
    expect(errorText(fail("يوجد تعارض في هذا الوقت مع «اجتماع»", "CONFLICT"))).toBe("يوجد تعارض في هذا الوقت مع «اجتماع»");
  });

  it("بالعربية: رسالة أول مشكلة من zod، والعامّة إن لم تكن عربية", () => {
    expect(errorText(fail(JSON.stringify([{ message: "المهمة تحتاج عنواناً" }])))).toBe("المهمة تحتاج عنواناً");
    expect(errorText(fail(JSON.stringify([{ message: "Invalid string" }])))).toBe("تعذّر تنفيذ العملية. حاول مرة أخرى.");
    expect(errorText(fail(""))).toBe("تعذّر تنفيذ العملية. حاول مرة أخرى.");
    expect(errorText(null)).toBe("تعذّر تنفيذ العملية. حاول مرة أخرى.");
  });

  it("بالإنجليزية: التعارض يحمل اسم المهمة", () => {
    setLang("en");
    expect(errorText(fail("يوجد تعارض في هذا الوقت مع «Client call»", "CONFLICT"))).toBe("That time overlaps “Client call”.");
    expect(errorText(fail("تعارض", "CONFLICT"))).toBe("That time overlaps another block.");
  });

  it("بالإنجليزية: لا يُعرض سطر عربي", () => {
    setLang("en");
    const cases = [
      fail("وقت الانتهاء يجب أن يلي وقت البداية", "BAD_REQUEST"),
      fail(JSON.stringify([{ message: "المهمة تحتاج عنواناً" }]), "BAD_REQUEST"),
      fail("لا مهمة بهذا المعرّف", "NOT_FOUND"),
      fail("تعذّر تنفيذ العملية. حاول مرة أخرى.", "INTERNAL_SERVER_ERROR"),
      fail("أي شيء"),
    ];
    for (const error of cases) expect(errorText(error)).not.toMatch(/[؀-ۿ]/);
    expect(errorText(cases[0])).toBe("End time must be after the start.");
    expect(errorText(cases[1])).toBe("The task needs a name.");
    expect(errorText(cases[2])).toBe("That item no longer exists.");
    expect(errorText(cases[4])).toBe("Something went wrong. Try again.");
  });
});
