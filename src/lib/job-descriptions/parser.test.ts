import { readFileSync } from "node:fs";
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
const fieldguideFixture = readFileSync(
  "fixtures/fieldguide-software-engineer-all-levels.txt",
  "utf8"
);
const marathonFixture = readFileSync(
  "fixtures/job-description-parser/workday-marathon-health-software-engineer.txt",
  "utf8"
);
const skyflowFixture = readFileSync(
  "fixtures/job-description-parser/skyflow-backend-engineer.txt",
  "utf8"
);

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
    expect(first.diagnostics.some((diagnostic) => diagnostic.severity !== "INFO")).toBe(false);
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
    expect(result.result?.technologies.map((item) => item.canonicalName)).toEqual([
      "Distributed Systems"
    ]);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "NO_RESPONSIBILITIES_SECTION")
    ).toBe(true);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === "EXPERIENCE_WITHOUT_CLEAR_SKILL"
      )
    ).toBe(false);
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

  it("keeps Fieldguide responsibilities, competency sections, preferred items, and context atomic", () => {
    const result = parseNormalizedJobDescription({
      ...baseContext,
      opportunityCompanyName: "Fieldguide",
      opportunityRoleTitle: "Software Engineer (All Levels)",
      normalizedText: fieldguideFixture,
      parsedAt: new Date("2026-07-18T19:00:00.000Z")
    });

    expect(result.status).toBe("SUCCESS_WITH_WARNINGS");
    expect(result.result?.roleMetadata.companyName?.value).toBe("Fieldguide");
    expect(result.result?.roleMetadata.roleTitle?.value).toBe("Software Engineer (All Levels)");
    expect(result.result?.roleMetadata.employmentType?.value).toBe("FULL_TIME");
    expect(result.result?.roleMetadata.seniority?.value).toBe("MULTI_LEVEL");
    expect(result.result?.roleMetadata.workArrangement?.value).toBe(
      "REMOTE_WITH_HYBRID_CONDITION"
    );
    expect(result.result?.roleMetadata.location?.value).toBe("Remote, United States");
    expect(result.result?.roleMetadata.secondaryLocation?.value).toBe(
      "San Francisco, CA (Bay Area hybrid)"
    );
    expect(result.result?.roleMetadata.department?.value).toBe("Engineering");
    expect(result.result?.compensation.minimumSalary?.value).toBe(150000);
    expect(result.result?.compensation.maximumSalary?.value).toBe(260000);
    expect(result.result?.compensation.equity?.value).toBe("EQUITY");
    expect(
      result.result?.sections.some((item) =>
        ["Employment Type", "Location Type", "Department", "Engineering"].includes(item.heading)
      )
    ).toBe(false);
    expect(result.result?.responsibilities).toHaveLength(5);
    expect(
      result.result?.responsibilities.some((item) =>
        item.text.includes("Design, build, and deliver high-quality features")
      )
    ).toBe(true);
    expect(
      result.result?.responsibilities.some((item) =>
        item.text.includes("Contribute to a supportive, growth-oriented engineering culture")
      )
    ).toBe(true);
    expect(
      result.result?.sections.find((item) => item.type === "CORE_COMPETENCIES")
    ).toBeTruthy();
    expect(
      result.result?.sections.filter((item) => item.parentSectionId !== null).map((item) => item.type)
    ).toEqual(
      expect.arrayContaining([
        "TECHNICAL_CRAFT",
        "IMPACT_EXECUTION",
        "COLLABORATION_INFLUENCE",
        "CULTURE_GROWTH"
      ])
    );
    expect(
      result.result?.qualifications.filter((item) => {
        const section = result.result?.sections.find((candidate) => candidate.id === item.sourceSectionId);
        return section?.heading === "Technical Craft";
      }).length
    ).toBe(4);
    expect(
      result.result?.qualifications.filter((item) => {
        const section = result.result?.sections.find((candidate) => candidate.id === item.sourceSectionId);
        return section?.heading === "Impact & Execution";
      }).length
    ).toBe(3);
    expect(
      result.result?.qualifications.filter((item) => {
        const section = result.result?.sections.find((candidate) => candidate.id === item.sourceSectionId);
        return section?.heading === "Collaboration & Influence";
      }).length
    ).toBe(3);
    expect(
      result.result?.qualifications.filter((item) => {
        const section = result.result?.sections.find((candidate) => candidate.id === item.sourceSectionId);
        return section?.heading === "Culture & Growth";
      }).length
    ).toBe(4);
    expect(
      result.result?.qualifications.some(
        (item) =>
          item.originalText.includes("TypeScript, React, Node.js, Python, and GraphQL") &&
          item.levelApplicability === "ALL_LEVELS"
      )
    ).toBe(true);
    expect(
      result.result?.qualifications.some(
        (item) =>
          item.originalText.includes("AWS, Postgres, and Hasura") &&
          item.explicitLabel === "PREFERRED"
      )
    ).toBe(true);
    expect(
      result.result?.qualifications.some(
        (item) =>
          item.originalText.includes("Take increasing ownership") &&
          item.levelApplicability === "CONDITIONAL_HIGHER_LEVEL"
      )
    ).toBe(true);
    expect(
      result.result?.qualifications.some(
        (item) =>
          item.originalText.includes("Lead complex projects or systems") &&
          item.levelApplicability === "SENIOR_ONLY"
      )
    ).toBe(true);
    expect(
      result.result?.qualifications.some(
        (item) =>
          item.originalText.includes("Drive company-level technical initiatives") &&
          item.levelApplicability === "STAFF_ONLY"
      )
    ).toBe(true);
    expect(result.result?.technologies.map((item) => item.canonicalName)).toEqual(
      expect.arrayContaining([
        "AWS",
        "CI/CD",
        "FedRAMP",
        "GraphQL",
        "Hasura",
        "Machine Learning",
        "Node.js",
        "PostgreSQL",
        "Python",
        "React",
        "SOC 2",
        "TypeScript"
      ])
    );
    expect(
      result.result?.qualifications.filter((item) => item.explicitLabel === "PREFERRED").length
    ).toBe(7);
    expect(
      result.result?.sections.find((item) => item.type === "COMPANY_VALUES")
    ).toBeTruthy();
    expect(
      result.result?.qualifications.some((item) =>
        item.originalText.includes("remote candidates anywhere in the US")
      )
    ).toBe(true);
    expect(
      result.result?.qualifications.some((item) =>
        item.originalText.includes("Bay Area-based employees will work in a hybrid setting")
      )
    ).toBe(true);
    expect(
      result.result?.qualifications.some((item) =>
        item.originalText.includes("final level will be determined during the interview process")
      )
    ).toBe(true);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "NO_REQUIREMENTS_SECTION")
    ).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "UNRECOGNIZED_SECTION_HEADING" &&
          /Core Competencies|Our Values/i.test(diagnostic.message)
      )
    ).toBe(false);
  });

  it("parses Workday-style Marathon postings without promoting wrapper chrome into sections", () => {
    const result = parseNormalizedJobDescription({
      ...baseContext,
      opportunityCompanyName: "Marathon Health",
      opportunityRoleTitle: "Software Engineer",
      sourceUrl:
        "https://marathonhealth.wd501.myworkdayjobs.com/Marathon-Health-Careers/job/Remote/Software-Engineer_JR108257-1",
      normalizedText: marathonFixture,
      parsedAt: new Date("2026-07-19T21:30:00.000Z")
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.result?.parserVersion).toBe(JOB_DESCRIPTION_PARSER_VERSION);
    expect(result.result?.roleMetadata.companyName?.value).toBe("Marathon Health");
    expect(result.result?.roleMetadata.roleTitle?.value).toBe("Software Engineer");
    expect(result.result?.roleMetadata.location?.value).toBe("Remote");
    expect(result.result?.roleMetadata.workArrangement?.value).toBe("REMOTE");
    expect(result.result?.roleMetadata.employmentType?.value).toBe("FULL_TIME");
    expect(result.result?.roleMetadata.requisitionId?.value).toBe("JR108257");
    expect(result.result?.roleMetadata.postedText?.value).toBe("Posted 2 Days Ago");
    expect(result.result?.compensation.minimumSalary?.value).toBe(80000);
    expect(result.result?.compensation.maximumSalary?.value).toBe(110000);
    expect(result.result?.compensation.payPeriod?.value).toBe("YEAR");
    expect(result.result?.responsibilities).toHaveLength(8);
    expect(result.result?.responsibilities[0]?.text).toContain("Feature Development:");
    expect(result.result?.responsibilities[7]?.text).toContain("Continuous Improvement:");
    expect(result.result?.qualifications.some((item) => /2\+\s+years of software development experience/i.test(item.originalText))).toBe(true);
    expect(
      result.result?.qualifications.some(
        (item) => item.equivalencyText === "Equivalent education/experience accepted"
      )
    ).toBe(true);
    expect(result.result?.qualifications.some((item) => /Agile Scrum environment/i.test(item.originalText))).toBe(true);
    expect(result.result?.qualifications.filter((item) => item.explicitLabel === "PREFERRED").length).toBeGreaterThanOrEqual(8);
    expect(
      result.result?.qualifications.some(
        (item) =>
          item.sourceGroupId !== null &&
          /Bachelors or Masters Degree/i.test(item.originalText)
      )
    ).toBe(true);
    expect(
      result.result?.qualifications.some(
        (item) =>
          item.sourceGroupId !== null &&
          /AWS Certified Cloud Practitioner certification or equivalent/i.test(item.originalText)
      )
    ).toBe(true);
    expect(
      result.result?.qualifications.some(
        (item) => /Pay Range:/i.test(item.originalText)
      )
    ).toBe(false);
    expect(result.result?.technologies.map((item) => item.canonicalName)).toEqual(
      expect.arrayContaining([
        "API Gateway",
        "AWS",
        "Agile Scrum",
        "Athena",
        "Azure DevOps",
        "C#",
        "CI/CD",
        "CloudWatch",
        "Debezium",
        "ECS",
        "EKS",
        "Freshworks",
        "Kafka",
        "Lambda",
        "Microservices",
        "NServiceBus",
        "NetSuite",
        "PostgreSQL",
        "REST API",
        "React",
        "React Native",
        "Ruby on Rails",
        "S3",
        "SNS",
        "Salesforce",
        "Terraform",
        "TypeScript"
      ])
    );
    expect(result.result?.experienceRequirements.some((item) => item.minimumYears === 2 && item.plusIndicator)).toBe(true);
    expect(result.result?.educationRequirements.some((item) => /Bachelors|Masters/i.test(item.sourceText))).toBe(true);
    expect(
      result.result?.qualifications.some(
        (item) => item.equivalencyText === "Equivalent education/experience accepted"
      )
    ).toBe(true);
    expect(result.result?.certificationRequirements.some((item) => /AWS Certified Cloud Practitioner/i.test(item.name))).toBe(true);
    expect(
      result.result?.sections.some((item) =>
        ["Remote", "Full-time", "Apply", "Save", "Show all"].includes(item.heading)
      )
    ).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "NO_RESPONSIBILITIES_SECTION")).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "NO_REQUIREMENTS_SECTION")).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "COMPANY_MISMATCH_WITH_OPPORTUNITY")).toBe(false);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "WORKDAY_WRAPPER_NOISE_REMOVED")).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "WORKDAY_METADATA_BLOCK_DETECTED")).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "RESERVED_ABOUT_HEADING_NOT_COMPANY")).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "LABELED_RESPONSIBILITIES_DETECTED")).toBe(true);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === "COMPENSATION_EXCLUDED_FROM_REQUIREMENTS"
      )
    ).toBe(true);
  });

  it("parses Skyflow headings and preserves overview paragraphs as non-metadata content", () => {
    const result = parseNormalizedJobDescription({
      ...baseContext,
      opportunityCompanyName: "Skyflow",
      opportunityRoleTitle: "Software Engineer",
      sourceUrl:
        "https://www.skyflow.com/careers?ashby_jid=5caff613-773d-466d-9876-cd803811d30b",
      normalizedText: skyflowFixture,
      parsedAt: new Date("2026-07-22T03:05:18.989Z")
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.result?.parserVersion).toBe(JOB_DESCRIPTION_PARSER_VERSION);
    expect(result.result?.roleMetadata.companyName?.value).toBe("Skyflow");
    expect(result.result?.roleMetadata.companyName?.agreementWithOpportunity).toBe("MATCH");
    expect(result.result?.roleMetadata.roleTitle?.value).toBe("Backend Software Engineer");
    expect(result.result?.sections.map((section) => section.type)).toEqual(
      expect.arrayContaining([
        "ABOUT_ROLE",
        "REQUIRED_QUALIFICATIONS",
        "RESPONSIBILITIES",
        "BENEFITS"
      ])
    );
    expect(
      result.result?.sections.some(
        (section) =>
          section.type === "REQUIRED_QUALIFICATIONS" && section.heading === "You have"
      )
    ).toBe(true);
    expect(
      result.result?.sections.some(
        (section) => section.type === "RESPONSIBILITIES" && section.heading === "You will"
      )
    ).toBe(true);
    expect(result.result?.responsibilities.length).toBeGreaterThanOrEqual(6);
    expect(result.result?.qualifications.length).toBeGreaterThanOrEqual(8);
    expect(
      result.result?.responsibilities.some((item) =>
        item.text.includes("Privacy APIs and backend infrastructure")
      )
    ).toBe(true);
    expect(
      result.result?.responsibilities.some((item) =>
        item.text.includes("REST/GraphQL services, message queues")
      )
    ).toBe(true);
    expect(
      result.result?.qualifications.some((item) =>
        item.originalText.includes("Go (preferred), Java, C, C++, Python")
      )
    ).toBe(true);
    expect(
      result.result?.qualifications.some((item) =>
        item.originalText.includes("RESTful design, event driven systems")
      )
    ).toBe(true);
    expect(result.result?.technologies.map((item) => item.canonicalName)).toEqual(
      expect.arrayContaining([
        "AWS",
        "Azure",
        "BigQuery",
        "CI/CD",
        "Distributed Systems",
        "Event-Driven Systems",
        "GCP",
        "Go",
        "GraphQL",
        "Java",
        "Kafka",
        "Python",
        "REST API",
        "Snowflake"
      ])
    );
    expect(
      result.result?.roleMetadata.roleTitle?.sourceText
    ).toBe("Backend Software Engineer");
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "NO_RESPONSIBILITIES_SECTION")
    ).toBe(false);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "NO_REQUIREMENTS_SECTION")
    ).toBe(false);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "COMPANY_MISMATCH_WITH_OPPORTUNITY")
    ).toBe(false);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "ROLE_MISMATCH_WITH_OPPORTUNITY")
    ).toBe(false);
  });
});
