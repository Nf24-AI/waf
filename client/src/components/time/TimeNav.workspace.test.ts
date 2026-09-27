import { describe, expect, it } from "vitest";
import { PRIMARY_NAV, visibleNav } from "./TimeNav";
import { MEETING_ROUTES } from "@shared/routes";

/**
 * بندٌ يقود إلى بابٍ لا يُفتح أسوأ من بندٍ غائب: يُضغط فيُقرأ عطلاً، ويُحكم
 * على المنتج به. والاجتماعات مساحة واحدة، فلا تُعرض لمن لا يملكها.
 */

describe("بنود الشريط بحسب الملكية", () => {
  it("تُعرض كاملة لمالك المساحة", () => {
    expect(visibleNav(PRIMARY_NAV, true)).toHaveLength(PRIMARY_NAV.length);
    expect(visibleNav(PRIMARY_NAV, true).map(i => i.href)).toContain(MEETING_ROUTES.prepare);
  });

  it("تُسقط الاجتماعات عمّن لا يملكها", () => {
    const shown = visibleNav(PRIMARY_NAV, false);
    expect(shown.map(i => i.href)).not.toContain(MEETING_ROUTES.prepare);
    expect(shown).toHaveLength(PRIMARY_NAV.length - 1);
  });

  it("لا تُسقط شيئاً آخر — المهام وإدارة الوقت لكل حساب", () => {
    const shown = visibleNav(PRIMARY_NAV, false).map(i => i.href);
    for (const href of PRIMARY_NAV.map(i => i.href).filter(h => h !== MEETING_ROUTES.prepare)) {
      expect(shown).toContain(href);
    }
  });
});
