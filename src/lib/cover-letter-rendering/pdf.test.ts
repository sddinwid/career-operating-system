import { describe, expect, it } from "vitest";
import {
  buildCoverLetterPdfBuffer,
  validateCoverLetterPdfBuffer
} from "@/lib/cover-letter-rendering/pdf";
import type { CoverLetterRenderModel } from "@/lib/cover-letter-rendering/contract";

const model: CoverLetterRenderModel = {
  candidateName: "Scott Dinwiddie",
  email: "scott@example.com",
  phone: "555-0100",
  location: "Chicago, IL",
  date: "2026-07-20",
  company: "Fieldguide",
  role: "Software Engineer",
  salutation: "Dear Hiring Team,",
  paragraphs: [
    "I am excited to apply for the Software Engineer role at Fieldguide.",
    "I have built TypeScript and PostgreSQL systems with strong product ownership."
  ],
  closing: "Thank you for your consideration.",
  signatureName: "Scott Dinwiddie",
  sourceType: "BASE_COMPOSITION",
  coverLetterCompositionVersionId: "composition-1",
  coverLetterRevisionVersionId: null,
  coverLetterAuditRunId: "audit-1",
  coverLetterApprovalId: "approval-1",
  applicationId: "application-1",
  jobDescriptionVersionId: "job-description-1",
  jobOpportunityId: "job-1",
  contentChecksum: "content-1",
  approvalStatus: "APPROVED",
  warningCount: 0,
  renderingReadiness: "READY_FOR_RENDERING",
  internalMarkers: ["approval-1", "audit-1", "evidence-1"],
  expectedSnippets: [
    "Scott Dinwiddie",
    "Fieldguide",
    "Software Engineer",
    "Dear Hiring Team,",
    "Thank you for your consideration."
  ]
};

describe("cover-letter PDF rendering", () => {
  it("builds and validates a one-page searchable PDF artifact", async () => {
    const buffer = await buildCoverLetterPdfBuffer(model);
    const validation = await validateCoverLetterPdfBuffer(buffer, model);

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(validation.valid).toBe(true);
    expect(validation.pageCount).toBe(1);
    expect(validation.totalTextItemCount).toBeGreaterThan(0);
    expect(validation.totalImageOperatorCount).toBe(0);
  });
});
