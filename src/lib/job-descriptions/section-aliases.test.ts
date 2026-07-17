import { describe, expect, it } from "vitest";
import { detectSectionTypeFromHeading } from "@/lib/job-descriptions/section-aliases";

describe("job description section aliases", () => {
  it("maps approved heading aliases to normalized section types", () => {
    expect(detectSectionTypeFromHeading("What You'll Do")).toBe("RESPONSIBILITIES");
    expect(detectSectionTypeFromHeading("What We're Looking For")).toBe(
      "REQUIRED_QUALIFICATIONS"
    );
    expect(detectSectionTypeFromHeading("Bonus Points")).toBe(
      "PREFERRED_QUALIFICATIONS"
    );
    expect(detectSectionTypeFromHeading("What We Offer")).toBe("BENEFITS");
  });

  it("preserves unknown headings as OTHER", () => {
    expect(detectSectionTypeFromHeading("How We Celebrate Wins")).toBe("OTHER");
  });
});
