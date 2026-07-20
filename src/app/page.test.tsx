import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

vi.mock("@/lib/health", () => ({
  getHealthStatus: vi.fn(async () => ({
    app: "ok",
    database: "ok"
  }))
}));

vi.mock("@/components/health-summary", () => ({
  HealthSummary: () => <div>Health summary</div>
}));

describe("HomePage", () => {
  it("surfaces product navigation actions and keeps health in diagnostics", async () => {
    const page = await HomePage();
    render(page);

    expect(screen.getAllByRole("link", { name: "Open applications" })[0]).toHaveClass(
      "button-primary"
    );
    expect(screen.getAllByRole("link", { name: "Browse jobs" })[0]).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Browse documents" })[0]).toBeVisible();
    expect(screen.getByRole("link", { name: "New application" })).toBeVisible();
    expect(screen.getByRole("link", { name: "New job" })).toBeVisible();
    expect(screen.getByText("Diagnostics")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open health page" })).toHaveAttribute(
      "href",
      "/health"
    );
  });
});
