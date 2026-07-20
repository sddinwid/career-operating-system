import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, JobDescriptionSourceType, PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import { importCareerKnowledge } from "@/lib/career/service";
import {
  createCoverLetterComposition,
  parseStoredCoverLetterCompositionVersion
} from "@/lib/cover-letter-composition/service";
import { scoreRetrievedEvidence } from "@/lib/evidence-scoring/service";
import { retrieveCareerEvidence } from "@/lib/evidence-retrieval/service";
import {
  confirmRequirementAnalysis,
  createRevisedRequirementAnalysis,
  ensureRequirementAnalysisDraft
} from "@/lib/job-descriptions/requirement-analysis-service";
import { parseStoredJobDescriptionVersion } from "@/lib/job-descriptions/parse-service";
import { saveJobDescriptionForApplication } from "@/lib/job-descriptions/service";
import { generateMatchReport } from "@/lib/match-report/service";
import { createResumeComposition } from "@/lib/resume-composition/service";
import { createStructuredResumePlan } from "@/lib/structured-resume/service";

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
      name: `Cover Letter Composition Workspace ${randomUUID()}`,
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
    sourceTitle: "Senior Platform Engineer",
    publishedAt: "2026-07-19"
  } as const;
}

async function prepareMatchReport(workspaceId: string, options?: { createResumeSource?: boolean }) {
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

  let resumeCompositionVersionId: string | null = null;
  if (options?.createResumeSource) {
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
    resumeCompositionVersionId = composition.version!.id;
  }

  return {
    application,
    jobDescriptionVersionId: saved.version!.id,
    matchReportRunId: report.run!.id,
    resumeCompositionVersionId
  };
}

describe("cover-letter composition service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it("creates an immutable cover letter and reuses it for identical inputs", async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareMatchReport(workspace.id, { createResumeSource: true });

    const beforeApplication = await prisma.application.findUniqueOrThrow({
      where: { id: prepared.application.id }
    });
    const beforeHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: prepared.application.id }
    });

    const first = await createCoverLetterComposition(
      workspace.id,
      { matchReportRunId: prepared.matchReportRunId },
      prisma
    );
    const second = await createCoverLetterComposition(
      workspace.id,
      { matchReportRunId: prepared.matchReportRunId },
      prisma
    );
    const stored = await parseStoredCoverLetterCompositionVersion(
      workspace.id,
      first.version!.id,
      prisma
    );
    const afterApplication = await prisma.application.findUniqueOrThrow({
      where: { id: prepared.application.id }
    });
    const afterHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: prepared.application.id }
    });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.version?.id).toBe(first.version?.id);
    expect(stored.content.summary.wordCount).toBeGreaterThan(150);
    expect(stored.content.summary.paragraphCount).toBeGreaterThanOrEqual(3);
    expect(stored.content.summary.paragraphCount).toBeLessThanOrEqual(5);
    expect(stored.content.plainText.includes("—")).toBe(false);
    expect(stored.content.summary.resumeSourceUsed).toBe(true);
    expect(afterApplication.status).toBe(beforeApplication.status);
    expect(afterApplication.appliedAt?.toISOString()).toBe(
      beforeApplication.appliedAt?.toISOString()
    );
    expect(afterApplication.recordedAt.toISOString()).toBe(
      beforeApplication.recordedAt.toISOString()
    );
    expect(afterHistoryCount).toBe(beforeHistoryCount);
    expect(
      await prisma.documentVersion.count({
        where: { document: { workspaceId: workspace.id } }
      })
    ).toBe(0);
  });

  it("creates a new cover-letter version when an authoritative input changes", async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareMatchReport(workspace.id);

    const first = await createCoverLetterComposition(
      workspace.id,
      { matchReportRunId: prepared.matchReportRunId },
      prisma
    );

    const draft = await ensureRequirementAnalysisDraft(workspace.id, prepared.jobDescriptionVersionId, prisma);
    const revisedDraft = await createRevisedRequirementAnalysis(workspace.id, draft.analysis!.id);
    await confirmRequirementAnalysis(workspace.id, revisedDraft!.id, true);
    const retrieval = await retrieveCareerEvidence(
      workspace.id,
      { jobDescriptionVersionId: prepared.jobDescriptionVersionId },
      prisma
    );
    const scoring = await scoreRetrievedEvidence(
      workspace.id,
      { evidenceRetrievalRunId: retrieval.run!.id },
      prisma
    );
    const report = await generateMatchReport(
      workspace.id,
      { evidenceScoringRunId: scoring.run!.id },
      prisma
    );
    const second = await createCoverLetterComposition(
      workspace.id,
      { matchReportRunId: report.run!.id },
      prisma
    );

    expect(second.duplicate).toBe(false);
    expect(second.version?.id).not.toBe(first.version?.id);
    expect(second.version?.matchReportRunId).toBe(report.run!.id);
  });

  it("rolls back the composition row when persistence fails after create", async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareMatchReport(workspace.id);

    await expect(
      createCoverLetterComposition(
        workspace.id,
        {
          matchReportRunId: prepared.matchReportRunId,
          simulateFailureAfterCreate: true
        },
        prisma
      )
    ).rejects.toThrow(/Simulated cover-letter composition persistence failure/);

    expect(
      await prisma.coverLetterCompositionVersion.count({ where: { workspaceId: workspace.id } })
    ).toBe(0);
  });
});
