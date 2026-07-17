import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, JobDescriptionSourceType, PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import { importCareerKnowledge } from "@/lib/career/service";
import {
  confirmRequirementAnalysis,
  createRevisedRequirementAnalysis,
  ensureRequirementAnalysisDraft
} from "@/lib/job-descriptions/requirement-analysis-service";
import { parseStoredJobDescriptionVersion } from "@/lib/job-descriptions/parse-service";
import { saveJobDescriptionForApplication } from "@/lib/job-descriptions/service";
import {
  parseStoredEvidenceRetrievalRun,
  retrieveCareerEvidence
} from "@/lib/evidence-retrieval/service";

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
  await prisma.evidenceRetrievalRun.deleteMany({ where: { workspaceId } });
  await prisma.jobRequirementAnalysis.deleteMany({ where: { workspaceId } });
  await prisma.jobDescriptionParse.deleteMany({ where: { workspaceId } });
  await prisma.jobDescriptionVersion.deleteMany({ where: { workspaceId } });
  await prisma.importRow.deleteMany({
    where: { importJob: { workspaceId } }
  });
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
      name: `Evidence Retrieval Workspace ${randomUUID()}`,
      userSettings: {
        create: [
          {
            key: "defaultTimeZone",
            value: "America/Chicago"
          },
          {
            key: "jobSearchDayCutoff",
            value: "03:00"
          }
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
    publishedAt: "2026-07-16"
  } as const;
}

async function prepareConfirmedAnalysis(workspaceId: string) {
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
  const parsed = await parseStoredJobDescriptionVersion(workspaceId, saved.version!.id, prisma);
  const draft = await ensureRequirementAnalysisDraft(workspaceId, saved.version!.id, prisma);
  const confirmed = await confirmRequirementAnalysis(workspaceId, draft.analysis!.id, true);

  return {
    application,
    version: saved.version!,
    parse: parsed.parse,
    analysis: confirmed!
  };
}

async function importCareerFixture(workspaceId: string) {
  return importCareerKnowledge({
    filePath: "fixtures/career_knowledge_base_fixture_v1.json",
    prismaClient: prisma,
    workspaceId
  });
}

describe("evidence retrieval service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it("creates an immutable retrieval run, preserves workflow state, and reuses the same successful run for identical inputs", async () => {
    const workspace = await createWorkspace();
    const { application, version, analysis } = await prepareConfirmedAnalysis(workspace.id);
    const importReport = await importCareerFixture(workspace.id);
    const beforeApplication = await prisma.application.findUniqueOrThrow({
      where: { id: application.id }
    });
    const beforeHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: application.id }
    });

    expect(importReport.versionId).toBeTruthy();

    const first = await retrieveCareerEvidence(
      workspace.id,
      { jobDescriptionVersionId: version.id },
      prisma
    );
    const second = await retrieveCareerEvidence(
      workspace.id,
      { jobDescriptionVersionId: version.id },
      prisma
    );
    const stored = await parseStoredEvidenceRetrievalRun(workspace.id, first.run!.id, prisma);
    const afterApplication = await prisma.application.findUniqueOrThrow({
      where: { id: application.id }
    });
    const afterHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: application.id }
    });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.run?.id).toBe(first.run?.id);
    expect(first.run?.careerProfileVersionId).toBe(importReport.versionId);
    expect(first.run?.requirementAnalysisId).toBe(analysis.id);
    expect(first.run?.jobDescriptionVersionId).toBe(version.id);
    expect(stored.result.summary.totalRequirements).toBeGreaterThan(0);
    expect(stored.result.requirementAnalysisId).toBe(analysis.id);
    expect(afterApplication.status).toBe(beforeApplication.status);
    expect(afterApplication.appliedAt?.toISOString()).toBe(beforeApplication.appliedAt?.toISOString());
    expect(afterApplication.recordedAt.toISOString()).toBe(beforeApplication.recordedAt.toISOString());
    expect(afterHistoryCount).toBe(beforeHistoryCount);
  });

  it("creates a new run when a newer confirmed requirement analysis becomes the current input", async () => {
    const workspace = await createWorkspace();
    const { version, analysis } = await prepareConfirmedAnalysis(workspace.id);
    await importCareerFixture(workspace.id);

    const first = await retrieveCareerEvidence(
      workspace.id,
      { jobDescriptionVersionId: version.id },
      prisma
    );
    const revisedDraft = await createRevisedRequirementAnalysis(workspace.id, analysis.id);

    expect(revisedDraft?.id).toBeTruthy();

    await confirmRequirementAnalysis(workspace.id, revisedDraft!.id, true);

    const second = await retrieveCareerEvidence(
      workspace.id,
      { jobDescriptionVersionId: version.id },
      prisma
    );

    expect(second.duplicate).toBe(false);
    expect(second.run?.id).not.toBe(first.run?.id);
    expect(second.run?.requirementAnalysisId).toBe(revisedDraft?.id);
  });

  it("rolls back the retrieval row when persistence fails after creation", async () => {
    const workspace = await createWorkspace();
    const { version } = await prepareConfirmedAnalysis(workspace.id);
    await importCareerFixture(workspace.id);

    await expect(
      retrieveCareerEvidence(
        workspace.id,
        {
          jobDescriptionVersionId: version.id,
          simulateFailureAfterCreate: true
        },
        prisma
      )
    ).rejects.toThrow(/simulated evidence retrieval persistence failure/i);

    const count = await prisma.evidenceRetrievalRun.count({
      where: { workspaceId: workspace.id }
    });

    expect(count).toBe(0);
  });
});
