import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseNormalizedJobDescription } from "@/lib/job-descriptions/parser";

const baseContext = {
  jobDescriptionVersionId: "job-description-regression",
  opportunityId: "opportunity-regression",
  opportunityCompanyName: "Acme",
  opportunityRoleTitle: "Backend Engineer",
  sourceUrl: "https://company.example/jobs/regression",
  sourceChecksum: "checksum-regression"
} as const;

function parseFixture(name: string) {
  return parseNormalizedJobDescription({
    ...baseContext,
    normalizedText: readFileSync(`fixtures/job-description-parser/${name}`, "utf8"),
    parsedAt: new Date("2026-07-18T12:00:00.000Z")
  });
}

describe("job description parser regression fixtures", () => {
  it("keeps bullets-removed responsibilities atomic", () => {
    const result = parseFixture("bullets-removed-line-breaks.txt");

    expect(result.result?.responsibilities.map((item) => item.text)).toEqual([
      "Design APIs for internal tools",
      "Improve deployment safety",
      "Own observability improvements"
    ]);
  });

  it("treats wrapped list lines as one responsibility", () => {
    const result = parseFixture("wrapped-responsibility.txt");

    expect(result.result?.responsibilities).toHaveLength(1);
    expect(result.result?.responsibilities[0]?.text).toContain(
      "partner with platform teams on rollout readiness"
    );
  });

  it("separates adjacent imperative responsibilities", () => {
    const result = parseFixture("adjacent-imperatives.txt");

    expect(result.result?.responsibilities).toHaveLength(2);
  });

  it("keeps one compound semicolon item intact", () => {
    const result = parseFixture("compound-semicolon-item.txt");

    expect(result.result?.qualifications).toHaveLength(1);
    expect(result.result?.qualifications[0]?.originalText).toBe(
      "Empathy for teammates and customers; contributes positively to team culture"
    );
  });

  it("preserves competency child headings and parent hierarchy", () => {
    const result = parseFixture("competency-child-headings.txt");
    const core = result.result?.sections.find((section) => section.type === "CORE_COMPETENCIES");
    const children = result.result?.sections.filter((section) => section.parentSectionId === core?.id);

    expect(core?.canonicalHeading).toBe("Core Competencies");
    expect(children?.map((section) => section.type)).toEqual([
      "TECHNICAL_CRAFT",
      "IMPACT_EXECUTION"
    ]);
  });

  it("preserves senior and staff applicability", () => {
    const result = parseFixture("senior-staff-subsections.txt");

    expect(result.result?.qualifications.map((item) => item.levelApplicability)).toEqual([
      "SENIOR_ONLY",
      "STAFF_ONLY"
    ]);
  });

  it("keeps unbulleted preferred lines atomic", () => {
    const result = parseFixture("nice-to-have-unbulleted.txt");

    expect(result.result?.qualifications).toHaveLength(3);
    expect(result.result?.qualifications.every((item) => item.explicitLabel === "PREFERRED")).toBe(
      true
    );
  });

  it("keeps company values available as contextual sections", () => {
    const result = parseFixture("company-values-context.txt");

    expect(result.result?.sections.find((section) => section.type === "COMPANY_VALUES")).toBeTruthy();
    expect(
      result.result?.qualifications.some((item) =>
        item.originalText.includes("Fearless - Break down difficult problems with care")
      )
    ).toBe(true);
  });

  it("still parses traditional requirements sections", () => {
    const result = parseFixture("traditional-requirements.txt");

    expect(result.result?.qualifications.map((item) => item.explicitLabel)).toEqual([
      "REQUIRED",
      "REQUIRED",
      "PREFERRED"
    ]);
  });

  it("does not turn paragraph-style role text into a list of synthetic requirements", () => {
    const result = parseFixture("paragraph-style-jd.txt");

    expect(result.result?.responsibilities).toHaveLength(0);
    expect(result.result?.qualifications).toHaveLength(0);
  });

  it("keeps abbreviation-heavy qualification lines atomic", () => {
    const result = parseFixture("abbreviation-safe-splitting.txt");

    expect(result.result?.qualifications.map((item) => item.originalText)).toEqual([
      "Experience with cloud systems, e.g. AWS, Azure, or GCP.",
      "Experience with Node.js, ASP.NET, and .NET services.",
      "Must be located in the U.S. and authorized to work.",
      "Use CI/CD, testing, etc. to support reliable delivery.",
      "Shipped platform version 2.1.3 services with 99.9 availability."
    ]);
  });
});
