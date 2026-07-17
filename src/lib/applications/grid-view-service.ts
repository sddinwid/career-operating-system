import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applicationsGridPreferencesSettingKey,
  applicationsGridPreferencesRecordSchema,
  type ApplicationsGridPreferencesCommand,
  type ApplicationsGridPreferencesRecord,
  type ApplicationsGridUserView,
  createDefaultApplicationsGridPreferencesRecord,
  getApplicationsGridSystemView,
  getReservedApplicationsGridViewNames,
  isSystemApplicationsGridViewId,
  normalizeApplicationsGridViewName,
  sanitizeApplicationsGridPreferencesRecord,
  sanitizeApplicationsGridViewState
} from "@/lib/applications/grid-view-state";

export class ApplicationsGridPreferencesError extends Error {}

export type ApplicationsGridPreferencesLoadResult = {
  preferences: ApplicationsGridPreferencesRecord;
  warning?: string;
};

async function writeApplicationsGridPreferences(
  workspaceId: string,
  preferences: ApplicationsGridPreferencesRecord
) {
  await prisma.userSetting.upsert({
    where: {
      workspaceId_key: {
        workspaceId,
        key: applicationsGridPreferencesSettingKey
      }
    },
    update: {
      value: preferences as Prisma.InputJsonValue
    },
    create: {
      workspaceId,
      key: applicationsGridPreferencesSettingKey,
      value: preferences as Prisma.InputJsonValue
    }
  });
}

function assertViewNameAvailable(
  preferences: ApplicationsGridPreferencesRecord,
  name: string,
  excludeViewId?: string
) {
  const normalizedName = normalizeApplicationsGridViewName(name);
  if (!normalizedName) {
    throw new ApplicationsGridPreferencesError("View name is required.");
  }

  if (getReservedApplicationsGridViewNames().has(normalizedName)) {
    throw new ApplicationsGridPreferencesError(
      "That view name is reserved for a system view."
    );
  }

  const duplicate = preferences.userViews.find(
    (view) =>
      view.id !== excludeViewId && view.normalizedName === normalizedName
  );

  if (duplicate) {
    throw new ApplicationsGridPreferencesError(
      "A view with that name already exists."
    );
  }

  return normalizedName;
}

function getUserViewOrThrow(
  preferences: ApplicationsGridPreferencesRecord,
  viewId: string
) {
  const userView = preferences.userViews.find((view) => view.id === viewId);
  if (!userView) {
    throw new ApplicationsGridPreferencesError("The selected saved view was not found.");
  }

  return userView;
}

export async function getApplicationsGridPreferences(
  workspaceId: string
): Promise<ApplicationsGridPreferencesLoadResult> {
  const record = await prisma.userSetting.findUnique({
    where: {
      workspaceId_key: {
        workspaceId,
        key: applicationsGridPreferencesSettingKey
      }
    }
  });

  if (!record) {
    return {
      preferences: createDefaultApplicationsGridPreferencesRecord()
    };
  }

  const sanitized = sanitizeApplicationsGridPreferencesRecord(record.value);
  const warning = applicationsGridPreferencesRecordSchema.safeParse(record.value).success
    ? undefined
    : "Saved grid preferences were partially invalid and safe defaults were used.";

  return {
    preferences: sanitized,
    warning
  };
}

export async function mutateApplicationsGridPreferences(
  workspaceId: string,
  command: ApplicationsGridPreferencesCommand
): Promise<ApplicationsGridPreferencesLoadResult> {
  const current = await getApplicationsGridPreferences(workspaceId);
  const preferences = current.preferences;

  switch (command.type) {
    case "saveDraft": {
      const activeViewId = command.activeViewId;
      if (
        !preferences.userViews.some((view) => view.id === activeViewId) &&
        !isSystemApplicationsGridViewId(activeViewId)
      ) {
        throw new ApplicationsGridPreferencesError("The active view is invalid.");
      }

      const nextPreferences = sanitizeApplicationsGridPreferencesRecord({
        ...preferences,
        activeViewId,
        draftState: sanitizeApplicationsGridViewState(command.draftState)
      });
      await writeApplicationsGridPreferences(workspaceId, nextPreferences);
      return { preferences: nextPreferences };
    }
    case "activate": {
      const systemView = getApplicationsGridSystemView(command.viewId);
      const userView = preferences.userViews.find((view) => view.id === command.viewId);

      if (!systemView && !userView) {
        throw new ApplicationsGridPreferencesError("The selected view was not found.");
      }

      const draftState = sanitizeApplicationsGridViewState(
        systemView?.state ?? userView?.state
      );
      const nextPreferences = sanitizeApplicationsGridPreferencesRecord({
        ...preferences,
        activeViewId: command.viewId,
        draftState
      });
      await writeApplicationsGridPreferences(workspaceId, nextPreferences);
      return { preferences: nextPreferences };
    }
    case "reset": {
      const systemView = getApplicationsGridSystemView(command.viewId);
      const userView = preferences.userViews.find((view) => view.id === command.viewId);

      if (!systemView && !userView) {
        throw new ApplicationsGridPreferencesError("The selected view was not found.");
      }

      const nextPreferences = sanitizeApplicationsGridPreferencesRecord({
        ...preferences,
        activeViewId: command.viewId,
        draftState: sanitizeApplicationsGridViewState(
          systemView?.state ?? userView?.state
        )
      });
      await writeApplicationsGridPreferences(workspaceId, nextPreferences);
      return { preferences: nextPreferences };
    }
    case "create":
    case "saveAs": {
      const normalizedName = assertViewNameAvailable(preferences, command.name);
      const timestamp = new Date().toISOString();
      const view: ApplicationsGridUserView = {
        id: `user:${randomUUID()}`,
        type: "user",
        name: command.name.trim(),
        normalizedName,
        createdAt: timestamp,
        updatedAt: timestamp,
        state: sanitizeApplicationsGridViewState(command.state)
      };
      const nextPreferences = sanitizeApplicationsGridPreferencesRecord({
        ...preferences,
        activeViewId: view.id,
        draftState: view.state,
        userViews: [...preferences.userViews, view]
      });
      await writeApplicationsGridPreferences(workspaceId, nextPreferences);
      return { preferences: nextPreferences };
    }
    case "rename": {
      if (isSystemApplicationsGridViewId(command.viewId)) {
        throw new ApplicationsGridPreferencesError("System views cannot be renamed.");
      }

      const normalizedName = assertViewNameAvailable(
        preferences,
        command.name,
        command.viewId
      );
      const nextPreferences = sanitizeApplicationsGridPreferencesRecord({
        ...preferences,
        userViews: preferences.userViews.map((view) =>
          view.id === command.viewId
            ? {
                ...view,
                name: command.name.trim(),
                normalizedName,
                updatedAt: new Date().toISOString()
              }
            : view
        )
      });
      await writeApplicationsGridPreferences(workspaceId, nextPreferences);
      return { preferences: nextPreferences };
    }
    case "update": {
      if (isSystemApplicationsGridViewId(command.viewId)) {
        throw new ApplicationsGridPreferencesError("System views cannot be updated directly.");
      }

      getUserViewOrThrow(preferences, command.viewId);
      const nextState = sanitizeApplicationsGridViewState(command.state);
      const nextPreferences = sanitizeApplicationsGridPreferencesRecord({
        ...preferences,
        draftState:
          preferences.activeViewId === command.viewId
            ? nextState
            : preferences.draftState,
        userViews: preferences.userViews.map((view) =>
          view.id === command.viewId
            ? {
                ...view,
                state: nextState,
                updatedAt: new Date().toISOString()
              }
            : view
        )
      });
      await writeApplicationsGridPreferences(workspaceId, nextPreferences);
      return { preferences: nextPreferences };
    }
    case "delete": {
      if (isSystemApplicationsGridViewId(command.viewId)) {
        throw new ApplicationsGridPreferencesError("System views cannot be deleted.");
      }

      getUserViewOrThrow(preferences, command.viewId);
      const remainingViews = preferences.userViews.filter(
        (view) => view.id !== command.viewId
      );
      const fallbackView = getApplicationsGridSystemView("system:all-active");
      const nextPreferences = sanitizeApplicationsGridPreferencesRecord({
        ...preferences,
        activeViewId:
          preferences.activeViewId === command.viewId
            ? "system:all-active"
            : preferences.activeViewId,
        draftState:
          preferences.activeViewId === command.viewId
            ? fallbackView?.state ?? createDefaultApplicationsGridPreferencesRecord().draftState
            : preferences.draftState,
        userViews: remainingViews
      });
      await writeApplicationsGridPreferences(workspaceId, nextPreferences);
      return { preferences: nextPreferences };
    }
  }
}
