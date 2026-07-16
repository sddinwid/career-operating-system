import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, Prisma, PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import {
  createFixtureImportPreview,
  getFixtureImportTemplate,
  getImportJobDetail,
  retryImportJobFailures,
  runImportJob
} from "@/lib/imports/service";

const prisma = new PrismaClient();
const createdWorkspaceIds = new Set<string>();

function readNormalizedData(row: { normalizedData: unknown }) {
  if (!row.normalizedData || typeof row.normalizedData !== "object") {
    throw new Error("Normalized row data is unavailable.");
  }

  return row.normalizedData as Record<string, unknown>;
}

async function updateNormalizedData(
  rowId: string,
  transform: (current: Record<string, unknown>) => Record<string, unknown>
) {
  const currentRow = await prisma.importRow.findUniqueOrThrow({
    where: { id: rowId }
  });
  const current = readNormalizedData(currentRow);

  await prisma.importRow.update({
    where: { id: rowId },
    data: {
      normalizedData: transform(current) as Prisma.InputJsonValue
    }
  });
}

async function skipOtherReadyRows(importJobId: string, keepRowId: string) {
  await prisma.importRow.updateMany({
    where: {
      importJobId,
      status: "READY",
      NOT: {
        id: keepRowId
      }
    },
    data: {
      status: "SKIPPED"
    }
  });
}

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
      name: `Import Workspace ${randomUUID()}`,
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

describe("fixture import service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it("creates a reproducible preview and reimport does not create uncontrolled duplicates", async () => {
    const workspace = await createWorkspace();
    const template = getFixtureImportTemplate();

    const firstJobId = await createFixtureImportPreview(
      workspace.id,
      template.inferredMapping
    );
    const firstJob = await getImportJobDetail(workspace.id, firstJobId);

    expect(firstJob).not.toBeNull();
    expect(firstJob?.rows.length).toBeGreaterThan(0);
    expect(firstJob?.sheetName).toBe("Tracker");
    expect(firstJob?.summary).toBeTruthy();

    await runImportJob(workspace.id, firstJobId);

    const applicationCountAfterFirstImport = await prisma.application.count({
      where: { workspaceId: workspace.id }
    });
    expect(applicationCountAfterFirstImport).toBeGreaterThan(0);

    const secondJobId = await createFixtureImportPreview(
      workspace.id,
      template.inferredMapping
    );
    await runImportJob(workspace.id, secondJobId);

    const secondJob = await getImportJobDetail(workspace.id, secondJobId);
    const applicationCountAfterSecondImport = await prisma.application.count({
      where: { workspaceId: workspace.id }
    });

    expect(applicationCountAfterSecondImport).toBe(applicationCountAfterFirstImport);
    expect(
      secondJob?.rows.some((row) => row.status === "DUPLICATE")
    ).toBe(true);
  });

  it("stores row-level errors with sheet and row context when validation fails", async () => {
    const workspace = await createWorkspace();
    const template = getFixtureImportTemplate();

    const invalidMapping = {
      ...template.inferredMapping,
      recruiterEmail: template.inferredMapping.companyName
    };

    const jobId = await createFixtureImportPreview(workspace.id, invalidMapping);
    const job = await getImportJobDetail(workspace.id, jobId);

    const invalidRows = job?.rows.filter((row) => row.status === "INVALID") ?? [];
    expect(invalidRows.length).toBeGreaterThan(0);

    const firstInvalid = invalidRows[0];
    const firstMessage = Array.isArray(firstInvalid?.errorMessages)
      ? firstInvalid?.errorMessages[0]
      : null;

    expect(typeof firstMessage).toBe("string");
    expect(String(firstMessage)).toMatch(/^Tracker row \d+:/);
  });

  it("preserves exact Excel calendar dates for DATE_ONLY imports while manual timestamps still use cutoff behavior", async () => {
    const workspace = await createWorkspace();
    const template = getFixtureImportTemplate();

    const jobId = await createFixtureImportPreview(workspace.id, template.inferredMapping);
    await runImportJob(workspace.id, jobId);

    const importJob = await getImportJobDetail(workspace.id, jobId);
    const importedRow = importJob?.rows.find((row) => row.status === "IMPORTED");
    expect(importedRow?.matchedApplicationId).toBeTruthy();

    if (!importedRow?.matchedApplicationId) {
      throw new Error("Imported row is missing a matched application.");
    }

    const importedApplication = await prisma.application.findUniqueOrThrow({
      where: { id: importedRow.matchedApplicationId },
      include: {
        activities: {
          where: {
            type: "SUBMITTED"
          },
          orderBy: { occurredAt: "asc" }
        }
      }
    });

    const normalizedData =
      importedRow.normalizedData &&
      typeof importedRow.normalizedData === "object" &&
      !Array.isArray(importedRow.normalizedData)
        ? (importedRow.normalizedData as {
            authoritativeData?: { appliedDate?: string };
          })
        : null;
    const sourceAppliedDate = normalizedData?.authoritativeData?.appliedDate;

    expect(sourceAppliedDate).toBeTruthy();
    expect(importedApplication.jobSearchDate?.toISOString().slice(0, 10)).toBe(
      sourceAppliedDate
    );
    expect(importedApplication.appliedAt?.getUTCHours()).toBe(17);
    expect(importedApplication.activities[0]?.metadata).toMatchObject({
      precision: "DATE_ONLY"
    });

    const manualApplication = await createApplication(workspace.id, {
      companyName: "Manual Timestamp Co",
      role: "Engineer",
      appliedAtLocal: "2025-07-15T00:45",
      status: ApplicationStatus.APPLIED
    });

    const storedManualApplication = await prisma.application.findUniqueOrThrow({
      where: { id: manualApplication.id }
    });

    expect(
      storedManualApplication.jobSearchDate?.toISOString().slice(0, 10)
    ).toBe("2025-07-14");
  });

  it("imports valid rows even when one row fails and retry does not duplicate imported rows", async () => {
    const workspace = await createWorkspace();
    const template = getFixtureImportTemplate();

    const jobId = await createFixtureImportPreview(workspace.id, template.inferredMapping);
    const jobBeforeImport = await getImportJobDetail(workspace.id, jobId);
    expect(jobBeforeImport).not.toBeNull();

    const readyRow = jobBeforeImport?.rows.find((row) => row.status === "READY");
    expect(readyRow).toBeTruthy();

    if (!readyRow?.normalizedData || typeof readyRow.normalizedData !== "object") {
      throw new Error("Ready row normalized data is unavailable.");
    }

    const brokenNormalizedData = {
      ...(readyRow.normalizedData as Record<string, unknown>),
      authoritativeData: {
        ...(
          (readyRow.normalizedData as {
            authoritativeData?: Record<string, unknown>;
          }).authoritativeData ?? {}
        ),
        companyName: undefined
      }
    };

    await prisma.importRow.update({
      where: { id: readyRow.id },
      data: {
        normalizedData: brokenNormalizedData
      }
    });

    await runImportJob(workspace.id, jobId);

    const importedCountAfterPartialRun = await prisma.application.count({
      where: { workspaceId: workspace.id }
    });
    expect(importedCountAfterPartialRun).toBeGreaterThan(0);

    const failedRowAfterPartialRun = await prisma.importRow.findUniqueOrThrow({
      where: { id: readyRow.id }
    });
    expect(failedRowAfterPartialRun.status).toBe("INVALID");

    const repairedNormalizedData = {
      ...brokenNormalizedData,
      authoritativeData: {
        ...(
          (brokenNormalizedData as {
            authoritativeData?: Record<string, unknown>;
          }).authoritativeData ?? {}
        ),
        companyName: "Repairable Import Co"
      }
    };

    await prisma.importRow.update({
      where: { id: readyRow.id },
      data: {
        normalizedData: repairedNormalizedData
      }
    });

    await retryImportJobFailures(workspace.id, jobId);

    const importedCountAfterRetry = await prisma.application.count({
      where: { workspaceId: workspace.id }
    });
    expect(importedCountAfterRetry).toBe(importedCountAfterPartialRun + 1);
  });

  it("does not reject a usable fixture row when optional URL and email values are invalid", async () => {
    const workspace = await createWorkspace();
    const template = getFixtureImportTemplate();

    const jobId = await createFixtureImportPreview(workspace.id, template.inferredMapping);
    const job = await getImportJobDetail(workspace.id, jobId);
    const targetRow = job?.rows.find((row) => row.status === "READY");
    expect(targetRow).toBeTruthy();

    if (!targetRow) {
      throw new Error("Ready row is unavailable.");
    }

    await skipOtherReadyRows(jobId, targetRow.id);
    await updateNormalizedData(targetRow.id, (current) => {
      const authoritativeData =
        current.authoritativeData && typeof current.authoritativeData === "object"
          ? (current.authoritativeData as Record<string, unknown>)
          : {};
      const warnings = Array.isArray(current.warnings)
        ? [...current.warnings, "Job URL is invalid and will be preserved only in the raw import row.", "Recruiter email is invalid and will be preserved only in the raw import row."]
        : [
            "Job URL is invalid and will be preserved only in the raw import row.",
            "Recruiter email is invalid and will be preserved only in the raw import row."
          ];
      const issueGroups = Array.isArray(current.issueGroups)
        ? [
            ...current.issueGroups,
            {
              code: "INVALID_OPTIONAL_URL",
              severity: "warning",
              message:
                "Job URL is invalid and will be preserved only in the raw import row."
            },
            {
              code: "INVALID_OPTIONAL_EMAIL",
              severity: "warning",
              message:
                "Recruiter email is invalid and will be preserved only in the raw import row."
            }
          ]
        : [];

      return {
        ...current,
        authoritativeData: {
          ...authoritativeData,
          jobUrl: undefined,
          rawJobUrl: "not a url",
          recruiterEmail: undefined,
          rawRecruiterEmail: "not-an-email"
        },
        warnings,
        issueGroups,
        classification: "warning",
        proposedRecordType: "submitted_application",
        recommendedHandling: "import_with_warning",
        willImport: true
      };
    });

    await runImportJob(workspace.id, jobId);

    const importedRow = await prisma.importRow.findUniqueOrThrow({
      where: { id: targetRow.id }
    });
    expect(importedRow.status).toBe("IMPORTED");
    expect(importedRow.matchedApplicationId).toBeTruthy();

    if (!importedRow.matchedApplicationId) {
      throw new Error("Imported row is missing a matched application.");
    }

    const importedApplication = await prisma.application.findUniqueOrThrow({
      where: { id: importedRow.matchedApplicationId },
      include: {
        opportunity: true
      }
    });
    const contacts = await prisma.contact.findMany({
      where: {
        workspaceId: workspace.id,
        companyId: importedApplication.opportunity.companyId
      }
    });

    expect(importedApplication.opportunity.jobUrl).toBeNull();
    expect(contacts.some((contact) => contact.email === "not-an-email")).toBe(false);
  });

  it("imports company and role without an application date as an opportunity only", async () => {
    const workspace = await createWorkspace();
    const template = getFixtureImportTemplate();

    const jobId = await createFixtureImportPreview(workspace.id, template.inferredMapping);
    const job = await getImportJobDetail(workspace.id, jobId);
    const targetRow = job?.rows.find((row) => row.status === "READY");
    expect(targetRow).toBeTruthy();

    if (!targetRow) {
      throw new Error("Ready row is unavailable.");
    }

    await skipOtherReadyRows(jobId, targetRow.id);
    await updateNormalizedData(targetRow.id, (current) => {
      const authoritativeData =
        current.authoritativeData && typeof current.authoritativeData === "object"
          ? (current.authoritativeData as Record<string, unknown>)
          : {};
      const warnings = Array.isArray(current.warnings)
        ? [
            ...current.warnings,
            "Company and role are present without an application date, so this row will import as a saved opportunity."
          ]
        : [
            "Company and role are present without an application date, so this row will import as a saved opportunity."
          ];
      const issueGroups = Array.isArray(current.issueGroups)
        ? [
            ...current.issueGroups,
            {
              code: "MISSING_APPLICATION_DATE",
              severity: "warning",
              message:
                "Application date is missing, so the row cannot import as a submitted application."
            },
            {
              code: "ROW_REPRESENTS_RESEARCH_NOT_APPLICATION",
              severity: "warning",
              message:
                "Company and role are present without an application date, so this row will import as a saved opportunity."
            }
          ]
        : [];

      return {
        ...current,
        authoritativeData: {
          ...authoritativeData,
          appliedDate: undefined,
          appliedAtPrecision: undefined
        },
        warnings,
        errors: [],
        issueGroups,
        classification: "warning",
        proposedRecordType: "saved_opportunity",
        recommendedHandling: "import_as_saved_opportunity",
        willImport: true
      };
    });

    await runImportJob(workspace.id, jobId);

    const importedRow = await prisma.importRow.findUniqueOrThrow({
      where: { id: targetRow.id }
    });
    const importedApplications = await prisma.application.count({
      where: { workspaceId: workspace.id }
    });
    const importedOpportunities = await prisma.jobOpportunity.count({
      where: { workspaceId: workspace.id }
    });
    const refreshedJob = await getImportJobDetail(workspace.id, jobId);
    const summary =
      refreshedJob?.summary &&
      typeof refreshedJob.summary === "object" &&
      !Array.isArray(refreshedJob.summary)
        ? (refreshedJob.summary as {
            importResult?: {
              applicationCount?: number;
              opportunityOnlyCount?: number;
            };
          })
        : {};

    expect(importedRow.status).toBe("IMPORTED");
    expect(importedRow.matchedApplicationId).toBeNull();
    expect(importedApplications).toBe(0);
    expect(importedOpportunities).toBe(1);
    expect(summary.importResult?.applicationCount).toBe(0);
    expect(summary.importResult?.opportunityOnlyCount).toBe(1);
  });

  it("preserves unknown optional values as warnings without discarding a usable row", async () => {
    const workspace = await createWorkspace();
    const template = getFixtureImportTemplate();

    const jobId = await createFixtureImportPreview(workspace.id, template.inferredMapping);
    const job = await getImportJobDetail(workspace.id, jobId);
    const targetRow = job?.rows.find((row) => row.status === "READY");
    expect(targetRow).toBeTruthy();

    if (!targetRow) {
      throw new Error("Ready row is unavailable.");
    }

    await skipOtherReadyRows(jobId, targetRow.id);
    await updateNormalizedData(targetRow.id, (current) => {
      const authoritativeData =
        current.authoritativeData && typeof current.authoritativeData === "object"
          ? (current.authoritativeData as Record<string, unknown>)
          : {};
      const warnings = Array.isArray(current.warnings)
        ? [
            ...current.warnings,
            'Priority "Side Quest" is not mapped and will be preserved for review.'
          ]
        : ['Priority "Side Quest" is not mapped and will be preserved for review.'];
      const issueGroups = Array.isArray(current.issueGroups)
        ? [
            ...current.issueGroups,
            {
              code: "UNKNOWN_PRIORITY",
              severity: "warning",
              message:
                'Priority "Side Quest" is not mapped and will be preserved for review.'
            }
          ]
        : [];

      return {
        ...current,
        authoritativeData: {
          ...authoritativeData,
          priority: undefined,
          rawPriority: "Side Quest"
        },
        warnings,
        issueGroups,
        classification: "warning",
        proposedRecordType: "submitted_application",
        recommendedHandling: "import_with_warning",
        willImport: true
      };
    });

    await runImportJob(workspace.id, jobId);

    const importedRow = await prisma.importRow.findUniqueOrThrow({
      where: { id: targetRow.id }
    });
    expect(importedRow.matchedApplicationId).toBeTruthy();

    if (!importedRow.matchedApplicationId) {
      throw new Error("Imported row is missing a matched application.");
    }

    const importedApplication = await prisma.application.findUniqueOrThrow({
      where: { id: importedRow.matchedApplicationId }
    });

    expect(importedApplication.priority).toBeNull();
  });

  it("creates separate related records when one imported row contains multiple dated events", async () => {
    const workspace = await createWorkspace();
    const template = getFixtureImportTemplate();

    const jobId = await createFixtureImportPreview(workspace.id, template.inferredMapping);
    const job = await getImportJobDetail(workspace.id, jobId);
    const targetRow = job?.rows.find((row) => row.status === "READY");
    expect(targetRow).toBeTruthy();

    if (!targetRow?.normalizedData || typeof targetRow.normalizedData !== "object") {
      throw new Error("Ready row normalized data is unavailable.");
    }

    const augmentedNormalizedData = {
      ...(targetRow.normalizedData as Record<string, unknown>),
      authoritativeData: {
        ...(
          (targetRow.normalizedData as {
            authoritativeData?: Record<string, unknown>;
          }).authoritativeData ?? {}
        ),
        recruiterEmail: "recruiter@example.com",
        linkedinMessageSentDate: "2026-07-18",
        linkedinMessageSentPrecision: "DATE_ONLY",
        emailSentDate: "2026-07-19",
        emailSentPrecision: "DATE_ONLY",
        firstInterviewDate: "2026-07-20",
        firstInterviewPrecision: "DATE_ONLY",
        interviewStagesCompleted: "Phone screen"
      }
    };

    await prisma.importRow.update({
      where: { id: targetRow.id },
      data: {
        normalizedData: augmentedNormalizedData
      }
    });

    await runImportJob(workspace.id, jobId);

    const importedRow = await prisma.importRow.findUniqueOrThrow({
      where: { id: targetRow.id }
    });
    expect(importedRow.matchedApplicationId).toBeTruthy();

    if (!importedRow.matchedApplicationId) {
      throw new Error("Imported row is missing a matched application.");
    }

    const activities = await prisma.activity.findMany({
      where: {
        workspaceId: workspace.id,
        applicationId: importedRow.matchedApplicationId
      },
      orderBy: { occurredAt: "asc" }
    });
    const interviews = await prisma.interview.findMany({
      where: {
        workspaceId: workspace.id,
        applicationId: importedRow.matchedApplicationId
      }
    });

    expect(activities.map((activity) => activity.type)).toEqual(
      expect.arrayContaining([
        "SUBMITTED",
        "LINKEDIN_MESSAGE",
        "EMAIL_SENT",
        "INTERVIEW_SCHEDULED"
      ])
    );
    expect(interviews).toHaveLength(1);
  });
});
