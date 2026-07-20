import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicationsPage from "@/app/applications/page";
import { createDefaultApplicationsGridPreferencesRecord } from "@/lib/applications/grid-view-state";

const pushMock = vi.fn();
const fetchMock = vi.fn(async () => ({
  json: async () => ({
    ok: true,
    preferences: createDefaultApplicationsGridPreferencesRecord()
  })
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: vi.fn()
  })
}));

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/settings", () => ({
  getWorkspaceSettings: vi.fn(async () => ({
    defaultTimeZone: "America/Chicago",
    jobSearchDayCutoff: "03:00"
  }))
}));

vi.mock("@/lib/applications/grid-view-service", () => ({
  getApplicationsGridPreferences: vi.fn(async () => ({
    preferences: {
      version: 1,
      activeViewId: "system:all-active",
      draftState: {
        version: 1,
        columnState: [],
        filterModel: {},
        archiveMode: "ACTIVE_ONLY",
        quickSearch: null,
        scope: {}
      },
      userViews: []
    }
  }))
}));

vi.mock("@/lib/applications/service", () => ({
  listApplications: vi.fn(async () => [
    {
      id: "application-1",
      status: "APPLIED",
      priority: "HIGH",
      appliedAt: new Date("2026-07-12T18:30:00.000Z"),
      jobSearchDate: new Date("2026-07-12T00:00:00.000Z"),
      archivedAt: null,
      createdAt: new Date("2026-07-12T19:00:00.000Z"),
      updatedAt: new Date("2026-07-13T12:00:00.000Z"),
      activities: [],
      opportunity: {
        title: "Senior Software Engineer",
        location: "Remote",
        workArrangement: "REMOTE",
        salaryMin: 150000,
        salaryMax: 170000,
        salaryCurrency: "USD",
        source: "Imported fixture",
        company: {
          name: "SpotOn"
        }
      }
    },
    {
      id: "application-2",
      status: "INTERVIEW",
      priority: null,
      appliedAt: new Date("2026-07-10T15:00:00.000Z"),
      jobSearchDate: new Date("2026-07-10T00:00:00.000Z"),
      archivedAt: null,
      createdAt: new Date("2026-07-10T16:00:00.000Z"),
      updatedAt: new Date("2026-07-11T12:00:00.000Z"),
      activities: [],
      opportunity: {
        title: "Backend Engineer",
        location: "Chicago, IL",
        workArrangement: "HYBRID",
        salaryMin: 120000,
        salaryMax: 140000,
        salaryCurrency: "USD",
        source: "Referral",
        company: {
          name: "Acme"
        }
      }
    }
  ])
}));

describe("ApplicationsPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it(
    "populates the grid from the existing applications service and supports search and detail navigation",
    async () => {
      const user = userEvent.setup();
      const page = await ApplicationsPage({
        searchParams: Promise.resolve({})
      });

    render(page);

    await waitFor(
      () => {
        expect(screen.getByText("Applications (2)")).toBeVisible();
        expect(screen.getByText("Showing 2 of 2 rows")).toBeVisible();
        expect(screen.getAllByRole("button", { name: "Open" })).toHaveLength(2);
      },
      { timeout: 5_000 }
    );

    await user.type(
      screen.getByRole("searchbox", { name: "Search applications" }),
      "SpotOn"
    );

    await waitFor(() => {
      expect(screen.getByText("Showing 1 of 2 rows")).toBeVisible();
    });

    await user.click(screen.getAllByRole("button", { name: "Open" })[0]!);

      expect(pushMock).toHaveBeenCalledWith("/applications/application-1");
    },
    20000
  );
});
