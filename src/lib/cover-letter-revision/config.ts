export const COVER_LETTER_REVISION_CONTRACT_VERSION = "1.0.0";
export const COVER_LETTER_REVISION_ENGINE_VERSION = "m8.2.0";
export const COVER_LETTER_REVISION_CONFIGURATION_VERSION = "scott-v1";

export const coverLetterRevisionConfiguration = {
  targetMinWords: 250,
  warningMinWords: 180,
  targetMaxWords: 400,
  hardMaxWords: 450,
  minParagraphs: 3,
  maxParagraphs: 5,
  hardMaxParagraphWords: 160
} as const;

