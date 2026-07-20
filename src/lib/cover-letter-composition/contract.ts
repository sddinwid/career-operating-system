import { z } from "zod";
import { canonicalCareerKnowledgeContractSchema, jsonValueSchema } from "@/lib/career/contracts";
import { evidenceDiagnosticSchema, evidenceRestrictionSchema } from "@/lib/evidence-retrieval/contract";
import { evidenceScoringResultSchema } from "@/lib/evidence-scoring/contract";
import { jobRequirementAnalysisContractSchema, requirementKindSchema } from "@/lib/job-descriptions/requirement-analysis-contract";
import { matchReportResultSchema } from "@/lib/match-report/contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const coverLetterCompositionVersionStatusSchema = z.enum([
  "PENDING",
  "SUCCESS",
  "SUCCESS_WITH_WARNINGS",
  "FAILED"
]);
export type CoverLetterCompositionVersionStatus = z.infer<
  typeof coverLetterCompositionVersionStatusSchema
>;

export const coverLetterParagraphTypeSchema = z.enum([
  "OPENING",
  "INTEREST_AND_ALIGNMENT",
  "RELEVANT_EVIDENCE",
  "ENGINEERING_APPROACH",
  "CLOSING"
]);
export type CoverLetterParagraphType = z.infer<typeof coverLetterParagraphTypeSchema>;

export const coverLetterClaimTypeSchema = z.enum([
  "EXPERIENCE",
  "TECHNOLOGY",
  "RESPONSIBILITY",
  "ARCHITECTURE",
  "LEADERSHIP",
  "DOMAIN",
  "MOTIVATION",
  "WORK_STYLE",
  "IMPACT",
  "EDUCATION",
  "CERTIFICATION"
]);

export const coverLetterClaimSchema = z.object({
  id: z.string().min(1),
  type: coverLetterClaimTypeSchema,
  text: z.string().min(1),
  qualified: z.boolean(),
  evidenceContext: z.enum(["PROFESSIONAL", "PROJECT", "MIXED", "OTHER"]),
  restrictions: z.array(evidenceRestrictionSchema)
});

export const coverLetterParagraphSchema = z.object({
  id: z.string().min(1),
  type: coverLetterParagraphTypeSchema,
  purpose: z.string().min(1),
  text: z.string().min(1),
  wordCount: z.number().int().positive(),
  supportingEvidenceIds: z.array(z.string().min(1)),
  supportingRequirementIds: z.array(z.string().min(1)),
  supportingMatchReportConclusionIds: z.array(z.string().min(1)),
  sourceCareerRecordIds: z.array(z.string().min(1)),
  sourceResumeSectionIds: z.array(z.string().min(1)),
  acknowledgements: z.array(z.string().min(1)),
  claims: z.array(coverLetterClaimSchema),
  technologies: z.array(z.string().min(1)),
  companyReferences: z.array(z.string().min(1)),
  roleReferences: z.array(z.string().min(1)),
  diagnostics: z.array(evidenceDiagnosticSchema)
});
export type CoverLetterParagraph = z.infer<typeof coverLetterParagraphSchema>;

export const coverLetterSummarySchema = z.object({
  targetCompany: z.string().min(1),
  targetRole: z.string().min(1),
  wordCount: z.number().int().nonnegative(),
  paragraphCount: z.number().int().nonnegative(),
  companyReferenceCount: z.number().int().nonnegative(),
  roleReferenceCount: z.number().int().nonnegative(),
  technologyMentionCount: z.number().int().nonnegative(),
  professionalEvidenceParagraphCount: z.number().int().nonnegative(),
  projectEvidenceParagraphCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
  errorCount: z.number().int().nonnegative(),
  infoCount: z.number().int().nonnegative(),
  resumeOverlapRatio: z.number().min(0).max(1),
  resumeSourceUsed: z.boolean(),
  professionalEvidencePrioritized: z.boolean()
});

export const coverLetterStyleSummarySchema = z.object({
  salutation: z.string().min(1),
  closing: z.string().min(1),
  voice: z.enum(["DIRECT", "RESTRAINED", "QUALIFIED"]),
  noEmDashDetected: z.boolean(),
  prohibitedPhrasesDetected: z.array(z.string().min(1))
});

export const coverLetterLengthSummarySchema = z.object({
  targetMinWords: z.number().int().positive(),
  targetMaxWords: z.number().int().positive(),
  actualWords: z.number().int().nonnegative(),
  targetMinParagraphs: z.number().int().positive(),
  targetMaxParagraphs: z.number().int().positive(),
  actualParagraphs: z.number().int().nonnegative(),
  withinTargetRange: z.boolean()
});

export const coverLetterResumeSourceSchema = z
  .object({
    sourceType: z.enum(["BASE_COMPOSITION", "FINALIZED_REVISION"]),
    sourceId: z.string().min(1),
    sourceInputChecksum: z.string().min(1),
    plainText: z.string().min(1)
  })
  .nullable();

export const coverLetterCompositionContentSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
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
  coverLetterCompositionContractVersion: semanticVersionSchema,
  coverLetterCompositionEngineVersion: semanticVersionSchema,
  coverLetterCompositionConfigurationVersion: semanticVersionSchema,
  createdAt: z.string().datetime(),
  inputChecksum: z.string().min(1),
  status: coverLetterCompositionVersionStatusSchema,
  candidateName: z.string().min(1),
  header: z.object({
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    date: z.string().min(1),
    company: z.string().min(1),
    role: z.string().min(1),
    salutation: z.string().min(1)
  }),
  diagnostics: z.array(evidenceDiagnosticSchema),
  summary: coverLetterSummarySchema,
  styleSummary: coverLetterStyleSummarySchema,
  lengthSummary: coverLetterLengthSummarySchema,
  paragraphs: z.array(coverLetterParagraphSchema),
  closing: z.string().min(1),
  plainText: z.string().min(1),
  provenance: z.object({
    overallEvidenceIds: z.array(z.string().min(1)),
    overallRequirementIds: z.array(z.string().min(1)),
    overallCareerRecordIds: z.array(z.string().min(1)),
    resumeSource: coverLetterResumeSourceSchema
  })
});
export type CoverLetterCompositionContent = z.infer<typeof coverLetterCompositionContentSchema>;

export const coverLetterCompositionInputSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  applicationId: z.string().nullable(),
  jobOpportunityId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  careerProfileVersionId: z.string().min(1),
  requirementAnalysisId: z.string().min(1),
  evidenceRetrievalRunId: z.string().min(1),
  evidenceScoringRunId: z.string().min(1),
  matchReportRunId: z.string().min(1),
  targetCompany: z.string().min(1),
  targetRole: z.string().min(1),
  createdAt: z.string().datetime(),
  inputChecksum: z.string().min(1),
  careerProfileContent: canonicalCareerKnowledgeContractSchema,
  requirementAnalysis: jobRequirementAnalysisContractSchema,
  retrievalResult: jsonValueSchema,
  scoringResult: evidenceScoringResultSchema,
  matchReportResult: matchReportResultSchema,
  resumeSource: coverLetterResumeSourceSchema
});
export type CoverLetterCompositionInput = z.infer<typeof coverLetterCompositionInputSchema>;
