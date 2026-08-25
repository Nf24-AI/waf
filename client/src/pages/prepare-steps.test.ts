import { describe, expect, it } from "vitest";
import { PREPARE_STEPS, completedSteps, nextStep } from "./prepare-steps";
import type { MeetingRecord } from "@shared/meeting-store";

const blank: MeetingRecord = {
  id: "m",
  title: "",
  date: "اختر التاريخ",
  time: "اختر الوقت",
  type: "أخرى",
  status: "مسودة",
  attendees: [],
  summary: "",
  agenda: [],
  actions: [],
  note: "",
  link: "",
  image: "",
};

const prepared: MeetingRecord = {
  ...blank,
  title: "مراجعة شراكة الربع الثالث",
  date: "الخميس، ٢٧ أغسطس ٢٠٢٦",
  time: "١٠:٠٠ ص – ١١:٠٠ ص",
  attendees: ["سارة العتيبي"],
  summary: "الاتفاق على مسار الإطلاق وموعده ومالكه.",
  agenda: [{ title: "أداء الربع", context: "المؤشرات", goal: "قرار", decision: "", owner: "" }],
  actions: ["إحضار ملخص المؤشرات"],
};

describe("guided preparation", () => {
  it("every step carries a question and a worked example in both languages", () => {
    for (const step of PREPARE_STEPS) {
      // The example is the point: a label tells you the shape, not what good looks like.
      expect(step.question.ar.length, step.id).toBeGreaterThan(10);
      expect(step.question.en.length, step.id).toBeGreaterThan(10);
      expect(step.example.ar, step.id).toMatch(/مثال/);
      expect(step.example.en, step.id).toMatch(/Example/);
    }
  });

  it("counts nothing done for an empty meeting", () => {
    expect(completedSteps(blank)).toBe(0);
    expect(nextStep(blank)?.id).toBe("basics");
  });

  it("counts every step done for a prepared meeting", () => {
    expect(completedSteps(prepared)).toBe(PREPARE_STEPS.length);
    expect(nextStep(prepared)).toBeUndefined();
  });

  it("points at the first gap, not simply the next index", () => {
    // Basics and agenda are done; purpose is not — that is what to answer next.
    const partial = { ...prepared, summary: "" };
    expect(nextStep(partial)?.id).toBe("purpose");
  });

  it("does not accept a one-word purpose as a purpose", () => {
    expect(nextStep({ ...prepared, summary: "نقاش" })?.id).toBe("purpose");
  });

  it("does not count an agenda of untitled topics", () => {
    const untitled = { ...prepared, agenda: [{ title: "  ", context: "", goal: "", decision: "", owner: "" }] };
    expect(nextStep(untitled)?.id).toBe("agenda");
  });
});
