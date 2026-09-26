import { describe, expect, it } from "vitest";
import { serviceHref } from "./service-access";
import { TIME_MANAGEMENT_ROUTE, MEETING_ROUTES } from "@shared/routes";

/**
 * باب الخدمة يُخطئ في اتجاهين: يقود زائراً إلى صفحة خاصّة فيراها فارغة
 * ومعها خطأ، أو يعترض مسجَّلاً فيُطالبه بالدخول وهو داخل. كلاهما يُقرأ
 * «معطوب» لا «ممنوع».
 */

describe("باب الخدمة", () => {
  it("يفتح للمسجَّل مباشرة", () => {
    expect(serviceHref(TIME_MANAGEMENT_ROUTE, true)).toBe(TIME_MANAGEMENT_ROUTE);
    expect(serviceHref(MEETING_ROUTES.prepare, true)).toBe(MEETING_ROUTES.prepare);
  });

  it("ينقل الزائر إلى الدخول حاملاً وجهته", () => {
    expect(serviceHref(TIME_MANAGEMENT_ROUTE, false)).toBe("/login?redirect=%2Ftime-management");
    expect(serviceHref(MEETING_ROUTES.prepare, false)).toBe("/login?redirect=%2Fmeetings");
  });
});
