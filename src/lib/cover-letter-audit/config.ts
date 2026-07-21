export const COVER_LETTER_AUDIT_CONTRACT_VERSION = "1.0.0";
export const COVER_LETTER_AUDIT_ENGINE_VERSION = "m8.2.0";
export const COVER_LETTER_AUDIT_CONFIGURATION_VERSION = "scott-v1";
export const COVER_LETTER_WARNING_ACKNOWLEDGEMENT =
  "I acknowledge the remaining non-blocking warnings.";

export const coverLetterAuditConfiguration = {
  targetMinWords: 250,
  warningMinWords: 180,
  targetMaxWords: 400,
  hardMaxWords: 450,
  maxParagraphs: 5,
  maxParagraphWords: 160,
  maxResumeOverlapRatio: 0.7
} as const;

