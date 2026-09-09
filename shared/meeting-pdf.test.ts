import { describe, expect, it } from "vitest";
import { meetingFileName } from "./meeting-pdf";

describe("meetingFileName", () => {
  it("brands the file and keeps the Arabic date", () => {
    expect(
      meetingFileName({ title: "مراجعة الربع الثالث", date: "١٥ سبتمبر ٢٠٢٥" })
    ).toBe("واف — مراجعة الربع الثالث — ١٥ سبتمبر ٢٠٢٥");
  });

  it("brands in English when the workspace is in English", () => {
    expect(
      meetingFileName({ title: "Q3 review", date: "15 September 2025" }, "en")
    ).toBe("Waf — Q3 review — 15 September 2025");
  });

  it("drops the characters a file system would reject", () => {
    expect(
      meetingFileName({ title: 'Q3/Q4: budget? "final"', date: "2025" }, "en")
    ).toBe("Waf — Q3 Q4 budget final — 2025");
  });

  it("keeps hyphens and other punctuation a file name may hold", () => {
    expect(
      meetingFileName({ title: "Pre-launch (v2) & scope", date: "2025" }, "en")
    ).toBe("Waf — Pre-launch (v2) & scope — 2025");
  });

  it("names an untitled meeting rather than leaving a gap", () => {
    expect(meetingFileName({ title: "   ", date: "١٥ سبتمبر" })).toBe(
      "واف — اجتماع — ١٥ سبتمبر"
    );
  });

  it("leaves out a date the meeting does not have", () => {
    expect(meetingFileName({ title: "Kickoff", date: "" }, "en")).toBe(
      "Waf — Kickoff"
    );
  });

  it("never ends on a dot, which Windows would swallow", () => {
    expect(
      meetingFileName({ title: "Kickoff", date: "Sept 2025." }, "en")
    ).toBe("Waf — Kickoff — Sept 2025");
  });

  it("stays short enough for the save dialog", () => {
    const name = meetingFileName(
      { title: "x".repeat(400), date: "2025" },
      "en"
    );
    expect(name.length).toBeLessThanOrEqual(120);
  });
});
