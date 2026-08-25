import { describe, expect, it } from "vitest";
import { formatAgendaIndex, getMeetingReadiness } from "./meeting";

describe("meeting utilities", () => {
  it("formats agenda indexes with two digits", () => {
    expect(formatAgendaIndex(0)).toBe("01");
    expect(formatAgendaIndex(8)).toBe("09");
    expect(formatAgendaIndex(9)).toBe("10");
  });

  it("marks presentation-ready meetings as fully ready", () => {
    expect(getMeetingReadiness("جاهز للعرض")).toBe(100);
    expect(getMeetingReadiness("مسودة")).toBe(60);
    expect(getMeetingReadiness("تم الاجتماع")).toBe(100);
  });
});
