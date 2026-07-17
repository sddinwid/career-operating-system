export const RESUME_REVISION_CONTRACT_VERSION = "1.0.0";
export const RESUME_REVISION_ENGINE_VERSION = "m6.1.0";
export const RESUME_REVISION_CONFIGURATION_VERSION = "scott-v1";

export const resumeRevisionConfiguration = {
  summary: {
    maxWords: 90,
    maxSentences: 4
  },
  bullet: {
    maxCharacters: 220
  },
  pageBudget: {
    warningPages: 2.0,
    blockedPages: 2.2
  },
  forbiddenCharacters: ["—"],
  leadershipTerms: ["led", "lead", "owned", "ownership", "spearheaded"],
  unsupportedOwnershipTerms: ["solely owned", "single-handedly", "personally owned"],
  sectionProfiles: {
    STANDARD_ENGINEERING: [
      "HEADER",
      "PROFESSIONAL_SUMMARY",
      "CORE_SKILLS",
      "PROFESSIONAL_EXPERIENCE",
      "SELECTED_PROJECTS",
      "EDUCATION",
      "CERTIFICATIONS"
    ],
    PROJECT_FORWARD_AI: [
      "HEADER",
      "PROFESSIONAL_SUMMARY",
      "CORE_SKILLS",
      "SELECTED_PROJECTS",
      "PROFESSIONAL_EXPERIENCE",
      "EDUCATION",
      "CERTIFICATIONS"
    ]
  }
} as const;
