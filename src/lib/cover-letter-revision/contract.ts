import { z } from "zod";
import {
  coverLetterClaimSchema,
  coverLetterLengthSummarySchema,
  coverLetterParagraphSchema,
  coverLetterStyleSummarySchema,
  coverLetterSummarySchema
} from "@/lib/cover-letter-composition/contract";
import { evidenceDiagnosticSchema } from "@/lib/evidence-retrieval/contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const coverLetterRevisionVersionStatusSchema = z.enum([
  "DRAFT",
  "FINALIZED",
  "SUPERSEDED",
  "FAILED"
]);

export const coverLetterRevisionValidationStateSchema = z.enum([
  "VALID",
  "VALID_WITH_WARNINGS",
  "NEEDS_REVIEW",
  "BLOCKED"
]);

export const coverLetterRevisionChangeTypeSchema = z.enum([
  "SALUTATION_CHANGE",
  "PARAGRAPH_TEXT_CHANGE",
  "PARAGRAPH_REORDER",
  "CLOSING_CHANGE",
  "HEADER_CHANGE",
  "USER_NOTE_CHANGE"
]);

export const coverLetterRevisionParagraphSchema = coverLetterParagraphSchema.extend({
  originalText: z.string().min(1),
  currentText: z.string().min(1),
  originalOrder: z.number().int().nonnegative(),
  order: z.number().int().nonnegative(),
  originalClaims: z.array(coverLetterClaimSchema),
  editedClaimRisk: z.boolean().default(false)
});

export const coverLetterRevisionHeaderSchema = z.object({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  date: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1)
});

export const coverLetterRevisionOverallProvenanceSchema = z.object({
  overallEvidenceIds: z.array(z.string().min(1)),
  overallRequirementIds: z.array(z.string().min(1)),
  overallCareerRecordIds: z.array(z.string().min(1)),
  resumeSource: z
    .object({
      sourceType: z.enum(["BASE_COMPOSITION", "FINALIZED_REVISION"]),
      sourceId: z.string().min(1),
      sourceInputChecksum: z.string().min(1)
    })
    .nullable()
});

export const coverLetterRevisionContentSchema = z.object({
  revisionId: z.string().min(1),
  workspaceId: z.string().min(1),
  coverLetterCompositionVersionId: z.string().min(1),
  predecessorRevisionId: z.string().nullable(),
  applicationId: z.string().nullable(),
  jobOpportunityId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  careerProfileVersionId: z.string().min(1),
  requirementAnalysisId: z.string().min(1),
  evidenceRetrievalRunId: z.string().min(1),
  evidenceScoringRunId: z.string().min(1),
  matchReportRunId: z.string().min(1),
  resumeCompositionVersionId: z.string().nullable(),
  resumeRevisionVersionId: z.string().nullable(),
  coverLetterRevisionContractVersion: semanticVersionSchema,
  coverLetterRevisionEngineVersion: semanticVersionSchema,
  coverLetterRevisionConfigurationVersion: semanticVersionSchema,
  inputChecksum: z.string().min(1),
  contentChecksum: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: coverLetterRevisionVersionStatusSchema,
  validationState: coverLetterRevisionValidationStateSchema,
  candidateName: z.string().min(1),
  header: coverLetterRevisionHeaderSchema,
  salutation: z.string().min(1),
  paragraphs: z.array(coverLetterRevisionParagraphSchema).min(1),
  closing: z.string().min(1),
  summary: coverLetterSummarySchema,
  styleSummary: coverLetterStyleSummarySchema,
  lengthSummary: coverLetterLengthSummarySchema,
  overallProvenance: coverLetterRevisionOverallProvenanceSchema,
  diagnostics: z.array(evidenceDiagnosticSchema)
});

export const coverLetterRevisionChangeSchema = z.object({
  changeId: z.string().min(1),
  previousRevisionId: z.string().nullable(),
  field: z.string().min(1),
  paragraphId: z.string().nullable(),
  changeType: coverLetterRevisionChangeTypeSchema,
  originalValue: z.string().nullable(),
  revisedValue: z.string().nullable(),
  provenancePreserved: z.boolean(),
  provenanceImpactWarning: z.string().nullable()
});

export const coverLetterRevisionSummarySchema = z.object({
  predecessorRevisionId: z.string().nullable(),
  revisionStatus: coverLetterRevisionVersionStatusSchema,
  wordCount: z.number().int().nonnegative(),
  paragraphCount: z.number().int().nonnegative(),
  wordCountDelta: z.number().int(),
  paragraphCountDelta: z.number().int(),
  technologyReferenceChanges: z.number().int().nonnegative(),
  claimChanges: z.number().int().nonnegative(),
  changedFields: z.array(z.string().min(1)),
  localValidationState: coverLetterRevisionValidationStateSchema
});

export const coverLetterRevisionRecordSchema = z.object({
  content: coverLetterRevisionContentSchema,
  changeSet: z.array(coverLetterRevisionChangeSchema),
  summary: coverLetterRevisionSummarySchema,
  diagnostics: z.array(evidenceDiagnosticSchema),
  userNotes: z.string().nullable()
});

export const coverLetterRevisionSavePayloadSchema = z.object({
  revisionId: z.string().min(1),
  updatedAt: z.string().datetime(),
  content: coverLetterRevisionContentSchema,
  userNotes: z.string().nullable()
});

export type CoverLetterRevisionContent = z.infer<typeof coverLetterRevisionContentSchema>;
export type CoverLetterRevisionRecord = z.infer<typeof coverLetterRevisionRecordSchema>;
export type CoverLetterRevisionChange = z.infer<typeof coverLetterRevisionChangeSchema>;
export type CoverLetterRevisionSummary = z.infer<typeof coverLetterRevisionSummarySchema>;
export type CoverLetterRevisionSavePayload = z.infer<typeof coverLetterRevisionSavePayloadSchema>;
