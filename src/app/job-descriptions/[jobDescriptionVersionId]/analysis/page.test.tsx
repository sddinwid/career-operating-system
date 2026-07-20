import { render, screen } from "@testing-library/react";
import JobDescriptionAnalysisPage from "@/app/job-descriptions/[jobDescriptionVersionId]/analysis/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/job-descriptions/parse-service", () => ({
  getJobDescriptionAnalysisContext: vi.fn(async () => ({
    version: {
      id: "job-description-1",
      sourceApplication: {
        id: "application-1"
      },
      currentForApplications: [{ id: "application-1" }],
      opportunity: {
        title: "Senior Engineer",
        company: {
          name: "Acme"
        }
      }
    },
    latestSuccessfulParse: {
      id: "parse-1",
      status: "SUCCESS_WITH_WARNINGS",
      diagnostics: [
        {
          code: "EXPERIENCE_WITHOUT_CLEAR_SKILL",
          severity: "WARNING",
          message: "Experience years were detected without a clear associated skill.",
          rule: "requirements.experience.ambiguous",
          location: { startLine: 10, endLine: 10 }
        }
      ],
      result: {
        contractVersion: "1.0.0",
        parserVersion: "m3.2.1",
        parsedAt: "2026-07-16T12:00:00.000Z",
        jobDescriptionVersionId: "job-description-1",
        opportunityId: "opportunity-1",
        companyName: "Acme",
        roleTitle: "Senior Engineer",
        sourceUrl: "https://company.example/jobs/1",
        sourceChecksum: "checksum-1",
        sections: [
          {
            id: "section-1-overview",
            heading: "Responsibilities",
            canonicalHeading: "What You'll Do",
            type: "RESPONSIBILITIES",
            parentSectionId: null,
            hierarchyDepth: 0,
            levelApplicability: "ALL_LEVELS",
            listOrientation: "LIST",
            startLine: 1,
            endLine: 3,
            text: "- Build systems",
            confidence: "HIGH",
            detectionRule: "section.heading.alias"
          }
        ],
        roleMetadata: {
          companyName: {
            value: "Acme",
            confidence: "HIGH",
            sourceText: "Acme",
            sourceLocation: { startLine: 1, endLine: 1 },
            extractionRule: "metadata.topline.company",
            agreementWithOpportunity: "MATCH"
          },
          roleTitle: {
            value: "Senior Engineer",
            confidence: "HIGH",
            sourceText: "Senior Engineer",
            sourceLocation: { startLine: 2, endLine: 2 },
            extractionRule: "metadata.topline.role",
            agreementWithOpportunity: "MATCH"
          },
          seniority: null,
          employmentType: null,
          requisitionId: null,
          postedText: null,
          workArrangement: {
            value: "REMOTE",
            confidence: "HIGH",
            sourceText: "Remote",
            sourceLocation: { startLine: 3, endLine: 3 },
            extractionRule: "metadata.workArrangement.remote",
            agreementWithOpportunity: "NO_OPPORTUNITY_VALUE"
          },
          location: null,
          secondaryLocation: null,
          department: null,
          travelRequirement: null,
          clearanceRequirement: null,
          visaWorkAuthorization: null
        },
        compensation: {
          minimumSalary: null,
          maximumSalary: null,
          currency: null,
          payPeriod: null,
          compensationText: "$150,000 - $180,000 base salary",
          bonus: null,
          equity: null,
          commission: null,
          compensationType: null,
          locationDependentRange: false
        },
        responsibilities: [
          {
            id: "responsibility-1",
            text: "Build systems",
            normalizedText: "build systems",
            sourceSectionId: "section-1-overview",
            sourceLocation: { startLine: 4, endLine: 4 },
            actionVerbs: ["build"],
            technologyMentions: ["TypeScript"],
            confidence: "HIGH"
          }
        ],
        qualifications: [
          {
            id: "qualification-1",
            originalText: "5+ years of TypeScript",
            normalizedText: "5+ years of typescript",
            sourceSectionId: "section-2-req",
            sourceLocation: { startLine: 5, endLine: 5 },
            explicitLabel: "REQUIRED",
            levelApplicability: "ALL_LEVELS",
            experienceRequirementId: "experience-1",
            degreeRequirement: null,
            certificationRequirement: null,
            technologyReferences: ["TypeScript"],
            domainReferences: [],
            leadershipReferences: [],
            confidence: "HIGH",
            extractionRule: "requirements.statement.segmented"
          }
        ],
        technologies: [
          {
            id: "technology-typescript",
            canonicalName: "TypeScript",
            originalText: "TypeScript",
            category: "PROGRAMMING_LANGUAGE",
            sourceRequirementIds: ["qualification-1"],
            sourceResponsibilityIds: ["responsibility-1"],
            mentionCount: 2,
            firstSourceLocation: { startLine: 4, endLine: 4 },
            aliasMatch: false,
            confidence: "HIGH"
          }
        ],
        experienceRequirements: [
          {
            id: "experience-1",
            minimumYears: 5,
            maximumYears: null,
            plusIndicator: true,
            associatedSkill: "TypeScript",
            sourceStatementId: "qualification-1",
            originalText: "5+ years of TypeScript",
            confidence: "HIGH"
          }
        ],
        educationRequirements: [],
        certificationRequirements: [],
        benefits: [
          {
            id: "benefit-1",
            name: "401(k)",
            sourceText: "401(k)",
            sourceLocation: { startLine: 6, endLine: 6 },
            confidence: "MEDIUM"
          }
        ]
      }
    },
    latestParseStatusCounts: {
      errors: 0,
      warnings: 1,
      info: 0
    }
  }))
}));

vi.mock("@/lib/job-descriptions/requirement-analysis-service", () => ({
  getJobRequirementAnalysisContext: vi.fn(async () => ({
    latestConfirmedAnalysis: null
  }))
}));

describe("JobDescriptionAnalysisPage", () => {
  it("renders the parsed result summary, extracted fields, and diagnostics", async () => {
    const page = await JobDescriptionAnalysisPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" })
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Senior Engineer" })).toBeVisible();
    expect(screen.getByText("SUCCESS WITH WARNINGS")).toBeVisible();
    expect(screen.getByText("m3.2.1")).toBeVisible();
    expect(screen.getByText("Build systems")).toBeVisible();
    expect(screen.getByText("5+ years of TypeScript")).toBeVisible();
    expect(screen.getByText("TypeScript")).toBeVisible();
    expect(screen.getByText(/What You'll Do • RESPONSIBILITIES/)).toBeVisible();
    expect(screen.getByText(/Applicability ALL LEVELS/)).toBeVisible();
    expect(screen.getByText("$150,000 - $180,000 base salary")).toBeVisible();
    expect(screen.getAllByText("MATCH")).toHaveLength(2);
    expect(
      screen.getByText("Experience years were detected without a clear associated skill.")
    ).toBeVisible();
  });
});
