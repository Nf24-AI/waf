import { describe, expect, it } from "vitest";
import { fromIsoDate, toIsoDate } from "./meeting-date";

describe("meeting date conversion", () => {
  it("parses the Arabic display format the workspace produces", () => {
    expect(toIsoDate("الثلاثاء، ٢٧ أغسطس ٢٠٢٦")).toBe("2026-08-27");
    expect(toIsoDate("الأحد، ١ سبتمبر ٢٠٢٦")).toBe("2026-09-01");
  });

  it("parses English and ISO input", () => {
    expect(toIsoDate("Tuesday, 27 August 2026")).toBe("2026-08-27");
    expect(toIsoDate("2026-09-01")).toBe("2026-09-01");
  });

  it("returns null for placeholders so Notion's date is cleared, not corrupted", () => {
    expect(toIsoDate("اختر التاريخ")).toBeNull();
    expect(toIsoDate("Choose a date")).toBeNull();
    expect(toIsoDate("")).toBeNull();
  });

  it("renders an ISO date back into the display format", () => {
    // The meetings list splits on "،" to show the weekday above the date.
    expect(fromIsoDate("2026-08-27")).toBe("الخميس، ٢٧ أغسطس ٢٠٢٦");
    expect(fromIsoDate("2026-08-27").split("،")).toHaveLength(2);
    expect(fromIsoDate("2026-08-27", "en")).toBe("Thursday, 27 August 2026");
  });

  it("round-trips without drifting", () => {
    const iso = "2026-12-31";
    expect(toIsoDate(fromIsoDate(iso))).toBe(iso);
    expect(toIsoDate(fromIsoDate(iso, "en"))).toBe(iso);
  });

  it("computes the real weekday rather than trusting the input", () => {
    // The seed data shipped "الثلاثاء" for a date that is actually a Thursday.
    expect(fromIsoDate(toIsoDate("الثلاثاء، ٢٧ أغسطس ٢٠٢٦")!)).toBe("الخميس، ٢٧ أغسطس ٢٠٢٦");
  });
});
