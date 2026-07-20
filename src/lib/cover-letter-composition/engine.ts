import {
  COVER_LETTER_COMPOSITION_CONFIGURATION_VERSION,
  COVER_LETTER_COMPOSITION_CONTRACT_VERSION,
  COVER_LETTER_COMPOSITION_ENGINE_VERSION,
  coverLetterCompositionConfiguration
} from "@/lib/cover-letter-composition/config";
import {
  coverLetterCompositionContentSchema,
  coverLetterCompositionInputSchema,
  type CoverLetterCompositionInput,
  type CoverLetterParagraph
} from "@/lib/cover-letter-composition/contract";
import type { EvidenceDiagnostic } from "@/lib/evidence-retrieval/contract";

type EvidenceRecord = CoverLetterCompositionInput["scoringResult"]["requirementScores"][number]["rankedCandidates"][number];
type StrengthRecord = CoverLetterCompositionInput["matchReportResult"]["strengths"][number];
type ThemeRecord = CoverLetterCompositionInput["matchReportResult"]["resumeGuidance"]["priorityEvidenceThemes"][number];

function cleanText(text: string) {
  return text.replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " ").trim();
}

function ensureSentence(text: string) {
  const cleaned = cleanText(text);
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function joinList(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function toPlainText(paragraphs: CoverLetterParagraph[], closing: string) {
  return `${paragraphs.map((paragraph) => paragraph.text).join("\n\n")}\n\n${closing}`;
}

function buildResumeTokenSet(text: string | null) {
  if (!text) {
    return new Set<string>();
  }
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((token) => token.length >= 5)
  );
}

function computeOverlapRatio(letterText: string, resumeText: string | null) {
  const resumeTokens = buildResumeTokenSet(resumeText);
  if (resumeTokens.size === 0) {
    return 0;
  }
  const letterTokens = unique(
    letterText
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((token) => token.length >= 5)
  );
  if (letterTokens.length === 0) {
    return 0;
  }
  const overlaps = letterTokens.filter((token) => resumeTokens.has(token)).length;
  return overlaps / letterTokens.length;
}

function pushDiagnostic(diagnostics: EvidenceDiagnostic[], diagnostic: EvidenceDiagnostic) {
  diagnostics.push(diagnostic);
}

function selectTopEvidence(input: CoverLetterCompositionInput) {
  const candidateMap = new Map<string, EvidenceRecord>();
  for (const requirement of input.scoringResult.requirementScores) {
    for (const candidate of requirement.rankedCandidates) {
      if (!candidate.visibleForDiagnostics || candidate.finalScore === null) {
        continue;
      }
      const existing = candidateMap.get(candidate.candidateId);
      if (!existing || (candidate.finalScore ?? -1) > (existing.finalScore ?? -1)) {
        candidateMap.set(candidate.candidateId, candidate);
      }
    }
  }

  const selected = [...candidateMap.values()]
    .sort((left, right) => {
      const professionalLeft = left.context === "PROFESSIONAL" ? 1 : 0;
      const professionalRight = right.context === "PROFESSIONAL" ? 1 : 0;
      if (professionalLeft !== professionalRight) {
        return professionalRight - professionalLeft;
      }
      return (right.finalScore ?? 0) - (left.finalScore ?? 0);
    })
    .slice(0, coverLetterCompositionConfiguration.evidence.maxPrimaryThemes);

  return selected;
}

function buildOpening(args: {
  input: CoverLetterCompositionInput;
  diagnostics: EvidenceDiagnostic[];
}): CoverLetterParagraph {
  const { input } = args;
  const theme = input.matchReportResult.resumeGuidance.priorityEvidenceThemes[0];
  const positioning =
    input.careerProfileContent.candidate.targetRolePositioning.default ??
    input.careerProfileContent.candidate.targetRoles[0] ??
    "software engineer";
  const focus = theme?.label
    ? `because it emphasizes ${theme.label.toLowerCase()} and direct engineering ownership`
    : "because it lines up with the kind of backend and product work I do best";
  const text = ensureSentence(
    `I'm interested in the ${input.targetRole} role at ${input.targetCompany} ${focus}. My background fits best when a team needs a ${positioning.toLowerCase()} who can contribute quickly with practical delivery and clear technical judgment`
  );

  return {
    id: "opening",
    type: "OPENING" as const,
    purpose: "Introduce the role, company, and direct positioning without generic filler.",
    text,
    wordCount: countWords(text),
    supportingEvidenceIds: theme?.supportingEvidenceIds ?? [],
    supportingRequirementIds: theme?.supportingRequirementIds ?? [],
    supportingMatchReportConclusionIds: theme ? [theme.themeId] : [],
    sourceCareerRecordIds: [input.careerProfileContent.candidate.id],
    sourceResumeSectionIds: [],
    acknowledgements: [],
    claims: [
      {
        id: "claim-opening-positioning",
        type: "MOTIVATION" as const,
        text: `Interest in ${input.targetRole} at ${input.targetCompany}.`,
        qualified: false,
        evidenceContext: "OTHER" as const,
        restrictions: []
      }
    ],
    technologies: [],
    companyReferences: [input.targetCompany],
    roleReferences: [input.targetRole],
    diagnostics: []
  };
}

function buildAlignmentParagraph(args: {
  input: CoverLetterCompositionInput;
  selectedEvidence: EvidenceRecord[];
}): CoverLetterParagraph {
  const { input, selectedEvidence } = args;
  const strengths = input.matchReportResult.strengths.slice(0, 2);
  const theme = input.matchReportResult.resumeGuidance.priorityEvidenceThemes[0];
  const technologies = unique(
    selectedEvidence.flatMap((candidate) => candidate.matchedTechnologies)
  ).slice(0, coverLetterCompositionConfiguration.evidence.maxNamedTechnologies);
  const strengthPhrase =
    strengths.length > 0
      ? joinList(strengths.map((strength) => strength.strengthCategory.toLowerCase()))
      : "backend product work";
  const alignmentEvidenceContext: "PROFESSIONAL" | "MIXED" = selectedEvidence.some(
    (candidate) => candidate.context === "PROFESSIONAL"
  )
    ? "PROFESSIONAL"
    : "MIXED";
  const themePhrase = theme?.label ? theme.label.toLowerCase() : "production engineering";
  const technologyPhrase =
    technologies.length > 0 ? `using ${joinList(technologies)}` : "in production systems";
  const text = ensureSentence(
    `${input.targetCompany}'s needs around ${themePhrase} stand out to me because much of my recent work has centered on ${strengthPhrase} ${technologyPhrase}. That combination is where I can usually add value fastest: understanding the practical constraint, narrowing the shape of the solution, and shipping something a team can keep building on`
  );

  return {
    id: "alignment",
    type: "INTEREST_AND_ALIGNMENT" as const,
    purpose: "Explain why the role and company context match supported engineering interests.",
    text,
    wordCount: countWords(text),
    supportingEvidenceIds: unique([
      ...strengths.flatMap((strength) => strength.supportingEvidenceIds),
      ...selectedEvidence.map((candidate) => candidate.candidateId)
    ]),
    supportingRequirementIds: unique([
      ...strengths.flatMap((strength) => strength.requirementIds),
      ...selectedEvidence.flatMap((candidate) => candidate.matchedRequirementKinds.map(() => ""))
    ]).filter(Boolean),
    supportingMatchReportConclusionIds: unique([
      ...strengths.map((strength) => strength.strengthId),
      ...(theme ? [theme.themeId] : [])
    ]),
    sourceCareerRecordIds: unique(selectedEvidence.map((candidate) => candidate.careerEvidenceId)),
    sourceResumeSectionIds: [],
    acknowledgements: [],
    claims: [
      {
        id: "claim-alignment-strengths",
        type: "WORK_STYLE" as const,
        text: "Role alignment is based on recent supported engineering work.",
        qualified: false,
        evidenceContext: alignmentEvidenceContext,
        restrictions: []
      }
    ],
    technologies,
    companyReferences: [input.targetCompany],
    roleReferences: [input.targetRole],
    diagnostics: []
  };
}

function buildEvidenceParagraph(args: {
  input: CoverLetterCompositionInput;
  selectedEvidence: EvidenceRecord[];
  diagnostics: EvidenceDiagnostic[];
}): CoverLetterParagraph {
  const { input, selectedEvidence, diagnostics } = args;
  const primary = selectedEvidence[0];
  const secondary = selectedEvidence[1];
  const usedProjectOnly =
    selectedEvidence.length > 0 &&
    selectedEvidence.every((candidate) =>
      candidate.restrictions.some((restriction) => restriction.code === "PROJECT_ONLY")
    );

  if (!primary) {
    pushDiagnostic(diagnostics, {
      severity: "ERROR",
      code: "UNSUPPORTED_CLAIM",
      message: "No supported evidence was available for cover-letter composition.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  const intro =
    usedProjectOnly || primary?.context === "PROJECT"
      ? "Where direct professional evidence is lighter, I've also built relevant project work that still maps cleanly to the role"
      : "A large part of that fit comes from delivery work I have already done in professional settings";
  const firstEvidence = primary
    ? `${primary.claimText}${primary.employer ? ` at ${primary.employer}` : ""}`
    : "recent delivery evidence";
  const secondEvidence = secondary
    ? `I can pair that with ${secondary.claimText.toLowerCase()}`
    : "I can bring that same approach to a new codebase quickly";
  const text = ensureSentence(`${intro}, including ${firstEvidence}. ${secondEvidence}`);

  if (usedProjectOnly || primary?.context === "PROJECT") {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "PROJECT_EVIDENCE_USED",
      message: "Project evidence was used and qualified in the cover letter.",
      relatedRequirementId: null,
      relatedCandidateId: primary?.candidateId ?? null
    });
  }

  return {
    id: "evidence",
    type: "RELEVANT_EVIDENCE" as const,
    purpose: "Support fit with 2-3 deterministic evidence themes instead of restating the resume.",
    text,
    wordCount: countWords(text),
    supportingEvidenceIds: unique(selectedEvidence.map((candidate) => candidate.candidateId)),
    supportingRequirementIds: unique(
      input.matchReportResult.strengths.flatMap((strength) => strength.requirementIds)
    ).slice(0, 4),
    supportingMatchReportConclusionIds: input.matchReportResult.strengths
      .slice(0, 2)
      .map((strength) => strength.strengthId),
    sourceCareerRecordIds: unique(selectedEvidence.map((candidate) => candidate.careerEvidenceId)),
    sourceResumeSectionIds: [],
    acknowledgements: usedProjectOnly ? ["Project-only evidence was explicitly qualified."] : [],
    claims: selectedEvidence.map((candidate, index) => ({
      id: `claim-evidence-${index + 1}`,
      type: candidate.matchedRequirementKinds.includes("TECHNOLOGY")
        ? ("TECHNOLOGY" as const)
        : ("EXPERIENCE" as const),
      text: candidate.claimText,
      qualified: candidate.restrictions.length > 0,
      evidenceContext:
        candidate.context === "PROFESSIONAL"
          ? "PROFESSIONAL"
          : candidate.context === "PROJECT"
            ? "PROJECT"
            : "MIXED",
      restrictions: candidate.restrictions
    })),
    technologies: unique(selectedEvidence.flatMap((candidate) => candidate.matchedTechnologies)).slice(
      0,
      coverLetterCompositionConfiguration.evidence.maxNamedTechnologies
    ),
    companyReferences: [],
    roleReferences: [input.targetRole],
    diagnostics: []
  };
}

function buildApproachParagraph(args: {
  input: CoverLetterCompositionInput;
  selectedEvidence: EvidenceRecord[];
}): CoverLetterParagraph {
  const { input, selectedEvidence } = args;
  const themes = unique(
    [
      ...input.careerProfileContent.candidate.careerThemes,
      ...selectedEvidence.flatMap((candidate) => candidate.retrievalReasons.map((reason) => reason.sourceCareerField ?? ""))
    ].filter(Boolean)
  ).slice(0, 3);
  const technologies = unique(selectedEvidence.flatMap((candidate) => candidate.matchedTechnologies)).slice(0, 2);
  const themePhrase = themes.length > 0 ? joinList(themes.map((theme) => theme.toLowerCase())) : "reliable backend work";
  const technologyPhrase = technologies.length > 0 ? `with ${joinList(technologies)}` : "in delivery work";
  const approachEvidenceContext: "PROFESSIONAL" | "MIXED" = selectedEvidence.some(
    (candidate) => candidate.context === "PROFESSIONAL"
  )
    ? "PROFESSIONAL"
    : "MIXED";
  const text = ensureSentence(
    `The kind of engineer I am is usually defined less by a single stack and more by how I work: practical system design, maintainable implementation, and steady iteration ${technologyPhrase}. I tend to do my best work when the goal is to make complex responsibilities clearer, more reliable, and easier for the next engineer to extend, which is why the ${input.targetRole} scope feels like a strong fit`
  );

  return {
    id: "approach",
    type: "ENGINEERING_APPROACH" as const,
    purpose: "Describe supported engineering approach and work style.",
    text,
    wordCount: countWords(text),
    supportingEvidenceIds: unique(selectedEvidence.map((candidate) => candidate.candidateId)),
    supportingRequirementIds: unique(
      input.matchReportResult.requirementConclusions
        .filter((conclusion) => conclusion.conclusionCode !== "NO_SUPPORT")
        .slice(0, 3)
        .map((conclusion) => conclusion.requirementId)
    ),
    supportingMatchReportConclusionIds: unique(
      input.matchReportResult.requirementConclusions
        .filter((conclusion) => conclusion.conclusionCode !== "NO_SUPPORT")
        .slice(0, 3)
        .map((conclusion) => conclusion.requirementId)
    ),
    sourceCareerRecordIds: unique([
      input.careerProfileContent.candidate.id,
      ...selectedEvidence.map((candidate) => candidate.careerEvidenceId)
    ]),
    sourceResumeSectionIds: [],
    acknowledgements: themePhrase.includes("stale") ? ["Prior evidence remained qualified."] : [],
    claims: [
      {
        id: "claim-approach",
        type: "WORK_STYLE" as const,
        text: `Engineering approach emphasizes ${themePhrase}.`,
        qualified: false,
        evidenceContext: approachEvidenceContext,
        restrictions: []
      }
    ],
    technologies,
    companyReferences: [],
    roleReferences: [input.targetRole],
    diagnostics: []
  };
}

function buildClosing(args: { input: CoverLetterCompositionInput }): {
  paragraph: CoverLetterParagraph;
  closing: string;
} {
  const closing =
    args.input.resumeSource?.sourceType === "FINALIZED_REVISION"
      ? coverLetterCompositionConfiguration.closings[1]
      : coverLetterCompositionConfiguration.closings[0];
  const text = ensureSentence(
    `${closing} ${args.input.targetCompany} is doing work that rewards direct execution and thoughtful ownership, and I'd be glad to discuss where my background could be most useful`
  );

  return {
    paragraph: {
      id: "closing",
      type: "CLOSING" as const,
      purpose: "Close naturally and invite conversation without filler.",
      text,
      wordCount: countWords(text),
      supportingEvidenceIds: [],
      supportingRequirementIds: [],
      supportingMatchReportConclusionIds: [],
      sourceCareerRecordIds: [args.input.careerProfileContent.candidate.id],
      sourceResumeSectionIds: [],
      acknowledgements: [],
      claims: [
        {
          id: "claim-closing",
          type: "MOTIVATION" as const,
          text: "Open to further conversation about the role.",
          qualified: false,
          evidenceContext: "OTHER" as const,
          restrictions: []
        }
      ],
      technologies: [],
      companyReferences: [args.input.targetCompany],
      roleReferences: [args.input.targetRole],
      diagnostics: []
    },
    closing
  };
}

function validateParagraphs(paragraphs: CoverLetterParagraph[], diagnostics: EvidenceDiagnostic[]) {
  for (const paragraph of paragraphs) {
    if (paragraph.supportingEvidenceIds.length === 0 && paragraph.type === "RELEVANT_EVIDENCE") {
      pushDiagnostic(diagnostics, {
        severity: "ERROR",
        code: "MISSING_PARAGRAPH_PROVENANCE",
        message: "The evidence paragraph must retain supporting evidence provenance.",
        relatedRequirementId: null,
        relatedCandidateId: null
      });
    }

    if (paragraph.wordCount > coverLetterCompositionConfiguration.length.maxParagraphWords) {
      pushDiagnostic(diagnostics, {
        severity: "WARNING",
        code: "PARAGRAPH_TOO_LONG",
        message: `${paragraph.id} exceeds the preferred paragraph length.`,
        relatedRequirementId: paragraph.supportingRequirementIds[0] ?? null,
        relatedCandidateId: paragraph.supportingEvidenceIds[0] ?? null
      });
    }
  }
}

export function buildCoverLetterComposition(input: CoverLetterCompositionInput) {
  const parsed = coverLetterCompositionInputSchema.parse(input);
  const diagnostics: EvidenceDiagnostic[] = [];

  const selectedEvidence = selectTopEvidence(parsed);
  const opening = buildOpening({ input: parsed, diagnostics });
  const alignment = buildAlignmentParagraph({ input: parsed, selectedEvidence });
  const evidence = buildEvidenceParagraph({ input: parsed, selectedEvidence, diagnostics });
  const approach = buildApproachParagraph({ input: parsed, selectedEvidence });
  const closingResult = buildClosing({ input: parsed });

  const paragraphs = [opening, alignment, evidence, approach, closingResult.paragraph];
  validateParagraphs(paragraphs, diagnostics);

  const plainText = toPlainText(paragraphs, closingResult.closing);
  const wordCount = countWords(plainText);
  const paragraphCount = paragraphs.length;
  const overlapRatio = computeOverlapRatio(plainText, parsed.resumeSource?.plainText ?? null);

  if (wordCount < coverLetterCompositionConfiguration.length.minWords) {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "SHORT_LETTER",
      message: "The generated cover letter is shorter than the target range.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  if (wordCount > coverLetterCompositionConfiguration.length.maxWords) {
    pushDiagnostic(diagnostics, {
      severity: "ERROR",
      code: "WORD_COUNT_EXCEEDED",
      message: "The generated cover letter exceeds the target word range.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  if (paragraphCount > coverLetterCompositionConfiguration.length.maxParagraphs) {
    pushDiagnostic(diagnostics, {
      severity: "ERROR",
      code: "TOO_MANY_PARAGRAPHS",
      message: "The generated cover letter exceeded the paragraph limit.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  if (paragraphCount < coverLetterCompositionConfiguration.length.minParagraphs) {
    pushDiagnostic(diagnostics, {
      severity: "ERROR",
      code: "MISSING_PARAGRAPH_PROVENANCE",
      message: "The generated cover letter did not produce enough paragraphs.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  if (/[\u2013\u2014]/.test(plainText)) {
    pushDiagnostic(diagnostics, {
      severity: "ERROR",
      code: "EM_DASH_PRESENT",
      message: "Cover-letter output contains prohibited dash punctuation.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  if (overlapRatio >= coverLetterCompositionConfiguration.overlap.warningThreshold) {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "RESUME_TEXT_OVERLAP_HIGH",
      message: "Cover-letter wording overlaps too heavily with the selected resume source.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  if (!plainText.includes(parsed.targetCompany)) {
    pushDiagnostic(diagnostics, {
      severity: "ERROR",
      code: "COMPANY_REFERENCE_MISSING",
      message: "The generated cover letter does not reference the target company.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  if (!plainText.includes(parsed.targetRole)) {
    pushDiagnostic(diagnostics, {
      severity: "ERROR",
      code: "ROLE_REFERENCE_MISSING",
      message: "The generated cover letter does not reference the target role.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  const professionalParagraphCount = paragraphs.filter((paragraph) =>
    paragraph.claims.some((claim) => claim.evidenceContext === "PROFESSIONAL")
  ).length;
  const projectParagraphCount = paragraphs.filter((paragraph) =>
    paragraph.claims.some((claim) => claim.evidenceContext === "PROJECT")
  ).length;

  if (professionalParagraphCount === 0 && selectedEvidence.length > 0) {
    pushDiagnostic(diagnostics, {
      severity: "WARNING",
      code: "LIMITED_PROFESSIONAL_EVIDENCE",
      message: "The generated cover letter relied on limited professional evidence.",
      relatedRequirementId: null,
      relatedCandidateId: selectedEvidence[0]?.candidateId ?? null
    });
  } else {
    pushDiagnostic(diagnostics, {
      severity: "INFO",
      code: "PROFESSIONAL_EVIDENCE_PRIORITIZED",
      message: "Professional evidence was prioritized where available.",
      relatedRequirementId: null,
      relatedCandidateId: selectedEvidence.find((candidate) => candidate.context === "PROFESSIONAL")?.candidateId ?? null
    });
  }

  if (!parsed.resumeSource) {
    pushDiagnostic(diagnostics, {
      severity: "INFO",
      code: "WEAK_MOTIVATION_EVIDENCE",
      message: "No resume source was available, so non-duplication checks used only match-report evidence.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  } else {
    pushDiagnostic(diagnostics, {
      severity: "INFO",
      code: "RESUME_SOURCE_USED",
      message: "A deterministic resume source was used for overlap checks.",
      relatedRequirementId: null,
      relatedCandidateId: null
    });
  }

  pushDiagnostic(diagnostics, {
    severity: "INFO",
    code: "MATCH_REPORT_GUIDANCE_APPLIED",
    message: "Match-report guidance shaped cover-letter evidence selection and ordering.",
    relatedRequirementId: parsed.matchReportResult.requirementConclusions[0]?.requirementId ?? null,
    relatedCandidateId: selectedEvidence[0]?.candidateId ?? null
  });

  const warningCount = diagnostics.filter((diagnostic) => diagnostic.severity === "WARNING").length;
  const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "ERROR").length;
  const infoCount = diagnostics.filter((diagnostic) => diagnostic.severity === "INFO").length;
  const status = errorCount > 0 ? "FAILED" : warningCount > 0 ? "SUCCESS_WITH_WARNINGS" : "SUCCESS";

  return coverLetterCompositionContentSchema.parse({
    runId: parsed.runId,
    workspaceId: parsed.workspaceId,
    applicationId: parsed.applicationId,
    jobOpportunityId: parsed.jobOpportunityId,
    jobDescriptionVersionId: parsed.jobDescriptionVersionId,
    careerProfileVersionId: parsed.careerProfileVersionId,
    requirementAnalysisId: parsed.requirementAnalysisId,
    evidenceRetrievalRunId: parsed.evidenceRetrievalRunId,
    evidenceScoringRunId: parsed.evidenceScoringRunId,
    matchReportRunId: parsed.matchReportRunId,
    resumeCompositionVersionId:
      parsed.resumeSource?.sourceType === "BASE_COMPOSITION" ? parsed.resumeSource.sourceId : null,
    resumeRevisionVersionId:
      parsed.resumeSource?.sourceType === "FINALIZED_REVISION" ? parsed.resumeSource.sourceId : null,
    coverLetterCompositionContractVersion: COVER_LETTER_COMPOSITION_CONTRACT_VERSION,
    coverLetterCompositionEngineVersion: COVER_LETTER_COMPOSITION_ENGINE_VERSION,
    coverLetterCompositionConfigurationVersion: COVER_LETTER_COMPOSITION_CONFIGURATION_VERSION,
    createdAt: parsed.createdAt,
    inputChecksum: parsed.inputChecksum,
    status,
    candidateName: parsed.careerProfileContent.candidate.displayName,
    header: {
      email: parsed.careerProfileContent.candidate.contacts.email,
      phone: parsed.careerProfileContent.candidate.contacts.phone,
      location: parsed.careerProfileContent.candidate.location,
      date: parsed.createdAt.slice(0, 10),
      company: parsed.targetCompany,
      role: parsed.targetRole,
      salutation: coverLetterCompositionConfiguration.salutations.default
    },
    diagnostics,
    summary: {
      targetCompany: parsed.targetCompany,
      targetRole: parsed.targetRole,
      wordCount,
      paragraphCount,
      companyReferenceCount: paragraphs.reduce((sum, paragraph) => sum + paragraph.companyReferences.length, 0),
      roleReferenceCount: paragraphs.reduce((sum, paragraph) => sum + paragraph.roleReferences.length, 0),
      technologyMentionCount: unique(paragraphs.flatMap((paragraph) => paragraph.technologies)).length,
      professionalEvidenceParagraphCount: professionalParagraphCount,
      projectEvidenceParagraphCount: projectParagraphCount,
      warningCount,
      errorCount,
      infoCount,
      resumeOverlapRatio: overlapRatio,
      resumeSourceUsed: Boolean(parsed.resumeSource),
      professionalEvidencePrioritized: professionalParagraphCount >= projectParagraphCount
    },
    styleSummary: {
      salutation: coverLetterCompositionConfiguration.salutations.default,
      closing: closingResult.closing,
      voice: parsed.resumeSource ? "DIRECT" : "RESTRAINED",
      noEmDashDetected: !/[\u2013\u2014]/.test(plainText),
      prohibitedPhrasesDetected: coverLetterCompositionConfiguration.prohibitedPhrases.filter((phrase) =>
        plainText.toLowerCase().includes(phrase.toLowerCase())
      )
    },
    lengthSummary: {
      targetMinWords: coverLetterCompositionConfiguration.length.minWords,
      targetMaxWords: coverLetterCompositionConfiguration.length.maxWords,
      actualWords: wordCount,
      targetMinParagraphs: coverLetterCompositionConfiguration.length.minParagraphs,
      targetMaxParagraphs: coverLetterCompositionConfiguration.length.maxParagraphs,
      actualParagraphs: paragraphCount,
      withinTargetRange:
        wordCount >= coverLetterCompositionConfiguration.length.minWords &&
        wordCount <= coverLetterCompositionConfiguration.length.maxWords &&
        paragraphCount >= coverLetterCompositionConfiguration.length.minParagraphs &&
        paragraphCount <= coverLetterCompositionConfiguration.length.maxParagraphs
    },
    paragraphs,
    closing: closingResult.closing,
    plainText,
    provenance: {
      overallEvidenceIds: unique(paragraphs.flatMap((paragraph) => paragraph.supportingEvidenceIds)),
      overallRequirementIds: unique(paragraphs.flatMap((paragraph) => paragraph.supportingRequirementIds)),
      overallCareerRecordIds: unique(paragraphs.flatMap((paragraph) => paragraph.sourceCareerRecordIds)),
      resumeSource: parsed.resumeSource
    }
  });
}
