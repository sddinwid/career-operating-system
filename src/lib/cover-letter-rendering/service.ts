import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DocumentFormat,
  DocumentRenderStatus,
  DocumentSource,
  DocumentStatus,
  DocumentType,
  Prisma,
  type PrismaClient
} from "@prisma/client";
import { parseStoredCoverLetterAuditRun } from "@/lib/cover-letter-audit/service";
import { getActiveCoverLetterApproval } from "@/lib/cover-letter-approval/service";
import { parseStoredCoverLetterCompositionVersion } from "@/lib/cover-letter-composition/service";
import {
  COVER_LETTER_RENDER_CONFIGURATION_VERSION,
  COVER_LETTER_RENDER_CONTRACT_VERSION,
  coverLetterRenderConfiguration,
  getCoverLetterRendererVersion,
  getCoverLetterTemplateVersion
} from "@/lib/cover-letter-rendering/config";
import {
  coverLetterRenderModelSchema,
  type CoverLetterRenderModel
} from "@/lib/cover-letter-rendering/contract";
import {
  buildCoverLetterDocxBuffer,
  validateCoverLetterDocxBuffer
} from "@/lib/cover-letter-rendering/docx";
import {
  buildCoverLetterPdfBuffer,
  validateCoverLetterPdfBuffer
} from "@/lib/cover-letter-rendering/pdf";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { parseStoredCoverLetterRevisionVersion } from "@/lib/cover-letter-revision/service";

type TransactionClient = Prisma.TransactionClient;

type RenderApprovedCoverLetterDocumentOptions = {
  jobDescriptionVersionId: string;
  applicationId?: string | null;
  format?: DocumentFormat;
};

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
    .slice(0, 60) || "cover_letter";
}

function buildDocumentTitle(model: CoverLetterRenderModel) {
  return `${model.company} ${model.role} Cover Letter`;
}

function buildOriginalFilename(model: CoverLetterRenderModel, format: DocumentFormat) {
  const extension = format === DocumentFormat.PDF ? "pdf" : "docx";
  return `${sanitizeFilenameSegment(model.signatureName)}_${sanitizeFilenameSegment(model.company)}_${sanitizeFilenameSegment(model.role)}_Cover_Letter.${extension}`;
}

function buildStoredFilename(documentVersionId: string, format: DocumentFormat) {
  return `${documentVersionId}.${format === DocumentFormat.PDF ? "pdf" : "docx"}`;
}

function buildStoragePath(workspaceId: string, documentId: string, documentVersionId: string, format: DocumentFormat) {
  return path.posix.join(
    coverLetterRenderConfiguration.artifactsRoot,
    workspaceId,
    "cover-letters",
    documentId,
    documentVersionId,
    buildStoredFilename(documentVersionId, format)
  );
}

function resolveAbsoluteStoragePath(storagePath: string) {
  return path.resolve(env.LOCAL_DATA_DIR, storagePath);
}

async function writeFileAtomically(absolutePath: string, buffer: Buffer) {
  const directory = path.dirname(absolutePath);
  await fs.mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `${path.basename(absolutePath)}.${randomUUID()}.tmp`);
  await fs.writeFile(temporaryPath, buffer);
  await fs.rename(temporaryPath, absolutePath);
}

function uniqueMarkers(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  );
}

export async function getApprovedCoverLetterForRendering(
  workspaceId: string,
  options: { jobDescriptionVersionId: string; applicationId?: string | null },
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const approval = await getActiveCoverLetterApproval(
    workspaceId,
    {
      jobDescriptionVersionId: options.jobDescriptionVersionId,
      applicationId: options.applicationId ?? null
    },
    prismaClient
  );

  if (!approval || approval.status !== "APPROVED") {
    throw new Error("An active approved cover letter is required before rendering.");
  }

  if (
    options.applicationId !== undefined &&
    (options.applicationId ?? null) !== approval.applicationId
  ) {
    throw new Error("The active approved cover letter does not match the requested application.");
  }

  const audit = await parseStoredCoverLetterAuditRun(
    workspaceId,
    approval.coverLetterAuditRunId,
    prismaClient
  );

  if (
    audit.run.jobDescriptionVersionId !== approval.jobDescriptionVersionId ||
    audit.run.applicationId !== approval.applicationId ||
    audit.result.renderingReadiness === "BLOCKED" ||
    audit.result.renderingReadiness === "NEEDS_REVIEW" ||
    audit.result.summary.blockingFindingCount > 0
  ) {
    throw new Error("The approved cover letter no longer satisfies the rendering gate.");
  }

  if (approval.sourceType === "BASE_COMPOSITION") {
    const composition = await parseStoredCoverLetterCompositionVersion(
      workspaceId,
      approval.coverLetterCompositionVersionId,
      prismaClient
    );

    if (
      audit.run.sourceType !== "BASE_COMPOSITION" ||
      audit.run.coverLetterCompositionVersionId !== composition.version.id ||
      audit.run.coverLetterRevisionVersionId !== null
    ) {
      throw new Error("The approved cover-letter audit does not match the approved base composition.");
    }

    const model = coverLetterRenderModelSchema.parse({
      candidateName: composition.content.candidateName,
      email: composition.content.header.email,
      phone: composition.content.header.phone,
      location: composition.content.header.location,
      date: composition.content.header.date,
      company: composition.content.header.company,
      role: composition.content.header.role,
      salutation: composition.content.header.salutation,
      paragraphs: composition.content.paragraphs.map((paragraph) => paragraph.text),
      closing: composition.content.closing,
      signatureName: composition.content.candidateName,
      sourceType: approval.sourceType,
      coverLetterCompositionVersionId: composition.version.id,
      coverLetterRevisionVersionId: null,
      coverLetterAuditRunId: approval.coverLetterAuditRunId,
      coverLetterApprovalId: approval.approvalId,
      applicationId: approval.applicationId,
      jobDescriptionVersionId: approval.jobDescriptionVersionId,
      jobOpportunityId: approval.jobOpportunityId,
      contentChecksum: approval.contentChecksum,
      approvalStatus: approval.status,
      warningCount: approval.warningCount,
      renderingReadiness: approval.renderingReadiness,
      internalMarkers: uniqueMarkers([
        approval.approvalId,
        approval.coverLetterAuditRunId,
        composition.version.id,
        ...composition.content.provenance.overallEvidenceIds,
        ...composition.content.provenance.overallRequirementIds,
        ...composition.content.provenance.overallCareerRecordIds,
        ...composition.content.paragraphs.flatMap((paragraph) => [
          paragraph.id,
          ...paragraph.supportingEvidenceIds,
          ...paragraph.supportingRequirementIds,
          ...paragraph.supportingMatchReportConclusionIds,
          ...paragraph.sourceCareerRecordIds,
          ...paragraph.sourceResumeSectionIds,
          ...paragraph.acknowledgements
        ]),
        "approval acknowledgement",
        "evidence ids",
        "requirement ids"
      ]),
      expectedSnippets: uniqueMarkers([
        composition.content.candidateName,
        composition.content.header.company,
        composition.content.header.role,
        composition.content.header.salutation,
        composition.content.closing,
        ...composition.content.paragraphs.map((paragraph) => paragraph.text)
      ])
    });

    return {
      approval,
      audit,
      model,
      sourceId: composition.version.id,
      sourceType: approval.sourceType
    };
  }

  const revision = await parseStoredCoverLetterRevisionVersion(workspaceId, approval.sourceId, prismaClient);
  if (revision.version.status !== "FINALIZED") {
    throw new Error("Only finalized cover-letter revisions may render.");
  }

  if (
    audit.run.sourceType !== "FINALIZED_REVISION" ||
    audit.run.coverLetterRevisionVersionId !== revision.version.id
  ) {
    throw new Error("The approved cover-letter audit does not match the approved finalized revision.");
  }

  const orderedParagraphs = revision.record.content.paragraphs
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((paragraph) => paragraph.currentText);

  const model = coverLetterRenderModelSchema.parse({
    candidateName: revision.record.content.candidateName,
    email: revision.record.content.header.email,
    phone: revision.record.content.header.phone,
    location: revision.record.content.header.location,
    date: revision.record.content.header.date,
    company: revision.record.content.header.company,
    role: revision.record.content.header.role,
    salutation: revision.record.content.salutation,
    paragraphs: orderedParagraphs,
    closing: revision.record.content.closing,
    signatureName: revision.record.content.candidateName,
    sourceType: approval.sourceType,
    coverLetterCompositionVersionId: approval.coverLetterCompositionVersionId,
    coverLetterRevisionVersionId: revision.version.id,
    coverLetterAuditRunId: approval.coverLetterAuditRunId,
    coverLetterApprovalId: approval.approvalId,
    applicationId: approval.applicationId,
    jobDescriptionVersionId: approval.jobDescriptionVersionId,
    jobOpportunityId: approval.jobOpportunityId,
    contentChecksum: approval.contentChecksum,
    approvalStatus: approval.status,
    warningCount: approval.warningCount,
    renderingReadiness: approval.renderingReadiness,
    internalMarkers: uniqueMarkers([
      approval.approvalId,
      approval.coverLetterAuditRunId,
      approval.coverLetterCompositionVersionId,
      revision.version.id,
      ...revision.record.content.overallProvenance.overallEvidenceIds,
      ...revision.record.content.overallProvenance.overallRequirementIds,
      ...revision.record.content.overallProvenance.overallCareerRecordIds,
      ...revision.record.content.paragraphs.flatMap((paragraph) => [
        paragraph.id,
        ...paragraph.supportingEvidenceIds,
        ...paragraph.supportingRequirementIds,
        ...paragraph.supportingMatchReportConclusionIds,
        ...paragraph.sourceCareerRecordIds,
        ...paragraph.sourceResumeSectionIds,
        ...paragraph.acknowledgements
      ]),
      revision.record.userNotes,
      "approval acknowledgement",
      "evidence ids",
      "requirement ids"
    ]),
    expectedSnippets: uniqueMarkers([
      revision.record.content.candidateName,
      revision.record.content.header.company,
      revision.record.content.header.role,
      revision.record.content.salutation,
      revision.record.content.closing,
      ...orderedParagraphs
    ])
  });

  return {
    approval,
    audit,
    model,
    sourceId: revision.version.id,
    sourceType: approval.sourceType
  };
}

async function computeRenderInputChecksum(args: {
  model: CoverLetterRenderModel;
  format: DocumentFormat;
}) {
  const rendererVersion = getCoverLetterRendererVersion(args.format);
  const templateVersion = getCoverLetterTemplateVersion(args.format);

  return computeSha256(
    stableSerialize({
      approvalId: args.model.coverLetterApprovalId,
      auditId: args.model.coverLetterAuditRunId,
      compositionId: args.model.coverLetterCompositionVersionId,
      revisionId: args.model.coverLetterRevisionVersionId,
      contentChecksum: args.model.contentChecksum,
      format: args.format,
      rendererVersion,
      templateVersion,
      renderContractVersion: COVER_LETTER_RENDER_CONTRACT_VERSION,
      configurationVersion: COVER_LETTER_RENDER_CONFIGURATION_VERSION,
      configuration: coverLetterRenderConfiguration,
      date: args.model.date,
      candidateName: args.model.candidateName,
      email: args.model.email,
      phone: args.model.phone,
      location: args.model.location,
      company: args.model.company,
      role: args.model.role,
      salutation: args.model.salutation,
      paragraphs: args.model.paragraphs,
      closing: args.model.closing
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
      type: DocumentType.COVER_LETTER,
      title: args.title
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });

  if (existing) {
    return args.transaction.document.update({
      where: { id: existing.id },
      data: { status: DocumentStatus.REVIEWED }
    });
  }

  return args.transaction.document.create({
    data: {
      id: randomUUID(),
      workspaceId: args.workspaceId,
      applicationId: args.applicationId,
      jobDescriptionVersionId: args.jobDescriptionVersionId,
      type: DocumentType.COVER_LETTER,
      title: args.title,
      status: DocumentStatus.REVIEWED
    }
  });
}

export async function getLatestRenderedCoverLetterDocumentVersion(
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
        type: DocumentType.COVER_LETTER
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

export async function renderApprovedCoverLetterDocument(
  workspaceId: string,
  options: RenderApprovedCoverLetterDocumentOptions,
  prismaClient: PrismaClient = prisma
) {
  const format = options.format ?? DocumentFormat.DOCX;
  const rendererVersion = getCoverLetterRendererVersion(format);
  const templateVersion = getCoverLetterTemplateVersion(format);
  const approved = await getApprovedCoverLetterForRendering(workspaceId, options, prismaClient);
  const renderInputChecksum = await computeRenderInputChecksum({
    model: approved.model,
    format
  });

  const duplicate = await prismaClient.documentVersion.findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId: options.jobDescriptionVersionId,
      applicationId: options.applicationId ?? null,
      format,
      renderInputChecksum,
      document: {
        type: DocumentType.COVER_LETTER
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

  if (duplicate) {
    return {
      duplicate: true,
      documentVersion: duplicate
    };
  }

  const buffer =
    format === DocumentFormat.PDF
      ? await buildCoverLetterPdfBuffer(approved.model)
      : await buildCoverLetterDocxBuffer(approved.model);
  const validationSummary =
    format === DocumentFormat.PDF
      ? await validateCoverLetterPdfBuffer(buffer, approved.model)
      : await validateCoverLetterDocxBuffer(buffer, approved.model);

  if (!validationSummary.valid) {
    throw new Error(`Rendered ${format} validation failed.`);
  }

  const checksum = await computeBufferSha256(buffer);
  let absolutePath = "";

  try {
    const documentVersion = await prismaClient.$transaction(async (transaction) => {
      const document = await getOrCreateDocumentRecord({
        transaction,
        workspaceId,
        applicationId: approved.approval.applicationId,
        jobDescriptionVersionId: approved.approval.jobDescriptionVersionId,
        title: buildDocumentTitle(approved.model)
      });

      const latestVersion = await transaction.documentVersion.findFirst({
        where: { documentId: document.id },
        orderBy: [{ versionNumber: "desc" }, { generatedAt: "desc" }, { id: "desc" }]
      });

      const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;
      const documentVersionId = randomUUID();
      const storagePath = buildStoragePath(workspaceId, document.id, documentVersionId, format);
      absolutePath = resolveAbsoluteStoragePath(storagePath);
      await writeFileAtomically(absolutePath, buffer);

      await transaction.documentVersion.create({
        data: {
          id: documentVersionId,
          documentId: document.id,
          workspaceId,
          applicationId: approved.approval.applicationId,
          jobDescriptionVersionId: approved.approval.jobDescriptionVersionId,
          coverLetterApprovalId: approved.approval.approvalId,
          coverLetterAuditRunId: approved.approval.coverLetterAuditRunId,
          coverLetterCompositionVersionId: approved.approval.coverLetterCompositionVersionId,
          coverLetterRevisionVersionId: approved.approval.coverLetterRevisionVersionId,
          versionNumber,
          format,
          originalFilename: buildOriginalFilename(approved.model, format),
          storedFilename: buildStoredFilename(documentVersionId, format),
          storagePath,
          mimeType:
            format === DocumentFormat.PDF
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          sizeBytes: buffer.byteLength,
          checksum,
          source: DocumentSource.GENERATED,
          renderStatus:
            approved.approval.renderingReadiness === "READY_WITH_WARNINGS"
              ? DocumentRenderStatus.SUCCESS_WITH_WARNINGS
              : DocumentRenderStatus.SUCCESS,
          renderContractVersion: COVER_LETTER_RENDER_CONTRACT_VERSION,
          rendererVersion,
          templateVersion,
          configurationVersion: COVER_LETTER_RENDER_CONFIGURATION_VERSION,
          renderInputChecksum,
          warningCount: approved.audit.result.summary.warningCount,
          validationSummary: validationSummary as Prisma.InputJsonValue,
          metadata: {
            sourceType: approved.model.sourceType,
            contentChecksum: approved.model.contentChecksum,
            datePolicy: "approved-source-header-date",
            company: approved.model.company,
            role: approved.model.role
          } as Prisma.InputJsonValue
        }
      });

      return transaction.documentVersion.findUnique({
        where: { id: documentVersionId },
        include: { document: true }
      });
    });

    return {
      duplicate: false,
      documentVersion
    };
  } catch (error) {
    if (absolutePath) {
      await fs.rm(absolutePath, { force: true }).catch(() => undefined);
    }
    throw error;
  }
}
