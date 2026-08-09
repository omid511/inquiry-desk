import { describe, expect, it } from "vitest";
import { mockExtract } from "../lib/extraction";
import { assertTransition, canTransition } from "../lib/workflow";
import { retentionCutoff } from "../lib/privacy";

describe("review-first inquiry workflow", () => {
  it("marks an incomplete request for owner review with missing fields", () => {
    const result = mockExtract("I need help with a repair, but I am not sure what timing works.");
    expect(result.missingFields).toContain("location");
    expect(result.confidence).toBeLessThan(1);
  });
  it("allows only explicit approval before closing", () => {
    expect(canTransition("ready_for_review", "approved")).toBe(true);
    expect(canTransition("ready_for_review", "closed")).toBe(false);
    expect(() => assertTransition("new", "approved")).toThrow("Invalid workflow transition");
  });
  it("requires an explicit send transition and permits a failed delivery retry", () => {
    expect(canTransition("approved", "sending")).toBe(true);
    expect(canTransition("delivery_failed", "sending")).toBe(true);
    expect(canTransition("ready_for_review", "sending")).toBe(false);
  });
  it("keeps retention deterministic", () => {
    const now = Date.parse("2026-01-01T00:00:00.000Z");
    expect(retentionCutoff(now)).toMatch(/2025-/);
  });
});
