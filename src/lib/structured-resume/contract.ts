import { z } from "zod";
import { evidenceDiagnosticSchema } from "@/lib/evidence-retrieval/contract";
import { canonicalCareerKnowledgeContractSchema } from "@/lib/career/contracts";
import {
  claimHandlingCategorySchema,
  matchReportResultSchema,
  resumeReadinessStateSchema
} from "@/lib/match-report/contract";

const semanticVersionSchema = z.string().regex(/^[A-Za-z0-9.-]+$/);

export const structuredResumeVersionStatusSchema = z.enum([
  "PENDING",
  "READY",
  "READY_WITH_LIMITATIONS",
  "NEEDS_REVIEW",
  "FAILED",
  "SUPERSEDED"
]);
export type StructuredResumeVersionStatus = z.infer<typeof structuredResumeVersionStatusSchema>;

export const targetRoleFamilySchema = z.enum([
  "GENERAL_BACKEND",
  "PYTHON_BACKEND",
  "NODE_TYPESCRIPT_BACKEND",
  "MICROSOFT_DOTNET",
  "JAVA_KOTLIN",
  "AI_AGENTIC",
  "FULL_STACK",
  "TECHNICAL_LEADERSHIP",
  "OTHER"
]);
export type TargetRoleFamily = z.infer<typeof targetRoleFamilySchema>;

export const stackRuleFamilySchema = z.enum([
  "GENERAL_BACKEND",
  "PYTHON_BACKEND",
  "NODE_TYPESCRIPT_BACKEND",
  "MICROSOFT_DOTNET",
  "JAVA_KOTLIN",
  "AI_AGENTIC",
  "OTHER"
]);
export type StackRuleFamily = z.infer<typeof stackRuleFamilySchema>;

export const sectionTypeSchema = z.enum([
  "HEADER",
  "PROFESSIONAL_SUMMARY",
  "CORE_SKILLS",
  "PROFESSIONAL_EXPERIENCE",
  "SELECTED_PROJECTS",
  "EDUCATION",
  "CERTIFICATIONS",
  "ADDITIONAL_INFORMATION"
]);
export type SectionType = z.infer<typeof sectionTypeSchema>;

export const skillDecisionSchema = z.enum(["INCLUDE", "QUALIFY", "DEFER", "EXCLUDE"]);
export const roleSelectionStatusSchema = z.enum([
  "INCLUDE",
  "CONSIDER",
  "BACKGROUND_ONLY",
  "EXCLUDE"
]);
export const projectSelectionStatusSchema = z.enum(["INCLUDE", "CONSIDER", "EXCLUDE"]);
export const bulletEligibilityStatusSchema = z.enum([
  "PRIMARY",
  "SECONDARY",
  "QUALIFIED_ONLY",
  "PROJECT_ONLY",
  "BACKGROUND_ONLY",
  "EXCLUDED"
]);
export const budgetStatusSchema = z.enum(["WITHIN_TARGET", "AT_RISK", "OVER_BUDGET"]);

export const headerFieldPlanSchema = z.object({
  field: z.enum([
    "NAME",
    "EMAIL",
    "PHONE",
    "LOCATION",
    "LINKEDIN",
    "GITHUB",
    "PORTFOLIO",
    "WORK_AUTHORIZATION"
  ]),
  include: z.boolean(),
  sourcePath: z.string().nullable(),
  reason: z.string().min(1)
});

export const sectionPlanSchema = z.object({
  sectionType: sectionTypeSchema,
  enabled: z.boolean(),
  required: z.boolean(),
  order: z.number().int().nonnegative(),
  maximumItemCount: z.number().int().nonnegative(),
  maximumEstimatedLines: z.number().int().nonnegative(),
  sourceRules: z.array(z.string().min(1)),
  eligibilityDiagnostics: z.array(z.string().min(1)),
  locked: z.boolean(),
  omissionReason: z.string().nullable()
});

export const summaryBlueprintSchema = z.object({
  targetRoleLabel: z.string().min(1),
  maximumSentenceCount: z.number().int().positive(),
  maximumWordCount: z.number().int().positive(),
  coreEvidenceThemes: z.array(z.string().min(1)),
  priorityTechnologies: z.array(z.string().min(1)),
  leadershipEmphasis: z.boolean(),
  domainEmphasis: z.boolean(),
  architectureEmphasis: z.boolean(),
  aiEmphasis: z.boolean(),
  claimsProhibited: z.array(z.string().min(1)),
  experienceClaimsPermitted: z.array(
    z.object({
      technology: z.string().min(1),
      maximumPermittedClaimYears: z.number().int().positive(),
      requestedYears: z.number().int().nonnegative().nullable(),
      maximumJobAlignedClaimYears: z.number().int().positive(),
      intermittentUse: z.boolean(),
      wordingPolicy: z.enum([
        "DIRECT",
        "QUALIFY_INTERMITTENT",
        "QUALIFY_STALE",
        "QUALIFY_PROJECT_ONLY"
      ])
    })
  ),
  toneRules: z.array(z.string().min(1)),
  styleRules: z.array(z.string().min(1)),
  requiredDifferentiators: z.array(z.string().min(1)),
  sourceEvidenceIds: z.array(z.string().min(1))
});

export const skillPlanEntrySchema = z.object({
  canonicalSkill: z.string().min(1),
  displayValue: z.string().min(1),
  group: z.enum([
    "LANGUAGES",
    "BACKEND",
    "FRONTEND",
    "DATA",
    "CLOUD_INFRASTRUCTURE",
    "AI_ML",
    "ARCHITECTURE",
    "DEVOPS",
    "TESTING",
    "OTHER"
  ]),
  priority: z.number().int().nonnegative(),
  requirementIds: z.array(z.string().min(1)),
  supportingEvidenceIds: z.array(z.string().min(1)),
  professionalUse: z.boolean(),
  projectUse: z.boolean(),
  recency: z.enum(["CURRENT", "RECENT", "OLDER", "STALE", "UNKNOWN"]),
  restrictions: z.array(z.string().min(1)),
  decision: skillDecisionSchema,
  decisionReason: z.string().min(1),
  stackOrderProvenance: z.string().min(1)
});

export const rolePlanSchema = z.object({
  roleId: z.string().min(1),
  employer: z.string().nullable(),
  roleTitle: z.string().nullable(),
  dates: z.object({
    start: z.string().nullable(),
    end: z.string().nullable()
  }),
  professionalContext: z.boolean(),
  targetRequirementCoverage: z.array(z.string().min(1)),
  strongEvidenceCount: z.number().int().nonnegative(),
  goodEvidenceCount: z.number().int().nonnegative(),
  limitedEvidenceCount: z.number().int().nonnegative(),
  priorityTechnologies: z.array(z.string().min(1)),
  relevantAccomplishments: z.array(z.string().min(1)),
  relevantResponsibilities: z.array(z.string().min(1)),
  relevantMetrics: z.array(z.string().min(1)),
  recency: z.enum(["CURRENT", "RECENT", "OLDER", "STALE", "UNKNOWN"]),
  selectionStatus: roleSelectionStatusSchema,
  selectionReason: z.string().min(1),
  maximumBulletBudget: z.number().int().nonnegative(),
  eligibleEvidenceIds: z.array(z.string().min(1)),
  excludedEvidenceIds: z.array(z.string().min(1)),
  restrictions: z.array(z.string().min(1)),
  requiredQualificationNotes: z.array(z.string().min(1))
});

export const projectPlanSchema = z.object({
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  context: z.enum(["PROFESSIONAL", "PERSONAL", "UNKNOWN"]),
  requirementCoverage: z.array(z.string().min(1)),
  strongestEvidence: z.enum(["STRONG", "GOOD", "LIMITED", "WEAK", "NONE"]),
  technologies: z.array(z.string().min(1)),
  architecture: z.array(z.string().min(1)),
  metrics: z.array(z.string().min(1)),
  recency: z.enum(["CURRENT", "RECENT", "OLDER", "STALE", "UNKNOWN"]),
  selectionStatus: projectSelectionStatusSchema,
  selectionReason: z.string().min(1),
  maximumBulletBudget: z.number().int().nonnegative(),
  eligibleEvidenceIds: z.array(z.string().min(1)),
  restrictions: z.array(z.string().min(1)),
  projectOnlyWarning: z.string().nullable(),
  resumeUseGuidance: z.string().min(1)
});

export const bulletEvidenceCandidateSchema = z.object({
  evidenceId: z.string().min(1),
  parentType: z.enum(["ROLE", "PROJECT", "OTHER"]),
  parentId: z.string().nullable(),
  requirementIds: z.array(z.string().min(1)),
  candidateScore: z.number().int().nullable(),
  strengthBand: z.enum(["STRONG", "GOOD", "LIMITED", "WEAK", "INELIGIBLE", "UNKNOWN"]),
  evidenceType: z.string().min(1),
  claimText: z.string().min(1),
  metric: z.string().nullable(),
  metricVerification: z.string().nullable(),
  technologies: z.array(z.string().min(1)),
  context: z.enum(["PROFESSIONAL", "PROJECT", "EDUCATION", "CERTIFICATION", "OTHER"]),
  recency: z.enum(["CURRENT", "RECENT", "OLDER", "STALE", "UNKNOWN"]),
  restrictions: z.array(z.string().min(1)),
  includeEligibility: bulletEligibilityStatusSchema,
  wordingConstraints: z.array(z.string().min(1)),
  duplicationGroupId: z.string().nullable(),
  priority: z.number().int().nonnegative(),
  sourceProvenance: z.object({
    sourceSection: z.string().min(1),
    sourceId: z.string().nullable(),
    sourcePath: z.string().min(1)
  })
});

export const planClaimToAvoidSchema = z.object({
  claimConcept: z.string().min(1),
  requirementIds: z.array(z.string().min(1)),
  evidenceIds: z.array(z.string().min(1)),
  handlingCategory: claimHandlingCategorySchema.or(z.literal("BACKGROUND_ONLY")),
  reason: z.string().min(1),
  truthfulnessRule: z.string().min(1),
  affectedSections: z.array(sectionTypeSchema),
  alternativeSafeTreatment: z.string().min(1)
});

export const duplicationGroupSchema = z.object({
  duplicationGroupId: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)),
  preferredPlacement: z.string().min(1),
  maximumAllowedUses: z.number().int().positive(),
  reason: z.string().min(1)
});

export const pageBudgetSchema = z.object({
  targetPages: z.number().int().positive(),
  maximumPages: z.number().int().positive(),
  estimatedPages: z.number().positive(),
  budgetStatus: budgetStatusSchema,
  sectionBudgets: z.array(
    z.object({
      sectionType: sectionTypeSchema,
      allocatedLines: z.number().int().nonnegative(),
      estimatedLines: z.number().int().nonnegative()
    })
  )
});

export const structuredResumeSummarySchema = z.object({
  targetCompany: z.string().min(1),
  targetRole: z.string().min(1),
  targetRoleFamily: targetRoleFamilySchema,
  resumeReadiness: resumeReadinessStateSchema,
  selectedStackRule: stackRuleFamilySchema,
  enabledSections: z.array(sectionTypeSchema),
  selectedRoles: z.number().int().nonnegative(),
  selectedProjects: z.number().int().nonnegative(),
  eligiblePrimaryEvidenceCount: z.number().int().nonnegative(),
  qualifiedOnlyEvidenceCount: z.number().int().nonnegative(),
  excludedEvidenceCount: z.number().int().nonnegative(),
  priorityTechnologies: z.array(z.string().min(1)),
  claimsToAvoidCount: z.number().int().nonnegative(),
  estimatedPageCount: z.number().positive(),
  budgetStatus: budgetStatusSchema,
  diagnosticErrorCount: z.number().int().nonnegative(),
  diagnosticWarningCount: z.number().int().nonnegative(),
  diagnosticInfoCount: z.number().int().nonnegative()
});

export const structuredResumePlanSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  careerProfileVersionId: z.string().min(1),
  requirementAnalysisId: z.string().min(1),
  evidenceRetrievalRunId: z.string().min(1),
  evidenceScoringRunId: z.string().min(1),
  matchReportRunId: z.string().min(1),
  jobDescriptionVersionId: z.string().min(1),
  applicationId: z.string().nullable(),
  structuredResumeContractVersion: semanticVersionSchema,
  resumePlanningEngineVersion: semanticVersionSchema,
  resumePlanningConfigurationVersion: semanticVersionSchema,
  createdAt: z.string().datetime(),
  inputChecksum: z.string().min(1),
  status: structuredResumeVersionStatusSchema,
  diagnostics: z.array(evidenceDiagnosticSchema),
  targetConfiguration: z.object({
    targetCompany: z.string().min(1),
    targetRole: z.string().min(1),
    targetRoleFamily: targetRoleFamilySchema,
    targetSeniority: z.string().nullable(),
    targetStackFamily: stackRuleFamilySchema,
    workArrangement: z.string().nullable(),
    location: z.string().nullable(),
    targetPageCount: z.number().int().positive(),
    maximumPageCount: z.number().int().positive(),
    summaryEnabled: z.boolean(),
    projectsSectionEnabled: z.boolean(),
    educationEnabled: z.boolean(),
    certificationsEnabled: z.boolean(),
    experienceOrderingMode: z.enum(["RELEVANCE_THEN_CHRONOLOGY", "CHRONOLOGICAL"]),
    skillGroupOrdering: z.array(z.string().min(1)),
    roleSelectionLimit: z.number().int().positive(),
    projectSelectionLimit: z.number().int().positive(),
    bulletBudgetPerRole: z.number().int().positive(),
    bulletBudgetPerProject: z.number().int().positive(),
    contactInformationPolicy: z.record(z.string(), z.boolean()),
    dateFormatPreference: z.string().min(1),
    locationDisplayPreference: z.string().min(1),
    roleFamilySelection: z.object({
      selectedFamily: targetRoleFamilySchema,
      selectionRule: z.string().min(1),
      confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
      alternativeCandidateFamilies: z.array(targetRoleFamilySchema),
      userConfirmationNeeded: z.boolean()
    }),
    stackRule: z.object({
      selectedStackRuleFamily: stackRuleFamilySchema,
      orderedTechnologyGroups: z.array(z.array(z.string().min(1))),
      conditionalInclusions: z.array(z.string().min(1)),
      deferredTechnologies: z.array(z.string().min(1)),
      excludedTechnologies: z.array(z.string().min(1)),
      ruleProvenance: z.string().min(1)
    }),
    headerFields: z.array(headerFieldPlanSchema)
  }),
  sectionPlans: z.array(sectionPlanSchema),
  summaryBlueprint: summaryBlueprintSchema,
  skillPlan: z.object({
    groupOrder: z.array(z.string().min(1)),
    entries: z.array(skillPlanEntrySchema)
  }),
  rolePlans: z.array(rolePlanSchema),
  projectPlans: z.array(projectPlanSchema),
  bulletEvidenceCandidates: z.array(bulletEvidenceCandidateSchema),
  claimsToAvoid: z.array(planClaimToAvoidSchema),
  duplicationGroups: z.array(duplicationGroupSchema),
  pageBudget: pageBudgetSchema,
  planningConfiguration: z.record(z.string(), z.unknown()),
  matchReportSummary: matchReportResultSchema.shape.summary,
  summary: structuredResumeSummarySchema
});
export type StructuredResumePlan = z.infer<typeof structuredResumePlanSchema>;

export const structuredResumePlanningInputSchema = z.object({
  runId: z.string().min(1),
  workspaceId: z.string().min(1),
  matchReportRunId: z.string().min(1),
  matchReportResult: matchReportResultSchema,
  careerProfileVersionId: z.string().min(1),
  careerProfileSourceChecksum: z.string().min(1),
  careerProfileContent: canonicalCareerKnowledgeContractSchema,
  targetCompany: z.string().min(1),
  targetRole: z.string().min(1),
  workArrangement: z.string().nullable(),
  location: z.string().nullable(),
  createdAt: z.string().datetime(),
  inputChecksum: z.string().min(1)
});
export type StructuredResumePlanningInput = z.infer<typeof structuredResumePlanningInputSchema>;
