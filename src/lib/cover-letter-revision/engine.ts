import { randomUUID } from "node:crypto";
import type { CoverLetterCompositionContent } from "@/lib/cover-letter-composition/contract";
import {
  COVER_LETTER_REVISION_CONFIGURATION_VERSION,
  COVER_LETTER_REVISION_CONTRACT_VERSION,
  COVER_LETTER_REVISION_ENGINE_VERSION,
  coverLetterRevisionConfiguration
} from "@/lib/cover-letter-revision/config";
import type {
  CoverLetterRevisionChange,
  CoverLetterRevisionContent,
  CoverLetterRevisionRecord
} from "@/lib/cover-letter-revision/contract";

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`)
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
  return value.trim().length === 0 ? 0 : value.trim().split(/\s+/).length;
}

function buildSummary(args: {
  content: CoverLetterRevisionContent;
  predecessor: CoverLetterRevisionContent | null;
  changeSet: CoverLetterRevisionChange[];
}) {
  const changedFields = Array.from(new Set(args.changeSet.map((change) => change.field)));
  const currentTechnologies = new Set(args.content.paragraphs.flatMap((paragraph) => paragraph.technologies));
  const previousTechnologies = new Set(
    (args.predecessor?.paragraphs ?? []).flatMap((paragraph) => paragraph.technologies)
  );

  let technologyReferenceChanges = 0;
  for (const tech of currentTechnologies) {
    if (!previousTechnologies.has(tech)) {
      technologyReferenceChanges += 1;
    }
  }

  const claimChanges = args.content.paragraphs.filter((paragraph) => paragraph.editedClaimRisk).length;

  return {
    predecessorRevisionId: args.predecessor?.revisionId ?? null,
    revisionStatus: args.content.status,
    wordCount: args.content.summary.wordCount,
    paragraphCount: args.content.summary.paragraphCount,
    wordCountDelta: args.content.summary.wordCount - (args.predecessor?.summary.wordCount ?? 0),
    paragraphCountDelta:
      args.content.summary.paragraphCount - (args.predecessor?.summary.paragraphCount ?? 0),
    technologyReferenceChanges,
    claimChanges,
    changedFields,
    localValidationState: args.content.validationState
  };
}

export async function computeCoverLetterRevisionContentChecksum(content: Omit<
  CoverLetterRevisionContent,
  "inputChecksum" | "contentChecksum"
>) {
  return computeSha256(stableSerialize(content));
}

export async function computeCoverLetterRevisionChecksum(args: {
  coverLetterCompositionVersionId: string;
  predecessorRevisionId: string | null;
  contentChecksum: string;
}) {
  return computeSha256(
    stableSerialize({
      coverLetterCompositionVersionId: args.coverLetterCompositionVersionId,
      predecessorRevisionId: args.predecessorRevisionId,
      contentChecksum: args.contentChecksum,
      coverLetterRevisionContractVersion: COVER_LETTER_REVISION_CONTRACT_VERSION,
      coverLetterRevisionEngineVersion: COVER_LETTER_REVISION_ENGINE_VERSION,
      coverLetterRevisionConfigurationVersion: COVER_LETTER_REVISION_CONFIGURATION_VERSION
    })
  );
}

export async function createCoverLetterRevisionDraftFromComposition(args: {
  composition: CoverLetterCompositionContent;
  predecessor: CoverLetterRevisionContent | null;
  revisionId?: string;
  createdAt?: string;
  status?: "DRAFT" | "FINALIZED";
  userNotes?: string | null;
}) {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const paragraphs = args.composition.paragraphs.map((paragraph, index) => ({
    ...paragraph,
    originalText: paragraph.text,
    currentText: paragraph.text,
    originalOrder: index,
    order: index,
    originalClaims: paragraph.claims,
    editedClaimRisk: false
  }));

  const baseContent: Omit<CoverLetterRevisionContent, "contentChecksum" | "inputChecksum"> = {
    revisionId: args.revisionId ?? randomUUID(),
    workspaceId: args.composition.workspaceId,
    coverLetterCompositionVersionId: args.composition.runId,
    predecessorRevisionId: args.predecessor?.revisionId ?? null,
    applicationId: args.composition.applicationId,
    jobOpportunityId: args.composition.jobOpportunityId,
    jobDescriptionVersionId: args.composition.jobDescriptionVersionId,
    careerProfileVersionId: args.composition.careerProfileVersionId,
    requirementAnalysisId: args.composition.requirementAnalysisId,
    evidenceRetrievalRunId: args.composition.evidenceRetrievalRunId,
    evidenceScoringRunId: args.composition.evidenceScoringRunId,
    matchReportRunId: args.composition.matchReportRunId,
    resumeCompositionVersionId: args.composition.resumeCompositionVersionId,
    resumeRevisionVersionId: args.composition.resumeRevisionVersionId,
    coverLetterRevisionContractVersion: COVER_LETTER_REVISION_CONTRACT_VERSION,
    coverLetterRevisionEngineVersion: COVER_LETTER_REVISION_ENGINE_VERSION,
    coverLetterRevisionConfigurationVersion: COVER_LETTER_REVISION_CONFIGURATION_VERSION,
    createdAt,
    updatedAt: createdAt,
    status: args.status ?? "DRAFT",
    validationState: "VALID",
    candidateName: args.composition.candidateName,
    header: {
      email: args.composition.header.email,
      phone: args.composition.header.phone,
      location: args.composition.header.location,
      date: args.composition.header.date,
      company: args.composition.header.company,
      role: args.composition.header.role
    },
    salutation: args.composition.header.salutation,
    paragraphs,
    closing: args.composition.closing,
    summary: args.composition.summary,
    styleSummary: args.composition.styleSummary,
    lengthSummary: args.composition.lengthSummary,
    overallProvenance: args.composition.provenance,
    diagnostics: args.composition.diagnostics
  };

  const contentChecksum = await computeCoverLetterRevisionContentChecksum(baseContent);
  const inputChecksum = await computeCoverLetterRevisionChecksum({
    coverLetterCompositionVersionId: baseContent.coverLetterCompositionVersionId,
    predecessorRevisionId: baseContent.predecessorRevisionId,
    contentChecksum
  });

  return {
    ...baseContent,
    contentChecksum,
    inputChecksum
  } satisfies CoverLetterRevisionContent;
}

export function projectCoverLetterRevisionPlainText(content: CoverLetterRevisionContent) {
  return [content.salutation, ...content.paragraphs.sort((a, b) => a.order - b.order).map((p) => p.currentText), content.closing]
    .filter(Boolean)
    .join("\n\n");
}

export async function buildCoverLetterRevisionRecord(args: {
  content: CoverLetterRevisionContent;
  predecessor: CoverLetterRevisionContent | null;
  userNotes?: string | null;
}) {
  const sortedParagraphs = [...args.content.paragraphs].sort((left, right) => left.order - right.order);
  const paragraphWordCount = sortedParagraphs.reduce((total, paragraph) => total + countWords(paragraph.currentText), 0);
  const fullWordCount = paragraphWordCount + countWords(args.content.salutation) + countWords(args.content.closing);
  const diagnostics = [...args.content.diagnostics];

  const lengthSummary = {
    ...args.content.lengthSummary,
    actualWords: fullWordCount,
    actualParagraphs: sortedParagraphs.length,
    withinTargetRange:
      fullWordCount <= coverLetterRevisionConfiguration.targetMaxWords &&
      fullWordCount >= coverLetterRevisionConfiguration.warningMinWords &&
      sortedParagraphs.length <= coverLetterRevisionConfiguration.maxParagraphs &&
      sortedParagraphs.length >= coverLetterRevisionConfiguration.minParagraphs
  };

  const summary = {
    ...args.content.summary,
    wordCount: fullWordCount,
    paragraphCount: sortedParagraphs.length
  };

  const nextContent: CoverLetterRevisionContent = {
    ...args.content,
    paragraphs: sortedParagraphs,
    summary,
    lengthSummary,
    validationState:
      fullWordCount > coverLetterRevisionConfiguration.hardMaxWords
        ? "BLOCKED"
        : fullWordCount < coverLetterRevisionConfiguration.warningMinWords
          ? "VALID_WITH_WARNINGS"
          : "VALID"
  };

  const changeSet: CoverLetterRevisionChange[] = [];
  const previousById = new Map((args.predecessor?.paragraphs ?? []).map((paragraph) => [paragraph.id, paragraph]));

  if (args.predecessor && args.predecessor.salutation !== nextContent.salutation) {
    changeSet.push({
      changeId: randomUUID(),
      previousRevisionId: args.predecessor.revisionId,
      field: "salutation",
      paragraphId: null,
      changeType: "SALUTATION_CHANGE",
      originalValue: args.predecessor.salutation,
      revisedValue: nextContent.salutation,
      provenancePreserved: true,
      provenanceImpactWarning: null
    });
  }

  for (const paragraph of nextContent.paragraphs) {
    const previous = previousById.get(paragraph.id) ?? null;
    if (!previous) {
      continue;
    }

    if (previous.currentText !== paragraph.currentText) {
      changeSet.push({
        changeId: randomUUID(),
        previousRevisionId: args.predecessor?.revisionId ?? null,
        field: "paragraphText",
        paragraphId: paragraph.id,
        changeType: "PARAGRAPH_TEXT_CHANGE",
        originalValue: previous.currentText,
        revisedValue: paragraph.currentText,
        provenancePreserved: true,
        provenanceImpactWarning: paragraph.editedClaimRisk
          ? "Edited wording may have changed claim meaning and needs audit review."
          : null
      });
    }

    if (previous.order !== paragraph.order) {
      changeSet.push({
        changeId: randomUUID(),
        previousRevisionId: args.predecessor?.revisionId ?? null,
        field: "paragraphOrder",
        paragraphId: paragraph.id,
        changeType: "PARAGRAPH_REORDER",
        originalValue: String(previous.order),
        revisedValue: String(paragraph.order),
        provenancePreserved: true,
        provenanceImpactWarning: null
      });
    }
  }

  if (args.predecessor && args.predecessor.closing !== nextContent.closing) {
    changeSet.push({
      changeId: randomUUID(),
      previousRevisionId: args.predecessor.revisionId,
      field: "closing",
      paragraphId: null,
      changeType: "CLOSING_CHANGE",
      originalValue: args.predecessor.closing,
      revisedValue: nextContent.closing,
      provenancePreserved: true,
      provenanceImpactWarning: null
    });
  }

  if ((args.userNotes ?? null) !== null) {
    changeSet.push({
      changeId: randomUUID(),
      previousRevisionId: args.predecessor?.revisionId ?? null,
      field: "userNotes",
      paragraphId: null,
      changeType: "USER_NOTE_CHANGE",
      originalValue: args.userNotes ?? null,
      revisedValue: args.userNotes ?? null,
      provenancePreserved: true,
      provenanceImpactWarning: null
    });
  }

  return {
    content: nextContent,
    changeSet,
    summary: buildSummary({
      content: nextContent,
      predecessor: args.predecessor,
      changeSet
    }),
    diagnostics,
    userNotes: args.userNotes ?? null
  } satisfies CoverLetterRevisionRecord;
}
