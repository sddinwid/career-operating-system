import { DocumentFormat } from "@prisma/client";

export const DOCUMENT_RENDER_CONTRACT_VERSION = "1.1.0";
export const DOCUMENT_RENDERER_VERSION = "m7.2.0";
export const DOCUMENT_RENDER_CONFIGURATION_VERSION = "local-first-v1";

export const documentRenderConfiguration = {
  artifactsRoot: "artifacts/documents",
  maxSummaryWordsPerParagraph: 90,
  maxSkillsPerLine: 8
} as const;

export function getDocumentTemplateVersion(format: DocumentFormat) {
  switch (format) {
    case DocumentFormat.PDF:
      return "resume-pdf-v1";
    case DocumentFormat.DOCX:
      return "resume-docx-v1";
    default:
      return "resume-generic-v1";
  }
}
