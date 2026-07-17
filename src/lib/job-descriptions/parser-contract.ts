import { z } from "zod";

export const JOB_DESCRIPTION_PARSE_CONTRACT_VERSION = "1.0.0";
export const JOB_DESCRIPTION_PARSER_VERSION = "m3.2.0";
const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const confidenceLevelSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

export const diagnosticSeveritySchema = z.enum(["ERROR", "WARNING", "INFO"]);
export type DiagnosticSeverity = z.infer<typeof diagnosticSeveritySchema>;

export const sectionTypeSchema = z.enum([
  "OVERVIEW",
  "ABOUT_COMPANY",
  "ABOUT_ROLE",
  "RESPONSIBILITIES",
  "REQUIRED_QUALIFICATIONS",
  "PREFERRED_QUALIFICATIONS",
  "SKILLS",
  "COMPENSATION",
  "BENEFITS",
  "LOCATION",
  "EQUAL_OPPORTUNITY",
  "APPLICATION_INSTRUCTIONS",
  "OTHER"
]);
export type SectionType = z.infer<typeof sectionTypeSchema>;

export const extractionRuleSchema = z.string().min(1);

export const sourceLocationSchema = z.object({
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive()
});
export type SourceLocation = z.infer<typeof sourceLocationSchema>;

export const parserDiagnosticSchema = z.object({
  code: z.string().min(1),
  severity: diagnosticSeveritySchema,
  message: z.string().min(1),
  rule: extractionRuleSchema,
  location: sourceLocationSchema.nullable()
});
export type ParserDiagnostic = z.infer<typeof parserDiagnosticSchema>;

export const extractedFieldAgreementSchema = z.enum([
  "MATCH",
  "DIFFERENT",
  "MISSING_IN_SOURCE",
  "MISSING_IN_OPPORTUNITY",
  "NO_OPPORTUNITY_VALUE"
]);
export type ExtractedFieldAgreement = z.infer<typeof extractedFieldAgreementSchema>;

export const extractedScalarFieldSchema = z.object({
  value: z.string().min(1),
  confidence: confidenceLevelSchema,
  sourceText: z.string().min(1),
  sourceLocation: sourceLocationSchema,
  extractionRule: extractionRuleSchema,
  agreementWithOpportunity: extractedFieldAgreementSchema
});
export type ExtractedScalarField = z.infer<typeof extractedScalarFieldSchema>;

export const extractedNumericFieldSchema = z.object({
  value: z.number(),
  confidence: confidenceLevelSchema,
  sourceText: z.string().min(1),
  sourceLocation: sourceLocationSchema,
  extractionRule: extractionRuleSchema
});
export type ExtractedNumericField = z.infer<typeof extractedNumericFieldSchema>;

export const detectedSectionSchema = z.object({
  id: z.string().min(1),
  heading: z.string().min(1),
  type: sectionTypeSchema,
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  text: z.string(),
  confidence: confidenceLevelSchema,
  detectionRule: extractionRuleSchema
});
export type DetectedSection = z.infer<typeof detectedSectionSchema>;

export const requirementLabelSchema = z.enum([
  "REQUIRED",
  "PREFERRED",
  "MINIMUM",
  "NICE_TO_HAVE",
  "BONUS",
  "UNSPECIFIED"
]);
export type RequirementLabel = z.infer<typeof requirementLabelSchema>;

export const responsibilitySchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  normalizedText: z.string().min(1),
  sourceSectionId: z.string().min(1),
  sourceLocation: sourceLocationSchema,
  actionVerbs: z.array(z.string().min(1)),
  technologyMentions: z.array(z.string().min(1)),
  confidence: confidenceLevelSchema
});
export type Responsibility = z.infer<typeof responsibilitySchema>;

export const experienceRequirementSchema = z.object({
  id: z.string().min(1),
  minimumYears: z.number().nonnegative(),
  maximumYears: z.number().nonnegative().nullable(),
  plusIndicator: z.boolean(),
  associatedSkill: z.string().min(1).nullable(),
  sourceStatementId: z.string().min(1),
  originalText: z.string().min(1),
  confidence: confidenceLevelSchema
});
export type ExperienceRequirement = z.infer<typeof experienceRequirementSchema>;

export const qualificationRequirementSchema = z.object({
  id: z.string().min(1),
  originalText: z.string().min(1),
  normalizedText: z.string().min(1),
  sourceSectionId: z.string().min(1),
  sourceLocation: sourceLocationSchema,
  explicitLabel: requirementLabelSchema,
  experienceRequirementId: z.string().min(1).nullable(),
  degreeRequirement: z.string().min(1).nullable(),
  certificationRequirement: z.string().min(1).nullable(),
  technologyReferences: z.array(z.string().min(1)),
  domainReferences: z.array(z.string().min(1)),
  leadershipReferences: z.array(z.string().min(1)),
  confidence: confidenceLevelSchema,
  extractionRule: extractionRuleSchema
});
export type QualificationRequirement = z.infer<typeof qualificationRequirementSchema>;

export const technologyCategorySchema = z.enum([
  "PROGRAMMING_LANGUAGE",
  "FRAMEWORK",
  "DATABASE",
  "CLOUD_PLATFORM",
  "INFRASTRUCTURE",
  "DEVOPS",
  "AI_ML",
  "TESTING",
  "ARCHITECTURE",
  "SECURITY",
  "DATA",
  "METHODOLOGY",
  "SOFT_SKILL",
  "DOMAIN",
  "TOOL"
]);
export type TechnologyCategory = z.infer<typeof technologyCategorySchema>;

export const technologyMentionSchema = z.object({
  id: z.string().min(1),
  canonicalName: z.string().min(1),
  originalText: z.string().min(1),
  category: technologyCategorySchema,
  sourceRequirementIds: z.array(z.string().min(1)),
  sourceResponsibilityIds: z.array(z.string().min(1)),
  mentionCount: z.number().int().positive(),
  firstSourceLocation: sourceLocationSchema,
  aliasMatch: z.boolean(),
  confidence: confidenceLevelSchema
});
export type TechnologyMention = z.infer<typeof technologyMentionSchema>;

export const compensationSchema = z.object({
  minimumSalary: extractedNumericFieldSchema.nullable(),
  maximumSalary: extractedNumericFieldSchema.nullable(),
  currency: extractedScalarFieldSchema.nullable(),
  payPeriod: extractedScalarFieldSchema.nullable(),
  compensationText: z.string().nullable(),
  bonus: extractedScalarFieldSchema.nullable(),
  equity: extractedScalarFieldSchema.nullable(),
  commission: extractedScalarFieldSchema.nullable(),
  compensationType: extractedScalarFieldSchema.nullable(),
  locationDependentRange: z.boolean()
});
export type Compensation = z.infer<typeof compensationSchema>;

export const roleMetadataSchema = z.object({
  companyName: extractedScalarFieldSchema.nullable(),
  roleTitle: extractedScalarFieldSchema.nullable(),
  seniority: extractedScalarFieldSchema.nullable(),
  employmentType: extractedScalarFieldSchema.nullable(),
  workArrangement: extractedScalarFieldSchema.nullable(),
  location: extractedScalarFieldSchema.nullable(),
  travelRequirement: extractedScalarFieldSchema.nullable(),
  clearanceRequirement: extractedScalarFieldSchema.nullable(),
  visaWorkAuthorization: extractedScalarFieldSchema.nullable()
});
export type RoleMetadata = z.infer<typeof roleMetadataSchema>;

export const educationRequirementSchema = z.object({
  id: z.string().min(1),
  degreeLevel: z.string().min(1).nullable(),
  degreeField: z.string().min(1).nullable(),
  equivalentExperience: z.string().min(1).nullable(),
  sourceText: z.string().min(1),
  sourceLocation: sourceLocationSchema,
  confidence: confidenceLevelSchema
});
export type EducationRequirement = z.infer<typeof educationRequirementSchema>;

export const certificationRequirementSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  preferred: z.boolean(),
  sourceText: z.string().min(1),
  sourceLocation: sourceLocationSchema,
  confidence: confidenceLevelSchema
});
export type CertificationRequirement = z.infer<typeof certificationRequirementSchema>;

export const benefitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sourceText: z.string().min(1),
  sourceLocation: sourceLocationSchema,
  confidence: confidenceLevelSchema
});
export type Benefit = z.infer<typeof benefitSchema>;

export const parsedJobDescriptionContractSchema = z.object({
  contractVersion: semanticVersionSchema,
  parserVersion: semanticVersionSchema,
  parsedAt: z.string().datetime(),
  jobDescriptionVersionId: z.string().min(1),
  opportunityId: z.string().min(1),
  companyName: z.string().min(1),
  roleTitle: z.string().min(1),
  sourceUrl: z.string().url().nullable(),
  sourceChecksum: z.string().min(1),
  sections: z.array(detectedSectionSchema),
  roleMetadata: roleMetadataSchema,
  compensation: compensationSchema,
  responsibilities: z.array(responsibilitySchema),
  qualifications: z.array(qualificationRequirementSchema),
  technologies: z.array(technologyMentionSchema),
  experienceRequirements: z.array(experienceRequirementSchema),
  educationRequirements: z.array(educationRequirementSchema),
  certificationRequirements: z.array(certificationRequirementSchema),
  benefits: z.array(benefitSchema)
});
export type ParsedJobDescriptionContract = z.infer<
  typeof parsedJobDescriptionContractSchema
>;
