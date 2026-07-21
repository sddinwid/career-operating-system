import { DocumentFormat } from "@prisma/client";

export const COVER_LETTER_RENDER_CONTRACT_VERSION = "1.0.0";
export const COVER_LETTER_DOCX_RENDERER_VERSION = "m8.3-docx.0";
export const COVER_LETTER_PDF_RENDERER_VERSION = "m8.3-pdf.0";
export const COVER_LETTER_RENDER_CONFIGURATION_VERSION = "local-first-v1";

export const coverLetterRenderConfiguration = {
  artifactsRoot: "artifacts/documents",
  pageMarginsTwips: 720,
  docxBodyFontSizeHalfPoints: 22,
  pdfBodyFontSize: 11,
  pdfLineHeight: 16,
  maxArtifactBytes: 2_000_000
} as const;

export function getCoverLetterTemplateVersion(format: DocumentFormat) {
  switch (format) {
    case DocumentFormat.DOCX:
      return "cover-letter-docx-scott-v1";
    case DocumentFormat.PDF:
      return "cover-letter-pdf-scott-v1";
    default:
      return "cover-letter-generic-v1";
  }
}

export function getCoverLetterRendererVersion(format: DocumentFormat) {
  return format === DocumentFormat.PDF
    ? COVER_LETTER_PDF_RENDERER_VERSION
    : COVER_LETTER_DOCX_RENDERER_VERSION;
}
