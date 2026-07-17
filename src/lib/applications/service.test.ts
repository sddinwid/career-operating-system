import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, PrismaClient } from "@prisma/client";
import {
  archiveApplication,
  createApplication,
  getApplicationDetail,
  listApplications,
  restoreApplication,
  updateApplicationGridField,
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

  it("updates status inline exactly once, keeps non-status edits out of history, and returns the authoritative grid row", async () => {
    const workspace = await createWorkspace();

    const created = await createApplication(workspace.id, {
      companyName: "Grid Status Co",
      role: "Engineer",
      appliedAtLocal: "2026-07-14T09:00",
      status: ApplicationStatus.APPLIED
    });

    const initialHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: created.id }
    });
    expect(initialHistoryCount).toBe(1);

    const updatedPriorityRow = await updateApplicationGridField(workspace.id, {
      applicationId: created.id,
      field: "priority",
      value: "HIGH"
    });
    expect(updatedPriorityRow.priority).toBe("HIGH");

    const updatedSourceRow = await updateApplicationGridField(workspace.id, {
      applicationId: created.id,
      field: "source",
      value: "Referral"
    });
    expect(updatedSourceRow.source).toBe("Referral");

    const historyAfterPriority = await prisma.applicationStatusHistory.count({
      where: { applicationId: created.id }
    });
    expect(historyAfterPriority).toBe(1);

    const updatedStatusRow = await updateApplicationGridField(workspace.id, {
      applicationId: created.id,
      field: "status",
      value: "INTERVIEW"
    });
    expect(updatedStatusRow.status).toBe(ApplicationStatus.INTERVIEW);

    const historyAfterStatus = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: created.id },
      orderBy: [{ occurredAt: "asc" }, { recordedAt: "asc" }, { id: "asc" }]
    });
    expect(historyAfterStatus).toHaveLength(2);
    expect(historyAfterStatus.at(-1)?.toStatus).toBe(ApplicationStatus.INTERVIEW);

    await updateApplicationGridField(workspace.id, {
      applicationId: created.id,
      field: "status",
      value: "INTERVIEW"
    });

    const historyAfterDuplicateStatus = await prisma.applicationStatusHistory.count({
      where: { applicationId: created.id }
    });
    expect(historyAfterDuplicateStatus).toBe(2);
  });

  it("preserves company reuse rules and opportunity identity during grid edits", async () => {
    const workspace = await createWorkspace();

    const acmeApplication = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Platform Engineer",
      appliedAtLocal: "2026-07-12T10:00",
      status: ApplicationStatus.APPLIED
    });
    const betaApplication = await createApplication(workspace.id, {
      companyName: "Beta",
      role: "Support Engineer",
      appliedAtLocal: "2026-07-13T10:00",
      status: ApplicationStatus.APPLIED
    });
    const duplicateTitleApplication = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Platform Engineer",
      appliedAtLocal: "2026-07-14T11:00",
      status: ApplicationStatus.APPLIED
    });

    await updateApplicationGridField(workspace.id, {
      applicationId: betaApplication.id,
      field: "company",
      value: "  ACME  "
    });

    const betaAfterCompanyEdit = await getApplicationDetail({
      workspaceId: workspace.id,
      applicationId: betaApplication.id
    });
    expect(betaAfterCompanyEdit?.opportunity.company.normalizedName).toBe("acme");

    const acmeCompanyCount = await prisma.company.count({
      where: {
        workspaceId: workspace.id,
        normalizedName: "acme"
      }
    });
    expect(acmeCompanyCount).toBe(1);

    const firstOpportunityId = (
      await prisma.application.findUniqueOrThrow({
        where: { id: acmeApplication.id },
        select: { opportunityId: true }
      })
    ).opportunityId;
    const secondOpportunityId = (
      await prisma.application.findUniqueOrThrow({
        where: { id: duplicateTitleApplication.id },
        select: { opportunityId: true }
      })
    ).opportunityId;
    expect(firstOpportunityId).not.toBe(secondOpportunityId);

    await updateApplicationGridField(workspace.id, {
      applicationId: acmeApplication.id,
      field: "role",
      value: "Platform Engineer"
    });

    const firstOpportunityAfterRoleEdit = (
      await prisma.application.findUniqueOrThrow({
        where: { id: acmeApplication.id },
        select: { opportunityId: true }
      })
    ).opportunityId;
    expect(firstOpportunityAfterRoleEdit).toBe(firstOpportunityId);
  });

  it("preserves DATE_ONLY precision, applies the cutoff to manual timestamps, preserves job-search-date overrides, and rejects invalid grid edits", async () => {
    const workspace = await createWorkspace();

    const dateOnlyApplication = await createApplication(workspace.id, {
      companyName: "Imported Co",
      role: "Analyst",
      appliedAtLocal: "2026-07-14T12:00",
      status: ApplicationStatus.APPLIED
    });

    await prisma.activity.updateMany({
      where: {
        applicationId: dateOnlyApplication.id,
        type: "SUBMITTED"
      },
      data: {
        metadata: {
          precision: "DATE_ONLY"
        }
      }
    });

    const dateOnlyRow = await updateApplicationGridField(workspace.id, {
      applicationId: dateOnlyApplication.id,
      field: "appliedAt",
      value: "2026-07-15"
    });
    expect(dateOnlyRow.appliedAtPrecision).toBe("DATE_ONLY");
    expect(dateOnlyRow.appliedAtInput).toBe("2026-07-15");
    expect(dateOnlyRow.jobSearchDateInput).toBe("2026-07-15");

    const manualApplication = await createApplication(workspace.id, {
      companyName: "Manual Co",
      role: "Operator",
      appliedAtLocal: "2026-07-14T09:00",
      status: ApplicationStatus.APPLIED
    });

    const cutoffRow = await updateApplicationGridField(workspace.id, {
      applicationId: manualApplication.id,
      field: "appliedAt",
      value: "2026-07-15T00:45"
    });
    expect(cutoffRow.appliedAtPrecision).toBe("DATE_TIME");
    expect(cutoffRow.jobSearchDateInput).toBe("2026-07-14");

    await updateApplicationGridField(workspace.id, {
      applicationId: manualApplication.id,
      field: "jobSearchDate",
      value: "2026-07-10"
    });
    const overridePreservedRow = await updateApplicationGridField(workspace.id, {
      applicationId: manualApplication.id,
      field: "source",
      value: "Referral"
    });
    expect(overridePreservedRow.jobSearchDateInput).toBe("2026-07-10");

    const beforeFailure = await prisma.application.findUniqueOrThrow({
      where: { id: manualApplication.id }
    });

    await expect(
      updateApplicationGridField(workspace.id, {
        applicationId: manualApplication.id,
        field: "appliedAt",
        value: "2026-07-20T09:00"
      })
    ).rejects.toThrow(/cannot be in the future/i);

    const afterFailure = await prisma.application.findUniqueOrThrow({
      where: { id: manualApplication.id }
    });
    expect(afterFailure.appliedAt).not.toBeNull();
    expect(beforeFailure.appliedAt).not.toBeNull();
    expect(afterFailure.jobSearchDate).not.toBeNull();
    expect(beforeFailure.jobSearchDate).not.toBeNull();
    expect(afterFailure.appliedAt?.toISOString()).toBe(
      beforeFailure.appliedAt?.toISOString()
    );
    expect(afterFailure.jobSearchDate?.toISOString()).toBe(
      beforeFailure.jobSearchDate?.toISOString()
    );
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
