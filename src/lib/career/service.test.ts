import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  getCareerProfileVersionById,
  getLatestCareerProfileVersion,
  importCareerKnowledge
} from "@/lib/career/service";
import { computeSha256 } from "@/lib/career/utils";
import fixture from "../../../fixtures/career_knowledge_base_fixture_v1.json";

const prisma = new PrismaClient();
const createdWorkspaceIds = new Set<string>();
let fixtureDirectory = "";
let validFixturePath = "";

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
      name: `Career Import Workspace ${randomUUID()}`,
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

async function writeFixtureFile(filename: string, content: unknown) {
  const filePath = path.join(fixtureDirectory, filename);
  await fs.writeFile(filePath, JSON.stringify(content, null, 2), "utf8");
  return filePath;
}

describe("career knowledge import service", () => {
  beforeAll(async () => {
    fixtureDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "career-import-"));
    validFixturePath = await writeFixtureFile(
      "career_knowledge_base_fixture_v1.json",
      fixture
    );
  });

  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    if (fixtureDirectory) {
      await fs.rm(fixtureDirectory, { recursive: true, force: true });
    }

    await prisma.$disconnect();
  });

  it("dry run writes nothing", async () => {
    const workspace = await createWorkspace();
    const beforeSourceCount = await prisma.careerProfileSource.count({
      where: { workspaceId: workspace.id }
    });
    const beforeVersionCount = await prisma.careerProfileVersion.count({
      where: { workspaceId: workspace.id }
    });

    const report = await importCareerKnowledge({
      filePath: validFixturePath,
      dryRun: true,
      prismaClient: prisma,
      workspaceId: workspace.id
    });

    expect(report.mode).toBe("dry-run");
    expect(report.validation.errorCount).toBe(0);

    const afterSourceCount = await prisma.careerProfileSource.count({
      where: { workspaceId: workspace.id }
    });
    const afterVersionCount = await prisma.careerProfileVersion.count({
      where: { workspaceId: workspace.id }
    });

    expect(afterSourceCount).toBe(beforeSourceCount);
    expect(afterVersionCount).toBe(beforeVersionCount);
  });

  it("valid source creates immutable version and preserves source metadata", async () => {
    const workspace = await createWorkspace();
    const report = await importCareerKnowledge({
      filePath: validFixturePath,
      prismaClient: prisma,
      workspaceId: workspace.id
    });

    expect(report.sourceRecordId).toBeTruthy();
    expect(report.versionId).toBeTruthy();

    const persistedVersion = await prisma.careerProfileVersion.findUniqueOrThrow({
      where: { id: report.versionId ?? "" },
      include: { source: true }
    });

    expect(persistedVersion.source.filename).toBe("career_knowledge_base_fixture_v1.json");
    expect(persistedVersion.source.checksum).toBe(report.checksum);
    expect(persistedVersion.schemaVersion).toBe("1.0.0");
    expect(persistedVersion.importerVersion).toBe("m2.1.0");
    expect(persistedVersion.active).toBe(true);
  });

  it("same source import is idempotent", async () => {
    const workspace = await createWorkspace();
    const first = await importCareerKnowledge({
      filePath: validFixturePath,
      prismaClient: prisma,
      workspaceId: workspace.id
    });
    const second = await importCareerKnowledge({
      filePath: validFixturePath,
      prismaClient: prisma,
      workspaceId: workspace.id
    });

    expect(first.versionId).toBeTruthy();
    expect(second.duplicateImport).toBe(true);
    expect(second.reusedVersionId).toBe(first.versionId);

    const sourceCount = await prisma.careerProfileSource.count({
      where: { workspaceId: workspace.id }
    });
    const versionCount = await prisma.careerProfileVersion.count({
      where: { workspaceId: workspace.id }
    });

    expect(sourceCount).toBe(1);
    expect(versionCount).toBe(1);
  });

  it("changed source creates a new version and prior version remains unchanged", async () => {
    const workspace = await createWorkspace();
    const first = await importCareerKnowledge({
      filePath: validFixturePath,
      prismaClient: prisma,
      workspaceId: workspace.id
    });

    const changedFixturePath = await writeFixtureFile("changed_fixture.json", {
      ...fixture,
      knownUnknowns: [...fixture.knownUnknowns, "Additional note."]
    });

    const second = await importCareerKnowledge({
      filePath: changedFixturePath,
      prismaClient: prisma,
      workspaceId: workspace.id
    });

    expect(second.versionId).not.toBe(first.versionId);

    const firstVersion = await prisma.careerProfileVersion.findUniqueOrThrow({
      where: { id: first.versionId ?? "" }
    });
    const secondVersion = await prisma.careerProfileVersion.findUniqueOrThrow({
      where: { id: second.versionId ?? "" }
    });

    expect(firstVersion.active).toBe(false);
    expect(secondVersion.active).toBe(true);
    expect(secondVersion.predecessorId).toBe(firstVersion.id);
  });

  it("invalid blocking source rolls back completely", async () => {
    const workspace = await createWorkspace();
    const invalidFixturePath = await writeFixtureFile("invalid_fixture.json", {
      ...fixture,
      candidateProfile: {}
    });

    const report = await importCareerKnowledge({
      filePath: invalidFixturePath,
      prismaClient: prisma,
      workspaceId: workspace.id
    });

    expect(report.validation.errorCount).toBeGreaterThan(0);

    const sourceCount = await prisma.careerProfileSource.count({
      where: { workspaceId: workspace.id }
    });
    const versionCount = await prisma.careerProfileVersion.count({
      where: { workspaceId: workspace.id }
    });

    expect(sourceCount).toBe(0);
    expect(versionCount).toBe(0);
  });

  it("warnings do not necessarily block import", async () => {
    const workspace = await createWorkspace();
    const warningFixturePath = await writeFixtureFile("warning_fixture.json", {
      ...fixture,
      extraSection: {
        note: true
      }
    });

    const report = await importCareerKnowledge({
      filePath: warningFixturePath,
      prismaClient: prisma,
      workspaceId: workspace.id
    });

    expect(report.validation.warningCount).toBeGreaterThanOrEqual(0);
    expect(report.versionId).toBeTruthy();
  });

  it("latest-version retrieval works and version-by-id retrieval survives database round trip", async () => {
    const workspace = await createWorkspace();
    const report = await importCareerKnowledge({
      filePath: validFixturePath,
      prismaClient: prisma,
      workspaceId: workspace.id
    });

    const latest = await getLatestCareerProfileVersion(workspace.id, prisma);
    const byId = await getCareerProfileVersionById(
      workspace.id,
      report.versionId ?? "",
      prisma
    );

    expect(latest?.id).toBe(report.versionId);
    expect(byId?.id).toBe(report.versionId);
    expect(byId?.source.filename).toBe("career_knowledge_base_fixture_v1.json");
    expect((byId?.content as { candidate?: { displayName?: string } }).candidate?.displayName).toBe(
      "Fixture Candidate"
    );
    expect(
      (byId?.validationSummary as { errorCount?: number }).errorCount
    ).toBe(report.validation.errorCount);
  });

  it("no duplicate source record is created for the same checksum", async () => {
    const workspace = await createWorkspace();
    await importCareerKnowledge({
      filePath: validFixturePath,
      prismaClient: prisma,
      workspaceId: workspace.id
    });
    await importCareerKnowledge({
      filePath: validFixturePath,
      prismaClient: prisma,
      workspaceId: workspace.id
    });

    const sourceCount = await prisma.careerProfileSource.count({
      where: { workspaceId: workspace.id }
    });
    expect(sourceCount).toBe(1);
  });

  it("transaction failure leaves no partial source or version record", async () => {
    const workspace = await createWorkspace();

    await expect(
      importCareerKnowledge({
        filePath: validFixturePath,
        prismaClient: prisma,
        workspaceId: workspace.id,
        simulateFailureAfterSourceCreate: true
      })
    ).rejects.toThrow(/simulated career import failure/i);

    const sourceCount = await prisma.careerProfileSource.count({
      where: { workspaceId: workspace.id }
    });
    const versionCount = await prisma.careerProfileVersion.count({
      where: { workspaceId: workspace.id }
    });

    expect(sourceCount).toBe(0);
    expect(versionCount).toBe(0);
  });

  it("checksum generation matches the persisted source checksum", async () => {
    const workspace = await createWorkspace();
    const report = await importCareerKnowledge({
      filePath: validFixturePath,
      prismaClient: prisma,
      workspaceId: workspace.id
    });
    const fileContents = await fs.readFile(validFixturePath, "utf8");

    expect(report.checksum).toBe(computeSha256(fileContents));
  });
});
