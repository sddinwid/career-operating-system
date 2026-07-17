import { render, screen } from "@testing-library/react";
import ResumeComparePage from "@/app/job-descriptions/[jobDescriptionVersionId]/resume/compare/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/resume-composition/service", () => ({
  getResumeCompositionContext: vi.fn(async () => ({
    reusableResumeCompositionVersion: {
      id: "composition-1"
    }
  }))
}));

vi.mock("@/lib/resume-revision/service", () => ({
  getResumeRevisionContext: vi.fn(async () => ({
    latestFinalizedRevision: {
      id: "revision-1"
    }
  })),
  parseStoredResumeRevisionVersion: vi.fn(async () => ({
    version: {
      id: "revision-1",
      applicationId: "application-1"
    },
    record: {
      content: {
        targetRole: "Senior Platform Engineer",
        targetCompany: "Acme",
        predecessorRevisionId: null
      }
    }
  }))
}));

vi.mock("@/lib/resume-comparison/service", () => ({
  compareResumeSources: vi.fn(async () => ({
    comparisonMode: "BASE_VS_REVISION",
    workspaceId: "workspace-1",
    jobDescriptionVersionId: "job-1",
    applicationId: "application-1",
    contractVersion: "1.0.0",
    engineVersion: "m6.2.0",
    generatedAt: "2026-07-17T12:00:00.000Z",
    left: {
      sourceType: "BASE_COMPOSITION",
      sourceId: "composition-1",
      contentChecksum: "left-checksum",
      auditId: "audit-base",
      auditStatus: "PASSED",
      renderingReadiness: "READY_FOR_RENDERING",
      label: "Base composition"
    },
    right: {
      sourceType: "FINALIZED_REVISION",
      sourceId: "revision-1",
      contentChecksum: "right-checksum",
      auditId: "audit-revision",
      auditStatus: "PASSED_WITH_WARNINGS",
      renderingReadiness: "READY_WITH_WARNINGS",
      label: "Finalized revision"
    },
    summary: {
      sectionsChanged: 2,
      statementsChanged: 3,
      statementsAdded: 1,
      statementsRemoved: 0,
      skillsAdded: 1,
      skillsRemoved: 0,
      skillsReordered: 1,
      rolesChanged: 0,
      projectsChanged: 1,
      bulletsChanged: 1,
      notesAdded: 1,
      provenanceChanges: 0,
      resolvedBlockingFindings: 1,
      remainingBlockingFindings: 0,
      newBlockingFindings: 0,
      warningChanges: 2,
      pageEstimateChange: -0.2,
      renderingReadinessChanged: true,
      eligibleForApproval: true
    },
    sections: [
      {
        sectionType: "PROFESSIONAL_SUMMARY",
        leftPresent: true,
        rightPresent: true,
        changeState: "MODIFIED",
        leftOrder: 1,
        rightOrder: 1,
        orderChanged: false,
        contentChanges: 1,
        itemAdditions: 0,
        itemRemovals: 0,
        itemReorderings: 0,
        auditImpactSummary: {
          resolved: 1,
          remaining: 0,
          introduced: 0,
          changed: 0
        },
        statements: [
          {
            stableId: "summary:1",
            itemType: "SUMMARY_SENTENCE",
            statementId: "summary-1",
            baseStatementId: "summary-1",
            section: "PROFESSIONAL_SUMMARY",
            parentId: null,
            leftText: "Original summary text.",
            rightText: "Revised summary text.",
            changeState: "MODIFIED",
            normalizedEqual: false,
            provenancePreserved: true,
            sourceEvidenceChanged: false,
            requirementReferenceChanged: false,
            metricReferenceChanged: false,
            truthfulnessClassificationChanged: false,
            restrictionsChanged: false,
            associatedChangeIds: ["change-1"],
            auditFindingChanges: ["RESOLVED"],
            textDiff: {
              leftTokens: [],
              rightTokens: []
            }
          }
        ]
      }
    ],
    findingChanges: [
      {
        comparisonState: "RESOLVED",
        comparisonKey: "rule-1|summary-1",
        ruleId: "summary.rule",
        statementId: "summary-1",
        section: "PROFESSIONAL_SUMMARY",
        category: "STYLE",
        leftSeverity: "WARNING",
        rightSeverity: null,
        leftBlocksRendering: false,
        rightBlocksRendering: false,
        leftMessage: "Original warning",
        rightMessage: null,
        leftActualValue: "original",
        rightActualValue: null
      }
    ],
    changeSetReconciliation: [],
    diagnostics: []
  }))
}));

vi.mock("@/lib/resume-rendering-approval/service", () => ({
  getActiveResumeRenderingApproval: vi.fn(async () => null),
  getResumeRenderingApprovalEligibility: vi.fn(async () => ({
    eligible: true,
    eligibleWithWarnings: true,
    warningAcknowledgementRequired: true,
    sourceType: "FINALIZED_REVISION",
    sourceId: "revision-1",
    resumeAuditRunId: "audit-revision",
    renderingReadiness: "READY_WITH_WARNINGS",
    warningCount: 2,
    blockingCount: 0,
    contentChecksum: "right-checksum",
    diagnostics: []
  })),
  listResumeRenderingApprovalHistory: vi.fn(async () => [])
}));

describe("ResumeComparePage", () => {
  it("renders comparison summary, section diffs, and approval state", async () => {
    const page = await ResumeComparePage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-1" }),
      searchParams: Promise.resolve({
        mode: "BASE_VS_REVISION",
        revisionId: "revision-1"
      })
    });

    render(page);

    expect(screen.getByText("Resume comparison")).toBeVisible();
    expect(screen.getByText("Base vs Current Revision")).toBeVisible();
    expect(screen.getByText("Sections changed")).toBeVisible();
    expect(screen.getByText("Resume Diff")).toBeVisible();
    expect(screen.getByText("Original summary text.")).toBeVisible();
    expect(screen.getByText("Revised summary text.")).toBeVisible();
    expect(screen.getByText("Rendering Approval")).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve for Rendering" })).toBeVisible();
  });
});
