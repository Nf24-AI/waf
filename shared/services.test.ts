import { describe, expect, it } from "vitest";
import { SERVICES, derivedServices, liveServices, rootServices } from "./services";

/**
 * الكتالوج هو مصدر عدد الخدمات في المكانين: الوجه العام يعلن ما يقوم وحده،
 * والمنصّة تفتح كل صفحة. الاختبارات هنا تحرس الفرق بينهما، لأن كسره لا
 * يُرى: تصير الصفحة تَعِد الغريب بأربع أدوات مستقلّة وهي اثنتان.
 */
describe("services catalogue", () => {
  it("counts only what stands on its own as a service", () => {
    expect(rootServices().map(service => service.id)).toEqual(["meetings", "time"]);
  });

  it("keeps the decision log and the status report as outputs of meetings", () => {
    // كلاهما يُقرأ من الاجتماعات ولا يملك بياناً خاصاً به — انظر summary.
    expect(derivedServices("meetings").map(service => service.id)).toEqual(["decisions", "status"]);
  });

  it("still opens every derived page inside the platform", () => {
    // الفرق تعريفيّ لا حجب: من دخل المنصّة يصل إليها كلها.
    for (const service of liveServices()) expect(service.href).toBeTruthy();
  });

  it("never marks a service as part of one that does not exist", () => {
    const ids = new Set(SERVICES.map(service => service.id));
    for (const service of SERVICES) {
      if (service.partOf) expect(ids.has(service.partOf)).toBe(true);
    }
  });

  it("never lets an upcoming service claim a destination", () => {
    for (const service of SERVICES.filter(item => item.status === "soon")) {
      expect(service.href).toBeUndefined();
    }
  });
});
