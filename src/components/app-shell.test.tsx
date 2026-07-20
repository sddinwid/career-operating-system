import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/app-shell";
import { deferredNavigation, diagnosticsNavigation, primaryNavigation } from "@/lib/navigation";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/jobs")
}));

describe("AppShell", () => {
  it("renders implemented navigation links, deferred labels, and diagnostics separately", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    for (const item of primaryNavigation) {
      expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    }

    for (const item of diagnosticsNavigation) {
      expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    }

    for (const item of deferredNavigation) {
      expect(screen.getByText(item.label)).toBeVisible();
    }

    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Calendar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Companies" })).not.toBeInTheDocument();
  });
});
