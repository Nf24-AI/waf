import { describe, expect, it, vi } from "vitest";

// بلا حساب: الاختبار يفحص التنظيف وسلوك «لا حساب»، لا شبكة Supabase.
vi.mock("./supabase", () => ({ supabase: null }));

import { LABEL_MAX, cleanLabels, loadAccountLabels, saveAccountLabels } from "./category-labels";

describe("أسماء الفئات", () => {
  it("يُبقي التسمية ويقصّ فراغها", () => {
    expect(cleanLabels({ deep: "  تركيز عميق  ", meeting: "لقاءات" })).toEqual({ deep: "تركيز عميق", meeting: "لقاءات" });
  });

  it("يُسقط الفارغ والمطابق للأصل", () => {
    expect(cleanLabels({ deep: "   ", meeting: "اجتماعات", personal: "شخصي" })).toEqual({});
  });

  it("يُسقط ما ليس فئةً نعرفها وما ليس نصّاً", () => {
    expect(cleanLabels({ deep: 5, hobby: "هواية", project: "مشاريع" })).toEqual({ project: "مشاريع" });
  });

  it("يقصّ الاسم الطويل عند الحدّ", () => {
    expect(cleanLabels({ other: "س".repeat(LABEL_MAX + 10) }).other).toHaveLength(LABEL_MAX);
  });

  it("يعود فارغاً على مدخلٍ ليس كائناً", () => {
    expect(cleanLabels(null)).toEqual({});
    expect(cleanLabels("deep")).toEqual({});
    expect(cleanLabels(undefined)).toEqual({});
  });

  it("بلا حساب: لا تحميل ولا حفظ، ولا خطأ", async () => {
    await expect(loadAccountLabels()).resolves.toBeNull();
    await expect(saveAccountLabels({ deep: "تركيز" })).resolves.toBe(false);
  });
});
