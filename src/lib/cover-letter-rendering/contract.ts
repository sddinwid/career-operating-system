import { z } from "zod";

export const coverLetterRenderSourceTypeSchema = z.enum([
  "BASE_COMPOSITION",
  "FINALIZED_REVISION"
]);

export const coverLetterRenderModelSchema = z.object({
  candidateName: z.string().min(1),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  date: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  salutation: z.string().min(1),
  paragraphs: z.array(z.string().min(1)).min(1),
  closing: z.string().min(1),
  signatureName: z.string().min(1),
  sourceType: coverLetterRenderSourceTypeSchema,
  coverLetterCompositionVersionId: z.string().min(1),
  coverLetterRevisionVersionId: z.string().nullable(),
  coverLetterAuditRunId: z.string().min(1),
  coverLetterApprovalId: z.string().min(1),
  applicationId: z.string().nullable(),
  jobDescriptionVersionId: z.string().min(1),
  jobOpportunityId: z.string().min(1),
  contentChecksum: z.string().min(1),
  approvalStatus: z.enum(["APPROVED", "REVOKED", "SUPERSEDED"]),
  warningCount: z.number().int().nonnegative(),
  renderingReadiness: z.string().min(1),
  internalMarkers: z.array(z.string().min(1)),
  expectedSnippets: z.array(z.string().min(1)).min(5)
});

export type CoverLetterRenderModel = z.infer<typeof coverLetterRenderModelSchema>;
