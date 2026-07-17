import { describe, expect, it } from "vitest";
import {
  JOB_DESCRIPTION_PARSE_CONTRACT_VERSION,
  JOB_DESCRIPTION_PARSER_VERSION
} from "@/lib/job-descriptions/parser-contract";
import { parseNormalizedJobDescription } from "@/lib/job-descriptions/parser";

const baseContext = {
  jobDescriptionVersionId: "job-description-1",
  opportunityId: "opportunity-1",
  opportunityCompanyName: "Acme",
  opportunityRoleTitle: "Senior Platform Engineer",
  sourceUrl: "https://company.example/jobs/1",
  sourceChecksum: "checksum-1"
} as const;

function parse(text: string) {
  return parseNormalizedJobDescription({
    ...baseContext,
    normalizedText: text,
    parsedAt: new Date("2026-07-16T12:00:00.000Z")
  });
}

describe("parseNormalizedJobDescription", () => {
  it("extracts sections, responsibilities, qualifications, technologies, salary, and metadata deterministically", () => {
    const text = `Acme
Senior Platform Engineer
Hybrid role based in Chicago, IL. Full-time position.

What You'll Do
- Build reliable Type Script services across Node.js and AWS Lambda
- Improve deployment safety and mentor engineers
  across platform teams

Minimum Qualifications
- 5+ years of Type Script
- Bachelor's degree in Computer Science or equivalent experience
- AWS Certified Developer certification

Preferred Qualifications
- Nice to have Prisma and PostgreSQL experience
- Bonus points for GraphQL

Compensation
$150,000 - $180,000 base salary plus bonus and equity

Benefits
- Health insurance
- 401(k)`;

    const first = parse(text);
    const second = parse(text);

    expect(first.status).toBe("SUCCESS");
    expect(first).toEqual(second);
    expect(first.result?.contractVersion).toBe(JOB_DESCRIPTION_PARSE_CONTRACT_VERSION);
    expect(first.result?.parserVersion).toBe(JOB_DESCRIPTION_PARSER_VERSION);
    expect(first.result?.sections.map((section) => section.type)).toEqual(
      expect.arrayContaining([
        "RESPONSIBILITIES",
        "REQUIRED_QUALIFICATIONS",
        "PREFERRED_QUALIFICATIONS",
        "COMPENSATION",
        "BENEFITS"
      ])
    );
    expect(first.result?.responsibilities).toHaveLength(2);
    expect(first.result?.responsibilities[1]?.text).toContain("mentor engineers across platform teams");
    expect(first.result?.responsibilities[0]?.technologyMentions).toEqual(
      expect.arrayContaining(["TypeScript", "Node.js", "AWS", "Lambda"])
    );
    expect(first.result?.qualifications.map((item) => item.explicitLabel)).toEqual([
      "REQUIRED",
      "REQUIRED",
      "REQUIRED",
      "NICE_TO_HAVE",
      "BONUS"
    ]);
    expect(first.result?.technologies.map((item) => item.canonicalName)).toEqual(
      expect.arrayContaining([
        "AWS",
        "GraphQL",
        "Lambda",
        "Node.js",
        "PostgreSQL",
        "Prisma",
        "TypeScript"
      ])
    );
    expect(first.result?.compensation.minimumSalary?.value).toBe(150000);
    expect(first.result?.compensation.maximumSalary?.value).toBe(180000);
    expect(first.result?.compensation.bonus?.value).toBe("BONUS");
    expect(first.result?.compensation.equity?.value).toBe("EQUITY");
    expect(first.result?.roleMetadata.workArrangement?.value).toBe("HYBRID");
    expect(first.result?.roleMetadata.employmentType?.value).toBe("FULL_TIME");
    expect(first.result?.experienceRequirements[0]).toMatchObject({
      minimumYears: 5,
      maximumYears: null,
      plusIndicator: true,
      associatedSkill: "TypeScript"
    });
    expect(first.result?.educationRequirements[0]?.degreeLevel).toContain("Bachelor");
    expect(first.result?.certificationRequirements[0]?.name).toContain("AWS Certified");
    expect(first.result?.benefits.map((benefit) => benefit.name)).toEqual([
      "Health insurance",
      "401(k)"
    ]);
    expect(first.result?.roleMetadata.companyName?.agreementWithOpportunity).toBe("MATCH");
    expect(first.result?.roleMetadata.roleTitle?.agreementWithOpportunity).toBe("MATCH");
    expect(first.diagnostics).toEqual([]);
    expect(first.result?.responsibilities[0]?.id).toBe(
      "responsibility-5-1-build-reliable-type-script-services-acro"
    );
  });

  it("treats leading unknown headings as overview content and avoids false positives for ambiguous short aliases", () => {
    const result = parse(`Acme
Senior Platform Engineer

How We Celebrate Wins
- Gather for demos

Requirements
- Strong communication skills
- Ability to go deep on architecture reviews
- 7 to 10 years leading distributed systems`);

    expect(result.status).toBe("SUCCESS_WITH_WARNINGS");
    expect(result.result?.sections[0]?.type).toBe("OVERVIEW");
    expect(result.result?.qualifications.map((item) => item.explicitLabel)).toEqual([
      "REQUIRED",
      "REQUIRED",
      "REQUIRED"
    ]);
    expect(result.result?.technologies.map((item) => item.canonicalName)).toEqual([]);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "NO_RESPONSIBILITIES_SECTION")
    ).toBe(true);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === "EXPERIENCE_WITHOUT_CLEAR_SKILL"
      )
    ).toBe(true);
  });

  it("extracts hourly compensation, remote language, seniority, and certification preferences", () => {
    const result = parse(`Acme
Senior Platform Engineer
Remote contractor opportunity

Responsibilities
- Design internal tooling

Preferred Qualifications
- Security+ certification

Compensation
$95 per hour
`);

    expect(result.status).toBe("SUCCESS");
    expect(result.result?.compensation.minimumSalary?.value).toBe(95);
    expect(result.result?.compensation.payPeriod?.value).toBe("HOUR");
    expect(result.result?.compensation.compensationType?.value).toBe("HOURLY");
    expect(result.result?.roleMetadata.workArrangement?.value).toBe("REMOTE");
    expect(result.result?.roleMetadata.seniority?.value).toBe("SENIOR");
    expect(result.result?.roleMetadata.employmentType?.value).toBe("CONTRACT");
    expect(result.result?.certificationRequirements[0]?.preferred).toBe(true);
  });

  it("reports duplicate statements and opportunity mismatches", () => {
    const result = parseNormalizedJobDescription({
      ...baseContext,
      opportunityCompanyName: "Different Company",
      opportunityRoleTitle: "Different Role",
      normalizedText: `Acme
Senior Platform Engineer

Responsibilities
- Build APIs
- Build APIs

Requirements
- TypeScript
- TypeScript`,
      parsedAt: new Date("2026-07-16T12:00:00.000Z")
    });

    expect(result.status).toBe("SUCCESS_WITH_WARNINGS");
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === "DUPLICATE_RESPONSIBILITY_TEXT"
      )
    ).toBe(true);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === "DUPLICATE_REQUIREMENT_TEXT"
      )
    ).toBe(true);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === "COMPANY_MISMATCH_WITH_OPPORTUNITY"
      )
    ).toBe(true);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "ROLE_MISMATCH_WITH_OPPORTUNITY")
    ).toBe(true);
  });

  it("fails contract validation for extremely short descriptions", () => {
    const result = parse("Tiny");

    expect(result.status).toBe("FAILED");
    expect(result.result).toBeNull();
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "DESCRIPTION_TOO_SHORT")
    ).toBe(true);
  });
});
