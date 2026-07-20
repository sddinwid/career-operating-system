import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as fontkitModule from "@pdf-lib/fontkit";
import { PDFDocument, PDFPage, rgb, type PDFFont } from "pdf-lib";
import { getDocument, GlobalWorkerOptions, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ResumeCompositionContent } from "@/lib/resume-composition/contract";

const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN_TOP = 54;
const PDF_MARGIN_RIGHT = 54;
const PDF_MARGIN_BOTTOM = 54;
const PDF_MARGIN_LEFT = 54;
const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN_LEFT - PDF_MARGIN_RIGHT;
const PDF_SECTION_SPACING = 12;
const PDF_PARAGRAPH_SPACING = 6;

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

type PdfFontFamily = Awaited<ReturnType<typeof loadPdfFontFamily>>;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatContactLine(content: ResumeCompositionContent) {
  return content.header
    .filter((entry) => entry.included && entry.field !== "NAME" && entry.value)
    .map((entry) => entry.value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" | ");
}

function formatExperienceHeading(entry: ResumeCompositionContent["professionalExperience"][number]) {
  const role = entry.roleTitle ?? "Role";
  const employer = entry.employer ? `, ${entry.employer}` : "";
  return `${role}${employer}`;
}

function formatExperienceMeta(entry: ResumeCompositionContent["professionalExperience"][number]) {
  const dates = [entry.startDate, entry.endDate].filter(Boolean).join(" - ");
  const location = entry.location?.trim();
  const workArrangement = entry.workArrangement?.trim();
  return [dates, location, workArrangement].filter(Boolean).join(" | ");
}

function formatEducation(entry: ResumeCompositionContent["education"][number]) {
  return [entry.institution, entry.degree, entry.field].filter(Boolean).join(", ");
}

function formatCertification(entry: ResumeCompositionContent["certifications"][number]) {
  return [entry.name, entry.issuer, entry.currentDisplay].filter(Boolean).join(" | ");
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

async function loadPdfFontFamily(pdfDocument: PDFDocument) {
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

  return {
    regular,
    bold,
    regularPath,
    boldPath
  };
}

function wrapText(text: string, font: PdfFontFamily["regular"], fontSize: number, maxWidth: number) {
  const words = normalizeWhitespace(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }

    let fragment = "";
    for (const character of word) {
      const next = `${fragment}${character}`;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth || !fragment) {
        fragment = next;
        continue;
      }

      lines.push(fragment);
      fragment = character;
    }
    current = fragment;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function createPdfCursor(pdfDocument: PDFDocument) {
  let page = pdfDocument.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
  let y = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP;

  return {
    getPage() {
      return page;
    },
    getY() {
      return y;
    },
    consume(height: number) {
      y -= height;
    },
    ensureSpace(height: number) {
      if (y - height >= PDF_MARGIN_BOTTOM) {
        return;
      }

      page = pdfDocument.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
      y = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP;
    }
  };
}

function drawTextLine(args: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  size: number;
  font: PDFFont;
  color?: ReturnType<typeof rgb>;
}) {
  args.page.drawText(args.text, {
    x: args.x,
    y: args.y,
    size: args.size,
    font: args.font,
    color: args.color ?? rgb(0.13, 0.13, 0.13)
  });
}

function drawWrappedBlock(args: {
  cursor: ReturnType<typeof createPdfCursor>;
  text: string;
  x: number;
  width: number;
  size: number;
  lineHeight: number;
  font: PdfFontFamily["regular"];
  color?: ReturnType<typeof rgb>;
}) {
  const lines = wrapText(args.text, args.font, args.size, args.width);
  const blockHeight = lines.length * args.lineHeight;
  args.cursor.ensureSpace(blockHeight);
  let y = args.cursor.getY();

  for (const line of lines) {
    drawTextLine({
      page: args.cursor.getPage(),
      text: line,
      x: args.x,
      y: y - args.size,
      size: args.size,
      font: args.font,
      color: args.color
    });
    y -= args.lineHeight;
  }

  args.cursor.consume(blockHeight);
}

function drawSectionHeading(args: {
  cursor: ReturnType<typeof createPdfCursor>;
  fonts: PdfFontFamily;
  text: string;
}) {
  args.cursor.ensureSpace(24);
  drawTextLine({
    page: args.cursor.getPage(),
    text: args.text,
    x: PDF_MARGIN_LEFT,
    y: args.cursor.getY() - 12,
    size: 12,
    font: args.fonts.bold,
    color: rgb(0.12, 0.12, 0.12)
  });
  args.cursor.getPage().drawLine({
    start: { x: PDF_MARGIN_LEFT, y: args.cursor.getY() - 16 },
    end: { x: PDF_MARGIN_LEFT + PDF_CONTENT_WIDTH, y: args.cursor.getY() - 16 },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7)
  });
  args.cursor.consume(24);
}

function drawBulletBlock(args: {
  cursor: ReturnType<typeof createPdfCursor>;
  text: string;
  fonts: PdfFontFamily;
}) {
  const bulletWidth = 10;
  const lineHeight = 14;
  const lines = wrapText(
    args.text,
    args.fonts.regular,
    10,
    PDF_CONTENT_WIDTH - bulletWidth - 8
  );
  const blockHeight = lines.length * lineHeight;
  args.cursor.ensureSpace(blockHeight);
  let y = args.cursor.getY();

  drawTextLine({
    page: args.cursor.getPage(),
    text: "-",
    x: PDF_MARGIN_LEFT,
    y: y - 10,
    size: 10,
    font: args.fonts.bold
  });

  for (const line of lines) {
    drawTextLine({
      page: args.cursor.getPage(),
      text: line,
      x: PDF_MARGIN_LEFT + bulletWidth + 4,
      y: y - 10,
      size: 10,
      font: args.fonts.regular
    });
    y -= lineHeight;
  }

  args.cursor.consume(blockHeight);
}

function getExpectedSnippets(content: ResumeCompositionContent) {
  const expected = new Set<string>();
  const name = content.header.find((entry) => entry.field === "NAME" && entry.included)?.value?.trim();

  if (name) {
    expected.add(name);
  }

  if (content.professionalSummary.text.trim()) {
    expected.add("Professional Summary");
    expected.add(content.professionalSummary.text.trim());
  }

  if (content.skillsGroups.length > 0) {
    expected.add("Core Skills");
    expected.add(content.skillsGroups[0]?.groupLabel ?? "");
  }

  if (content.professionalExperience.length > 0) {
    expected.add("Professional Experience");
    expected.add(formatExperienceHeading(content.professionalExperience[0]));
    if (content.professionalExperience[0]?.bullets[0]?.text) {
      expected.add(content.professionalExperience[0].bullets[0].text);
    }
  }

  if (content.selectedProjects.length > 0) {
    expected.add("Selected Projects");
    expected.add(content.selectedProjects[0]?.projectName ?? "");
  }

  if (content.education.length > 0) {
    expected.add("Education");
    expected.add(formatEducation(content.education[0]));
  }

  if (content.certifications.length > 0) {
    expected.add("Certifications");
    expected.add(formatCertification(content.certifications[0]));
  }

  return Array.from(expected).filter(Boolean);
}

function getForbiddenMetadataFragments(content: ResumeCompositionContent) {
  const candidateName =
    content.header.find((entry) => entry.field === "NAME" && entry.included)?.value?.trim() ?? "";

  return [
    "sourceEvidenceIds",
    "resumeRevisionVersionId",
    "candidate_fixture",
    "project_fixture",
    "exp_fixture",
    "I acknowledge the remaining non-blocking warnings.",
    "Shortened the summary and trimmed optional content for a tighter employer-facing pass.",
    candidateName ? `${candidateName} revised` : ""
  ].filter(Boolean);
}

export async function buildPdfResumeBuffer(content: ResumeCompositionContent) {
  const pdfDocument = await PDFDocument.create();
  const fonts = await loadPdfFontFamily(pdfDocument);
  const cursor = createPdfCursor(pdfDocument);
  const name =
    content.header.find((entry) => entry.field === "NAME" && entry.included)?.value ?? "Candidate";
  const contactLine = formatContactLine(content);

  pdfDocument.setTitle(`${content.targetCompany} ${content.targetRole} Resume`);
  pdfDocument.setSubject("Targeted resume");
  pdfDocument.setCreator("Career Operating System");
  pdfDocument.setProducer("Career Operating System");
  pdfDocument.setAuthor(name);
  pdfDocument.setCreationDate(new Date());
  pdfDocument.setModificationDate(new Date());

  const nameWidth = fonts.bold.widthOfTextAtSize(name, 22);
  drawTextLine({
    page: cursor.getPage(),
    text: name,
    x: (PDF_PAGE_WIDTH - nameWidth) / 2,
    y: cursor.getY() - 22,
    size: 22,
    font: fonts.bold
  });
  cursor.consume(30);

  if (contactLine) {
    const wrapped = wrapText(contactLine, fonts.regular, 10, PDF_CONTENT_WIDTH);
    const blockHeight = wrapped.length * 13;
    cursor.ensureSpace(blockHeight);
    let y = cursor.getY();
    for (const line of wrapped) {
      const width = fonts.regular.widthOfTextAtSize(line, 10);
      drawTextLine({
        page: cursor.getPage(),
        text: line,
        x: (PDF_PAGE_WIDTH - width) / 2,
        y: y - 10,
        size: 10,
        font: fonts.regular,
        color: rgb(0.28, 0.28, 0.28)
      });
      y -= 13;
    }
    cursor.consume(blockHeight + 8);
  }

  if (content.professionalSummary.text.trim()) {
    drawSectionHeading({ cursor, fonts, text: "Professional Summary" });
    drawWrappedBlock({
      cursor,
      text: content.professionalSummary.text.trim(),
      x: PDF_MARGIN_LEFT,
      width: PDF_CONTENT_WIDTH,
      size: 10,
      lineHeight: 14,
      font: fonts.regular
    });
    cursor.consume(PDF_PARAGRAPH_SPACING);
  }

  if (content.skillsGroups.length > 0) {
    drawSectionHeading({ cursor, fonts, text: "Core Skills" });
    for (const group of content.skillsGroups) {
      drawWrappedBlock({
        cursor,
        text: `${group.groupLabel}: ${group.skills.map((skill) => skill.displayValue).join(" | ")}`,
        x: PDF_MARGIN_LEFT,
        width: PDF_CONTENT_WIDTH,
        size: 10,
        lineHeight: 14,
        font: fonts.regular
      });
      cursor.consume(PDF_PARAGRAPH_SPACING);
    }
  }

  if (content.professionalExperience.length > 0) {
    drawSectionHeading({ cursor, fonts, text: "Professional Experience" });
    for (const entry of content.professionalExperience) {
      drawWrappedBlock({
        cursor,
        text: formatExperienceHeading(entry),
        x: PDF_MARGIN_LEFT,
        width: PDF_CONTENT_WIDTH,
        size: 10,
        lineHeight: 14,
        font: fonts.bold
      });
      const meta = formatExperienceMeta(entry);
      if (meta) {
        drawWrappedBlock({
          cursor,
          text: meta,
          x: PDF_MARGIN_LEFT,
          width: PDF_CONTENT_WIDTH,
          size: 9,
          lineHeight: 13,
          font: fonts.regular,
          color: rgb(0.35, 0.35, 0.35)
        });
      }
      for (const bullet of entry.bullets) {
        drawBulletBlock({
          cursor,
          text: bullet.text,
          fonts
        });
      }
      cursor.consume(PDF_SECTION_SPACING);
    }
  }

  if (content.selectedProjects.length > 0) {
    drawSectionHeading({ cursor, fonts, text: "Selected Projects" });
    for (const project of content.selectedProjects) {
      drawWrappedBlock({
        cursor,
        text: project.projectName,
        x: PDF_MARGIN_LEFT,
        width: PDF_CONTENT_WIDTH,
        size: 10,
        lineHeight: 14,
        font: fonts.bold
      });
      const meta = [project.contextLabel, project.role, project.projectOnlyDisclosure]
        .filter(Boolean)
        .join(" | ");
      if (meta) {
        drawWrappedBlock({
          cursor,
          text: meta,
          x: PDF_MARGIN_LEFT,
          width: PDF_CONTENT_WIDTH,
          size: 9,
          lineHeight: 13,
          font: fonts.regular,
          color: rgb(0.35, 0.35, 0.35)
        });
      }
      for (const bullet of project.bullets) {
        drawBulletBlock({
          cursor,
          text: bullet.text,
          fonts
        });
      }
      cursor.consume(PDF_SECTION_SPACING);
    }
  }

  if (content.education.length > 0) {
    drawSectionHeading({ cursor, fonts, text: "Education" });
    for (const entry of content.education) {
      drawWrappedBlock({
        cursor,
        text: formatEducation(entry),
        x: PDF_MARGIN_LEFT,
        width: PDF_CONTENT_WIDTH,
        size: 10,
        lineHeight: 14,
        font: fonts.regular
      });
      cursor.consume(PDF_PARAGRAPH_SPACING);
    }
  }

  if (content.certifications.length > 0) {
    drawSectionHeading({ cursor, fonts, text: "Certifications" });
    for (const entry of content.certifications) {
      drawWrappedBlock({
        cursor,
        text: formatCertification(entry),
        x: PDF_MARGIN_LEFT,
        width: PDF_CONTENT_WIDTH,
        size: 10,
        lineHeight: 14,
        font: fonts.regular
      });
      cursor.consume(PDF_PARAGRAPH_SPACING);
    }
  }

  return Buffer.from(
    await pdfDocument.save({
      useObjectStreams: false,
      addDefaultPage: false
    })
  );
}

export async function validatePdfResumeBuffer(
  buffer: Buffer,
  content: ResumeCompositionContent
) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    verbosity: 0
  });
  const pdf = await loadingTask.promise;
  const metadata = await pdf.getMetadata().catch(() => null);
  const extractedPages: string[] = [];
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
      textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
    );
    const operatorList = await page.getOperatorList();
    const imageOperatorCount = operatorList.fnArray.filter((operator) =>
      IMAGE_OPERATOR_CODES.has(operator)
    ).length;

    extractedPages.push(pageText);
    pageSummaries.push({
      pageNumber,
      textItemCount: textContent.items.length,
      extractedTextLength: pageText.length,
      imageOperatorCount
    });
    totalTextItemCount += textContent.items.length;
    totalImageOperatorCount += imageOperatorCount;
  }

  const extractedText = normalizeWhitespace(extractedPages.join("\n"));
  const normalizedText = extractedText.toLocaleLowerCase("en-US");
  const missingSnippets = getExpectedSnippets(content).filter(
    (snippet) => !normalizedText.includes(normalizeWhitespace(snippet).toLocaleLowerCase("en-US"))
  );
  const info = metadata?.info as Record<string, unknown> | undefined;
  const metadataInfo = {
    title: typeof info?.Title === "string" ? info.Title : null,
    author: typeof info?.Author === "string" ? info.Author : null,
    subject: typeof info?.Subject === "string" ? info.Subject : null,
    keywords: typeof info?.Keywords === "string" ? info.Keywords : null,
    creator: typeof info?.Creator === "string" ? info.Creator : null,
    producer: typeof info?.Producer === "string" ? info.Producer : null
  };
  const metadataJoined = normalizeWhitespace(
    Object.values(metadataInfo)
      .filter((value): value is string => Boolean(value))
      .join(" ")
  ).toLocaleLowerCase("en-US");
  const forbiddenMetadataLeaks = getForbiddenMetadataFragments(content).filter((fragment) =>
    metadataJoined.includes(normalizeWhitespace(fragment).toLocaleLowerCase("en-US"))
  );

  await loadingTask.destroy();

  return {
    valid:
      pdf.numPages > 0 &&
      totalTextItemCount > 0 &&
      totalImageOperatorCount === 0 &&
      missingSnippets.length === 0 &&
      forbiddenMetadataLeaks.length === 0,
    pageCount: pdf.numPages,
    totalTextItemCount,
    totalImageOperatorCount,
    extractedTextLength: extractedText.length,
    missingSnippets,
    forbiddenMetadataLeaks,
    metadata: metadataInfo,
    pageSummaries,
    extractedTextPreview: extractedText.slice(0, 240)
  };
}

export async function extractTextFromPdfBuffer(buffer: Buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    verbosity: 0
  });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    pages.push(
      normalizeWhitespace(
        textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
      )
    );
  }

  await loadingTask.destroy();
  return normalizeWhitespace(pages.join("\n"));
}
