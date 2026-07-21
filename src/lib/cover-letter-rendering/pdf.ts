import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as fontkitModule from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { getDocument, GlobalWorkerOptions, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { coverLetterRenderConfiguration } from "@/lib/cover-letter-rendering/config";
import type { CoverLetterRenderModel } from "@/lib/cover-letter-rendering/contract";

const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN = 54;
const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;

const STANDARD_FONT_DATA_URL = `${pathToFileURL(
  path.resolve(process.cwd(), "node_modules/pdfjs-dist/standard_fonts")
).href}/`;
const PDF_WORKER_SRC = pathToFileURL(
  path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
).href;

const IMAGE_OPERATOR_CODES = new Set<number>([
  OPS.paintImageXObject,
  OPS.paintImageMaskXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageMaskXObjectGroup,
  OPS.paintInlineImageXObjectGroup,
  OPS.paintImageXObjectRepeat,
  OPS.paintImageMaskXObjectRepeat,
  OPS.paintSolidColorImageMask
]);

const fontkit = "default" in fontkitModule ? fontkitModule.default : fontkitModule;
GlobalWorkerOptions.workerSrc = PDF_WORKER_SRC;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function findFirstExistingPath(paths: string[]) {
  for (const candidate of paths) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

async function loadFontFamily(pdfDocument: PDFDocument) {
  const regularPath = await findFirstExistingPath([
    path.resolve(process.cwd(), "assets/fonts/NotoSans-Regular.ttf"),
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf"
  ]);

  if (!regularPath) {
    throw new Error("A Unicode-capable PDF font could not be found for deterministic rendering.");
  }

  const boldPath =
    (await findFirstExistingPath([
      path.resolve(process.cwd(), "assets/fonts/NotoSans-Bold.ttf"),
      "C:/Windows/Fonts/arialbd.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
    ])) ?? regularPath;

  pdfDocument.registerFontkit(fontkit as Parameters<PDFDocument["registerFontkit"]>[0]);
  const [regularBytes, boldBytes] = await Promise.all([
    fs.readFile(regularPath),
    fs.readFile(boldPath)
  ]);

  const [regular, bold] = await Promise.all([
    pdfDocument.embedFont(Uint8Array.from(regularBytes), { subset: true }),
    pdfDocument.embedFont(Uint8Array.from(boldBytes), { subset: true })
  ]);

  return { regular, bold };
}

function wrapText(text: string, font: Awaited<ReturnType<typeof loadFontFamily>>["regular"], size: number, width: number) {
  const words = normalizeWhitespace(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export async function buildCoverLetterPdfBuffer(model: CoverLetterRenderModel) {
  const pdfDocument = await PDFDocument.create();
  const page = pdfDocument.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
  const fonts = await loadFontFamily(pdfDocument);
  const textColor = rgb(0.13, 0.13, 0.13);
  const mutedColor = rgb(0.32, 0.32, 0.32);
  let y = PDF_PAGE_HEIGHT - PDF_MARGIN;

  function drawBlock(text: string, size: number, font: typeof fonts.regular, spacingAfter: number, color = textColor) {
    const lines = wrapText(text, font, size, PDF_CONTENT_WIDTH);
    const height = lines.length * coverLetterRenderConfiguration.pdfLineHeight;
    if (y - height < PDF_MARGIN) {
      throw new Error("Cover-letter PDF overflowed the one-page layout.");
    }
    for (const line of lines) {
      page.drawText(line, {
        x: PDF_MARGIN,
        y: y - size,
        size,
        font,
        color
      });
      y -= coverLetterRenderConfiguration.pdfLineHeight;
    }
    y -= spacingAfter;
  }

  pdfDocument.setTitle(`${model.company} ${model.role} Cover Letter`);
  pdfDocument.setSubject("Approved cover letter");
  pdfDocument.setCreator("Career Operating System");
  pdfDocument.setProducer("Career Operating System");
  pdfDocument.setAuthor(model.candidateName);
  pdfDocument.setCreationDate(new Date(model.date));
  pdfDocument.setModificationDate(new Date(model.date));

  drawBlock(model.candidateName, 16, fonts.bold, 6);
  const contactLine = [model.email, model.phone, model.location].filter(Boolean).join(" | ");
  if (contactLine) {
    drawBlock(contactLine, 10, fonts.regular, 10, mutedColor);
  }
  drawBlock(model.date, 11, fonts.regular, 8);
  drawBlock(model.company, 11, fonts.regular, 2);
  drawBlock(model.role, 11, fonts.regular, 14);
  drawBlock(model.salutation, 11, fonts.regular, 10);
  for (const paragraph of model.paragraphs) {
    drawBlock(paragraph, 11, fonts.regular, 10);
  }
  drawBlock(model.closing, 11, fonts.regular, 10);
  drawBlock(model.signatureName, 11, fonts.regular, 0);

  return Buffer.from(
    await pdfDocument.save({
      useObjectStreams: false,
      addDefaultPage: false
    })
  );
}

export async function validateCoverLetterPdfBuffer(buffer: Buffer, model: CoverLetterRenderModel) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    verbosity: 0
  });
  const pdf = await loadingTask.promise;
  const metadata = await pdf.getMetadata().catch(() => null);
  const pages: string[] = [];
  const pageSummaries: Array<{
    pageNumber: number;
    textItemCount: number;
    extractedTextLength: number;
    imageOperatorCount: number;
  }> = [];
  let totalTextItemCount = 0;
  let totalImageOperatorCount = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = normalizeWhitespace(
      textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ")
    );
    const operatorList = await page.getOperatorList();
    const imageOperatorCount = operatorList.fnArray.filter((operator) =>
      IMAGE_OPERATOR_CODES.has(operator)
    ).length;

    pages.push(pageText);
    pageSummaries.push({
      pageNumber,
      textItemCount: textContent.items.length,
      extractedTextLength: pageText.length,
      imageOperatorCount
    });
    totalTextItemCount += textContent.items.length;
    totalImageOperatorCount += imageOperatorCount;
  }

  const extractedText = normalizeWhitespace(pages.join("\n"));
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
  const info = metadata?.info as Record<string, unknown> | undefined;
  const metadataInfo = {
    title: typeof info?.Title === "string" ? info.Title : null,
    author: typeof info?.Author === "string" ? info.Author : null,
    subject: typeof info?.Subject === "string" ? info.Subject : null,
    creator: typeof info?.Creator === "string" ? info.Creator : null,
    producer: typeof info?.Producer === "string" ? info.Producer : null
  };

  await loadingTask.destroy();

  return {
    valid:
      pdf.numPages === 1 &&
      totalTextItemCount > 0 &&
      totalImageOperatorCount === 0 &&
      missingSnippets.length === 0 &&
      forbiddenFragments.length === 0 &&
      !leakedUuid &&
      buffer.byteLength <= coverLetterRenderConfiguration.maxArtifactBytes,
    pageCount: pdf.numPages,
    totalTextItemCount,
    totalImageOperatorCount,
    extractedTextLength: extractedText.length,
    missingSnippets,
    forbiddenFragments,
    leakedUuid,
    metadata: metadataInfo,
    pageSummaries,
    extractedTextPreview: extractedText.slice(0, 240)
  };
}
