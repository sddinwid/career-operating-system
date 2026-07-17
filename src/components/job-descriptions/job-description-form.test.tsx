import { render, screen } from "@testing-library/react";
import { JobDescriptionSourceType } from "@prisma/client";

const { useActionStateMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn()
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: useActionStateMock
  };
});

import { JobDescriptionForm } from "@/components/job-descriptions/job-description-form";

describe("JobDescriptionForm", () => {
  beforeEach(() => {
    useActionStateMock.mockReturnValue([{}, vi.fn()]);
  });

  it("renders application intake with prefilled metadata and the career-knowledge-ready indicator", () => {
    render(
      <JobDescriptionForm
        action={vi.fn(async () => ({}))}
        cancelHref="/applications/application-1"
        careerKnowledgeLabel="Career Knowledge: Version 1.0.0 available"
        defaultValues={{
          companyName: "Acme",
          role: "Senior Engineer",
          descriptionText: "Original text",
          sourceUrl: "https://company.example/jobs/1",
          sourceType: JobDescriptionSourceType.MANUAL_PASTE,
          publishedAt: "2026-07-15"
        }}
        existingJobUrl="https://company.example/jobs/1"
        mode="application"
        pageTitle="Add job description"
        pageDescription="Preserve the original text."
      />
    );

    expect(screen.getByText("Acme")).toBeVisible();
    expect(screen.getByText("Senior Engineer")).toBeVisible();
    expect(
      screen.getByText("Career Knowledge: Version 1.0.0 available")
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Job description text" })
    ).toHaveValue("Original text");
  });

  it("renders validation and error state messages from the server action", () => {
    useActionStateMock.mockReturnValue([
      {
        formError: "Please fix the highlighted fields and try again.",
        fieldErrors: {
          descriptionText: ["Job description text is required"],
          sourceUrl: ["Use a valid URL"]
        }
      },
      vi.fn()
    ]);

    render(
      <JobDescriptionForm
        action={vi.fn(async () => ({}))}
        cancelHref="/applications/application-1"
        careerKnowledgeLabel="Career Knowledge unavailable"
        defaultValues={{
          companyName: "Acme",
          role: "Senior Engineer",
          descriptionText: "",
          sourceType: JobDescriptionSourceType.MANUAL_PASTE
        }}
        mode="application"
        pageTitle="Add job description"
        pageDescription="Preserve the original text."
      />
    );

    expect(
      screen.getByText("Please fix the highlighted fields and try again.")
    ).toBeVisible();
    expect(screen.getByText("Job description text is required")).toBeVisible();
    expect(screen.getByText("Use a valid URL")).toBeVisible();
  });

  it("renders the standalone new-opportunity workflow with company and role inputs and a cancel link", () => {
    render(
      <JobDescriptionForm
        action={vi.fn(async () => ({}))}
        cancelHref="/applications"
        careerKnowledgeLabel="Career Knowledge unavailable"
        defaultValues={{
          companyName: "",
          role: "",
          jobUrl: "",
          opportunitySource: "",
          descriptionText: "",
          sourceType: JobDescriptionSourceType.JOB_BOARD
        }}
        mode="new-opportunity"
        pageTitle="Capture a new job description"
        pageDescription="Create a saved opportunity."
      />
    );

    expect(screen.getByRole("textbox", { name: "Company" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Role" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/applications"
    );
  });
});
