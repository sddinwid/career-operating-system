import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  HeadingLevel,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun
} from "docx";
import {
  DocumentFormat,
  DocumentSource,
  DocumentStatus,
  DocumentType,
  DocumentRenderStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getApprovedResumeForRendering } from "@/lib/resume-rendering-approval/service";
import { getResumeRevisionVersionById } from "@/lib/resume-revision/service";
import {
  DOCUMENT_RENDER_CONFIGURATION_VERSION,
  DOCUMENT_RENDER_CONTRACT_VERSION,
  DOCUMENT_RENDERER_VERSION,
  documentRenderConfiguration,
  getDocumentTemplateVersion
} from "@/lib/document-rendering/config";
import { buildPdfResumeBuffer, validatePdfResumeBuffer } from "@/lib/document-rendering/pdf";
import type { ResumeCompositionContent } from "@/lib/resume-composition/contract";

type TransactionClient = Prisma.TransactionClient;

type RenderApprovedResumeDocumentOptions = {
  jobDescriptionVersionId: string;
  applicationId?: string | null;
  format?: DocumentFormat;
};

type PersistedDocumentVersion = Awaited<ReturnType<typeof getDocumentVersionById>>;

export class DocumentRenderingArtifactError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(args: { message: string; status: number; code: string; name: string }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.name = args.name;
  }
}

function createArtifactError(args: {
  message: string;
  status: number;
  code: string;
  name: string;
}) {
  return new DocumentRenderingArtifactError(args);
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

async function computeSha256(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function computeBufferSha256(buffer: Buffer) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(buffer));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function sanitizeFilenameSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60) || "resume";
}

function buildDocumentTitle(content: ResumeCompositionContent) {
  return `${content.targetCompany} ${content.targetRole} Resume`;
}

function buildOriginalFilename(
  content: ResumeCompositionContent,
  versionNumber: number,
  format: DocumentFormat
) {
  const name = content.header.find((entry) => entry.field === "NAME" && entry.included)?.value ?? "Candidate";
  const extension = format === DocumentFormat.PDF ? "pdf" : "docx";
  return `${sanitizeFilenameSegment(name)}_${sanitizeFilenameSegment(content.targetCompany)}_${sanitizeFilenameSegment(content.targetRole)}_Resume_v${versionNumber}.${extension}`;
}

function buildStoredFilename(documentVersionId: string, format: DocumentFormat) {
  const extension = format === DocumentFormat.PDF ? "pdf" : "docx";
  return `${documentVersionId}.${extension}`;
}

export function toSafeDownloadFilename(filename: string) {
  const [basename, extension = ""] = filename.split(/\.(?=[^.]+$)/);
  const safeBase = sanitizeFilenameSegment(basename);
  const safeExtension = extension.replace(/[^\w]/g, "").toLowerCase();
  return safeExtension ? `${safeBase}.${safeExtension}` : safeBase;
}

export function buildContentDisposition(filename: string) {
  const safeFilename = toSafeDownloadFilename(filename);
  return `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`;
}

function buildStoragePath(workspaceId: string, documentId: string, storedFilename: string) {
  return path.posix.join(
    documentRenderConfiguration.artifactsRoot,
    workspaceId,
    documentId,
    storedFilename
  );
}

function resolveAbsoluteStoragePath(storagePath: string) {
  return path.resolve(env.LOCAL_DATA_DIR, storagePath);
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

function buildDocx(content: ResumeCompositionContent) {
  const name = content.header.find((entry) => entry.field === "NAME" && entry.included)?.value ?? "Candidate";
  const contactLine = formatContactLine(content);
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: name,
          bold: true,
          size: 30
        })
      ]
    })
  ];

  if (contactLine) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 220 },
        children: [new TextRun({ text: contactLine, size: 20 })]
      })
    );
  }

  const sectionHeading = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 180, after: 80 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          color: "7C6F64",
          size: 3
        }
      },
      children: [new TextRun({ text, bold: true, size: 24 })]
    });

  if (content.professionalSummary.text.trim()) {
    children.push(sectionHeading("Professional Summary"));
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: content.professionalSummary.text.trim(), size: 22 })]
      })
    );
  }

  if (content.skillsGroups.length > 0) {
    children.push(sectionHeading("Core Skills"));
    for (const group of content.skillsGroups) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${group.groupLabel}: `, bold: true, size: 22 }),
            new TextRun({
              text: group.skills
                .slice(0, Math.min(group.skills.length, documentRenderConfiguration.maxSkillsPerLine))
                .map((skill) => skill.displayValue)
                .join(" | "),
              size: 22
            })
          ]
        })
      );
    }
  }

  if (content.professionalExperience.length > 0) {
    children.push(sectionHeading("Professional Experience"));
    for (const entry of content.professionalExperience) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 20 },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: [
            new TextRun({ text: formatExperienceHeading(entry), bold: true, size: 22 })
          ]
        })
      );

      const meta = formatExperienceMeta(entry);
      if (meta) {
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: meta, italics: true, size: 20 })]
          })
        );
      }

      for (const bullet of entry.bullets) {
        children.push(
          new Paragraph({
            text: bullet.text,
            bullet: { level: 0 },
            spacing: { after: 40 }
          })
        );
      }
    }
  }

  if (content.selectedProjects.length > 0) {
    children.push(sectionHeading("Selected Projects"));
    for (const project of content.selectedProjects) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 20 },
          children: [new TextRun({ text: project.projectName, bold: true, size: 22 })]
        })
      );
      const projectMeta = [project.contextLabel, project.role, project.projectOnlyDisclosure]
        .filter(Boolean)
        .join(" | ");
      if (projectMeta) {
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: projectMeta, italics: true, size: 20 })]
          })
        );
      }
      for (const bullet of project.bullets) {
        children.push(
          new Paragraph({
            text: bullet.text,
            bullet: { level: 0 },
            spacing: { after: 40 }
          })
        );
      }
    }
  }

  if (content.education.length > 0) {
    children.push(sectionHeading("Education"));
    for (const entry of content.education) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: formatEducation(entry), size: 22 })]
        })
      );
    }
  }

  if (content.certifications.length > 0) {
    children.push(sectionHeading("Certifications"));
    for (const entry of content.certifications) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: formatCertification(entry), size: 22 })]
        })
      );
    }
  }

  return new DocxDocument({
    creator: "Career Operating System",
    description: buildDocumentTitle(content),
    title: buildDocumentTitle(content),
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720
            }
          }
        },
        children
      }
    ]
  });
}

async function validateDocxBuffer(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const requiredEntries = ["[Content_Types].xml", "_rels/.rels", "word/document.xml"];
  const entries = Object.keys(zip.files).sort();
  const missingEntries = requiredEntries.filter((entry) => !zip.files[entry]);
  const documentXml = await zip.file("word/document.xml")?.async("string");

  return {
    valid: missingEntries.length === 0 && Boolean(documentXml),
    requiredEntries,
    missingEntries,
    entries,
    documentXmlLength: documentXml?.length ?? 0
  };
}

async function renderResumeBuffer(content: ResumeCompositionContent) {
  return Packer.toBuffer(buildDocx(content));
}

async function renderPdfBuffer(content: ResumeCompositionContent) {
  return buildPdfResumeBuffer(content);
}

async function computeRenderInputChecksum(args: {
  approvalId: string;
  auditId: string;
  sourceType: string;
  sourceId: string;
  contentChecksum: string;
  format: DocumentFormat;
}) {
  const templateVersion = getDocumentTemplateVersion(args.format);
  return computeSha256(
    stableSerialize({
      approvalId: args.approvalId,
      auditId: args.auditId,
      sourceType: args.sourceType,
      sourceId: args.sourceId,
      contentChecksum: args.contentChecksum,
      format: args.format,
      renderContractVersion: DOCUMENT_RENDER_CONTRACT_VERSION,
      rendererVersion: DOCUMENT_RENDERER_VERSION,
      templateVersion,
      configurationVersion: DOCUMENT_RENDER_CONFIGURATION_VERSION,
      configuration: documentRenderConfiguration
    })
  );
}

async function getOrCreateDocumentRecord(args: {
  transaction: TransactionClient;
  workspaceId: string;
  applicationId: string | null;
  jobDescriptionVersionId: string;
  title: string;
}) {
  const existing = await args.transaction.document.findFirst({
    where: {
      workspaceId: args.workspaceId,
      applicationId: args.applicationId,
      jobDescriptionVersionId: args.jobDescriptionVersionId,
      type: DocumentType.RESUME,
      title: args.title
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });

  if (existing) {
    return args.transaction.document.update({
      where: { id: existing.id },
      data: {
        status: DocumentStatus.REVIEWED
      }
    });
  }

  return args.transaction.document.create({
    data: {
      id: randomUUID(),
      workspaceId: args.workspaceId,
      applicationId: args.applicationId,
      jobDescriptionVersionId: args.jobDescriptionVersionId,
      type: DocumentType.RESUME,
      title: args.title,
      status: DocumentStatus.REVIEWED
    }
  });
}

export async function getDocumentVersionById(
  workspaceId: string,
  documentVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.documentVersion.findFirst({
    where: {
      id: documentVersionId,
      workspaceId
    },
    include: {
      application: {
        select: {
          id: true
        }
      },
      document: {
        include: {
          versions: {
            select: {
              id: true,
              versionNumber: true,
              format: true,
              generatedAt: true,
              renderStatus: true,
              sizeBytes: true
            },
            orderBy: [{ versionNumber: "desc" }, { generatedAt: "desc" }, { id: "desc" }]
          }
        }
      },
      jobDescriptionVersion: {
        include: {
          opportunity: {
            include: {
              company: true
            }
          }
        }
      },
      coverLetterApproval: true,
      coverLetterAuditRun: true,
      coverLetterCompositionVersion: true,
      coverLetterRevisionVersion: true,
      resumeRenderingApproval: true,
      resumeAuditRun: true,
      resumeCompositionVersion: true,
      resumeRevisionVersion: true
    }
  });
}

export async function getLatestRenderedResumeDocumentVersion(
  workspaceId: string,
  args: {
    jobDescriptionVersionId: string;
    applicationId?: string | null;
    format?: DocumentFormat;
  },
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.documentVersion.findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId: args.jobDescriptionVersionId,
      applicationId: args.applicationId ?? null,
      ...(args.format ? { format: args.format } : {}),
      document: {
        type: DocumentType.RESUME
      },
      renderStatus: {
        in: [DocumentRenderStatus.SUCCESS, DocumentRenderStatus.SUCCESS_WITH_WARNINGS]
      }
    },
    include: {
      document: true
    },
    orderBy: [{ generatedAt: "desc" }, { id: "desc" }]
  });
}

export async function readDocumentVersionFile(
  workspaceId: string,
  documentVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const version = await getDocumentVersionById(workspaceId, documentVersionId, prismaClient);

  if (!version) {
    throw createArtifactError({
      message: "Document version not found.",
      status: 404,
      code: "DOCUMENT_VERSION_NOT_FOUND",
      name: "DocumentVersionNotFoundError"
    });
  }

  if (
    version.renderStatus !== DocumentRenderStatus.SUCCESS &&
    version.renderStatus !== DocumentRenderStatus.SUCCESS_WITH_WARNINGS
  ) {
    throw createArtifactError({
      message: "Only successfully rendered document versions can be downloaded.",
      status: 409,
      code: "DOCUMENT_VERSION_NOT_READY",
      name: "DocumentVersionNotReadyError"
    });
  }

  const absolutePath = resolveAbsoluteStoragePath(version.storagePath);
  let buffer: Buffer;

  try {
    buffer = await fs.readFile(absolutePath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      throw createArtifactError({
        message: "The rendered document file is missing from local storage.",
        status: 410,
        code: "DOCUMENT_FILE_MISSING",
        name: "DocumentFileMissingError"
      });
    }

    throw error;
  }

  if (buffer.byteLength !== version.sizeBytes) {
    throw createArtifactError({
      message: "The rendered document size no longer matches the persisted metadata.",
      status: 409,
      code: "DOCUMENT_SIZE_MISMATCH",
      name: "DocumentSizeMismatchError"
    });
  }

  const checksum = await computeBufferSha256(buffer);

  if (checksum !== version.checksum) {
    throw createArtifactError({
      message: "The rendered document checksum no longer matches the persisted metadata.",
      status: 409,
      code: "DOCUMENT_CHECKSUM_MISMATCH",
      name: "DocumentChecksumMismatchError"
    });
  }

  return {
    version,
    buffer,
    absolutePath
  };
}

export async function renderApprovedResumeDocument(
  workspaceId: string,
  options: RenderApprovedResumeDocumentOptions,
  prismaClient: PrismaClient = prisma
) {
  const format = options.format ?? DocumentFormat.DOCX;
  const templateVersion = getDocumentTemplateVersion(format);
  const approved = await getApprovedResumeForRendering(workspaceId, {
    jobDescriptionVersionId: options.jobDescriptionVersionId,
    applicationId: options.applicationId ?? undefined
  });

  const renderInputChecksum = await computeRenderInputChecksum({
    approvalId: approved.approval.approvalId,
    auditId: approved.auditId,
    sourceType: approved.sourceType,
    sourceId: approved.sourceId,
    contentChecksum: approved.contentChecksum,
    format
  });

  const duplicate = await prismaClient.documentVersion.findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId: options.jobDescriptionVersionId,
      applicationId: options.applicationId ?? null,
      format,
      renderInputChecksum,
      renderStatus: {
        in: [DocumentRenderStatus.SUCCESS, DocumentRenderStatus.SUCCESS_WITH_WARNINGS]
      }
    },
    include: {
      document: true
    },
    orderBy: [{ generatedAt: "desc" }, { id: "desc" }]
  });

  if (duplicate) {
    return {
      duplicate: true,
      documentVersion: duplicate
    };
  }

  const revision =
    approved.sourceType === "FINALIZED_REVISION"
      ? await getResumeRevisionVersionById(workspaceId, approved.sourceId, prismaClient)
      : null;

  const buffer =
    format === DocumentFormat.PDF
      ? await renderPdfBuffer(approved.content)
      : await renderResumeBuffer(approved.content);
  const validationSummary =
    format === DocumentFormat.PDF
      ? await validatePdfResumeBuffer(buffer, approved.content)
      : await validateDocxBuffer(buffer);

  if (!validationSummary.valid) {
    throw new Error(`Rendered ${format} validation failed.`);
  }

  const checksum = await computeBufferSha256(buffer);

  let persistedDocumentVersion: PersistedDocumentVersion = null;
  let absolutePath = "";

  try {
    persistedDocumentVersion = await prismaClient.$transaction(async (transaction) => {
      const document = await getOrCreateDocumentRecord({
        transaction,
        workspaceId,
        applicationId: approved.approval.applicationId,
        jobDescriptionVersionId: approved.approval.jobDescriptionVersionId,
        title: buildDocumentTitle(approved.content)
      });

      const latestVersion = await transaction.documentVersion.findFirst({
        where: {
          documentId: document.id
        },
        orderBy: [{ versionNumber: "desc" }, { generatedAt: "desc" }, { id: "desc" }]
      });

      const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;
      const documentVersionId = randomUUID();
      const storedFilename = buildStoredFilename(documentVersionId, format);
      const storagePath = buildStoragePath(workspaceId, document.id, storedFilename);
      absolutePath = resolveAbsoluteStoragePath(storagePath);

      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, buffer);

      await transaction.documentVersion.create({
        data: {
          id: documentVersionId,
          documentId: document.id,
          workspaceId,
          applicationId: approved.approval.applicationId,
          jobDescriptionVersionId: approved.approval.jobDescriptionVersionId,
          resumeRenderingApprovalId: approved.approval.approvalId,
          resumeAuditRunId: approved.auditId,
          resumeCompositionVersionId:
            approved.approval.resumeCompositionVersionId ??
            (approved.sourceType === "BASE_COMPOSITION" ? approved.sourceId : revision?.baseResumeCompositionVersionId ?? ""),
          resumeRevisionVersionId: approved.approval.resumeRevisionVersionId,
          versionNumber,
          format,
          originalFilename: buildOriginalFilename(approved.content, versionNumber, format),
          storedFilename,
          storagePath,
          mimeType:
            format === DocumentFormat.PDF
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          sizeBytes: buffer.byteLength,
          checksum,
          source: DocumentSource.GENERATED,
          renderStatus:
            approved.renderingReadiness === "READY_WITH_WARNINGS"
              ? DocumentRenderStatus.SUCCESS_WITH_WARNINGS
              : DocumentRenderStatus.SUCCESS,
          renderContractVersion: DOCUMENT_RENDER_CONTRACT_VERSION,
          rendererVersion: DOCUMENT_RENDERER_VERSION,
          templateVersion,
          configurationVersion: DOCUMENT_RENDER_CONFIGURATION_VERSION,
          renderInputChecksum,
          warningCount: approved.audit.summary.warningCount,
          validationSummary: validationSummary as Prisma.InputJsonValue,
          metadata: {
            sourceType: approved.sourceType,
            sourceId: approved.sourceId,
            contentChecksum: approved.contentChecksum,
            format,
            renderingReadiness: approved.renderingReadiness,
            sectionOrder: approved.content.finalSectionOrder,
            estimatedPageCount: approved.content.summary.estimatedPageCount,
            targetCompany: approved.content.targetCompany,
            targetRole: approved.content.targetRole,
            resumeRevisionVersionId: revision?.id ?? null
          } as Prisma.InputJsonValue
        }
      });

      return getDocumentVersionById(workspaceId, documentVersionId, transaction);
    });
  } catch (error) {
    if (absolutePath) {
      await fs.rm(absolutePath, { force: true }).catch(() => undefined);
    }
    throw error;
  }

  return {
    duplicate: false,
    documentVersion: persistedDocumentVersion
  };
}
