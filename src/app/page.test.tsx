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

    expect(screen.getByRole("link", { name: "Open applications" })).toHaveClass(
      "button-primary"
    );
    expect(screen.getByRole("link", { name: "Add Job from URL" })).toHaveClass(
      "button-secondary"
    );
    expect(screen.getByRole("link", { name: "Paste Job Description" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open applications" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse jobs" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse documents" })).toBeVisible();
    expect(screen.getByText("Diagnostics")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open health page" })).toHaveAttribute(
      "href",
      "/health"
    );
  });
});
