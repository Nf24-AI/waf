import { describe, expect, it } from "vitest";
import { NAV_ITEMS, PRIMARY_NAV, RECORD_NAV, isCurrent } from "./TimeNav";
import { MEETING_ROUTES, TIME_MANAGEMENT_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";

/**
 * الشريط يُخطئ بصمت في موضع واحد: بندان مضاءان بدل واحد. يُقرأ في الاختبار
 * ولا يُقرأ في الشاشة إلا بعد أن يعتاده المستخدم على خطئه.
 */

describe("البند الحالي", () => {
  it("يضيء بنداً واحداً فقط في كل مسار", () => {
    for (const item of NAV_ITEMS) {
      const lit = NAV_ITEMS.filter(other => isCurrent(item.href, other.href));
      expect(lit).toHaveLength(1);
      expect(lit[0].href).toBe(item.href);
    }
  });

  it("لا يضيء «إدارة الوقت» وأنت في طريق تحتها", () => {
    // «‎/time-management» بادئة لكل طريق، والمطابقة بالبادئة تُضيء اثنين.
    expect(isCurrent(TIME_METHOD_ROUTES.eisenhower, TIME_MANAGEMENT_ROUTE)).toBe(false);
    expect(isCurrent(TIME_MANAGEMENT_ROUTE, TIME_MANAGEMENT_ROUTE)).toBe(true);
  });

  it("يطفئ الجميع في صفحة خارج الشريط", () => {
    expect(NAV_ITEMS.filter(item => isCurrent("/decisions", item.href))).toEqual([]);
  });
});

describe("بنود الشريط", () => {
  it("لا يتكرّر مسار بين المجموعتين", () => {
    const hrefs = NAV_ITEMS.map(item => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("يقود إلى أداة الاجتماعات القائمة لا إلى قسم جديد", () => {
    expect(PRIMARY_NAV.map(item => item.href)).toContain(MEETING_ROUTES.prepare);
  });

  it("يفصل ما يُقرأ عمّا يُعمل فيه", () => {
    expect(RECORD_NAV).toHaveLength(2);
    expect(PRIMARY_NAV.some(item => RECORD_NAV.includes(item))).toBe(false);
  });
});
