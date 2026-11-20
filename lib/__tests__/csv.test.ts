import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("CSV formula protection", () => {
  it.each(["=SUM(1,1)", "+1", "-1", "@cmd", "\tcmd", "\rcmd"])("neutralizes %s", (value) => {
    const csv = toCsv(["Title"], [[value]]);
    expect(csv).toContain("'" + value);
  });

  it("preserves ordinary values and quotes CSV delimiters", () => {
    expect(toCsv(["Title"], [["A, \"book\""]])).toBe('Title\n"A, ""book"""');
  });
});
