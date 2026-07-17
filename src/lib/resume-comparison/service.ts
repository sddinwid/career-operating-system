import { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  RESUME_COMPARISON_CONTRACT_VERSION,
  RESUME_COMPARISON_ENGINE_VERSION
} from "@/lib/resume-comparison/config";
import type {
  ResumeComparisonChangeState,
  ResumeComparisonChangeSetReconciliation,
  ResumeComparisonFindingChange,
  ResumeComparisonMode,
  ResumeComparisonResult,
  ResumeComparisonSection
} from "@/lib/resume-comparison/contract";
import { parseStoredResumeAuditRun } from "@/lib/resume-audit/service";
import type { ResumeAuditResult } from "@/lib/resume-audit/contract";
import {
  getResumeCompositionVersionById,
  parseStoredResumeCompositionVersion
} from "@/lib/resume-composition/service";
import type {
  ResumeCompositionContent,
  StatementProvenance
} from "@/lib/resume-composition/contract";
import {
  projectResumeRevisionToCompositionContent
} from "@/lib/resume-revision/engine";
import {
  getResumeRevisionVersionById,
  parseStoredResumeRevisionVersion
} from "@/lib/resume-revision/service";
import type {
  ResumeRevisionChange,
  ResumeRevisionContent,
  ResumeRevisionRecord
} from "@/lib/resume-revision/contract";

type ComparableSourceType = "BASE_COMPOSITION" | "FINALIZED_REVISION";
type SectionType =
  | "HEADER"
  | "PROFESSIONAL_SUMMARY"
  | "CORE_SKILLS"
  | "PROFESSIONAL_EXPERIENCE"
  | "SELECTED_PROJECTS"
  | "EDUCATION"
  | "CERTIFICATIONS";

type ComparableItemType =
  | "HEADER"
  | "SUMMARY_SENTENCE"
  | "SKILL"
  | "ROLE"
  | "ROLE_BULLET"
  | "PROJECT"
  | "PROJECT_BULLET"
  | "EDUCATION"
  | "CERTIFICATION";

type ComparableItem = {
  stableId: string;
  itemType: ComparableItemType;
  section: SectionType;
  statementId: string | null;
  baseStatementId: string | null;
  parentId: string | null;
  text: string | null;
  order: number;
  provenance: StatementProvenance | null;
};

type ComparableSource = {
  sourceType: ComparableSourceType;
  sourceId: string;
  label: string;
  contentChecksum: string;
  workspaceId: string;
  jobDescriptionVersionId: string;
  applicationId: string | null;
  content: ResumeCompositionContent;
  revisionRecord: ResumeRevisionRecord | null;
  audit: {
    runId: string;
    status: string;
    renderingReadiness: ResumeAuditResult["renderingReadiness"];
    inputChecksum: string;
    result: ResumeAuditResult;
  } | null;
};

type ActualDiff = {
  entityType: string;
  entityId: string;
  statementId: string | null;
  field: string;
  message: string;
  changeType: ResumeRevisionChange["changeType"];
};

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

function normalizeText(value: string | null) {
  return (value ?? "").replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

function tokenizeText(value: string | null) {
  const normalized = normalizeText(value);
  return normalized.length === 0 ? [] : normalized.split(" ");
}

function diffTokens(left: string | null, right: string | null) {
  const leftTokens = tokenizeText(left);
  const rightTokens = tokenizeText(right);
  const dp = Array.from({ length: leftTokens.length + 1 }, () =>
    Array.from<number>({ length: rightTokens.length + 1 }).fill(0)
  );

  for (let leftIndex = leftTokens.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightTokens.length - 1; rightIndex >= 0; rightIndex -= 1) {
      dp[leftIndex]![rightIndex] =
        leftTokens[leftIndex] === rightTokens[rightIndex]
          ? 1 + dp[leftIndex + 1]![rightIndex + 1]!
          : Math.max(dp[leftIndex + 1]![rightIndex]!, dp[leftIndex]![rightIndex + 1]!);
    }
  }

  const leftResult: Array<{ value: string; state: "UNCHANGED" | "REMOVED" }> = [];
  const rightResult: Array<{ value: string; state: "UNCHANGED" | "ADDED" }> = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftTokens.length && rightIndex < rightTokens.length) {
    if (leftTokens[leftIndex] === rightTokens[rightIndex]) {
      leftResult.push({ value: leftTokens[leftIndex]!, state: "UNCHANGED" });
      rightResult.push({ value: rightTokens[rightIndex]!, state: "UNCHANGED" });
      leftIndex += 1;
      rightIndex += 1;
    } else if (dp[leftIndex + 1]![rightIndex]! >= dp[leftIndex]![rightIndex + 1]!) {
      leftResult.push({ value: leftTokens[leftIndex]!, state: "REMOVED" });
      leftIndex += 1;
    } else {
      rightResult.push({ value: rightTokens[rightIndex]!, state: "ADDED" });
      rightIndex += 1;
    }
  }

  while (leftIndex < leftTokens.length) {
    leftResult.push({ value: leftTokens[leftIndex]!, state: "REMOVED" });
    leftIndex += 1;
  }

  while (rightIndex < rightTokens.length) {
    rightResult.push({ value: rightTokens[rightIndex]!, state: "ADDED" });
    rightIndex += 1;
  }

  return {
    leftTokens: leftResult,
    rightTokens: rightResult
  };
}

function buildSkillText(args: { displayValue: string; qualificationText: string | null }) {
  return args.qualificationText ? `${args.displayValue} (${args.qualificationText})` : args.displayValue;
}

function buildComparableItems(content: ResumeCompositionContent): ComparableItem[] {
  const items: ComparableItem[] = [];

  content.header
    .filter((item) => item.included && item.value)
    .forEach((item, index) => {
      items.push({
        stableId: `header:${item.field}`,
        itemType: "HEADER",
        section: "HEADER",
        statementId: item.provenance?.statementId ?? null,
        baseStatementId: item.provenance?.statementId ?? null,
        parentId: null,
        text: item.value,
        order: index,
        provenance: item.provenance
      });
    });

  content.professionalSummary.sentences.forEach((sentence, index) => {
    items.push({
      stableId: `summary:${sentence.statementId}`,
      itemType: "SUMMARY_SENTENCE",
      section: "PROFESSIONAL_SUMMARY",
      statementId: sentence.statementId,
      baseStatementId: sentence.statementId,
      parentId: null,
      text: sentence.text,
      order: index,
      provenance: sentence.provenance
    });
  });

  content.skillsGroups
    .flatMap((group) =>
      group.skills.map((skill) => ({
        skill,
        order: group.order * 100 + group.skills.findIndex((item) => item.canonicalValue === skill.canonicalValue)
      }))
    )
    .forEach(({ skill, order }) => {
      items.push({
        stableId: `skill:${skill.canonicalValue}`,
        itemType: "SKILL",
        section: "CORE_SKILLS",
        statementId: null,
        baseStatementId: null,
        parentId: null,
        text: buildSkillText(skill),
        order,
        provenance: skill.provenance
      });
    });

  content.professionalExperience.forEach((role, roleIndex) => {
    items.push({
      stableId: `role:${role.roleId}`,
      itemType: "ROLE",
      section: "PROFESSIONAL_EXPERIENCE",
      statementId: role.provenance.statementId,
      baseStatementId: role.provenance.statementId,
      parentId: null,
      text: [role.roleTitle, role.employer].filter(Boolean).join(" at "),
      order: roleIndex,
      provenance: role.provenance
    });

    role.bullets.forEach((bullet, bulletIndex) => {
      items.push({
        stableId: `role-bullet:${bullet.statementId}`,
        itemType: "ROLE_BULLET",
        section: "PROFESSIONAL_EXPERIENCE",
        statementId: bullet.statementId,
        baseStatementId: bullet.statementId,
        parentId: role.roleId,
        text: bullet.text,
        order: roleIndex * 100 + bulletIndex,
        provenance: bullet.provenance
      });
    });
  });

  content.selectedProjects.forEach((project, projectIndex) => {
    items.push({
      stableId: `project:${project.projectId}`,
      itemType: "PROJECT",
      section: "SELECTED_PROJECTS",
      statementId: project.provenance.statementId,
      baseStatementId: project.provenance.statementId,
      parentId: null,
      text: project.projectName,
      order: projectIndex,
      provenance: project.provenance
    });

    project.bullets.forEach((bullet, bulletIndex) => {
      items.push({
        stableId: `project-bullet:${bullet.statementId}`,
        itemType: "PROJECT_BULLET",
        section: "SELECTED_PROJECTS",
        statementId: bullet.statementId,
        baseStatementId: bullet.statementId,
        parentId: project.projectId,
        text: bullet.text,
        order: projectIndex * 100 + bulletIndex,
        provenance: bullet.provenance
      });
    });
  });

  content.education.forEach((education, index) => {
    items.push({
      stableId: `education:${education.educationId}`,
      itemType: "EDUCATION",
      section: "EDUCATION",
      statementId: education.provenance.statementId,
      baseStatementId: education.provenance.statementId,
      parentId: null,
      text: [education.degree, education.field, education.institution].filter(Boolean).join(" - "),
      order: index,
      provenance: education.provenance
    });
  });

  content.certifications.forEach((certification, index) => {
    items.push({
      stableId: `certification:${certification.certificationId}`,
      itemType: "CERTIFICATION",
      section: "CERTIFICATIONS",
      statementId: certification.provenance.statementId,
      baseStatementId: certification.provenance.statementId,
      parentId: null,
      text: certification.name,
      order: index,
      provenance: certification.provenance
    });
  });

  return items;
}

function getSectionOrder(content: ResumeCompositionContent, section: SectionType) {
  const index = content.finalSectionOrder.findIndex((item) => item === section);
  return index === -1 ? null : index;
}

function getItemsForSection(items: ComparableItem[], section: SectionType) {
  return items.filter((item) => item.section === section).sort((left, right) => left.order - right.order);
}

async function getLatestAuditForSource(
  workspaceId: string,
  sourceType: ComparableSourceType,
  sourceId: string,
  prismaClient: PrismaClient = prisma
) {
  const auditRun = await prismaClient.resumeAuditRun.findFirst({
    where:
      sourceType === "BASE_COMPOSITION"
        ? {
            workspaceId,
            resumeCompositionVersionId: sourceId,
            resumeRevisionVersionId: null
          }
        : {
            workspaceId,
            resumeRevisionVersionId: sourceId
          },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
  });

  if (!auditRun) {
    return null;
  }

  const parsed = await parseStoredResumeAuditRun(workspaceId, auditRun.id, prismaClient);
  return {
    runId: parsed.run.id,
    status: parsed.run.status,
    renderingReadiness: parsed.result.renderingReadiness,
    inputChecksum: parsed.run.resumeCompositionInputChecksum,
    result: parsed.result
  };
}

export async function resolveResumeComparisonSource(
  workspaceId: string,
  sourceType: ComparableSourceType,
  sourceId: string,
  prismaClient: PrismaClient = prisma
): Promise<ComparableSource> {
  if (sourceType === "BASE_COMPOSITION") {
    const version = await getResumeCompositionVersionById(workspaceId, sourceId, prismaClient);
    if (!version) {
      throw new Error("Base resume composition not found.");
    }

    const parsed = await parseStoredResumeCompositionVersion(workspaceId, sourceId, prismaClient);
    return {
      sourceType,
      sourceId,
      label: "Base composition",
      contentChecksum: version.inputChecksum,
      workspaceId,
      jobDescriptionVersionId: version.jobDescriptionVersionId,
      applicationId: version.applicationId,
      content: parsed.content,
      revisionRecord: null,
      audit: await getLatestAuditForSource(workspaceId, sourceType, sourceId, prismaClient)
    };
  }

  const revision = await getResumeRevisionVersionById(workspaceId, sourceId, prismaClient);
  if (!revision) {
    throw new Error("Finalized resume revision not found.");
  }

  if (!["READY_FOR_AUDIT", "AUDITED", "NEEDS_REVIEW"].includes(revision.status)) {
    throw new Error("Only finalized resume revisions can be compared.");
  }

  const parsed = await parseStoredResumeRevisionVersion(workspaceId, sourceId, prismaClient);
  return {
    sourceType,
    sourceId,
    label: "Finalized revision",
    contentChecksum: revision.inputChecksum,
    workspaceId,
    jobDescriptionVersionId: revision.jobDescriptionVersionId,
    applicationId: revision.applicationId,
    content: projectResumeRevisionToCompositionContent({
      content: parsed.record.content as ResumeRevisionContent
    }),
    revisionRecord: parsed.record,
    audit: await getLatestAuditForSource(workspaceId, sourceType, sourceId, prismaClient)
  };
}

function collectProvenanceChanges(left: ComparableItem | undefined, right: ComparableItem | undefined) {
  const leftProvenance = left?.provenance ?? null;
  const rightProvenance = right?.provenance ?? null;
  return {
    preserved: stableSerialize(leftProvenance) === stableSerialize(rightProvenance),
    sourceEvidenceChanged:
      stableSerialize(leftProvenance?.sourceEvidenceIds ?? []) !==
      stableSerialize(rightProvenance?.sourceEvidenceIds ?? []),
    requirementReferenceChanged:
      stableSerialize(leftProvenance?.requirementIds ?? []) !==
      stableSerialize(rightProvenance?.requirementIds ?? []),
    metricReferenceChanged:
      stableSerialize(leftProvenance?.metricReferences ?? []) !==
      stableSerialize(rightProvenance?.metricReferences ?? []),
    truthfulnessClassificationChanged:
      leftProvenance?.truthfulnessClassification !== rightProvenance?.truthfulnessClassification,
    restrictionsChanged:
      stableSerialize(leftProvenance?.restrictions ?? []) !==
      stableSerialize(rightProvenance?.restrictions ?? [])
  };
}

function findAssociatedChangeIds(
  record: ResumeRevisionRecord | null,
  item: ComparableItem | undefined
) {
  if (!record || !item) {
    return [];
  }

  return record.changeSet
    .filter((change) => {
      if (item.statementId && change.statementId === item.statementId) {
        return true;
      }

      return change.entityId === item.parentId || change.entityId === item.stableId.replace(/^[^:]+:/, "");
    })
    .map((change) => change.changeId);
}

function compareSection(
  sectionType: SectionType,
  leftSource: ComparableSource,
  rightSource: ComparableSource,
  findingChanges: ResumeComparisonFindingChange[]
): ResumeComparisonSection {
  const leftItems = getItemsForSection(buildComparableItems(leftSource.content), sectionType);
  const rightItems = getItemsForSection(buildComparableItems(rightSource.content), sectionType);
  const allStableIds = Array.from(
    new Set([...leftItems.map((item) => item.stableId), ...rightItems.map((item) => item.stableId)])
  );

  const statements = allStableIds.map((stableId) => {
    const left = leftItems.find((item) => item.stableId === stableId);
    const right = rightItems.find((item) => item.stableId === stableId);
    const normalizedEqual = normalizeText(left?.text ?? null) === normalizeText(right?.text ?? null);
    const provenance = collectProvenanceChanges(left, right);
    const orderChanged = left?.order !== right?.order && left && right;
    const changeState: ResumeComparisonChangeState =
      left && right
        ? orderChanged && normalizedEqual
          ? "REORDERED"
          : normalizedEqual
            ? "UNCHANGED"
            : "MODIFIED"
        : left
          ? "REMOVED"
          : "ADDED";

    const auditFindingChanges = findingChanges
      .filter((finding) => finding.statementId && finding.statementId === (right?.statementId ?? left?.statementId ?? null))
      .map((finding) => finding.comparisonState);

    return {
      stableId,
      itemType: (right?.itemType ?? left?.itemType)!,
      statementId: right?.statementId ?? left?.statementId ?? null,
      baseStatementId: right?.baseStatementId ?? left?.baseStatementId ?? null,
      section: sectionType,
      parentId: right?.parentId ?? left?.parentId ?? null,
      leftText: left?.text ?? null,
      rightText: right?.text ?? null,
      changeState,
      normalizedEqual,
      provenancePreserved: provenance.preserved,
      sourceEvidenceChanged: provenance.sourceEvidenceChanged,
      requirementReferenceChanged: provenance.requirementReferenceChanged,
      metricReferenceChanged: provenance.metricReferenceChanged,
      truthfulnessClassificationChanged: provenance.truthfulnessClassificationChanged,
      restrictionsChanged: provenance.restrictionsChanged,
      associatedChangeIds: findAssociatedChangeIds(rightSource.revisionRecord, right),
      auditFindingChanges,
      textDiff: diffTokens(left?.text ?? null, right?.text ?? null)
    };
  });

  const leftPresent = leftItems.length > 0;
  const rightPresent = rightItems.length > 0;
  const leftOrder = getSectionOrder(leftSource.content, sectionType);
  const rightOrder = getSectionOrder(rightSource.content, sectionType);
  const orderChanged = leftOrder !== rightOrder;
  const contentChanges = statements.filter((statement) => statement.changeState === "MODIFIED").length;
  const itemAdditions = statements.filter((statement) => statement.changeState === "ADDED").length;
  const itemRemovals = statements.filter((statement) => statement.changeState === "REMOVED").length;
  const itemReorderings = statements.filter((statement) => statement.changeState === "REORDERED").length;
  const changedFindings = findingChanges.filter((finding) => finding.section === sectionType || finding.statementId !== null);

  const changeState =
    !leftPresent && rightPresent
      ? "ADDED"
      : leftPresent && !rightPresent
        ? "REMOVED"
        : contentChanges > 0
          ? "MODIFIED"
          : orderChanged || itemReorderings > 0
            ? "REORDERED"
            : itemAdditions > 0 || itemRemovals > 0
              ? "MODIFIED"
              : "UNCHANGED";

  return {
    sectionType,
    leftPresent,
    rightPresent,
    changeState,
    leftOrder,
    rightOrder,
    orderChanged,
    contentChanges,
    itemAdditions,
    itemRemovals,
    itemReorderings,
    auditImpactSummary: {
      resolved: changedFindings.filter((finding) => finding.comparisonState === "RESOLVED").length,
      remaining: changedFindings.filter((finding) => finding.comparisonState === "REMAINING").length,
      introduced: changedFindings.filter((finding) => finding.comparisonState === "NEW").length,
      changed: changedFindings.filter((finding) => finding.comparisonState === "CHANGED").length
    },
    statements
  };
}

function buildFindingKey(finding: ResumeAuditResult["findings"][number]) {
  return [
    finding.ruleId,
    finding.statementId ?? "",
    finding.section ?? "",
    finding.category,
    finding.actualValue ?? "",
    finding.expectedCondition ?? ""
  ].join("|");
}

function buildFindingBaseKey(finding: ResumeAuditResult["findings"][number]) {
  return [finding.ruleId, finding.statementId ?? "", finding.section ?? "", finding.category].join("|");
}

function compareAuditFindings(leftAudit: ComparableSource["audit"], rightAudit: ComparableSource["audit"]) {
  if (!leftAudit || !rightAudit) {
    return [] satisfies ResumeComparisonFindingChange[];
  }

  const rightByBaseKey = new Map<string, ResumeAuditResult["findings"][number][]>();
  for (const finding of rightAudit.result.findings) {
    const key = buildFindingBaseKey(finding);
    const current = rightByBaseKey.get(key) ?? [];
    current.push(finding);
    rightByBaseKey.set(key, current);
  }

  const matchedRightKeys = new Set<string>();
  const changes: ResumeComparisonFindingChange[] = [];

  for (const leftFinding of leftAudit.result.findings) {
    const exactKey = buildFindingKey(leftFinding);
    const baseKey = buildFindingBaseKey(leftFinding);
    const candidates = rightByBaseKey.get(baseKey) ?? [];
    const exactMatch = candidates.find((candidate) => buildFindingKey(candidate) === exactKey);

    if (exactMatch) {
      matchedRightKeys.add(buildFindingKey(exactMatch));
      changes.push({
        comparisonState:
          leftFinding.severity === exactMatch.severity &&
          leftFinding.message === exactMatch.message &&
          leftFinding.renderingImpact === exactMatch.renderingImpact
            ? "REMAINING"
            : "CHANGED",
        comparisonKey: baseKey,
        ruleId: leftFinding.ruleId,
        statementId: leftFinding.statementId,
        section: leftFinding.section,
        category: leftFinding.category,
        leftSeverity: leftFinding.severity,
        rightSeverity: exactMatch.severity,
        leftBlocksRendering: leftFinding.blocksRendering,
        rightBlocksRendering: exactMatch.blocksRendering,
        leftMessage: leftFinding.message,
        rightMessage: exactMatch.message,
        leftActualValue: leftFinding.actualValue,
        rightActualValue: exactMatch.actualValue
      });
      continue;
    }

    const changedCandidate = candidates[0];
    if (changedCandidate) {
      matchedRightKeys.add(buildFindingKey(changedCandidate));
      changes.push({
        comparisonState: "CHANGED",
        comparisonKey: baseKey,
        ruleId: leftFinding.ruleId,
        statementId: leftFinding.statementId,
        section: leftFinding.section,
        category: leftFinding.category,
        leftSeverity: leftFinding.severity,
        rightSeverity: changedCandidate.severity,
        leftBlocksRendering: leftFinding.blocksRendering,
        rightBlocksRendering: changedCandidate.blocksRendering,
        leftMessage: leftFinding.message,
        rightMessage: changedCandidate.message,
        leftActualValue: leftFinding.actualValue,
        rightActualValue: changedCandidate.actualValue
      });
    } else {
      changes.push({
        comparisonState: "RESOLVED",
        comparisonKey: baseKey,
        ruleId: leftFinding.ruleId,
        statementId: leftFinding.statementId,
        section: leftFinding.section,
        category: leftFinding.category,
        leftSeverity: leftFinding.severity,
        rightSeverity: null,
        leftBlocksRendering: leftFinding.blocksRendering,
        rightBlocksRendering: false,
        leftMessage: leftFinding.message,
        rightMessage: null,
        leftActualValue: leftFinding.actualValue,
        rightActualValue: null
      });
    }
  }

  for (const rightFinding of rightAudit.result.findings) {
    const rightKey = buildFindingKey(rightFinding);
    if (matchedRightKeys.has(rightKey)) {
      continue;
    }

    changes.push({
      comparisonState: "NEW",
      comparisonKey: buildFindingBaseKey(rightFinding),
      ruleId: rightFinding.ruleId,
      statementId: rightFinding.statementId,
      section: rightFinding.section,
      category: rightFinding.category,
      leftSeverity: null,
      rightSeverity: rightFinding.severity,
      leftBlocksRendering: false,
      rightBlocksRendering: rightFinding.blocksRendering,
      leftMessage: null,
      rightMessage: rightFinding.message,
      leftActualValue: null,
      rightActualValue: rightFinding.actualValue
    });
  }

  return changes;
}

function buildActualDiffs(leftSource: ComparableSource, rightSource: ComparableSource) {
  const diffs: ActualDiff[] = [];
  const sections: SectionType[] = [
    "HEADER",
    "PROFESSIONAL_SUMMARY",
    "CORE_SKILLS",
    "PROFESSIONAL_EXPERIENCE",
    "SELECTED_PROJECTS",
    "EDUCATION",
    "CERTIFICATIONS"
  ];

  const leftItems = buildComparableItems(leftSource.content);
  const rightItems = buildComparableItems(rightSource.content);

  for (const section of sections) {
    const leftSectionItems = getItemsForSection(leftItems, section);
    const rightSectionItems = getItemsForSection(rightItems, section);
    const allIds = Array.from(
      new Set([
        ...leftSectionItems.map((item) => item.stableId),
        ...rightSectionItems.map((item) => item.stableId)
      ])
    );

    for (const stableId of allIds) {
      const left = leftSectionItems.find((item) => item.stableId === stableId);
      const right = rightSectionItems.find((item) => item.stableId === stableId);

      if (left && right) {
        if (normalizeText(left.text) !== normalizeText(right.text)) {
          diffs.push({
            entityType: right.itemType,
            entityId: right.parentId ?? right.stableId.replace(/^[^:]+:/, ""),
            statementId: right.statementId,
            field: "text",
            message: `${right.itemType} text changed.`,
            changeType: "TEXT_EDIT"
          });
        }

        if (left.order !== right.order) {
          diffs.push({
            entityType: right.itemType,
            entityId: right.parentId ?? right.stableId.replace(/^[^:]+:/, ""),
            statementId: right.statementId,
            field: "order",
            message: `${right.itemType} ordering changed.`,
            changeType: "REORDER"
          });
        }
      } else if (!left && right) {
        diffs.push({
          entityType: right.itemType,
          entityId: right.parentId ?? right.stableId.replace(/^[^:]+:/, ""),
          statementId: right.statementId,
          field: "included",
          message: `${right.itemType} was added or restored.`,
          changeType: "INCLUDE"
        });
      } else if (left && !right) {
        diffs.push({
          entityType: left.itemType,
          entityId: left.parentId ?? left.stableId.replace(/^[^:]+:/, ""),
          statementId: left.statementId,
          field: "included",
          message: `${left.itemType} was removed or excluded.`,
          changeType: "EXCLUDE"
        });
      }
    }
  }

  if (
    rightSource.revisionRecord &&
    leftSource.content.finalSectionOrder.join("|") !== rightSource.content.finalSectionOrder.join("|")
  ) {
    diffs.push({
      entityType: "REVISION",
      entityId: rightSource.sourceId,
      statementId: null,
      field: "sectionOrder",
      message: "Section order changed.",
      changeType: "SECTION_PROFILE_CHANGE"
    });
  }

  return diffs;
}

function buildChangeSetReconciliation(
  leftSource: ComparableSource,
  rightSource: ComparableSource
) {
  if (!rightSource.revisionRecord) {
    return [] satisfies ResumeComparisonChangeSetReconciliation[];
  }

  const actualDiffs = buildActualDiffs(leftSource, rightSource);
  const reconciliations: ResumeComparisonChangeSetReconciliation[] = [];
  const matchedDiffIndexes = new Set<number>();

  for (const change of rightSource.revisionRecord.changeSet) {
    const diffIndex = actualDiffs.findIndex((diff, index) => {
      if (matchedDiffIndexes.has(index)) {
        return false;
      }

      return (
        diff.field === change.field &&
        diff.statementId === change.statementId &&
        diff.changeType === change.changeType &&
        (diff.entityId === change.entityId || diff.entityType === change.entityType)
      );
    });

    if (diffIndex >= 0) {
      matchedDiffIndexes.add(diffIndex);
      reconciliations.push({
        recordedChangeId: change.changeId,
        state:
          change.changeType === "REORDER" ? "REORDER_MATCHED" : "RECORDED_AND_REFLECTED",
        blocking: false,
        entityType: change.entityType,
        entityId: change.entityId,
        statementId: change.statementId,
        field: change.field,
        message: "Recorded change matches the compared content."
      });
      continue;
    }

    const entityStillExists = Boolean(
      findAssociatedChangeIds(rightSource.revisionRecord, {
        stableId: change.entityId,
        itemType: "ROLE",
        section: "PROFESSIONAL_EXPERIENCE",
        statementId: change.statementId,
        baseStatementId: change.statementId,
        parentId: change.entityId,
        text: null,
        order: 0,
        provenance: null
      }).length || change.changeType === "NOTE"
    );

    reconciliations.push({
      recordedChangeId: change.changeId,
      state:
        change.changeType === "RESTORE"
          ? "RESTORED_TO_BASE"
          : entityStillExists
            ? "RECORDED_BUT_NOT_REFLECTED"
            : "MISSING_CHANGE_REFERENCE",
      blocking: !entityStillExists && change.changeType !== "NOTE",
      entityType: change.entityType,
      entityId: change.entityId,
      statementId: change.statementId,
      field: change.field,
      message:
        !entityStillExists && change.changeType !== "NOTE"
          ? "Recorded change references content that no longer exists."
          : "Recorded change no longer affects the compared content."
    });
  }

  actualDiffs.forEach((diff, index) => {
    if (matchedDiffIndexes.has(index)) {
      return;
    }

    reconciliations.push({
      recordedChangeId: null,
      state: "UNRECORDED_CONTENT_CHANGE",
      blocking: true,
      entityType: diff.entityType,
      entityId: diff.entityId,
      statementId: diff.statementId,
      field: diff.field,
      message: diff.message
    });
  });

  return reconciliations;
}

export async function compareResumeSources(
  workspaceId: string,
  args: {
    comparisonMode: ResumeComparisonMode;
    leftSourceType: ComparableSourceType;
    leftSourceId: string;
    rightSourceType: ComparableSourceType;
    rightSourceId: string;
    jobDescriptionVersionId: string;
  },
  prismaClient: PrismaClient = prisma
): Promise<ResumeComparisonResult> {
  const leftSource = await resolveResumeComparisonSource(
    workspaceId,
    args.leftSourceType,
    args.leftSourceId,
    prismaClient
  );
  const rightSource = await resolveResumeComparisonSource(
    workspaceId,
    args.rightSourceType,
    args.rightSourceId,
    prismaClient
  );

  const findingChanges = compareAuditFindings(leftSource.audit, rightSource.audit);
  const sections: SectionType[] = [
    "HEADER",
    "PROFESSIONAL_SUMMARY",
    "CORE_SKILLS",
    "PROFESSIONAL_EXPERIENCE",
    "SELECTED_PROJECTS",
    "EDUCATION",
    "CERTIFICATIONS"
  ];
  const sectionComparisons = sections.map((section) =>
    compareSection(section, leftSource, rightSource, findingChanges)
  );
  const changeSetReconciliation = buildChangeSetReconciliation(leftSource, rightSource);

  const diagnostics = [
    ...changeSetReconciliation
      .filter((item) => item.blocking)
      .map((item) => ({
        code: item.state === "UNRECORDED_CONTENT_CHANGE" ? "comparison.unrecorded-change" : "comparison.missing-change-reference",
        severity: "ERROR" as const,
        message: item.message,
        blocking: true
      })),
    ...(leftSource.audit && rightSource.audit && leftSource.audit.renderingReadiness !== rightSource.audit.renderingReadiness
      ? [
          {
            code: "comparison.rendering-readiness-changed",
            severity:
              rightSource.audit.renderingReadiness === "BLOCKED" ||
              rightSource.audit.renderingReadiness === "NEEDS_REVIEW"
                ? ("WARNING" as const)
                : ("INFORMATION" as const),
            message: `Rendering readiness changed from ${leftSource.audit.renderingReadiness} to ${rightSource.audit.renderingReadiness}.`,
            blocking: false
          }
        ]
      : [])
  ];

  const statements = sectionComparisons.flatMap((section) => section.statements);
  const summary = {
    sectionsChanged: sectionComparisons.filter((section) => section.changeState !== "UNCHANGED").length,
    statementsChanged: statements.filter((statement) => statement.changeState === "MODIFIED").length,
    statementsAdded: statements.filter((statement) => statement.changeState === "ADDED").length,
    statementsRemoved: statements.filter((statement) => statement.changeState === "REMOVED").length,
    skillsAdded: statements.filter(
      (statement) => statement.itemType === "SKILL" && statement.changeState === "ADDED"
    ).length,
    skillsRemoved: statements.filter(
      (statement) => statement.itemType === "SKILL" && statement.changeState === "REMOVED"
    ).length,
    skillsReordered: statements.filter(
      (statement) => statement.itemType === "SKILL" && statement.changeState === "REORDERED"
    ).length,
    rolesChanged: statements.filter((statement) => statement.itemType === "ROLE" && statement.changeState !== "UNCHANGED").length,
    projectsChanged: statements.filter((statement) => statement.itemType === "PROJECT" && statement.changeState !== "UNCHANGED").length,
    bulletsChanged: statements.filter(
      (statement) =>
        (statement.itemType === "ROLE_BULLET" || statement.itemType === "PROJECT_BULLET") &&
        statement.changeState !== "UNCHANGED"
    ).length,
    notesAdded:
      (rightSource.revisionRecord?.reviewNotes.length ?? 0) - (leftSource.revisionRecord?.reviewNotes.length ?? 0),
    provenanceChanges: statements.filter((statement) => !statement.provenancePreserved).length,
    resolvedBlockingFindings: findingChanges.filter(
      (finding) => finding.comparisonState === "RESOLVED" && finding.leftBlocksRendering
    ).length,
    remainingBlockingFindings: findingChanges.filter(
      (finding) => finding.comparisonState === "REMAINING" && finding.rightBlocksRendering
    ).length,
    newBlockingFindings: findingChanges.filter(
      (finding) => finding.comparisonState === "NEW" && finding.rightBlocksRendering
    ).length,
    warningChanges: findingChanges.filter(
      (finding) =>
        finding.leftSeverity === "WARNING" ||
        finding.rightSeverity === "WARNING"
    ).length,
    pageEstimateChange:
      Number((rightSource.content.summary.estimatedPageCount - leftSource.content.summary.estimatedPageCount).toFixed(2)),
    renderingReadinessChanged:
      (leftSource.audit?.renderingReadiness ?? null) !== (rightSource.audit?.renderingReadiness ?? null),
    eligibleForApproval:
      !diagnostics.some((item) => item.blocking) &&
      rightSource.audit !== null &&
      ["READY_FOR_RENDERING", "READY_WITH_WARNINGS"].includes(rightSource.audit.renderingReadiness)
  };

  return {
    comparisonMode: args.comparisonMode,
    workspaceId,
    jobDescriptionVersionId: args.jobDescriptionVersionId,
    applicationId: rightSource.applicationId ?? leftSource.applicationId,
    contractVersion: RESUME_COMPARISON_CONTRACT_VERSION,
    engineVersion: RESUME_COMPARISON_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    left: {
      sourceType: leftSource.sourceType,
      sourceId: leftSource.sourceId,
      contentChecksum: leftSource.contentChecksum,
      auditId: leftSource.audit?.runId ?? null,
      auditStatus: leftSource.audit?.status ?? null,
      renderingReadiness: leftSource.audit?.renderingReadiness ?? null,
      label: leftSource.label
    },
    right: {
      sourceType: rightSource.sourceType,
      sourceId: rightSource.sourceId,
      contentChecksum: rightSource.contentChecksum,
      auditId: rightSource.audit?.runId ?? null,
      auditStatus: rightSource.audit?.status ?? null,
      renderingReadiness: rightSource.audit?.renderingReadiness ?? null,
      label: rightSource.label
    },
    summary,
    sections: sectionComparisons,
    findingChanges,
    changeSetReconciliation,
    diagnostics
  };
}
