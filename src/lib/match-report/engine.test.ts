import { describe, expect, it } from "vitest";
import { buildMatchReportResult } from "@/lib/match-report/engine";
import type { MatchReportInput } from "@/lib/match-report/contract";

function buildInput(): MatchReportInput {
  return {
    runId: "report-run-1",
    workspaceId: "workspace-1",
    evidenceScoringRunId: "scoring-run-1",
    createdAt: "2026-07-17T12:00:00.000Z",
    inputChecksum: "report-input-checksum-1",
    scoringResult: {
      runId: "scoring-run-1",
      workspaceId: "workspace-1",
      evidenceRetrievalRunId: "retrieval-run-1",
      evidenceRetrievalInputChecksum: "retrieval-input-checksum-1",
      careerProfileVersionId: "career-version-1",
      requirementAnalysisId: "analysis-1",
      jobDescriptionVersionId: "job-description-1",
      applicationId: "application-1",
      retrievalContractVersion: "1.0.0",
      scoringContractVersion: "1.0.0",
      scoringEngineVersion: "m4.2.1",
      scoringConfigurationVersion: "scott-v2",
      inputChecksum: "scoring-input-checksum-1",
      createdAt: "2026-07-17T11:00:00.000Z",
      status: "SUCCESS_WITH_WARNINGS",
      retrievalStatus: "SUCCESS",
      diagnostics: [],
      summary: {
        requirementsScored: 4,
        requiredStrongEvidenceCount: 1,
        requiredGoodEvidenceCount: 1,
        requiredLimitedOrWeakEvidenceCount: 1,
        requiredNoEvidenceCount: 1,
        preferredStrongOrGoodEvidenceCount: 0,
        restrictedOnlyRequirementCount: 1,
        noEvidenceRequirementCount: 1,
        averageEligibleCandidateScore: 76,
        diagnosticErrorCount: 0,
        diagnosticWarningCount: 0,
        diagnosticInfoCount: 0
      },
      scoringConfiguration: {},
      requirementScores: [
        {
          requirementId: "req-typescript",
          itemType: "REQUIREMENT",
          category: "REQUIRED",
          requirementImportance: 1,
          kinds: ["TECHNOLOGY", "EXPERIENCE"],
          originalText: "TypeScript required",
          correctedDisplayText: "Production TypeScript experience",
          competencyComponents: [
            {
              componentId: "component-rest",
              label: "REST API Design",
              competencyId: "rest-api-design",
              competencyName: "REST API Design",
              relationshipStrength: "DIRECT",
              matchedSignals: ["RESTful"],
              oneOfGroup: null,
              direct: true,
              inferred: false,
              explanation: "REST requirement component."
            }
          ],
          evidenceStrengthState: "STRONG_EVIDENCE",
          highestCandidateScore: 96,
          eligibleCandidateCount: 1,
          restrictedCandidateCount: 0,
          ineligibleCandidateCount: 0,
          diagnostics: [],
          rankedCandidates: [
            {
              candidateId: "candidate-pro-ts",
              careerEvidenceId: "career-pro-ts",
              displayTitle: "Senior Engineer at Acme",
              claimText: "Led production TypeScript services in Node.js.",
              evidenceType: "RESPONSIBILITY",
              context: "PROFESSIONAL",
              recency: "CURRENT",
              recordKind: "SOURCE_FACT",
              confirmationState: "USER_CONFIRMED",
              metricVerificationState: "VERIFIED",
              employer: "Acme",
              role: "Senior Engineer",
              project: null,
              skill: null,
              technologies: ["TypeScript", "Node.js"],
              matchedTechnologies: ["TypeScript", "Node.js"],
              matchedRequirementKinds: ["TECHNOLOGY", "EXPERIENCE"],
              dateMetadata: {
                startDate: "2024-01",
                endDate: "2026-05",
                lastUsedDate: "2026-05",
                datePrecision: "MONTH"
              },
              sourceProvenance: {
                sourceSection: "professionalExperience",
                sourceId: "career-pro-ts",
                sourcePath: "professionalExperience[0]"
              },
              retrievalReasons: [],
              matchedCompetencies: [
                {
                  competencyId: "rest-api-design",
                  competencyName: "REST API Design",
                  category: "API_ENGINEERING",
                  relationshipStrength: "EXACT",
                  matchedSignals: ["RESTful APIs"],
                  explanation: "Direct REST API evidence.",
                  direct: true,
                  inferred: false
                }
              ],
              restrictions: [],
              eligibility: "ELIGIBLE",
              visibleForDiagnostics: true,
              exclusionReasons: [],
              finalScore: 96,
              unclampedScore: 96,
              strengthBand: "STRONG",
              rank: 1,
              directRelationshipStrength: 3,
              factorContributions: [],
              penaltyContributions: []
            }
          ]
        },
        {
          requirementId: "req-postgres",
          itemType: "REQUIREMENT",
          category: "REQUIRED",
          requirementImportance: 1,
          kinds: ["TECHNOLOGY", "DATA"],
          originalText: "PostgreSQL required",
          correctedDisplayText: "Production PostgreSQL experience",
          evidenceStrengthState: "GOOD_EVIDENCE",
          highestCandidateScore: 82,
          eligibleCandidateCount: 1,
          restrictedCandidateCount: 0,
          ineligibleCandidateCount: 0,
          diagnostics: [],
          rankedCandidates: [
            {
              candidateId: "candidate-pro-pg",
              careerEvidenceId: "career-pro-pg",
              displayTitle: "Platform Engineer at Beta",
              claimText: "Owned PostgreSQL services in production.",
              evidenceType: "RESPONSIBILITY",
              context: "PROFESSIONAL",
              recency: "RECENT",
              recordKind: "SOURCE_FACT",
              confirmationState: "SOURCE_PROVIDED",
              metricVerificationState: null,
              employer: "Beta",
              role: "Platform Engineer",
              project: null,
              skill: null,
              technologies: ["PostgreSQL", "AWS"],
              matchedTechnologies: ["PostgreSQL"],
              matchedRequirementKinds: ["TECHNOLOGY", "DATA"],
              dateMetadata: {
                startDate: "2022-01",
                endDate: "2025-01",
                lastUsedDate: "2025-01",
                datePrecision: "MONTH"
              },
              sourceProvenance: {
                sourceSection: "professionalExperience",
                sourceId: "career-pro-pg",
                sourcePath: "professionalExperience[1]"
              },
              retrievalReasons: [],
              restrictions: [],
              eligibility: "ELIGIBLE",
              visibleForDiagnostics: true,
              exclusionReasons: [],
              finalScore: 82,
              unclampedScore: 82,
              strengthBand: "GOOD",
              rank: 1,
              directRelationshipStrength: 3,
              factorContributions: [],
              penaltyContributions: []
            }
          ]
        },
        {
          requirementId: "req-clearance",
          itemType: "REQUIREMENT",
          category: "REQUIRED",
          requirementImportance: 1,
          kinds: ["DOMAIN"],
          originalText: "Active clearance required",
          correctedDisplayText: null,
          evidenceStrengthState: "NO_EVIDENCE",
          highestCandidateScore: null,
          eligibleCandidateCount: 0,
          restrictedCandidateCount: 0,
          ineligibleCandidateCount: 0,
          diagnostics: [],
          rankedCandidates: []
        },
        {
          requirementId: "pref-cert",
          itemType: "REQUIREMENT",
          category: "PREFERRED",
          requirementImportance: 0.55,
          kinds: ["CERTIFICATION"],
          originalText: "Active AWS certification preferred",
          correctedDisplayText: null,
          evidenceStrengthState: "RESTRICTED_ONLY",
          highestCandidateScore: null,
          eligibleCandidateCount: 0,
          restrictedCandidateCount: 1,
          ineligibleCandidateCount: 0,
          diagnostics: [],
          rankedCandidates: [
            {
              candidateId: "candidate-expired-cert",
              careerEvidenceId: "career-expired-cert",
              displayTitle: "AWS Developer Associate",
              claimText: "Expired AWS certification.",
              evidenceType: "CERTIFICATION",
              context: "CERTIFICATION",
              recency: "STALE",
              recordKind: "SOURCE_FACT",
              confirmationState: "EXPIRED_REFERENCE",
              metricVerificationState: null,
              employer: null,
              role: null,
              project: null,
              skill: null,
              technologies: ["AWS"],
              matchedTechnologies: ["AWS"],
              matchedRequirementKinds: ["CERTIFICATION"],
              dateMetadata: {
                startDate: "2020-01",
                endDate: "2022-01",
                lastUsedDate: "2022-01",
                datePrecision: "MONTH"
              },
              sourceProvenance: {
                sourceSection: "certifications",
                sourceId: "career-expired-cert",
                sourcePath: "certifications[0]"
              },
              retrievalReasons: [],
              restrictions: [
                {
                  code: "EXPIRED_CERTIFICATION",
                  explanation: "Certification is expired."
                }
              ],
              eligibility: "INELIGIBLE",
              visibleForDiagnostics: true,
              exclusionReasons: [],
              finalScore: 20,
              unclampedScore: 20,
              strengthBand: "WEAK",
              rank: 1,
              directRelationshipStrength: 1,
              factorContributions: [],
              penaltyContributions: []
            }
          ]
        }
      ]
    }
  };
}

describe("match report engine", () => {
  it("builds deterministic summaries, strengths, and claims to avoid without probability wording", () => {
    const result = buildMatchReportResult(buildInput());

    expect(result.matchReportConfigurationVersion).toBe("scott-v1");
    expect(result.matchReportEngineVersion).toBe("m4.3.1");
    expect(result.summary.matchTier).toBe("PARTIAL_ALIGNMENT");
    expect(result.summary.pursuitRecommendation).toBe("DO_NOT_RECOMMEND_YET");
    expect(result.summary.resumeReadinessState).toBe("NOT_READY");
    expect(result.summary.criticalRequiredGapCount).toBe(1);
    expect(result.summary.strongRequiredCount).toBe(1);
    expect(result.summary.goodRequiredCount).toBe(1);
    expect(result.strengths[0]?.strengthCategory).toBe("REST API Design");
    expect(result.strengths[0]?.supportingEvidenceLabels).toEqual(["Senior Engineer - Acme"]);
    expect(result.requirementConclusions[0]?.strongestAlignmentLabel).toBe("REST API Design");
    expect(result.requirementConclusions[0]?.topEvidenceClusters?.[0]?.primaryLabel).toBe(
      "Senior Engineer - Acme"
    );
    expect(result.resumeGuidance.claimsToAvoid.some((item) => item.concept.includes("clearance"))).toBe(true);
    expect(JSON.stringify(result).toLowerCase()).not.toContain("probability");
  });

  it("marks restricted preferred certification evidence conservatively", () => {
    const result = buildMatchReportResult(buildInput());
    const preferred = result.requirementConclusions.find((item) => item.requirementId === "pref-cert");

    expect(preferred?.gapTypes).toContain("RESTRICTED_ONLY");
    expect(preferred?.gapTypes).toContain("EXPIRED_CERTIFICATION");
    expect(preferred?.conclusionCode).toBe("RESTRICTED_SUPPORT");
    expect(result.resumeGuidance.claimsToAvoid.find((item) => item.concept.includes("certification"))?.handling).toBe("EXPIRED");
  });
});
