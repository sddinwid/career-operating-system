import JSZip from "jszip";
import {
  AlignmentType,
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun
} from "docx";
import { coverLetterRenderConfiguration } from "@/lib/cover-letter-rendering/config";
import type { CoverLetterRenderModel } from "@/lib/cover-letter-rendering/contract";

function xmlDecode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractDocxText(documentXml: string) {
  return normalizeWhitespace(
    Array.from(documentXml.matchAll(/<w:t[^>]*>(.*?)<\/w:t>/g))
      .map((match) => xmlDecode(match[1] ?? ""))
      .join(" ")
  );
}

export function buildCoverLetterDocxDocument(model: CoverLetterRenderModel) {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 120 },
      children: [new TextRun({ text: model.candidateName, bold: true, size: 28 })]
    })
  ];

  const contactLine = [model.email, model.phone, model.location].filter(Boolean).join(" | ");
  if (contactLine) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: contactLine,
            size: coverLetterRenderConfiguration.docxBodyFontSizeHalfPoints
          })
        ]
      })
    );
  }

  paragraphs.push(
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: model.date,
          size: coverLetterRenderConfiguration.docxBodyFontSizeHalfPoints
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: model.company,
          size: coverLetterRenderConfiguration.docxBodyFontSizeHalfPoints
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: model.role,
          size: coverLetterRenderConfiguration.docxBodyFontSizeHalfPoints
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 160 },
      children: [
        new TextRun({
          text: model.salutation,
          size: coverLetterRenderConfiguration.docxBodyFontSizeHalfPoints
        })
      ]
    })
  );

  for (const paragraph of model.paragraphs) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: paragraph,
            size: coverLetterRenderConfiguration.docxBodyFontSizeHalfPoints
          })
        ]
      })
    );
  }

  paragraphs.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: model.closing,
          size: coverLetterRenderConfiguration.docxBodyFontSizeHalfPoints
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 0 },
      children: [
        new TextRun({
          text: model.signatureName,
          size: coverLetterRenderConfiguration.docxBodyFontSizeHalfPoints
        })
      ]
    })
  );

  return new DocxDocument({
    creator: "Career Operating System",
    title: `${model.company} ${model.role} Cover Letter`,
    description: "Approved cover letter",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: coverLetterRenderConfiguration.pageMarginsTwips,
              right: coverLetterRenderConfiguration.pageMarginsTwips,
              bottom: coverLetterRenderConfiguration.pageMarginsTwips,
              left: coverLetterRenderConfiguration.pageMarginsTwips
            }
          }
        },
        children: paragraphs
      }
    ]
  });
}

export async function buildCoverLetterDocxBuffer(model: CoverLetterRenderModel) {
  return Packer.toBuffer(buildCoverLetterDocxDocument(model));
}

export async function validateCoverLetterDocxBuffer(
  buffer: Buffer,
  model: CoverLetterRenderModel
) {
  const requiredEntries = ["[Content_Types].xml", "_rels/.rels", "word/document.xml"];
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.keys(zip.files).sort();
  const missingEntries = requiredEntries.filter((entry) => !zip.files[entry]);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  const extractedText = documentXml ? extractDocxText(documentXml) : "";
  const normalizedText = extractedText.toLocaleLowerCase("en-US");
  const missingSnippets = model.expectedSnippets.filter(
    (snippet) => !normalizedText.includes(normalizeWhitespace(snippet).toLocaleLowerCase("en-US"))
  );
  const forbiddenFragments = model.internalMarkers.filter((fragment) =>
    normalizedText.includes(normalizeWhitespace(fragment).toLocaleLowerCase("en-US"))
  );
  const leakedUuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(
    extractedText
  );

  return {
    valid:
      missingEntries.length === 0 &&
      Boolean(documentXml) &&
      missingSnippets.length === 0 &&
      forbiddenFragments.length === 0 &&
      !leakedUuid &&
      buffer.byteLength <= coverLetterRenderConfiguration.maxArtifactBytes,
    requiredEntries,
    missingEntries,
    entries,
    documentXmlLength: documentXml?.length ?? 0,
    extractedTextLength: extractedText.length,
    missingSnippets,
    forbiddenFragments,
    leakedUuid,
    extractedTextPreview: extractedText.slice(0, 240)
  };
}
