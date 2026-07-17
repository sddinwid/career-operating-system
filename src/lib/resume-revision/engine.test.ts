import { describe, expect, it } from "vitest";
import {
  buildResumeRevisionRecord,
  createResumeRevisionDraftFromComposition
} from "@/lib/resume-revision/engine";
import type { ResumeCompositionContent } from "@/lib/resume-composition/contract";

function buildComposition(): ResumeCompositionContent {
  return {
    runId: "composition-1",
    workspaceId: "workspace-1",
    structuredResumeVersionId: "structured-1",
    careerProfileVersionId: "career-1",
    requirementAnalysisId: "analysis-1",
    matchReportRunId: "report-1",
    jobDescriptionVersionId: "job-1",
    applicationId: "application-1",
    resumeCompositionContractVersion: "1.0.0",
    resumeCompositionEngineVersion: "m5.2.0",
    resumeCompositionConfigurationVersion: "scott-v1",
    createdAt: "2026-07-17T11:00:00.000Z",
    inputChecksum: "composition-checksum-1",
    status: "READY",
    targetCompany: "Acme",
    targetRole: "Senior Platform Engineer",
    targetRoleFamily: "NODE_TYPESCRIPT_BACKEND",
    stackFamily: "NODE_TYPESCRIPT_BACKEND",
    pageTarget: 2,
    diagnostics: [],
    header: [],
    professionalSummary: {
      sentences: [
        {
          statementId: "summary:1",
          text: "Platform engineer focused on TypeScript APIs and PostgreSQL services.",
          templateId: "summary.role",
          provenance: {
            statementId: "summary:1",
            sourceEvidenceIds: ["role-1"],
            sourceCareerRecordIds: ["role-1"],
            requirementIds: ["req-1"],
            templateId: "summary.role",
            transformations: [],
            metricReferences: [],
            technologies: ["TypeScript", "PostgreSQL"],
            restrictions: [],
            recordKinds: ["SOURCE_FACT"],
            confirmationStates: ["SOURCE_PROVIDED"],
            truthfulnessClassification: "VERIFIED_COMPOSITE",
            claimsToAvoidChecked: []
          }
        }
      ],
      text: "Platform engineer focused on TypeScript APIs and PostgreSQL services.",
      sentenceCount: 1,
      wordCount: 9,
      warnings: []
    },
    skillsGroups: [
      {
        groupId: "BACKEND",
        groupLabel: "Backend",
        order: 0,
        estimatedLineCount: 1,
        skills: [
          {
            canonicalValue: "TypeScript",
            displayValue: "TypeScript",
            supportingEvidenceIds: ["role-1"],
            requirementIds: ["req-1"],
            professionalUse: true,
            projectUse: true,
            recency: "CURRENT",
            qualificationText: null,
            inclusionReason: "core skill",
            provenance: {
              statementId: "skill:typescript",
              sourceEvidenceIds: ["role-1"],
              sourceCareerRecordIds: ["skill-1"],
              requirementIds: ["req-1"],
              templateId: "skills.direct-display",
              transformations: [],
              metricReferences: [],
              technologies: ["TypeScript"],
              restrictions: [],
              recordKinds: ["SOURCE_FACT"],
              confirmationStates: ["SOURCE_PROVIDED"],
              truthfulnessClassification: "VERIFIED_COMPOSITE",
              claimsToAvoidChecked: []
            }
          }
        ]
      }
    ],
    professionalExperience: [
      {
        roleId: "role-1",
        employer: "Acme",
        roleTitle: "Senior Engineer",
        location: "Chicago, IL",
        startDate: "2024-01",
        endDate: "2026-05",
        workArrangement: "REMOTE",
        employmentType: null,
        technologies: ["TypeScript", "PostgreSQL"],
        sectionPosition: 0,
        estimatedLineCount: 3,
        bullets: [
          {
            statementId: "bullet-1",
            text: "Improved throughput by 20 percent for TypeScript APIs.",
            templateId: "role-bullet.1",
            estimatedLineCount: 1,
            provenance: {
              statementId: "bullet-1",
              sourceEvidenceIds: ["role-1"],
              sourceCareerRecordIds: ["role-1"],
              requirementIds: ["req-1"],
              templateId: "role-bullet.1",
              transformations: [],
              metricReferences: [],
              technologies: ["TypeScript"],
              restrictions: [],
              recordKinds: ["SOURCE_FACT"],
              confirmationStates: ["SOURCE_PROVIDED"],
              truthfulnessClassification: "VERIFIED_SOURCE",
              claimsToAvoidChecked: []
            }
          }
        ],
        provenance: {
          statementId: "role-header:role-1",
          sourceEvidenceIds: ["role-1"],
          sourceCareerRecordIds: ["role-1"],
          requirementIds: ["req-1"],
          templateId: "role-header",
          transformations: [],
          metricReferences: [],
          technologies: [],
          restrictions: [],
          recordKinds: ["SOURCE_FACT"],
          confirmationStates: ["SOURCE_PROVIDED"],
          truthfulnessClassification: "VERIFIED_SOURCE",
          claimsToAvoidChecked: []
        }
      }
    ],
    selectedProjects: [],
    education: [],
    certifications: [],
    finalSectionOrder: [
      "HEADER",
      "PROFESSIONAL_SUMMARY",
      "CORE_SKILLS",
      "PROFESSIONAL_EXPERIENCE"
    ],
    sectionEstimates: [
      {
        sectionType: "PROFESSIONAL_EXPERIENCE",
        estimatedLines: 6
      }
    ],
    summary: {
      targetCompany: "Acme",
      targetRole: "Senior Platform Engineer",
      targetRoleFamily: "NODE_TYPESCRIPT_BACKEND",
      stackFamily: "NODE_TYPESCRIPT_BACKEND",
      sectionCount: 4,
      summaryWordCount: 9,
      skillCount: 1,
      includedRoleCount: 1,
      includedProjectCount: 0,
      bulletCount: 1,
      verifiedSourceStatementCount: 2,
      verifiedCompositeStatementCount: 2,
      qualifiedStatementCount: 0,
      prohibitedStatementCount: 0,
      estimatedLineCount: 10,
      estimatedPageCount: 1.1,
      pageBudgetStatus: "WITHIN_TARGET",
      diagnosticErrorCount: 0,
      diagnosticWarningCount: 0,
      diagnosticInfoCount: 0
    }
  };
}

describe("resume revision engine", () => {
  it("creates a draft and keeps safe edits valid", async () => {
    const draft = await createResumeRevisionDraftFromComposition({
      revisionId: "revision-1",
      workspaceId: "workspace-1",
      baseResumeCompositionVersionId: "composition-1",
      predecessorRevisionId: null,
      sourceInputChecksum: "composition-checksum-1",
      composition: buildComposition(),
      createdAt: "2026-07-17T12:00:00.000Z"
    });

    draft.professionalSummary.currentText =
      "Platform engineer focused on TypeScript and PostgreSQL platforms.";
    draft.skillsGroups[0]!.skills[0]!.qualificationText = "recent production use";

    const record = buildResumeRevisionRecord({
      content: draft,
      reviewNotes: [],
      latestAudit: null,
      latestAuditStatus: null
    });

    expect(record.summary.localValidationState).toBe("VALID");
    expect(record.changeSet.length).toBeGreaterThan(0);
  });

  it("blocks unsupported technology and metric edits in bullets", async () => {
    const draft = await createResumeRevisionDraftFromComposition({
      revisionId: "revision-1",
      workspaceId: "workspace-1",
      baseResumeCompositionVersionId: "composition-1",
      predecessorRevisionId: null,
      sourceInputChecksum: "composition-checksum-1",
      composition: buildComposition(),
      createdAt: "2026-07-17T12:00:00.000Z"
    });

    draft.professionalExperience[0]!.bullets[0]!.currentText =
      "Improved throughput by 45 percent for TypeScript APIs and Kubernetes services.";

    const record = buildResumeRevisionRecord({
      content: draft,
      reviewNotes: [],
      latestAudit: null,
      latestAuditStatus: null
    });

    expect(record.summary.localValidationState).toBe("BLOCKED");
    expect(record.diagnostics.some((item) => item.code === "bullet.metric-change")).toBe(true);
    expect(
      record.diagnostics.some((item) => item.code === "bullet.unsupported-technology")
    ).toBe(true);
  });
});
