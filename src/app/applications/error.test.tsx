import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApplicationsError from "@/app/applications/error";

describe("ApplicationsError", () => {
  it("renders a friendly retry state", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();

    render(
      <ApplicationsError
        error={new Error("The applications service timed out.")}
        reset={reset}
      />
    );

    expect(screen.getByText("Applications are unavailable")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
