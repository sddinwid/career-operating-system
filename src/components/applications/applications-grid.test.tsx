import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CustomCellEditorProps } from "ag-grid-react";
import {
  ApplicationsGrid,
  SelectCellEditor,
  TextCellEditor,
  buildApplicationsGridColumnDefs
} from "@/components/applications/applications-grid";
import { createDefaultApplicationsGridPreferencesRecord } from "@/lib/applications/grid-view-state";
import {
  applicationPriorityOptions,
  applicationStatusOptions,
  workArrangementOptions
} from "@/lib/applications/options";
import type {
  ApplicationGridMutationResult,
  ApplicationGridRow
} from "@/lib/applications/grid";

const {
  pushMock,
  refreshMock,
  useGridCellEditorMock
} = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  useGridCellEditorMock: vi.fn()
}));
const fetchMock = vi.fn<
  (input: RequestInfo | URL | string, init?: RequestInit) => Promise<{
    json: () => Promise<ApplicationGridMutationResult>;
  }>
>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock
  })
}));

vi.mock("ag-grid-react", () => ({
  useGridCellEditor: useGridCellEditorMock,
  AgGridReact: ({
    rowData,
    columnDefs,
    onCellEditRequest
  }: {
    rowData: ApplicationGridRow[];
    columnDefs: Array<{
      field?: string;
      headerName?: string;
      editable?: boolean;
      cellRenderer?: (params: { data: ApplicationGridRow }) => ReactNode;
      cellRendererParams?: { onOpenDetail?: (applicationId: string) => void };
    }>;
    onCellEditRequest?: (event: {
      data: ApplicationGridRow;
      colDef: { field?: string; headerName?: string };
      newValue: string | null;
    }) => void;
  }) => (
    <div data-testid="mock-grid">
      {rowData.map((row) => (
        <div key={row.id}>
          <span>{row.company}</span>
          <span>{row.priority ?? "Not set"}</span>
          <span>{row.status}</span>
          {columnDefs
            .filter((column) => column.editable && column.field)
            .map((column) => (
              <button
                key={`${row.id}-${column.field}`}
                onClick={() =>
                  onCellEditRequest?.({
                    data: row,
                    colDef: {
                      field: column.field,
                      headerName: column.headerName
                    },
                    newValue:
                      column.field === "priority"
                        ? "LOW"
                        : column.field === "status"
                          ? "INTERVIEW"
                          : column.field === "company"
                            ? "Acme Renamed"
                            : column.field === "appliedAtInput"
                              ? "2026-07-10"
                              : "Edited value"
                  })
                }
                type="button"
              >
                {`edit-${row.id}-${column.field}`}
              </button>
            ))}
          <button
            onClick={() =>
              onCellEditRequest?.({
                data: row,
                colDef: {
                  field: "priority",
                  headerName: "Priority"
                },
                newValue: row.priority
              })
            }
            type="button"
          >
            {`same-${row.id}-priority`}
          </button>
          {columnDefs
            .filter((column) => !column.editable && typeof column.cellRenderer === "function")
            .map((column) => (
              <div key={`${row.id}-${column.headerName}`}>
                {column.cellRenderer?.({
                  data: row,
                  ...column.cellRendererParams
                })}
              </div>
            ))}
        </div>
      ))}
    </div>
  )
}));

const sampleRows: ApplicationGridRow[] = [
  {
    id: "application-older",
    status: "APPLIED",
    company: "Acme",
    role: "Backend Engineer",
    location: "Chicago, IL",
    workArrangement: "HYBRID",
    salaryMin: 120000,
    salaryMax: 140000,
    salaryCurrency: "USD",
    salaryInput: "120000-140000 USD",
    appliedAt: "2026-07-10T15:00:00.000Z",
    appliedAtInput: "2026-07-10T10:00",
    appliedAtPrecision: "DATE_TIME",
    jobSearchDate: "2026-07-10T00:00:00.000Z",
    jobSearchDateInput: "2026-07-10",
    priority: "HIGH",
    source: "Referral",
    archived: false,
    createdAt: "2026-07-10T16:00:00.000Z",
    updatedAt: "2026-07-10T16:00:00.000Z"
  },
  {
    id: "application-newer",
    status: "APPLIED",
    company: "SpotOn",
    role: "Senior Software Engineer",
    location: "Remote",
    workArrangement: "REMOTE",
    salaryMin: 150000,
    salaryMax: 170000,
    salaryCurrency: "USD",
    salaryInput: "150000-170000 USD",
    appliedAt: "2026-07-12T18:30:00.000Z",
    appliedAtInput: "2026-07-12T13:30",
    appliedAtPrecision: "DATE_TIME",
    jobSearchDate: "2026-07-12T00:00:00.000Z",
    jobSearchDateInput: "2026-07-12",
    priority: "URGENT",
    source: "Imported fixture",
    archived: false,
    createdAt: "2026-07-12T19:00:00.000Z",
    updatedAt: "2026-07-13T12:00:00.000Z"
  }
];

const defaultPreferences = createDefaultApplicationsGridPreferencesRecord();

function createEditorColumn(
  headerName: string
): CustomCellEditorProps<ApplicationGridRow, string>["column"] {
  return {
    getColDef: () => ({
      headerName
    })
  } as CustomCellEditorProps<ApplicationGridRow, string>["column"];
}

function createEditorProps(args: {
  headerName: string;
  value: string;
  onValueChange?: (value: string | null | undefined) => void;
  stopEditing?: (suppressNavigateAfterEdit?: boolean) => void;
}): CustomCellEditorProps<ApplicationGridRow, string> {
  return {
    api: {} as CustomCellEditorProps<ApplicationGridRow, string>["api"],
    cellStartedEdit: true,
    column: createEditorColumn(args.headerName),
    colDef: {
      headerName: args.headerName
    },
    context: {} as CustomCellEditorProps<ApplicationGridRow, string>["context"],
    data: sampleRows[0],
    eGridCell: document.createElement("div"),
    eventKey: null,
    formatValue: (value) => String(value ?? ""),
    initialValue: args.value,
    node: {} as CustomCellEditorProps<ApplicationGridRow, string>["node"],
    onKeyDown: vi.fn(),
    onValueChange: args.onValueChange ?? vi.fn(),
    parseValue: (value) => value,
    rowIndex: 0,
    stopEditing: args.stopEditing ?? vi.fn(),
    validate: vi.fn(),
    value: args.value
  };
}

describe("ApplicationsGrid", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    useGridCellEditorMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      json: async () => ({
        ok: true,
        row: {
          ...sampleRows[1],
          priority: "LOW"
        },
        message: "Application updated."
      })
    });
  });

  it("uses authoritative editor values and editable column configuration", () => {
    const columnDefs = buildApplicationsGridColumnDefs({
      getCellTone: () => null,
      onOpenDetail: vi.fn()
    });

    const statusColumn = columnDefs.find((column) => column.field === "status");
    const priorityColumn = columnDefs.find((column) => column.field === "priority");
    const workArrangementColumn = columnDefs.find(
      (column) => column.field === "workArrangement"
    );
    const archivedColumn = columnDefs.find((column) => column.field === "archived");

    expect(statusColumn?.editable).toBe(true);
    expect(statusColumn?.cellEditorParams).toMatchObject({
      options: [...applicationStatusOptions]
    });
    expect(priorityColumn?.editable).toBe(true);
    expect(priorityColumn?.cellEditorParams).toMatchObject({
      options: ["", ...applicationPriorityOptions]
    });
    expect(workArrangementColumn?.editable).toBe(true);
    expect(workArrangementColumn?.cellEditorParams).toMatchObject({
      options: ["", ...workArrangementOptions]
    });
    expect(archivedColumn?.editable).toBe(false);
  });

  it("commits select edits through the reactive editor contract", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const stopEditing = vi.fn();

    render(
      <SelectCellEditor
        options={["", "LOW", "HIGH"]}
        {...createEditorProps({
          headerName: "Priority",
          onValueChange,
          stopEditing,
          value: ""
        })}
      />,
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "Priority editor" }), "LOW");

    expect(onValueChange).toHaveBeenCalledWith("LOW");
    expect(stopEditing).toHaveBeenCalledTimes(1);
  });

  it("cancels select edits on Escape without relying on stale state", async () => {
    const user = userEvent.setup();
    const stopEditing = vi.fn();

    render(
      <SelectCellEditor
        options={["APPLIED", "INTERVIEW"]}
        {...createEditorProps({
          headerName: "Status",
          stopEditing,
          value: "APPLIED"
        })}
      />,
    );

    await user.keyboard("{Escape}");

    expect(stopEditing).toHaveBeenCalledTimes(1);
    expect(useGridCellEditorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isCancelAfterEnd: expect.any(Function)
      })
    );

    const latestCall = useGridCellEditorMock.mock.lastCall?.[0] as
      | {
          isCancelAfterEnd?: () => boolean;
        }
      | undefined;

    expect(latestCall?.isCancelAfterEnd?.()).toBe(true);
  });

  it("commits text edits on Enter and cancels them on Escape", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const stopEditing = vi.fn();

    const { rerender } = render(
      <TextCellEditor
        {...createEditorProps({
          headerName: "Role",
          onValueChange,
          stopEditing,
          value: "Initial Role"
        })}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Role editor" });
    await user.clear(editor);
    await user.type(editor, "Updated Role");
    await user.keyboard("{Enter}");

    expect(onValueChange).toHaveBeenLastCalledWith("Updated Role");
    expect(stopEditing).toHaveBeenCalledTimes(1);

    onValueChange.mockReset();
    stopEditing.mockReset();
    useGridCellEditorMock.mockReset();

    rerender(
      <TextCellEditor
        {...createEditorProps({
          headerName: "Role",
          onValueChange,
          stopEditing,
          value: "Updated Role"
        })}
      />,
    );

    await user.keyboard("{Escape}");

    expect(stopEditing).toHaveBeenCalledTimes(1);
    expect(useGridCellEditorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isCancelAfterEnd: expect.any(Function)
      })
    );
  });

  it("saves a cell edit and updates the rendered row", async () => {
    const user = userEvent.setup();

    render(
      <ApplicationsGrid
        applications={sampleRows}
        initialPreferences={defaultPreferences}
      />
    );

    await user.click(screen.getByRole("button", { name: "edit-application-newer-priority" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/applications/application-newer/grid-field", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          field: "priority",
          value: "LOW"
        })
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Application updated.");
  });

  it("restores the authoritative value and shows an error when saving fails", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        ok: false,
        error: "Priority is invalid."
      })
    });

    render(
      <ApplicationsGrid
        applications={sampleRows}
        initialPreferences={defaultPreferences}
      />
    );

    await user.click(screen.getByRole("button", { name: "edit-application-newer-priority" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Priority is invalid.");
    });

    expect(screen.getByText("URGENT")).toBeVisible();
  });

  it("does not send a mutation when the edited value is unchanged", async () => {
    const user = userEvent.setup();

    render(
      <ApplicationsGrid
        applications={sampleRows}
        initialPreferences={defaultPreferences}
      />
    );

    await user.click(screen.getByRole("button", { name: "same-application-newer-priority" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps editing interactions from triggering navigation and preserves explicit detail access", async () => {
    const user = userEvent.setup();

    render(
      <ApplicationsGrid
        applications={sampleRows}
        initialPreferences={defaultPreferences}
      />
    );

    await user.click(screen.getByRole("button", { name: "edit-application-newer-status" }));
    expect(pushMock).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole("button", { name: "Open" })[1]!);
    expect(pushMock).toHaveBeenCalledWith("/applications/application-newer");
  });

  it("renders the empty state with a create button", () => {
    render(<ApplicationsGrid applications={[]} initialPreferences={defaultPreferences} />);

    expect(screen.getByText("No applications found.")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Create Application" })
    ).toBeVisible();
  });
});
