import { describe, expect, it } from "vitest";
import { buildGridSlots } from "./grid";

describe("buildGridSlots", () => {
  it("fills row-major order and leaves empty slots", () => {
    const slots = buildGridSlots(["a", "b", "c", "d", "e", "f", "g"], 4);

    expect(slots).toEqual([
      { index: 0, row: 0, column: 0, tileId: "a" },
      { index: 1, row: 0, column: 1, tileId: "b" },
      { index: 2, row: 0, column: 2, tileId: "c" },
      { index: 3, row: 0, column: 3, tileId: "d" },
      { index: 4, row: 1, column: 0, tileId: "e" },
      { index: 5, row: 1, column: 1, tileId: "f" },
      { index: 6, row: 1, column: 2, tileId: "g" },
      { index: 7, row: 1, column: 3, tileId: null }
    ]);
  });

  it("uses one row for fewer tiles than columns", () => {
    expect(buildGridSlots(["a", "b"], 4)).toHaveLength(4);
  });

  it("throws for invalid column counts", () => {
    expect(() => buildGridSlots(["a"], 0)).toThrow("Column count must be at least 1");
  });
});
