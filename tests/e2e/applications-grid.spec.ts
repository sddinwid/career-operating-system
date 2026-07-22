import { PrismaClient } from "@prisma/client";
import type { GridApi } from "ag-grid-community";
import { expect, test } from "@playwright/test";
import { E2E_COMPANY_NAME, E2E_ROLE_NAME, resetE2EApplicationFixture } from "@/lib/testing/e2e-fixtures";
import type { ApplicationGridRow } from "@/lib/applications/grid";

declare global {
  interface Window {
    __careerOsApplicationsGrid?: {
      api: GridApi<ApplicationGridRow>;
    };
  }
}

const prisma = new PrismaClient();

function isApplicationsViewCommandResponse(
  response: import("@playwright/test").Response,
  commandType: "create" | "rename"
) {
  if (
    response.request().method() !== "POST" ||
    !response.url().includes("/api/applications/views") ||
    response.status() !== 200
  ) {
    return false;
  }

  const payload = response.request().postDataJSON() as { type?: string } | null;
  return payload?.type === commandType;
}

type ApplicationsViewCommandSuccessPayload = {
  ok: true;
  preferences: {
    activeViewId: string;
    userViews: Array<{
      id: string;
      name: string;
    }>;
  };
  warning?: string;
};

test("supports saved views, persistence, detail navigation, rollback, and search", async ({
  page
}) => {
  await resetE2EApplicationFixture(prisma);

  const companyName = E2E_COMPANY_NAME;
  const roleName = E2E_ROLE_NAME;
  const runToken = Date.now();
  const initialViewName = `E2E Saved View ${runToken}`;
  const renamedViewName = `E2E Saved View Renamed ${runToken}`;
  let gridMutationCount = 0;
  let priorityMutationCount = 0;
  let statusMutationCount = 0;
  let roleMutationCount = 0;

  page.on("request", (request) => {
    if (
      request.method() !== "POST" ||
      !request.url().includes("/api/applications/") ||
      !request.url().includes("/grid-field")
    ) {
      return;
    }

    gridMutationCount += 1;

    const payload = request.postDataJSON() as { field?: string } | null;
    if (payload?.field === "priority") {
      priorityMutationCount += 1;
    } else if (payload?.field === "status") {
      statusMutationCount += 1;
    } else if (payload?.field === "role") {
      roleMutationCount += 1;
    }
  });

  async function waitForGridApi() {
    await page.waitForFunction(() => Boolean(window.__careerOsApplicationsGrid?.api));
  }

  async function readGridState() {
    return page.evaluate(() => {
      const api = window.__careerOsApplicationsGrid?.api;
      if (!api) {
        throw new Error("Grid API is unavailable.");
      }

      return {
        columnState: api.getColumnState(),
        filterModel: api.getFilterModel()
      };
    });
  }

  async function findDisplayedRowIndex(company: string) {
    return page.evaluate((companyNameValue) => {
      const api = window.__careerOsApplicationsGrid?.api;
      if (!api) {
        throw new Error("Grid API is unavailable.");
      }

      let rowIndex: number | null = null;
      api.forEachNodeAfterFilterAndSort((node) => {
        if (rowIndex !== null) {
          return;
        }

        if (node.data?.company === companyNameValue && typeof node.rowIndex === "number") {
          rowIndex = node.rowIndex;
        }
      });

      return rowIndex;
    }, company);
  }

  await page.goto("/applications");
  await waitForGridApi();

  const grid = page.getByTestId("applications-grid");
  const viewSelect = page.getByLabel("Applications view");
  const searchbox = page.getByRole("searchbox", { name: "Search applications" });

  await viewSelect.selectOption("system:all-active");
  await searchbox.fill("");
  await expect
    .poll(async () =>
      viewSelect.evaluate((element) => {
        const select = element as HTMLSelectElement;
        return select.selectedOptions[0]?.textContent?.trim();
      })
    )
    .toBe("All Active");

  await page.evaluate(() => {
    const api = window.__careerOsApplicationsGrid?.api;
    if (!api) {
      throw new Error("Grid API is unavailable.");
    }

    const currentState = api.getColumnState();
    const nextState = currentState.map((column) => ({
      ...column,
      hide: column.colId === "role",
      sort: column.colId === "priority" ? ("asc" as const) : undefined,
      sortIndex: column.colId === "priority" ? 0 : undefined
    }));

    api.applyColumnState({
      state: nextState,
      applyOrder: false,
      defaultState: {
        hide: false,
        pinned: null,
        sort: undefined,
        sortIndex: undefined
      }
    });
    if ("moveColumns" in api && typeof (api as { moveColumns?: unknown }).moveColumns === "function") {
      (
        api as {
          moveColumns: (keys: string[], toIndex: number) => void;
        }
      ).moveColumns(["company", "status", "priority"], 1);
    }
    if ("setColumnWidths" in api && typeof api.setColumnWidths === "function") {
      api.setColumnWidths([
        {
          key: "company",
          newWidth: 280
        }
      ]);
    }
    api.setFilterModel({
      status: {
        filterType: "text",
        type: "equals",
        filter: "APPLIED"
      }
    });
    api.onFilterChanged();
  });

  await expect(page.getByRole("button", { name: "Create saved view" })).toBeVisible();
  await expect
    .poll(async () => {
      const state = await readGridState();
      return {
        firstColumns: state.columnState.slice(0, 4).map((entry) => entry.colId),
        companyWidth: state.columnState.find((entry) => entry.colId === "company")?.width,
        roleHidden: state.columnState.find((entry) => entry.colId === "role")?.hide,
        prioritySort: state.columnState.find((entry) => entry.colId === "priority")?.sort,
        statusFilter: (state.filterModel.status as { filter?: string } | undefined)?.filter
      };
    })
    .toMatchObject({
      firstColumns: ["detailAction", "company", "status", "priority"],
      companyWidth: 280,
      roleHidden: true,
      prioritySort: "asc",
      statusFilter: "APPLIED"
    });
  await expect(page.locator(".ag-header-cell-text").getByText("Role")).toHaveCount(0);

  await page.getByRole("button", { name: "Create saved view" }).click();
  await page.getByLabel("Saved view name").fill(initialViewName);
  const createViewResponse = page.waitForResponse((response) =>
    isApplicationsViewCommandResponse(response, "create")
  );
  await page.getByRole("button", { name: "Save View" }).click();
  const createViewPayload =
    (await (await createViewResponse).json()) as ApplicationsViewCommandSuccessPayload;
  await expect(page.getByText("Saved view created.")).toBeVisible();

  const createdViewId = createViewPayload.preferences.activeViewId;
  expect(createdViewId.startsWith("user:")).toBe(true);
  await expect
    .poll(
      async () =>
        viewSelect.evaluate((element, expectedViewId) => {
        const select = element as HTMLSelectElement;
        return Array.from(select.options).some((option) => option.value === expectedViewId);
        }, createdViewId),
      { timeout: 15_000 }
    )
    .toBe(true);
  await expect
    .poll(
      async () =>
        viewSelect.evaluate((element) => {
          const select = element as HTMLSelectElement;
          return {
            selectedValue: select.value,
            selectedLabel: select.selectedOptions[0]?.textContent?.trim()
          };
        }),
      { timeout: 15_000 }
    )
    .toMatchObject({
      selectedValue: createdViewId,
      selectedLabel: initialViewName
    });

  await page.reload();
  await waitForGridApi();

  await expect
    .poll(async () =>
      viewSelect.evaluate((element) => {
        const select = element as HTMLSelectElement;
        return select.selectedOptions[0]?.textContent?.trim();
      })
    )
    .toBe(initialViewName);

  const restoredState = await readGridState();
  const restoredColumnState = restoredState.columnState;
  expect(restoredColumnState.slice(0, 4).map((entry) => entry.colId)).toEqual([
    "detailAction",
    "company",
    "status",
    "priority"
  ]);
  expect(
    restoredColumnState.find((entry) => entry.colId === "company")?.width
  ).toBeGreaterThanOrEqual(260);
  expect(restoredColumnState.find((entry) => entry.colId === "role")?.hide).toBe(true);
  expect(restoredColumnState.find((entry) => entry.colId === "priority")?.sort).toBe("asc");
  expect(restoredState.filterModel.status).toMatchObject({
    filterType: "text",
    type: "equals",
    filter: "APPLIED"
  });

  await viewSelect.selectOption("system:archived");
  await expect
    .poll(async () =>
      viewSelect.evaluate((element) => {
        const select = element as HTMLSelectElement;
        return select.selectedOptions[0]?.textContent?.trim();
      })
    )
    .toBe("Archived");
  await expect(grid.locator('.ag-cell[col-id="company"]').filter({ hasText: companyName })).toHaveCount(0);

  await viewSelect.selectOption(createdViewId);
  await expect
    .poll(async () =>
      viewSelect.evaluate((element) => {
        const select = element as HTMLSelectElement;
        return select.selectedOptions[0]?.textContent?.trim();
      })
    )
    .toBe(initialViewName);
  await expect(grid.locator('.ag-cell[col-id="company"]').filter({ hasText: companyName })).toHaveCount(1);

  await page.getByRole("button", { name: "Rename view" }).click();
  await page.getByLabel("Rename saved view").fill(renamedViewName);
  const renameViewResponse = page.waitForResponse((response) =>
    isApplicationsViewCommandResponse(response, "rename")
  );
  await page.getByRole("button", { name: "Save Name" }).click();
  const renameViewPayload =
    (await (await renameViewResponse).json()) as ApplicationsViewCommandSuccessPayload;
  await expect(page.getByText("Saved view renamed.")).toBeVisible();
  await expect
    .poll(
      async () =>
        viewSelect.evaluate((element, args) => {
        const select = element as HTMLSelectElement;
        return Array.from(select.options).some(
          (option) =>
            option.value === args.expectedViewId &&
            option.textContent?.trim() === args.expectedName
        );
        }, {
          expectedViewId: renameViewPayload.preferences.activeViewId,
          expectedName: renamedViewName
        }),
      { timeout: 15_000 }
    )
    .toBe(true);

  await page.reload();
  await waitForGridApi();
  await expect
    .poll(async () =>
      viewSelect.evaluate((element) => {
        const select = element as HTMLSelectElement;
        return select.selectedOptions[0]?.textContent?.trim();
      })
    )
    .toBe(renamedViewName);

  await page.getByRole("button", { name: "Delete view" }).click();
  await page.getByRole("button", { name: "Confirm Delete" }).click();
  await viewSelect.selectOption("system:all-active");
  await searchbox.fill("");
  await expect
    .poll(async () =>
      viewSelect.evaluate((element) => {
        const select = element as HTMLSelectElement;
        return select.selectedOptions[0]?.textContent?.trim();
      })
    )
    .toBe("All Active");

  expect(gridMutationCount).toBe(0);
  await searchbox.fill(companyName);
  await expect(page.getByText("Showing 1 of")).toBeVisible();
  const filteredRow = grid.locator(".ag-row").filter({ hasText: companyName });
  await expect(filteredRow).toHaveCount(1);
  await expect(
    filteredRow.locator('.ag-cell[col-id="company"]').filter({ hasText: companyName })
  ).toHaveCount(1);
  await expect(
    filteredRow.locator('.ag-cell[col-id="status"]').filter({ hasText: "APPLIED" })
  ).toHaveCount(1);

  await grid
    .locator(".ag-body-horizontal-scroll-viewport")
    .evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });

  const priorityCell = grid.locator('.ag-cell[col-id="priority"]').filter({
    hasText: "Not set"
  });
  await expect(priorityCell).toHaveCount(1);
  await priorityCell.dblclick();

  const priorityEditor = page.getByRole("combobox", { name: "Priority editor" });
  await expect(priorityEditor).toBeVisible();
  const prioritySaveResponse = page.waitForResponse((response) => {
    if (
      response.request().method() !== "POST" ||
      !response.url().includes("/api/applications/") ||
      !response.url().includes("/grid-field")
    ) {
      return false;
    }

    const payload = response.request().postDataJSON() as { field?: string } | null;
    return payload?.field === "priority";
  });
  await priorityEditor.selectOption("LOW");
  await prioritySaveResponse;

  await expect(
    page.getByRole("status").filter({ hasText: "Application updated." }).first()
  ).toContainText("Application updated.");
  expect(priorityMutationCount).toBe(1);
  await expect(grid.locator('.ag-cell[col-id="priority"]').filter({ hasText: "LOW" })).toHaveCount(
    1
  );

  await page.getByRole("button", { name: "Refresh applications" }).click();
  await waitForGridApi();
  await expect(grid.locator('.ag-cell[col-id="priority"]').filter({ hasText: "LOW" })).toHaveCount(
    1
  );
  await grid
    .locator(".ag-body-horizontal-scroll-viewport")
    .evaluate((element) => {
      element.scrollLeft = 0;
    });

  const statusCell = grid.locator('.ag-cell[col-id="status"]').filter({
    hasText: "APPLIED"
  });
  await expect(statusCell).toHaveCount(1);
  const statusRowIndex = await findDisplayedRowIndex(companyName);
  expect(statusRowIndex).not.toBeNull();
  await page.evaluate((rowIndex) => {
    const api = window.__careerOsApplicationsGrid?.api;
    if (!api || rowIndex == null) {
      throw new Error("Grid API is unavailable.");
    }

    api.ensureIndexVisible(rowIndex);
    api.startEditingCell({
      rowIndex,
      colKey: "status"
    });
  }, statusRowIndex);

  const statusEditor = page.getByRole("combobox", { name: "Status editor" });
  await expect(statusEditor).toBeVisible();
  const statusSaveResponse = page.waitForResponse((response) => {
    if (
      response.request().method() !== "POST" ||
      !response.url().includes("/api/applications/") ||
      !response.url().includes("/grid-field")
    ) {
      return false;
    }

    const payload = response.request().postDataJSON() as { field?: string } | null;
    return payload?.field === "status";
  });
  await statusEditor.selectOption("INTERVIEW");
  await statusSaveResponse;

  await expect(
    page.getByRole("status").filter({ hasText: "Application updated." }).first()
  ).toContainText("Application updated.");
  expect(statusMutationCount).toBe(1);
  await expect(grid.locator('.ag-cell[col-id="status"]').filter({ hasText: "INTERVIEW" })).toHaveCount(
    1
  );

  const openButtons = grid.getByRole("button", { name: "Open" });
  await expect(openButtons).toHaveCount(1);
  await Promise.all([
    page.waitForURL(/\/applications\/[^/]+$/, { timeout: 15_000 }),
    openButtons.first().click()
  ]);

  await expect(
    page.getByRole("heading", {
      name: roleName
    })
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page
      .locator("article")
      .filter({ hasText: "Status" })
      .getByText("INTERVIEW", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("APPLIED -> INTERVIEW")).toHaveCount(1);

  await page.goBack();
  await waitForGridApi();
  await expect(searchbox).toBeVisible();
  await searchbox.fill(companyName);
  await expect(page.getByText("Showing 1 of")).toBeVisible();
  await grid
    .locator(".ag-body-horizontal-scroll-viewport")
    .evaluate((element) => {
      element.scrollLeft = 0;
    });

  const roleCell = grid.locator('.ag-cell[col-id="role"]').filter({
    hasText: roleName
  });
  await expect(roleCell).toHaveCount(1);
  await roleCell.dblclick();

  const roleEditor = page.locator('input[aria-label="Role editor"]');
  await expect(roleEditor).toBeVisible();
  const failedRoleResponse = page.waitForResponse((response) => {
    if (
      response.request().method() !== "POST" ||
      !response.url().includes("/api/applications/") ||
      !response.url().includes("/grid-field")
    ) {
      return false;
    }

    const payload = response.request().postDataJSON() as { field?: string } | null;
    return payload?.field === "role";
  });
  await roleEditor.fill("");
  await searchbox.click();
  await failedRoleResponse;

  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Please fix the edited value and try again." })
  ).toContainText("Please fix the edited value and try again.");
  expect(roleMutationCount).toBe(1);
  await expect(
    grid.locator('.ag-cell[col-id="role"]').filter({
      hasText: roleName
    })
  ).toHaveCount(1);

  await searchbox.fill(companyName);
  await expect(page.getByText("Showing 1 of")).toBeVisible();
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
