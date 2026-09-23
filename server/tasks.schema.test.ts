import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * عمودٌ سبقه الكود، وخطأٌ خام يصل إلى الشاشة.
 *
 * كلاهما وقع في الإنتاج فعلاً هذا الصباح: كل قراءة مهام ترد 42703، والواجهة
 * تعرض النصّ الخام لمن لا يعنيه. لا اختبار كان يغطّي أيّهما لأن كليهما يقع
 * في الطبقة التي تكلّم الشبكة — وهي آخر ما يُختبر وأوّل ما يكسر.
 */

const ENV = {
  SUPABASE_URL: "https://probe.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
};

const WHO = { userId: "11111111-1111-1111-1111-111111111111", token: "header.payload.sig" };

/** ردّ PostgREST حين يُطلب عمود لا وجود له. */
function missingColumn(column: string) {
  return new Response(
    JSON.stringify({ code: "42703", message: `column eisenhower_tasks.${column} does not exist` }),
    { status: 400 },
  );
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

let listOpenTasks: typeof import("./tasks").listOpenTasks;

beforeEach(async () => {
  vi.resetModules();
  Object.assign(process.env, ENV);
  ({ listOpenTasks } = await import("./tasks"));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("عمود لم يُرحَّل بعد", () => {
  it("يُسقط العمود ويعيد المحاولة بدل أن تسقط القراءة كلها", async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = String(input);
      urls.push(url);
      if (url.includes("repeat_rule")) return missingColumn("repeat_rule");
      if (url.includes("reminder_minutes")) return missingColumn("reminder_minutes");
      return ok([]);
    });

    await expect(listOpenTasks(WHO)).resolves.toEqual([]);

    // محاولة لكل عمود غائب، ثم واحدة ناجحة بلا أيّهما.
    expect(urls.some(url => url.includes("repeat_rule"))).toBe(true);
    const last = urls[urls.length - 1];
    expect(last).not.toContain("repeat_rule");
    expect(last).not.toContain("reminder_minutes");
    // والأعمدة الأصلية باقية: المظلّة تُسقط الاختياريّ وحده.
    expect(last).toContain("scheduled_start");
  });

  it("لا يدور بلا نهاية على خطأ سببه شيء آخر", async () => {
    let calls = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      calls += 1;
      return new Response(JSON.stringify({ code: "42501", message: "permission denied" }), { status: 403 });
    });

    await expect(listOpenTasks(WHO)).rejects.toThrow();
    expect(calls).toBe(1);
  });
});

describe("ما يصل إلى المستخدم", () => {
  it("جملة عربية، لا نصّ قاعدة البيانات", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "42501", message: "permission denied for table" }), { status: 403 }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(listOpenTasks(WHO)).rejects.toThrow("تعذّر تنفيذ العملية. حاول مرة أخرى.");
  });

  it("يحتفظ بالتفصيل للسجلّ", async () => {
    const logged: unknown[][] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => void logged.push(args));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "42501", message: "permission denied for table" }), { status: 403 }),
    );

    await expect(listOpenTasks(WHO)).rejects.toThrow();
    // الفشل يُسجَّل كاملاً: ما يُخفى عن الشاشة لا يُخفى عمّن يصلحه.
    expect(JSON.stringify(logged)).toContain("permission denied");
  });
});
