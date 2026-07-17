import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, JobDescriptionSourceType, PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import {
  createJobDescriptionForNewOpportunity,
  getJobDescriptionVersionById,
  saveJobDescriptionForApplication
} from "@/lib/job-descriptions/service";

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
      name: `Job Description Workspace ${randomUUID()}`,
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
    sourceUrl: "https://company.example/jobs/123",
    sourceTitle: "Senior Platform Engineer",
    publishedAt: "2026-07-15"
  } as const;
}

describe("job description service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it("creates a first immutable version for an existing application without changing status history, timestamps, or career-profile versions", async () => {
    const workspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Platform Engineer",
      appliedAtLocal: "2026-07-10T10:30",
      status: ApplicationStatus.APPLIED,
      jobUrl: "https://company.example/jobs/123"
    });

    const beforeApplication = await prisma.application.findUniqueOrThrow({
      where: { id: application.id }
    });
    const beforeStatusHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: application.id }
    });
    const beforeCareerVersionCount = await prisma.careerProfileVersion.count({
      where: { workspaceId: workspace.id }
    });

    const result = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput("Line one\r\n\r\nResponsibilities   \r\nSalary: $150,000")
    );

    expect(result.duplicate).toBe(false);
    expect(result.version?.versionNumber).toBe(1);
    expect(result.version?.active).toBe(true);
    expect(result.version?.predecessor).toBeNull();
    expect(result.version?.sourceApplication?.id).toBe(application.id);
    expect(result.version?.publishedAt?.toISOString().slice(0, 10)).toBe("2026-07-15");
    expect(result.version?.originalText).toContain("Responsibilities   ");
    expect(result.version?.normalizedText).toBe(
      "Line one\n\nResponsibilities\nSalary: $150,000"
    );

    const afterApplication = await prisma.application.findUniqueOrThrow({
      where: { id: application.id }
    });
    const afterStatusHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: application.id }
    });
    const afterCareerVersionCount = await prisma.careerProfileVersion.count({
      where: { workspaceId: workspace.id }
    });
    const opportunityCount = await prisma.jobOpportunity.count({
      where: { workspaceId: workspace.id }
    });
    const companyCount = await prisma.company.count({
      where: { workspaceId: workspace.id }
    });

    expect(afterApplication.currentJobDescriptionVersionId).toBe(result.version?.id);
    expect(afterApplication.status).toBe(beforeApplication.status);
    expect(afterApplication.appliedAt?.toISOString()).toBe(
      beforeApplication.appliedAt?.toISOString()
    );
    expect(afterApplication.recordedAt.toISOString()).toBe(
      beforeApplication.recordedAt.toISOString()
    );
    expect(afterStatusHistoryCount).toBe(beforeStatusHistoryCount);
    expect(afterCareerVersionCount).toBe(beforeCareerVersionCount);
    expect(opportunityCount).toBe(1);
    expect(companyCount).toBe(1);
  });

  it("reuses an exact duplicate for the same opportunity and keeps versions immutable", async () => {
    const workspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Backend Engineer",
      appliedAtLocal: "2026-07-10T10:30",
      status: ApplicationStatus.APPLIED,
      jobUrl: "https://company.example/jobs/123"
    });

    const first = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput("Role\n\nRequirements")
    );
    const second = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput("Role\r\n\r\nRequirements")
    );

    const versions = await prisma.jobDescriptionVersion.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { versionNumber: "asc" }
    });

    expect(first.version?.id).toBe(second.version?.id);
    expect(second.duplicate).toBe(true);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.versionNumber).toBe(1);
    expect(versions[0]?.active).toBe(true);
  });

  it("creates a second version for changed content, preserves the predecessor, and marks active and superseded states correctly", async () => {
    const workspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Platform Engineer",
      appliedAtLocal: "2026-07-10T10:30",
      status: ApplicationStatus.APPLIED,
      jobUrl: "https://company.example/jobs/123"
    });

    const first = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput("Original body")
    );
    const second = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput("Original body\n\nUpdated with another requirement")
    );

    const versions = await prisma.jobDescriptionVersion.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { versionNumber: "asc" }
    });

    expect(second.duplicate).toBe(false);
    expect(versions).toHaveLength(2);
    expect(versions[0]?.active).toBe(false);
    expect(versions[0]?.supersededAt).not.toBeNull();
    expect(versions[1]?.active).toBe(true);
    expect(versions[1]?.predecessorId).toBe(first.version?.id);
    expect(second.version?.predecessor?.id).toBe(first.version?.id);

    const currentApplication = await prisma.application.findUniqueOrThrow({
      where: { id: application.id }
    });
    expect(currentApplication.currentJobDescriptionVersionId).toBe(second.version?.id);
  });

  it("creates a standalone opportunity intake, reuses company names, preserves canonical URL opportunity identity, and does not force an application", async () => {
    const workspace = await createWorkspace();

    const first = await createJobDescriptionForNewOpportunity(workspace.id, {
      companyName: "Acme Labs",
      role: "Senior Engineer",
      jobUrl: "https://jobs.example.com/roles/123?utm_source=newsletter",
      opportunitySource: "LinkedIn",
      descriptionText: "First version",
      sourceType: JobDescriptionSourceType.JOB_BOARD,
      sourceUrl: "https://jobs.example.com/roles/123",
      sourceTitle: "Senior Engineer",
      publishedAt: "2026-07-14"
    });

    const second = await createJobDescriptionForNewOpportunity(workspace.id, {
      companyName: "  ACME LABS  ",
      role: "Senior Engineer",
      jobUrl: "https://jobs.example.com/roles/123",
      opportunitySource: "LinkedIn",
      descriptionText: "Second version with updates",
      sourceType: JobDescriptionSourceType.JOB_BOARD,
      sourceUrl: "https://jobs.example.com/roles/123",
      sourceTitle: "Senior Engineer",
      publishedAt: "2026-07-15"
    });

    const companies = await prisma.company.findMany({
      where: { workspaceId: workspace.id }
    });
    const opportunities = await prisma.jobOpportunity.findMany({
      where: { workspaceId: workspace.id }
    });
    const applications = await prisma.application.count({
      where: { workspaceId: workspace.id }
    });

    expect(companies).toHaveLength(1);
    expect(opportunities).toHaveLength(1);
    expect(first.opportunityId).toBe(second.opportunityId);
    expect(second.version?.versionNumber).toBe(2);
    expect(applications).toBe(0);
  });

  it("retrieves a saved version by id and preserves raw text through the database round trip", async () => {
    const workspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Platform Engineer",
      appliedAtLocal: "2026-07-10T10:30",
      status: ApplicationStatus.APPLIED
    });

    const created = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput("Keep exact recruiter note.\n\nDo not paraphrase.")
    );

    const fetched = await getJobDescriptionVersionById(workspace.id, created.version!.id);

    expect(fetched?.id).toBe(created.version?.id);
    expect(fetched?.originalText).toBe("Keep exact recruiter note.\n\nDo not paraphrase.");
  });

  it("rolls back the transaction when version creation fails after superseding the current version", async () => {
    const workspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Platform Engineer",
      appliedAtLocal: "2026-07-10T10:30",
      status: ApplicationStatus.APPLIED
    });

    const original = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput("Original body")
    );

    await expect(
      saveJobDescriptionForApplication(
        workspace.id,
        application.id,
        buildInput("Changed body"),
        prisma,
        { simulateFailureAfterSupersede: true }
      )
    ).rejects.toThrow(/simulated failure/i);

    const versions = await prisma.jobDescriptionVersion.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { versionNumber: "asc" }
    });
    const applicationAfterFailure = await prisma.application.findUniqueOrThrow({
      where: { id: application.id }
    });

    expect(versions).toHaveLength(1);
    expect(versions[0]?.id).toBe(original.version?.id);
    expect(versions[0]?.active).toBe(true);
    expect(applicationAfterFailure.currentJobDescriptionVersionId).toBe(original.version?.id);
  });
});
