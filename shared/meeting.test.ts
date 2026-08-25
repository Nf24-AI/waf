import { describe, expect, it } from "vitest";
import { formatAgendaIndex, getMeetingReadiness } from "./meeting";

describe("meeting utilities", () => {
  it("formats agenda indexes with two digits", () => {
    expect(formatAgendaIndex(0)).toBe("01");
    expect(formatAgendaIndex(8)).toBe("09");
    expect(formatAgendaIndex(9)).toBe("10");
  });

  it("scores readiness from the meeting's own content, not its status label", () => {
    const base = {
      id: "m", title: "اجتماع", date: "الأحد، ٢٣ أغسطس ٢٠٢٦", time: "٢:٣٠ م",
      type: "داخلي", status: "مسودة" as const, attendees: ["نواف"],
      summary: "الهدف", agenda: [{ title: "محور", context: "", goal: "" }],
      actions: [], note: "", link: "",
    };
    expect(getMeetingReadiness(base)).toBe(100);

    // A finished meeting used to score 100 purely because of its status.
    const emptyButDone = { ...base, status: "تم الاجتماع" as const, date: "اختر التاريخ", time: "اختر الوقت", summary: "", agenda: [], attendees: [] };
    expect(getMeetingReadiness(emptyButDone)).toBe(0);

    // And a well-prepared draft used to be stuck at 60.
    const halfPrepared = { ...base, summary: "", agenda: [] };
    expect(getMeetingReadiness(halfPrepared)).toBe(60);
  });
});
