export const RESUME_AUDIT_CONTRACT_VERSION = "1.0.0";
export const RESUME_AUDIT_ENGINE_VERSION = "m5.3.0";
export const RESUME_AUDIT_CONFIGURATION_VERSION = "scott-v1";

export const resumeAuditConfiguration = {
  blockingRuleIds: [
    "contract.malformed-composition",
    "provenance.missing",
    "provenance.missing-source",
    "provenance.ai-suggestion",
    "truthfulness.needs-review",
    "truthfulness.prohibited",
    "truthfulness.missing-qualifier",
    "source-fidelity.mismatch",
    "experience.over-eight-years",
    "experience.over-job-cap",
    "metric.unsupported",
    "project.professional-misrepresentation",
    "certification.expired-presented-current",
    "ats.prohibited-character",
    "privacy.internal-metadata",
    "completeness.missing-role",
    "completeness.no-evidence-bullets",
    "page-budget.over-budget"
  ],
  warningRuleIds: [
    "summary.short",
    "summary.long",
    "bullet.long",
    "skills.excessive-count",
    "duplication.repeated-skill",
    "duplication.duplicate-bullet",
    "relevance.first-third",
    "page-budget.at-risk",
    "style.first-person",
    "style.prohibited-tone"
  ],
  summary: {
    minimumWords: 35,
    preferredWordsMin: 45,
    preferredWordsMax: 80,
    maximumWords: 90,
    minimumSentences: 2,
    maximumSentences: 4
  },
  bullets: {
    warningAboveWords: 35,
    errorAboveWords: 50
  },
  skills: {
    warningAboveCount: 35,
    errorAboveCount: 50
  },
  pageBudget: {
    targetPages: 2,
    maximumPages: 2
  },
  ats: {
    approvedSectionNames: [
      "Header",
      "Professional Summary",
      "Core Skills",
      "Professional Experience",
      "Selected Projects",
      "Education",
      "Certifications"
    ],
    prohibitedCharacters: ["\u2014"]
  },
  experience: {
    maxYearsPerSkill: 8,
    maxYearsBeyondJobRequirement: 5
  },
  privacy: {
    blockedTokens: ["checksum", "sourcepath", "workspaceid", "audit metadata"]
  },
  style: {
    prohibitedPhrases: ["results-driven", "guru", "rockstar", "expert", "seasoned"],
    disallowFirstPerson: true
  }
} as const;
