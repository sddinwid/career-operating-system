import { randomUUID } from "node:crypto";
import {
  RESUME_REVISION_CONFIGURATION_VERSION,
  RESUME_REVISION_CONTRACT_VERSION,
  RESUME_REVISION_ENGINE_VERSION,
  resumeRevisionConfiguration
} from "@/lib/resume-revision/config";
import {
  type ResumeRevisionChange,
  type ResumeRevisionContent,
  type ResumeRevisionDiagnostic,
  type ResumeRevisionRecord,
  type ResumeRevisionReviewNote,
  type ResumeRevisionSummary
} from "@/lib/resume-revision/contract";
import type { ResumeAuditResult } from "@/lib/resume-audit/contract";
import type { ResumeCompositionContent } from "@/lib/resume-composition/contract";

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`
    )
    .join(",")}}`;
}

async function computeSha256(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(value: string) {
  return value
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function uniqueNormalizedTexts(values: string[]) {
  return values
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function extractTechnologyTokens(value: string) {
  return [...value.matchAll(/\b[A-Za-z][A-Za-z0-9.+#/-]{1,}\b/g)].map((match) => match[0]!.trim());
}

function extractMetricTokens(value: string) {
  return [...value.matchAll(/\b\d+(?:\.\d+)?%?\b/g)].map((match) => match[0]!.trim());
}

function extractYearClaims(value: string) {
  return [...value.matchAll(/(\d+)\+?\s+years?/gi)].map((match) =>
    Number.parseInt(match[1] ?? "0", 10)
  );
}

function deriveSummarySentenceText(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferSectionProfile(order: string[]) {
  const projectsIndex = order.indexOf("SELECTED_PROJECTS");
  const experienceIndex = order.indexOf("PROFESSIONAL_EXPERIENCE");

  return projectsIndex !== -1 && experienceIndex !== -1 && projectsIndex < experienceIndex
    ? "PROJECT_FORWARD_AI"
    : "STANDARD_ENGINEERING";
}

function buildUserEditState() {
  return {
    editedAt: null,
    changeReason: null,
    classification: "UNCHANGED" as const,
    validationState: "VALID" as const,
    changeIds: [],
    priorAuditFindingIds: [],
    addressedAuditFindingIds: [],
    mayIntroduceNewFindings: false
  };
}

export async function computeResumeRevisionChecksum(args: {
  sourceInputChecksum: string;
  content: ResumeRevisionContent;
  reviewNotes: ResumeRevisionReviewNote[];
}) {
  return computeSha256(
    stableSerialize({
      sourceInputChecksum: args.sourceInputChecksum,
      resumeRevisionContractVersion: RESUME_REVISION_CONTRACT_VERSION,
      resumeRevisionEngineVersion: RESUME_REVISION_ENGINE_VERSION,
      resumeRevisionConfigurationVersion: RESUME_REVISION_CONFIGURATION_VERSION,
      configuration: resumeRevisionConfiguration,
      content: args.content,
      reviewNotes: args.reviewNotes
    })
  );
}

export async function createResumeRevisionDraftFromComposition(args: {
  revisionId: string;
  workspaceId: string;
  baseResumeCompositionVersionId: string;
  predecessorRevisionId: string | null;
  sourceInputChecksum: string;
  composition: ResumeCompositionContent;
  createdAt: string;
}) {
  const sectionProfile = inferSectionProfile(args.composition.finalSectionOrder);
  const content: ResumeRevisionContent = {
    revisionId: args.revisionId,
    workspaceId: args.workspaceId,
    baseResumeCompositionVersionId: args.baseResumeCompositionVersionId,
    predecessorRevisionId: args.predecessorRevisionId,
    structuredResumeVersionId: args.composition.structuredResumeVersionId,
    careerProfileVersionId: args.composition.careerProfileVersionId,
    requirementAnalysisId: args.composition.requirementAnalysisId,
    matchReportRunId: args.composition.matchReportRunId,
    jobDescriptionVersionId: args.composition.jobDescriptionVersionId,
    applicationId: args.composition.applicationId,
    resumeRevisionContractVersion: RESUME_REVISION_CONTRACT_VERSION,
    resumeRevisionEngineVersion: RESUME_REVISION_ENGINE_VERSION,
    resumeRevisionConfigurationVersion: RESUME_REVISION_CONFIGURATION_VERSION,
    sourceInputChecksum: args.sourceInputChecksum,
    inputChecksum: "",
    createdAt: args.createdAt,
    updatedAt: args.createdAt,
    status: "DRAFT",
    validationState: "VALID",
    targetCompany: args.composition.targetCompany,
    targetRole: args.composition.targetRole,
    targetRoleFamily: args.composition.targetRoleFamily,
    stackFamily: args.composition.stackFamily,
    pageTarget: args.composition.pageTarget,
    header: args.composition.header,
    sectionControls: [
      { sectionType: "HEADER", enabled: true, required: true },
      {
        sectionType: "PROFESSIONAL_SUMMARY",
        enabled: args.composition.professionalSummary.text.length > 0,
        required: false
      },
      {
        sectionType: "CORE_SKILLS",
        enabled: args.composition.skillsGroups.some((group) => group.skills.length > 0),
        required: false
      },
      { sectionType: "PROFESSIONAL_EXPERIENCE", enabled: true, required: true },
      {
        sectionType: "SELECTED_PROJECTS",
        enabled: args.composition.selectedProjects.length > 0,
        required: false
      },
      {
        sectionType: "EDUCATION",
        enabled: args.composition.education.length > 0,
        required: false
      },
      {
        sectionType: "CERTIFICATIONS",
        enabled: args.composition.certifications.length > 0,
        required: false
      }
    ],
    sectionOrder: {
      profile: sectionProfile,
      reason: null
    },
    professionalSummary: {
      enabled: args.composition.professionalSummary.text.length > 0,
      originalText: args.composition.professionalSummary.text,
      currentText: args.composition.professionalSummary.text,
      sentences: args.composition.professionalSummary.sentences.map((sentence, index) => ({
        ...sentence,
        originalText: sentence.text,
        currentText: sentence.text,
        included: true,
        order: index,
        userEdit: buildUserEditState()
      })),
      noteId: null
    },
    skillsGroups: args.composition.skillsGroups.map((group) => ({
      ...group,
      skills: group.skills.map((skill, index) => ({
        ...skill,
        originalGroupId: group.groupId,
        groupId: group.groupId,
        originalOrder: index,
        order: index,
        included: true,
        originalQualificationText: skill.qualificationText,
        userEdit: buildUserEditState()
      }))
    })),
    professionalExperience: args.composition.professionalExperience.map((role) => ({
      ...role,
      included: true,
      displayMode: "DETAILED" as const,
      bullets: role.bullets.map((bullet, index) => ({
        ...bullet,
        originalText: bullet.text,
        currentText: bullet.text,
        originalOrder: index,
        order: index,
        included: true,
        roleOrProjectId: role.roleId,
        noteId: null,
        userEdit: buildUserEditState()
      })),
      noteId: null
    })),
    selectedProjects: args.composition.selectedProjects.map((project) => ({
      ...project,
      included: true,
      bullets: project.bullets.map((bullet, index) => ({
        ...bullet,
        originalText: bullet.text,
        currentText: bullet.text,
        originalOrder: index,
        order: index,
        included: true,
        roleOrProjectId: project.projectId,
        noteId: null,
        userEdit: buildUserEditState()
      })),
      noteId: null
    })),
    education: args.composition.education,
    certifications: args.composition.certifications.map((item) => ({
      ...item,
      included: true
    })),
    sectionEstimates: args.composition.sectionEstimates
  };

  content.inputChecksum = await computeResumeRevisionChecksum({
    sourceInputChecksum: args.sourceInputChecksum,
    content,
    reviewNotes: []
  });

  return content;
}

function pushDiagnostic(
  diagnostics: ResumeRevisionDiagnostic[],
  diagnostic: ResumeRevisionDiagnostic
) {
  diagnostics.push(diagnostic);
}

function applyEditState<T extends { editedAt: string | null; classification: string; validationState: string; mayIntroduceNewFindings: boolean }>(
  current: T,
  editedAt: string | null,
  classification: T["classification"],
  validationState: T["validationState"],
  mayIntroduceNewFindings: boolean
) {
  current.editedAt = editedAt;
  current.classification = classification;
  current.validationState = validationState;
  current.mayIntroduceNewFindings = mayIntroduceNewFindings;
}

export function buildResumeRevisionRecord(args: {
  content: ResumeRevisionContent;
  reviewNotes: ResumeRevisionReviewNote[];
  latestAudit: ResumeAuditResult | null;
  latestAuditStatus: string | null;
}) {
  const now = args.content.updatedAt;
  const diagnostics: ResumeRevisionDiagnostic[] = [];
  const changeSet: ResumeRevisionChange[] = [];
  const findingResolutions = (args.latestAudit?.findings ?? []).map((finding) => ({
    findingId: finding.findingId,
    resolutionState: "UNRESOLVED" as const,
    inferredFromChangeIds: []
  }));

  const content = structuredClone(args.content);

  const supportedSectionOrder = resumeRevisionConfiguration.sectionProfiles[content.sectionOrder.profile];
  const enabledSections = new Set(
    content.sectionControls.filter((section) => section.enabled).map((section) => section.sectionType)
  );

  const summaryWordCount = countWords(content.professionalSummary.currentText);
  const summarySentenceCount = countSentences(content.professionalSummary.currentText);

  if (summaryWordCount > resumeRevisionConfiguration.summary.maxWords) {
    pushDiagnostic(diagnostics, {
      code: "summary.word-limit",
      severity: "ERROR",
      message: "Professional summary exceeds the configured word limit.",
      entityType: "SUMMARY",
      entityId: "professional-summary",
      statementId: null,
      section: "PROFESSIONAL_SUMMARY"
    });
  }

  if (summarySentenceCount > resumeRevisionConfiguration.summary.maxSentences) {
    pushDiagnostic(diagnostics, {
      code: "summary.sentence-limit",
      severity: "ERROR",
      message: "Professional summary exceeds the configured sentence limit.",
      entityType: "SUMMARY",
      entityId: "professional-summary",
      statementId: null,
      section: "PROFESSIONAL_SUMMARY"
    });
  }

  if (resumeRevisionConfiguration.forbiddenCharacters.some((item) => content.professionalSummary.currentText.includes(item))) {
    pushDiagnostic(diagnostics, {
      code: "summary.em-dash",
      severity: "ERROR",
      message: "Professional summary contains an em dash, which is not allowed.",
      entityType: "SUMMARY",
      entityId: "professional-summary",
      statementId: null,
      section: "PROFESSIONAL_SUMMARY"
    });
  }

  for (const sentence of content.professionalSummary.sentences) {
    const changed = sentence.currentText !== sentence.originalText || !sentence.included || sentence.order !== content.professionalSummary.sentences.findIndex((item) => item.statementId === sentence.statementId);
    if (changed) {
      const changeId = randomUUID();
      sentence.userEdit.changeIds = [changeId];
      sentence.userEdit.editedAt = now;
      sentence.userEdit.classification = "USER_EDITED_VERIFIED";
      sentence.userEdit.validationState = "VALID";
      sentence.userEdit.mayIntroduceNewFindings = false;
      changeSet.push({
        changeId,
        entityType: "SUMMARY_SENTENCE",
        entityId: sentence.statementId,
        statementId: sentence.statementId,
        field: "text",
        originalValue: sentence.originalText,
        revisedValue: sentence.currentText,
        changeType:
          sentence.currentText !== sentence.originalText ? "TEXT_EDIT" : sentence.included ? "REORDER" : "EXCLUDE",
        changeReason: sentence.userEdit.changeReason,
        validationResult: "VALID",
        provenancePreserved: true,
        auditRequired: sentence.currentText !== sentence.originalText,
        timestamp: now
      });
    }
  }

  const seenSkills = new Set<string>();

  for (const group of content.skillsGroups) {
    for (const skill of group.skills) {
      const changed =
        skill.included !== true ||
        skill.order !== skill.originalOrder ||
        skill.groupId !== skill.originalGroupId ||
        skill.qualificationText !== skill.originalQualificationText;

      if (skill.included) {
        const key = skill.displayValue.trim().toLowerCase();
        if (seenSkills.has(key)) {
          pushDiagnostic(diagnostics, {
            code: "skills.duplicate",
            severity: "ERROR",
            message: `Duplicate skill "${skill.displayValue}" is included more than once.`,
            entityType: "SKILL",
            entityId: skill.canonicalValue,
            statementId: skill.provenance.statementId,
            section: "CORE_SKILLS"
          });
        }
        seenSkills.add(key);
      }

      if (!skill.professionalUse && !skill.qualificationText && skill.included) {
        pushDiagnostic(diagnostics, {
          code: "skills.project-only-qualification",
          severity: "WARNING",
          message: `Skill "${skill.displayValue}" should stay qualified because it is not backed by professional use.`,
          entityType: "SKILL",
          entityId: skill.canonicalValue,
          statementId: skill.provenance.statementId,
          section: "CORE_SKILLS"
        });
      }

      if (changed) {
        const changeId = randomUUID();
        skill.userEdit.changeIds = [changeId];
        skill.userEdit.editedAt = now;
        skill.userEdit.classification =
          skill.qualificationText !== skill.originalQualificationText
            ? "USER_EDITED_QUALIFIED"
            : "USER_EDITED_VERIFIED";
        skill.userEdit.validationState = "VALID";
        skill.userEdit.mayIntroduceNewFindings = false;
        changeSet.push({
          changeId,
          entityType: "SKILL",
          entityId: skill.canonicalValue,
          statementId: skill.provenance.statementId,
          field: "skill",
          originalValue: `${skill.originalGroupId}:${skill.originalOrder}:${skill.originalQualificationText ?? ""}:true`,
          revisedValue: `${skill.groupId}:${skill.order}:${skill.qualificationText ?? ""}:${skill.included}`,
          changeType:
            skill.qualificationText !== skill.originalQualificationText
              ? "QUALIFY"
              : skill.included
                ? "REORDER"
                : "EXCLUDE",
          changeReason: skill.userEdit.changeReason,
          validationResult: "VALID",
          provenancePreserved: true,
          auditRequired: false,
          timestamp: now
        });
      }
    }
  }

  const seenBullets = new Set<string>();
  const allBulletTexts: string[] = [];
  const bulletCollections = [
    ...content.professionalExperience.flatMap((role) =>
      role.bullets.map((bullet) => ({ section: "PROFESSIONAL_EXPERIENCE" as const, isProject: false, bullet }))
    ),
    ...content.selectedProjects.flatMap((project) =>
      project.bullets.map((bullet) => ({ section: "SELECTED_PROJECTS" as const, isProject: true, bullet }))
    )
  ];

  for (const { section, isProject, bullet } of bulletCollections) {
    const normalized = bullet.currentText.trim().toLowerCase();

    if (bullet.included && normalized.length > 0) {
      if (seenBullets.has(normalized)) {
        pushDiagnostic(diagnostics, {
          code: "bullet.duplicate",
          severity: "ERROR",
          message: "Duplicate included bullet text detected.",
          entityType: isProject ? "PROJECT_BULLET" : "ROLE_BULLET",
          entityId: bullet.roleOrProjectId,
          statementId: bullet.statementId,
          section
        });
      }
      seenBullets.add(normalized);
      allBulletTexts.push(bullet.currentText);
    }

    const changed =
      bullet.currentText !== bullet.originalText ||
      bullet.included !== true ||
      bullet.order !== bullet.originalOrder;

    if (changed) {
      const originalMetrics = extractMetricTokens(bullet.originalText);
      const currentMetrics = extractMetricTokens(bullet.currentText);
      const metricsChanged = stableSerialize(originalMetrics) !== stableSerialize(currentMetrics);
      const supportedTechnologies = new Set(
        [...bullet.provenance.technologies, ...extractTechnologyTokens(bullet.originalText)].map((item) =>
          item.toLowerCase()
        )
      );
      const introducedTechnologies = extractTechnologyTokens(bullet.currentText).filter(
        (item) => !supportedTechnologies.has(item.toLowerCase())
      );
      const yearClaims = extractYearClaims(bullet.currentText);
      const unsupportedLeadership = resumeRevisionConfiguration.leadershipTerms.some(
        (term) =>
          bullet.currentText.toLowerCase().includes(term) &&
          !bullet.originalText.toLowerCase().includes(term)
      );
      const unsupportedOwnership = resumeRevisionConfiguration.unsupportedOwnershipTerms.some((term) =>
        bullet.currentText.toLowerCase().includes(term)
      );

      let validationResult: ResumeRevisionChange["validationResult"] = "VALID";
      let classification: typeof bullet.userEdit.classification = "USER_EDITED_VERIFIED";
      let mayIntroduceNewFindings = false;

      if (metricsChanged) {
        validationResult = "BLOCKED";
        classification = "USER_EDITED_NEEDS_REVIEW";
        mayIntroduceNewFindings = true;
        pushDiagnostic(diagnostics, {
          code: "bullet.metric-change",
          severity: "ERROR",
          message: "Edited bullet changes or introduces metric values that were not in the deterministic source.",
          entityType: isProject ? "PROJECT_BULLET" : "ROLE_BULLET",
          entityId: bullet.roleOrProjectId,
          statementId: bullet.statementId,
          section
        });
      }

      if (introducedTechnologies.length > 0) {
        validationResult = "BLOCKED";
        classification = "USER_EDITED_NEEDS_REVIEW";
        mayIntroduceNewFindings = true;
        pushDiagnostic(diagnostics, {
          code: "bullet.unsupported-technology",
          severity: "ERROR",
          message: `Edited bullet introduces unsupported technology terms: ${introducedTechnologies.join(", ")}.`,
          entityType: isProject ? "PROJECT_BULLET" : "ROLE_BULLET",
          entityId: bullet.roleOrProjectId,
          statementId: bullet.statementId,
          section
        });
      }

      if (unsupportedLeadership || unsupportedOwnership) {
        validationResult = validationResult === "BLOCKED" ? "BLOCKED" : "NEEDS_REVIEW";
        classification = "USER_EDITED_NEEDS_REVIEW";
        mayIntroduceNewFindings = true;
        pushDiagnostic(diagnostics, {
          code: unsupportedOwnership ? "bullet.unsupported-ownership" : "bullet.unsupported-leadership",
          severity: unsupportedOwnership ? "ERROR" : "WARNING",
          message: "Edited bullet adds leadership or ownership language that is not clearly supported by the deterministic source.",
          entityType: isProject ? "PROJECT_BULLET" : "ROLE_BULLET",
          entityId: bullet.roleOrProjectId,
          statementId: bullet.statementId,
          section
        });
      }

      if (yearClaims.some((value) => value > 8)) {
        validationResult = "BLOCKED";
        classification = "USER_EDITED_NEEDS_REVIEW";
        mayIntroduceNewFindings = true;
        pushDiagnostic(diagnostics, {
          code: "bullet.unsupported-years",
          severity: "ERROR",
          message: "Edited bullet introduces an unsupported years-of-experience claim.",
          entityType: isProject ? "PROJECT_BULLET" : "ROLE_BULLET",
          entityId: bullet.roleOrProjectId,
          statementId: bullet.statementId,
          section
        });
      }

      if (resumeRevisionConfiguration.forbiddenCharacters.some((item) => bullet.currentText.includes(item))) {
        validationResult = "BLOCKED";
        classification = "USER_EDITED_NEEDS_REVIEW";
        mayIntroduceNewFindings = true;
        pushDiagnostic(diagnostics, {
          code: "bullet.em-dash",
          severity: "ERROR",
          message: "Edited bullet contains an em dash, which is not allowed.",
          entityType: isProject ? "PROJECT_BULLET" : "ROLE_BULLET",
          entityId: bullet.roleOrProjectId,
          statementId: bullet.statementId,
          section
        });
      }

      if (bullet.currentText.length > resumeRevisionConfiguration.bullet.maxCharacters) {
        validationResult = validationResult === "BLOCKED" ? "BLOCKED" : "VALID_WITH_WARNINGS";
        pushDiagnostic(diagnostics, {
          code: "bullet.length",
          severity: "WARNING",
          message: "Edited bullet may be too long for the current page budget.",
          entityType: isProject ? "PROJECT_BULLET" : "ROLE_BULLET",
          entityId: bullet.roleOrProjectId,
          statementId: bullet.statementId,
          section
        });
      }

      const changeId = randomUUID();
      bullet.userEdit.changeIds = [changeId];
      bullet.userEdit.editedAt = now;
      bullet.userEdit.classification = classification;
      bullet.userEdit.validationState = validationResult;
      bullet.userEdit.mayIntroduceNewFindings = mayIntroduceNewFindings;

      changeSet.push({
        changeId,
        entityType: isProject ? "PROJECT_BULLET" : "ROLE_BULLET",
        entityId: bullet.roleOrProjectId,
        statementId: bullet.statementId,
        field: "text",
        originalValue: bullet.originalText,
        revisedValue: bullet.currentText,
        changeType:
          bullet.currentText !== bullet.originalText
            ? "TEXT_EDIT"
            : bullet.included
              ? "REORDER"
              : "EXCLUDE",
        changeReason: bullet.userEdit.changeReason,
        validationResult,
        provenancePreserved: true,
        auditRequired: true,
        timestamp: now
      });
    }
  }

  for (const sectionControl of content.sectionControls) {
    if (sectionControl.required && !sectionControl.enabled) {
      pushDiagnostic(diagnostics, {
        code: "section.required",
        severity: "ERROR",
        message: `${sectionControl.sectionType.replace(/_/g, " ")} cannot be disabled.`,
        entityType: "SECTION",
        entityId: sectionControl.sectionType,
        statementId: null,
        section: sectionControl.sectionType
      });
    }

    if (
      sectionControl.enabled &&
      sectionControl.sectionType === "PROFESSIONAL_SUMMARY" &&
      content.professionalSummary.currentText.trim().length === 0
    ) {
      pushDiagnostic(diagnostics, {
        code: "section.empty-summary",
        severity: "ERROR",
        message: "Professional Summary is enabled but empty.",
        entityType: "SECTION",
        entityId: sectionControl.sectionType,
        statementId: null,
        section: sectionControl.sectionType
      });
    }
  }

  if (stableSerialize(supportedSectionOrder) === stableSerialize(resumeRevisionConfiguration.sectionProfiles.PROJECT_FORWARD_AI)) {
    const hasVisibleProjects = content.selectedProjects.some((project) => project.included);
    if (!hasVisibleProjects) {
      pushDiagnostic(diagnostics, {
        code: "section-profile.projects-required",
        severity: "ERROR",
        message: "Project-forward ordering requires at least one visible project.",
        entityType: "SECTION_PROFILE",
        entityId: content.sectionOrder.profile,
        statementId: null,
        section: null
      });
    }
  }

  const estimatedPageCount = Math.max(
    1,
    Number.parseFloat(
      (
        content.professionalExperience.filter((role) => role.included).length * 0.35 +
        content.selectedProjects.filter((project) => project.included).length * 0.25 +
        content.skillsGroups.reduce(
          (total, group) => total + group.skills.filter((skill) => skill.included).length,
          0
        ) * 0.04 +
        allBulletTexts.length * 0.06 +
        (enabledSections.has("PROFESSIONAL_SUMMARY") ? 0.2 : 0) +
        (enabledSections.has("EDUCATION") ? 0.15 : 0) +
        (enabledSections.has("CERTIFICATIONS") ? 0.1 : 0)
      ).toFixed(2)
    )
  );

  if (estimatedPageCount > resumeRevisionConfiguration.pageBudget.blockedPages) {
    pushDiagnostic(diagnostics, {
      code: "page-budget.blocked",
      severity: "ERROR",
      message: "Revised resume exceeds the blocked page-budget threshold.",
      entityType: "REVISION",
      entityId: content.revisionId,
      statementId: null,
      section: null
    });
  } else if (estimatedPageCount > resumeRevisionConfiguration.pageBudget.warningPages) {
    pushDiagnostic(diagnostics, {
      code: "page-budget.warning",
      severity: "WARNING",
      message: "Revised resume is above the page-budget warning threshold.",
      entityType: "REVISION",
      entityId: content.revisionId,
      statementId: null,
      section: null
    });
  }

  let validationState: ResumeRevisionSummary["localValidationState"] = "VALID";
  if (diagnostics.some((item) => item.severity === "ERROR")) {
    validationState = diagnostics.some((item) =>
      ["bullet.metric-change", "bullet.unsupported-technology", "bullet.unsupported-years", "section.required", "page-budget.blocked", "summary.word-limit", "summary.sentence-limit", "summary.em-dash", "section-profile.projects-required", "bullet.duplicate", "skills.duplicate", "bullet.em-dash"].includes(item.code)
    )
      ? "BLOCKED"
      : "NEEDS_REVIEW";
  } else if (diagnostics.some((item) => item.severity === "WARNING")) {
    validationState = "VALID_WITH_WARNINGS";
  }

  content.validationState = validationState;

  if (validationState === "VALID" || validationState === "VALID_WITH_WARNINGS") {
    content.status = "DRAFT";
  } else {
    content.status = "NEEDS_REVIEW";
  }

  const summary: ResumeRevisionSummary = {
    baseResumeCompositionVersionId: content.baseResumeCompositionVersionId,
    predecessorRevisionId: content.predecessorRevisionId,
    revisionStatus: content.status,
    editedSummarySentenceCount: content.professionalSummary.sentences.filter(
      (sentence) => sentence.currentText !== sentence.originalText
    ).length,
    editedBulletCount: bulletCollections.filter((item) => item.bullet.currentText !== item.bullet.originalText).length,
    includedSkillChanges: content.skillsGroups.reduce(
      (total, group) =>
        total +
        group.skills.filter(
          (skill) => skill.included && (skill.originalOrder !== skill.order || skill.originalGroupId !== skill.groupId)
        ).length,
      0
    ),
    excludedSkillChanges: content.skillsGroups.reduce(
      (total, group) => total + group.skills.filter((skill) => !skill.included).length,
      0
    ),
    includedRoleChanges: content.professionalExperience.filter((role) => !role.included).length,
    includedProjectChanges: content.selectedProjects.filter((project) => !project.included).length,
    reorderedItemCount: changeSet.filter((item) => item.changeType === "REORDER").length,
    qualificationCount: changeSet.filter((item) => item.changeType === "QUALIFY").length,
    reviewNoteCount: args.reviewNotes.length,
    unresolvedFindingCount: findingResolutions.filter((item) => item.resolutionState === "UNRESOLVED").length,
    estimatedPageCount,
    localValidationState: validationState,
    latestAuditStatus: args.latestAuditStatus,
    changeCount: changeSet.length
  };

  return {
    content,
    changeSet,
    summary,
    diagnostics,
    reviewNotes: args.reviewNotes,
    findingResolutions
  } satisfies ResumeRevisionRecord;
}

export function projectResumeRevisionToCompositionContent(args: {
  content: ResumeRevisionContent;
}) {
  const visibleSkillsGroups = args.content.skillsGroups
    .map((group) => ({
      ...group,
      skills: group.skills
        .filter((skill) => skill.included)
        .sort((a, b) => a.order - b.order)
        .map((skill) => ({
          canonicalValue: skill.canonicalValue,
          displayValue: skill.displayValue,
          supportingEvidenceIds: skill.supportingEvidenceIds,
          requirementIds: skill.requirementIds,
          professionalUse: skill.professionalUse,
          projectUse: skill.projectUse,
          recency: skill.recency,
          qualificationText: skill.qualificationText,
          inclusionReason: skill.inclusionReason,
          provenance: skill.provenance
        }))
    }))
    .filter((group) => group.skills.length > 0)
    .sort((a, b) => a.order - b.order);

  const visibleExperience = args.content.professionalExperience
    .filter((role) => role.included)
    .map((role) => ({
      roleId: role.roleId,
      employer: role.employer,
      roleTitle: role.roleTitle,
      location: role.location,
      startDate: role.startDate,
      endDate: role.endDate,
      workArrangement: role.workArrangement,
      employmentType: role.employmentType,
      technologies: role.technologies,
      sectionPosition: role.sectionPosition,
      estimatedLineCount: role.estimatedLineCount,
      bullets: role.bullets
        .filter((bullet) => bullet.included)
        .sort((a, b) => a.order - b.order)
        .map((bullet) => ({
          statementId: bullet.statementId,
          text: bullet.currentText,
          templateId: bullet.templateId,
          estimatedLineCount: bullet.estimatedLineCount,
          provenance: bullet.provenance
        })),
      provenance: role.provenance
    }));

  const visibleProjects = args.content.selectedProjects
    .filter((project) => project.included)
    .map((project) => ({
      projectId: project.projectId,
      projectName: project.projectName,
      contextLabel: project.contextLabel,
      role: project.role,
      startDate: project.startDate,
      endDate: project.endDate,
      technologies: project.technologies,
      projectOnlyDisclosure: project.projectOnlyDisclosure,
      sectionPosition: project.sectionPosition,
      estimatedLineCount: project.estimatedLineCount,
      bullets: project.bullets
        .filter((bullet) => bullet.included)
        .sort((a, b) => a.order - b.order)
        .map((bullet) => ({
          statementId: bullet.statementId,
          text: bullet.currentText,
          templateId: bullet.templateId,
          estimatedLineCount: bullet.estimatedLineCount,
          provenance: bullet.provenance
        })),
      provenance: project.provenance
    }));

  const summarySentences = args.content.professionalSummary.sentences
    .filter((sentence) => sentence.included)
    .sort((a, b) => a.order - b.order)
    .map((sentence) => ({
      statementId: sentence.statementId,
      text: sentence.currentText,
      templateId: sentence.templateId,
      provenance: sentence.provenance
    }));

  return {
    runId: args.content.revisionId,
    workspaceId: args.content.workspaceId,
    structuredResumeVersionId: args.content.structuredResumeVersionId,
    careerProfileVersionId: args.content.careerProfileVersionId,
    requirementAnalysisId: args.content.requirementAnalysisId,
    matchReportRunId: args.content.matchReportRunId,
    jobDescriptionVersionId: args.content.jobDescriptionVersionId,
    applicationId: args.content.applicationId,
    resumeCompositionContractVersion: RESUME_REVISION_CONTRACT_VERSION,
    resumeCompositionEngineVersion: RESUME_REVISION_ENGINE_VERSION,
    resumeCompositionConfigurationVersion: RESUME_REVISION_CONFIGURATION_VERSION,
    createdAt: args.content.createdAt,
    inputChecksum: args.content.inputChecksum,
    status:
      args.content.validationState === "BLOCKED"
        ? "NEEDS_REVIEW"
        : args.content.validationState === "NEEDS_REVIEW"
          ? "NEEDS_REVIEW"
          : args.content.validationState === "VALID_WITH_WARNINGS"
            ? "READY_WITH_WARNINGS"
            : "READY",
    targetCompany: args.content.targetCompany,
    targetRole: args.content.targetRole,
    targetRoleFamily: args.content.targetRoleFamily,
    stackFamily: args.content.stackFamily,
    pageTarget: args.content.pageTarget,
    diagnostics: [],
    header: args.content.header,
    professionalSummary: {
      sentences: summarySentences,
      text: args.content.professionalSummary.currentText,
      sentenceCount: summarySentences.length,
      wordCount: countWords(args.content.professionalSummary.currentText),
      warnings: []
    },
    skillsGroups: visibleSkillsGroups,
    professionalExperience: visibleExperience,
    selectedProjects: visibleProjects,
    education: args.content.sectionControls.find((item) => item.sectionType === "EDUCATION" && item.enabled)
      ? args.content.education
      : [],
    certifications: args.content.sectionControls.find((item) => item.sectionType === "CERTIFICATIONS" && item.enabled)
      ? args.content.certifications.filter((item) => item.included)
      : [],
    finalSectionOrder: resumeRevisionConfiguration.sectionProfiles[args.content.sectionOrder.profile].filter(
      (section) => args.content.sectionControls.find((item) => item.sectionType === section)?.enabled
    ),
    sectionEstimates: args.content.sectionEstimates,
    summary: {
      targetCompany: args.content.targetCompany,
      targetRole: args.content.targetRole,
      targetRoleFamily: args.content.targetRoleFamily,
      stackFamily: args.content.stackFamily,
      sectionCount: args.content.sectionControls.filter((section) => section.enabled).length,
      summaryWordCount: countWords(args.content.professionalSummary.currentText),
      skillCount: visibleSkillsGroups.reduce((total, group) => total + group.skills.length, 0),
      includedRoleCount: visibleExperience.length,
      includedProjectCount: visibleProjects.length,
      bulletCount:
        visibleExperience.reduce((total, role) => total + role.bullets.length, 0) +
        visibleProjects.reduce((total, project) => total + project.bullets.length, 0),
      verifiedSourceStatementCount: 0,
      verifiedCompositeStatementCount: 0,
      qualifiedStatementCount: 0,
      prohibitedStatementCount: 0,
      estimatedLineCount: args.content.sectionEstimates.reduce(
        (total, section) => total + section.estimatedLines,
        0
      ),
      estimatedPageCount: Math.max(1, args.content.sectionEstimates.reduce((total, section) => total + section.estimatedLines, 0) / 24),
      pageBudgetStatus: "WITHIN_TARGET" as const,
      diagnosticErrorCount: 0,
      diagnosticWarningCount: 0,
      diagnosticInfoCount: 0
    }
  } satisfies ResumeCompositionContent;
}

export function createRevisionReviewNote(args: {
  targetType: "REVISION" | "SECTION" | "STATEMENT";
  targetId: string;
  section: ResumeRevisionReviewNote["section"];
  body: string;
  timestamp: string;
}) {
  return {
    noteId: randomUUID(),
    targetType: args.targetType,
    targetId: args.targetId,
    section: args.section,
    body: args.body,
    createdAt: args.timestamp,
    updatedAt: args.timestamp
  } satisfies ResumeRevisionReviewNote;
}
