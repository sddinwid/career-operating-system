import { describe, expect, it } from "vitest";
import { buildCoverLetterAudit } from "@/lib/cover-letter-audit/engine";
import type { CoverLetterRevisionContent } from "@/lib/cover-letter-revision/contract";

function buildRevision(
  paragraphs: CoverLetterRevisionContent["paragraphs"]
): CoverLetterRevisionContent {
  return {
    revisionId: "revision-1",
    workspaceId: "workspace-1",
    coverLetterCompositionVersionId: "composition-1",
    predecessorRevisionId: null,
    applicationId: "application-1",
    jobOpportunityId: "opportunity-1",
    jobDescriptionVersionId: "job-description-1",
    careerProfileVersionId: "career-profile-1",
    requirementAnalysisId: "analysis-1",
    evidenceRetrievalRunId: "retrieval-1",
    evidenceScoringRunId: "scoring-1",
    matchReportRunId: "match-report-1",
    resumeCompositionVersionId: null,
    resumeRevisionVersionId: null,
    coverLetterRevisionContractVersion: "1.0.0",
    coverLetterRevisionEngineVersion: "m8.2.0",
    coverLetterRevisionConfigurationVersion: "scott-v1",
    inputChecksum: "input-1",
    contentChecksum: "content-1",
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
    status: "FINALIZED",
    validationState: "VALID_WITH_WARNINGS",
    candidateName: "Fixture Candidate",
    header: {
      email: null,
      phone: null,
      location: null,
      date: "2026-07-21",
      company: "E2E Grid Company",
      role: "E2E Grid Role"
    },
    salutation: "Dear E2E Grid Hiring Team,",
    paragraphs,
    closing: "Best regards,",
    summary: {
      targetCompany: "E2E Grid Company",
      targetRole: "E2E Grid Role",
      wordCount: 180,
      paragraphCount: paragraphs.length,
      companyReferenceCount: 1,
      roleReferenceCount: 1,
      technologyMentionCount: 1,
      professionalEvidenceParagraphCount: 1,
      projectEvidenceParagraphCount: 0,
      warningCount: 0,
      errorCount: 0,
      infoCount: 0,
      resumeOverlapRatio: 0.1,
      resumeSourceUsed: false,
      professionalEvidencePrioritized: true
    },
    styleSummary: {
      salutation: "Dear E2E Grid Hiring Team,",
      closing: "Best regards,",
      voice: "DIRECT",
      noEmDashDetected: true,
      prohibitedPhrasesDetected: []
    },
    lengthSummary: {
      targetMinWords: 250,
      targetMaxWords: 400,
      actualWords: 180,
      targetMinParagraphs: 4,
      targetMaxParagraphs: 5,
      actualParagraphs: paragraphs.length,
      withinTargetRange: false
    },
    overallProvenance: {
      overallEvidenceIds: ["evidence-1"],
      overallRequirementIds: ["requirement-1"],
      overallCareerRecordIds: ["career-record-1"],
      resumeSource: null
    },
    diagnostics: []
  };
}

describe("buildCoverLetterAudit", () => {
  it("does not treat unchanged company or role references as unsupported technology claims", () => {
    const result = buildCoverLetterAudit({
      runId: "run-1",
      workspaceId: "workspace-1",
      sourceType: "FINALIZED_REVISION",
      inputChecksum: "input-1",
      revision: buildRevision([
        {
          id: "alignment",
          type: "INTEREST_AND_ALIGNMENT",
          purpose: "Alignment",
          text: "E2E Grid Company needs an E2E Grid Role who can build reliable TypeScript systems.",
          originalText:
            "E2E Grid Company needs an E2E Grid Role who can build reliable TypeScript systems.",
          currentText:
            "E2E Grid Company needs an E2E Grid Role who can build reliable TypeScript systems.",
          wordCount: 14,
          originalOrder: 0,
          order: 0,
          supportingEvidenceIds: ["evidence-1"],
          supportingRequirementIds: ["requirement-1"],
          supportingMatchReportConclusionIds: ["match-1"],
          sourceCareerRecordIds: ["career-record-1"],
          sourceResumeSectionIds: [],
          acknowledgements: [],
          originalClaims: [],
          claims: [],
          technologies: ["TypeScript"],
          companyReferences: ["E2E Grid Company"],
          roleReferences: ["E2E Grid Role"],
          diagnostics: [],
          editedClaimRisk: false
        },
        {
          id: "closing",
          type: "CLOSING",
          purpose: "Close naturally.",
          text: "Best regards, E2E Grid Company.",
          originalText: "Best regards, E2E Grid Company.",
          currentText: "Best regards, E2E Grid Company.",
          wordCount: 5,
          originalOrder: 1,
          order: 1,
          supportingEvidenceIds: [],
          supportingRequirementIds: [],
          supportingMatchReportConclusionIds: [],
          sourceCareerRecordIds: ["career-record-1"],
          sourceResumeSectionIds: [],
          acknowledgements: [],
          originalClaims: [],
          claims: [],
          technologies: [],
          companyReferences: ["E2E Grid Company"],
          roleReferences: ["E2E Grid Role"],
          diagnostics: [],
          editedClaimRisk: false
        }
      ])
    });

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain("UNSUPPORTED_TECHNOLOGY_CLAIM");
    expect(result.findings.map((finding) => finding.ruleId)).not.toContain("PARAGRAPH_PROVENANCE_INCOMPLETE");
  });

  it("still flags newly introduced unsupported technology wording", () => {
    const result = buildCoverLetterAudit({
      runId: "run-2",
      workspaceId: "workspace-1",
      sourceType: "FINALIZED_REVISION",
      inputChecksum: "input-2",
      revision: buildRevision([
        {
          id: "evidence",
          type: "RELEVANT_EVIDENCE",
          purpose: "Support fit with evidence.",
          text: "I build reliable TypeScript systems.",
          originalText: "I build reliable TypeScript systems.",
          currentText: "I build reliable TypeScript and Kubernetes systems.",
          wordCount: 7,
          originalOrder: 0,
          order: 0,
          supportingEvidenceIds: ["evidence-1"],
          supportingRequirementIds: ["requirement-1"],
          supportingMatchReportConclusionIds: ["match-1"],
          sourceCareerRecordIds: ["career-record-1"],
          sourceResumeSectionIds: [],
          acknowledgements: [],
          originalClaims: [],
          claims: [],
          technologies: ["TypeScript"],
          companyReferences: [],
          roleReferences: ["E2E Grid Role"],
          diagnostics: [],
          editedClaimRisk: false
        }
      ])
    });

    expect(result.findings.map((finding) => finding.ruleId)).toContain("UNSUPPORTED_TECHNOLOGY_CLAIM");
  });
});
