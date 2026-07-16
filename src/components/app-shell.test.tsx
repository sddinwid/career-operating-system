import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/app-shell";
import { primaryNavigation } from "@/lib/navigation";

describe("AppShell", () => {
  it("renders the approved navigation labels", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    for (const item of primaryNavigation) {
      expect(screen.getByRole("link", { name: item })).toBeInTheDocument();
    }
  });
});
