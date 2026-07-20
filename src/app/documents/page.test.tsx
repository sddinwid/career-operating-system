import { render, screen } from "@testing-library/react";
import DocumentsPage from "@/app/documents/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/documents/service", () => ({
  listDocumentWorkspaceEntries: vi.fn(async () => [
    {
      id: "doc-version-1",
      documentId: "document-1",
      title: "Fieldguide Software Engineer Resume",
      type: "RESUME",
      typeLabel: "RESUME",
      companyName: "Fieldguide",
      roleTitle: "Software Engineer (All Levels)",
      applicationId: null,
      format: "PDF",
      formatLabel: "PDF",
      filename: "Scott_Fieldguide_Resume_v2.pdf",
      generatedAt: new Date("2026-07-18T18:00:00.000Z"),
      renderStatus: "SUCCESS_WITH_WARNINGS",
      renderStatusLabel: "SUCCESS WITH WARNINGS",
      rendererVersion: "m7.2.0",
      templateVersion: "classic-1",
      approvalState: "READY WITH WARNINGS",
      fileSizeBytes: 120000,
      versionNumber: 2
    }
  ])
}));

describe("DocumentsPage", () => {
  it("renders immutable document artifact entries and download actions", async () => {
    const page = await DocumentsPage({
      searchParams: Promise.resolve({})
    });
    render(page);

    expect(screen.getByText("Fieldguide Software Engineer Resume")).toBeVisible();
    expect(screen.getByText("READY WITH WARNINGS")).toBeVisible();
    expect(screen.getByRole("link", { name: "Artifact detail" })).toHaveAttribute(
      "href",
      "/documents/doc-version-1"
    );
    expect(screen.getByRole("link", { name: "Download PDF" })).toHaveAttribute(
      "href",
      "/api/documents/doc-version-1/download"
    );
  });
});
