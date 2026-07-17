import { z } from "zod";
import {
  applicationPriorityOptions,
  applicationStatusOptions,
  workArrangementOptions
} from "@/lib/applications/options";

export const applicationsGridPreferencesSettingKey = "applicationsGridPreferences";
export const applicationsGridStateVersion = 1;

export const applicationsGridColumnIds = [
  "detailAction",
  "status",
  "company",
  "role",
  "location",
  "workArrangement",
  "salaryInput",
  "appliedAtInput",
  "jobSearchDateInput",
  "priority",
  "source",
  "archived",
  "createdAt",
  "updatedAt"
] as const;

export type ApplicationsGridColumnId = (typeof applicationsGridColumnIds)[number];

export const applicationsGridArchiveModes = [
  "ACTIVE_ONLY",
  "ARCHIVED_ONLY",
  "ALL"
] as const;

export type ApplicationsGridArchiveMode =
  (typeof applicationsGridArchiveModes)[number];

export const applicationsGridSystemViewIds = [
  "system:all-active",
  "system:applied",
  "system:waiting",
  "system:interviewing",
  "system:rejected",
  "system:archived",
  "system:recently-applied"
] as const;

export type ApplicationsGridSystemViewId =
  (typeof applicationsGridSystemViewIds)[number];

export type ApplicationsGridScope = {
  statuses?: Array<(typeof applicationStatusOptions)[number]>;
  appliedWithinDays?: number;
};

export type PersistedApplicationsGridColumnState = {
  colId: ApplicationsGridColumnId;
  hide?: boolean;
  pinned?: "left" | "right";
  sort?: "asc" | "desc";
  sortIndex?: number;
  width?: number;
};

export type PersistedApplicationsGridFilterModel = Record<
  string,
  Record<string, unknown>
>;

export type ApplicationsGridViewState = {
  version: 1;
  columnState: PersistedApplicationsGridColumnState[];
  filterModel: PersistedApplicationsGridFilterModel;
  archiveMode: ApplicationsGridArchiveMode;
  quickSearch: string | null;
  scope: ApplicationsGridScope;
};

export type ApplicationsGridUserView = {
  id: string;
  type: "user";
  name: string;
  normalizedName: string;
  createdAt: string;
  updatedAt: string;
  state: ApplicationsGridViewState;
};

export type ApplicationsGridPreferencesRecord = {
  version: 1;
  activeViewId: string;
  draftState: ApplicationsGridViewState;
  userViews: ApplicationsGridUserView[];
};

export type ApplicationsGridSystemView = {
  id: ApplicationsGridSystemViewId;
  type: "system";
  name: string;
  description: string;
  state: ApplicationsGridViewState;
};

const applicationsGridColumnIdSchema = z.enum(applicationsGridColumnIds);
const applicationsGridArchiveModeSchema = z.enum(applicationsGridArchiveModes);
const applicationsGridStatusSchema = z.enum(applicationStatusOptions);

const columnStateSchema = z.object({
  colId: applicationsGridColumnIdSchema,
  hide: z.boolean().optional(),
  pinned: z.enum(["left", "right"]).optional(),
  sort: z.enum(["asc", "desc"]).optional(),
  sortIndex: z.number().int().min(0).max(20).optional(),
  width: z.number().int().min(40).max(1200).optional()
});

const filterConditionSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z
    .object({
      filterType: z.enum(["text", "number", "date", "set"]),
      type: z.string().trim().min(1).max(40).optional(),
      filter: z.union([z.string(), z.number(), z.boolean()]).optional(),
      filterTo: z.union([z.string(), z.number(), z.boolean()]).optional(),
      dateFrom: z.string().trim().min(1).max(40).optional(),
      dateTo: z.string().trim().min(1).max(40).optional(),
      values: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
      operator: z.enum(["AND", "OR"]).optional(),
      conditions: z.array(filterConditionSchema).max(10).optional()
    })
    .passthrough()
);

const scopeSchema = z.object({
  statuses: z.array(applicationsGridStatusSchema).max(10).optional(),
  appliedWithinDays: z.number().int().min(1).max(3650).optional()
});

export const applicationsGridViewStateSchema = z.object({
  version: z.literal(applicationsGridStateVersion),
  columnState: z.array(columnStateSchema).max(applicationsGridColumnIds.length),
  filterModel: z.record(z.string(), filterConditionSchema),
  archiveMode: applicationsGridArchiveModeSchema,
  quickSearch: z.string().trim().max(200).nullable(),
  scope: scopeSchema
});

export const applicationsGridUserViewSchema = z.object({
  id: z.string().trim().min(1).max(120),
  type: z.literal("user"),
  name: z.string().trim().min(1).max(60),
  normalizedName: z.string().trim().min(1).max(60),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  state: applicationsGridViewStateSchema
});

export const applicationsGridPreferencesRecordSchema = z.object({
  version: z.literal(applicationsGridStateVersion),
  activeViewId: z.string().trim().min(1).max(120),
  draftState: applicationsGridViewStateSchema,
  userViews: z.array(applicationsGridUserViewSchema).max(50)
});

export const saveApplicationsGridDraftInputSchema = z.object({
  type: z.literal("saveDraft"),
  activeViewId: z.string().trim().min(1).max(120),
  draftState: applicationsGridViewStateSchema
});

export const activateApplicationsGridViewInputSchema = z.object({
  type: z.literal("activate"),
  viewId: z.string().trim().min(1).max(120)
});

export const resetApplicationsGridViewInputSchema = z.object({
  type: z.literal("reset"),
  viewId: z.string().trim().min(1).max(120)
});

export const createApplicationsGridViewInputSchema = z.object({
  type: z.literal("create"),
  name: z.string().trim().min(1).max(60),
  state: applicationsGridViewStateSchema
});

export const saveAsApplicationsGridViewInputSchema = z.object({
  type: z.literal("saveAs"),
  name: z.string().trim().min(1).max(60),
  state: applicationsGridViewStateSchema
});

export const renameApplicationsGridViewInputSchema = z.object({
  type: z.literal("rename"),
  viewId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(60)
});

export const updateApplicationsGridViewInputSchema = z.object({
  type: z.literal("update"),
  viewId: z.string().trim().min(1).max(120),
  state: applicationsGridViewStateSchema
});

export const deleteApplicationsGridViewInputSchema = z.object({
  type: z.literal("delete"),
  viewId: z.string().trim().min(1).max(120)
});

export const applicationsGridPreferencesCommandSchema = z.discriminatedUnion("type", [
  saveApplicationsGridDraftInputSchema,
  activateApplicationsGridViewInputSchema,
  resetApplicationsGridViewInputSchema,
  createApplicationsGridViewInputSchema,
  saveAsApplicationsGridViewInputSchema,
  renameApplicationsGridViewInputSchema,
  updateApplicationsGridViewInputSchema,
  deleteApplicationsGridViewInputSchema
]);

export type ApplicationsGridPreferencesCommand = z.infer<
  typeof applicationsGridPreferencesCommandSchema
>;

export function normalizeApplicationsGridViewName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function buildDefaultApplicationsGridColumnState(): PersistedApplicationsGridColumnState[] {
  return applicationsGridColumnIds.map((colId) =>
    colId === "appliedAtInput"
      ? {
          colId,
          sort: "desc",
          sortIndex: 0
        }
      : { colId }
  );
}

export function createApplicationsGridViewState(
  overrides?: Partial<ApplicationsGridViewState>
): ApplicationsGridViewState {
  return {
    version: applicationsGridStateVersion,
    columnState: buildDefaultApplicationsGridColumnState(),
    filterModel: {},
    archiveMode: "ACTIVE_ONLY",
    quickSearch: null,
    scope: {},
    ...overrides
  };
}

function isKnownColumnId(value: string): value is ApplicationsGridColumnId {
  return applicationsGridColumnIds.includes(value as ApplicationsGridColumnId);
}

function sanitizeEnumFilterValue(
  colId: string,
  value: string
): string | null {
  if (colId === "status") {
    return applicationStatusOptions.includes(value as (typeof applicationStatusOptions)[number])
      ? value
      : null;
  }

  if (colId === "priority") {
    return applicationPriorityOptions.includes(
      value as (typeof applicationPriorityOptions)[number]
    )
      ? value
      : null;
  }

  if (colId === "workArrangement") {
    return workArrangementOptions.includes(
      value as (typeof workArrangementOptions)[number]
    )
      ? value
      : null;
  }

  return value;
}

function sanitizeFilterCondition(
  colId: string,
  value: unknown
): Record<string, unknown> | null {
  const parsed = filterConditionSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  const result = { ...parsed.data };
  if (Array.isArray(result.conditions)) {
    const conditions = result.conditions
      .map((condition) => sanitizeFilterCondition(colId, condition))
      .filter((condition): condition is Record<string, unknown> => Boolean(condition));

    if (conditions.length === 0) {
      return null;
    }

    result.conditions = conditions;
  }

  if (Array.isArray(result.values)) {
    const values = result.values
      .map((entry) => sanitizeEnumFilterValue(colId, entry))
      .filter((entry): entry is string => Boolean(entry));

    if (values.length === 0) {
      return null;
    }

    result.values = values;
  }

  if (
    typeof result.filter === "string" &&
    ["status", "priority", "workArrangement"].includes(colId) &&
    result.type &&
    ["equals", "notEqual"].includes(String(result.type))
  ) {
    const sanitized = sanitizeEnumFilterValue(colId, result.filter);
    if (!sanitized) {
      return null;
    }

    result.filter = sanitized;
  }

  return result;
}

export function sanitizeApplicationsGridFilterModel(
  value: unknown
): PersistedApplicationsGridFilterModel {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const sanitizedEntries = Object.entries(value).flatMap(([colId, filterValue]) => {
    if (!isKnownColumnId(colId) || colId === "detailAction") {
      return [];
    }

    const sanitized = sanitizeFilterCondition(colId, filterValue);
    return sanitized ? ([[colId, sanitized]] as const) : [];
  });

  return Object.fromEntries(sanitizedEntries);
}

export function sanitizeApplicationsGridColumnState(
  value: unknown
): PersistedApplicationsGridColumnState[] {
  const input = Array.isArray(value) ? value : [];
  const seen = new Set<ApplicationsGridColumnId>();
  const sanitized: PersistedApplicationsGridColumnState[] = [];

  for (const valueEntry of input) {
    if (!valueEntry || typeof valueEntry !== "object" || Array.isArray(valueEntry)) {
      continue;
    }

    const source = valueEntry as Record<string, unknown>;
    const parsedEntry = columnStateSchema.safeParse({
      colId: source.colId,
      hide: typeof source.hide === "boolean" ? source.hide : undefined,
      pinned:
        source.pinned === "left" || source.pinned === "right" ? source.pinned : undefined,
      sort: source.sort === "asc" || source.sort === "desc" ? source.sort : undefined,
      sortIndex:
        typeof source.sortIndex === "number" &&
        Number.isInteger(source.sortIndex) &&
        source.sortIndex >= 0 &&
        source.sortIndex <= 20
          ? source.sortIndex
          : undefined,
      width:
        typeof source.width === "number" &&
        Number.isInteger(source.width) &&
        source.width >= 40 &&
        source.width <= 1200
          ? source.width
          : undefined
    });

    if (!parsedEntry.success) {
      continue;
    }

    const entry = parsedEntry.data;
    if (seen.has(entry.colId)) {
      continue;
    }

    seen.add(entry.colId);
    sanitized.push(entry);
  }

  for (const colId of applicationsGridColumnIds) {
    if (!seen.has(colId)) {
      sanitized.push({ colId });
    }
  }

  return sanitized;
}

export function sanitizeApplicationsGridViewState(
  value: unknown
): ApplicationsGridViewState {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const scopeValue =
    source.scope && typeof source.scope === "object" && !Array.isArray(source.scope)
      ? (source.scope as Record<string, unknown>)
      : {};
  const archiveMode = applicationsGridArchiveModeSchema.safeParse(source.archiveMode);
  const statuses = Array.isArray(scopeValue.statuses)
    ? scopeValue.statuses.filter((status) =>
        applicationStatusOptions.includes(
          status as (typeof applicationStatusOptions)[number]
        )
      )
    : undefined;
  const appliedWithinDays =
    typeof scopeValue.appliedWithinDays === "number" &&
    Number.isInteger(scopeValue.appliedWithinDays) &&
    scopeValue.appliedWithinDays >= 1 &&
    scopeValue.appliedWithinDays <= 3650
      ? scopeValue.appliedWithinDays
      : undefined;

  return {
    version: applicationsGridStateVersion,
    columnState: sanitizeApplicationsGridColumnState(source.columnState),
    filterModel: sanitizeApplicationsGridFilterModel(source.filterModel),
    archiveMode: archiveMode.success ? archiveMode.data : "ACTIVE_ONLY",
    quickSearch:
      typeof source.quickSearch === "string" && source.quickSearch.trim()
        ? source.quickSearch.trim()
        : null,
    scope: scopeSchema.parse({
      statuses,
      appliedWithinDays
    })
  };
}

export function buildApplicationsGridSystemViews(): ApplicationsGridSystemView[] {
  return [
    {
      id: "system:all-active",
      type: "system",
      name: "All Active",
      description: "All non-archived applications.",
      state: createApplicationsGridViewState({
        archiveMode: "ACTIVE_ONLY"
      })
    },
    {
      id: "system:applied",
      type: "system",
      name: "Applied",
      description: "Submitted applications that are not archived.",
      state: createApplicationsGridViewState({
        archiveMode: "ACTIVE_ONLY",
        scope: {
          statuses: ["APPLIED"]
        }
      })
    },
    {
      id: "system:waiting",
      type: "system",
      name: "Waiting",
      description: "Applications waiting for employer action.",
      state: createApplicationsGridViewState({
        archiveMode: "ACTIVE_ONLY",
        scope: {
          statuses: ["APPLIED", "IN_PROGRESS"]
        }
      })
    },
    {
      id: "system:interviewing",
      type: "system",
      name: "Interviewing",
      description: "Applications currently in interview stages.",
      state: createApplicationsGridViewState({
        archiveMode: "ACTIVE_ONLY",
        scope: {
          statuses: ["INTERVIEW"]
        }
      })
    },
    {
      id: "system:rejected",
      type: "system",
      name: "Rejected",
      description: "Rejected applications that are still visible.",
      state: createApplicationsGridViewState({
        archiveMode: "ACTIVE_ONLY",
        scope: {
          statuses: ["REJECTED"]
        }
      })
    },
    {
      id: "system:archived",
      type: "system",
      name: "Archived",
      description: "Archived applications regardless of status.",
      state: createApplicationsGridViewState({
        archiveMode: "ARCHIVED_ONLY"
      })
    },
    {
      id: "system:recently-applied",
      type: "system",
      name: "Recently Applied",
      description: "Applications from the last 14 job-search days.",
      state: createApplicationsGridViewState({
        archiveMode: "ACTIVE_ONLY",
        scope: {
          appliedWithinDays: 14
        }
      })
    }
  ];
}

export function getApplicationsGridSystemView(
  viewId: string
): ApplicationsGridSystemView | null {
  return buildApplicationsGridSystemViews().find((view) => view.id === viewId) ?? null;
}

export function createDefaultApplicationsGridPreferencesRecord(): ApplicationsGridPreferencesRecord {
  const defaultView = getApplicationsGridSystemView("system:all-active");
  const draftState = defaultView?.state ?? createApplicationsGridViewState();

  return {
    version: applicationsGridStateVersion,
    activeViewId: defaultView?.id ?? "system:all-active",
    draftState,
    userViews: []
  };
}

export function sanitizeApplicationsGridPreferencesRecord(
  value: unknown
): ApplicationsGridPreferencesRecord {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const userViewsInput = Array.isArray(source.userViews) ? source.userViews : [];
  const userViews = userViewsInput.flatMap((viewValue) => {
    if (!viewValue || typeof viewValue !== "object" || Array.isArray(viewValue)) {
      return [];
    }

    const view = viewValue as Record<string, unknown>;
    const id = typeof view.id === "string" ? view.id.trim() : "";
    const name = typeof view.name === "string" ? view.name.trim() : "";
    const type = view.type === "user" ? "user" : null;
    const createdAt = typeof view.createdAt === "string" ? view.createdAt : "";
    const updatedAt = typeof view.updatedAt === "string" ? view.updatedAt : "";

    if (!id || !name || !type) {
      return [];
    }

    return [
      {
        id,
        type: "user" as const,
        name,
        normalizedName: normalizeApplicationsGridViewName(name),
        createdAt:
          z.string().datetime().safeParse(createdAt).success
            ? createdAt
            : new Date().toISOString(),
        updatedAt:
          z.string().datetime().safeParse(updatedAt).success
            ? updatedAt
            : new Date().toISOString(),
        state: sanitizeApplicationsGridViewState(view.state)
      }
    ];
  });

  const activeViewIdInput =
    typeof source.activeViewId === "string" ? source.activeViewId.trim() : "";
  const activeUserViewExists = userViews.some((view) => view.id === activeViewIdInput);
  const activeSystemViewExists = Boolean(getApplicationsGridSystemView(activeViewIdInput));
  const activeViewId =
    activeUserViewExists || activeSystemViewExists
      ? activeViewIdInput
      : "system:all-active";

  return {
    version: applicationsGridStateVersion,
    activeViewId,
    draftState: sanitizeApplicationsGridViewState(source.draftState),
    userViews
  };
}

export function serializeApplicationsGridStateForComparison(
  state: ApplicationsGridViewState
) {
  const normalized = sanitizeApplicationsGridViewState(state);
  return JSON.stringify({
    ...normalized,
    filterModel: Object.fromEntries(
      Object.entries(normalized.filterModel).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    )
  });
}

export function isSystemApplicationsGridViewId(
  viewId: string
): viewId is ApplicationsGridSystemViewId {
  return applicationsGridSystemViewIds.includes(
    viewId as ApplicationsGridSystemViewId
  );
}

export function getReservedApplicationsGridViewNames() {
  return new Set(
    buildApplicationsGridSystemViews().map((view) =>
      normalizeApplicationsGridViewName(view.name)
    )
  );
}
