import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  ApplicationStatus,
  DocumentFormat,
  JobDescriptionSourceType,
  PrismaClient
} from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import { importCareerKnowledge } from "@/lib/career/service";
import { renderApprovedResumeDocument, readDocumentVersionFile } from "@/lib/document-rendering/service";
import { extractTextFromPdfBuffer } from "@/lib/document-rendering/pdf";
import { env } from "@/lib/env";
import { scoreRetrievedEvidence } from "@/lib/evidence-scoring/service";
import { retrieveCareerEvidence } from "@/lib/evidence-retrieval/service";
import {
  approveResumeForRendering
} from "@/lib/resume-rendering-approval/service";
import { getResumeRenderingApprovalEligibility } from "@/lib/resume-rendering-approval/service";
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
  await fs.rm(path.resolve(env.LOCAL_DATA_DIR, "artifacts", "documents", workspaceId), {
    recursive: true,
    force: true
  }).catch(() => undefined);
  await prisma.activity.deleteMany({ where: { workspaceId } });
  await prisma.applicationStatusHistory.deleteMany({
    where: { application: { workspaceId } }
  });
  await prisma.aiRun.deleteMany({ where: { workspaceId } });
  await prisma.interview.deleteMany({ where: { workspaceId } });
  await prisma.documentVersion.deleteMany({
    where: { workspaceId }
  });
  await prisma.document.deleteMany({ where: { workspaceId } });
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
      name: `Document Rendering Workspace ${randomUUID()}`,
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
    sourceUrl: "https://company.example/jobs/789",
    sourceTitle: "Principal Platform Engineer",
    publishedAt: "2026-07-17"
  } as const;
}

async function prepareResumeComposition(workspaceId: string) {
  const application = await createApplication(workspaceId, {
    companyName: "Acme",
    role: "Principal Platform Engineer",
    appliedAtLocal: "2026-07-17T09:00",
    status: ApplicationStatus.APPLIED
  });
  const saved = await saveJobDescriptionForApplication(
    workspaceId,
    application.id,
    buildInput(`Acme
Principal Platform Engineer

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

async function markAuditReadiness(runId: string, readiness: "READY_FOR_RENDERING" | "READY_WITH_WARNINGS") {
  const run = await prisma.resumeAuditRun.findUniqueOrThrow({
    where: { id: runId }
  });
  const result = structuredClone(run.result as ResumeAuditResult);
  result.status = readiness === "READY_WITH_WARNINGS" ? "PASSED_WITH_WARNINGS" : "PASSED";
  result.renderingReadiness = readiness;
  result.findings = result.findings.filter((finding) => !finding.blocksRendering);
  result.statementResults = result.statementResults.map((statement) => ({
    ...statement,
    renderingEligibility: "ELIGIBLE",
    findingIds: []
  }));
  result.sectionResults = result.sectionResults.map((section) => ({
    ...section,
    renderingReadiness: readiness,
    errorFindingIds: []
  }));
  result.summary = {
    ...result.summary,
    auditStatus: result.status,
    renderingReadiness: readiness,
    errorCount: 0
  };

  await prisma.resumeAuditRun.update({
    where: { id: runId },
    data: {
      status: result.status,
      renderingReadiness: readiness,
      result: result as never,
      summary: result.summary as never
    }
  });
}

describe("document rendering service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it(
    "renders an immutable PDF from an approved base composition and reuses exact inputs",
    async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareResumeComposition(workspace.id);
    const audit = await runResumeAudit(
      workspace.id,
      { resumeCompositionVersionId: prepared.compositionVersionId },
      prisma
    );
    await markAuditReadiness(audit.run!.id, "READY_FOR_RENDERING");
    const eligibility = await getResumeRenderingApprovalEligibility(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "BASE_COMPOSITION",
      sourceId: prepared.compositionVersionId,
      resumeAuditRunId: audit.run!.id
    });

    const approval = await approveResumeForRendering(
      workspace.id,
      {
        jobDescriptionVersionId: prepared.jobDescriptionVersionId,
        applicationId: prepared.application.id,
        sourceType: "BASE_COMPOSITION",
        sourceId: prepared.compositionVersionId,
        resumeAuditRunId: audit.run!.id,
        expectedContentChecksum: eligibility.contentChecksum!,
        expectedCurrentApprovalId: null,
        warningAcknowledged: false,
        approvalNote: "Ready to render."
      },
      prisma
    );

    expect(approval.approval?.approvalId).toBeTruthy();

    const first = await renderApprovedResumeDocument(
      workspace.id,
      {
        jobDescriptionVersionId: prepared.jobDescriptionVersionId,
        applicationId: prepared.application.id,
        format: DocumentFormat.PDF
      },
      prisma
    );

    expect(first.duplicate).toBe(false);
    expect(first.documentVersion?.format).toBe("PDF");
    expect(first.documentVersion?.renderStatus).toBe("SUCCESS");
    expect(first.documentVersion?.resumeCompositionVersionId).toBe(prepared.compositionVersionId);
    expect(first.documentVersion?.resumeRevisionVersionId).toBeNull();

    const persisted = await readDocumentVersionFile(workspace.id, first.documentVersion!.id, prisma);
    expect(persisted.version.originalFilename).toMatch(/Resume_v1\.pdf$/);
    expect(persisted.buffer.byteLength).toBeGreaterThan(0);
    expect(persisted.buffer.byteLength).toBe(persisted.version.sizeBytes);
    await expect(extractTextFromPdfBuffer(persisted.buffer)).resolves.toContain(
      "Professional Summary"
    );
    const checksum = await crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(persisted.buffer)
    );
    const checksumHex = Array.from(new Uint8Array(checksum))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    expect(checksumHex).toBe(persisted.version.checksum);

    const second = await renderApprovedResumeDocument(
      workspace.id,
      {
        jobDescriptionVersionId: prepared.jobDescriptionVersionId,
        applicationId: prepared.application.id,
        format: DocumentFormat.PDF
      },
      prisma
    );

    expect(second.duplicate).toBe(true);
    expect(second.documentVersion?.id).toBe(first.documentVersion?.id);
    },
    20000
  );

  it("persists finalized revision lineage and warning-aware render status for DOCX", async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareResumeComposition(workspace.id);
    const finalized = await createFinalizedRevision(workspace.id, prepared.jobDescriptionVersionId);
    const audit = await runResumeAudit(
      workspace.id,
      { resumeRevisionVersionId: finalized!.id },
      prisma
    );
    await markAuditReadiness(audit.run!.id, "READY_WITH_WARNINGS");
    const eligibility = await getResumeRenderingApprovalEligibility(workspace.id, {
      jobDescriptionVersionId: prepared.jobDescriptionVersionId,
      applicationId: prepared.application.id,
      sourceType: "FINALIZED_REVISION",
      sourceId: finalized!.id,
      resumeAuditRunId: audit.run!.id
    });

    await approveResumeForRendering(
      workspace.id,
      {
        jobDescriptionVersionId: prepared.jobDescriptionVersionId,
        applicationId: prepared.application.id,
        sourceType: "FINALIZED_REVISION",
        sourceId: finalized!.id,
        resumeAuditRunId: audit.run!.id,
        expectedContentChecksum: eligibility.contentChecksum!,
        expectedCurrentApprovalId: null,
        warningAcknowledged: eligibility.warningAcknowledgementRequired,
        approvalNote: "Warnings accepted.",
        warningAcknowledgement: RENDERING_WARNING_ACKNOWLEDGEMENT
      },
      prisma
    );

    const rendered = await renderApprovedResumeDocument(
      workspace.id,
      {
        jobDescriptionVersionId: prepared.jobDescriptionVersionId,
        applicationId: prepared.application.id,
        format: DocumentFormat.DOCX
      },
      prisma
    );

    expect(rendered.documentVersion?.format).toBe("DOCX");
    expect(rendered.documentVersion?.resumeRevisionVersionId).toBe(finalized!.id);
    expect(rendered.documentVersion?.renderStatus).toBe("SUCCESS_WITH_WARNINGS");
    expect(rendered.documentVersion?.warningCount).toBeGreaterThanOrEqual(0);
  });
});
