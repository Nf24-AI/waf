import { describe, expect, it } from "vitest";
import { buildTimeRange, fromClockValue, parseTimeRange, toClockValue } from "./meeting-time";

describe("meeting time conversion", () => {
  it("parses the Arabic display range the workspace stores", () => {
    expect(parseTimeRange("١٠:٠٠ ص – ١١:٠٠ ص")).toEqual({ start: "10:00", end: "11:00" });
    expect(parseTimeRange("٢:٠٠ م – ٢:٤٥ م")).toEqual({ start: "14:00", end: "14:45" });
  });

  it("parses English input", () => {
    expect(parseTimeRange("10:00 AM - 11:30 AM")).toEqual({ start: "10:00", end: "11:30" });
    expect(parseTimeRange("1:00 PM – 2:00 PM")).toEqual({ start: "13:00", end: "14:00" });
  });

  it("handles the midnight and noon edges", () => {
    expect(toClockValue("١٢:٠٠ ص")).toBe("00:00");
    expect(toClockValue("١٢:٣٠ م")).toBe("12:30");
    expect(fromClockValue("00:00", "en")).toBe("12:00 AM");
    expect(fromClockValue("12:00", "en")).toBe("12:00 PM");
  });

  it("returns empty for placeholders so no bogus time is stored", () => {
    expect(parseTimeRange("اختر الوقت")).toEqual({ start: "", end: "" });
    expect(parseTimeRange("")).toEqual({ start: "", end: "" });
    expect(toClockValue("nonsense")).toBe("");
  });

  it("round-trips a range without drifting", () => {
    const display = "١٠:٠٠ ص – ١١:٣٠ ص";
    const { start, end } = parseTimeRange(display);
    expect(buildTimeRange(start, end, "ar")).toBe(display);
  });

  it("keeps a half-filled range usable", () => {
    expect(buildTimeRange("09:00", "", "en")).toBe("9:00 AM");
    expect(buildTimeRange("", "", "ar")).toBe("اختر الوقت");
  });
});
