import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, PrismaClient } from "@prisma/client";
import { createApplicationWorkflow } from "@/lib/db/application-workflow";

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

describe("createApplicationWorkflow", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it("creates an opportunity, application, status history, and activity transactionally", async () => {
    const suffix = randomUUID();
    const workspace = await prisma.workspace.create({
      data: {
        name: `Integration Test Workspace ${suffix}`
      }
    });
    createdWorkspaceIds.add(workspace.id);

    const company = await prisma.company.create({
      data: {
        workspaceId: workspace.id,
        name: `Acme ${suffix}`,
        normalizedName: `acme-${suffix}`
      }
    });

    const appliedAt = new Date("2026-07-16T14:30:00.000Z");
    const jobSearchDate = new Date("2026-07-16T00:00:00.000Z");

    const result = await createApplicationWorkflow({
      workspaceId: workspace.id,
      companyId: company.id,
      title: "Senior Software Engineer",
      jobUrl: "https://example.com/jobs/senior-software-engineer",
      source: "LinkedIn",
      location: "Chicago, IL",
      appliedAt,
      jobSearchDate,
      notes: "Created during integration test",
      activitySummary: "Submitted application through company site"
    });

    const persisted = await prisma.application.findUniqueOrThrow({
      where: { id: result.application.id },
      include: {
        opportunity: true,
        statusHistoryEntries: true,
        activities: true
      }
    });

    expect(persisted.status).toBe(ApplicationStatus.APPLIED);
    expect(persisted.opportunity.title).toBe("Senior Software Engineer");
    expect(persisted.statusHistoryEntries).toHaveLength(1);
    expect(persisted.statusHistoryEntries[0]?.toStatus).toBe(ApplicationStatus.APPLIED);
    expect(persisted.activities).toHaveLength(1);
    expect(persisted.activities[0]?.summary).toContain("Submitted application");
  });
});
