import { render, screen } from "@testing-library/react";
import ApplicationsLoading from "@/app/applications/loading";

describe("ApplicationsLoading", () => {
  it("renders the applications grid loading skeleton", () => {
    const { container } = render(<ApplicationsLoading />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    expect(screen.queryByText("No applications found.")).not.toBeInTheDocument();
  });
});
