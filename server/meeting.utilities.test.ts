import { describe, expect, it } from "vitest";
import { formatAgendaIndex, getMeetingReadiness, moveListItem } from "../shared/meeting";

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

  it("reorders agenda items without mutating the source list", () => {
    const items = ["افتتاح", "أداء", "إطلاق"];
    expect(moveListItem(items, 2, 0)).toEqual(["إطلاق", "أداء", "افتتاح"]);
    expect(items).toEqual(["افتتاح", "أداء", "إطلاق"]);
  });
});
