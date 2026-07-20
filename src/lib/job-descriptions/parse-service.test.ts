import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, JobDescriptionSourceType, Prisma, PrismaClient } from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import {
  getJobDescriptionAnalysisContext,
  getJobDescriptionParseById,
  getLatestJobDescriptionParseForVersion,
  getLatestSuccessfulJobDescriptionParseForVersion,
  parseStoredJobDescriptionVersion
} from "@/lib/job-descriptions/parse-service";
import {
  JOB_DESCRIPTION_PARSER_VERSION,
  parsedJobDescriptionContractSchema
} from "@/lib/job-descriptions/parser-contract";
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
      name: `Job Description Parse Workspace ${randomUUID()}`,
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

function loadFieldguideFixture() {
  return readFileSync(
    path.join(process.cwd(), "fixtures", "fieldguide-software-engineer-all-levels.txt"),
    "utf8"
  );
}

describe("job description parse service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it("stores an immutable successful parse and leaves source, application state, and career versions unchanged", async () => {
    const workspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Senior Platform Engineer",
      appliedAtLocal: "2026-07-14T10:00",
      status: ApplicationStatus.APPLIED,
      jobUrl: "https://company.example/jobs/123"
    });
    const saved = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput(`Acme
Senior Platform Engineer

Responsibilities
- Build TypeScript services

Requirements
- 5+ years of TypeScript

Compensation
$150,000 - $180,000 base salary`)
    );

    const beforeVersion = await prisma.jobDescriptionVersion.findUniqueOrThrow({
      where: { id: saved.version!.id }
    });
    const beforeApplication = await prisma.application.findUniqueOrThrow({
      where: { id: application.id }
    });
    const beforeHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: application.id }
    });
    const beforeCareerVersionCount = await prisma.careerProfileVersion.count({
      where: { workspaceId: workspace.id }
    });

    const parsed = await parseStoredJobDescriptionVersion(workspace.id, saved.version!.id, prisma);

    expect(parsed.duplicate).toBe(false);
    expect(parsed.parse.status).toBe("SUCCESS");
    expect(parsed.parse.result).not.toBeNull();

    const byId = await getJobDescriptionParseById(workspace.id, parsed.parse.id, prisma);
    const latest = await getLatestJobDescriptionParseForVersion(
      workspace.id,
      saved.version!.id,
      prisma
    );
    const latestSuccessful = await getLatestSuccessfulJobDescriptionParseForVersion(
      workspace.id,
      saved.version!.id,
      prisma
    );
    const analysis = await getJobDescriptionAnalysisContext(workspace.id, saved.version!.id, prisma);
    const afterVersion = await prisma.jobDescriptionVersion.findUniqueOrThrow({
      where: { id: saved.version!.id }
    });
    const afterApplication = await prisma.application.findUniqueOrThrow({
      where: { id: application.id }
    });
    const afterHistoryCount = await prisma.applicationStatusHistory.count({
      where: { applicationId: application.id }
    });
    const afterCareerVersionCount = await prisma.careerProfileVersion.count({
      where: { workspaceId: workspace.id }
    });
    const aiRunCount = await prisma.aiRun.count({
      where: { workspaceId: workspace.id }
    });

    expect(byId?.id).toBe(parsed.parse.id);
    expect(latest?.id).toBe(parsed.parse.id);
    expect(latestSuccessful?.id).toBe(parsed.parse.id);
    expect(analysis?.latestSuccessfulParse?.id).toBe(parsed.parse.id);
    expect(analysis?.latestParseStatusCounts).toEqual({ errors: 0, warnings: 0, info: 1 });
    expect(afterVersion.originalText).toBe(beforeVersion.originalText);
    expect(afterVersion.normalizedText).toBe(beforeVersion.normalizedText);
    expect(afterVersion.checksum).toBe(beforeVersion.checksum);
    expect(afterApplication.status).toBe(beforeApplication.status);
    expect(afterApplication.appliedAt?.toISOString()).toBe(beforeApplication.appliedAt?.toISOString());
    expect(afterApplication.recordedAt.toISOString()).toBe(beforeApplication.recordedAt.toISOString());
    expect(afterHistoryCount).toBe(beforeHistoryCount);
    expect(afterCareerVersionCount).toBe(beforeCareerVersionCount);
    expect(aiRunCount).toBe(0);
  });

  it("reuses the same parser version and creates a new immutable parse for a newer parser version override", async () => {
    const workspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Senior Platform Engineer",
      appliedAtLocal: "2026-07-14T10:00",
      status: ApplicationStatus.APPLIED
    });
    const saved = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput(`Acme
Senior Platform Engineer

Responsibilities
- Build APIs

Requirements
- TypeScript`)
    );

    const first = await parseStoredJobDescriptionVersion(workspace.id, saved.version!.id, prisma, {
      parserVersionOverride: "m3.2.1"
    });
    const reused = await parseStoredJobDescriptionVersion(workspace.id, saved.version!.id, prisma, {
      parserVersionOverride: "m3.2.1"
    });
    const newer = await parseStoredJobDescriptionVersion(workspace.id, saved.version!.id, prisma);

    const parseCount = await prisma.jobDescriptionParse.count({
      where: {
        workspaceId: workspace.id,
        jobDescriptionVersionId: saved.version!.id
      }
    });

    expect(reused.duplicate).toBe(true);
    expect(reused.parse.id).toBe(first.parse.id);
    expect(newer.duplicate).toBe(false);
    expect(newer.parse.id).not.toBe(first.parse.id);
    expect(newer.parse.parserVersion).toBe(JOB_DESCRIPTION_PARSER_VERSION);
    expect(parseCount).toBe(2);
  });

  it("preserves a prior successful parse when a later failed run exists and diagnostics survive round trip", async () => {
    const workspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Senior Platform Engineer",
      appliedAtLocal: "2026-07-14T10:00",
      status: ApplicationStatus.APPLIED
    });
    const saved = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput(`Acme
Senior Platform Engineer

Responsibilities
- Build APIs

Requirements
- TypeScript`)
    );

    const successful = await parseStoredJobDescriptionVersion(workspace.id, saved.version!.id, prisma);
    const failed = await prisma.jobDescriptionParse.create({
      data: {
        workspaceId: workspace.id,
        jobDescriptionVersionId: saved.version!.id,
        parserVersion: "m3.2.4",
        contractVersion: "1.0.1",
        sourceChecksum: saved.version!.checksum,
        status: "FAILED",
        diagnostics: [
          {
            code: "DESCRIPTION_TOO_SHORT",
            severity: "ERROR",
            message: "The normalized job description is too short to parse reliably.",
            rule: "parser.length.minimum",
            location: null
          }
        ],
        result: Prisma.DbNull,
        createdByWorkflow: "job-descriptions.detail.parse",
        errorSummary: "The normalized job description is too short to parse reliably.",
        completedAt: new Date("2026-07-16T12:00:00.000Z")
      }
    });

    expect(successful.parse.status).toBe("SUCCESS");
    expect(failed.status).toBe("FAILED");
    expect(failed.errorSummary).toMatch(/short to parse/i);
    expect(failed.result).toBeNull();

    const reparsedFailure = await prisma.jobDescriptionParse.findUniqueOrThrow({
      where: { id: failed.id }
    });
    const latestSuccessful = await getLatestSuccessfulJobDescriptionParseForVersion(
      workspace.id,
      saved.version!.id,
      prisma
    );

    expect(Array.isArray(reparsedFailure.diagnostics)).toBe(true);
    expect(latestSuccessful?.id).toBe(successful.parse.id);
  });

  it("preserves section hierarchy and applicability through parse-result persistence for competency-based postings", async () => {
    const workspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Fieldguide",
      role: "Software Engineer (All Levels)",
      appliedAtLocal: "2026-07-14T10:00",
      status: ApplicationStatus.APPLIED,
      jobUrl: "https://www.fieldguide.io/careers/software-engineer-all-levels"
    });
    const saved = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput(loadFieldguideFixture())
    );

    const parsed = await parseStoredJobDescriptionVersion(workspace.id, saved.version!.id, prisma);
    const persisted = await getJobDescriptionParseById(workspace.id, parsed.parse.id, prisma);
    const storedResult = parsedJobDescriptionContractSchema.parse(
      persisted?.result as Prisma.JsonValue
    );
    const technicalCraftSection = storedResult.sections.find(
      (section) => section.type === "TECHNICAL_CRAFT"
    );
    const seniorSection = storedResult.sections.find(
      (section) => section.canonicalHeading === "At the Senior level, you may"
    );
    const staffSection = storedResult.sections.find(
      (section) => section.canonicalHeading === "At the Staff level, you may"
    );

    expect(storedResult.sections.find((section) => section.type === "CORE_COMPETENCIES"))
      .toBeTruthy();
    expect(technicalCraftSection?.parentSectionId).toBeTruthy();
    expect(technicalCraftSection?.hierarchyDepth).toBe(1);
    expect(technicalCraftSection?.levelApplicability).toBe("ALL_LEVELS");
    expect(technicalCraftSection?.listOrientation).toBe("LIST");
    expect(seniorSection?.levelApplicability).toBe("SENIOR_ONLY");
    expect(staffSection?.levelApplicability).toBe("STAFF_ONLY");
    expect(
      storedResult.qualifications.some(
        (item) =>
          item.originalText.includes("Take increasing ownership") &&
          item.levelApplicability === "CONDITIONAL_HIGHER_LEVEL"
      )
    ).toBe(true);
    expect(
      storedResult.qualifications.some((item) =>
        item.originalText.includes("remote candidates anywhere in the US")
      )
    ).toBe(true);
  });

  it("enforces workspace ownership and rolls back on simulated failure after create", async () => {
    const workspace = await createWorkspace();
    const otherWorkspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Acme",
      role: "Senior Platform Engineer",
      appliedAtLocal: "2026-07-14T10:00",
      status: ApplicationStatus.APPLIED
    });
    const saved = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput(`Acme
Senior Platform Engineer

Responsibilities
- Build APIs

Requirements
- TypeScript`)
    );

    await expect(
      parseStoredJobDescriptionVersion(otherWorkspace.id, saved.version!.id, prisma)
    ).rejects.toThrow(/not found/i);

    await expect(
      parseStoredJobDescriptionVersion(workspace.id, saved.version!.id, prisma, {
        parserVersionOverride: "m3.2.4",
        simulateFailureAfterCreate: true
      })
    ).rejects.toThrow(/simulated failure/i);

    const parseCount = await prisma.jobDescriptionParse.count({
      where: {
        workspaceId: workspace.id,
        jobDescriptionVersionId: saved.version!.id
      }
    });

    expect(parseCount).toBe(0);
  });
});
