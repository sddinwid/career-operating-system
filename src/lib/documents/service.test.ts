import { describe, expect, it, vi } from "vitest";
import { listDocumentWorkspaceEntries } from "@/lib/documents/service";

describe("documents service", () => {
  it("lists immutable artifact versions with filters and approval state", async () => {
    const prismaClient = {
      documentVersion: {
        findMany: vi.fn(async () => [
          {
            id: "doc-version-1",
            documentId: "document-1",
            applicationId: "application-1",
            jobDescriptionVersionId: "jd-1",
            versionNumber: 2,
            format: "PDF",
            originalFilename: "Scott_Fieldguide_Resume_v2.pdf",
            sizeBytes: 120000,
            renderStatus: "SUCCESS_WITH_WARNINGS",
            rendererVersion: "m7.2.0",
            templateVersion: "classic-1",
            generatedAt: new Date("2026-07-18T18:00:00.000Z"),
            document: {
              id: "document-1",
              title: "Fieldguide Software Engineer Resume",
              type: "RESUME",
              status: "REVIEWED"
            },
            application: {
              id: "application-1"
            },
            jobDescriptionVersion: {
              opportunity: {
                title: "Software Engineer (All Levels)",
                company: {
                  name: "Fieldguide"
                }
              }
            },
            resumeRenderingApproval: {
              renderingReadiness: "READY_WITH_WARNINGS"
            }
          }
        ])
      }
    } as never;

    const documents = await listDocumentWorkspaceEntries("workspace-1", { search: "Fieldguide" }, prismaClient);

    expect(documents).toHaveLength(1);
    expect(documents[0]?.formatLabel).toBe("PDF");
    expect(documents[0]?.renderStatusLabel).toBe("SUCCESS WITH WARNINGS");
    expect(documents[0]?.approvalState).toBe("READY WITH WARNINGS");
    expect(documents[0]?.companyName).toBe("Fieldguide");
  });
});
