import { describe, expect, it } from "vitest";
import { computeJobDescriptionChecksum } from "@/lib/job-descriptions/checksum";
import {
  normalizeJobDescriptionText
} from "@/lib/job-descriptions/normalize";

describe("job description normalization", () => {
  it("normalizes line endings, trims trailing whitespace, and collapses excessive blank lines deterministically", () => {
    const raw = "  Senior Engineer\r\n\r\n\r\nBuild APIs   \r\nKeep metrics\r\n\r\n\r\n\r\nSalary: $150,000  ";

    const normalized = normalizeJobDescriptionText(raw);

    expect(normalized).toBe(
      "Senior Engineer\n\nBuild APIs\nKeep metrics\n\nSalary: $150,000"
    );
    expect(normalizeJobDescriptionText(raw)).toBe(normalized);
  });

  it("computes a stable checksum from normalized text", () => {
    const first = normalizeJobDescriptionText("Role\r\nLine 2");
    const second = normalizeJobDescriptionText("Role\nLine 2");

    expect(computeJobDescriptionChecksum(first)).toBe(
      computeJobDescriptionChecksum(second)
    );
  });
});
