import {
  RESUME_PLANNING_CONFIGURATION_VERSION,
  RESUME_PLANNING_ENGINE_VERSION,
  STRUCTURED_RESUME_CONTRACT_VERSION,
  structuredResumeConfiguration
} from "@/lib/structured-resume/config";
import {
  structuredResumePlanningInputSchema,
  structuredResumePlanSchema,
  type StructuredResumePlanningInput,
  type TargetRoleFamily,
  type StackRuleFamily,
  type SectionType
} from "@/lib/structured-resume/contract";
import type { EvidenceDiagnostic } from "@/lib/evidence-retrieval/contract";

const AI_HINTS = ["agent", "llm", "rag", "ai", "evaluation", "tool invocation", "agentv"];
const MICROSOFT_HINTS = ["c#", ".net", "asp.net", "asp.net core", "sql server", "entity framework"];
const JAVA_HINTS = ["java", "kotlin", "spring boot"];
const PYTHON_HINTS = ["python", "fastapi"];
const NODE_HINTS = ["node.js", "node", "typescript", "nestjs"];
const FRONTEND_HINTS = ["react", "frontend"];

function pushDiagnostic(diagnostics: EvidenceDiagnostic[], diagnostic: EvidenceDiagnostic) {
  diagnostics.push(diagnostic);
}

function stableId(prefix: string, values: string[]) {
  return `${prefix}:${values.join(":").toLowerCase().replace(/[^a-z0-9:_-]+/g, "-")}`;
}

function normalizeLinkId(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const lower = value.toLowerCase();
  return lower.includes(":") ? lower.split(":").at(-1)! : lower;
}

function matchesLinkedId(candidateId: string, targetId: string) {
  return normalizeLinkId(candidateId) === normalizeLinkId(targetId);
}

function hasAnyHint(values: string[], hints: string[]) {
  const normalized = values.join(" ").toLowerCase();
  return hints.some((hint) => normalized.includes(hint));
}

function mapSkillGroup(skill: string) {
  const lower = skill.toLowerCase();
  if (["python", "typescript", "javascript", "java", "kotlin", "c#"].includes(lower)) {
    return "LANGUAGES" as const;
  }
  if (["node.js", "node", "fastapi", "nestjs", ".net", "asp.net", "asp.net core", "spring boot"].includes(lower)) {
    return "BACKEND" as const;
  }
  if (["react"].includes(lower)) {
    return "FRONTEND" as const;
  }
  if (["postgresql", "sql server", "redis", "pgvector"].includes(lower)) {
    return "DATA" as const;
  }
  if (["aws", "docker"].includes(lower)) {
    return "CLOUD_INFRASTRUCTURE" as const;
  }
  if (["llm", "rag", "agentv", "agent orchestration", "evaluation", "tool invocation"].includes(lower)) {
    return "AI_ML" as const;
  }
  if (["distributed systems", "architecture", "system design", "observability"].includes(lower)) {
    return "ARCHITECTURE" as const;
  }
  return "OTHER" as const;
}

function inferRoleFamily(args: {
  targetRole: string;
  technologies: string[];
  themes: string[];
}): {
  selectedFamily: TargetRoleFamily;
  selectionRule: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  alternatives: TargetRoleFamily[];
  userConfirmationNeeded: boolean;
} {
  const inputs = [args.targetRole, ...args.technologies, ...args.themes];
  if (hasAnyHint(inputs, AI_HINTS)) {
    return {
      selectedFamily: "AI_AGENTIC",
      selectionRule: "target-role-family.ai-agentic.keywords",
      confidence: "HIGH",
      alternatives: ["PYTHON_BACKEND", "NODE_TYPESCRIPT_BACKEND"],
      userConfirmationNeeded: false
    };
  }
  if (hasAnyHint(inputs, MICROSOFT_HINTS)) {
    return {
      selectedFamily: "MICROSOFT_DOTNET",
      selectionRule: "target-role-family.microsoft.keywords",
      confidence: "HIGH",
      alternatives: ["GENERAL_BACKEND"],
      userConfirmationNeeded: false
    };
  }
  if (hasAnyHint(inputs, JAVA_HINTS)) {
    return {
      selectedFamily: "JAVA_KOTLIN",
      selectionRule: "target-role-family.java-kotlin.keywords",
      confidence: "HIGH",
      alternatives: ["GENERAL_BACKEND"],
      userConfirmationNeeded: false
    };
  }
  if (hasAnyHint(inputs, PYTHON_HINTS)) {
    return {
      selectedFamily: "PYTHON_BACKEND",
      selectionRule: "target-role-family.python.keywords",
      confidence: "HIGH",
      alternatives: ["GENERAL_BACKEND", "NODE_TYPESCRIPT_BACKEND"],
      userConfirmationNeeded: false
    };
  }
  if (hasAnyHint(inputs, NODE_HINTS)) {
    const fullStack = hasAnyHint(inputs, FRONTEND_HINTS);
    return {
      selectedFamily: fullStack ? "FULL_STACK" : "NODE_TYPESCRIPT_BACKEND",
      selectionRule: fullStack
        ? "target-role-family.full-stack.backend-plus-frontend"
        : "target-role-family.node-typescript.keywords",
      confidence: fullStack ? "MEDIUM" : "HIGH",
      alternatives: ["GENERAL_BACKEND"],
      userConfirmationNeeded: false
    };
  }
  if (
    args.themes.some((theme) => /leadership|architecture/i.test(theme)) ||
    /lead|staff|principal|manager|architect/i.test(args.targetRole)
  ) {
    return {
      selectedFamily: "TECHNICAL_LEADERSHIP",
      selectionRule: "target-role-family.leadership.theme-or-title",
      confidence: "MEDIUM",
      alternatives: ["GENERAL_BACKEND"],
      userConfirmationNeeded: false
    };
  }
  if (/backend|platform|engineer|api/i.test(args.targetRole)) {
    return {
      selectedFamily: "GENERAL_BACKEND",
      selectionRule: "target-role-family.general-backend.title",
      confidence: "MEDIUM",
      alternatives: ["OTHER"],
      userConfirmationNeeded: false
    };
  }
  return {
    selectedFamily: "OTHER",
    selectionRule: "target-role-family.fallback.other",
    confidence: "LOW",
    alternatives: ["GENERAL_BACKEND"],
    userConfirmationNeeded: true
  };
}

function toStackRuleFamily(roleFamily: TargetRoleFamily): StackRuleFamily {
  switch (roleFamily) {
    case "FULL_STACK":
      return "NODE_TYPESCRIPT_BACKEND";
    case "TECHNICAL_LEADERSHIP":
      return "GENERAL_BACKEND";
    case "OTHER":
      return "OTHER";
    default:
      return roleFamily;
  }
}

function inferRecencyFromDates(start: string | null, end: string | null) {
  const last = end ?? start;
  if (!last) {
    return "UNKNOWN" as const;
  }
  const year = Number(last.slice(0, 4));
  if (!Number.isFinite(year)) {
    return "UNKNOWN" as const;
  }
  if (year >= 2025) {
    return "CURRENT" as const;
  }
  if (year >= 2023) {
    return "RECENT" as const;
  }
  if (year >= 2021) {
    return "OLDER" as const;
  }
  return "STALE" as const;
}

function parseRequestedYears(texts: string[]) {
  const years = texts
    .map((text) => text.match(/(\d+)\+?\s+years?/i)?.[1])
    .map((value) => (value ? Number(value) : null))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  return years.length > 0 ? Math.max(...years) : null;
}

export function buildStructuredResumePlan(input: StructuredResumePlanningInput) {
  const parsed = structuredResumePlanningInputSchema.parse(input);
  const diagnostics: EvidenceDiagnostic[] = [];
  const resumeReadiness = parsed.matchReportResult.summary.resumeReadinessState;

  if (resumeReadiness === "NOT_READY") {
    throw new Error("Match reports with NOT_READY resume readiness cannot create a structured resume plan.");
  }

  const technologies = parsed.matchReportResult.resumeGuidance.priorityTechnologies.map(
    (item) => item.technology
  );
  const themes = parsed.matchReportResult.resumeGuidance.priorityEvidenceThemes.map(
    (item) => item.label
  );
  const roleFamilySelection = inferRoleFamily({
    targetRole: parsed.targetRole,
    technologies,
    themes
  });
  const selectedStackRuleFamily = toStackRuleFamily(roleFamilySelection.selectedFamily);
  const selectedStackRule = structuredResumeConfiguration.stackRules[selectedStackRuleFamily];

  if (roleFamilySelection.userConfirmationNeeded) {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "UNKNOWN_STACK_ORDER_FAMILY",
      message: "The planner fell back to a low-confidence role family and stack-ordering rule.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  if (resumeReadiness === "NEEDS_REVIEW") {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "RESUME_READINESS_NEEDS_REVIEW",
      message: "Structured plan created in needs-review state and is not ready for composition.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  const claimRestrictions = parsed.matchReportResult.resumeGuidance.claimsToAvoid.map((claim) => ({
    claimConcept: claim.concept,
    requirementIds: parsed.matchReportResult.requirementConclusions
      .filter((item) => item.requirementText === claim.concept || item.requirementText.includes(claim.concept))
      .map((item) => item.requirementId),
    evidenceIds: claim.missingOrRestrictedEvidenceIds,
    handlingCategory: claim.handling === "NEEDS_USER_CONFIRMATION" ? "NEEDS_USER_CONFIRMATION" : claim.handling,
    reason: claim.reason,
    truthfulnessRule: claim.truthfulnessRule,
    affectedSections: ["PROFESSIONAL_SUMMARY", "CORE_SKILLS", "PROFESSIONAL_EXPERIENCE", "SELECTED_PROJECTS"] as SectionType[],
    alternativeSafeTreatment:
      claim.handling === "PROJECT_ONLY"
        ? "Keep the claim only in a clearly labeled project context."
        : claim.handling === "QUALIFY"
          ? "Include only with explicit qualification."
          : claim.handling === "EXPIRED"
            ? "Keep as background reference only and never present as current."
            : "Omit from employer-facing sections."
  }));

  const headerFields = [
    {
      field: "NAME" as const,
      include: true,
      sourcePath: "candidate.displayName",
      reason: "Always include the candidate name in the header."
    },
    {
      field: "EMAIL" as const,
      include: structuredResumeConfiguration.contactInformationPolicy.includeEmail,
      sourcePath: "candidate.contacts.email",
      reason: "Configured contact policy for email."
    },
    {
      field: "PHONE" as const,
      include: structuredResumeConfiguration.contactInformationPolicy.includePhone,
      sourcePath: "candidate.contacts.phone",
      reason: "Configured contact policy for phone."
    },
    {
      field: "LOCATION" as const,
      include: structuredResumeConfiguration.contactInformationPolicy.includeLocation,
      sourcePath: "candidate.location",
      reason: "Configured contact policy for location."
    },
    {
      field: "LINKEDIN" as const,
      include: structuredResumeConfiguration.contactInformationPolicy.includeLinkedIn,
      sourcePath: "candidate.contacts.linkedinUrl",
      reason: "Configured contact policy for LinkedIn."
    },
    {
      field: "GITHUB" as const,
      include: structuredResumeConfiguration.contactInformationPolicy.includeGitHub,
      sourcePath: "candidate.contacts.githubUrl",
      reason: "Configured contact policy for GitHub."
    }
  ];

  const sectionPlans = structuredResumeConfiguration.sectionOrder.map((sectionType, index) => ({
    sectionType,
    enabled:
      sectionType === "SELECTED_PROJECTS"
        ? parsed.matchReportResult.resumeGuidance.projectsToConsider.length > 0
        : sectionType === "CERTIFICATIONS"
          ? parsed.careerProfileContent.certifications.some((item) => item.status === "CURRENT")
          : true,
    required: ["HEADER", "CORE_SKILLS", "PROFESSIONAL_EXPERIENCE"].includes(sectionType),
    order: index,
    maximumItemCount:
      sectionType === "PROFESSIONAL_EXPERIENCE"
        ? structuredResumeConfiguration.roleLimits.includeLimit +
          structuredResumeConfiguration.roleLimits.considerLimit +
          structuredResumeConfiguration.roleLimits.backgroundLimit
        : sectionType === "SELECTED_PROJECTS"
          ? structuredResumeConfiguration.projectLimits.includeLimit +
            structuredResumeConfiguration.projectLimits.considerLimit
          : sectionType === "CORE_SKILLS"
            ? 18
            : 6,
    maximumEstimatedLines:
      structuredResumeConfiguration.sectionLineBudgets[
        sectionType as keyof typeof structuredResumeConfiguration.sectionLineBudgets
      ],
    sourceRules: [`structured-resume.section.${sectionType.toLowerCase()}`],
    eligibilityDiagnostics: [],
    locked: true,
    omissionReason:
      sectionType === "SELECTED_PROJECTS" &&
      parsed.matchReportResult.resumeGuidance.projectsToConsider.length === 0
        ? "No deterministic project candidates were selected."
        : sectionType === "CERTIFICATIONS" &&
            !parsed.careerProfileContent.certifications.some((item) => item.status === "CURRENT")
          ? "No current certifications are eligible for targeted inclusion."
          : null
  }));

  const emphasizedRoleIds = new Set(
    parsed.matchReportResult.resumeGuidance.rolesToEmphasize.map((item) => normalizeLinkId(item.roleId))
  );
  const projectCandidateIds = new Set(
    parsed.matchReportResult.resumeGuidance.projectsToConsider.map((item) =>
      normalizeLinkId(item.projectId)
    )
  );

  const rolePlans = parsed.careerProfileContent.employment.map((role) => {
    const linkedRole = parsed.matchReportResult.resumeGuidance.rolesToEmphasize.find((item) =>
      matchesLinkedId(item.roleId, role.id)
    );
    const recency = inferRecencyFromDates(
      role.startDate?.normalized ?? null,
      role.endDate?.normalized ?? null
    );
    const hasPriorityTech = technologies.some((tech) =>
      role.technologies.some((roleTech) => roleTech.toLowerCase() === tech.toLowerCase())
    );
    const selectionStatus =
      linkedRole || emphasizedRoleIds.has(normalizeLinkId(role.id))
        ? "INCLUDE"
        : hasPriorityTech
          ? "CONSIDER"
          : recency === "CURRENT" || recency === "RECENT"
            ? "BACKGROUND_ONLY"
            : "EXCLUDE";
    return {
      roleId: role.id,
      employer: role.employer,
      roleTitle: role.roleTitle,
      dates: {
        start: role.startDate?.normalized ?? null,
        end: role.endDate?.normalized ?? null
      },
      professionalContext: true,
      targetRequirementCoverage: linkedRole?.supportedRequirementIds ?? [],
      strongEvidenceCount: linkedRole?.strongEvidenceCount ?? 0,
      goodEvidenceCount: linkedRole ? Math.max(0, linkedRole.supportedRequirementIds.length - linkedRole.strongEvidenceCount) : 0,
      limitedEvidenceCount: linkedRole ? 0 : hasPriorityTech ? 1 : 0,
      priorityTechnologies: role.technologies.filter((tech) =>
        technologies.some((item) => item.toLowerCase() === tech.toLowerCase())
      ),
      relevantAccomplishments: [...role.accomplishments, ...role.facts].slice(0, 4),
      relevantResponsibilities: role.responsibilities.slice(0, 4),
      relevantMetrics: role.metrics
        .map((metric) => [metric.description, metric.value].filter(Boolean).join(": "))
        .filter((item) => item.length > 0),
      recency,
      selectionStatus,
      selectionReason:
        selectionStatus === "INCLUDE"
          ? "Professional evidence from this role supports prioritized requirements."
          : selectionStatus === "CONSIDER"
            ? "This role adds relevant technology coverage but is secondary to stronger roles."
            : selectionStatus === "BACKGROUND_ONLY"
              ? "Retained to preserve chronology without taking significant page budget."
              : "Excluded because stronger or more relevant roles cover the same target needs.",
      maximumBulletBudget:
        selectionStatus === "INCLUDE"
          ? structuredResumeConfiguration.bulletBudgets.includedRole
          : selectionStatus === "CONSIDER"
            ? structuredResumeConfiguration.bulletBudgets.secondaryRole
            : selectionStatus === "BACKGROUND_ONLY"
              ? structuredResumeConfiguration.bulletBudgets.backgroundRole
              : 0,
      eligibleEvidenceIds: selectionStatus === "EXCLUDE" ? [] : [role.id],
      excludedEvidenceIds: selectionStatus === "EXCLUDE" ? [role.id] : [],
      restrictions: [],
      requiredQualificationNotes: []
    };
  });

  if (rolePlans.every((role) => role.selectionStatus === "EXCLUDE")) {
    pushDiagnostic(diagnostics, {
      severity: "ERROR",
      code: "NO_ELIGIBLE_PROFESSIONAL_EXPERIENCE",
      message: "No professional roles were eligible for inclusion in the structured resume plan.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  const projectPlans = parsed.careerProfileContent.projects.map((project) => {
    const linkedProject = parsed.matchReportResult.resumeGuidance.projectsToConsider.find((item) =>
      matchesLinkedId(item.projectId, project.id)
    );
    const recency = inferRecencyFromDates(
      project.dates.startDate?.normalized ?? null,
      project.dates.endDate?.normalized ?? null
    );
    const selectionStatus = linkedProject
      ? "INCLUDE"
      : project.preferredFor.some((item) => parsed.targetRole.toLowerCase().includes(item.toLowerCase()))
        ? "CONSIDER"
        : "EXCLUDE";
    return {
      projectId: project.id,
      projectName: project.name,
      context: project.context,
      requirementCoverage: linkedProject?.supportedRequirementIds ?? [],
      strongestEvidence: linkedProject?.strongestRelevance ?? "NONE",
      technologies: project.technologies,
      architecture: project.architecture,
      metrics: project.metrics
        .map((metric) => [metric.description, metric.value].filter(Boolean).join(": "))
        .filter((item) => item.length > 0),
      recency,
      selectionStatus,
      selectionReason:
        selectionStatus === "INCLUDE"
          ? "Project evidence fills a targeted requirement or differentiator."
          : selectionStatus === "CONSIDER"
            ? "Project evidence may support the selected role family if page budget permits."
            : "Project does not add enough unique support beyond stronger professional evidence.",
      maximumBulletBudget:
        selectionStatus === "INCLUDE"
          ? structuredResumeConfiguration.bulletBudgets.includedProject
          : selectionStatus === "CONSIDER"
            ? structuredResumeConfiguration.bulletBudgets.secondaryProject
            : 0,
      eligibleEvidenceIds: selectionStatus === "EXCLUDE" ? [] : [project.id],
      restrictions: linkedProject?.projectOnlyWarning ? ["PROJECT_ONLY"] : [],
      projectOnlyWarning:
        linkedProject?.projectOnlyWarning ?? (project.context !== "PROFESSIONAL"
          ? "Project-only evidence should be labeled clearly if used."
          : null),
      resumeUseGuidance:
        selectionStatus === "INCLUDE"
          ? "Use only as a clearly labeled project section item."
          : selectionStatus === "CONSIDER"
            ? "Use only if it adds unique technology or architecture support."
            : "Do not spend targeted page budget on this project."
    };
  });

  const skillPlanEntries = technologies.map((technology, index) => {
    const matchingSkill = parsed.careerProfileContent.skills.find(
      (skill) => skill.name.toLowerCase() === technology.toLowerCase()
    );
    const matchingRoles = rolePlans.filter((role) =>
      role.priorityTechnologies.some((item) => item.toLowerCase() === technology.toLowerCase())
    );
    const matchingProjects = projectPlans.filter((project) =>
      project.technologies.some((item) => item.toLowerCase() === technology.toLowerCase())
    );
    const relatedClaims = claimRestrictions.filter((claim) =>
      claim.claimConcept.toLowerCase().includes(technology.toLowerCase())
    );
    const restrictions = relatedClaims.map((claim) => claim.handlingCategory);
    const decision =
      relatedClaims.some((claim) => ["OMIT", "EXPIRED", "BACKGROUND_ONLY"].includes(claim.handlingCategory))
        ? "EXCLUDE"
        : relatedClaims.some((claim) => ["QUALIFY", "PROJECT_ONLY", "NEEDS_USER_CONFIRMATION"].includes(claim.handlingCategory))
          ? "QUALIFY"
          : matchingRoles.length > 0 || matchingProjects.length > 0
            ? "INCLUDE"
            : "DEFER";
    return {
      canonicalSkill: technology,
      displayValue: technology,
      group: mapSkillGroup(technology),
      priority: index + 1,
      requirementIds: parsed.matchReportResult.requirementConclusions
        .filter((item) => item.requirementText.toLowerCase().includes(technology.toLowerCase()))
        .map((item) => item.requirementId),
      supportingEvidenceIds: [
        ...matchingRoles.flatMap((role) => role.eligibleEvidenceIds),
        ...matchingProjects.flatMap((project) => project.eligibleEvidenceIds)
      ],
      professionalUse: matchingRoles.length > 0 || matchingSkill?.professionalUse === true,
      projectUse: matchingProjects.length > 0 || matchingSkill?.projectUse === true,
      recency: matchingSkill?.recency ?? "UNKNOWN",
      restrictions: restrictions.map(String),
      decision,
      decisionReason:
        decision === "INCLUDE"
          ? "Supported by eligible evidence and aligned with prioritized technologies."
          : decision === "QUALIFY"
            ? "Eligible only with visible qualification based on claim restrictions."
            : decision === "DEFER"
              ? "Supported weakly or only as secondary background for this role family."
              : "Excluded by truthfulness or currency restrictions.",
      stackOrderProvenance: `stack-rule.${selectedStackRuleFamily}`
    };
  });

  if (skillPlanEntries.every((entry) => entry.decision === "EXCLUDE")) {
    pushDiagnostic(diagnostics, {
      severity: "ERROR",
      code: "NO_ELIGIBLE_SKILLS",
      message: "No includable skills were found for the structured resume plan.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  const bulletEvidenceCandidates = [
    ...rolePlans.map((role, index) => ({
      evidenceId: role.roleId,
      parentType: "ROLE" as const,
      parentId: role.roleId,
      requirementIds: role.targetRequirementCoverage,
      candidateScore: role.strongEvidenceCount > 0 ? 90 : role.goodEvidenceCount > 0 ? 75 : role.limitedEvidenceCount > 0 ? 55 : null,
      strengthBand: role.strongEvidenceCount > 0 ? "STRONG" : role.goodEvidenceCount > 0 ? "GOOD" : role.limitedEvidenceCount > 0 ? "LIMITED" : "UNKNOWN",
      evidenceType: "ROLE",
      claimText: role.relevantAccomplishments[0] ?? role.roleTitle ?? role.roleId,
      metric: role.relevantMetrics[0] ?? null,
      metricVerification: role.relevantMetrics.length > 0 ? "VERIFIED" : null,
      technologies: role.priorityTechnologies,
      context: "PROFESSIONAL" as const,
      recency: role.recency,
      restrictions: role.restrictions,
      includeEligibility:
        role.selectionStatus === "INCLUDE"
          ? "PRIMARY"
          : role.selectionStatus === "CONSIDER"
            ? "SECONDARY"
            : role.selectionStatus === "BACKGROUND_ONLY"
              ? "BACKGROUND_ONLY"
              : "EXCLUDED",
      wordingConstraints: role.requiredQualificationNotes,
      duplicationGroupId: stableId("dup", [role.roleId]),
      priority: index + 1,
      sourceProvenance: {
        sourceSection: "employment",
        sourceId: role.roleId,
        sourcePath: `employment:${role.roleId}`
      }
    })),
    ...projectPlans.map((project, index) => ({
      evidenceId: project.projectId,
      parentType: "PROJECT" as const,
      parentId: project.projectId,
      requirementIds: project.requirementCoverage,
      candidateScore:
        project.strongestEvidence === "STRONG"
          ? 85
          : project.strongestEvidence === "GOOD"
            ? 70
            : project.strongestEvidence === "LIMITED"
              ? 50
              : null,
      strengthBand:
        project.strongestEvidence === "NONE"
          ? "UNKNOWN"
          : project.strongestEvidence,
      evidenceType: "PROJECT",
      claimText: project.resumeUseGuidance,
      metric: project.metrics[0] ?? null,
      metricVerification: project.metrics.length > 0 ? "UNVERIFIED" : null,
      technologies: project.technologies,
      context: "PROJECT" as const,
      recency: project.recency,
      restrictions: project.restrictions,
      includeEligibility:
        project.selectionStatus === "INCLUDE"
          ? "PROJECT_ONLY"
          : project.selectionStatus === "CONSIDER"
            ? "SECONDARY"
            : "EXCLUDED",
      wordingConstraints: project.projectOnlyWarning ? [project.projectOnlyWarning] : [],
      duplicationGroupId: stableId("dup", [project.projectId]),
      priority: rolePlans.length + index + 1,
      sourceProvenance: {
        sourceSection: "projects",
        sourceId: project.projectId,
        sourcePath: `projects:${project.projectId}`
      }
    }))
  ];

  if (bulletEvidenceCandidates.every((item) => item.includeEligibility === "EXCLUDED")) {
    pushDiagnostic(diagnostics, {
      severity: "ERROR",
      code: "NO_ELIGIBLE_BULLETS",
      message: "No eligible bullet evidence candidates were found for the structured resume plan.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  const duplicationGroups = bulletEvidenceCandidates.map((item) => ({
    duplicationGroupId: item.duplicationGroupId ?? stableId("dup", [item.evidenceId]),
    evidenceIds: [item.evidenceId],
    preferredPlacement: item.parentType === "ROLE" ? "PROFESSIONAL_EXPERIENCE" : "SELECTED_PROJECTS",
    maximumAllowedUses: item.parentType === "ROLE" ? 2 : 1,
    reason: "Avoid accidental repetition of the same underlying evidence across multiple resume sections."
  }));

  const requestedYears = parseRequestedYears(
    parsed.matchReportResult.requirementConclusions.map((item) => item.requirementText)
  );

  const summaryBlueprint = {
    targetRoleLabel: parsed.targetRole,
    maximumSentenceCount: structuredResumeConfiguration.summaryBlueprint.maxSentences,
    maximumWordCount: structuredResumeConfiguration.summaryBlueprint.maxWords,
    coreEvidenceThemes: themes.slice(0, 4),
    priorityTechnologies: technologies.slice(0, 8),
    leadershipEmphasis: themes.some((theme) => /lead/i.test(theme)),
    domainEmphasis: themes.some((theme) => /domain|finance|platform/i.test(theme)),
    architectureEmphasis: themes.some((theme) => /architecture|system/i.test(theme)),
    aiEmphasis: technologies.some((tech) => hasAnyHint([tech], AI_HINTS)),
    claimsProhibited: claimRestrictions.map((claim) => claim.claimConcept),
    experienceClaimsPermitted: technologies.slice(0, 6).map((technology) => ({
      technology,
      maximumPermittedClaimYears: structuredResumeConfiguration.experienceClaimRules.maxYearsPerSkill,
      requestedYears,
      maximumJobAlignedClaimYears:
        requestedYears === null
          ? structuredResumeConfiguration.experienceClaimRules.maxYearsPerSkill
          : requestedYears + structuredResumeConfiguration.experienceClaimRules.maxYearsBeyondJobRequirement,
      intermittentUse: claimRestrictions.some(
        (claim) =>
          claim.claimConcept.toLowerCase().includes(technology.toLowerCase()) &&
          claim.handlingCategory === "PROJECT_ONLY"
      ),
      wordingPolicy:
        claimRestrictions.some(
          (claim) =>
            claim.claimConcept.toLowerCase().includes(technology.toLowerCase()) &&
            claim.handlingCategory === "PROJECT_ONLY"
        )
          ? "QUALIFY_PROJECT_ONLY"
          : claimRestrictions.some(
                (claim) =>
                  claim.claimConcept.toLowerCase().includes(technology.toLowerCase()) &&
                  claim.handlingCategory === "QUALIFY"
              )
            ? "QUALIFY_STALE"
            : "DIRECT"
    })),
    toneRules: ["direct", "grounded"],
    styleRules: ["No first-person pronouns by default.", "Do not use em dashes.", "No keyword list disguised as prose."],
    requiredDifferentiators: parsed.matchReportResult.strengths.map((item) => item.strengthCategory).slice(0, 4),
    sourceEvidenceIds: bulletEvidenceCandidates
      .filter((item) => ["PRIMARY", "SECONDARY", "PROJECT_ONLY"].includes(item.includeEligibility))
      .map((item) => item.evidenceId)
      .slice(0, 8)
  };

  const estimatedSkillLines = Math.max(
    2,
    Math.ceil(skillPlanEntries.filter((entry) => entry.decision !== "EXCLUDE").length / 4)
  );
  const estimatedRoleLines = rolePlans.reduce(
    (sum, role) => sum + (role.selectionStatus === "EXCLUDE" ? 0 : 2 + role.maximumBulletBudget),
    0
  );
  const estimatedProjectLines = projectPlans.reduce(
    (sum, project) => sum + (project.selectionStatus === "EXCLUDE" ? 0 : 2 + project.maximumBulletBudget),
    0
  );
  const sectionBudgetMap = new Map<SectionType, number>([
    ["HEADER", 4],
    ["PROFESSIONAL_SUMMARY", 5],
    ["CORE_SKILLS", estimatedSkillLines],
    ["PROFESSIONAL_EXPERIENCE", estimatedRoleLines],
    ["SELECTED_PROJECTS", estimatedProjectLines],
    ["EDUCATION", parsed.careerProfileContent.education.length > 0 ? 2 : 0],
    ["CERTIFICATIONS", parsed.careerProfileContent.certifications.some((item) => item.status === "CURRENT") ? 2 : 0],
    ["ADDITIONAL_INFORMATION", 0]
  ]);
  const sectionBudgets = sectionPlans.map((section) => ({
    sectionType: section.sectionType,
    allocatedLines: section.maximumEstimatedLines,
    estimatedLines: section.enabled ? sectionBudgetMap.get(section.sectionType) ?? 0 : 0
  }));
  const totalLines = sectionBudgets.reduce((sum, section) => sum + section.estimatedLines, 0);
  const estimatedPages = Number(
    Math.max(1, totalLines / structuredResumeConfiguration.pageBudget.linesPerPage).toFixed(2)
  );
  const budgetStatus =
    estimatedPages > structuredResumeConfiguration.pageBudget.maximumPages
      ? "OVER_BUDGET"
      : estimatedPages > structuredResumeConfiguration.pageBudget.targetPages * 0.9
        ? "AT_RISK"
        : "WITHIN_TARGET";
  if (budgetStatus === "OVER_BUDGET") {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "TARGET_PAGE_BUDGET_IMPOSSIBLE",
      message: "The current structured resume plan exceeds the configured page budget.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  const status =
    resumeReadiness === "READY"
      ? diagnostics.some((item) => item.severity === "WARNING")
        ? "READY_WITH_LIMITATIONS"
        : "READY"
      : resumeReadiness === "READY_WITH_LIMITATIONS"
        ? "READY_WITH_LIMITATIONS"
        : "NEEDS_REVIEW";

  return structuredResumePlanSchema.parse({
    runId: parsed.runId,
    workspaceId: parsed.workspaceId,
    careerProfileVersionId: parsed.careerProfileVersionId,
    requirementAnalysisId: parsed.matchReportResult.requirementAnalysisId,
    evidenceRetrievalRunId: parsed.matchReportResult.evidenceRetrievalRunId,
    evidenceScoringRunId: parsed.matchReportResult.evidenceScoringRunId,
    matchReportRunId: parsed.matchReportRunId,
    jobDescriptionVersionId: parsed.matchReportResult.jobDescriptionVersionId,
    applicationId: parsed.matchReportResult.applicationId,
    structuredResumeContractVersion: STRUCTURED_RESUME_CONTRACT_VERSION,
    resumePlanningEngineVersion: RESUME_PLANNING_ENGINE_VERSION,
    resumePlanningConfigurationVersion: RESUME_PLANNING_CONFIGURATION_VERSION,
    createdAt: parsed.createdAt,
    inputChecksum: parsed.inputChecksum,
    status,
    diagnostics,
    targetConfiguration: {
      targetCompany: parsed.targetCompany,
      targetRole: parsed.targetRole,
      targetRoleFamily: roleFamilySelection.selectedFamily,
      targetSeniority: /senior|staff|principal|lead/i.test(parsed.targetRole) ? "SENIOR" : null,
      targetStackFamily: selectedStackRuleFamily,
      workArrangement: parsed.workArrangement,
      location: parsed.location,
      targetPageCount: structuredResumeConfiguration.pageBudget.targetPages,
      maximumPageCount: structuredResumeConfiguration.pageBudget.maximumPages,
      summaryEnabled: true,
      projectsSectionEnabled: projectPlans.some((project) => project.selectionStatus !== "EXCLUDE"),
      educationEnabled: parsed.careerProfileContent.education.length > 0,
      certificationsEnabled: parsed.careerProfileContent.certifications.some((item) => item.status === "CURRENT"),
      experienceOrderingMode: "RELEVANCE_THEN_CHRONOLOGY",
      skillGroupOrdering: structuredResumeConfiguration.skillGroupOrder,
      roleSelectionLimit: structuredResumeConfiguration.roleLimits.includeLimit,
      projectSelectionLimit: structuredResumeConfiguration.projectLimits.includeLimit,
      bulletBudgetPerRole: structuredResumeConfiguration.bulletBudgets.includedRole,
      bulletBudgetPerProject: structuredResumeConfiguration.bulletBudgets.includedProject,
      contactInformationPolicy: structuredResumeConfiguration.contactInformationPolicy,
      dateFormatPreference: structuredResumeConfiguration.dateFormatPreference,
      locationDisplayPreference: structuredResumeConfiguration.locationDisplayPreference,
      roleFamilySelection: {
        selectedFamily: roleFamilySelection.selectedFamily,
        selectionRule: roleFamilySelection.selectionRule,
        confidence: roleFamilySelection.confidence,
        alternativeCandidateFamilies: roleFamilySelection.alternatives,
        userConfirmationNeeded: roleFamilySelection.userConfirmationNeeded
      },
      stackRule: {
        selectedStackRuleFamily,
        orderedTechnologyGroups: selectedStackRule.orderedTechnologyGroups,
        conditionalInclusions: selectedStackRule.conditionalInclusions,
        deferredTechnologies: selectedStackRule.deferredTechnologies,
        excludedTechnologies: selectedStackRule.excludedTechnologies,
        ruleProvenance: `structured-resume.config.${selectedStackRuleFamily}`
      },
      headerFields
    },
    sectionPlans,
    summaryBlueprint,
    skillPlan: {
      groupOrder: structuredResumeConfiguration.skillGroupOrder,
      entries: skillPlanEntries
    },
    rolePlans,
    projectPlans,
    bulletEvidenceCandidates,
    claimsToAvoid: claimRestrictions,
    duplicationGroups,
    pageBudget: {
      targetPages: structuredResumeConfiguration.pageBudget.targetPages,
      maximumPages: structuredResumeConfiguration.pageBudget.maximumPages,
      estimatedPages,
      budgetStatus,
      sectionBudgets
    },
    planningConfiguration: structuredResumeConfiguration,
    matchReportSummary: parsed.matchReportResult.summary,
    summary: {
      targetCompany: parsed.targetCompany,
      targetRole: parsed.targetRole,
      targetRoleFamily: roleFamilySelection.selectedFamily,
      resumeReadiness,
      selectedStackRule: selectedStackRuleFamily,
      enabledSections: sectionPlans.filter((section) => section.enabled).map((section) => section.sectionType),
      selectedRoles: rolePlans.filter((role) => role.selectionStatus === "INCLUDE").length,
      selectedProjects: projectPlans.filter((project) => project.selectionStatus === "INCLUDE").length,
      eligiblePrimaryEvidenceCount: bulletEvidenceCandidates.filter((item) => item.includeEligibility === "PRIMARY").length,
      qualifiedOnlyEvidenceCount: bulletEvidenceCandidates.filter((item) => item.includeEligibility === "QUALIFIED_ONLY").length,
      excludedEvidenceCount: bulletEvidenceCandidates.filter((item) => item.includeEligibility === "EXCLUDED").length,
      priorityTechnologies: technologies.slice(0, 8),
      claimsToAvoidCount: claimRestrictions.length,
      estimatedPageCount: estimatedPages,
      budgetStatus,
      diagnosticErrorCount: diagnostics.filter((item) => item.severity === "ERROR").length,
      diagnosticWarningCount: diagnostics.filter((item) => item.severity === "WARNING").length,
      diagnosticInfoCount: diagnostics.filter((item) => item.severity === "INFO").length
    }
  });
}
