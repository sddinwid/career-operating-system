import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { CareerProfilePurpose, PrismaClient } from "@prisma/client";
import { seedWorkspace } from "./seed";

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

describe("seedWorkspace", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it("creates a current real career profile and remains idempotent", async () => {
    const workspaceId = `seed-test-${randomUUID()}`;
    createdWorkspaceIds.add(workspaceId);

    await seedWorkspace(prisma, {
      workspaceId,
      workspaceName: "Seed Test Workspace"
    });
    await seedWorkspace(prisma, {
      workspaceId,
      workspaceName: "Seed Test Workspace"
    });

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId }
    });
    const currentProfile = workspace.currentCareerProfileVersionId
      ? await prisma.careerProfileVersion.findUniqueOrThrow({
          where: { id: workspace.currentCareerProfileVersionId },
          include: {
            source: true
          }
        })
      : null;
    const profileCount = await prisma.careerProfileVersion.count({
      where: { workspaceId }
    });

    expect(currentProfile).not.toBeNull();
    expect(currentProfile?.source.purpose).toBe(CareerProfilePurpose.USER);
    expect(currentProfile?.source.filename).toBe(
      "Scott_Dinwiddie_Career_Knowledge_Base_MongoDB_v3.json"
    );
    expect(profileCount).toBe(1);
  });
});
