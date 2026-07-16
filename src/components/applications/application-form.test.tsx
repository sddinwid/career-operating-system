import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApplicationForm } from "@/components/applications/application-form";

describe("ApplicationForm", () => {
  it("shows a duplicate warning when the company name matches an existing normalized company", async () => {
    const user = userEvent.setup();

    render(
      <ApplicationForm
        action={async () => ({})}
        companies={[
          {
            id: "company-1",
            name: "Acme, Inc.",
            normalizedName: "acme inc"
          }
        ]}
        opportunities={[]}
        defaultValues={{
          companyName: "",
          role: "",
          appliedAtLocal: "2026-07-16T10:00"
        }}
        mode="create"
      />
    );

    await user.type(screen.getByLabelText("Company"), "Acme Inc");

    expect(
      screen.getByText(/saving will reuse that company record/i)
    ).toBeInTheDocument();
  });

  it("shows a separate-opportunity warning for same company and title without exact URL reuse", async () => {
    const user = userEvent.setup();

    render(
      <ApplicationForm
        action={async () => ({})}
        companies={[
          {
            id: "company-1",
            name: "Acme, Inc.",
            normalizedName: "acme inc"
          }
        ]}
        opportunities={[
          {
            id: "opp-1",
            title: "Product Designer",
            jobUrl: null,
            location: "Remote",
            workArrangement: "REMOTE",
            company: {
              id: "company-1",
              name: "Acme, Inc.",
              normalizedName: "acme inc"
            }
          }
        ]}
        defaultValues={{
          companyName: "",
          role: "",
          appliedAtLocal: "2026-07-16T10:00"
        }}
        mode="create"
      />
    );

    await user.type(screen.getByLabelText("Company"), "Acme Inc");
    await user.type(screen.getByLabelText("Role"), "Product Designer");

    expect(
      screen.getByText(/similar opportunities already exist/i)
    ).toBeInTheDocument();
  });
});
