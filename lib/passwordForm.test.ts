import { describe, expect, it } from "vitest";
import { newPasswordProblem } from "@/lib/passwordForm";

describe("newPasswordProblem", () => {
  it("accepts a long enough password that was typed twice", () => {
    expect(newPasswordProblem("correct horse", "correct horse", "old one")).toBeNull();
  });
  it("names what is wrong", () => {
    expect(newPasswordProblem("short", "short")).toMatch(/at least 8/);
    expect(newPasswordProblem("a".repeat(201), "a".repeat(201))).toMatch(/at most 200/);
    expect(newPasswordProblem("longenough1", "longenough2")).toMatch(/do not match/);
    expect(newPasswordProblem("longenough1", "longenough1", "longenough1")).toMatch(/differ/);
  });
});
