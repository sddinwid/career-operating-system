import {
  DocumentFormat,
  DocumentRenderStatus,
  DocumentType,
  type PrismaClient
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type DocumentListFilters = {
  search?: string;
  type?: "all" | Lowercase<DocumentType>;
  format?: "all" | Lowercase<DocumentFormat>;
  company?: string;
  sort?: "newest" | "oldest";
};

function normalizeValue(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function toLabel(value: string) {
  return value.replace(/_/g, " ");
}

export async function listDocumentWorkspaceEntries(
  workspaceId: string,
  filters: DocumentListFilters = {},
  prismaClient: PrismaClient = prisma
) {
  const versions = await prismaClient.documentVersion.findMany({
    where: {
      workspaceId,
      renderStatus: {
        in: [DocumentRenderStatus.SUCCESS, DocumentRenderStatus.SUCCESS_WITH_WARNINGS]
      }
    },
    orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      documentId: true,
      applicationId: true,
      jobDescriptionVersionId: true,
      versionNumber: true,
      format: true,
      originalFilename: true,
      sizeBytes: true,
      renderStatus: true,
      rendererVersion: true,
      templateVersion: true,
      generatedAt: true,
      document: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true
        }
      },
      application: {
        select: {
          id: true
        }
      },
      jobDescriptionVersion: {
        select: {
          opportunity: {
            select: {
              title: true,
              company: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      },
      resumeRenderingApproval: {
        select: {
          renderingReadiness: true
        }
      }
    }
  });

  const normalizedSearch = normalizeValue(filters.search);
  const normalizedCompany = normalizeValue(filters.company);

  return versions
    .map((version) => ({
      id: version.id,
      documentId: version.documentId,
      title: version.document.title,
      type: version.document.type,
      typeLabel: toLabel(version.document.type),
      companyName: version.jobDescriptionVersion.opportunity.company.name,
      roleTitle: version.jobDescriptionVersion.opportunity.title,
      applicationId: version.application?.id ?? version.applicationId,
      format: version.format,
      formatLabel: version.format,
      filename: version.originalFilename,
      generatedAt: version.generatedAt,
      renderStatus: version.renderStatus,
      renderStatusLabel: toLabel(version.renderStatus),
      rendererVersion: version.rendererVersion,
      templateVersion: version.templateVersion,
      approvalState: version.resumeRenderingApproval.renderingReadiness.replace(/_/g, " "),
      fileSizeBytes: version.sizeBytes,
      versionNumber: version.versionNumber
    }))
    .filter((entry) => {
      if (normalizedSearch) {
        const haystack = [
          entry.title,
          entry.companyName,
          entry.roleTitle,
          entry.filename,
          entry.formatLabel
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      if (normalizedCompany && entry.companyName.toLowerCase() !== normalizedCompany) {
        return false;
      }

      if ((filters.type ?? "all") !== "all" && entry.type.toLowerCase() !== filters.type) {
        return false;
      }

      if ((filters.format ?? "all") !== "all" && entry.format.toLowerCase() !== filters.format) {
        return false;
      }

      return true;
    })
    .sort((left, right) =>
      (filters.sort ?? "newest") === "oldest"
        ? left.generatedAt.getTime() - right.generatedAt.getTime()
        : right.generatedAt.getTime() - left.generatedAt.getTime()
    );
}
