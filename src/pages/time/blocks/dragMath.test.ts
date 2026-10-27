import { describe, expect, it } from "vitest";
import { dragSpeed } from "./dragMath";

describe("dragSpeed", () => {
  it("is zero away from the edges", () => {
    expect(dragSpeed(400, 0, 800)).toBe(0);
  });
  it("scrolls up near the top and down near the bottom, faster closer to the edge", () => {
    expect(dragSpeed(40, 0, 800)).toBeLessThan(0);
    expect(dragSpeed(0, 0, 800)).toBe(-18);
    expect(dragSpeed(790, 0, 800)).toBeGreaterThan(dragSpeed(760, 0, 800));
    expect(dragSpeed(900, 0, 800)).toBe(18);
  });
  it("does nothing in tiny containers", () => {
    expect(dragSpeed(5, 0, 100)).toBe(0);
  });
});
