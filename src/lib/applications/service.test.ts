import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, PrismaClient } from "@prisma/client";
import {
  archiveApplication,
  createApplication,
  listApplications,
  restoreApplication,
  updateApplication
} from "@/lib/applications/service";
import { deriveJobSearchDateFromInstant } from "@/lib/applications/timestamps";
import { getWorkspaceSettings } from "@/lib/settings";

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
  await prisma.importRow.deleteMany({
    where: { importJob: { workspaceId } }
  });
  await prisma.importJob.deleteMany({ where: { workspaceId } });
  await prisma.auditEvent.deleteMany({ where: { workspaceId } });
  await prisma.careerProfileVersion.deleteMany({ where: { workspaceId } });
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
      name: `Applications Service Workspace ${randomUUID()}`,
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

describe("application service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it("derives previous job-search date for 12:45 AM and current date for 03:00 AM", async () => {
    const workspace = await createWorkspace();

    const early = await createApplication(workspace.id, {
      companyName: "Cutoff Co",
      role: "Analyst",
      appliedAtLocal: "2025-07-16T00:45",
      status: ApplicationStatus.APPLIED
    });

    const onCutoff = await createApplication(workspace.id, {
      companyName: "Cutoff Co",
      role: "Analyst 2",
      appliedAtLocal: "2025-07-16T03:00",
      status: ApplicationStatus.APPLIED
    });

    const records = await prisma.application.findMany({
      where: { id: { in: [early.id, onCutoff.id] } },
      orderBy: { id: "asc" }
    });

    const earlyRecord = records.find((record) => record.id === early.id);
    const onCutoffRecord = records.find((record) => record.id === onCutoff.id);

    expect(earlyRecord?.jobSearchDate?.toISOString().slice(0, 10)).toBe("2025-07-15");
    expect(onCutoffRecord?.jobSearchDate?.toISOString().slice(0, 10)).toBe("2025-07-16");
  });

  it("stores recordedAt as entry time, preserves originalAppliedAt, preserves manual override, and rejects future timestamps", async () => {
    const workspace = await createWorkspace();

    const beforeCreate = new Date();
    const created = await createApplication(workspace.id, {
      companyName: "Timestamp Co",
      role: "Engineer",
      appliedAtLocal: "2025-07-16T01:15",
      manualJobSearchDate: "2025-07-10",
      status: ApplicationStatus.APPLIED
    });
    const afterCreate = new Date();

    const createdRecord = await prisma.application.findUniqueOrThrow({
      where: { id: created.id }
    });

    expect(createdRecord.recordedAt.getTime()).toBeGreaterThanOrEqual(
      beforeCreate.getTime()
    );
    expect(createdRecord.recordedAt.getTime()).toBeLessThanOrEqual(
      afterCreate.getTime()
    );
    expect(createdRecord.originalAppliedAt?.toISOString()).toBe(
      createdRecord.appliedAt?.toISOString()
    );
    expect(createdRecord.jobSearchDate?.toISOString().slice(0, 10)).toBe("2025-07-10");

    await updateApplication(workspace.id, created.id, {
      companyName: "Timestamp Co",
      role: "Engineer",
      appliedAtLocal: "2025-07-18T04:30",
      manualJobSearchDate: "2025-07-10",
      status: ApplicationStatus.APPLIED,
      notes: "Edited later"
    });

    const updatedRecord = await prisma.application.findUniqueOrThrow({
      where: { id: created.id }
    });

    expect(updatedRecord.originalAppliedAt?.toISOString()).toBe(
      createdRecord.originalAppliedAt?.toISOString()
    );
    expect(updatedRecord.recordedAt.toISOString()).toBe(
      createdRecord.recordedAt.toISOString()
    );
    expect(updatedRecord.jobSearchDate?.toISOString().slice(0, 10)).toBe("2025-07-10");

    await expect(
      createApplication(workspace.id, {
        companyName: "Future Co",
        role: "Engineer",
        appliedAtLocal: "2099-07-16T10:00",
        status: ApplicationStatus.APPLIED
      })
    ).rejects.toThrow(/cannot be in the future/i);
  });

  it("creates separate opportunities without URL, creates separate opportunities for different URLs, reuses exact canonical URL, and allows multiple applications per exact opportunity", async () => {
    const workspace = await createWorkspace();

    const noUrlFirst = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Product Designer",
      appliedAtLocal: "2025-07-16T09:00",
      status: ApplicationStatus.APPLIED
    });
    const noUrlSecond = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Product Designer",
      appliedAtLocal: "2025-08-16T09:00",
      status: ApplicationStatus.APPLIED
    });

    const differentUrlFirst = await createApplication(workspace.id, {
      companyName: "Beta",
      role: "Remote Engineer",
      appliedAtLocal: "2025-07-16T09:00",
      jobUrl: "https://example.com/jobs/alpha",
      status: ApplicationStatus.APPLIED
    });
    const differentUrlSecond = await createApplication(workspace.id, {
      companyName: "Beta",
      role: "Remote Engineer",
      appliedAtLocal: "2025-07-17T09:00",
      jobUrl: "https://example.com/jobs/beta",
      status: ApplicationStatus.APPLIED
    });

    const exactUrlFirst = await createApplication(workspace.id, {
      companyName: "Gamma",
      role: "Analyst",
      appliedAtLocal: "2025-07-16T09:00",
      jobUrl: "https://jobs.example.com/roles/123?utm_source=newsletter",
      status: ApplicationStatus.APPLIED
    });
    const exactUrlSecond = await createApplication(workspace.id, {
      companyName: "Gamma",
      role: "Analyst",
      appliedAtLocal: "2025-07-20T09:00",
      jobUrl: "https://jobs.example.com/roles/123",
      status: ApplicationStatus.APPLIED
    });

    const applications = await prisma.application.findMany({
      where: {
        id: {
          in: [
            noUrlFirst.id,
            noUrlSecond.id,
            differentUrlFirst.id,
            differentUrlSecond.id,
            exactUrlFirst.id,
            exactUrlSecond.id
          ]
        }
      },
      select: {
        id: true,
        opportunityId: true
      }
    });

    const noUrlOpportunityIds = applications
      .filter((application) => [noUrlFirst.id, noUrlSecond.id].includes(application.id))
      .map((application) => application.opportunityId);
    expect(new Set(noUrlOpportunityIds).size).toBe(2);

    const differentUrlOpportunityIds = applications
      .filter((application) =>
        [differentUrlFirst.id, differentUrlSecond.id].includes(application.id)
      )
      .map((application) => application.opportunityId);
    expect(new Set(differentUrlOpportunityIds).size).toBe(2);

    const exactUrlOpportunityIds = applications
      .filter((application) =>
        [exactUrlFirst.id, exactUrlSecond.id].includes(application.id)
      )
      .map((application) => application.opportunityId);
    expect(new Set(exactUrlOpportunityIds).size).toBe(1);
  });

  it("sorts initial and later status events correctly, ignores notes and salary edits, and preserves status through archive and restore", async () => {
    const workspace = await createWorkspace();

    const created = await createApplication(workspace.id, {
      companyName: "History Co",
      role: "Manager",
      appliedAtLocal: "2025-07-16T09:00",
      status: ApplicationStatus.APPLIED
    });

    const initialHistory = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: created.id },
      orderBy: [{ occurredAt: "asc" }, { recordedAt: "asc" }, { id: "asc" }]
    });
    expect(initialHistory).toHaveLength(1);
    expect(initialHistory[0]?.toStatus).toBe(ApplicationStatus.APPLIED);
    expect(initialHistory[0]?.recordedAt.getTime()).toBeGreaterThan(
      initialHistory[0]?.occurredAt.getTime() ?? 0
    );

    await updateApplication(workspace.id, created.id, {
      companyName: "History Co",
      role: "Manager",
      appliedAtLocal: "2025-07-16T09:00",
      status: ApplicationStatus.APPLIED,
      notes: "Changed notes only",
      salaryMin: 100000
    });

    const historyAfterNonStatusEdit = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: created.id }
    });
    expect(historyAfterNonStatusEdit).toHaveLength(1);

    await updateApplication(workspace.id, created.id, {
      companyName: "History Co",
      role: "Manager",
      appliedAtLocal: "2025-07-16T09:00",
      status: ApplicationStatus.INTERVIEW
    });

    await updateApplication(workspace.id, created.id, {
      companyName: "History Co",
      role: "Manager",
      appliedAtLocal: "2025-07-16T09:00",
      status: ApplicationStatus.APPLIED
    });

    const sortedHistory = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: created.id },
      orderBy: [{ occurredAt: "asc" }, { recordedAt: "asc" }, { id: "asc" }]
    });
    expect(sortedHistory.map((entry) => entry.toStatus)).toEqual([
      ApplicationStatus.APPLIED,
      ApplicationStatus.INTERVIEW,
      ApplicationStatus.APPLIED
    ]);

    await updateApplication(workspace.id, created.id, {
      companyName: "History Co",
      role: "Manager",
      appliedAtLocal: "2025-07-16T09:00",
      status: ApplicationStatus.REJECTED
    });

    const beforeArchive = await prisma.application.findUniqueOrThrow({
      where: { id: created.id }
    });
    expect(beforeArchive.status).toBe(ApplicationStatus.REJECTED);
    expect(beforeArchive.archivedAt).toBeNull();

    await archiveApplication(workspace.id, created.id);
    const archived = await prisma.application.findUniqueOrThrow({
      where: { id: created.id }
    });
    expect(archived.status).toBe(ApplicationStatus.REJECTED);
    expect(archived.archivedAt).not.toBeNull();

    const hiddenAfterArchive = await listApplications({
      workspaceId: workspace.id
    });
    expect(
      hiddenAfterArchive.some((application) => application.id === created.id)
    ).toBe(false);

    await restoreApplication(workspace.id, created.id);
    const restored = await prisma.application.findUniqueOrThrow({
      where: { id: created.id }
    });
    expect(restored.status).toBe(ApplicationStatus.REJECTED);
    expect(restored.archivedAt).toBeNull();
  });

  it("derives transition job-search date from the actual transition instant", async () => {
    const workspace = await createWorkspace();
    const settings = await getWorkspaceSettings(workspace.id);

    const created = await createApplication(workspace.id, {
      companyName: "Transition Co",
      role: "Lead Engineer",
      appliedAtLocal: "2025-07-16T09:00",
      status: ApplicationStatus.APPLIED
    });

    await updateApplication(workspace.id, created.id, {
      companyName: "Transition Co",
      role: "Lead Engineer",
      appliedAtLocal: "2025-07-16T09:00",
      status: ApplicationStatus.INTERVIEW
    });

    const transitionActivity = await prisma.activity.findFirstOrThrow({
      where: {
        applicationId: created.id,
        type: "STATUS_CHANGE"
      },
      orderBy: [{ occurredAt: "desc" }]
    });

    const expectedJobSearchDate = deriveJobSearchDateFromInstant(
      transitionActivity.occurredAt,
      settings
    );
    expect(transitionActivity.jobSearchDate?.toISOString()).toBe(
      expectedJobSearchDate.toISOString()
    );
  });
});
