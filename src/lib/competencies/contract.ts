import { z } from "zod";
import { requirementKindSchema } from "@/lib/job-descriptions/requirement-analysis-contract";

export const COMPETENCY_CATALOG_CONTRACT_VERSION = "1.0.0";
export const COMPETENCY_CATALOG_VERSION = "m8.8.0";
export const COMPETENCY_MAPPING_ENGINE_VERSION = "m8.8.0";

export const competencyCategorySchema = z.enum([
  "SOFTWARE_ENGINEERING",
  "BACKEND_ENGINEERING",
  "API_ENGINEERING",
  "SYSTEM_DESIGN",
  "DISTRIBUTED_SYSTEMS",
  "PERFORMANCE",
  "RELIABILITY",
  "TESTING_AND_QUALITY",
  "CLOUD_AND_INFRASTRUCTURE",
  "DATA_AND_STORAGE",
  "SECURITY",
  "AI_AND_SEARCH",
  "DELIVERY_AND_OPERATIONS",
  "LEADERSHIP",
  "COMMUNICATION",
  "COLLABORATION",
  "OWNERSHIP_AND_EXECUTION",
  "PRODUCT_AND_BUSINESS",
  "LEARNING_AND_ADAPTABILITY",
  "DOMAIN"
]);
export type CompetencyCategory = z.infer<typeof competencyCategorySchema>;

export const competencyRelationshipStrengthSchema = z.enum([
  "EXACT",
  "DIRECT",
  "STRONG_IMPLICATION",
  "SUPPORTING",
  "WEAK_RELATED",
  "NONE"
]);
export type CompetencyRelationshipStrength = z.infer<
  typeof competencyRelationshipStrengthSchema
>;

export const competencyEvidenceFamilySchema = z.enum([
  "PROFESSIONAL_ACCOMPLISHMENT",
  "PROFESSIONAL_METRIC",
  "PROFESSIONAL_RESPONSIBILITY",
  "PRODUCTION_EXAMPLE",
  "PROFESSIONAL_ROLE",
  "LEADERSHIP_EXAMPLE",
  "ARCHITECTURE_EXAMPLE",
  "INTERVIEW_STORY",
  "PROJECT_ACCOMPLISHMENT",
  "PROJECT_ARCHITECTURE",
  "PROJECT_RECORD",
  "EDUCATION",
  "ACTIVE_CERTIFICATION",
  "EXPIRED_CERTIFICATION",
  "SKILL_DECLARATION",
  "RESUME_BULLET",
  "OTHER"
]);
export type CompetencyEvidenceFamily = z.infer<typeof competencyEvidenceFamilySchema>;

export const competencyDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: competencyCategorySchema,
  description: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  requirementSignals: z.array(z.string().min(1)).default([]),
  evidenceSignals: z.array(z.string().min(1)).default([]),
  technologySignals: z.array(z.string().min(1)).default([]),
  parentCompetencyIds: z.array(z.string().min(1)).default([]),
  relatedCompetencyIds: z.array(z.string().min(1)).default([]),
  stronglyImpliedCompetencyIds: z.array(z.string().min(1)).default([]),
  weaklyRelatedCompetencyIds: z.array(z.string().min(1)).default([]),
  allowedRequirementKinds: z.array(requirementKindSchema).default([]),
  preferredEvidenceFamilies: z.array(competencyEvidenceFamilySchema).default([]),
  disallowedEvidenceFamilies: z.array(competencyEvidenceFamilySchema).default([]),
  minimumRelationshipStrength: competencyRelationshipStrengthSchema,
  version: z.string().min(1)
});
export type CompetencyDefinition = z.infer<typeof competencyDefinitionSchema>;

export const competencyCatalogSchema = z.object({
  contractVersion: z.string().min(1),
  catalogVersion: z.string().min(1),
  competencies: z.array(competencyDefinitionSchema)
});
export type CompetencyCatalog = z.infer<typeof competencyCatalogSchema>;

export const matchedCompetencySchema = z.object({
  competencyId: z.string().min(1),
  competencyName: z.string().min(1),
  category: competencyCategorySchema,
  relationshipStrength: competencyRelationshipStrengthSchema,
  matchedSignals: z.array(z.string().min(1)),
  explanation: z.string().min(1),
  direct: z.boolean(),
  inferred: z.boolean()
});
export type MatchedCompetency = z.infer<typeof matchedCompetencySchema>;

export const requirementCompetencyComponentSchema = z.object({
  componentId: z.string().min(1),
  label: z.string().min(1),
  competencyId: z.string().min(1).nullable(),
  competencyName: z.string().min(1).nullable(),
  relationshipStrength: competencyRelationshipStrengthSchema,
  matchedSignals: z.array(z.string().min(1)),
  oneOfGroup: z.string().nullable(),
  direct: z.boolean(),
  inferred: z.boolean(),
  explanation: z.string().min(1)
});
export type RequirementCompetencyComponent = z.infer<
  typeof requirementCompetencyComponentSchema
>;

export const careerKnowledgeOpportunitySchema = z.object({
  requirementId: z.string().min(1),
  requirementTitle: z.string().min(1),
  competencyId: z.string().min(1).nullable(),
  competencyName: z.string().min(1).nullable(),
  currentEvidence: z.array(z.string().min(1)),
  insufficiencyReason: z.string().min(1),
  suggestedReviewAction: z.string().min(1)
});
export type CareerKnowledgeOpportunity = z.infer<
  typeof careerKnowledgeOpportunitySchema
>;
