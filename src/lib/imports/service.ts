import {
  ActivityType,
  ApplicationStatus,
  ImportJobStatus,
  JobOpportunityStatus,
  Prisma,
  type Prisma as PrismaTypes
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWorkspaceSettings } from "@/lib/settings";
import { normalizeCompanyName } from "@/lib/applications/normalization";
import { resolveOpportunityForApplication } from "@/lib/applications/opportunities";
import {
  resolveLocalDateAtNoon,
  resolveLocalDateAtTime
} from "@/lib/applications/timestamps";
import {
  type FieldMapping,
  type ImportExecutionSummary,
  type ImportJobSummaryPayload,
  type NormalizedImportRow,
  type PersistedImportJob
} from "@/lib/imports/types";
import {
  buildPreviewRowsFromFixture,
  readFixtureWorkbookInspection
} from "@/lib/imports/workbook";
import { canonicalizeJobUrl } from "@/lib/applications/opportunity-shared";

type ExistingApplicationCandidate = {
  id: string;
  companyName: string;
  normalizedCompanyName: string;
  role: string;
  normalizedRole: string;
  appliedDate: string | null;
  jobUrl: string | null;
};

type ImportJobWithRows = PersistedImportJob;

function parseSummary(
  summary: PrismaTypes.JsonValue | null
): ImportJobSummaryPayload | undefined {
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    return undefined;
  }

  return summary as unknown as ImportJobSummaryPayload;
}

function parseNormalizedRow(value: PrismaTypes.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Import row normalized data is missing.");
  }

  return value as unknown as Omit<NormalizedImportRow, "sourceColumns">;
}

function buildRowMessage(sheetName: string, rowNumber: number, message: string) {
  return `${sheetName} row ${rowNumber}: ${message}`;
}

async function listExistingApplicationCandidates(
  workspaceId: string
): Promise<ExistingApplicationCandidate[]> {
  const applications = await prisma.application.findMany({
    where: { workspaceId },
    include: {
      opportunity: {
        include: {
          company: true
        }
      }
    }
  });
  const opportunities = await prisma.jobOpportunity.findMany({
    where: { workspaceId },
    include: {
      company: true
    }
  });

  return [
    ...applications.map((application) => ({
      id: application.id,
      companyName: application.opportunity.company.name,
      normalizedCompanyName: application.opportunity.company.normalizedName,
      role: application.opportunity.title,
      normalizedRole: application.opportunity.title.trim().toLowerCase(),
      appliedDate: application.jobSearchDate?.toISOString().slice(0, 10) ?? null,
      jobUrl: application.opportunity.jobUrl
    })),
    ...opportunities.map((opportunity) => ({
      id: opportunity.id,
      companyName: opportunity.company.name,
      normalizedCompanyName: opportunity.company.normalizedName,
      role: opportunity.title,
      normalizedRole: opportunity.title.trim().toLowerCase(),
      appliedDate: null,
      jobUrl: opportunity.jobUrl
    }))
  ];
}

async function findOrCreateCompany(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
  companyName: string
) {
  const normalizedName = normalizeCompanyName(companyName);
  const existing = await transaction.company.findFirst({
    where: {
      workspaceId,
      normalizedName
    }
  });

  if (existing) {
    return existing;
  }

  return transaction.company.create({
    data: {
      workspaceId,
      name: companyName,
      normalizedName
    }
  });
}

async function findOrCreateSavedOpportunity(
  transaction: Prisma.TransactionClient,
  args: {
    workspaceId: string;
    companyId: string;
    title: string;
    jobUrl?: string;
    recordedAt: Date;
  }
) {
  const canonicalJobUrl = canonicalizeJobUrl(args.jobUrl);

  if (canonicalJobUrl) {
    const candidates = await transaction.jobOpportunity.findMany({
      where: {
        workspaceId: args.workspaceId,
        companyId: args.companyId,
        NOT: {
          jobUrl: null
        }
      }
    });

    const exactUrlMatch = candidates.find(
      (candidate) => canonicalizeJobUrl(candidate.jobUrl) === canonicalJobUrl
    );
    if (exactUrlMatch) {
      return exactUrlMatch;
    }
  }

  return transaction.jobOpportunity.create({
    data: {
      workspaceId: args.workspaceId,
      companyId: args.companyId,
      title: args.title,
      jobUrl: args.jobUrl,
      status: JobOpportunityStatus.SAVED,
      capturedAt: args.recordedAt
    }
  });
}

async function findOrCreateContact(
  transaction: Prisma.TransactionClient,
  args: {
    workspaceId: string;
    companyId: string;
    recruiterEmail?: string;
    recruiterLinkedIn?: string;
  }
) {
  if (!args.recruiterEmail && !args.recruiterLinkedIn) {
    return null;
  }

  const identifier = args.recruiterEmail ?? args.recruiterLinkedIn;
  if (!identifier) {
    return null;
  }

  const existing = await transaction.contact.findFirst({
    where: {
      workspaceId: args.workspaceId,
      companyId: args.companyId,
      OR: [
        ...(args.recruiterEmail ? [{ email: args.recruiterEmail }] : []),
        ...(args.recruiterLinkedIn ? [{ linkedinUrl: args.recruiterLinkedIn }] : []),
        { name: identifier }
      ]
    }
  });

  if (existing) {
    return existing;
  }

  return transaction.contact.create({
    data: {
      workspaceId: args.workspaceId,
      companyId: args.companyId,
      name: identifier,
      email: args.recruiterEmail,
      linkedinUrl: args.recruiterLinkedIn,
      relationshipType: "Imported spreadsheet contact",
      notes:
        "Imported without a dedicated recruiter name column. The strongest source identifier was preserved."
    }
  });
}

async function createDateOnlyActivity(
  transaction: Prisma.TransactionClient,
  args: {
    workspaceId: string;
    applicationId: string;
    companyId: string;
    contactId?: string | null;
    type: ActivityType;
    occurredDate: string;
    summary: string;
    notes?: string;
    metadata?: PrismaTypes.InputJsonValue;
    timeZone: string;
  }
) {
  const occurredAt = resolveLocalDateAtNoon(args.occurredDate, args.timeZone);

  return transaction.activity.create({
    data: {
      workspaceId: args.workspaceId,
      applicationId: args.applicationId,
      companyId: args.companyId,
      contactId: args.contactId ?? null,
      type: args.type,
      occurredAt,
      originalOccurredAt: occurredAt,
      recordedAt: new Date(),
      jobSearchDate: new Date(`${args.occurredDate}T00:00:00.000Z`),
      timeZone: args.timeZone,
      summary: args.summary,
      notes: args.notes,
      metadata: args.metadata
    }
  });
}

async function importPreparedRow(
  workspaceId: string,
  row: NormalizedImportRow,
  importJobId: string
) {
  const settings = await getWorkspaceSettings(workspaceId);
  const occurredDate = row.authoritativeData.appliedDate;
  const companyName = row.authoritativeData.companyName;
  const role = row.authoritativeData.role;

  if (!companyName || !role) {
    throw new Error("Company and role are required.");
  }

  const recordedAt = new Date();

  return prisma.$transaction(async (transaction) => {
    const company = await findOrCreateCompany(
      transaction,
      workspaceId,
      companyName
    );

    const contact = await findOrCreateContact(transaction, {
      workspaceId,
      companyId: company.id,
      recruiterEmail: row.authoritativeData.recruiterEmail,
      recruiterLinkedIn: row.authoritativeData.recruiterLinkedIn
    });

    if (row.proposedRecordType === "saved_opportunity") {
      const opportunity = await findOrCreateSavedOpportunity(transaction, {
        workspaceId,
        companyId: company.id,
        title: role,
        jobUrl: row.authoritativeData.jobUrl,
        recordedAt
      });

      return {
        kind: "saved_opportunity" as const,
        opportunityId: opportunity.id
      };
    }

    if (!occurredDate) {
      throw new Error("Application date is required for submitted applications.");
    }

    const appliedAt = resolveLocalDateAtNoon(occurredDate, settings.defaultTimeZone);
    const jobSearchDate = new Date(`${occurredDate}T00:00:00.000Z`);

    const resolvedOpportunity = await resolveOpportunityForApplication({
      transaction,
      workspaceId,
      companyId: company.id,
      title: role,
      jobUrl: row.authoritativeData.jobUrl,
      appliedAt
    });

    const application = await transaction.application.create({
      data: {
        workspaceId,
        opportunityId: resolvedOpportunity.id,
        appliedAt,
        originalAppliedAt: appliedAt,
        recordedAt,
        jobSearchDate,
        status: row.authoritativeData.status ?? ApplicationStatus.APPLIED,
        priority: row.authoritativeData.priority ?? null,
        notes: row.authoritativeData.notes ?? null
      }
    });

    await transaction.applicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: null,
        toStatus: row.authoritativeData.status ?? ApplicationStatus.APPLIED,
        occurredAt: appliedAt,
        recordedAt,
        source: "imports.fixture",
        reason: row.authoritativeData.rejectionReason ?? "Imported from Excel fixture"
      }
    });

    await transaction.activity.create({
      data: {
        workspaceId,
        applicationId: application.id,
        companyId: company.id,
        contactId: contact?.id ?? null,
        type: ActivityType.SUBMITTED,
        occurredAt: appliedAt,
        originalOccurredAt: appliedAt,
        recordedAt,
        jobSearchDate,
        timeZone: settings.defaultTimeZone,
        summary: `Application imported for ${role}`,
        notes: row.authoritativeData.notes ?? null,
        metadata: {
          importJobId,
          sourceSheet: row.sheetName,
          sourceRowNumber: row.rowNumber,
          precision: row.authoritativeData.appliedAtPrecision ?? "DATE_ONLY"
        }
      }
    });

    if (row.authoritativeData.linkedinMessageSentDate) {
      await createDateOnlyActivity(transaction, {
        workspaceId,
        applicationId: application.id,
        companyId: company.id,
        contactId: contact?.id,
        type: ActivityType.LINKEDIN_MESSAGE,
        occurredDate: row.authoritativeData.linkedinMessageSentDate,
        summary: "Imported LinkedIn outreach message",
        metadata: {
          importJobId,
          sourceSheet: row.sheetName,
          sourceRowNumber: row.rowNumber,
          precision:
            row.authoritativeData.linkedinMessageSentPrecision ?? "DATE_ONLY"
        },
        timeZone: settings.defaultTimeZone
      });
    }

    if (row.authoritativeData.emailSentDate) {
      await createDateOnlyActivity(transaction, {
        workspaceId,
        applicationId: application.id,
        companyId: company.id,
        contactId: contact?.id,
        type: ActivityType.EMAIL_SENT,
        occurredDate: row.authoritativeData.emailSentDate,
        summary: "Imported follow-up email",
        metadata: {
          importJobId,
          sourceSheet: row.sheetName,
          sourceRowNumber: row.rowNumber,
          precision: row.authoritativeData.emailSentPrecision ?? "DATE_ONLY"
        },
        timeZone: settings.defaultTimeZone
      });
    }

    if (row.authoritativeData.firstInterviewDate) {
      const scheduledStart = resolveLocalDateAtTime(
        row.authoritativeData.firstInterviewDate,
        settings.defaultTimeZone,
        "09:00"
      );

      const interview = await transaction.interview.create({
        data: {
          workspaceId,
          applicationId: application.id,
          stage: row.authoritativeData.interviewStagesCompleted || "First interview",
          scheduledStart,
          timeZone: settings.defaultTimeZone,
          status: "SCHEDULED",
          notes: "Imported from Excel fixture"
        }
      });

      await createDateOnlyActivity(transaction, {
        workspaceId,
        applicationId: application.id,
        companyId: company.id,
        contactId: contact?.id,
        type: ActivityType.INTERVIEW_SCHEDULED,
        occurredDate: row.authoritativeData.firstInterviewDate,
        summary: "Imported interview date",
        metadata: {
          importJobId,
          sourceSheet: row.sheetName,
          sourceRowNumber: row.rowNumber,
          interviewId: interview.id,
          precision: row.authoritativeData.firstInterviewPrecision ?? "DATE_ONLY"
        },
        timeZone: settings.defaultTimeZone
      });
    }

    if (row.authoritativeData.status === ApplicationStatus.REJECTED) {
      await transaction.activity.create({
        data: {
          workspaceId,
          applicationId: application.id,
          companyId: company.id,
          contactId: contact?.id ?? null,
          type: ActivityType.REJECTION,
          occurredAt: appliedAt,
          originalOccurredAt: appliedAt,
          recordedAt,
          jobSearchDate,
          timeZone: settings.defaultTimeZone,
          summary: "Imported rejection outcome",
          notes: row.authoritativeData.rejectionReason ?? null,
          metadata: {
            importJobId,
            sourceSheet: row.sheetName,
            sourceRowNumber: row.rowNumber,
            precision: row.authoritativeData.appliedAtPrecision ?? "DATE_ONLY"
          }
        }
      });
    }

    return {
      kind: "submitted_application" as const,
      applicationId: application.id
    };
  });
}

async function runImportRows(
  workspaceId: string,
  job: ImportJobWithRows,
  options?: { retryOnly?: boolean }
) {
  const rows = job.rows.sort((left, right) => left.rowNumber - right.rowNumber);
  const summary: ImportExecutionSummary = {
    successCount: 0,
    skippedCount: 0,
    duplicateCount: 0,
    warningCount: 0,
    errorCount: 0,
    applicationCount: 0,
    opportunityOnlyCount: 0,
    reviewCount: 0
  };

  for (const row of rows) {
    const normalized = parseNormalizedRow(row.normalizedData);
    const rowWarnings = Array.isArray(normalized.warnings) ? normalized.warnings.length : 0;
    summary.warningCount += rowWarnings;

    if (row.status === "DUPLICATE") {
      summary.duplicateCount += 1;
      continue;
    }

    if (row.status === "SKIPPED") {
      summary.skippedCount += 1;
      continue;
    }

    if (row.status === "INVALID" && !options?.retryOnly) {
      summary.errorCount += Array.isArray(normalized.errors)
        ? normalized.errors.length || 1
        : 1;
      summary.skippedCount += 1;
      summary.reviewCount += 1;
      continue;
    }

    if (row.status === "IMPORTED") {
      summary.skippedCount += 1;
      continue;
    }

    try {
      const result = await importPreparedRow(
        workspaceId,
        {
          ...normalized,
          sheetName: row.sheetName,
          rowNumber: row.rowNumber,
          sourceColumns: {}
        },
        job.id
      );

      await prisma.importRow.update({
        where: { id: row.id },
        data: {
          status: "IMPORTED",
          matchedApplicationId:
            result.kind === "submitted_application"
              ? result.applicationId
              : null,
          errorMessages: Prisma.JsonNull
        }
      });

      summary.successCount += 1;
      if (result.kind === "submitted_application") {
        summary.applicationCount += 1;
      } else {
        summary.opportunityOnlyCount += 1;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Row import failed unexpectedly.";
      await prisma.importRow.update({
        where: { id: row.id },
        data: {
          status: "INVALID",
          errorMessages: [buildRowMessage(row.sheetName, row.rowNumber, message)]
        }
      });
      summary.errorCount += 1;
      summary.reviewCount += 1;
    }
  }

  return summary;
}

export function getFixtureImportTemplate() {
  return readFixtureWorkbookInspection();
}

export async function createFixtureImportPreview(
  workspaceId: string,
  mapping: FieldMapping
) {
  const existingApplications = await listExistingApplicationCandidates(workspaceId);
  const preview = buildPreviewRowsFromFixture(mapping, existingApplications);

  const job = await prisma.importJob.create({
    data: {
      workspaceId,
      filename: preview.inspection.filename,
      checksum: preview.inspection.checksum,
      status: ImportJobStatus.PENDING,
      sheetName: preview.inspection.trackerSheetName,
      mapping,
      summary: {
        preview: preview.summary
      }
    }
  });

  await prisma.importRow.createMany({
    data: preview.rows.map((row) => ({
      importJobId: job.id,
      sheetName: row.sheetName,
      rowNumber: row.rowNumber,
      rawData: row.sourceColumns,
      normalizedData: {
        sheetName: row.sheetName,
        rowNumber: row.rowNumber,
        identityKey: row.identityKey,
        authoritativeData: row.authoritativeData,
        derivedData: row.derivedData,
        issueGroups: row.issueGroups,
        warnings: row.warnings,
        errors: row.errors,
        duplicateMatches: row.duplicateMatches,
        classification: row.classification,
        proposedRecordType: row.proposedRecordType,
        recommendedHandling: row.recommendedHandling,
        willImport: row.willImport
      },
      status: row.previewStatus,
      errorMessages:
        row.errors.length > 0
          ? row.errors.map((message) =>
              buildRowMessage(row.sheetName, row.rowNumber, message)
            )
          : Prisma.JsonNull,
      matchedApplicationId: row.matchedApplicationId ?? null
    }))
  });

  return job.id;
}

export async function getImportJobDetail(
  workspaceId: string,
  jobId: string
): Promise<ImportJobWithRows | null> {
  return prisma.importJob.findFirst({
    where: {
      id: jobId,
      workspaceId
    },
    include: {
      rows: {
        orderBy: [{ rowNumber: "asc" }]
      }
    }
  });
}

export async function runImportJob(workspaceId: string, jobId: string) {
  const job = await getImportJobDetail(workspaceId, jobId);
  if (!job) {
    throw new Error("Import job not found.");
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: ImportJobStatus.RUNNING,
      startedAt: new Date(),
      errorMessage: null
    }
  });

  try {
    const importResult = await runImportRows(workspaceId, job);
    const currentSummary = parseSummary(job.summary) ?? {
      preview: {
        totalRows: 0,
        readyCount: 0,
        duplicateCount: 0,
        warningCount: 0,
        errorCount: 0,
        skippedCount: 0,
        classificationCounts: {
          valid: 0,
          warning: 0,
          invalid: 0,
          duplicate: 0,
          skipped_blank: 0,
          skipped_informational: 0
        },
        proposedRecordTypeCounts: {
          submitted_application: 0,
          saved_opportunity: 0,
          outreach_only: 0,
          informational: 0,
          duplicate: 0,
          unusable: 0
        },
        recommendedHandlingCounts: {
          import_normally: 0,
          import_as_incomplete_application: 0,
          import_as_saved_opportunity: 0,
          import_with_warning: 0,
          skip_intentionally: 0,
          requires_user_review: 0
        },
        groupedIssueCounts: {}
      }
    };

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.COMPLETED,
        completedAt: new Date(),
        summary: {
          ...currentSummary,
          importResult
        },
        errorMessage: null
      }
    });
  } catch (error) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.FAILED,
        completedAt: new Date(),
        errorMessage:
          error instanceof Error
            ? error.message
            : "Import job failed unexpectedly."
      }
    });

    throw error;
  }
}

export async function retryImportJobFailures(workspaceId: string, jobId: string) {
  const job = await getImportJobDetail(workspaceId, jobId);
  if (!job) {
    throw new Error("Import job not found.");
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: ImportJobStatus.RUNNING,
      errorMessage: null
    }
  });

  const importResult = await runImportRows(workspaceId, job, { retryOnly: true });
  const currentSummary = parseSummary(job.summary) ?? {
    preview: {
      totalRows: 0,
      readyCount: 0,
      duplicateCount: 0,
      warningCount: 0,
      errorCount: 0,
      skippedCount: 0,
      classificationCounts: {
        valid: 0,
        warning: 0,
        invalid: 0,
        duplicate: 0,
        skipped_blank: 0,
        skipped_informational: 0
      },
      proposedRecordTypeCounts: {
        submitted_application: 0,
        saved_opportunity: 0,
        outreach_only: 0,
        informational: 0,
        duplicate: 0,
        unusable: 0
      },
      recommendedHandlingCounts: {
        import_normally: 0,
        import_as_incomplete_application: 0,
        import_as_saved_opportunity: 0,
        import_with_warning: 0,
        skip_intentionally: 0,
        requires_user_review: 0
      },
      groupedIssueCounts: {}
    }
  };

  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: ImportJobStatus.COMPLETED,
      completedAt: new Date(),
      summary: {
        ...currentSummary,
        importResult
      },
      errorMessage: null
    }
  });
}
