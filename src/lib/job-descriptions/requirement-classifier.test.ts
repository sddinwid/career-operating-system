import { describe, expect, it } from "vitest";
import {
  buildInitialRequirementAnalysisDraft,
  recomputeRequirementAnalysis
} from "@/lib/job-descriptions/requirement-classifier";
import type { ParsedJobDescriptionContract } from "@/lib/job-descriptions/parser-contract";

function buildParsedFixture(): ParsedJobDescriptionContract {
  return {
    contractVersion: "1.0.0",
    parserVersion: "m3.2.0",
    parsedAt: "2026-07-16T12:00:00.000Z",
    jobDescriptionVersionId: "job-description-1",
    opportunityId: "opportunity-1",
    companyName: "Acme",
    roleTitle: "Senior Platform Engineer",
    sourceUrl: "https://company.example/jobs/123",
    sourceChecksum: "checksum-1",
    sections: [
      {
        id: "section-responsibilities",
        heading: "Responsibilities",
        type: "RESPONSIBILITIES",
        startLine: 1,
        endLine: 3,
        text: "Build resilient APIs",
        confidence: "HIGH",
        detectionRule: "section.heading.alias"
      },
      {
        id: "section-required",
        heading: "Required Qualifications",
        type: "REQUIRED_QUALIFICATIONS",
        startLine: 4,
        endLine: 6,
        text: "Required qualifications",
        confidence: "HIGH",
        detectionRule: "section.heading.alias"
      },
      {
        id: "section-preferred",
        heading: "Preferred Qualifications",
        type: "PREFERRED_QUALIFICATIONS",
        startLine: 7,
        endLine: 8,
        text: "Preferred qualifications",
        confidence: "HIGH",
        detectionRule: "section.heading.alias"
      },
      {
        id: "section-skills",
        heading: "Skills",
        type: "SKILLS",
        startLine: 9,
        endLine: 10,
        text: "TypeScript and PostgreSQL in production systems",
        confidence: "HIGH",
        detectionRule: "section.heading.alias"
      }
    ],
    roleMetadata: {
      companyName: null,
      roleTitle: null,
      seniority: null,
      employmentType: null,
      workArrangement: null,
      location: null,
      travelRequirement: null,
      clearanceRequirement: null,
      visaWorkAuthorization: null
    },
    compensation: {
      minimumSalary: null,
      maximumSalary: null,
      currency: null,
      payPeriod: null,
      compensationText: null,
      bonus: null,
      equity: null,
      commission: null,
      compensationType: null,
      locationDependentRange: false
    },
    responsibilities: [
      {
        id: "responsibility-1",
        text: "Build resilient APIs for product teams.",
        normalizedText: "build resilient apis for product teams.",
        sourceSectionId: "section-responsibilities",
        sourceLocation: { startLine: 2, endLine: 2 },
        actionVerbs: ["build"],
        technologyMentions: ["TypeScript"],
        confidence: "HIGH"
      },
      {
        id: "responsibility-2",
        text: "Apply now to join our equal opportunity workplace.",
        normalizedText: "apply now to join our equal opportunity workplace.",
        sourceSectionId: "section-responsibilities",
        sourceLocation: { startLine: 3, endLine: 3 },
        actionVerbs: ["apply"],
        technologyMentions: [],
        confidence: "MEDIUM"
      }
    ],
    qualifications: [
      {
        id: "qualification-required",
        originalText: "5+ years of TypeScript and AWS experience required.",
        normalizedText: "5+ years of typescript and aws experience required.",
        sourceSectionId: "section-required",
        sourceLocation: { startLine: 5, endLine: 5 },
        explicitLabel: "REQUIRED",
        experienceRequirementId: "experience-1",
        degreeRequirement: null,
        certificationRequirement: null,
        technologyReferences: ["TypeScript", "AWS"],
        domainReferences: [],
        leadershipReferences: [],
        confidence: "HIGH",
        extractionRule: "requirements.statement.segmented"
      },
      {
        id: "qualification-preferred",
        originalText: "AWS certification preferred.",
        normalizedText: "aws certification preferred.",
        sourceSectionId: "section-preferred",
        sourceLocation: { startLine: 8, endLine: 8 },
        explicitLabel: "PREFERRED",
        experienceRequirementId: null,
        degreeRequirement: null,
        certificationRequirement: "AWS certification",
        technologyReferences: ["AWS"],
        domainReferences: [],
        leadershipReferences: [],
        confidence: "HIGH",
        extractionRule: "requirements.statement.segmented"
      },
      {
        id: "qualification-skills",
        originalText: "TypeScript and PostgreSQL in production systems.",
        normalizedText: "typescript and postgresql in production systems.",
        sourceSectionId: "section-skills",
        sourceLocation: { startLine: 10, endLine: 10 },
        explicitLabel: "UNSPECIFIED",
        experienceRequirementId: null,
        degreeRequirement: null,
        certificationRequirement: null,
        technologyReferences: ["TypeScript", "PostgreSQL"],
        domainReferences: [],
        leadershipReferences: [],
        confidence: "MEDIUM",
        extractionRule: "requirements.statement.segmented"
      }
    ],
    technologies: [],
    experienceRequirements: [
      {
        id: "experience-1",
        minimumYears: 5,
        maximumYears: null,
        plusIndicator: true,
        associatedSkill: "TypeScript",
        sourceStatementId: "qualification-required",
        originalText: "5+ years of TypeScript and AWS experience required.",
        confidence: "HIGH"
      }
    ],
    educationRequirements: [],
    certificationRequirements: [],
    benefits: []
  };
}

describe("requirement classifier", () => {
  it("classifies required, preferred, contextual, and responsibility items conservatively", () => {
    const parsed = buildParsedFixture();
    const analysis = buildInitialRequirementAnalysisDraft({
      analysisId: "analysis-1",
      workspaceId: "workspace-1",
      parseId: "parse-1",
      parsed
    });

    expect(analysis.requirements.find((item) => item.parserStatementId === "qualification-required"))
      .toMatchObject({
        category: "REQUIRED",
        confidence: "HIGH"
      });
    expect(analysis.requirements.find((item) => item.parserStatementId === "qualification-preferred"))
      .toMatchObject({
        category: "PREFERRED",
        confidence: "HIGH"
      });
    expect(analysis.requirements.find((item) => item.parserStatementId === "qualification-skills"))
      .toMatchObject({
        category: "CONTEXTUAL",
        confidence: "LOW"
      });
    expect(analysis.responsibilities.find((item) => item.parserResponsibilityId === "responsibility-1"))
      .toMatchObject({
        relevance: "INCLUDED"
      });
    expect(analysis.responsibilities.find((item) => item.parserResponsibilityId === "responsibility-2"))
      .toMatchObject({
        relevance: "NOISE",
        excluded: false
      });
  });

  it("assigns multiple requirement kinds without treating every technology mention as required", () => {
    const parsed = buildParsedFixture();
    const analysis = buildInitialRequirementAnalysisDraft({
      analysisId: "analysis-1",
      workspaceId: "workspace-1",
      parseId: "parse-1",
      parsed
    });

    const required = analysis.requirements.find(
      (item) => item.parserStatementId === "qualification-required"
    );
    const skills = analysis.requirements.find(
      (item) => item.parserStatementId === "qualification-skills"
    );

    expect(required?.kinds).toEqual(
      expect.arrayContaining(["TECHNOLOGY", "EXPERIENCE", "CLOUD"])
    );
    expect(skills?.kinds).toEqual(expect.arrayContaining(["TECHNOLOGY", "DATA"]));
    expect(skills?.category).toBe("CONTEXTUAL");
  });

  it("recomputes diagnostics and review status after low-confidence acknowledgement", () => {
    const parsed = buildParsedFixture();
    const analysis = buildInitialRequirementAnalysisDraft({
      analysisId: "analysis-1",
      workspaceId: "workspace-1",
      parseId: "parse-1",
      parsed
    });

    expect(analysis.reviewStatus).toBe("NEEDS_REVIEW");
    expect(analysis.summary.lowConfidenceCount).toBeGreaterThan(0);

    const acknowledged = recomputeRequirementAnalysis(
      {
        ...analysis,
        lowConfidenceAcknowledged: true
      },
      parsed,
      { confirmed: true }
    );

    expect(acknowledged.reviewStatus).toBe("CONFIRMED");
    expect(acknowledged.diagnostics.some((item) => item.code === "LOW_CONFIDENCE_CLASSIFICATION")).toBe(true);
  });
});
