export const COVER_LETTER_COMPOSITION_CONTRACT_VERSION = "1.0.0";
export const COVER_LETTER_COMPOSITION_ENGINE_VERSION = "m8.1.0";
export const COVER_LETTER_COMPOSITION_CONFIGURATION_VERSION = "scott-v1";

export const coverLetterCompositionConfiguration = {
  version: COVER_LETTER_COMPOSITION_CONFIGURATION_VERSION,
  paragraphOrder: [
    "OPENING",
    "INTEREST_AND_ALIGNMENT",
    "RELEVANT_EVIDENCE",
    "ENGINEERING_APPROACH",
    "CLOSING"
  ],
  length: {
    minWords: 250,
    maxWords: 400,
    minParagraphs: 3,
    maxParagraphs: 5,
    maxParagraphWords: 110
  },
  evidence: {
    maxPrimaryThemes: 3,
    maxNamedTechnologies: 4,
    professionalEvidencePreferred: true
  },
  references: {
    minCompanyReferences: 1,
    minRoleReferences: 1
  },
  overlap: {
    warningThreshold: 0.22
  },
  prohibitedPhrases: [
    "I am excited to apply",
    "To whom it may concern",
    "passionate about",
    "synergy"
  ],
  salutations: {
    default: "Dear Hiring Team,"
  },
  closings: [
    "I'd welcome the chance to talk through how my background could support this work.",
    "I'd be glad to discuss how I could contribute to the team in more detail."
  ]
} as const;
