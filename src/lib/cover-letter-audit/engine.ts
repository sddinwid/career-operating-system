import type { CoverLetterRevisionContent } from "@/lib/cover-letter-revision/contract";
import {
  COVER_LETTER_AUDIT_CONFIGURATION_VERSION,
  COVER_LETTER_AUDIT_CONTRACT_VERSION,
  COVER_LETTER_AUDIT_ENGINE_VERSION,
  coverLetterAuditConfiguration
} from "@/lib/cover-letter-audit/config";
import type { CoverLetterAuditResult } from "@/lib/cover-letter-audit/contract";

function countWords(value: string) {
  return value.trim().length === 0 ? 0 : value.trim().split(/\s+/).length;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function createFindingId(args: { ruleId: string; paragraphId: string | null; index?: number }) {
  return [args.ruleId, args.paragraphId ?? "global", String(args.index ?? 0)].join(":");
}

function extractNewNumericClaims(original: string, current: string) {
  const originalMatches = new Set(original.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []);
  return (current.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []).filter((token) => !originalMatches.has(token));
}

function extractYearsClaims(value: string) {
  return value.match(/\b\d+\+?\s+years?\b/gi) ?? [];
}

function extractTechnologyTokens(value: string) {
  return Array.from(
    new Set(
      (value.match(/\b[A-Z][A-Za-z0-9.+#-]{1,}\b/g) ?? []).filter(
        (token) => token.length > 2 && token !== "Scott"
      )
    )
  );
}

function extractIntroducedTechnologyTokens(original: string, current: string) {
  const originalTokens = new Set(extractTechnologyTokens(original));
  return extractTechnologyTokens(current).filter((token) => !originalTokens.has(token));
}

function pushFinding(
  findings: CoverLetterAuditResult["findings"],
  finding: Omit<CoverLetterAuditResult["findings"][number], "findingId"> & {
    index?: number;
  }
) {
  findings.push({
    ...finding,
    findingId: createFindingId({
      ruleId: finding.ruleId,
      paragraphId: finding.paragraphId,
      index: finding.index
    })
  });
}

export function buildCoverLetterAudit(args: {
  runId: string;
  workspaceId: string;
  revision: CoverLetterRevisionContent;
  sourceType: "BASE_COMPOSITION" | "FINALIZED_REVISION";
  inputChecksum: string;
}): CoverLetterAuditResult {
  const findings: CoverLetterAuditResult["findings"] = [];
  const orderedParagraphs = [...args.revision.paragraphs].sort((left, right) => left.order - right.order);
  const fullText = [
    args.revision.salutation,
    ...orderedParagraphs.map((paragraph) => paragraph.currentText),
    args.revision.closing
  ].join("\n\n");
  const normalizedFullText = normalizeText(fullText);
  const wordCount = countWords(fullText);
  const paragraphCount = orderedParagraphs.length;

  if (!normalizedFullText.includes(normalizeText(args.revision.header.company))) {
    pushFinding(findings, {
      ruleId: "COMPANY_REFERENCE_MISSING",
      severity: "ERROR",
      message: "The cover letter must reference the target company by name.",
      paragraphId: null,
      blocksFinalization: true,
      sourceEvidenceIds: [],
      sourceRequirementIds: []
    });
  }

  if (!normalizedFullText.includes(normalizeText(args.revision.header.role))) {
    pushFinding(findings, {
      ruleId: "ROLE_REFERENCE_MISSING",
      severity: "ERROR",
      message: "The cover letter must reference the target role by name.",
      paragraphId: null,
      blocksFinalization: true,
      sourceEvidenceIds: [],
      sourceRequirementIds: []
    });
  }

  if (/[\u2014]|(^|[\s])[\u2013](?=[\s])/u.test(fullText)) {
    pushFinding(findings, {
      ruleId: "EM_DASH_PROHIBITED",
      severity: "ERROR",
      message: "Cover-letter revisions cannot contain em dashes or prose en dashes.",
      paragraphId: null,
      blocksFinalization: true,
      sourceEvidenceIds: [],
      sourceRequirementIds: []
    });
  }

  if (normalizeText(args.revision.salutation) === "dear hiring team,") {
    pushFinding(findings, {
      ruleId: "GENERIC_OPENING_RISK",
      severity: "WARNING",
      message: "The salutation is generic and may need a more specific opening.",
      paragraphId: null,
      blocksFinalization: false,
      sourceEvidenceIds: [],
      sourceRequirementIds: []
    });
  }

  if (/^sincerely[, ]*$/i.test(args.revision.closing.trim())) {
    pushFinding(findings, {
      ruleId: "GENERIC_CLOSING_RISK",
      severity: "WARNING",
      message: "The closing is generic and may need a stronger, role-specific finish.",
      paragraphId: null,
      blocksFinalization: false,
      sourceEvidenceIds: [],
      sourceRequirementIds: []
    });
  }

  if (wordCount > coverLetterAuditConfiguration.hardMaxWords) {
    pushFinding(findings, {
      ruleId: "WORD_COUNT_OVER_LIMIT",
      severity: "ERROR",
      message: `Cover letter exceeds the hard ${coverLetterAuditConfiguration.hardMaxWords}-word ceiling.`,
      paragraphId: null,
      blocksFinalization: true,
      sourceEvidenceIds: [],
      sourceRequirementIds: []
    });
  } else if (wordCount < coverLetterAuditConfiguration.warningMinWords) {
    pushFinding(findings, {
      ruleId: "WORD_COUNT_SHORT",
      severity: "WARNING",
      message: "Cover letter is concise enough to review, but it may be too short for the target range.",
      paragraphId: null,
      blocksFinalization: false,
      sourceEvidenceIds: [],
      sourceRequirementIds: []
    });
  }

  if (paragraphCount > coverLetterAuditConfiguration.maxParagraphs) {
    pushFinding(findings, {
      ruleId: "PARAGRAPH_COUNT_OVER_LIMIT",
      severity: "ERROR",
      message: "Cover letter exceeds the supported paragraph count.",
      paragraphId: null,
      blocksFinalization: true,
      sourceEvidenceIds: [],
      sourceRequirementIds: []
    });
  }

  if (args.revision.summary.resumeOverlapRatio > coverLetterAuditConfiguration.maxResumeOverlapRatio) {
    pushFinding(findings, {
      ruleId: "HIGH_RESUME_OVERLAP",
      severity: "WARNING",
      message: "Cover letter overlaps too heavily with the resume source and may need more distinct wording.",
      paragraphId: null,
      blocksFinalization: false,
      sourceEvidenceIds: [],
      sourceRequirementIds: []
    });
  }

  orderedParagraphs.forEach((paragraph, index) => {
    if (paragraph.order !== index) {
      pushFinding(findings, {
        ruleId: "PARAGRAPH_ORDER_INVALID",
        severity: "ERROR",
        message: "Paragraph order must remain contiguous and deterministic.",
        paragraphId: paragraph.id,
        blocksFinalization: true,
        sourceEvidenceIds: paragraph.supportingEvidenceIds,
        sourceRequirementIds: paragraph.supportingRequirementIds
      });
    }

    const requiresEvidenceProvenance =
      paragraph.type !== "OPENING" && paragraph.type !== "CLOSING";
    if (
      paragraph.sourceCareerRecordIds.length === 0 ||
      (requiresEvidenceProvenance && paragraph.supportingEvidenceIds.length === 0)
    ) {
      pushFinding(findings, {
        ruleId: "PARAGRAPH_PROVENANCE_INCOMPLETE",
        severity: "ERROR",
        message: "Each paragraph must retain evidence and career-record provenance.",
        paragraphId: paragraph.id,
        blocksFinalization: true,
        sourceEvidenceIds: paragraph.supportingEvidenceIds,
        sourceRequirementIds: paragraph.supportingRequirementIds
      });
    }

    if (countWords(paragraph.currentText) > coverLetterAuditConfiguration.maxParagraphWords) {
      pushFinding(findings, {
        ruleId: "PARAGRAPH_TOO_LONG",
        severity: "WARNING",
        message: "A paragraph exceeds the preferred maximum paragraph length.",
        paragraphId: paragraph.id,
        blocksFinalization: false,
        sourceEvidenceIds: paragraph.supportingEvidenceIds,
        sourceRequirementIds: paragraph.supportingRequirementIds
      });
    }

    const unsupportedTechnologies = extractIntroducedTechnologyTokens(
      paragraph.originalText,
      paragraph.currentText
    ).filter((token) => {
      const normalizedToken = token.toLowerCase();
      return (
        !paragraph.technologies.some((technology) => technology.toLowerCase() === normalizedToken) &&
        !paragraph.originalClaims.some((claim) => claim.text.toLowerCase().includes(normalizedToken)) &&
        !paragraph.companyReferences.some((reference) => reference.toLowerCase().includes(normalizedToken)) &&
        !paragraph.roleReferences.some((reference) => reference.toLowerCase().includes(normalizedToken))
      );
    });

    if (unsupportedTechnologies.length > 0) {
      pushFinding(findings, {
        ruleId: "UNSUPPORTED_TECHNOLOGY_CLAIM",
        severity: "ERROR",
        message: `Unsupported technology wording was introduced: ${unsupportedTechnologies.join(", ")}.`,
        paragraphId: paragraph.id,
        blocksFinalization: true,
        sourceEvidenceIds: paragraph.supportingEvidenceIds,
        sourceRequirementIds: paragraph.supportingRequirementIds
      });
    }

    const unsupportedMetrics = extractNewNumericClaims(paragraph.originalText, paragraph.currentText);
    if (unsupportedMetrics.length > 0) {
      pushFinding(findings, {
        ruleId: "UNSUPPORTED_METRIC_CLAIM",
        severity: "ERROR",
        message: `Edited wording introduced unsupported numeric claims: ${unsupportedMetrics.join(", ")}.`,
        paragraphId: paragraph.id,
        blocksFinalization: true,
        sourceEvidenceIds: paragraph.supportingEvidenceIds,
        sourceRequirementIds: paragraph.supportingRequirementIds
      });
    }

    const previousYears = new Set(extractYearsClaims(paragraph.originalText));
    const introducedYears = extractYearsClaims(paragraph.currentText).filter((item) => !previousYears.has(item));
    if (introducedYears.length > 0) {
      pushFinding(findings, {
        ruleId: "UNSUPPORTED_YEARS_CLAIM",
        severity: "ERROR",
        message: `Edited wording introduced unsupported years-of-experience claims: ${introducedYears.join(", ")}.`,
        paragraphId: paragraph.id,
        blocksFinalization: true,
        sourceEvidenceIds: paragraph.supportingEvidenceIds,
        sourceRequirementIds: paragraph.supportingRequirementIds
      });
    }

    if (
      paragraph.claims.some((claim) =>
        ["DOMAIN", "MOTIVATION", "WORK_STYLE"].includes(claim.type)
      ) &&
      paragraph.currentText !== paragraph.originalText
    ) {
      pushFinding(findings, {
        ruleId: "QUALIFIED_CLAIM_EDITED",
        severity: "WARNING",
        message: "Edited wording touched a qualified domain, motivation, or work-style claim and should be reviewed closely.",
        paragraphId: paragraph.id,
        blocksFinalization: false,
        sourceEvidenceIds: paragraph.supportingEvidenceIds,
        sourceRequirementIds: paragraph.supportingRequirementIds
      });
    }
  });

  const errorCount = findings.filter((finding) => finding.severity === "ERROR").length;
  const warningCount = findings.filter((finding) => finding.severity === "WARNING").length;
  const informationCount = findings.filter((finding) => finding.severity === "INFORMATION").length;
  const renderingReadiness =
    errorCount > 0 ? "BLOCKED" : warningCount > 0 ? "READY_WITH_WARNINGS" : "READY_FOR_RENDERING";
  const status = errorCount > 0 ? "FAILED" : warningCount > 0 ? "SUCCESS_WITH_WARNINGS" : "SUCCESS";

  return {
    runId: args.runId,
    workspaceId: args.workspaceId,
    sourceType: args.sourceType,
    coverLetterRevisionVersionId:
      args.sourceType === "FINALIZED_REVISION" ? args.revision.revisionId : null,
    coverLetterCompositionVersionId: args.revision.coverLetterCompositionVersionId,
    applicationId: args.revision.applicationId,
    jobOpportunityId: args.revision.jobOpportunityId,
    jobDescriptionVersionId: args.revision.jobDescriptionVersionId,
    careerProfileVersionId: args.revision.careerProfileVersionId,
    requirementAnalysisId: args.revision.requirementAnalysisId,
    evidenceRetrievalRunId: args.revision.evidenceRetrievalRunId,
    evidenceScoringRunId: args.revision.evidenceScoringRunId,
    matchReportRunId: args.revision.matchReportRunId,
    coverLetterAuditContractVersion: COVER_LETTER_AUDIT_CONTRACT_VERSION,
    coverLetterAuditEngineVersion: COVER_LETTER_AUDIT_ENGINE_VERSION,
    coverLetterAuditConfigurationVersion: COVER_LETTER_AUDIT_CONFIGURATION_VERSION,
    contentChecksum: args.revision.contentChecksum,
    inputChecksum: args.inputChecksum,
    createdAt: new Date().toISOString(),
    status,
    renderingReadiness,
    diagnostics: args.revision.diagnostics,
    summary: {
      auditStatus: status,
      renderingReadiness,
      errorCount,
      warningCount,
      informationCount,
      wordCount,
      paragraphCount,
      blockingFindingCount: findings.filter((finding) => finding.blocksFinalization).length
    },
    findings
  };
}
