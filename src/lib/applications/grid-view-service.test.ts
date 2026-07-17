import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ApplicationStatus, PrismaClient } from "@prisma/client";
import {
  createApplication
} from "@/lib/applications/service";
import {
  createApplicationsGridViewState
} from "@/lib/applications/grid-view-state";
import {
  ApplicationsGridPreferencesError,
  getApplicationsGridPreferences,
  mutateApplicationsGridPreferences
} from "@/lib/applications/grid-view-service";

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
      name: `Grid View Workspace ${randomUUID()}`,
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

describe("applications grid view service", () => {
  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await cleanupWorkspace(workspaceId);
    }

    await prisma.$disconnect();
  });

  it("loads the default system view when no persisted state exists", async () => {
    const workspace = await createWorkspace();
    const result = await getApplicationsGridPreferences(workspace.id);

    expect(result.preferences.activeViewId).toBe("system:all-active");
    expect(result.preferences.userViews).toEqual([]);
    expect(result.preferences.draftState.archiveMode).toBe("ACTIVE_ONLY");
  });

  it("persists multiple user views, restores the active view, and isolates workspaces", async () => {
    const firstWorkspace = await createWorkspace();
    const secondWorkspace = await createWorkspace();

    const firstViewState = createApplicationsGridViewState({
      archiveMode: "ALL",
      quickSearch: "Acme"
    });

    const createFirst = await mutateApplicationsGridPreferences(firstWorkspace.id, {
      type: "create",
      name: "My Active View",
      state: firstViewState
    });
    const createSecond = await mutateApplicationsGridPreferences(firstWorkspace.id, {
      type: "saveAs",
      name: "Archive Sweep",
      state: createApplicationsGridViewState({
        archiveMode: "ARCHIVED_ONLY"
      })
    });

    expect(createFirst.preferences.userViews).toHaveLength(1);
    expect(createSecond.preferences.userViews).toHaveLength(2);
    expect(createSecond.preferences.activeViewId).toMatch(/^user:/);

    const restored = await getApplicationsGridPreferences(firstWorkspace.id);
    expect(restored.preferences.activeViewId).toBe(createSecond.preferences.activeViewId);
    expect(restored.preferences.userViews.map((view) => view.name)).toEqual([
      "My Active View",
      "Archive Sweep"
    ]);

    const isolated = await getApplicationsGridPreferences(secondWorkspace.id);
    expect(isolated.preferences.userViews).toEqual([]);
    expect(isolated.preferences.activeViewId).toBe("system:all-active");
  });

  it("enforces normalized unique names, blocks system overrides, and rejects invalid workspace view operations", async () => {
    const workspace = await createWorkspace();

    await mutateApplicationsGridPreferences(workspace.id, {
      type: "create",
      name: "Follow Ups",
      state: createApplicationsGridViewState()
    });

    await expect(
      mutateApplicationsGridPreferences(workspace.id, {
        type: "saveAs",
        name: "  follow   ups ",
        state: createApplicationsGridViewState()
      })
    ).rejects.toBeInstanceOf(ApplicationsGridPreferencesError);

    await expect(
      mutateApplicationsGridPreferences(workspace.id, {
        type: "create",
        name: "Rejected",
        state: createApplicationsGridViewState()
      })
    ).rejects.toBeInstanceOf(ApplicationsGridPreferencesError);

    await expect(
      mutateApplicationsGridPreferences(workspace.id, {
        type: "rename",
        viewId: "system:all-active",
        name: "Anything"
      })
    ).rejects.toBeInstanceOf(ApplicationsGridPreferencesError);

    await expect(
      mutateApplicationsGridPreferences(workspace.id, {
        type: "delete",
        viewId: "system:all-active"
      })
    ).rejects.toBeInstanceOf(ApplicationsGridPreferencesError);
  });

  it("updates, renames, resets, and deletes only the intended user view", async () => {
    const workspace = await createWorkspace();

    const created = await mutateApplicationsGridPreferences(workspace.id, {
      type: "create",
      name: "Pipeline",
      state: createApplicationsGridViewState({
        scope: {
          statuses: ["INTERVIEW"]
        }
      })
    });

    const viewId = created.preferences.activeViewId;

    const renamed = await mutateApplicationsGridPreferences(workspace.id, {
      type: "rename",
      viewId,
      name: "Interview Pipeline"
    });
    expect(renamed.preferences.userViews[0]?.name).toBe("Interview Pipeline");

    const updated = await mutateApplicationsGridPreferences(workspace.id, {
      type: "update",
      viewId,
      state: createApplicationsGridViewState({
        archiveMode: "ALL",
        scope: {
          statuses: ["INTERVIEW", "OFFER"]
        }
      })
    });
    expect(updated.preferences.userViews[0]?.state.archiveMode).toBe("ALL");
    expect(updated.preferences.userViews[0]?.state.scope.statuses).toEqual([
      "INTERVIEW",
      "OFFER"
    ]);

    const reset = await mutateApplicationsGridPreferences(workspace.id, {
      type: "reset",
      viewId
    });
    expect(reset.preferences.draftState.scope.statuses).toEqual([
      "INTERVIEW",
      "OFFER"
    ]);

    const deleted = await mutateApplicationsGridPreferences(workspace.id, {
      type: "delete",
      viewId
    });
    expect(deleted.preferences.userViews).toEqual([]);
    expect(deleted.preferences.activeViewId).toBe("system:all-active");
  });

  it("persists draft layout state without changing applications or status history", async () => {
    const workspace = await createWorkspace();

    const application = await createApplication(workspace.id, {
      companyName: "View Safety Co",
      role: "Engineer",
      appliedAtLocal: "2026-07-15T09:00",
      status: ApplicationStatus.APPLIED
    });

    const beforeApplication = await prisma.application.findUniqueOrThrow({
      where: { id: application.id }
    });
    const beforeHistoryCount = await prisma.applicationStatusHistory.count({
      where: {
        applicationId: application.id
      }
    });

    const savedDraft = await mutateApplicationsGridPreferences(workspace.id, {
      type: "saveDraft",
      activeViewId: "system:all-active",
      draftState: createApplicationsGridViewState({
        archiveMode: "ALL",
        filterModel: {
          company: {
            filterType: "text",
            type: "contains",
            filter: "View"
          }
        }
      })
    });

    expect(savedDraft.preferences.draftState.archiveMode).toBe("ALL");
    expect(savedDraft.preferences.draftState.filterModel.company).toEqual({
      filterType: "text",
      type: "contains",
      filter: "View"
    });

    const afterApplication = await prisma.application.findUniqueOrThrow({
      where: { id: application.id }
    });
    const afterHistoryCount = await prisma.applicationStatusHistory.count({
      where: {
        applicationId: application.id
      }
    });

    expect(afterApplication.updatedAt.toISOString()).toBe(
      beforeApplication.updatedAt.toISOString()
    );
    expect(afterHistoryCount).toBe(beforeHistoryCount);
  });

  it("falls back safely when malformed persisted data already exists", async () => {
    const workspace = await createWorkspace();

    await prisma.userSetting.create({
      data: {
        workspaceId: workspace.id,
        key: "applicationsGridPreferences",
        value: {
          version: 1,
          activeViewId: "user:missing",
          draftState: {
            version: 1,
            columnState: [{ colId: "missing-column" }],
            filterModel: {
              unknown: {
                filterType: "text",
                type: "equals",
                filter: "bad"
              }
            },
            archiveMode: "BAD",
            quickSearch: null,
            scope: {}
          },
          userViews: [
            {
              id: "user:broken",
              type: "user",
              name: " Broken View ",
              normalizedName: "broken view",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              state: {
                version: 1,
                columnState: [],
                filterModel: {},
                archiveMode: "ACTIVE_ONLY",
                quickSearch: null,
                scope: {}
              }
            }
          ]
        }
      }
    });

    const restored = await getApplicationsGridPreferences(workspace.id);
    expect(restored.warning).toBeDefined();
    expect(restored.preferences.activeViewId).toBe("system:all-active");
    expect(restored.preferences.userViews[0]?.name).toBe("Broken View");
  });
});
