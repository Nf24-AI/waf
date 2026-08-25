import { describe, expect, it } from "vitest";

/**
 * Agenda items are flattened to one Notion bullet as `title :: context :: goal`.
 * A field containing the separator used to shift the fields and drop text, so
 * these mirror the encode/decode pair in server/notion.ts.
 */
const AGENDA_SEPARATOR = " :: ";
const AGENDA_ESCAPED = " ::⁣ ";

const encode = (value: string) => value.split(AGENDA_SEPARATOR).join(AGENDA_ESCAPED);
const decode = (value: string) => value.split(AGENDA_ESCAPED).join(AGENDA_SEPARATOR);

const write = (item: { title: string; context: string; goal: string }) =>
  [item.title, item.context, item.goal].map(encode).join(AGENDA_SEPARATOR);

const read = (line: string) => {
  const parts = line.split(AGENDA_SEPARATOR);
  return {
    title: decode(parts[0] ?? ""),
    context: decode(parts[1] ?? ""),
    goal: decode(parts.slice(2).join(AGENDA_SEPARATOR)),
  };
};

describe("agenda round-trip", () => {
  it("preserves ordinary items", () => {
    const item = { title: "أداء الربع الثالث", context: "أهم المؤشرات", goal: "تحديد ما يحتاج تدخلًا" };
    expect(read(write(item))).toEqual(item);
  });

  it("preserves a field containing the separator", () => {
    // This previously shifted every field left and lost the goal entirely.
    const item = { title: "مراجعة :: الربع", context: "سياق", goal: "هدف" };
    expect(read(write(item))).toEqual(item);
  });

  it("preserves separators in every field at once", () => {
    const item = { title: "a :: b", context: "c :: d", goal: "e :: f" };
    expect(read(write(item))).toEqual(item);
  });

  it("keeps empty fields empty", () => {
    const item = { title: "عنوان", context: "", goal: "" };
    expect(read(write(item))).toEqual(item);
  });

  it("does not lose text from a malformed legacy line", () => {
    // Lines written before escaping existed still surface all of their content.
    const legacy = "a :: b :: c :: d";
    expect(read(legacy)).toEqual({ title: "a", context: "b", goal: "c :: d" });
  });
});
