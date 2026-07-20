import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, JobDescriptionSourceType, Prisma, PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import { importCareerKnowledge } from "@/lib/career/service";
import { scoreRetrievedEvidence } from "@/lib/evidence-scoring/service";
import { retrieveCareerEvidence } from "@/lib/evidence-retrieval/service";
import {
  approveResumeForRendering,
  getActiveResumeRenderingApproval,
  getApprovedResumeForRendering,
  getResumeRenderingApprovalEligibility,
  listResumeRenderingApprovalHistory,
  revokeResumeRenderingApproval
} from "@/lib/resume-rendering-approval/service";
import {
  confirmRequirementAnalysis,
  ensureRequirementAnalysisDraft
} from "@/lib/job-descriptions/requirement-analysis-service";
import { parseStoredJobDescriptionVersion } from "@/lib/job-descriptions/parse-service";
import { saveJobDescriptionForApplication } from "@/lib/job-descriptions/service";
import { generateMatchReport } from "@/lib/match-report/service";
import { runResumeAudit } from "@/lib/resume-audit/service";
import { createResumeComposition } from "@/lib/resume-composition/service";
import {
  finalizeResumeRevision,
  openResumeStudio,
  parseStoredResumeRevisionVersion,
  saveResumeRevisionDraft
} from "@/lib/resume-revision/service";
import { createStructuredResumePlan } from "@/lib/structured-resume/service";
import { RENDERING_WARNING_ACKNOWLEDGEMENT } from "@/lib/resume-rendering-approval/config";
import type { ResumeAuditResult } from "@/lib/resume-audit/contract";

const prisma = new PrismaClient();
const createdWorkspaceIds = new Set<string>();

async function cleanupWorkspace(workspaceId: string) {
  await prisma.activity.deleteMany({ where: { workspaceId } });
  await prisma.applicationStatusHistory.deleteMany({
    where: { application: { workspaceId } }
  });
  await prisma.aiRun.deleteMany({ where: { workspaceId } });
  await prisma.interview.deleteMany({ where: { workspaceId } });
  await prisma.documentVersion.deleteMany({
    where: { document: { workspaceId } }
  });
  await prisma.document.deleteMany({ where: { workspaceId } });
  await prisma.resumeRenderingApproval.deleteMany({ where: { workspaceId } });
  await prisma.resumeAuditRun.deleteMany({ where: { workspaceId } });
  await prisma.coverLetterCompositionVersion.deleteMany({ where: { workspaceId } });
  await prisma.resumeRevisionVersion.deleteMany({ where: { workspaceId } });
  await prisma.resumeCompositionVersion.deleteMany({ where: { workspaceId } });
  await prisma.structuredResumeVersion.deleteMany({ where: { workspaceId } });
  await prisma.matchReportRun.deleteMany({ where: { workspaceId } });
  await prisma.evidenceScoringRun.deleteMany({ where: { workspaceId } });
  await prisma.evidenceRetrievalRun.deleteMany({ where: { workspaceId } });
  await prisma.jobRequirementAnalysis.deleteMany({ where: { workspaceId } });
  await prisma.jobDescriptionParse.deleteMany({ where: { workspaceId } });
  await prisma.jobDescriptionVersion.deleteMany({ where: { workspaceId } });
  await prisma.importRow.deleteMany({ where: { importJob: { workspaceId } } });
  await prisma.importJob.deleteMany({ where: { workspaceId } });
  await prisma.auditEvent.deleteMany({ where: { workspaceId } });
  await prisma.careerProfileVersion.deleteMany({ where: { workspaceId } });
  await prisma.careerProfileSource.deleteMany({ where: { workspaceId } });
  await prisma.contact.deleteMany({ where: { workspaceId } });
  await prisma.application.deleteMany({ where: { workspaceId } });
  await prisma.jobOpportunity.deleteMany({ where: { workspaceId } });
  await prisma.company.deleteMany({ where: { workspaceId } });
  await prisma.userSetting.deleteMany({ where: { workspaceId } });
  await prisma.workspace.deleteMany({ where: { id: workspaceId } });
}

async function createWorkspace() {
  const workspace = await prisma.workspace.create({
    data: {
      name: `Resume Rendering Approval Workspace ${randomUUID()}`,
      userSettings: {
        create: [
          { key: "defaultTimeZone", value: "America/Chicago" },
          { key: "jobSearchDayCutoff", value: "03:00" }
        ]
      }
    }
  });
  createdWorkspaceIds.add(workspace.id);
  return workspace;
}

function buildInput(descriptionText: string) {
  return {
    descriptionText,
    sourceType: JobDescriptionSourceType.MANUAL_PASTE,
    sourceUrl: "https://company.example/jobs/456",
    sourceTitle: "Senior Platform Engineer",
    publishedAt: "2026-07-16"
  } as const;
}

async function prepareResumeComposition(workspaceId: string) {
  const application = await createApplication(workspaceId, {
    companyName: "Acme",
    role: "Senior Platform Engineer",
    appliedAtLocal: "2026-07-16T10:00",
    status: ApplicationStatus.APPLIED
  });
  const saved = await saveJobDescriptionForApplication(
    workspaceId,
    application.id,
    buildInput(`Acme
Senior Platform Engineer

Responsibilities
- Build resilient TypeScript APIs on AWS
- Improve observability and platform reliability

Required Qualifications
- 5+ years of TypeScript and PostgreSQL experience required

Preferred Qualifications
- Fixture Cloud certification preferred

Skills
- PostgreSQL in production systems`)
  );
  await parseStoredJobDescriptionVersion(workspaceId, saved.version!.id, prisma);
  const draft = await ensureRequirementAnalysisDraft(workspaceId, saved.version!.id, prisma);
  await confirmRequirementAnalysis(workspaceId, draft.analysis!.id, true);
  await importCareerKnowledge({
    filePath: "fixtures/career_knowledge_base_fixture_v1.json",
    prismaClient: prisma,
    workspaceId
  });
  const retrieval = await retrieveCareerEvidence(
    workspaceId,
    { jobDescriptionVersionId: saved.version!.id },
    prisma
  );
  const scoring = await scoreRetrievedEvidence(
    workspaceId,
    { evidenceRetrievalRunId: retrieval.run!.id },
    prisma
  );
  const report = await generateMatchReport(
    workspaceId,
    { evidenceScoringRunId: scoring.run!.id },
    prisma
  );
  const structuredResume = await createStructuredResumePlan(
    workspaceId,
    { matchReportRunId: report.run!.id },
    prisma
  );
  const composition = await createResumeComposition(
    workspaceId,
    { structuredResumeVersionId: structuredResume.version!.id },
    prisma
  );

  return {
    application,
    jobDescriptionVersionId: saved.version!.id,
    compositionVersionId: composition.version!.id
  };
}

async function createFinalizedRevision(workspaceId: string, jobDescriptionVersionId: string) {
  const opened = await openResumeStudio(workspaceId, jobDescriptionVersionId, prisma);
  const stored = await parseStoredResumeRevisionVersion(workspaceId, opened.revision!.id, prisma);
  stored.record.content.professionalSummary.currentText =
    "Platform engineer focused on TypeScript, PostgreSQL, and reliable backend platform delivery.";

  const saved = await saveResumeRevisionDraft(
    workspaceId,
    {
      revisionId: stored.record.content.revisionId,
      updatedAt: stored.version.updatedAt.toISOString(),
      content: stored.record.content,
      reviewNotes: stored.record.reviewNotes
    },
    prisma
  );

  return finalizeResumeRevision(
    workspaceId,
    {
      revisionId: saved!.id,
      updatedAt: saved!.updatedAt.toISOString()
    },
    prisma
  );
}

async function markAuditEligible(runId: string) {
  const run = await prisma.resumeAuditRun.findUniqueOrThrow({
    where: { id: runId }
  });
  const result = structuredClone(run.result as ResumeAuditResult);
  result.status = "PASSED";
  result.renderingReadiness = "READY_FOR_RENDERING";
  result.findings = [];
  result.statementResults = result.statementResults.map((statement) => ({
    ...statement,
    renderingEligibility: "ELIGIBLE",
    findingIds: []
  }));
  result.sectionResults = result.sectionResults.map((section) => ({
    ...section,
    renderingReadiness: "READY_FOR_RENDERING",
    warningFindingIds: [],
    errorFindingIds: []
  }));
  result.summary = {
    ...result.summary,
    auditStatus: "PASSED",
    renderingReadiness: "READY_FOR_RENDERING",
    errorCount: 0,
    warningCount: 0,
    informationCount: 0,
    unsupportedClaimCount: 0,
    missingProvenanceCount: 0,
    experienceViolationCount: 0,
    metricViolationCount: 0,
    projectContextViolationCount: 0,
    certificationViolationCount: 0,
    atsBlockerCount: 0,
    sevenSecondScanWarningCount: 0,
    duplicationFindingCount: 0
  };

  await prisma.resumeAuditRun.update({
    where: { id: runId },
    data: {
      status: "PASSED",
      renderingReadiness: "READY_FOR_RENDERING",
      result: result as never,
      summary: result.summary as never
    }
  });
}

describe("resume rendering approval service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }
    await prisma.$disconnect();
  });

  it(
    "creates idempotent base-composition approvals and resolves the rendering gate",
    async () => {
      const workspace = await createWorkspace();
      const prepared = await prepareResumeComposition(workspace.id);
      const audit = await runResumeAudit(
        workspace.id,
        { resumeCompositionVersionId: prepared.compositionVersionId },
        prisma
      );
      await markAuditEligible(audit.run!.id);

      const eligibility = await getResumeRenderingApprovalEligibility(workspace.id, {
        jobDescriptionVersionId: prepared.jobDescriptionVersionId,
        applicationId: prepared.application.id,
        sourceType: "BASE_COMPOSITION",
        sourceId: prepared.compositionVersionId,
        resumeAuditRunId: audit.run!.id
      });

      expect(eligibility.eligible).toBe(true);

      const created = await approveResumeForRendering(workspace.id, {
        jobDescriptionVersionId: prepared.jobDescriptionVersionId,
        applicationId: prepared.application.id,
        sourceType: "BASE_COMPOSITION",
        sourceId: prepared.compositionVersionId,
        resumeAuditRunId: audit.run!.id,
        expectedContentChecksum: eligibility.contentChecksum!,
        expectedCurrentApprovalId: null,
        warningAcknowledged: false,
        approvalNote: "Approved base composition."
      });

      const duplicate = await approveResumeForRendering(workspace.id, {
        jobDescriptionVersionId: prepared.jobDescriptionVersionId,
        applicationId: prepared.application.id,
        sourceType: "BASE_COMPOSITION",
        sourceId: prepared.compositionVersionId,
        resumeAuditRunId: audit.run!.id,
        expectedContentChecksum: eligibility.contentChecksum!,
        expectedCurrentApprovalId: created.approval.approvalId,
        warningAcknowledged: false,
        approvalNote: "Approved base composition."
      });

      expect(created.duplicate).toBe(false);
      expect(duplicate.duplicate).toBe(true);
      expect(duplicate.approval.approvalId).toBe(created.approval.approvalId);

      const active = await getActiveResumeRenderingApproval(workspace.id, {
        jobDescriptionVersionId: prepared.jobDescriptionVersionId,
        applicationId: prepared.application.id
      });
      expect(active?.sourceType).toBe("BASE_COMPOSITION");

      const gate = await getApprovedResumeForRendering(workspace.id, {
        jobDescriptionVersionId: prepared.jobDescriptionVersionId,
        applicationId: prepared.application.id
      });
      expect(gate.sourceType).toBe("BASE_COMPOSITION");
      expect(gate.approval.approvalId).toBe(created.approval.approvalId);
    },
    15_000
  );

  it(
    "supersedes prior approvals, preserves history, and revokes the active revision approval",
    async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareResumeComposition(workspace.id);
    const baseAudit = await runResumeAudit(
      workspace.id,
      { resumeCompositionVersionId: prepared.compositionVersionId },
      prisma
    );
    await markAuditEligible(baseAudit.run!.id);
    const baseEligibility = await getResumeRenderingApprovalEligibility(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "BASE_COMPOSITION",
      sourceId: prepared.compositionVersionId,
      resumeAuditRunId: baseAudit.run!.id
    });

    const baseApproval = await approveResumeForRendering(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "BASE_COMPOSITION",
      sourceId: prepared.compositionVersionId,
      resumeAuditRunId: baseAudit.run!.id,
      expectedContentChecksum: baseEligibility.contentChecksum!,
      expectedCurrentApprovalId: null,
      warningAcknowledged: false
    });

    const finalized = await createFinalizedRevision(workspace.id, prepared.jobDescriptionVersionId);
    const revisionAudit = await runResumeAudit(
      workspace.id,
      { resumeRevisionVersionId: finalized!.id },
      prisma
    );
    await markAuditEligible(revisionAudit.run!.id);
    const revisionEligibility = await getResumeRenderingApprovalEligibility(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "FINALIZED_REVISION",
      sourceId: finalized!.id,
      resumeAuditRunId: revisionAudit.run!.id
    });

    const revisionApproval = await approveResumeForRendering(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "FINALIZED_REVISION",
      sourceId: finalized!.id,
      resumeAuditRunId: revisionAudit.run!.id,
      expectedContentChecksum: revisionEligibility.contentChecksum!,
      expectedCurrentApprovalId: baseApproval.approval.approvalId,
      warningAcknowledged: revisionEligibility.warningAcknowledgementRequired,
      warningAcknowledgement: revisionEligibility.warningAcknowledgementRequired
        ? RENDERING_WARNING_ACKNOWLEDGEMENT
        : null
    });

    const historyAfterSupersession = await listResumeRenderingApprovalHistory(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id
    });

    expect(historyAfterSupersession).toHaveLength(2);
    expect(historyAfterSupersession[0]?.approvalId).toBe(revisionApproval.approval.approvalId);
    expect(historyAfterSupersession[1]?.status).toBe("SUPERSEDED");

    await revokeResumeRenderingApproval(workspace.id, {
      approvalId: revisionApproval.approval.approvalId,
      expectedActiveApprovalId: revisionApproval.approval.approvalId,
      reason: "Pause rendering until next revision."
    });

    const activeAfterRevoke = await getActiveResumeRenderingApproval(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id
    });
    expect(activeAfterRevoke).toBeNull();

    await expect(
      getApprovedResumeForRendering(workspace.id, {
        jobDescriptionVersionId: prepared.jobDescriptionVersionId,
        applicationId: prepared.application.id
      })
    ).rejects.toMatchObject({
      code: "MISSING_APPROVAL"
    });
    },
    15_000
  );

  it(
    "rolls back the supersession update when creating the replacement approval fails",
    async () => {
      const workspace = await createWorkspace();
      const prepared = await prepareResumeComposition(workspace.id);
      const baseAudit = await runResumeAudit(
        workspace.id,
        { resumeCompositionVersionId: prepared.compositionVersionId },
        prisma
      );
      await markAuditEligible(baseAudit.run!.id);

    const baseEligibility = await getResumeRenderingApprovalEligibility(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "BASE_COMPOSITION",
      sourceId: prepared.compositionVersionId,
      resumeAuditRunId: baseAudit.run!.id
    });

    const baseApproval = await approveResumeForRendering(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "BASE_COMPOSITION",
      sourceId: prepared.compositionVersionId,
      resumeAuditRunId: baseAudit.run!.id,
      expectedContentChecksum: baseEligibility.contentChecksum!,
      expectedCurrentApprovalId: null,
      warningAcknowledged: false
    });

    const finalized = await createFinalizedRevision(workspace.id, prepared.jobDescriptionVersionId);
    const revisionAudit = await runResumeAudit(
      workspace.id,
      { resumeRevisionVersionId: finalized!.id },
      prisma
    );
    await markAuditEligible(revisionAudit.run!.id);
    const revisionEligibility = await getResumeRenderingApprovalEligibility(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "FINALIZED_REVISION",
      sourceId: finalized!.id,
      resumeAuditRunId: revisionAudit.run!.id
    });

    await expect(
      approveResumeForRendering(
        workspace.id,
        {
          jobDescriptionVersionId: prepared.jobDescriptionVersionId,
          applicationId: prepared.application.id,
          sourceType: "FINALIZED_REVISION",
          sourceId: finalized!.id,
          resumeAuditRunId: revisionAudit.run!.id,
          expectedContentChecksum: revisionEligibility.contentChecksum!,
          expectedCurrentApprovalId: baseApproval.approval.approvalId,
          warningAcknowledged: revisionEligibility.warningAcknowledgementRequired,
          warningAcknowledgement: revisionEligibility.warningAcknowledgementRequired
            ? RENDERING_WARNING_ACKNOWLEDGEMENT
            : null
        },
        {
          $transaction: async <T>(callback: (transaction: Prisma.TransactionClient) => Promise<T>) =>
            prisma.$transaction(async (transaction) =>
              callback({
                ...transaction,
                resumeRenderingApproval: {
                  ...transaction.resumeRenderingApproval,
                  create: ((..._args: Parameters<typeof transaction.resumeRenderingApproval.create>) => {
                    throw new Error("Simulated create failure after supersession");
                  }) as unknown as typeof transaction.resumeRenderingApproval.create
                }
              })
            )
        } as PrismaClient
      )
    ).rejects.toThrow("Simulated create failure after supersession");

    const activeAfterFailure = await getActiveResumeRenderingApproval(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id
    });
    expect(activeAfterFailure?.approvalId).toBe(baseApproval.approval.approvalId);

    const baseRecordAfterFailure = await prisma.resumeRenderingApproval.findUniqueOrThrow({
      where: { id: baseApproval.approval.approvalId }
    });
    expect(baseRecordAfterFailure.status).toBe("APPROVED");
    expect(baseRecordAfterFailure.supersededAt).toBeNull();
    },
    15_000
  );
});
