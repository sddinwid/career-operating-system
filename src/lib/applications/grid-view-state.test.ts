import { describe, expect, it } from "vitest";
import {
  applicationsGridSystemViewIds,
  buildApplicationsGridSystemViews,
  createDefaultApplicationsGridPreferencesRecord,
  createApplicationsGridViewState,
  getReservedApplicationsGridViewNames,
  sanitizeApplicationsGridPreferencesRecord,
  sanitizeApplicationsGridViewState,
  serializeApplicationsGridStateForComparison
} from "@/lib/applications/grid-view-state";

describe("applications grid view state", () => {
  it("provides stable system views with reserved names", () => {
    const views = buildApplicationsGridSystemViews();

    expect(views.map((view) => view.id)).toEqual([...applicationsGridSystemViewIds]);
    expect(views.map((view) => view.name)).toEqual([
      "All Active",
      "Applied",
      "Waiting",
      "Interviewing",
      "Rejected",
      "Archived",
      "Recently Applied"
    ]);

    const reservedNames = getReservedApplicationsGridViewNames();
    expect(reservedNames.has("all active")).toBe(true);
    expect(reservedNames.has("recently applied")).toBe(true);
  });

  it("falls back safely for malformed persisted preferences", () => {
    const fallback = sanitizeApplicationsGridPreferencesRecord({
      version: 999,
      activeViewId: "broken",
      draftState: {
        version: 1,
        columnState: [{ colId: "unknown-column" }],
        filterModel: {
          unknownColumn: {
            filterType: "text",
            type: "equals",
            filter: "bad"
          }
        },
        archiveMode: "INVALID",
        quickSearch: "  ",
        scope: {
          statuses: ["BROKEN"]
        }
      },
      userViews: []
    });

    const defaultRecord = createDefaultApplicationsGridPreferencesRecord();
    expect(fallback.activeViewId).toBe(defaultRecord.activeViewId);
    expect(fallback.draftState.archiveMode).toBe("ACTIVE_ONLY");
    expect(fallback.draftState.columnState.map((entry) => entry.colId)).toEqual(
      defaultRecord.draftState.columnState.map((entry) => entry.colId)
    );
  });

  it("ignores unknown columns and obsolete enum filter values safely", () => {
    const sanitized = sanitizeApplicationsGridViewState({
      version: 1,
      columnState: [
        { colId: "status", width: 220 },
        { colId: "unknown-column", width: 999 },
        { colId: "status", width: 180 }
      ],
      filterModel: {
        status: {
          filterType: "set",
          values: ["APPLIED", "UNKNOWN"]
        },
        priority: {
          filterType: "text",
          type: "equals",
          filter: "INVALID"
        },
        source: {
          filterType: "text",
          type: "contains",
          filter: "referral"
        },
        missingColumn: {
          filterType: "text",
          type: "equals",
          filter: "x"
        }
      },
      archiveMode: "ACTIVE_ONLY",
      quickSearch: null,
      scope: {
        statuses: ["APPLIED"]
      }
    });

    expect(
      sanitized.columnState.some((entry) => entry.colId === "status")
    ).toBe(true);
    expect(
      sanitized.columnState.some((entry) => String(entry.colId) === "unknown-column")
    ).toBe(false);
    expect(sanitized.filterModel.status).toEqual({
      filterType: "set",
      values: ["APPLIED"]
    });
    expect(sanitized.filterModel.priority).toBeUndefined();
    expect(sanitized.filterModel.source).toEqual({
      filterType: "text",
      type: "contains",
      filter: "referral"
    });
  });

  it("preserves ag-grid column order and supported values when null fields are present", () => {
    const sanitized = sanitizeApplicationsGridViewState({
      version: 1,
      columnState: [
        {
          colId: "detailAction",
          pinned: null,
          sort: null,
          sortIndex: null
        },
        {
          colId: "company",
          width: 280,
          pinned: null,
          sort: null,
          sortIndex: null
        },
        {
          colId: "status",
          pinned: null,
          sort: null,
          sortIndex: null
        },
        {
          colId: "priority",
          sort: "asc",
          sortIndex: 0,
          pinned: null
        },
        {
          colId: "role",
          hide: true,
          pinned: null,
          sort: null,
          sortIndex: null
        }
      ],
      filterModel: {},
      archiveMode: "ACTIVE_ONLY",
      quickSearch: null,
      scope: {}
    });

    expect(sanitized.columnState.slice(0, 5)).toEqual([
      { colId: "detailAction" },
      { colId: "company", width: 280 },
      { colId: "status" },
      { colId: "priority", sort: "asc", sortIndex: 0 },
      { colId: "role", hide: true }
    ]);
  });

  it("treats search text as part of explicit saved-view comparison", () => {
    const base = createApplicationsGridViewState();
    const withSearch = createApplicationsGridViewState({
      quickSearch: "Acme"
    });

    expect(serializeApplicationsGridStateForComparison(base)).not.toBe(
      serializeApplicationsGridStateForComparison(withSearch)
    );
  });
});
