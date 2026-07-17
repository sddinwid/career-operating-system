import {
  canonicalCareerKnowledgeContractSchema,
  type CanonicalCareerKnowledgeContract,
  type CareerFindingSeverity,
  sourceCareerKnowledgeSchema,
  type SourceCareerKnowledge
} from "@/lib/career/contracts";

export type CareerImportFinding = {
  severity: CareerFindingSeverity;
  code: string;
  message: string;
  path: string;
};

export type CareerValidationSummary = {
  errorCount: number;
  warningCount: number;
  informationCount: number;
  blockingIssues: string[];
  findings: CareerImportFinding[];
};

function finding(
  severity: CareerFindingSeverity,
  code: string,
  message: string,
  path: string
): CareerImportFinding {
  return { severity, code, message, path };
}

function summarize(findings: CareerImportFinding[]): CareerValidationSummary {
  return {
    errorCount: findings.filter((item) => item.severity === "ERROR").length,
    warningCount: findings.filter((item) => item.severity === "WARNING").length,
    informationCount: findings.filter((item) => item.severity === "INFO").length,
    blockingIssues: findings
      .filter((item) => item.severity === "ERROR")
      .map((item) => `${item.path}: ${item.message}`),
    findings
  };
}

function collectDuplicateNameWarnings(
  values: Array<{ value: string; path: string }>,
  code: string,
  label: string
) {
  const findings: CareerImportFinding[] = [];
  const seen = new Map<string, string>();

  for (const entry of values) {
    const key = entry.value.trim().toLowerCase();
    if (!key) {
      continue;
    }

    const existingPath = seen.get(key);
    if (existingPath) {
      findings.push(
        finding(
          "WARNING",
          code,
          `Duplicate ${label} "${entry.value}" also appears at ${existingPath}.`,
          entry.path
        )
      );
      continue;
    }

    seen.set(key, entry.path);
  }

  return findings;
}

function scanSecrets(value: unknown, path: string, findings: CareerImportFinding[]) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const secretLikePatterns = [
      { code: "SECRET_API_KEY", regex: /\b(?:sk|pk)_[a-z0-9_-]{16,}\b/i },
      { code: "SECRET_PASSWORD", regex: /\bpassword\s*[:=]\s*\S+/i },
      { code: "SECRET_TOKEN", regex: /\b(?:token|access[_-]?token)\s*[:=]\s*\S+/i },
      { code: "SECRET_PRIVATE_KEY", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ }
    ];

    for (const pattern of secretLikePatterns) {
      if (pattern.regex.test(trimmed)) {
        findings.push(
          finding(
            "WARNING",
            pattern.code,
            "Potential secret-like value detected. Review the source before importing.",
            path
          )
        );
      }
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => scanSecrets(item, `${path}[${index}]`, findings));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      scanSecrets(nestedValue, path ? `${path}.${key}` : key, findings);
    }
  }
}

export function validateCareerKnowledgeSource(source: unknown) {
  const findings: CareerImportFinding[] = [];
  const parsed = sourceCareerKnowledgeSchema.safeParse(source);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      findings.push(
        finding(
          "ERROR",
          "SOURCE_STRUCTURE_INVALID",
          issue.message,
          issue.path.join(".") || "root"
        )
      );
    }

    return {
      success: false as const,
      findings,
      summary: summarize(findings),
      data: null
    };
  }

  const data = parsed.data;
  const meta = data._meta;
  const candidateProfile = data.candidateProfile;

  if (typeof meta.schemaVersion !== "string" || !meta.schemaVersion.trim()) {
    findings.push(
      finding(
        "ERROR",
        "SOURCE_META_SCHEMA_VERSION_MISSING",
        "Source metadata must include a non-empty schemaVersion.",
        "_meta.schemaVersion"
      )
    );
  }

  if (typeof meta.documentType !== "string" || !meta.documentType.trim()) {
    findings.push(
      finding(
        "ERROR",
        "SOURCE_META_DOCUMENT_TYPE_MISSING",
        "Source metadata must include a non-empty documentType.",
        "_meta.documentType"
      )
    );
  }

  if (typeof candidateProfile._id !== "string" || !candidateProfile._id.trim()) {
    findings.push(
      finding(
        "ERROR",
        "SOURCE_CANDIDATE_ID_MISSING",
        "Candidate profile must include a non-empty _id.",
        "candidateProfile._id"
      )
    );
  }

  if (typeof candidateProfile.name !== "string" || !candidateProfile.name.trim()) {
    findings.push(
      finding(
        "ERROR",
        "SOURCE_CANDIDATE_NAME_MISSING",
        "Candidate profile must include a non-empty name.",
        "candidateProfile.name"
      )
    );
  }

  scanSecrets(data, "source", findings);

  const knownTopLevelFields = new Set([
    "_meta",
    "candidateProfile",
    "resumeGenerationRules",
    "skills",
    "professionalExperience",
    "projects",
    "education",
    "certifications",
    "writingPreferences",
    "jobDescriptionParsingRules",
    "jobMatchingRules",
    "accomplishments",
    "resumeBullets",
    "architectureExamples",
    "leadershipExamples",
    "productionExamples",
    "interviewStories",
    "domainExperience",
    "outputGenerationWorkflow",
    "outputTemplates",
    "knownUnknowns"
  ]);

  for (const key of Object.keys(data)) {
    if (!knownTopLevelFields.has(key)) {
      findings.push(
        finding(
          "INFO",
          "SOURCE_UNKNOWN_TOP_LEVEL_FIELD",
          `Unknown top-level field "${key}" was preserved in the raw source but is not part of the canonical contract.`,
          key
        )
      );
    }
  }

  return {
    success: true as const,
    findings,
    summary: summarize(findings),
    data
  };
}

export function validateCanonicalCareerKnowledgeContract(contract: unknown) {
  const findings: CareerImportFinding[] = [];
  const parsed = canonicalCareerKnowledgeContractSchema.safeParse(contract);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      findings.push(
        finding(
          "ERROR",
          "CONTRACT_STRUCTURE_INVALID",
          issue.message,
          issue.path.join(".") || "root"
        )
      );
    }

    return {
      success: false as const,
      findings,
      summary: summarize(findings),
      data: null
    };
  }

  const data = parsed.data;
  const allIds = new Map<string, string>();
  const referenceableIds = new Set<string>([
    ...data.employment.map((entry) => entry.id),
    ...data.projects.map((entry) => entry.id),
    ...data.evidence.map((entry) => entry.id)
  ]);

  const registerId = (id: string, path: string) => {
    if (!id.trim()) {
      findings.push(
        finding(
          "ERROR",
          "MISSING_IDENTIFIER",
          "Identifier must not be empty.",
          path
        )
      );
      return;
    }

    const existing = allIds.get(id);
    if (existing) {
      findings.push(
        finding(
          "ERROR",
          "DUPLICATE_IDENTIFIER",
          `Duplicate identifier "${id}" also appears at ${existing}.`,
          path
        )
      );
      return;
    }

    allIds.set(id, path);
  };

  data.employment.forEach((entry, index) => {
    registerId(entry.id, `employment[${index}]`);

    if (entry.startDate?.precision === "UNKNOWN") {
      findings.push(
        finding(
          "WARNING",
          "UNKNOWN_DATE_PRECISION",
          "Employment start date uses an unknown precision format.",
          `employment[${index}].startDate`
        )
      );
    }

    if (entry.endDate?.precision === "UNKNOWN") {
      findings.push(
        finding(
          "WARNING",
          "UNKNOWN_DATE_PRECISION",
          "Employment end date uses an unknown precision format.",
          `employment[${index}].endDate`
        )
      );
    }

    if (
      entry.startDate?.normalized &&
      entry.endDate?.normalized &&
      entry.startDate.normalized > entry.endDate.normalized
    ) {
      findings.push(
        finding(
          "ERROR",
          "EMPLOYMENT_DATE_CONFLICT",
          "Employment end date is before the start date.",
          `employment[${index}]`
        )
      );
    }

    entry.metrics.forEach((metric, metricIndex) => {
      if (!metric.description && !metric.value) {
        findings.push(
          finding(
            "WARNING",
            "METRIC_WITHOUT_CONTEXT",
            "Metric entry is present without a description or value.",
            `employment[${index}].metrics[${metricIndex}]`
          )
        );
      }
    });
  });

  data.projects.forEach((entry, index) => {
    registerId(entry.id, `projects[${index}]`);

    if (
      entry.dates.startDate?.normalized &&
      entry.dates.endDate?.normalized &&
      entry.dates.startDate.normalized > entry.dates.endDate.normalized
    ) {
      findings.push(
        finding(
          "ERROR",
          "PROJECT_DATE_CONFLICT",
          "Project end date is before the start date.",
          `projects[${index}]`
        )
      );
    }
  });

  data.skills.forEach((entry, index) => {
    registerId(entry.id, `skills[${index}]`);

    entry.evidenceReferences.forEach((referenceId, referenceIndex) => {
      if (!referenceableIds.has(referenceId)) {
        findings.push(
          finding(
            "ERROR",
            "SKILL_EVIDENCE_REFERENCE_MISSING",
            `Skill evidence reference "${referenceId}" does not resolve to a known evidence or entity record.`,
            `skills[${index}].evidenceReferences[${referenceIndex}]`
          )
        );
      }
    });
  });

  data.education.forEach((entry, index) => {
    registerId(entry.id, `education[${index}]`);
  });

  data.certifications.forEach((entry, index) => {
    registerId(entry.id, `certifications[${index}]`);

    if (entry.status === "CURRENT" && entry.expirationDate) {
      const currentDate = "2026-07-16";
      if (entry.expirationDate.normalized < currentDate) {
        findings.push(
          finding(
            "ERROR",
            "CERTIFICATION_STATUS_CONFLICT",
            "Certification is marked current even though the expiration date is in the past.",
            `certifications[${index}]`
          )
        );
      }
    }
  });

  data.evidence.forEach((entry, index) => {
    registerId(entry.id, `evidence[${index}]`);

    if (entry.associatedEmploymentId && !allIds.has(entry.associatedEmploymentId)) {
      findings.push(
        finding(
          "ERROR",
          "EVIDENCE_EMPLOYMENT_REFERENCE_MISSING",
          `Evidence record references missing employment "${entry.associatedEmploymentId}".`,
          `evidence[${index}].associatedEmploymentId`
        )
      );
    }

    if (entry.associatedProjectId && !allIds.has(entry.associatedProjectId)) {
      findings.push(
        finding(
          "ERROR",
          "EVIDENCE_PROJECT_REFERENCE_MISSING",
          `Evidence record references missing project "${entry.associatedProjectId}".`,
          `evidence[${index}].associatedProjectId`
        )
      );
    }

    if (!entry.claim.trim()) {
      findings.push(
        finding(
          "ERROR",
          "EVIDENCE_CLAIM_MISSING",
          "Evidence record claim must not be empty.",
          `evidence[${index}].claim`
        )
      );
    }
  });

  data.interviewStories.forEach((entry, index) => {
    registerId(entry.id, `interviewStories[${index}]`);

    entry.supportingEvidenceIds.forEach((referenceId, referenceIndex) => {
      if (!referenceableIds.has(referenceId)) {
        findings.push(
          finding(
            "ERROR",
            "INTERVIEW_STORY_REFERENCE_MISSING",
            `Interview story reference "${referenceId}" does not resolve to a known entity or evidence record.`,
            `interviewStories[${index}].supportingEvidenceIds[${referenceIndex}]`
          )
        );
      }
    });
  });

  const ruleIds = new Set<string>();
  data.generationRules.globalRules.forEach((entry, index) => {
    if (ruleIds.has(entry.id)) {
      findings.push(
        finding(
          "ERROR",
          "DUPLICATE_RULE_IDENTIFIER",
          `Duplicate generation rule id "${entry.id}".`,
          `generationRules.globalRules[${index}]`
        )
      );
    }
    ruleIds.add(entry.id);
  });

  data.generationRules.stackOrderingRules.forEach((entry, index) => {
    if (!entry.priorityOrder.length) {
      findings.push(
        finding(
          "ERROR",
          "STACK_ORDER_RULE_INVALID",
          "Stack ordering rule must contain at least one prioritized technology.",
          `generationRules.stackOrderingRules[${index}]`
        )
      );
    }
  });

  const experienceRules = data.generationRules.experienceClaimRules;
  if (experienceRules.maxYearsPerSkill !== 8) {
    findings.push(
      finding(
        "WARNING",
        "EXPERIENCE_RULE_UNEXPECTED",
        "Max years per skill differs from the approved Scott-specific rule of 8.",
        "generationRules.experienceClaimRules.maxYearsPerSkill"
      )
    );
  }

  if (experienceRules.maxYearsBeyondJobRequirement !== 5) {
    findings.push(
      finding(
        "WARNING",
        "EXPERIENCE_RULE_UNEXPECTED",
        "Max years beyond job requirement differs from the approved Scott-specific rule of 5.",
        "generationRules.experienceClaimRules.maxYearsBeyondJobRequirement"
      )
    );
  }

  findings.push(
    ...collectDuplicateNameWarnings(
      data.employment.map((entry, index) => ({
        value: `${entry.employer}::${entry.roleTitle}`,
        path: `employment[${index}]`
      })),
      "DUPLICATE_EMPLOYER_ROLE",
      "employment role"
    )
  );
  findings.push(
    ...collectDuplicateNameWarnings(
      data.projects.map((entry, index) => ({
        value: entry.name,
        path: `projects[${index}]`
      })),
      "DUPLICATE_PROJECT_NAME",
      "project"
    )
  );
  findings.push(
    ...collectDuplicateNameWarnings(
      data.skills.map((entry, index) => ({
        value: entry.name,
        path: `skills[${index}]`
      })),
      "DUPLICATE_SKILL_NAME",
      "skill"
    )
  );

  return {
    success: findings.every((item) => item.severity !== "ERROR"),
    findings,
    summary: summarize(findings),
    data
  };
}

export function mergeValidationSummaries(
  ...summaries: CareerValidationSummary[]
): CareerValidationSummary {
  return summarize(summaries.flatMap((summary) => summary.findings));
}

export function assertSourceCareerKnowledge(
  value: unknown
): asserts value is SourceCareerKnowledge {
  const result = validateCareerKnowledgeSource(value);
  if (!result.success) {
    throw new Error(result.summary.blockingIssues.join("; "));
  }
}

export function assertCanonicalCareerKnowledgeContract(
  value: unknown
): asserts value is CanonicalCareerKnowledgeContract {
  const result = validateCanonicalCareerKnowledgeContract(value);
  if (!result.success) {
    throw new Error(result.summary.blockingIssues.join("; "));
  }
}
