import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/documents/[documentVersionId]/download/route";
import {
  buildContentDisposition,
  DocumentRenderingArtifactError,
  readDocumentVersionFile
} from "@/lib/document-rendering/service";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/document-rendering/service", () => ({
  buildContentDisposition: vi.fn((filename: string) => `attachment; filename="${filename}"`),
  DocumentRenderingArtifactError: class DocumentRenderingArtifactError extends Error {
    status: number;
    code: string;

    constructor(args: { message: string; status: number; code: string; name: string }) {
      super(args.message);
      this.status = args.status;
      this.code = args.code;
      this.name = args.name;
    }
  },
  readDocumentVersionFile: vi.fn()
}));

const mockReadDocumentVersionFile = vi.mocked(readDocumentVersionFile);
const mockBuildContentDisposition = vi.mocked(buildContentDisposition);

describe("document download route", () => {
  it("streams successful DOCX downloads with a safe content disposition", async () => {
    mockReadDocumentVersionFile.mockResolvedValueOnce({
      version: {
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        originalFilename: "Fixture Candidate_Acme_Senior_Engineer_Resume_v1.docx"
      },
      buffer: Buffer.from("docx-bytes")
    } as never);

    const response = await GET(new Request("http://localhost/api/documents/document-1/download"), {
      params: Promise.resolve({ documentVersionId: "document-1" })
    });

    expect(mockReadDocumentVersionFile).toHaveBeenCalledWith("workspace-1", "document-1");
    expect(mockBuildContentDisposition).toHaveBeenCalledWith(
      "Fixture Candidate_Acme_Senior_Engineer_Resume_v1.docx"
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(response.headers.get("Content-Disposition")).toContain(".docx");
    await expect(response.arrayBuffer()).resolves.toBeInstanceOf(ArrayBuffer);
  });

  it("returns 404 for a missing document version without exposing storage paths", async () => {
    mockReadDocumentVersionFile.mockRejectedValueOnce(
      new DocumentRenderingArtifactError({
        message: "Document version not found.",
        status: 404,
        code: "DOCUMENT_VERSION_NOT_FOUND",
        name: "DocumentVersionNotFoundError"
      })
    );

    const response = await GET(new Request("http://localhost/api/documents/missing/download"), {
      params: Promise.resolve({ documentVersionId: "missing" })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      code: "DOCUMENT_VERSION_NOT_FOUND"
    });
  });

  it("returns an integrity error for failed or mismatched artifacts", async () => {
    mockReadDocumentVersionFile.mockRejectedValueOnce(
      new DocumentRenderingArtifactError({
        message: "Only successfully rendered document versions can be downloaded.",
        status: 409,
        code: "DOCUMENT_VERSION_NOT_READY",
        name: "DocumentVersionNotReadyError"
      })
    );

    const failedResponse = await GET(new Request("http://localhost/api/documents/failed/download"), {
      params: Promise.resolve({ documentVersionId: "failed" })
    });

    expect(failedResponse.status).toBe(409);
    await expect(failedResponse.json()).resolves.toMatchObject({
      code: "DOCUMENT_VERSION_NOT_READY"
    });

    mockReadDocumentVersionFile.mockRejectedValueOnce(
      new DocumentRenderingArtifactError({
        message: "The rendered document checksum no longer matches the persisted metadata.",
        status: 409,
        code: "DOCUMENT_CHECKSUM_MISMATCH",
        name: "DocumentChecksumMismatchError"
      })
    );

    const mismatchResponse = await GET(
      new Request("http://localhost/api/documents/mismatch/download"),
      {
        params: Promise.resolve({ documentVersionId: "mismatch" })
      }
    );

    expect(mismatchResponse.status).toBe(409);
    const body = await mismatchResponse.json();
    expect(body).toMatchObject({
      code: "DOCUMENT_CHECKSUM_MISMATCH"
    });
    expect(JSON.stringify(body)).not.toContain("C:\\");
    expect(JSON.stringify(body)).not.toContain("/tmp/");
  });

  it("returns 410 when the file is missing from local storage", async () => {
    mockReadDocumentVersionFile.mockRejectedValueOnce(
      new DocumentRenderingArtifactError({
        message: "The rendered document file is missing from local storage.",
        status: 410,
        code: "DOCUMENT_FILE_MISSING",
        name: "DocumentFileMissingError"
      })
    );

    const response = await GET(new Request("http://localhost/api/documents/gone/download"), {
      params: Promise.resolve({ documentVersionId: "gone" })
    });

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      code: "DOCUMENT_FILE_MISSING"
    });
  });
});
