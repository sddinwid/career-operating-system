import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, JobDescriptionSourceType, PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import { parseStoredJobDescriptionVersion } from "@/lib/job-descriptions/parse-service";
import {
  addUserRequirementToAnalysis,
  confirmRequirementAnalysis,
  createRevisedRequirementAnalysis,
  ensureRequirementAnalysisDraft,
  excludeRequirementAnalysisItem,
  getJobRequirementAnalysisById,
  updateRequirementAnalysisRequirement
} from "@/lib/job-descriptions/requirement-analysis-service";
import { saveJobDescriptionForApplication } from "@/lib/job-descriptions/service";

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
      name: `Requirement Analysis Workspace ${randomUUID()}`,
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
    sourceUrl: "https://company.example/jobs/456",
    sourceTitle: "Senior Platform Engineer",
    publishedAt: "2026-07-15"
  } as const;
}

async function createParsedVersion(workspaceId: string) {
  const application = await createApplication(workspaceId, {
    companyName: "Acme",
    role: "Senior Platform Engineer",
    appliedAtLocal: "2026-07-15T10:00",
    status: ApplicationStatus.APPLIED
  });
  const saved = await saveJobDescriptionForApplication(
    workspaceId,
    application.id,
    buildInput(`Acme
Senior Platform Engineer

Responsibilities
- Build resilient TypeScript APIs
- Apply now to join our equal opportunity workplace

Required Qualifications
- 5+ years of TypeScript and AWS experience required

Preferred Qualifications
- AWS certification preferred

Skills
- PostgreSQL in production systems`)
  );
  const parsed = await parseStoredJobDescriptionVersion(workspaceId, saved.version!.id, prisma);

  return {
    application,
    version: saved.version!,
    parse: parsed.parse
  };
}

describe("requirement analysis service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it("creates and reuses an idempotent draft for the exact parser result", async () => {
    const workspace = await createWorkspace();
    const { version, parse } = await createParsedVersion(workspace.id);

    const first = await ensureRequirementAnalysisDraft(workspace.id, version.id, prisma);
    const second = await ensureRequirementAnalysisDraft(workspace.id, version.id, prisma);
    const count = await prisma.jobRequirementAnalysis.count({
      where: {
        workspaceId: workspace.id,
        jobDescriptionParseId: parse.id
      }
    });

    expect(first.created).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(first.analysis?.id).toBe(second.analysis?.id);
    expect(count).toBe(1);
    expect(first.analysis?.jobDescriptionParseId).toBe(parse.id);
  });

  it("persists overrides, exclusions, and user-added requirements without changing application workflow state", async () => {
    const workspace = await createWorkspace();
    const { application, version } = await createParsedVersion(workspace.id);
    const beforeApplication = await prisma.application.findUniqueOrThrow({
      where: { id: application.id }
    });
    const beforeHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: application.id }
    });
    const beforeCareerVersionCount = await prisma.careerProfileVersion.count({
      where: { workspaceId: workspace.id }
    });

    const draft = await ensureRequirementAnalysisDraft(workspace.id, version.id, prisma);
    const analysisId = draft.analysis!.id;
    const stored = await getJobRequirementAnalysisById(workspace.id, analysisId, prisma);
    const storedContract = stored?.analysis as {
      requirements: Array<{ id: string; originalText: string }>;
      responsibilities: Array<{ id: string; originalText: string }>;
    };
    const contextualRequirementId = storedContract.requirements.find(
      (item) => item.originalText.includes("PostgreSQL")
    )?.id;
    const noiseResponsibilityId = storedContract.responsibilities.find(
      (item) => item.originalText.includes("equal opportunity workplace")
    )?.id;

    expect(contextualRequirementId).toBeTruthy();
    expect(noiseResponsibilityId).toBeTruthy();

    await updateRequirementAnalysisRequirement(workspace.id, analysisId, {
      requirementId: contextualRequirementId!,
      category: "REQUIRED",
      kinds: ["TECHNOLOGY", "DATA"],
      note: "This is a real minimum requirement.",
      correctedDisplayText: "Production PostgreSQL experience",
      confirmed: true
    });
    await excludeRequirementAnalysisItem(workspace.id, analysisId, {
      itemType: "responsibility",
      itemId: noiseResponsibilityId!,
      excluded: true
    });
    await addUserRequirementToAnalysis(workspace.id, analysisId, {
      text: "Experience mentoring engineers",
      category: "PREFERRED",
      kinds: ["LEADERSHIP", "COLLABORATION"],
      reviewNote: "Added during review"
    });

    const after = await getJobRequirementAnalysisById(workspace.id, analysisId, prisma);
    const afterContract = after?.analysis as {
      requirements: Array<{
        correctedDisplayText: string | null;
        reviewNote: string | null;
        category: string;
        userAdded: boolean;
      }>;
      responsibilities: Array<{ excluded: boolean; originalText: string }>;
      summary: { userAddedRequirementsCount: number };
    };
    const afterApplication = await prisma.application.findUniqueOrThrow({
      where: { id: application.id }
    });
    const afterHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: application.id }
    });
    const afterCareerVersionCount = await prisma.careerProfileVersion.count({
      where: { workspaceId: workspace.id }
    });

    expect(
      afterContract.requirements.some(
        (item) =>
          item.correctedDisplayText === "Production PostgreSQL experience" &&
          item.reviewNote === "This is a real minimum requirement." &&
          item.category === "REQUIRED"
      )
    ).toBe(true);
    expect(
      afterContract.requirements.some(
        (item) => item.userAdded && item.reviewNote === "Added during review"
      )
    ).toBe(true);
    expect(
      afterContract.responsibilities.find(
        (item) => item.originalText.includes("equal opportunity workplace")
      )?.excluded
    ).toBe(true);
    expect(afterContract.summary.userAddedRequirementsCount).toBe(1);
    expect(afterApplication.status).toBe(beforeApplication.status);
    expect(afterApplication.appliedAt?.toISOString()).toBe(beforeApplication.appliedAt?.toISOString());
    expect(afterApplication.recordedAt.toISOString()).toBe(beforeApplication.recordedAt.toISOString());
    expect(afterHistoryCount).toBe(beforeHistoryCount);
    expect(afterCareerVersionCount).toBe(beforeCareerVersionCount);
  });

  it("confirms an immutable analysis and creates a successor draft for revision", async () => {
    const workspace = await createWorkspace();
    const { version } = await createParsedVersion(workspace.id);
    const draft = await ensureRequirementAnalysisDraft(workspace.id, version.id, prisma);

    const confirmed = await confirmRequirementAnalysis(
      workspace.id,
      draft.analysis!.id,
      true
    );
    const revised = await createRevisedRequirementAnalysis(
      workspace.id,
      draft.analysis!.id
    );
    const confirmedRecord = await prisma.jobRequirementAnalysis.findUniqueOrThrow({
      where: { id: draft.analysis!.id }
    });
    const revisedRecord = await prisma.jobRequirementAnalysis.findUniqueOrThrow({
      where: { id: revised?.id }
    });

    await expect(
      updateRequirementAnalysisRequirement(workspace.id, draft.analysis!.id, {
        requirementId:
          (
            confirmed?.analysis as {
              requirements: Array<{ id: string }>;
            }
          ).requirements[0].id,
        category: "PREFERRED",
        kinds: ["TECHNOLOGY"]
      })
    ).rejects.toThrow(/cannot be edited in place/i);

    expect(confirmed?.status).toBe("CONFIRMED");
    expect(confirmedRecord.confirmedAt).not.toBeNull();
    expect(revised?.predecessor?.id).toBe(draft.analysis!.id);
    expect(revisedRecord.predecessorId).toBe(draft.analysis!.id);
    expect(revisedRecord.status).toBe("NEEDS_REVIEW");
  });
});
