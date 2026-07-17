import {
  RESUME_COMPOSITION_CONFIGURATION_VERSION,
  RESUME_COMPOSITION_CONTRACT_VERSION,
  RESUME_COMPOSITION_ENGINE_VERSION,
  resumeCompositionConfiguration
} from "@/lib/resume-composition/config";
import {
  resumeCompositionContentSchema,
  resumeCompositionInputSchema,
  type ResumeCompositionContent,
  type ResumeCompositionInput,
  type StatementProvenance
} from "@/lib/resume-composition/contract";
import type { EvidenceDiagnostic } from "@/lib/evidence-retrieval/contract";

type CareerRole = ResumeCompositionInput["careerProfileContent"]["employment"][number];
type CareerProject = ResumeCompositionInput["careerProfileContent"]["projects"][number];
type CareerEducation = ResumeCompositionInput["careerProfileContent"]["education"][number];
type CareerCertification = ResumeCompositionInput["careerProfileContent"]["certifications"][number];

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function cleanText(text: string) {
  return text.replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
}

function ensureSentence(text: string) {
  const cleaned = cleanText(text);
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function estimateLines(text: string) {
  return Math.max(1, Math.ceil(text.length / 72));
}

function pushDiagnostic(diagnostics: EvidenceDiagnostic[], diagnostic: EvidenceDiagnostic) {
  diagnostics.push(diagnostic);
}

function buildStatementProvenance(args: {
  statementId: string;
  sourceEvidenceIds: string[];
  sourceCareerRecordIds: string[];
  requirementIds?: string[];
  templateId: string;
  transformations?: string[];
  metricReferences?: string[];
  technologies?: string[];
  restrictions?: string[];
  recordKinds?: string[];
  confirmationStates?: string[];
  truthfulnessClassification: StatementProvenance["truthfulnessClassification"];
  claimsToAvoidChecked?: string[];
}): StatementProvenance {
  return {
    statementId: args.statementId,
    sourceEvidenceIds: args.sourceEvidenceIds,
    sourceCareerRecordIds: args.sourceCareerRecordIds,
    requirementIds: args.requirementIds ?? [],
    templateId: args.templateId,
    transformations: args.transformations ?? [],
    metricReferences: args.metricReferences ?? [],
    technologies: args.technologies ?? [],
    restrictions: args.restrictions ?? [],
    recordKinds: args.recordKinds ?? ["SOURCE_FACT"],
    confirmationStates: args.confirmationStates ?? ["SOURCE_PROVIDED"],
    truthfulnessClassification: args.truthfulnessClassification,
    claimsToAvoidChecked: args.claimsToAvoidChecked ?? []
  };
}

function getHeaderValue(
  field: ResumeCompositionContent["header"][number]["field"],
  candidate: ResumeCompositionInput["careerProfileContent"]["candidate"]
) {
  switch (field) {
    case "NAME":
      return candidate.displayName;
    case "EMAIL":
      return candidate.contacts.email;
    case "PHONE":
      return candidate.contacts.phone;
    case "LOCATION":
      return candidate.location;
    case "LINKEDIN":
      return candidate.contacts.linkedinUrl;
    case "GITHUB":
      return candidate.contacts.githubUrl;
    default:
      return null;
  }
}

function compareDatesDescending(a: string | null, b: string | null) {
  if (!a && !b) {
    return 0;
  }
  if (!a) {
    return 1;
  }
  if (!b) {
    return -1;
  }
  return b.localeCompare(a);
}

function pickSummaryTemplate(roleFamily: string) {
  return (
    resumeCompositionConfiguration.summaryTemplates[
      roleFamily as keyof typeof resumeCompositionConfiguration.summaryTemplates
    ] ?? resumeCompositionConfiguration.summaryTemplates.OTHER
  );
}

function applyTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, value),
    template
  );
}

function summarizeSystems(roleTitles: string[]) {
  if (roleTitles.length === 0) {
    return "production software systems";
  }
  return roleTitles.length === 1
    ? `${roleTitles[0].toLowerCase()} systems`
    : "production software systems";
}

function toSkillQualification(restrictions: string[]) {
  if (restrictions.includes("PROJECT_ONLY")) {
    return "project experience";
  }
  if (restrictions.includes("STALE_SKILL")) {
    return "prior professional experience";
  }
  if (restrictions.includes("INTERMITTENT_USE")) {
    return "intermittent use";
  }
  return null;
}

function buildRoleBullet(
  role: CareerRole,
  planRole: ResumeCompositionInput["structuredResumePlan"]["rolePlans"][number],
  index: number,
  usedTexts: Set<string>,
  diagnostics: EvidenceDiagnostic[]
) {
  const sourceText =
    planRole.relevantAccomplishments[index] ??
    planRole.relevantResponsibilities[index] ??
    role.accomplishments[index] ??
    role.responsibilities[index] ??
    role.facts[index] ??
    null;
  if (!sourceText) {
    return null;
  }
  const normalized = ensureSentence(sourceText);
  const key = normalized.toLowerCase();
  if (usedTexts.has(key)) {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "DUPLICATE_EVIDENCE_USE",
      message: "A duplicate role bullet was removed during composition.",
      relatedRequirementId: planRole.targetRequirementCoverage[0] ?? null,
      relatedCandidateId: role.id
    });
    return null;
  }
  usedTexts.add(key);
  const statementId = `role-bullet:${role.id}:${index + 1}`;
  const metricReferences = planRole.relevantMetrics[index] ? [planRole.relevantMetrics[index]] : [];
  const bulletText = normalized;
  if (wordCount(bulletText) > resumeCompositionConfiguration.bulletConstraints.maxWords) {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "BULLET_TOO_LONG",
      message: `Role bullet ${statementId} exceeds the preferred length limit.`,
      relatedRequirementId: planRole.targetRequirementCoverage[0] ?? null,
      relatedCandidateId: role.id
    });
  }
  return {
    statementId,
    text: bulletText,
    templateId: "source-preserving.role-bullet",
    estimatedLineCount: estimateLines(bulletText),
    provenance: buildStatementProvenance({
      statementId,
      sourceEvidenceIds: [role.id],
      sourceCareerRecordIds: [role.id],
      requirementIds: planRole.targetRequirementCoverage,
      templateId: "source-preserving.role-bullet",
      transformations: ["ENSURED_TERMINAL_PERIOD", "NORMALIZED_WHITESPACE"],
      metricReferences,
      technologies: planRole.priorityTechnologies,
      restrictions: planRole.restrictions,
      recordKinds: [role.recordKind],
      confirmationStates: [role.confirmationState],
      truthfulnessClassification: "VERIFIED_SOURCE"
    })
  };
}

function buildProjectBullet(
  project: CareerProject,
  planProject: ResumeCompositionInput["structuredResumePlan"]["projectPlans"][number],
  index: number,
  usedTexts: Set<string>,
  diagnostics: EvidenceDiagnostic[]
) {
  const sourceText =
    project.accomplishments[index] ??
    project.responsibilities[index] ??
    planProject.resumeUseGuidance ??
    null;
  if (!sourceText) {
    return null;
  }
  const normalized = ensureSentence(sourceText);
  const key = normalized.toLowerCase();
  if (usedTexts.has(key)) {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "DUPLICATE_EVIDENCE_USE",
      message: "A duplicate project bullet was removed during composition.",
      relatedRequirementId: planProject.requirementCoverage[0] ?? null,
      relatedCandidateId: project.id
    });
    return null;
  }
  usedTexts.add(key);
  const statementId = `project-bullet:${project.id}:${index + 1}`;
  return {
    statementId,
    text: normalized,
    templateId: "source-preserving.project-bullet",
    estimatedLineCount: estimateLines(normalized),
    provenance: buildStatementProvenance({
      statementId,
      sourceEvidenceIds: [project.id],
      sourceCareerRecordIds: [project.id],
      requirementIds: planProject.requirementCoverage,
      templateId: "source-preserving.project-bullet",
      transformations: ["ENSURED_TERMINAL_PERIOD", "NORMALIZED_WHITESPACE"],
      technologies: project.technologies,
      restrictions: planProject.restrictions,
      recordKinds: [project.recordKind],
      confirmationStates: [project.confirmationState],
      truthfulnessClassification:
        planProject.restrictions.includes("PROJECT_ONLY") ? "QUALIFIED" : "VERIFIED_SOURCE"
    })
  };
}

function trimToBudget(
  content: Omit<ResumeCompositionContent, "summary">,
  diagnostics: EvidenceDiagnostic[]
) {
  let certifications = [...content.certifications];
  let selectedProjects = [...content.selectedProjects];
  const skillsGroups = content.skillsGroups.map((group) => ({ ...group, skills: [...group.skills] }));
  const professionalSummary = { ...content.professionalSummary, sentences: [...content.professionalSummary.sentences] };
  const professionalExperience = content.professionalExperience.map((role) => ({
    ...role,
    bullets: [...role.bullets]
  }));

  const recomputeSectionEstimates = () => {
    const sectionEstimates = [
      {
        sectionType: "HEADER",
        estimatedLines: Math.max(1, content.header.filter((item) => item.included).length)
      },
      {
        sectionType: "PROFESSIONAL_SUMMARY",
        estimatedLines: Math.max(1, estimateLines(professionalSummary.text))
      },
      {
        sectionType: "CORE_SKILLS",
        estimatedLines: skillsGroups.reduce((sum, group) => sum + group.estimatedLineCount, 0)
      },
      {
        sectionType: "PROFESSIONAL_EXPERIENCE",
        estimatedLines: professionalExperience.reduce((sum, role) => sum + role.estimatedLineCount, 0)
      },
      {
        sectionType: "SELECTED_PROJECTS",
        estimatedLines: selectedProjects.reduce((sum, project) => sum + project.estimatedLineCount, 0)
      },
      { sectionType: "EDUCATION", estimatedLines: content.education.length * 2 },
      { sectionType: "CERTIFICATIONS", estimatedLines: certifications.length * 2 }
    ];
    return {
      sectionEstimates,
      estimatedLineCount: sectionEstimates.reduce((sum, section) => sum + section.estimatedLines, 0)
    };
  };

  const maxLines = content.pageTarget * resumeCompositionConfiguration.pageBudget.linesPerPage;
  let budget = recomputeSectionEstimates();
  const overBudget = () => budget.estimatedLineCount > maxLines;

  while (overBudget() && certifications.length > 0) {
    certifications = certifications.slice(0, -1);
    budget = recomputeSectionEstimates();
  }
  while (overBudget() && selectedProjects.length > 0) {
    selectedProjects = selectedProjects.slice(0, -1);
    budget = recomputeSectionEstimates();
  }
  while (overBudget()) {
    const role = professionalExperience.find((entry) => entry.bullets.length > 1);
    if (!role) {
      break;
    }
    role.bullets = role.bullets.slice(0, -1);
    role.estimatedLineCount =
      1 + role.bullets.reduce((sum, bullet) => sum + bullet.estimatedLineCount, 0);
    budget = recomputeSectionEstimates();
  }
  while (overBudget()) {
    const group = skillsGroups.find((entry) => entry.skills.length > 1);
    if (!group) {
      break;
    }
    group.skills = group.skills.slice(0, -1);
    group.estimatedLineCount = Math.max(1, Math.ceil(group.skills.length / 4));
    budget = recomputeSectionEstimates();
  }

  if (overBudget()) {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "RESUME_OVER_ESTIMATED_PAGE_BUDGET",
      message: "The composed resume still exceeds the estimated page budget after deterministic trimming.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  return {
    certifications,
    selectedProjects,
    skillsGroups,
    professionalSummary,
    professionalExperience,
    budget
  };
}

export function buildResumeComposition(input: ResumeCompositionInput) {
  const parsed = resumeCompositionInputSchema.parse(input);
  const diagnostics: EvidenceDiagnostic[] = [];
  const plan = parsed.structuredResumePlan;

  if (!["READY", "READY_WITH_LIMITATIONS"].includes(plan.status)) {
    throw new Error("Only READY structured resume plans can be composed into employer-facing content.");
  }

  const candidate = parsed.careerProfileContent.candidate;
  const usedTexts = new Set<string>();

  const header = plan.targetConfiguration.headerFields.map((field) => {
    const value = getHeaderValue(field.field, candidate);
    if (field.include && !value) {
      pushDiagnostic(diagnostics, {
        severity: "WARNING",
        code: "MISSING_HEADER_FIELD",
        message: `Configured header field ${field.field} could not be resolved from the career profile.`,
        relatedRequirementId: null,
        relatedCandidateId: candidate.id
      });
    }
    return {
      field: field.field,
      label: field.field.replace(/_/g, " "),
      value: field.include ? value ?? null : null,
      included: field.include && Boolean(value),
      reason: field.reason,
      provenance:
        field.include && value
          ? buildStatementProvenance({
              statementId: `header:${field.field.toLowerCase()}`,
              sourceEvidenceIds: [candidate.id],
              sourceCareerRecordIds: [candidate.id],
              templateId: "header.direct-source",
              recordKinds: [candidate.recordKind],
              confirmationStates: [candidate.confirmationState],
              truthfulnessClassification: "VERIFIED_SOURCE"
            })
          : null
    };
  });

  const includedRoles = plan.rolePlans
    .filter((role) => role.selectionStatus !== "EXCLUDE")
    .sort((a, b) => compareDatesDescending(a.dates.end, b.dates.end));
  const roleMap = new Map(parsed.careerProfileContent.employment.map((role) => [role.id, role]));
  const projectMap = new Map(parsed.careerProfileContent.projects.map((project) => [project.id, project]));

  const primaryTechnologies = plan.skillPlan.entries
    .filter((entry) => entry.decision === "INCLUDE")
    .slice(0, 4)
    .map((entry) => entry.displayValue);
  const focus = plan.summaryBlueprint.coreEvidenceThemes[0] ?? "backend and platform delivery";
  const differentiator =
    plan.summaryBlueprint.requiredDifferentiators[0] ??
    includedRoles[0]?.relevantAccomplishments[0] ??
    "Brings evidence-backed delivery across production systems";
  const systems = summarizeSystems(includedRoles.map((role) => role.roleTitle ?? role.roleId).slice(0, 2));
  const summarySentenceOne = ensureSentence(
    applyTemplate(pickSummaryTemplate(plan.targetConfiguration.targetRoleFamily), {
      focus: cleanText(focus.toLowerCase()),
      systems,
      technologies: primaryTechnologies.join(", ") || "production backend technologies",
      differentiator: cleanText(differentiator)
    })
  );
  const topRole = includedRoles[0];
  const topRoleRecord = topRole ? roleMap.get(topRole.roleId) : null;
  const summarySentenceTwo = ensureSentence(
    cleanText(
      topRole?.relevantAccomplishments[0] ??
        topRole?.relevantResponsibilities[0] ??
        topRoleRecord?.accomplishments[0] ??
        "Builds production systems with evidence-backed delivery."
    )
  );
  const summarySentences = [
    {
      statementId: "summary:1",
      text: summarySentenceOne,
      templateId: `summary.${plan.targetConfiguration.targetRoleFamily.toLowerCase()}`,
      provenance: buildStatementProvenance({
        statementId: "summary:1",
        sourceEvidenceIds: plan.summaryBlueprint.sourceEvidenceIds,
        sourceCareerRecordIds: plan.summaryBlueprint.sourceEvidenceIds,
        templateId: `summary.${plan.targetConfiguration.targetRoleFamily.toLowerCase()}`,
        transformations: ["NORMALIZED_WHITESPACE", "TEMPLATE_FILL"],
        technologies: primaryTechnologies,
        truthfulnessClassification: "VERIFIED_COMPOSITE",
        claimsToAvoidChecked: plan.claimsToAvoid.map((claim) => claim.claimConcept)
      })
    },
    {
      statementId: "summary:2",
      text: summarySentenceTwo,
      templateId: "summary.source-highlight",
      provenance: buildStatementProvenance({
        statementId: "summary:2",
        sourceEvidenceIds: topRole ? [topRole.roleId] : [],
        sourceCareerRecordIds: topRole ? [topRole.roleId] : [],
        requirementIds: topRole?.targetRequirementCoverage ?? [],
        templateId: "summary.source-highlight",
        transformations: ["NORMALIZED_WHITESPACE", "ENSURED_TERMINAL_PERIOD"],
        technologies: topRole?.priorityTechnologies ?? [],
        restrictions: topRole?.restrictions ?? [],
        recordKinds: [topRoleRecord?.recordKind ?? "SOURCE_FACT"],
        confirmationStates: [topRoleRecord?.confirmationState ?? "SOURCE_PROVIDED"],
        truthfulnessClassification: "VERIFIED_SOURCE",
        claimsToAvoidChecked: plan.claimsToAvoid.map((claim) => claim.claimConcept)
      })
    }
  ];

  const summaryText = summarySentences.map((sentence) => sentence.text).join(" ");
  const summaryWarnings: string[] = [];
  if (summaryText.includes("\u2014")) {
    pushDiagnostic(diagnostics, {
      severity: "ERROR",
      code: "SUMMARY_CONTAINS_EM_DASH",
      message: "The professional summary contains an em dash, which is not allowed.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }
  if (wordCount(summaryText) < resumeCompositionConfiguration.summary.minWords) {
    summaryWarnings.push("Summary is shorter than the preferred minimum word count.");
  }
  if (wordCount(summaryText) > resumeCompositionConfiguration.summary.maxWords) {
    summaryWarnings.push("Summary exceeds the preferred maximum word count.");
  }

  const skillsGroups = plan.skillPlan.groupOrder
    .map((groupId, index) => {
      const skills = plan.skillPlan.entries
        .filter((entry) => entry.group === groupId && ["INCLUDE", "QUALIFY"].includes(entry.decision))
        .filter(
          (entry, skillIndex, entries) =>
            entries.findIndex((candidateSkill) => candidateSkill.displayValue === entry.displayValue) === skillIndex
        )
        .map((entry) => ({
          canonicalValue: entry.canonicalSkill,
          displayValue:
            entry.decision === "QUALIFY" && toSkillQualification(entry.restrictions)
              ? `${entry.displayValue} (${toSkillQualification(entry.restrictions)})`
              : entry.displayValue,
          supportingEvidenceIds: entry.supportingEvidenceIds,
          requirementIds: entry.requirementIds,
          professionalUse: entry.professionalUse,
          projectUse: entry.projectUse,
          recency: entry.recency,
          qualificationText: toSkillQualification(entry.restrictions),
          inclusionReason: entry.decisionReason,
          provenance: buildStatementProvenance({
            statementId: `skill:${entry.canonicalSkill.toLowerCase()}`,
            sourceEvidenceIds: entry.supportingEvidenceIds,
            sourceCareerRecordIds: entry.supportingEvidenceIds,
            requirementIds: entry.requirementIds,
            templateId: "skills.direct-display",
            transformations: entry.decision === "QUALIFY" ? ["ADDED_SAFE_QUALIFICATION"] : [],
            technologies: [entry.displayValue],
            restrictions: entry.restrictions,
            truthfulnessClassification:
              entry.decision === "QUALIFY" ? "QUALIFIED" : "VERIFIED_COMPOSITE"
          })
        }));
      if (skills.length === 0) {
        return null;
      }
      return {
        groupId,
        groupLabel:
          resumeCompositionConfiguration.skillGroupLabels[
            groupId as keyof typeof resumeCompositionConfiguration.skillGroupLabels
          ] ?? groupId,
        order: index,
        estimatedLineCount: Math.max(1, Math.ceil(skills.length / 4)),
        skills
      };
    })
    .filter((group): group is NonNullable<typeof group> => group !== null);

  const professionalExperience = includedRoles
    .map((planRole, index) => {
      const role = roleMap.get(planRole.roleId);
      if (!role) {
        pushDiagnostic(diagnostics, {
          severity: "ERROR",
          code: "INVALID_ROLE_REFERENCE",
          message: `Structured resume plan role ${planRole.roleId} could not be resolved in the career profile.`,
          relatedRequirementId: planRole.targetRequirementCoverage[0] ?? null,
          relatedCandidateId: planRole.roleId
        });
        return null;
      }
      const bulletLimit = Math.max(
        0,
        Math.min(planRole.maximumBulletBudget, planRole.selectionStatus === "BACKGROUND_ONLY" ? 1 : planRole.maximumBulletBudget)
      );
      const bullets = Array.from({ length: bulletLimit })
        .map((_, bulletIndex) => buildRoleBullet(role, planRole, bulletIndex, usedTexts, diagnostics))
        .filter((bullet): bullet is NonNullable<typeof bullet> => bullet !== null);
      return {
        roleId: role.id,
        employer: role.employer,
        roleTitle: role.roleTitle,
        location: role.location,
        startDate: role.startDate?.normalized ?? null,
        endDate: role.endDate?.normalized ?? null,
        workArrangement: role.workArrangement,
        employmentType: role.employmentType,
        technologies: planRole.priorityTechnologies,
        sectionPosition: index,
        estimatedLineCount:
          1 + bullets.reduce((sum, bullet) => sum + bullet.estimatedLineCount, 0),
        bullets,
        provenance: buildStatementProvenance({
          statementId: `role-header:${role.id}`,
          sourceEvidenceIds: [role.id],
          sourceCareerRecordIds: [role.id],
          requirementIds: planRole.targetRequirementCoverage,
          templateId: "role-header.structured",
          technologies: planRole.priorityTechnologies,
          restrictions: planRole.restrictions,
          recordKinds: [role.recordKind],
          confirmationStates: [role.confirmationState],
          truthfulnessClassification: "VERIFIED_SOURCE"
        })
      };
    })
    .filter((role): role is NonNullable<typeof role> => role !== null);

  const selectedProjects = plan.projectPlans
    .filter((project) => project.selectionStatus === "INCLUDE" || project.selectionStatus === "CONSIDER")
    .map((planProject, index) => {
      const project = projectMap.get(planProject.projectId);
      if (!project) {
        pushDiagnostic(diagnostics, {
          severity: "ERROR",
          code: "INVALID_PROJECT_REFERENCE",
          message: `Structured resume plan project ${planProject.projectId} could not be resolved in the career profile.`,
          relatedRequirementId: planProject.requirementCoverage[0] ?? null,
          relatedCandidateId: planProject.projectId
        });
        return null;
      }
      const bullets = Array.from({ length: Math.max(1, planProject.maximumBulletBudget) })
        .map((_, bulletIndex) => buildProjectBullet(project, planProject, bulletIndex, usedTexts, diagnostics))
        .filter((bullet): bullet is NonNullable<typeof bullet> => bullet !== null)
        .slice(0, planProject.maximumBulletBudget);
      return {
        projectId: project.id,
        projectName: project.name,
        contextLabel: project.context,
        role: project.role,
        startDate: project.dates.startDate?.normalized ?? null,
        endDate: project.dates.endDate?.normalized ?? null,
        technologies: project.technologies,
        projectOnlyDisclosure: planProject.projectOnlyWarning,
        sectionPosition: index,
        estimatedLineCount: 1 + bullets.reduce((sum, bullet) => sum + bullet.estimatedLineCount, 0),
        bullets,
        provenance: buildStatementProvenance({
          statementId: `project-header:${project.id}`,
          sourceEvidenceIds: [project.id],
          sourceCareerRecordIds: [project.id],
          requirementIds: planProject.requirementCoverage,
          templateId: "project-header.structured",
          technologies: project.technologies,
          restrictions: planProject.restrictions,
          recordKinds: [project.recordKind],
          confirmationStates: [project.confirmationState],
          truthfulnessClassification:
            planProject.restrictions.includes("PROJECT_ONLY") ? "QUALIFIED" : "VERIFIED_SOURCE"
        })
      };
    })
    .filter((project): project is NonNullable<typeof project> => project !== null);

  const education = [...parsed.careerProfileContent.education]
    .sort((a, b) => compareDatesDescending(a.completionDate?.normalized ?? null, b.completionDate?.normalized ?? null))
    .map((record: CareerEducation) => ({
      educationId: record.id,
      institution: record.institution,
      degree: record.degree,
      field: record.field,
      completionDate: record.completionDate?.normalized ?? null,
      status: record.status,
      provenance: buildStatementProvenance({
        statementId: `education:${record.id}`,
        sourceEvidenceIds: [record.id],
        sourceCareerRecordIds: [record.id],
        templateId: "education.direct-source",
        recordKinds: [record.recordKind],
        confirmationStates: [record.confirmationState],
        truthfulnessClassification: "VERIFIED_SOURCE"
      })
    }));

  const certifications = parsed.careerProfileContent.certifications
    .filter((record: CareerCertification) => record.status === "CURRENT")
    .map((record: CareerCertification) => ({
      certificationId: record.id,
      name: record.name,
      issuer: record.issuer,
      date: record.awardDate?.normalized ?? null,
      expirationDate: record.expirationDate?.normalized ?? null,
      currentDisplay: "Current",
      inclusionReason: "Current certification remains eligible for targeted resume inclusion.",
      provenance: buildStatementProvenance({
        statementId: `certification:${record.id}`,
        sourceEvidenceIds: [record.id],
        sourceCareerRecordIds: [record.id],
        templateId: "certification.current",
        recordKinds: [record.recordKind],
        confirmationStates: [record.confirmationState],
        truthfulnessClassification: "VERIFIED_SOURCE"
      })
    }));

  const contentBase = {
    runId: parsed.runId,
    workspaceId: parsed.workspaceId,
    structuredResumeVersionId: parsed.structuredResumeVersionId,
    careerProfileVersionId: parsed.careerProfileVersionId,
    requirementAnalysisId: plan.requirementAnalysisId,
    matchReportRunId: plan.matchReportRunId,
    jobDescriptionVersionId: plan.jobDescriptionVersionId,
    applicationId: plan.applicationId,
    resumeCompositionContractVersion: RESUME_COMPOSITION_CONTRACT_VERSION,
    resumeCompositionEngineVersion: RESUME_COMPOSITION_ENGINE_VERSION,
    resumeCompositionConfigurationVersion: RESUME_COMPOSITION_CONFIGURATION_VERSION,
    createdAt: parsed.createdAt,
    inputChecksum: parsed.inputChecksum,
    status: "READY" as const,
    targetCompany: plan.targetConfiguration.targetCompany,
    targetRole: plan.targetConfiguration.targetRole,
    targetRoleFamily: plan.targetConfiguration.targetRoleFamily,
    stackFamily: plan.targetConfiguration.targetStackFamily,
    pageTarget: plan.targetConfiguration.targetPageCount,
    diagnostics,
    header,
    professionalSummary: {
      sentences: summarySentences,
      text: summaryText,
      sentenceCount: summarySentences.length,
      wordCount: wordCount(summaryText),
      warnings: summaryWarnings
    },
    skillsGroups,
    professionalExperience,
    selectedProjects,
    education,
    certifications,
    finalSectionOrder: resumeCompositionConfiguration.sectionOrder.filter((section) => {
      if (section === "SELECTED_PROJECTS") {
        return selectedProjects.length > 0;
      }
      if (section === "EDUCATION") {
        return education.length > 0;
      }
      if (section === "CERTIFICATIONS") {
        return certifications.length > 0;
      }
      return true;
    }),
    sectionEstimates: [],
    summary: {
      targetCompany: plan.targetConfiguration.targetCompany,
      targetRole: plan.targetConfiguration.targetRole,
      targetRoleFamily: plan.targetConfiguration.targetRoleFamily,
      stackFamily: plan.targetConfiguration.targetStackFamily,
      sectionCount: 0,
      summaryWordCount: 0,
      skillCount: 0,
      includedRoleCount: 0,
      includedProjectCount: 0,
      bulletCount: 0,
      verifiedSourceStatementCount: 0,
      verifiedCompositeStatementCount: 0,
      qualifiedStatementCount: 0,
      prohibitedStatementCount: 0,
      estimatedLineCount: 0,
      estimatedPageCount: 0,
      pageBudgetStatus: "WITHIN_TARGET" as const,
      diagnosticErrorCount: 0,
      diagnosticWarningCount: 0,
      diagnosticInfoCount: 0
    }
  };

  const trimmed = trimToBudget(contentBase, diagnostics);
  const allProvenance = [
    ...header.flatMap((entry) => (entry.provenance ? [entry.provenance] : [])),
    ...trimmed.professionalSummary.sentences.map((sentence) => sentence.provenance),
    ...trimmed.skillsGroups.flatMap((group) => group.skills.map((skill) => skill.provenance)),
    ...trimmed.professionalExperience.flatMap((role) => [role.provenance, ...role.bullets.map((bullet) => bullet.provenance)]),
    ...trimmed.selectedProjects.flatMap((project) => [project.provenance, ...project.bullets.map((bullet) => bullet.provenance)]),
    ...education.map((entry) => entry.provenance),
    ...trimmed.certifications.map((entry) => entry.provenance)
  ];

  const errorCount = diagnostics.filter((item) => item.severity === "ERROR").length;
  const warningCount = diagnostics.filter((item) => item.severity === "WARNING").length;
  const infoCount = diagnostics.filter((item) => item.severity === "INFO").length;
  const pageBudgetStatus =
    trimmed.budget.estimatedLineCount >
    plan.pageBudget.maximumPages * resumeCompositionConfiguration.pageBudget.linesPerPage
      ? "OVER_BUDGET"
      : trimmed.budget.estimatedLineCount >
            plan.pageBudget.targetPages *
              resumeCompositionConfiguration.pageBudget.linesPerPage *
              0.9
        ? "AT_RISK"
        : "WITHIN_TARGET";
  const status =
    errorCount > 0 || pageBudgetStatus === "OVER_BUDGET"
      ? "NEEDS_REVIEW"
      : plan.status === "READY_WITH_LIMITATIONS" || warningCount > 0
        ? "READY_WITH_WARNINGS"
        : "READY";

  return resumeCompositionContentSchema.parse({
    ...contentBase,
    status,
    professionalSummary: trimmed.professionalSummary,
    skillsGroups: trimmed.skillsGroups,
    professionalExperience: trimmed.professionalExperience,
    selectedProjects: trimmed.selectedProjects,
    certifications: trimmed.certifications,
    sectionEstimates: trimmed.budget.sectionEstimates,
    summary: {
      targetCompany: plan.targetConfiguration.targetCompany,
      targetRole: plan.targetConfiguration.targetRole,
      targetRoleFamily: plan.targetConfiguration.targetRoleFamily,
      stackFamily: plan.targetConfiguration.targetStackFamily,
      sectionCount: contentBase.finalSectionOrder.length,
      summaryWordCount: trimmed.professionalSummary.wordCount,
      skillCount: trimmed.skillsGroups.reduce((sum, group) => sum + group.skills.length, 0),
      includedRoleCount: trimmed.professionalExperience.length,
      includedProjectCount: trimmed.selectedProjects.length,
      bulletCount:
        trimmed.professionalExperience.reduce((sum, role) => sum + role.bullets.length, 0) +
        trimmed.selectedProjects.reduce((sum, project) => sum + project.bullets.length, 0),
      verifiedSourceStatementCount: allProvenance.filter((entry) => entry.truthfulnessClassification === "VERIFIED_SOURCE").length,
      verifiedCompositeStatementCount: allProvenance.filter((entry) => entry.truthfulnessClassification === "VERIFIED_COMPOSITE").length,
      qualifiedStatementCount: allProvenance.filter((entry) => entry.truthfulnessClassification === "QUALIFIED").length,
      prohibitedStatementCount: allProvenance.filter((entry) => entry.truthfulnessClassification === "PROHIBITED").length,
      estimatedLineCount: trimmed.budget.estimatedLineCount,
      estimatedPageCount: Number(
        Math.max(1, trimmed.budget.estimatedLineCount / resumeCompositionConfiguration.pageBudget.linesPerPage).toFixed(2)
      ),
      pageBudgetStatus,
      diagnosticErrorCount: errorCount,
      diagnosticWarningCount: warningCount,
      diagnosticInfoCount: infoCount
    }
  });
}
