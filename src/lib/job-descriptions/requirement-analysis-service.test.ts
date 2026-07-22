import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  ApplicationStatus,
  JobDescriptionSourceType,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { createApplication } from "@/lib/applications/service";
import { parseStoredJobDescriptionVersion } from "@/lib/job-descriptions/parse-service";
import {
  addUserRequirementToAnalysis,
  confirmRequirementAnalysis,
  createRevisedRequirementAnalysis,
  ensureRequirementAnalysisDraft,
  excludeRequirementAnalysisItem,
  getJobRequirementAnalysisById,
  getJobRequirementAnalysisContext,
  parseStoredJobRequirementAnalysis,
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

function loadFieldguideFixture() {
  return readFileSync(
    path.join(process.cwd(), "fixtures", "fieldguide-software-engineer-all-levels.txt"),
    "utf8"
  );
}

function loadSkyflowFixture() {
  return readFileSync(
    path.join(process.cwd(), "fixtures", "job-description-parser", "skyflow-backend-engineer.txt"),
    "utf8"
  );
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

function buildLegacyStoredAnalysis(
  analysis: Prisma.JsonValue,
  options?: {
    removeLevelApplicability?: boolean;
    summaryOverrides?: Record<string, unknown>;
  }
) {
  const cloned = JSON.parse(JSON.stringify(analysis)) as Record<string, unknown>;
  const requirements = Array.isArray(cloned.requirements)
    ? cloned.requirements.map((requirement) => {
        if (!options?.removeLevelApplicability || typeof requirement !== "object" || !requirement) {
          return requirement;
        }

        const { levelApplicability, ...rest } = requirement as Record<string, unknown>;
        void levelApplicability;
        return rest;
      })
    : cloned.requirements;
  const summary = {
    ...(cloned.summary as Record<string, unknown>),
    ...(options?.summaryOverrides ?? {})
  };

  delete summary.qualificationExtractionCount;
  delete summary.responsibilityExtractionCount;
  delete summary.downstreamReadiness;

  return {
    ...cloned,
    classifierVersion: "m3.3.0",
    requirements,
    summary
  };
}

function buildLegacyStoredParseResult(result: Prisma.JsonValue) {
  const cloned = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
  const sections = Array.isArray(cloned.sections)
    ? cloned.sections.map((section) => {
        if (typeof section !== "object" || section === null || Array.isArray(section)) {
          return section;
        }

        const {
          canonicalHeading,
          parentSectionId,
          hierarchyDepth,
          levelApplicability,
          listOrientation,
          ...rest
        } = section as Record<string, unknown>;
        void canonicalHeading;
        void parentSectionId;
        void hierarchyDepth;
        void levelApplicability;
        void listOrientation;

        return rest;
      })
    : cloned.sections;

  return {
    ...cloned,
    parserVersion: "m3.2.0",
    sections
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
    expect(revisedRecord.status).toBe("DRAFT");
  });

  it("creates a new immutable analysis for a newer parse while preserving prior analysis rows and applicability-rich atomic items", async () => {
    const workspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Fieldguide",
      role: "Software Engineer (All Levels)",
      appliedAtLocal: "2026-07-15T10:00",
      status: ApplicationStatus.APPLIED,
      jobUrl: "https://www.fieldguide.io/careers/software-engineer-all-levels"
    });
    const saved = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput(loadFieldguideFixture())
    );
    const olderParse = await parseStoredJobDescriptionVersion(
      workspace.id,
      saved.version!.id,
      prisma,
      {
        parserVersionOverride: "m3.2.1"
      }
    );
    const olderDraft = await ensureRequirementAnalysisDraft(workspace.id, saved.version!.id, prisma);
    const olderAnalysisSnapshot = await prisma.jobRequirementAnalysis.findUniqueOrThrow({
      where: { id: olderDraft.analysis!.id }
    });

    const currentParse = await parseStoredJobDescriptionVersion(workspace.id, saved.version!.id, prisma);
    const currentDraft = await ensureRequirementAnalysisDraft(workspace.id, saved.version!.id, prisma);
    const currentRecord = await getJobRequirementAnalysisById(
      workspace.id,
      currentDraft.analysis!.id,
      prisma
    );
    const currentAnalysis = parseStoredJobRequirementAnalysis(
      currentRecord!.analysis as Prisma.JsonValue
    );
    const olderAnalysisAfter = await prisma.jobRequirementAnalysis.findUniqueOrThrow({
      where: { id: olderDraft.analysis!.id }
    });

    expect(currentParse.parse.id).not.toBe(olderParse.parse.id);
    expect(currentDraft.analysis!.id).not.toBe(olderDraft.analysis!.id);
    expect(currentDraft.analysis!.jobDescriptionParseId).toBe(currentParse.parse.id);
    expect(olderAnalysisAfter.jobDescriptionParseId).toBe(olderParse.parse.id);
    expect(olderAnalysisAfter.analysis).toEqual(olderAnalysisSnapshot.analysis);
    expect(
      currentAnalysis.requirements.some(
        (item) =>
          item.originalText.includes("TypeScript, React, Node.js, Python, and GraphQL") &&
          item.technologies.includes("TypeScript") &&
          item.technologies.includes("GraphQL") &&
          item.levelApplicability === "ALL_LEVELS"
      )
    ).toBe(true);
    expect(
      currentAnalysis.requirements.some(
        (item) =>
          item.originalText.includes("Take increasing ownership") &&
          item.levelApplicability === "CONDITIONAL_HIGHER_LEVEL"
      )
    ).toBe(true);
    expect(
      currentAnalysis.requirements.some(
        (item) =>
          item.originalText.includes("Lead complex projects or systems") &&
          item.levelApplicability === "SENIOR_ONLY"
      )
    ).toBe(true);
    expect(
      currentAnalysis.requirements.some(
        (item) =>
          item.originalText.includes("Drive company-level technical initiatives") &&
          item.levelApplicability === "STAFF_ONLY"
      )
    ).toBe(true);
    expect(
      currentAnalysis.requirements.some(
        (item) =>
          item.originalText.includes("remote candidates anywhere in the US") &&
          item.category === "CONTEXTUAL"
      )
    ).toBe(true);
  });

  it("loads a legacy stored analysis by deriving missing summary fields conservatively without mutating the source object", async () => {
    const workspace = await createWorkspace();
    const { version, parse } = await createParsedVersion(workspace.id);
    const draft = await ensureRequirementAnalysisDraft(workspace.id, version.id, prisma);
    const legacySource = buildLegacyStoredAnalysis(draft.analysis!.analysis as Prisma.JsonValue, {
      removeLevelApplicability: true
    });
    const sourceSnapshot = JSON.stringify(legacySource);

    const normalized = parseStoredJobRequirementAnalysis(legacySource as Prisma.JsonValue);

    expect(normalized.summary.qualificationExtractionCount).toBe(
      normalized.requirements.filter((item) => !item.userAdded).length
    );
    expect(normalized.summary.responsibilityExtractionCount).toBe(
      normalized.responsibilities.length
    );
    expect(normalized.summary.downstreamReadiness).toBe("NEEDS_REVIEW");
    expect(normalized.reviewStatus).toBe(draft.analysis!.status);
    expect(normalized.requirements.every((item) => item.levelApplicability === "ALL_LEVELS")).toBe(
      true
    );
    expect(JSON.stringify(legacySource)).toBe(sourceSnapshot);
    expect(normalized.summary.requiredCount).toBe(
      (legacySource.summary as Record<string, unknown>).requiredCount
    );
  });

  it("keeps current-format analyses strict and rejects invalid explicit compatibility fields", async () => {
    const workspace = await createWorkspace();
    const { version } = await createParsedVersion(workspace.id);
    const draft = await ensureRequirementAnalysisDraft(workspace.id, version.id, prisma);
    const current = draft.analysis!.analysis as Prisma.JsonValue;

    expect(parseStoredJobRequirementAnalysis(current)).toMatchObject({
      id: draft.analysis!.id
    });

    const invalidCount = buildLegacyStoredAnalysis(current, {
      removeLevelApplicability: true
    }) as Record<string, unknown>;
    (invalidCount.summary as Record<string, unknown>).qualificationExtractionCount = "two";
    expect(() => parseStoredJobRequirementAnalysis(invalidCount as Prisma.JsonValue)).toThrow();

    const invalidReadiness = buildLegacyStoredAnalysis(current, {
      removeLevelApplicability: true
    }) as Record<string, unknown>;
    (invalidReadiness.summary as Record<string, unknown>).downstreamReadiness = "READY_NOW";
    expect(() => parseStoredJobRequirementAnalysis(invalidReadiness as Prisma.JsonValue)).toThrow();
  });

  it("creates a draft from a legacy stored parse result by deriving missing section metadata without mutating the stored row", async () => {
    const workspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Fieldguide",
      role: "Software Engineer (All Levels)",
      appliedAtLocal: "2026-07-15T10:00",
      status: ApplicationStatus.APPLIED,
      jobUrl: "https://www.fieldguide.io/careers/software-engineer-all-levels"
    });
    const saved = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput(loadFieldguideFixture())
    );
    const parsed = await parseStoredJobDescriptionVersion(workspace.id, saved.version!.id, prisma);
    const legacyResult = buildLegacyStoredParseResult(parsed.parse.result as Prisma.JsonValue);
    const sourceSnapshot = JSON.stringify(legacyResult);

    await prisma.jobDescriptionParse.update({
      where: { id: parsed.parse.id },
      data: {
        parserVersion: "m3.2.0",
        result: legacyResult as Prisma.InputJsonValue
      }
    });

    const draft = await ensureRequirementAnalysisDraft(workspace.id, saved.version!.id, prisma);
    const storedParse = await prisma.jobDescriptionParse.findUniqueOrThrow({
      where: { id: parsed.parse.id }
    });
    const normalizedDraft = parseStoredJobRequirementAnalysis(
      draft.analysis!.analysis as Prisma.JsonValue
    );

    expect(draft.created).toBe(true);
    expect(normalizedDraft.requirements.length).toBeGreaterThan(0);
    expect(
      normalizedDraft.requirements.some(
        (item) =>
          item.originalText.includes("Lead complex projects or systems") &&
          item.levelApplicability === "SENIOR_ONLY"
      )
    ).toBe(true);
    expect(
      normalizedDraft.requirements.some(
        (item) =>
          item.originalText.includes("Drive company-level technical initiatives") &&
          item.levelApplicability === "STAFF_ONLY"
      )
    ).toBe(true);
    expect(JSON.stringify(legacyResult)).toBe(sourceSnapshot);
    expect(storedParse.result).toEqual(legacyResult);
  });

  it("keeps the Skyflow corrective parse downstream-ready once You have and You will are recognized", async () => {
    const workspace = await createWorkspace();
    const application = await createApplication(workspace.id, {
      companyName: "Skyflow",
      role: "Software Engineer",
      appliedAtLocal: "2026-07-21T09:00",
      status: ApplicationStatus.APPLIED,
      jobUrl: "https://www.skyflow.com/careers?ashby_jid=5caff613-773d-466d-9876-cd803811d30b"
    });
    const saved = await saveJobDescriptionForApplication(
      workspace.id,
      application.id,
      buildInput(loadSkyflowFixture())
    );
    const parsed = await parseStoredJobDescriptionVersion(workspace.id, saved.version!.id, prisma);
    const draft = await ensureRequirementAnalysisDraft(workspace.id, saved.version!.id, prisma);
    const analysis = parseStoredJobRequirementAnalysis(draft.analysis!.analysis as Prisma.JsonValue);

    expect(parsed.parse.parserVersion).toBe("m3.2.6");
    expect(analysis.summary.downstreamReadiness).toBe("READY");
    expect(analysis.responsibilities.length).toBeGreaterThanOrEqual(6);
    expect(analysis.requirements.filter((item) => !item.userAdded).length).toBeGreaterThanOrEqual(8);
    expect(
      analysis.requirements.some(
        (item) =>
          item.originalText.includes("Go (preferred), Java, C, C++, Python") &&
          item.technologies.includes("Go") &&
          item.technologies.includes("Java") &&
          item.technologies.includes("Python")
      )
    ).toBe(true);
    expect(
      analysis.requirements.some(
        (item) =>
          item.originalText.includes("RESTful design, event driven systems") &&
          item.technologies.includes("REST API") &&
          item.technologies.includes("Event-Driven Systems")
      )
    ).toBe(true);
    expect(
      analysis.responsibilities.some((item) =>
        item.originalText.includes("REST/GraphQL services, message queues")
      )
    ).toBe(true);
  });

  it("normalizes a persisted legacy row through context loading without writing back to the database", async () => {
    const workspace = await createWorkspace();
    const { version, parse } = await createParsedVersion(workspace.id);
    const draft = await ensureRequirementAnalysisDraft(workspace.id, version.id, prisma);
    const legacyAnalysis = buildLegacyStoredAnalysis(draft.analysis!.analysis as Prisma.JsonValue, {
      removeLevelApplicability: true
    });

    const legacyRow = await prisma.jobRequirementAnalysis.create({
      data: {
        id: randomUUID(),
        workspaceId: workspace.id,
        jobDescriptionVersionId: version.id,
        jobDescriptionParseId: parse.id,
        contractVersion: "1.0.0",
        classifierVersion: "m3.3.0",
        sourceChecksum: version.checksum,
        parserVersion: "m3.2.0",
        status: "CONFIRMED",
        analysis: legacyAnalysis as Prisma.InputJsonValue,
        diagnostics: (legacyAnalysis as Record<string, unknown>).diagnostics as Prisma.InputJsonValue,
        createdByWorkflow: "test.legacy.analysis",
        confirmedAt: new Date("2026-07-17T12:00:00.000Z")
      }
    });

    const before = await prisma.jobRequirementAnalysis.findUniqueOrThrow({
      where: { id: legacyRow.id }
    });
    const context = await getJobRequirementAnalysisContext(workspace.id, version.id, prisma);
    const after = await prisma.jobRequirementAnalysis.findUniqueOrThrow({
      where: { id: legacyRow.id }
    });

    expect(context?.latestConfirmedContract?.summary.downstreamReadiness).toBe("NEEDS_REVIEW");
    expect(context?.latestConfirmedContract?.summary.qualificationExtractionCount).toBe(
      context?.latestConfirmedContract?.requirements.filter((item) => !item.userAdded).length
    );
    expect(context?.latestConfirmedContract?.summary.responsibilityExtractionCount).toBe(
      context?.latestConfirmedContract?.responsibilities.length
    );
    expect(before.analysis).toEqual(after.analysis);
    expect(before.status).toBe(after.status);
  });

  it("loads an otherwise valid empty legacy analysis conservatively", () => {
    const emptyLegacy = {
      id: "analysis-empty",
      workspaceId: "workspace-1",
      jobDescriptionVersionId: "job-description-1",
      parseId: "parse-1",
      contractVersion: "1.0.0",
      classifierVersion: "m3.3.0",
      createdAt: "2026-07-16T12:00:00.000Z",
      reviewStatus: "CONFIRMED",
      sourceChecksum: "checksum-1",
      parserVersion: "m3.2.0",
      requirements: [],
      responsibilities: [],
      summary: {
        requiredCount: 0,
        preferredCount: 0,
        contextualCount: 0,
        noiseCount: 0,
        includedResponsibilitiesCount: 0,
        excludedResponsibilitiesCount: 0,
        technologiesCount: 0,
        experienceRequirementsCount: 0,
        educationRequirementsCount: 0,
        certificationRequirementsCount: 0,
        leadershipRequirementsCount: 0,
        domainRequirementsCount: 0,
        userOverridesCount: 0,
        userAddedRequirementsCount: 0,
        unresolvedReviewItemsCount: 0,
        lowConfidenceCount: 0,
        excludedRequirementsCount: 0
      },
      lowConfidenceAcknowledged: false,
      diagnostics: []
    } satisfies Record<string, unknown>;

    const normalized = parseStoredJobRequirementAnalysis(emptyLegacy as Prisma.JsonValue);

    expect(normalized.reviewStatus).toBe("CONFIRMED");
    expect(normalized.summary.qualificationExtractionCount).toBe(0);
    expect(normalized.summary.responsibilityExtractionCount).toBe(0);
    expect(normalized.summary.downstreamReadiness).toBe("NEEDS_REVIEW");
  });
});
