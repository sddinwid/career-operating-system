export const DOCUMENT_RENDER_CONTRACT_VERSION = "1.0.0";
export const DOCUMENT_RENDERER_VERSION = "m7.1.0";
export const DOCUMENT_TEMPLATE_VERSION = "resume-docx-v1";
export const DOCUMENT_RENDER_CONFIGURATION_VERSION = "local-first-v1";

export const documentRenderConfiguration = {
  artifactsRoot: "artifacts/documents",
  maxSummaryWordsPerParagraph: 90,
  maxSkillsPerLine: 8
} as const;
