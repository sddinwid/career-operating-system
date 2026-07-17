"use client";

import {
  forwardRef,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CellClassParams,
  ColumnMovedEvent,
  ColumnResizedEvent,
  ColumnVisibleEvent,
  CellEditRequestEvent,
  ColDef,
  FilterChangedEvent,
  GridApi,
  GridOptions,
  GridReadyEvent,
  ICellRendererParams,
  SortChangedEvent
} from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import {
  AgGridReact,
  type CustomCellEditorProps,
  useGridCellEditor
} from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import {
  applicationPriorityOptions,
  applicationStatusOptions,
  defaultTimeZoneLabel,
  workArrangementOptions
} from "@/lib/applications/options";
import {
  formatApplicationDate,
  formatApplicationDateTime,
  formatSalaryRange,
  formatWorkArrangement
} from "@/lib/applications/formatters";
import {
  type ApplicationsGridArchiveMode,
  type ApplicationsGridPreferencesCommand,
  type ApplicationsGridPreferencesRecord,
  type ApplicationsGridScope,
  buildApplicationsGridSystemViews,
  createApplicationsGridViewState,
  getApplicationsGridSystemView,
  isSystemApplicationsGridViewId,
  sanitizeApplicationsGridViewState,
  serializeApplicationsGridStateForComparison
} from "@/lib/applications/grid-view-state";
import {
  type ApplicationGridMutationResult,
  type ApplicationGridRow,
  type EditableApplicationGridField
} from "@/lib/applications/grid";

ModuleRegistry.registerModules([AllCommunityModule]);

type ApplicationsGridProps = {
  applications: ApplicationGridRow[];
  initialPreferences: ApplicationsGridPreferencesRecord;
  initialPreferencesWarning?: string;
  success?: string;
};

type SaveState = {
  tone: "saving" | "success" | "error";
  message: string;
};

type ViewStateMessage = {
  tone: "success" | "error" | "warning";
  message: string;
};

type CellSaveStatus = {
  tone: "saving" | "success" | "error";
  message: string;
};

type ApplicationsGridPreferencesResponse =
  | {
      ok: true;
      preferences: ApplicationsGridPreferencesRecord;
      warning?: string;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

type DetailButtonRendererParams = ICellRendererParams<ApplicationGridRow> & {
  onOpenDetail: (applicationId: string) => void;
};

const editableFieldByColumn: Partial<
  Record<keyof ApplicationGridRow | "detailAction", EditableApplicationGridField>
> = {
  status: "status",
  priority: "priority",
  source: "source",
  location: "location",
  workArrangement: "workArrangement",
  salaryInput: "salary",
  appliedAtInput: "appliedAt",
  jobSearchDateInput: "jobSearchDate",
  company: "company",
  role: "role"
};

const editableColumns = new Set<keyof typeof editableFieldByColumn>(
  Object.keys(editableFieldByColumn) as Array<keyof typeof editableFieldByColumn>
);

function SuccessBanner({ success }: { success?: string }) {
  if (!success) {
    return null;
  }

  const messages: Record<string, string> = {
    archived: "Application archived. Archived records are hidden by default.",
    restored: "Application restored.",
    created: "Application saved.",
    updated: "Application updated."
  };

  const message = messages[success];
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      {message}
    </div>
  );
}

function formatNullableText(value: string | null | undefined) {
  return value?.trim() ? value : "Not set";
}

function formatAppliedAtValue(row: ApplicationGridRow) {
  if (!row.appliedAt) {
    return "Not set";
  }

  return row.appliedAtPrecision === "DATE_ONLY"
    ? formatApplicationDate(new Date(row.appliedAt))
    : formatApplicationDateTime(new Date(row.appliedAt), defaultTimeZoneLabel);
}

function formatDateValue(value: string | null | undefined) {
  return value ? formatApplicationDate(new Date(value)) : "Not set";
}

function dateComparator(left: string | null, right: string | null) {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return -1;
  }

  if (!right) {
    return 1;
  }

  return new Date(left).getTime() - new Date(right).getTime();
}

function booleanComparator(left: boolean, right: boolean) {
  return Number(left) - Number(right);
}

function normalizeComparableValue(
  field: EditableApplicationGridField,
  value: string | null | undefined
) {
  const trimmed = value?.trim() ?? "";

  switch (field) {
    case "status":
    case "priority":
    case "workArrangement":
      return trimmed.toUpperCase();
    case "salary":
      return trimmed.replace(/\s+/g, " ").toLowerCase();
    default:
      return trimmed;
  }
}

function getCurrentFieldValue(
  row: ApplicationGridRow,
  field: EditableApplicationGridField
) {
  switch (field) {
    case "status":
      return row.status;
    case "priority":
      return row.priority ?? "";
    case "source":
      return row.source ?? "";
    case "location":
      return row.location ?? "";
    case "workArrangement":
      return row.workArrangement ?? "";
    case "salary":
      return row.salaryInput;
    case "appliedAt":
      return row.appliedAtInput;
    case "jobSearchDate":
      return row.jobSearchDateInput;
    case "company":
      return row.company;
    case "role":
      return row.role;
  }
}

function isSameEditValue(
  row: ApplicationGridRow,
  field: EditableApplicationGridField,
  nextValue: string | null
) {
  return (
    normalizeComparableValue(field, getCurrentFieldValue(row, field)) ===
    normalizeComparableValue(field, nextValue)
  );
}

function buildCellStatusKey(applicationId: string, field: string) {
  return `${applicationId}:${field}`;
}

async function updateApplicationGridFieldRequest(args: {
  applicationId: string;
  field: EditableApplicationGridField;
  value: string | null;
}) {
  const response = await fetch(`/api/applications/${args.applicationId}/grid-field`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      field: args.field,
      value: args.value
    })
  });

  return (await response.json()) as ApplicationGridMutationResult;
}

async function updateApplicationsGridPreferencesRequest(
  command: ApplicationsGridPreferencesCommand
) {
  const response = await fetch("/api/applications/views", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(command)
  });

  return (await response.json()) as ApplicationsGridPreferencesResponse;
}

function serializeScope(scope: ApplicationsGridScope) {
  return JSON.stringify({
    statuses: [...(scope.statuses ?? [])].sort(),
    appliedWithinDays: scope.appliedWithinDays ?? null
  });
}

function normalizeArchiveModeLabel(value: ApplicationsGridArchiveMode) {
  switch (value) {
    case "ACTIVE_ONLY":
      return "Active only";
    case "ARCHIVED_ONLY":
      return "Archived only";
    case "ALL":
      return "All records";
  }
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function isWithinRecentDays(value: string | null | undefined, days: number) {
  const appliedDate = parseDateOnly(value);
  if (!appliedDate) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const earliest = new Date(today);
  earliest.setDate(today.getDate() - (days - 1));

  return appliedDate >= earliest && appliedDate <= today;
}

export const TextCellEditor = forwardRef<
  object,
  CustomCellEditorProps<ApplicationGridRow, string> & { inputType?: string }
>(function TextCellEditor(props, _ref) {
  const [value, setValue] = useState(String(props.value ?? ""));
  const cancelAfterEndRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useGridCellEditor({
    isCancelAfterEnd: () => cancelAfterEndRef.current
  });

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      aria-label={`${props.column.getColDef().headerName ?? "Cell"} editor`}
      className="h-full w-full border-0 bg-white px-3 text-sm text-stone-900 outline-none"
      onBlur={() => {
        if (!cancelAfterEndRef.current) {
          props.stopEditing();
        }
      }}
      onChange={(event) => {
        const nextValue = event.target.value;
        cancelAfterEndRef.current = false;
        setValue(nextValue);
        props.onValueChange(nextValue);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          cancelAfterEndRef.current = true;
          event.preventDefault();
          event.stopPropagation();
          props.stopEditing();
          return;
        }

        if (event.key === "Enter" || event.key === "Tab") {
          cancelAfterEndRef.current = false;
          props.stopEditing();
          return;
        }

        event.stopPropagation();
      }}
      ref={inputRef}
      type={props.inputType ?? "text"}
      value={value}
    />
  );
});

export const SelectCellEditor = forwardRef<
  object,
  CustomCellEditorProps<ApplicationGridRow, string> & {
    options: string[];
    emptyLabel?: string;
  }
>(function SelectCellEditor(props, _ref) {
  const [value, setValue] = useState(String(props.value ?? ""));
  const cancelAfterEndRef = useRef(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useGridCellEditor({
    isCancelAfterEnd: () => cancelAfterEndRef.current
  });

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  return (
    <select
      aria-label={`${props.column.getColDef().headerName ?? "Cell"} editor`}
      className="h-full w-full border-0 bg-white px-3 text-sm text-stone-900 outline-none"
      onChange={(event) => {
        const nextValue = event.target.value;
        cancelAfterEndRef.current = false;
        setValue(nextValue);
        props.onValueChange(nextValue);
        props.stopEditing();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          cancelAfterEndRef.current = true;
          event.preventDefault();
          event.stopPropagation();
          props.stopEditing();
          return;
        }

        event.stopPropagation();
      }}
      ref={selectRef}
      value={value}
    >
      {props.options.map((option) => (
        <option key={option || "__empty__"} value={option}>
          {option || props.emptyLabel || "Not set"}
        </option>
      ))}
    </select>
  );
});

function DetailButtonRenderer({
  data,
  onOpenDetail
}: DetailButtonRendererParams) {
  if (!data?.id) {
    return null;
  }

  return (
    <button
      className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenDetail(data.id);
      }}
      type="button"
    >
      Open
    </button>
  );
}

type BuildColumnDefsArgs = {
  getCellTone: (applicationId: string, field: string) => CellSaveStatus["tone"] | null;
  onOpenDetail: (applicationId: string) => void;
};

export function buildApplicationsGridColumnDefs({
  getCellTone,
  onOpenDetail
}: BuildColumnDefsArgs): ColDef<ApplicationGridRow>[] {
  const editableCellClass = (params: CellClassParams<ApplicationGridRow>) => {
    const applicationId = params.data?.id;
    const field = params.colDef.field;
    const classes = ["cos-grid-cell"];

    if (field && editableColumns.has(field as keyof typeof editableFieldByColumn)) {
      classes.push("cos-grid-cell-editable");
    }

    if (applicationId && field) {
      const tone = getCellTone(applicationId, field);
      if (tone) {
        classes.push(`cos-grid-cell-${tone}`);
      }
    }

    return classes.join(" ");
  };

  return [
    {
      colId: "detailAction",
      headerName: "Detail",
      editable: false,
      filter: false,
      sortable: false,
      resizable: false,
      pinned: undefined,
      width: 96,
      minWidth: 96,
      maxWidth: 110,
      cellRenderer: DetailButtonRenderer,
      cellRendererParams: {
        onOpenDetail
      }
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1.1,
      minWidth: 140,
      editable: true,
      cellEditor: SelectCellEditor,
      cellEditorParams: {
        options: [...applicationStatusOptions]
      },
      cellClass: editableCellClass,
      getQuickFilterText: () => ""
    },
    {
      field: "company",
      headerName: "Company",
      flex: 1.3,
      minWidth: 180,
      editable: true,
      cellEditor: TextCellEditor,
      cellClass: editableCellClass,
      getQuickFilterText: ({ value }) => String(value ?? "")
    },
    {
      field: "role",
      headerName: "Role",
      flex: 1.6,
      minWidth: 220,
      editable: true,
      cellEditor: TextCellEditor,
      cellClass: editableCellClass,
      getQuickFilterText: ({ value }) => String(value ?? "")
    },
    {
      field: "location",
      headerName: "Location",
      flex: 1.2,
      minWidth: 160,
      editable: true,
      cellEditor: TextCellEditor,
      cellClass: editableCellClass,
      valueFormatter: ({ value }) => formatNullableText(value),
      getQuickFilterText: ({ data }) => data?.location ?? ""
    },
    {
      field: "workArrangement",
      headerName: "Work Arrangement",
      flex: 1.1,
      minWidth: 170,
      editable: true,
      cellEditor: SelectCellEditor,
      cellEditorParams: {
        options: ["", ...workArrangementOptions],
        emptyLabel: "Not set"
      },
      cellClass: editableCellClass,
      valueFormatter: ({ value }) => formatWorkArrangement(value ?? null),
      getQuickFilterText: () => ""
    },
    {
      field: "salaryInput",
      headerName: "Salary",
      flex: 1.1,
      minWidth: 170,
      editable: true,
      cellEditor: TextCellEditor,
      cellClass: editableCellClass,
      comparator: (_left, _right, nodeLeft, nodeRight) =>
        dateComparator(
          nodeLeft.data
            ? `${nodeLeft.data.salaryMin ?? ""}|${nodeLeft.data.salaryMax ?? ""}`
            : null,
          nodeRight.data
            ? `${nodeRight.data.salaryMin ?? ""}|${nodeRight.data.salaryMax ?? ""}`
            : null
        ),
      valueFormatter: ({ data }) =>
        data
          ? formatSalaryRange(data.salaryMin, data.salaryMax, data.salaryCurrency)
          : "Not set",
      getQuickFilterText: () => ""
    },
    {
      field: "appliedAtInput",
      headerName: "Applied Date",
      flex: 1.2,
      minWidth: 180,
      editable: true,
      cellEditor: TextCellEditor,
      cellEditorParams: (params: { data?: ApplicationGridRow }) => ({
        inputType: params.data?.appliedAtPrecision === "DATE_ONLY" ? "date" : "datetime-local"
      }),
      sort: "desc",
      cellClass: editableCellClass,
      comparator: (_left, _right, nodeLeft, nodeRight) =>
        dateComparator(nodeLeft.data?.appliedAt ?? null, nodeRight.data?.appliedAt ?? null),
      valueFormatter: ({ data }) => (data ? formatAppliedAtValue(data) : "Not set"),
      getQuickFilterText: () => ""
    },
    {
      field: "jobSearchDateInput",
      headerName: "Job Search Date",
      flex: 1.1,
      minWidth: 170,
      editable: true,
      cellEditor: TextCellEditor,
      cellEditorParams: {
        inputType: "date"
      },
      cellClass: editableCellClass,
      comparator: (_left, _right, nodeLeft, nodeRight) =>
        dateComparator(
          nodeLeft.data?.jobSearchDate ?? null,
          nodeRight.data?.jobSearchDate ?? null
        ),
      valueFormatter: ({ data }) =>
        data ? formatDateValue(data.jobSearchDate) : "Not set",
      getQuickFilterText: () => ""
    },
    {
      field: "priority",
      headerName: "Priority",
      flex: 0.9,
      minWidth: 130,
      editable: true,
      cellEditor: SelectCellEditor,
      cellEditorParams: {
        options: ["", ...applicationPriorityOptions],
        emptyLabel: "Not set"
      },
      cellClass: editableCellClass,
      valueFormatter: ({ value }) => formatNullableText(value),
      getQuickFilterText: () => ""
    },
    {
      field: "source",
      headerName: "Source",
      flex: 1.1,
      minWidth: 150,
      editable: true,
      cellEditor: TextCellEditor,
      cellClass: editableCellClass,
      valueFormatter: ({ value }) => formatNullableText(value),
      getQuickFilterText: ({ data }) => data?.source ?? ""
    },
    {
      field: "archived",
      headerName: "Archived",
      flex: 0.8,
      minWidth: 120,
      editable: false,
      comparator: booleanComparator,
      valueFormatter: ({ value }) => (value ? "Yes" : "No"),
      cellClass: editableCellClass,
      getQuickFilterText: () => ""
    },
    {
      field: "createdAt",
      headerName: "Created",
      flex: 1.2,
      minWidth: 180,
      editable: false,
      comparator: (_left, _right, nodeLeft, nodeRight) =>
        dateComparator(nodeLeft.data?.createdAt ?? null, nodeRight.data?.createdAt ?? null),
      valueFormatter: ({ value }) =>
        value
          ? formatApplicationDateTime(new Date(value), defaultTimeZoneLabel)
          : "Not set",
      cellClass: editableCellClass,
      getQuickFilterText: () => ""
    },
    {
      field: "updatedAt",
      headerName: "Updated",
      flex: 1.2,
      minWidth: 180,
      editable: false,
      comparator: (_left, _right, nodeLeft, nodeRight) =>
        dateComparator(nodeLeft.data?.updatedAt ?? null, nodeRight.data?.updatedAt ?? null),
      valueFormatter: ({ value }) =>
        value
          ? formatApplicationDateTime(new Date(value), defaultTimeZoneLabel)
          : "Not set",
      cellClass: editableCellClass,
      getQuickFilterText: () => ""
    }
  ];
}

export function ApplicationsGrid({
  applications,
  initialPreferences,
  initialPreferencesWarning,
  success
}: ApplicationsGridProps) {
  const systemViews = useMemo(() => buildApplicationsGridSystemViews(), []);
  const router = useRouter();
  const gridApiRef = useRef<GridApi<ApplicationGridRow> | null>(null);
  const cellStatusesRef = useRef<Record<string, CellSaveStatus>>({});
  const requestVersionRef = useRef<Record<string, number>>({});
  const preferencesRef = useRef(initialPreferences);
  const isApplyingViewStateRef = useRef(false);
  const draftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveRequestIdRef = useRef(0);
  const externalFilterStateRef = useRef<{
    archiveMode: ApplicationsGridArchiveMode;
    scope: ApplicationsGridScope;
  }>({
    archiveMode: initialPreferences.draftState.archiveMode,
    scope: initialPreferences.draftState.scope
  });
  const [rows, setRows] = useState(applications);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [search, setSearch] = useState(
    initialPreferences.draftState.quickSearch ?? ""
  );
  const [visibleRowCount, setVisibleRowCount] = useState(applications.length);
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const [viewStateMessage, setViewStateMessage] = useState<ViewStateMessage | null>(
    initialPreferencesWarning
      ? {
          tone: "warning",
          message: initialPreferencesWarning
        }
      : null
  );
  const [createViewName, setCreateViewName] = useState("");
  const [renameViewName, setRenameViewName] = useState("");
  const [viewFormMode, setViewFormMode] = useState<"create" | "saveAs" | "rename" | null>(
    null
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setRows(applications);
    setVisibleRowCount(applications.length);
  }, [applications]);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  const activeView = useMemo(() => {
    const matchingSystemView = systemViews.find(
      (view) => view.id === preferences.activeViewId
    );
    if (matchingSystemView) {
      return matchingSystemView;
    }

    return (
      preferences.userViews.find((view) => view.id === preferences.activeViewId) ??
      getApplicationsGridSystemView("system:all-active") ??
      systemViews[0]
    );
  }, [preferences.activeViewId, preferences.userViews, systemViews]);

  const effectiveCurrentState = useMemo(
    () =>
      createApplicationsGridViewState({
        ...preferences.draftState,
        quickSearch: search.trim() ? search.trim() : null
      }),
    [preferences.draftState, search]
  );

  const isModified = useMemo(() => {
    if (!activeView) {
      return false;
    }

    return (
      serializeApplicationsGridStateForComparison(effectiveCurrentState) !==
      serializeApplicationsGridStateForComparison(activeView.state)
    );
  }, [activeView, effectiveCurrentState]);

  const updateVisibleRowCount = useCallback(() => {
    setVisibleRowCount(gridApiRef.current?.getDisplayedRowCount() ?? rows.length);
  }, [rows.length]);

  const refreshCellStyles = (applicationId: string, field: string) => {
    gridApiRef.current?.refreshCells({
      rowNodes:
        gridApiRef.current
          ?.getRenderedNodes()
          .filter((node) => node.data?.id === applicationId) ?? [],
      columns: [field],
      force: true
    });
  };

  const setCellStatus = (
    applicationId: string,
    field: string,
    status: CellSaveStatus | null
  ) => {
    const key = buildCellStatusKey(applicationId, field);

    if (status) {
      cellStatusesRef.current[key] = status;
    } else {
      delete cellStatusesRef.current[key];
    }

    refreshCellStyles(applicationId, field);
  };

  const buildPersistedDraftState = useCallback(() => {
    const api = gridApiRef.current;
    return sanitizeApplicationsGridViewState({
      version: 1,
      columnState: api?.getColumnState() ?? preferencesRef.current.draftState.columnState,
      filterModel: api?.getFilterModel() ?? preferencesRef.current.draftState.filterModel,
      archiveMode: externalFilterStateRef.current.archiveMode,
      quickSearch: preferencesRef.current.draftState.quickSearch,
      scope: externalFilterStateRef.current.scope
    });
  }, []);

  const buildSavableViewState = useCallback(() => {
    const api = gridApiRef.current;
    return sanitizeApplicationsGridViewState({
      version: 1,
      columnState: api?.getColumnState() ?? preferencesRef.current.draftState.columnState,
      filterModel: api?.getFilterModel() ?? preferencesRef.current.draftState.filterModel,
      archiveMode: externalFilterStateRef.current.archiveMode,
      quickSearch: search.trim() ? search.trim() : null,
      scope: externalFilterStateRef.current.scope
    });
  }, [search]);

  const syncLocalPreferencesDraftState = useCallback(
    (nextDraftState: ReturnType<typeof createApplicationsGridViewState>) => {
      setPreferences((current) => ({
        ...current,
        draftState: nextDraftState
      }));
    },
    []
  );

  const persistDraftState = useCallback(
    async (
      nextDraftState: ReturnType<typeof createApplicationsGridViewState>,
      {
        immediate = false
      }: {
        immediate?: boolean;
      } = {}
    ) => {
      syncLocalPreferencesDraftState(nextDraftState);

      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current);
      }

      const requestId = ++draftSaveRequestIdRef.current;
      const runSave = async () => {
        const result = await updateApplicationsGridPreferencesRequest({
          type: "saveDraft",
          activeViewId: preferencesRef.current.activeViewId,
          draftState: nextDraftState
        });

        if (requestId !== draftSaveRequestIdRef.current) {
          return;
        }

        if (!result.ok) {
          setViewStateMessage({
            tone: "error",
            message: result.error
          });
          return;
        }

        setPreferences(result.preferences);
        if (result.warning) {
          setViewStateMessage({
            tone: "warning",
            message: result.warning
          });
        }
      };

      if (immediate) {
        await runSave();
        return;
      }

      draftSaveTimeoutRef.current = setTimeout(() => {
        void runSave();
      }, 300);
    },
    [syncLocalPreferencesDraftState]
  );

  const flushPendingDraftState = useCallback(async () => {
    if (!draftSaveTimeoutRef.current) {
      return;
    }

    clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = null;
    await persistDraftState(buildPersistedDraftState(), {
      immediate: true
    });
  }, [buildPersistedDraftState, persistDraftState]);

  const applyViewStateToGrid = useCallback(
    (
      nextState: ReturnType<typeof createApplicationsGridViewState>,
      nextSearch: string
    ) => {
      const api = gridApiRef.current;
      if (!api) {
        return;
      }

      isApplyingViewStateRef.current = true;
      api.stopEditing(true);
      externalFilterStateRef.current = {
        archiveMode: nextState.archiveMode,
        scope: nextState.scope
      };
      setSearch(nextSearch);
      api.applyColumnState({
        state: nextState.columnState,
        applyOrder: true,
        defaultState: {
          hide: false,
          pinned: null,
          sort: null,
          sortIndex: null
        } as never
      });
      api.setFilterModel(nextState.filterModel);
      api.setGridOption("quickFilterText", nextSearch);
      api.onFilterChanged();
      updateVisibleRowCount();
      queueMicrotask(() => {
        isApplyingViewStateRef.current = false;
      });
    },
    [updateVisibleRowCount]
  );

  useEffect(() => {
    return () => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current);
      }

      if (process.env.NODE_ENV !== "production") {
        (
          window as Window & {
            __careerOsApplicationsGrid?: {
              api: GridApi<ApplicationGridRow>;
            };
          }
        ).__careerOsApplicationsGrid = undefined;
      }
    };
  }, []);

  const openDetail = useCallback((applicationId: string) => {
    gridApiRef.current?.stopEditing(true);
    router.push(`/applications/${applicationId}`);
  }, [router]);

  const columnDefs = useMemo(
    () =>
      buildApplicationsGridColumnDefs({
        getCellTone: (applicationId, field) =>
          cellStatusesRef.current[buildCellStatusKey(applicationId, field)]?.tone ?? null,
        onOpenDetail: openDetail
      }),
    [openDetail]
  );

  const defaultColDef = useMemo<ColDef<ApplicationGridRow>>(
    () => ({
      filter: true,
      sortable: true,
      resizable: true,
      wrapHeaderText: true,
      autoHeaderHeight: true
    }),
    []
  );

  const gridOptions = useMemo<GridOptions<ApplicationGridRow>>(
    () => ({
      readOnlyEdit: true,
      stopEditingWhenCellsLoseFocus: true,
      isExternalFilterPresent: () => {
        const { archiveMode, scope } = externalFilterStateRef.current;
        return (
          archiveMode !== "ALL" ||
          Boolean(scope.statuses?.length) ||
          Boolean(scope.appliedWithinDays)
        );
      },
      doesExternalFilterPass: (node) => {
        const data = node.data;
        if (!data) {
          return true;
        }

        const { archiveMode, scope } = externalFilterStateRef.current;

        if (archiveMode === "ACTIVE_ONLY" && data.archived) {
          return false;
        }

        if (archiveMode === "ARCHIVED_ONLY" && !data.archived) {
          return false;
        }

        if (scope.statuses?.length && !scope.statuses.includes(data.status)) {
          return false;
        }

        if (
          scope.appliedWithinDays &&
          !isWithinRecentDays(data.jobSearchDateInput, scope.appliedWithinDays)
        ) {
          return false;
        }

        return true;
      }
    }),
    []
  );

  useEffect(() => {
    gridApiRef.current?.setGridOption("quickFilterText", deferredSearch);
  }, [deferredSearch]);

  const handleGridReady = (event: GridReadyEvent<ApplicationGridRow>) => {
    gridApiRef.current = event.api;
    if (process.env.NODE_ENV !== "production") {
      (
        window as Window & {
          __careerOsApplicationsGrid?: {
            api: GridApi<ApplicationGridRow>;
          };
        }
      ).__careerOsApplicationsGrid = {
        api: event.api
      };
    }
    event.api.setGridOption("quickFilterText", deferredSearch);
    applyViewStateToGrid(
      preferencesRef.current.draftState,
      preferencesRef.current.draftState.quickSearch ?? ""
    );
    updateVisibleRowCount();
  };

  const handleGridStateChanged = useCallback(
    (
      _event?:
        | ColumnMovedEvent<ApplicationGridRow>
        | ColumnResizedEvent<ApplicationGridRow>
        | ColumnVisibleEvent<ApplicationGridRow>
        | SortChangedEvent<ApplicationGridRow>
        | FilterChangedEvent<ApplicationGridRow>
    ) => {
      if (isApplyingViewStateRef.current) {
        return;
      }

      void persistDraftState(buildPersistedDraftState());
    },
    [buildPersistedDraftState, persistDraftState]
  );

  const runPreferencesCommand = useCallback(
    async (
      command: Exclude<ApplicationsGridPreferencesCommand, { type: "saveDraft" }>,
      successMessage: string
    ) => {
      await flushPendingDraftState();
      gridApiRef.current?.stopEditing(true);

      const result = await updateApplicationsGridPreferencesRequest(command);
      if (!result.ok) {
        setViewStateMessage({
          tone: "error",
          message: result.error
        });
        return null;
      }

      setPreferences(result.preferences);
      setSearch(result.preferences.draftState.quickSearch ?? "");
      externalFilterStateRef.current = {
        archiveMode: result.preferences.draftState.archiveMode,
        scope: result.preferences.draftState.scope
      };
      applyViewStateToGrid(
        result.preferences.draftState,
        result.preferences.draftState.quickSearch ?? ""
      );
      setViewStateMessage({
        tone: result.warning ? "warning" : "success",
        message: result.warning ?? successMessage
      });
      setViewFormMode(null);
      setConfirmDelete(false);
      return result.preferences;
    },
    [applyViewStateToGrid, flushPendingDraftState]
  );

  const handleCellEditRequest = async (
    event: CellEditRequestEvent<ApplicationGridRow>
  ) => {
    const columnField = event.colDef.field;
    const row = event.data;
    const editableField =
      columnField && editableFieldByColumn[columnField as keyof typeof editableFieldByColumn];

    if (!row?.id || !columnField || !editableField) {
      return;
    }

    const nextValue =
      typeof event.newValue === "string" ? event.newValue : event.newValue == null ? null : String(event.newValue);

    if (isSameEditValue(row, editableField, nextValue)) {
      return;
    }

    const key = buildCellStatusKey(row.id, columnField);
    const nextVersion = (requestVersionRef.current[key] ?? 0) + 1;
    requestVersionRef.current[key] = nextVersion;

    setCellStatus(row.id, columnField, {
      tone: "saving",
      message: "Saving..."
    });
    setSaveState({
      tone: "saving",
      message: `Saving ${event.colDef.headerName ?? columnField} for ${row.company}.`
    });

    const result: ApplicationGridMutationResult = await updateApplicationGridFieldRequest({
      applicationId: row.id,
      field: editableField,
      value: nextValue
    });

    if (requestVersionRef.current[key] !== nextVersion) {
      return;
    }

    if (!result.ok) {
      setCellStatus(row.id, columnField, {
        tone: "error",
        message: result.error
      });
      setSaveState({
        tone: "error",
        message: result.error
      });
      return;
    }

    setRows((currentRows) =>
      currentRows.map((currentRow) =>
        currentRow.id === result.row.id ? result.row : currentRow
      )
    );
    setCellStatus(row.id, columnField, {
      tone: "success",
      message: result.message
    });
    setSaveState({
      tone: "success",
      message: result.message
    });
  };

  if (applications.length === 0) {
    return (
      <div className="space-y-6">
        <SuccessBanner success={success} />
        <section className="rounded-3xl border border-dashed border-stone-300 bg-white px-8 py-12 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-stone-900">
            No applications found.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-600">
            Start with the company, role, and date. You can enrich the rest later
            without losing the original application record.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              href="/applications/new"
            >
              Create Application
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SuccessBanner success={success} />

      <section className="rounded-3xl border border-stone-300 bg-white p-5 shadow-sm">
        <div aria-live="polite" className="sr-only">
          {saveState?.message ?? ""}
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-stone-900">
              Applications ({rows.length})
            </h2>
            <p className="text-sm text-stone-600">
              Showing {visibleRowCount} of {rows.length} rows
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-stone-700" htmlFor="applications-view-select">
                View
              </label>
              <select
                aria-label="Applications view"
                className="rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition focus:border-stone-950 focus:ring-2 focus:ring-stone-200"
                id="applications-view-select"
                onChange={(event) => {
                  void runPreferencesCommand(
                    {
                      type: "activate",
                      viewId: event.target.value
                    },
                    "View applied."
                  );
                }}
                value={preferences.activeViewId}
              >
                <optgroup label="System views">
                  {systemViews.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.name}
                    </option>
                  ))}
                </optgroup>
                {preferences.userViews.length > 0 ? (
                  <optgroup label="Saved views">
                    {preferences.userViews.map((view) => (
                      <option key={view.id} value={view.id}>
                        {view.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              {isModified ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  Modified
                </span>
              ) : null}
              <label className="text-sm font-medium text-stone-700" htmlFor="applications-archive-mode">
                Archive
              </label>
              <select
                aria-label="Archive scope"
                className="rounded-xl border border-stone-300 px-3 py-2 text-sm text-stone-900 shadow-sm outline-none transition focus:border-stone-950 focus:ring-2 focus:ring-stone-200"
                id="applications-archive-mode"
                onChange={(event) => {
                  externalFilterStateRef.current = {
                    ...externalFilterStateRef.current,
                    archiveMode: event.target.value as ApplicationsGridArchiveMode
                  };
                  gridApiRef.current?.stopEditing(true);
                  gridApiRef.current?.onFilterChanged();
                  updateVisibleRowCount();
                  void persistDraftState(buildPersistedDraftState(), {
                    immediate: true
                  });
                }}
                value={preferences.draftState.archiveMode}
              >
                <option value="ACTIVE_ONLY">{normalizeArchiveModeLabel("ACTIVE_ONLY")}</option>
                <option value="ARCHIVED_ONLY">{normalizeArchiveModeLabel("ARCHIVED_ONLY")}</option>
                <option value="ALL">{normalizeArchiveModeLabel("ALL")}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <label className="flex min-w-[18rem] flex-col gap-2 text-sm font-medium text-stone-700">
              <span className="sr-only">Search applications</span>
              <input
                aria-label="Search applications"
                className="rounded-2xl border border-stone-300 px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-stone-950 focus:ring-2 focus:ring-stone-200"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search company, role, location, or source"
                type="search"
                value={search}
              />
            </label>

            <button
              aria-label="Create saved view"
              className="rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              onClick={() => {
                setCreateViewName("");
                setViewFormMode("create");
                setConfirmDelete(false);
              }}
              type="button"
            >
              Create View
            </button>

            <button
              aria-label="Save as new view"
              className="rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              onClick={() => {
                setCreateViewName(
                  "name" in activeView ? `${activeView.name} Copy` : ""
                );
                setViewFormMode("saveAs");
                setConfirmDelete(false);
              }}
              type="button"
            >
              Save As New View
            </button>

            {!isSystemApplicationsGridViewId(preferences.activeViewId) ? (
              <button
                aria-label="Rename view"
                className="rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
                onClick={() => {
                  const currentUserView = preferences.userViews.find(
                    (view) => view.id === preferences.activeViewId
                  );
                  setRenameViewName(currentUserView?.name ?? "");
                  setViewFormMode("rename");
                  setConfirmDelete(false);
                }}
                type="button"
              >
                Rename View
              </button>
            ) : null}

            {activeView && !isSystemApplicationsGridViewId(activeView.id) ? (
              <button
                aria-label="Save changes to view"
                className="rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
                disabled={!isModified}
                onClick={() => {
                  void runPreferencesCommand(
                    {
                      type: "update",
                      viewId: activeView.id,
                      state: buildSavableViewState()
                    },
                    "Saved view updated."
                  );
                }}
                type="button"
              >
                Save Changes
              </button>
            ) : null}

            <button
              aria-label="Reset current view"
              className="rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              disabled={!isModified}
              onClick={() => {
                if (!activeView) {
                  return;
                }

                void runPreferencesCommand(
                  {
                    type: "reset",
                    viewId: activeView.id
                  },
                  "View reset."
                );
              }}
              type="button"
            >
              Reset View
            </button>

            {!isSystemApplicationsGridViewId(preferences.activeViewId) ? (
              <button
                aria-label="Delete view"
                className="rounded-full border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 transition hover:border-red-700 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                onClick={() => {
                  setConfirmDelete(true);
                  setViewFormMode(null);
                }}
                type="button"
              >
                Delete View
              </button>
            ) : null}

            <button
              aria-label="Refresh applications"
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              disabled={isRefreshing}
              onClick={() => {
                gridApiRef.current?.stopEditing(true);
                startRefreshTransition(() => {
                  router.refresh();
                });
              }}
              type="button"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>

            <Link
              aria-label="Create application"
              className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              href="/applications/new"
            >
              New Application
            </Link>
          </div>
        </div>

        {viewFormMode ? (
          <form
            className="mt-4 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-center"
            onSubmit={(event) => {
              event.preventDefault();
              if (viewFormMode === "rename" && activeView && !isSystemApplicationsGridViewId(activeView.id)) {
                void runPreferencesCommand(
                  {
                    type: "rename",
                    viewId: activeView.id,
                    name: renameViewName
                  },
                  "Saved view renamed."
                );
                return;
              }

              void runPreferencesCommand(
                {
                  type: viewFormMode === "saveAs" ? "saveAs" : "create",
                  name: createViewName,
                  state: buildSavableViewState()
                },
                "Saved view created."
              );
            }}
          >
            <label className="flex-1 text-sm font-medium text-stone-700">
              <span className="sr-only">
                {viewFormMode === "rename" ? "Rename saved view" : "Saved view name"}
              </span>
              <input
                aria-label={viewFormMode === "rename" ? "Rename saved view" : "Saved view name"}
                className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm text-stone-900 shadow-sm outline-none transition focus:border-stone-950 focus:ring-2 focus:ring-stone-200"
                onChange={(event) =>
                  viewFormMode === "rename"
                    ? setRenameViewName(event.target.value)
                    : setCreateViewName(event.target.value)
                }
                value={viewFormMode === "rename" ? renameViewName : createViewName}
              />
            </label>
            <button
              className="rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              type="submit"
            >
              {viewFormMode === "rename" ? "Save Name" : "Save View"}
            </button>
            <button
              className="rounded-full border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
              onClick={() => setViewFormMode(null)}
              type="button"
            >
              Cancel
            </button>
          </form>
        ) : null}

        {confirmDelete && activeView && !isSystemApplicationsGridViewId(activeView.id) ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Delete <span className="font-semibold">{activeView.name}</span>? The grid
              will return to All Active.
            </p>
            <div className="flex gap-3">
              <button
                className="rounded-full border border-red-300 px-4 py-2 font-semibold text-red-700 transition hover:border-red-700 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                onClick={() => {
                  void runPreferencesCommand(
                    {
                      type: "delete",
                      viewId: activeView.id
                    },
                    "Saved view deleted."
                  );
                }}
                type="button"
              >
                Confirm Delete
              </button>
              <button
                className="rounded-full border border-stone-300 px-4 py-2 font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-950"
                onClick={() => setConfirmDelete(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {saveState ? (
          <div
            className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
              saveState.tone === "error"
                ? "border border-red-200 bg-red-50 text-red-800"
                : saveState.tone === "saving"
                  ? "border border-sky-200 bg-sky-50 text-sky-800"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
            role={saveState.tone === "error" ? "alert" : "status"}
          >
            {saveState.message}
          </div>
        ) : null}

        {viewStateMessage ? (
          <div
            className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
              viewStateMessage.tone === "error"
                ? "border border-red-200 bg-red-50 text-red-800"
                : viewStateMessage.tone === "warning"
                  ? "border border-amber-200 bg-amber-50 text-amber-800"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
            role={viewStateMessage.tone === "error" ? "alert" : "status"}
          >
            {viewStateMessage.message}
          </div>
        ) : null}

        <div
          aria-label="Applications grid"
          className="ag-theme-quartz mt-6 overflow-hidden rounded-2xl border border-stone-200"
          data-testid="applications-grid"
        >
          <div className="h-[70vh] min-h-[32rem] w-full">
            <AgGridReact<ApplicationGridRow>
              animateRows={false}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              gridOptions={gridOptions}
              onCellEditRequest={handleCellEditRequest}
              onColumnMoved={handleGridStateChanged}
              onColumnResized={handleGridStateChanged}
              onColumnVisible={handleGridStateChanged}
              onFilterChanged={handleGridStateChanged}
              onGridReady={handleGridReady}
              onModelUpdated={updateVisibleRowCount}
              onSortChanged={handleGridStateChanged}
              quickFilterText={deferredSearch}
              rowData={rows}
              rowHeight={48}
              rowSelection={{
                mode: "singleRow",
                checkboxes: false,
                enableClickSelection: true
              }}
              suppressCellFocus={false}
              suppressColumnMoveAnimation
              suppressRowClickSelection={false}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
