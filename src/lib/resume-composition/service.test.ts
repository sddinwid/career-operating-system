import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, JobDescriptionSourceType, PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import { importCareerKnowledge } from "@/lib/career/service";
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
import { createResumeComposition, parseStoredResumeCompositionVersion } from "@/lib/resume-composition/service";
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
      name: `Resume Composition Workspace ${randomUUID()}`,
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

async function prepareStructuredResume(workspaceId: string) {
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
  const confirmed = await confirmRequirementAnalysis(workspaceId, draft.analysis!.id, true);
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

  return {
    application,
    jobDescriptionVersionId: saved.version!.id,
    requirementAnalysisId: confirmed!.id,
    structuredResumeVersionId: structuredResume.version!.id
  };
}

describe("resume composition service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it("creates an immutable composed resume and reuses it for identical inputs", async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareStructuredResume(workspace.id);

    const beforeApplication = await prisma.application.findUniqueOrThrow({
      where: { id: prepared.application.id }
    });
    const beforeHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: prepared.application.id }
    });

    const first = await createResumeComposition(
      workspace.id,
      { structuredResumeVersionId: prepared.structuredResumeVersionId },
      prisma
    );
    const second = await createResumeComposition(
      workspace.id,
      { structuredResumeVersionId: prepared.structuredResumeVersionId },
      prisma
    );
    const stored = await parseStoredResumeCompositionVersion(
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
    expect(stored.content.structuredResumeVersionId).toBe(prepared.structuredResumeVersionId);
    expect(stored.content.summary.bulletCount).toBeGreaterThan(0);
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
    expect(await prisma.aiRun.count({ where: { workspaceId: workspace.id } })).toBe(0);
  });

  it("creates a new composition when the structured plan input changes", async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareStructuredResume(workspace.id);

    const first = await createResumeComposition(
      workspace.id,
      { structuredResumeVersionId: prepared.structuredResumeVersionId },
      prisma
    );

    const revisedDraft = await createRevisedRequirementAnalysis(
      workspace.id,
      prepared.requirementAnalysisId
    );
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
    const structuredResume = await createStructuredResumePlan(
      workspace.id,
      { matchReportRunId: report.run!.id },
      prisma
    );
    const second = await createResumeComposition(
      workspace.id,
      { structuredResumeVersionId: structuredResume.version!.id },
      prisma
    );

    expect(second.duplicate).toBe(false);
    expect(second.version?.id).not.toBe(first.version?.id);
    expect(second.version?.structuredResumeVersionId).toBe(structuredResume.version?.id);
  });

  it("rolls back the composition row when persistence fails after creation", async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareStructuredResume(workspace.id);

    await expect(
      createResumeComposition(
        workspace.id,
        {
          structuredResumeVersionId: prepared.structuredResumeVersionId,
          simulateFailureAfterCreate: true
        },
        prisma
      )
    ).rejects.toThrow(/simulated resume composition persistence failure/i);

    const count = await prisma.resumeCompositionVersion.count({
      where: { workspaceId: workspace.id }
    });

    expect(count).toBe(0);
  });
});
