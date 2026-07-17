import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { normalizeCareerKnowledgeSource } from "@/lib/career/normalize";
import type { SourceCareerKnowledge } from "@/lib/career/contracts";
import { buildEvidenceRetrievalResult } from "@/lib/evidence-retrieval/engine";
import type {
  AnalyzedRequirement,
  AnalyzedResponsibility,
  JobRequirementAnalysisContract
} from "@/lib/job-descriptions/requirement-analysis-contract";

function loadFixtureContract() {
  const fixturePath = path.resolve("fixtures/career_knowledge_base_fixture_v1.json");
  const source = JSON.parse(readFileSync(fixturePath, "utf8")) as SourceCareerKnowledge;
  return normalizeCareerKnowledgeSource(source);
}

function toJsonValue(value: unknown): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}

function createRequirement(overrides: Partial<AnalyzedRequirement>): AnalyzedRequirement {
  return {
    id: "requirement-1",
    parserStatementId: "statement-1",
    originalText: "Postgres experience required",
    normalizedText: "postgres experience required",
    correctedDisplayText: null,
    category: "REQUIRED",
    kinds: ["TECHNOLOGY", "EXPERIENCE"],
    explicitSourceLabel: "REQUIRED",
    sourceSectionId: "section-1",
    sourceSectionType: "REQUIRED_QUALIFICATIONS",
    sourceLocation: { startLine: 1, endLine: 1 },
    technologies: ["Postgres"],
    experienceText: "3+ years",
    degreeRequirement: null,
    certificationRequirement: null,
    domainReferences: [],
    leadershipReferences: [],
    confidence: "HIGH",
    classificationRule: "requirements.classify.explicit.required",
    parserProvenance: {
      parseId: "parse-1",
      parserVersion: "m3.2.0",
      parserStatementId: "statement-1",
      parserResponsibilityId: null,
      sourceSectionId: "section-1"
    },
    userOverrideState: {
      categoryChanged: false,
      kindsChanged: false,
      exclusionChanged: false,
      noteChanged: false,
      displayTextChanged: false,
      confirmationChanged: false
    },
    userAdded: false,
    excluded: false,
    reviewNote: null,
    confirmationState: "CONFIRMED",
    ...overrides
  };
}

function createAnalysis(args: {
  requirements: AnalyzedRequirement[];
  responsibilities?: AnalyzedResponsibility[];
}): JobRequirementAnalysisContract {
  return {
    id: "analysis-1",
    workspaceId: "workspace-1",
    jobDescriptionVersionId: "job-description-1",
    parseId: "parse-1",
    contractVersion: "1.0.0",
    classifierVersion: "m3.3.0",
    createdAt: "2026-07-17T12:00:00.000Z",
    reviewStatus: "CONFIRMED",
    sourceChecksum: "requirement-checksum-1",
    parserVersion: "m3.2.0",
    requirements: args.requirements,
    responsibilities: args.responsibilities ?? [],
    summary: {
      requiredCount: args.requirements.filter((item) => item.category === "REQUIRED").length,
      preferredCount: args.requirements.filter((item) => item.category === "PREFERRED").length,
      contextualCount: args.requirements.filter((item) => item.category === "CONTEXTUAL").length,
      noiseCount: args.requirements.filter((item) => item.category === "NOISE").length,
      includedResponsibilitiesCount: 0,
      excludedResponsibilitiesCount: 0,
      technologiesCount: args.requirements.flatMap((item) => item.technologies).length,
      experienceRequirementsCount: args.requirements.filter((item) =>
        item.kinds.includes("EXPERIENCE")
      ).length,
      educationRequirementsCount: args.requirements.filter((item) =>
        item.kinds.includes("EDUCATION")
      ).length,
      certificationRequirementsCount: args.requirements.filter((item) =>
        item.kinds.includes("CERTIFICATION")
      ).length,
      leadershipRequirementsCount: args.requirements.filter((item) =>
        item.kinds.includes("LEADERSHIP")
      ).length,
      domainRequirementsCount: args.requirements.filter((item) =>
        item.kinds.includes("DOMAIN")
      ).length,
      userOverridesCount: 0,
      userAddedRequirementsCount: 0,
      unresolvedReviewItemsCount: 0,
      lowConfidenceCount: 0,
      excludedRequirementsCount: args.requirements.filter((item) => item.excluded).length
    },
    lowConfidenceAcknowledged: false,
    diagnostics: []
  };
}

describe("buildEvidenceRetrievalResult", () => {
  it("retrieves canonical technology matches and linked supporting evidence deterministically", () => {
    const contract = loadFixtureContract();
    const analysis = createAnalysis({
      requirements: [createRequirement({ technologies: ["Postgres"] })]
    });

    const result = buildEvidenceRetrievalResult({
      runId: "run-1",
      workspaceId: "workspace-1",
      careerProfileVersion: {
        id: "career-version-1",
        checksum: "career-checksum-1",
        content: toJsonValue(contract)
      },
      requirementAnalysisRecord: {
        id: "analysis-1",
        jobDescriptionVersionId: "job-description-1",
        sourceChecksum: "requirement-checksum-1",
        status: "CONFIRMED",
        analysis
      },
      applicationId: "application-1",
      createdAt: "2026-07-17T12:00:00.000Z",
      inputChecksum: "input-checksum-1"
    });

    const requirementResult = result.requirementResults[0];
    const candidateTitles = requirementResult.candidateEvidence.map((item) => item.displayTitle);

    expect(requirementResult.coverageState).toBe("CANDIDATES_FOUND");
    expect(candidateTitles).toContain("PostgreSQL");
    expect(candidateTitles).toContain("Software Engineer at Fixture Corp");
    expect(
      requirementResult.candidateEvidence.some((item) =>
        item.retrievalReasons.some((reason) => reason.code === "TECHNOLOGY_ALIAS_MATCH")
      )
    ).toBe(true);
    expect(
      requirementResult.candidateEvidence.some((item) =>
        item.retrievalReasons.some((reason) => reason.code === "SKILL_EVIDENCE_LINK")
      )
    ).toBe(true);
  });

  it("does not treat JavaScript evidence as Java evidence", () => {
    const contract = loadFixtureContract();
    contract.skills[0] = {
      ...contract.skills[0],
      name: "JavaScript",
      evidenceReferences: []
    };
    contract.employment[0] = {
      ...contract.employment[0],
      technologies: ["JavaScript"]
    };

    const analysis = createAnalysis({
      requirements: [
        createRequirement({
          originalText: "Java experience required",
          normalizedText: "java experience required",
          technologies: ["Java"]
        })
      ]
    });

    const result = buildEvidenceRetrievalResult({
      runId: "run-2",
      workspaceId: "workspace-1",
      careerProfileVersion: {
        id: "career-version-1",
        checksum: "career-checksum-1",
        content: toJsonValue(contract)
      },
      requirementAnalysisRecord: {
        id: "analysis-1",
        jobDescriptionVersionId: "job-description-1",
        sourceChecksum: "requirement-checksum-1",
        status: "CONFIRMED",
        analysis
      },
      applicationId: null,
      createdAt: "2026-07-17T12:00:00.000Z",
      inputChecksum: "input-checksum-2"
    });

    expect(result.requirementResults[0].candidateEvidence).toHaveLength(0);
    expect(result.requirementResults[0].coverageState).toBe("NO_CANDIDATES");
  });

  it("keeps expired certifications as restricted evidence instead of treating them as current", () => {
    const contract = loadFixtureContract();
    const analysis = createAnalysis({
      requirements: [
        createRequirement({
          originalText: "Fixture Cloud certification required",
          normalizedText: "fixture cloud certification required",
          kinds: ["CERTIFICATION"],
          technologies: [],
          experienceText: null
        })
      ]
    });

    const result = buildEvidenceRetrievalResult({
      runId: "run-3",
      workspaceId: "workspace-1",
      careerProfileVersion: {
        id: "career-version-1",
        checksum: "career-checksum-1",
        content: toJsonValue(contract)
      },
      requirementAnalysisRecord: {
        id: "analysis-1",
        jobDescriptionVersionId: "job-description-1",
        sourceChecksum: "requirement-checksum-1",
        status: "CONFIRMED",
        analysis
      },
      applicationId: null,
      createdAt: "2026-07-17T12:00:00.000Z",
      inputChecksum: "input-checksum-3"
    });

    const requirementResult = result.requirementResults[0];

    expect(requirementResult.coverageState).toBe("LIMITED_CANDIDATES");
    expect(requirementResult.candidateEvidence[0]?.eligibility).toBe("ELIGIBLE_WITH_RESTRICTIONS");
    expect(requirementResult.candidateEvidence[0]?.restrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "EXPIRED_CERTIFICATION"
        })
      ])
    );
    expect(
      requirementResult.diagnostics.some((item) => item.code === "EXPIRED_CERTIFICATION_ONLY")
    ).toBe(true);
  });

  it("preserves excluded and noise requirements in diagnostics without matching them", () => {
    const contract = loadFixtureContract();
    const analysis = createAnalysis({
      requirements: [
        createRequirement({
          id: "requirement-noise",
          originalText: "Apply now",
          normalizedText: "apply now",
          category: "NOISE",
          kinds: ["OTHER"],
          technologies: [],
          experienceText: null
        }),
        createRequirement({
          id: "requirement-excluded",
          originalText: "Legacy requirement",
          normalizedText: "legacy requirement",
          excluded: true,
          technologies: [],
          experienceText: null
        })
      ]
    });

    const result = buildEvidenceRetrievalResult({
      runId: "run-4",
      workspaceId: "workspace-1",
      careerProfileVersion: {
        id: "career-version-1",
        checksum: "career-checksum-1",
        content: toJsonValue(contract)
      },
      requirementAnalysisRecord: {
        id: "analysis-1",
        jobDescriptionVersionId: "job-description-1",
        sourceChecksum: "requirement-checksum-1",
        status: "CONFIRMED",
        analysis
      },
      applicationId: null,
      createdAt: "2026-07-17T12:00:00.000Z",
      inputChecksum: "input-checksum-4"
    });

    expect(result.requirementResults.map((item) => item.retrievalStatus)).toEqual([
      "SKIPPED_NOISE",
      "EXCLUDED"
    ]);
    expect(result.requirementResults.every((item) => item.coverageState === "EXCLUDED")).toBe(true);
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(["NOISE_REQUIREMENT_SKIPPED", "EXCLUDED_REQUIREMENT_SKIPPED"])
    );
  });
});
