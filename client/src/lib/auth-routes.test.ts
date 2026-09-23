import { describe, expect, it } from "vitest";
import { isAuthRoute, isPrivateRoute, loginHref, redirectTarget } from "./auth-routes";
import { TASKS_ROUTE, TIME_HOME_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";

/**
 * الحارس يُخطئ في اتجاهين: يترك صفحة خاصّة مكشوفة، أو يحوّل الزائر إلى
 * عنوان ليس لنا. الأول يُسرَّب، والثاني يُستعمل في التصيّد — ويمرّان صامتين.
 */

describe("حدّ العامّ والخاصّ", () => {
  it("يعرف الصفحات الخاصّة", () => {
    expect(isPrivateRoute(TASKS_ROUTE)).toBe(true);
    expect(isPrivateRoute(TIME_METHOD_ROUTES.focus)).toBe(true);
    expect(isPrivateRoute(TIME_HOME_ROUTE)).toBe(true);
  });

  it("يترك العامّة مفتوحة", () => {
    for (const open of ["/", "/welcome", "/about", "/services", "/login", "/signup"]) {
      expect(isPrivateRoute(open)).toBe(false);
    }
  });

  it("يعرف صفحات المصادقة", () => {
    expect(isAuthRoute("/login")).toBe(true);
    expect(isAuthRoute("/signup")).toBe(true);
    expect(isAuthRoute(TASKS_ROUTE)).toBe(false);
  });
});

describe("حفظ الوجهة", () => {
  it("يحمل الوجهة مرمَّزة", () => {
    expect(loginHref(TASKS_ROUTE)).toBe("/login?redirect=%2Ftasks");
    expect(loginHref("/time-management/focus?task=abc")).toBe(
      "/login?redirect=%2Ftime-management%2Ffocus%3Ftask%3Dabc",
    );
  });

  it("يعيدها كما كانت", () => {
    expect(redirectTarget("?redirect=%2Ftasks")).toBe("/tasks");
    expect(redirectTarget("?redirect=%2Ftime-management%2Ffocus%3Ftask%3Dabc")).toBe(
      "/time-management/focus?task=abc",
    );
  });

  it("يسقط الوجهة الخارجية — صفحة الدخول ليست أداة تحويل", () => {
    expect(loginHref("https://evil.example/steal")).toBe("/login");
    expect(loginHref("//evil.example")).toBe("/login");
    expect(redirectTarget("?redirect=https%3A%2F%2Fevil.example")).toBe(TIME_HOME_ROUTE);
    expect(redirectTarget("?redirect=%2F%2Fevil.example")).toBe(TIME_HOME_ROUTE);
  });

  it("يعود إلى الرئيسية حين لا وجهة", () => {
    expect(redirectTarget("")).toBe(TIME_HOME_ROUTE);
    expect(redirectTarget("?other=1")).toBe(TIME_HOME_ROUTE);
  });
});
