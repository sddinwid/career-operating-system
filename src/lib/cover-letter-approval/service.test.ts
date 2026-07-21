import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, JobDescriptionSourceType, PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import { importCareerKnowledge } from "@/lib/career/service";
import { approveCoverLetterRevision, getActiveCoverLetterApproval, getCoverLetterApprovalEligibility, listCoverLetterApprovalHistory, revokeCoverLetterApproval } from "@/lib/cover-letter-approval/service";
import { COVER_LETTER_APPROVAL_WARNING_ACKNOWLEDGEMENT } from "@/lib/cover-letter-approval/config";
import { runCoverLetterAudit } from "@/lib/cover-letter-audit/service";
import { createCoverLetterComposition } from "@/lib/cover-letter-composition/service";
import { finalizeCoverLetterRevision, openCoverLetterStudio, parseStoredCoverLetterRevisionVersion } from "@/lib/cover-letter-revision/service";
import { scoreRetrievedEvidence } from "@/lib/evidence-scoring/service";
import { retrieveCareerEvidence } from "@/lib/evidence-retrieval/service";
import { confirmRequirementAnalysis, ensureRequirementAnalysisDraft } from "@/lib/job-descriptions/requirement-analysis-service";
import { parseStoredJobDescriptionVersion } from "@/lib/job-descriptions/parse-service";
import { saveJobDescriptionForApplication } from "@/lib/job-descriptions/service";
import { generateMatchReport } from "@/lib/match-report/service";

const prisma = new PrismaClient();
const createdWorkspaceIds = new Set<string>();

async function cleanupWorkspace(workspaceId: string) {
  await prisma.activity.deleteMany({ where: { workspaceId } });
  await prisma.applicationStatusHistory.deleteMany({ where: { application: { workspaceId } } });
  await prisma.aiRun.deleteMany({ where: { workspaceId } });
  await prisma.interview.deleteMany({ where: { workspaceId } });
  await prisma.documentVersion.deleteMany({ where: { document: { workspaceId } } });
  await prisma.document.deleteMany({ where: { workspaceId } });
  await prisma.coverLetterApproval.deleteMany({ where: { workspaceId } });
  await prisma.coverLetterAuditRun.deleteMany({ where: { workspaceId } });
  await prisma.coverLetterRevisionVersion.deleteMany({ where: { workspaceId } });
  await prisma.coverLetterCompositionVersion.deleteMany({ where: { workspaceId } });
  await prisma.resumeRenderingApproval.deleteMany({ where: { workspaceId } });
  await prisma.resumeAuditRun.deleteMany({ where: { workspaceId } });
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
      name: `Cover Letter Approval Workspace ${randomUUID()}`,
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
    sourceUrl: "https://company.example/jobs/999",
    sourceTitle: "Senior Platform Engineer",
    publishedAt: "2026-07-20"
  } as const;
}

async function prepareCoverLetterComposition(workspaceId: string) {
  const application = await createApplication(workspaceId, {
    companyName: "Acme",
    role: "Senior Platform Engineer",
    appliedAtLocal: "2026-07-19T10:00",
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
- Partner with product and design on customer-facing backend features

Required Qualifications
- 5+ years of TypeScript and PostgreSQL experience required
- Experience designing maintainable backend systems

Preferred Qualifications
- Experience with AI-assisted workflows

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
  const retrieval = await retrieveCareerEvidence(workspaceId, { jobDescriptionVersionId: saved.version!.id }, prisma);
  const scoring = await scoreRetrievedEvidence(workspaceId, { evidenceRetrievalRunId: retrieval.run!.id }, prisma);
  const report = await generateMatchReport(workspaceId, { evidenceScoringRunId: scoring.run!.id }, prisma);
  const composition = await createCoverLetterComposition(workspaceId, { matchReportRunId: report.run!.id }, prisma);

  return {
    application,
    jobDescriptionVersionId: saved.version!.id,
    compositionVersionId: composition.version!.id
  };
}

async function createFinalizedRevision(workspaceId: string, jobDescriptionVersionId: string) {
  const opened = await openCoverLetterStudio(workspaceId, jobDescriptionVersionId, prisma);
  const parsed = await parseStoredCoverLetterRevisionVersion(workspaceId, opened.revision!.id, prisma);
  const draftAudit = await runCoverLetterAudit(
    workspaceId,
    {
      sourceType: "FINALIZED_REVISION",
      sourceId: parsed.version.id
    },
    prisma
  );
  await markAuditEligible(draftAudit.run!.id);

  return finalizeCoverLetterRevision(
    workspaceId,
    {
      revisionId: parsed.version.id,
      updatedAt: parsed.version.updatedAt.toISOString()
    },
    prisma
  );
}

async function markAuditEligible(runId: string) {
  const run = await prisma.coverLetterAuditRun.findUniqueOrThrow({
    where: { id: runId }
  });
  const result = structuredClone(run.result as {
    status: string;
    renderingReadiness: string;
    findings: Array<{ severity: string; blocksFinalization: boolean }>;
    summary: {
      auditStatus: string;
      renderingReadiness: string;
      errorCount: number;
      warningCount: number;
      informationCount: number;
      blockingFindingCount: number;
    };
  });

  result.status = "SUCCESS";
  result.renderingReadiness = "READY_FOR_RENDERING";
  result.findings = result.findings.filter((finding) => !finding.blocksFinalization);
  result.summary = {
    ...result.summary,
    auditStatus: "SUCCESS",
    renderingReadiness: "READY_FOR_RENDERING",
    errorCount: 0,
    warningCount: 0,
    informationCount: result.findings.filter((finding) => finding.severity === "INFORMATION").length,
    blockingFindingCount: 0
  };

  await prisma.coverLetterAuditRun.update({
    where: { id: runId },
    data: {
      status: "SUCCESS",
      renderingReadiness: "READY_FOR_RENDERING",
      result: result as never,
      summary: result.summary as never
    }
  });
}

describe("cover-letter approval service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }
    await prisma.$disconnect();
  });

  it("creates idempotent base-composition approvals", async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareCoverLetterComposition(workspace.id);
    const audit = await runCoverLetterAudit(
      workspace.id,
      {
        sourceType: "BASE_COMPOSITION",
        sourceId: prepared.compositionVersionId
      },
      prisma
    );
    await markAuditEligible(audit.run!.id);
    const eligibility = await getCoverLetterApprovalEligibility(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "BASE_COMPOSITION",
      sourceId: prepared.compositionVersionId,
      coverLetterAuditRunId: audit.run!.id
    });

    const created = await approveCoverLetterRevision(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "BASE_COMPOSITION",
      sourceId: prepared.compositionVersionId,
      coverLetterAuditRunId: audit.run!.id,
      expectedContentChecksum: eligibility.contentChecksum!,
      expectedCurrentApprovalId: null,
      warningAcknowledged: eligibility.warningAcknowledgementRequired,
      warningAcknowledgement: eligibility.warningAcknowledgementRequired
        ? COVER_LETTER_APPROVAL_WARNING_ACKNOWLEDGEMENT
        : null
    });
    const duplicate = await approveCoverLetterRevision(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "BASE_COMPOSITION",
      sourceId: prepared.compositionVersionId,
      coverLetterAuditRunId: audit.run!.id,
      expectedContentChecksum: eligibility.contentChecksum!,
      expectedCurrentApprovalId: created.approval.approvalId,
      warningAcknowledged: eligibility.warningAcknowledgementRequired,
      warningAcknowledgement: eligibility.warningAcknowledgementRequired
        ? COVER_LETTER_APPROVAL_WARNING_ACKNOWLEDGEMENT
        : null
    });

    expect(created.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.approval.approvalId).toBe(created.approval.approvalId);

    const active = await getActiveCoverLetterApproval(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id
    });
    expect(active?.sourceType).toBe("BASE_COMPOSITION");
  });

  it("supersedes the base approval with a finalized revision approval and preserves revocation history", async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareCoverLetterComposition(workspace.id);
    const baseAudit = await runCoverLetterAudit(
      workspace.id,
      {
        sourceType: "BASE_COMPOSITION",
        sourceId: prepared.compositionVersionId
      },
      prisma
    );
    await markAuditEligible(baseAudit.run!.id);
    const baseEligibility = await getCoverLetterApprovalEligibility(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "BASE_COMPOSITION",
      sourceId: prepared.compositionVersionId,
      coverLetterAuditRunId: baseAudit.run!.id
    });
    const baseApproval = await approveCoverLetterRevision(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "BASE_COMPOSITION",
      sourceId: prepared.compositionVersionId,
      coverLetterAuditRunId: baseAudit.run!.id,
      expectedContentChecksum: baseEligibility.contentChecksum!,
      expectedCurrentApprovalId: null,
      warningAcknowledged: baseEligibility.warningAcknowledgementRequired,
      warningAcknowledgement: baseEligibility.warningAcknowledgementRequired
        ? COVER_LETTER_APPROVAL_WARNING_ACKNOWLEDGEMENT
        : null
    });

    const finalized = await createFinalizedRevision(workspace.id, prepared.jobDescriptionVersionId);
    const revisionAudit = await runCoverLetterAudit(
      workspace.id,
      {
        sourceType: "FINALIZED_REVISION",
        sourceId: finalized!.id
      },
      prisma
    );
    await markAuditEligible(revisionAudit.run!.id);
    const revisionEligibility = await getCoverLetterApprovalEligibility(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "FINALIZED_REVISION",
      sourceId: finalized!.id,
      coverLetterAuditRunId: revisionAudit.run!.id
    });
    const revisionApproval = await approveCoverLetterRevision(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "FINALIZED_REVISION",
      sourceId: finalized!.id,
      coverLetterAuditRunId: revisionAudit.run!.id,
      expectedContentChecksum: revisionEligibility.contentChecksum!,
      expectedCurrentApprovalId: baseApproval.approval.approvalId,
      warningAcknowledged: revisionEligibility.warningAcknowledgementRequired,
      warningAcknowledgement: revisionEligibility.warningAcknowledgementRequired
        ? COVER_LETTER_APPROVAL_WARNING_ACKNOWLEDGEMENT
        : null
    });

    const history = await listCoverLetterApprovalHistory(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id
    });
    expect(history).toHaveLength(2);
    expect(history[0]?.approvalId).toBe(revisionApproval.approval.approvalId);
    expect(history[1]?.status).toBe("SUPERSEDED");

    await revokeCoverLetterApproval(workspace.id, {
      approvalId: revisionApproval.approval.approvalId,
      expectedActiveApprovalId: revisionApproval.approval.approvalId,
      reason: "Pause cover-letter approval until next revision."
    });

    const active = await getActiveCoverLetterApproval(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id
    });
    expect(active).toBeNull();
  });
});
