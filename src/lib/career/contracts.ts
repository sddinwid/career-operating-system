import { z } from "zod";

const jsonLiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([jsonLiteralSchema, z.array(jsonValueSchema), z.record(jsonValueSchema)])
);

const sourceRecordKindSchema = z.enum([
  "SOURCE_FACT",
  "USER_CONFIRMED",
  "DERIVED",
  "AI_SUGGESTION"
]);

const confirmationStateSchema = z.enum([
  "UNSPECIFIED",
  "SOURCE_PROVIDED",
  "VERIFIED",
  "PROJECT_VERIFIED",
  "USER_CONFIRMED",
  "EXPIRED_REFERENCE"
]);

const datePrecisionSchema = z.enum(["YEAR", "MONTH", "DATE", "UNKNOWN"]);

const normalizedDateSchema = z.object({
  raw: z.string(),
  normalized: z.string(),
  precision: datePrecisionSchema
});

const sourceProvenanceSchema = z.object({
  sourceSection: z.string(),
  sourceId: z.string().nullable(),
  sourcePath: z.string()
});

const contactInfoSchema = z.object({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable()
});

const targetRolePositioningSchema = z.record(z.string());

const ruleEntrySchema = z.object({
  id: z.string(),
  category: z.string(),
  description: z.string(),
  recordKind: sourceRecordKindSchema,
  confirmationState: confirmationStateSchema,
  provenance: sourceProvenanceSchema
});

const stackOrderingRuleSchema = z.object({
  id: z.string(),
  roleFamily: z.string(),
  priorityOrder: z.array(z.string()),
  secondaryOrder: z.array(z.string()).optional(),
  notes: z.array(z.string()).default([]),
  preferredEvidenceIds: z.array(z.string()).default([]),
  recordKind: sourceRecordKindSchema,
  confirmationState: confirmationStateSchema,
  provenance: sourceProvenanceSchema
});

const experienceClaimRuleSetSchema = z.object({
  maxYearsPerSkill: z.number().int().positive(),
  maxYearsBeyondJobRequirement: z.number().int().nonnegative(),
  disallowContinuousClaimsForIntermittentUse: z.boolean(),
  preferProfessionalEvidenceWhenEqual: z.boolean(),
  preferRecentEvidence: z.boolean(),
  preferVerifiedMetrics: z.boolean(),
  disallowKeywordStuffing: z.boolean(),
  requireQualificationForStaleSkills: z.boolean(),
  disallowEmDashInGeneratedWriting: z.boolean()
});

const metricSchema = z.object({
  description: z.string().nullable(),
  value: z.string().nullable(),
  verificationState: confirmationStateSchema
});

const employerRecordSchema = z.object({
  id: z.string(),
  employer: z.string(),
  roleTitle: z.string(),
  startDate: normalizedDateSchema.nullable(),
  endDate: normalizedDateSchema.nullable(),
  employmentType: z.string().nullable(),
  location: z.string().nullable(),
  workArrangement: z.string().nullable(),
  domainTags: z.array(z.string()),
  themes: z.array(z.string()),
  responsibilities: z.array(z.string()),
  accomplishments: z.array(z.string()),
  technologies: z.array(z.string()),
  metrics: z.array(metricSchema),
  facts: z.array(z.string()),
  leadershipScope: z.string().nullable(),
  recordKind: sourceRecordKindSchema,
  confirmationState: confirmationStateSchema,
  provenance: sourceProvenanceSchema
});

const projectRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string().nullable(),
  status: z.string().nullable(),
  role: z.string().nullable(),
  context: z.enum(["PROFESSIONAL", "PERSONAL", "UNKNOWN"]),
  dates: z.object({
    startDate: normalizedDateSchema.nullable(),
    endDate: normalizedDateSchema.nullable()
  }),
  architecture: z.array(z.string()),
  technologies: z.array(z.string()),
  responsibilities: z.array(z.string()),
  accomplishments: z.array(z.string()),
  metrics: z.array(metricSchema),
  tradeoffs: z.array(z.string()),
  links: z.array(z.string()),
  domainTags: z.array(z.string()),
  preferredFor: z.array(z.string()),
  recordKind: sourceRecordKindSchema,
  confirmationState: confirmationStateSchema,
  provenance: sourceProvenanceSchema
});

const skillRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  professionalUse: z.boolean().nullable(),
  projectUse: z.boolean().nullable(),
  firstUse: normalizedDateSchema.nullable(),
  lastUse: normalizedDateSchema.nullable(),
  recency: z.enum(["CURRENT", "STALE", "UNKNOWN"]),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH", "UNKNOWN"]),
  evidenceReferences: z.array(z.string()),
  notes: z.string().nullable(),
  recordKind: sourceRecordKindSchema,
  confirmationState: confirmationStateSchema,
  provenance: sourceProvenanceSchema
});

const educationRecordSchema = z.object({
  id: z.string(),
  institution: z.string(),
  degree: z.string(),
  field: z.string().nullable(),
  completionDate: normalizedDateSchema.nullable(),
  status: z.string().nullable(),
  recordKind: sourceRecordKindSchema,
  confirmationState: confirmationStateSchema,
  provenance: sourceProvenanceSchema
});

const certificationRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  issuer: z.string().nullable(),
  awardDate: normalizedDateSchema.nullable(),
  expirationDate: normalizedDateSchema.nullable(),
  status: z.enum(["CURRENT", "EXPIRED", "UNKNOWN"]),
  includeByDefault: z.boolean().nullable(),
  recordKind: sourceRecordKindSchema,
  confirmationState: confirmationStateSchema,
  provenance: sourceProvenanceSchema
});

const evidenceRecordSchema = z.object({
  id: z.string(),
  evidenceType: z.string(),
  claim: z.string(),
  context: z.string().nullable(),
  metric: metricSchema.nullable(),
  associatedEmploymentId: z.string().nullable(),
  associatedProjectId: z.string().nullable(),
  technologies: z.array(z.string()),
  roleFamilyRelevance: z.array(z.string()),
  themes: z.array(z.string()),
  priority: z.number().int().nullable(),
  recordKind: sourceRecordKindSchema,
  confirmationState: confirmationStateSchema,
  provenance: sourceProvenanceSchema
});

const interviewStorySchema = z.object({
  id: z.string(),
  title: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  associatedCompetencies: z.array(z.string()),
  supportingEvidenceIds: z.array(z.string()),
  recordKind: sourceRecordKindSchema,
  confirmationState: confirmationStateSchema,
  provenance: sourceProvenanceSchema
});

export const canonicalCareerKnowledgeContractSchema = z.object({
  schemaVersion: z.string(),
  sourceSchemaVersion: z.string().nullable(),
  candidate: z.object({
    id: z.string(),
    displayName: z.string(),
    contacts: contactInfoSchema,
    location: z.string().nullable(),
    targetRoles: z.array(z.string()),
    targetRolePositioning: targetRolePositioningSchema,
    careerThemes: z.array(z.string()),
    workPreferences: jsonValueSchema.nullable(),
    writingPreferences: jsonValueSchema.nullable(),
    knownUnknowns: z.array(z.string()),
    recordKind: sourceRecordKindSchema,
    confirmationState: confirmationStateSchema,
    provenance: sourceProvenanceSchema
  }),
  generationRules: z.object({
    globalRules: z.array(ruleEntrySchema),
    stackOrderingRules: z.array(stackOrderingRuleSchema),
    experienceClaimRules: experienceClaimRuleSetSchema,
    coverLetterRules: jsonValueSchema.nullable(),
    recruiterOptimizationRules: jsonValueSchema.nullable(),
    jobDescriptionParsingRules: jsonValueSchema.nullable(),
    jobMatchingRules: jsonValueSchema.nullable(),
    outputGenerationWorkflow: jsonValueSchema.nullable()
  }),
  employment: z.array(employerRecordSchema),
  projects: z.array(projectRecordSchema),
  skills: z.array(skillRecordSchema),
  education: z.array(educationRecordSchema),
  certifications: z.array(certificationRecordSchema),
  evidence: z.array(evidenceRecordSchema),
  interviewStories: z.array(interviewStorySchema)
});

const sourceObjectSchema = z.record(jsonValueSchema);

export const sourceCareerKnowledgeSchema = z
  .object({
    _meta: sourceObjectSchema,
    candidateProfile: sourceObjectSchema,
    resumeGenerationRules: sourceObjectSchema,
    skills: z.array(sourceObjectSchema),
    professionalExperience: z.array(sourceObjectSchema),
    projects: z.array(sourceObjectSchema),
    education: z.array(sourceObjectSchema),
    certifications: z.array(sourceObjectSchema),
    writingPreferences: sourceObjectSchema,
    jobDescriptionParsingRules: sourceObjectSchema,
    jobMatchingRules: sourceObjectSchema,
    accomplishments: z.array(sourceObjectSchema),
    resumeBullets: z.array(sourceObjectSchema),
    architectureExamples: z.array(sourceObjectSchema),
    leadershipExamples: z.array(sourceObjectSchema),
    productionExamples: z.array(sourceObjectSchema),
    interviewStories: z.array(sourceObjectSchema),
    domainExperience: z.array(sourceObjectSchema),
    outputGenerationWorkflow: sourceObjectSchema,
    outputTemplates: sourceObjectSchema,
    knownUnknowns: z.array(z.string()).optional().default([])
  })
  .catchall(jsonValueSchema);

export type CanonicalCareerKnowledgeContract = z.infer<
  typeof canonicalCareerKnowledgeContractSchema
>;
export type SourceCareerKnowledge = z.infer<typeof sourceCareerKnowledgeSchema>;
export type CareerRuleEntry = z.infer<typeof ruleEntrySchema>;
export type CareerStackOrderingRule = z.infer<typeof stackOrderingRuleSchema>;
export type CareerEvidenceRecord = z.infer<typeof evidenceRecordSchema>;
export type CareerFindingSeverity = "ERROR" | "WARNING" | "INFO";

export const CAREER_CONTRACT_VERSION = "1.0.0";
export const CAREER_IMPORTER_VERSION = "m2.1.0";
