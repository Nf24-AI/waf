import { describe, expect, it } from "vitest";
import { NAV_GROUPS, PHONE_ITEMS, isCurrent } from "./TimeNav";
import { TIME_MANAGEMENT_ROUTE, TIME_METHOD_ROUTES } from "@shared/routes";

/**
 * الشريط يُخطئ بصمت في موضعين: بندان مضاءان بدل واحد، أو شريط جوّال ينمو
 * ببند سادس فيضيق كل بند عن الإبهام. كلاهما يُقرأ في الاختبار ولا يُقرأ في
 * الشاشة إلا بعد أن يعتاده المستخدم.
 */

describe("البند الحالي", () => {
  it("يضيء بنداً واحداً فقط في كل مسار", () => {
    const everywhere = NAV_GROUPS.flatMap(group => group.items);
    for (const item of everywhere) {
      const lit = everywhere.filter(other => isCurrent(item.href, other.href));
      expect(lit).toHaveLength(1);
      expect(lit[0].href).toBe(item.href);
    }
  });

  it("لا يضيء البوّابة وأنت في طريق تحتها", () => {
    // «‎/time-management» بادئة لكل طريق، والمطابقة بالبادئة تُضيء اثنين.
    expect(isCurrent(TIME_METHOD_ROUTES.eisenhower, TIME_MANAGEMENT_ROUTE)).toBe(false);
    expect(isCurrent(TIME_METHOD_ROUTES.eisenhower, TIME_METHOD_ROUTES.eisenhower)).toBe(true);
  });

  it("يطفئ الجميع في صفحة خارج الشريط", () => {
    const lit = NAV_GROUPS.flatMap(group => group.items).filter(item => isCurrent("/meetings", item.href));
    expect(lit).toEqual([]);
  });
});

describe("شريط الجوّال", () => {
  it("لا يتجاوز خمسة بنود", () => {
    expect(PHONE_ITEMS.length).toBeGreaterThan(0);
    expect(PHONE_ITEMS.length).toBeLessThanOrEqual(5);
  });

  it("يحمل الطرق الثلاث كلها — هي سبب وجود القسم", () => {
    const hrefs = PHONE_ITEMS.map(item => item.href);
    expect(hrefs).toEqual(expect.arrayContaining(Object.values(TIME_METHOD_ROUTES)));
  });

  it("لا يعرض بنداً ليس في الشريط الجانبي", () => {
    const all = NAV_GROUPS.flatMap(group => group.items).map(item => item.href);
    for (const item of PHONE_ITEMS) expect(all).toContain(item.href);
  });
});
