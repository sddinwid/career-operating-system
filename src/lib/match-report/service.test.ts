import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, JobDescriptionSourceType, PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import { importCareerKnowledge } from "@/lib/career/service";
import {
  parseStoredEvidenceScoringRun,
  scoreRetrievedEvidence
} from "@/lib/evidence-scoring/service";
import { retrieveCareerEvidence } from "@/lib/evidence-retrieval/service";
import {
  confirmRequirementAnalysis,
  createRevisedRequirementAnalysis,
  ensureRequirementAnalysisDraft
} from "@/lib/job-descriptions/requirement-analysis-service";
import { parseStoredJobDescriptionVersion } from "@/lib/job-descriptions/parse-service";
import { saveJobDescriptionForApplication } from "@/lib/job-descriptions/service";
import { generateMatchReport, parseStoredMatchReportRun } from "@/lib/match-report/service";

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
  await prisma.matchReportRun.deleteMany({ where: { workspaceId } });
  await prisma.evidenceScoringRun.deleteMany({ where: { workspaceId } });
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
      name: `Match Report Workspace ${randomUUID()}`,
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
    sourceUrl: "https://company.example/jobs/999",
    sourceTitle: "Senior Platform Engineer",
    publishedAt: "2026-07-16"
  } as const;
}

async function prepareScoringRun(workspaceId: string) {
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
- Active clearance required

Preferred Qualifications
- Fixture Cloud certification preferred

Skills
- PostgreSQL in production systems`)
  );
  await parseStoredJobDescriptionVersion(workspaceId, saved.version!.id, prisma);
  const draft = await ensureRequirementAnalysisDraft(workspaceId, saved.version!.id, prisma);
  const confirmed = await confirmRequirementAnalysis(workspaceId, draft.analysis!.id, true);
  const imported = await importCareerKnowledge({
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

  return {
    application,
    jobDescriptionVersionId: saved.version!.id,
    requirementAnalysisId: confirmed!.id,
    careerProfileVersionId: imported.versionId,
    retrievalRunId: retrieval.run!.id,
    scoringRunId: scoring.run!.id
  };
}

describe("match report service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it("creates an immutable report run and reuses it for identical inputs", async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareScoringRun(workspace.id);
    const beforeApplication = await prisma.application.findUniqueOrThrow({
      where: { id: prepared.application.id }
    });
    const beforeHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: prepared.application.id }
    });

    const first = await generateMatchReport(
      workspace.id,
      { evidenceScoringRunId: prepared.scoringRunId },
      prisma
    );
    const second = await generateMatchReport(
      workspace.id,
      { evidenceScoringRunId: prepared.scoringRunId },
      prisma
    );
    const stored = await parseStoredMatchReportRun(workspace.id, first.run!.id, prisma);
    const scoringAfter = await parseStoredEvidenceScoringRun(workspace.id, prepared.scoringRunId, prisma);
    const afterApplication = await prisma.application.findUniqueOrThrow({
      where: { id: prepared.application.id }
    });
    const afterHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: prepared.application.id }
    });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.run?.id).toBe(first.run?.id);
    expect(stored.run.evidenceScoringRunId).toBe(prepared.scoringRunId);
    expect(stored.result.evidenceScoringRunId).toBe(prepared.scoringRunId);
    expect(stored.result.evidenceRetrievalRunId).toBe(prepared.retrievalRunId);
    expect(stored.result.requirementAnalysisId).toBe(prepared.requirementAnalysisId);
    expect(stored.result.careerProfileVersionId).toBe(prepared.careerProfileVersionId);
    expect(stored.result.jobDescriptionVersionId).toBe(prepared.jobDescriptionVersionId);
    expect(stored.result.summary.requiredRequirementCount).toBeGreaterThan(0);
    expect(scoringAfter.run.id).toBe(prepared.scoringRunId);
    expect(afterApplication.status).toBe(beforeApplication.status);
    expect(afterApplication.appliedAt?.toISOString()).toBe(beforeApplication.appliedAt?.toISOString());
    expect(afterApplication.recordedAt.toISOString()).toBe(beforeApplication.recordedAt.toISOString());
    expect(afterHistoryCount).toBe(beforeHistoryCount);
    expect(await prisma.aiRun.count({ where: { workspaceId: workspace.id } })).toBe(0);
  });

  it("creates a new report when the scoring input changes", async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareScoringRun(workspace.id);

    const first = await generateMatchReport(
      workspace.id,
      { evidenceScoringRunId: prepared.scoringRunId },
      prisma
    );

    const revisedDraft = await createRevisedRequirementAnalysis(
      workspace.id,
      prepared.requirementAnalysisId
    );
    await confirmRequirementAnalysis(workspace.id, revisedDraft!.id, true);
    const secondRetrieval = await retrieveCareerEvidence(
      workspace.id,
      { jobDescriptionVersionId: prepared.jobDescriptionVersionId },
      prisma
    );
    const secondScore = await scoreRetrievedEvidence(
      workspace.id,
      { evidenceRetrievalRunId: secondRetrieval.run!.id },
      prisma
    );
    const secondReport = await generateMatchReport(
      workspace.id,
      { evidenceScoringRunId: secondScore.run!.id },
      prisma
    );

    expect(secondReport.duplicate).toBe(false);
    expect(secondReport.run?.id).not.toBe(first.run?.id);
    expect(secondReport.run?.evidenceScoringRunId).toBe(secondScore.run?.id);
  });

  it("rolls back the report row when persistence fails after creation", async () => {
    const workspace = await createWorkspace();
    const prepared = await prepareScoringRun(workspace.id);

    await expect(
      generateMatchReport(
        workspace.id,
        {
          evidenceScoringRunId: prepared.scoringRunId,
          simulateFailureAfterCreate: true
        },
        prisma
      )
    ).rejects.toThrow(/simulated match report persistence failure/i);

    const count = await prisma.matchReportRun.count({
      where: { workspaceId: workspace.id }
    });

    expect(count).toBe(0);
  });
});
