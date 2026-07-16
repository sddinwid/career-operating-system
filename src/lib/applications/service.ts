import {
  ActivityType,
  ApplicationStatus,
  Prisma,
  WorkArrangement
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeCompanyName } from "@/lib/applications/normalization";
import type { OpportunityChoice } from "@/lib/applications/opportunity-shared";
import {
  ApplicationTimingValidationError,
  deriveJobSearchDateFromInstant,
  resolveApplicationTiming
} from "@/lib/applications/timestamps";
import {
  resolveOpportunityForApplication,
  toOpportunityChoice
} from "@/lib/applications/opportunities";
import {
  CreateApplicationInput,
  UpdateApplicationInput
} from "@/lib/applications/schemas";
import { getWorkspaceSettings } from "@/lib/settings";

type ApplicationListOptions = {
  workspaceId: string;
  includeArchived?: boolean;
};

type ApplicationDetailOptions = {
  workspaceId: string;
  applicationId: string;
};

export class ApplicationSubmissionError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>, message: string) {
    super(message);
    this.name = "ApplicationSubmissionError";
    this.fieldErrors = fieldErrors;
  }
}

function mapWorkArrangementLabel(value: WorkArrangement) {
  switch (value) {
    case "ONSITE":
      return "On-site";
    case "HYBRID":
      return "Hybrid";
    case "REMOTE":
      return "Remote";
    case "FLEXIBLE":
      return "Flexible";
    default:
      return value;
  }
}

async function findOrCreateCompany(
  transaction: Prisma.TransactionClient,
  workspaceId: string,
  companyName: string,
  currentCompanyId?: string
) {
  const normalizedName = normalizeCompanyName(companyName);

  const existingCompany = await transaction.company.findFirst({
    where: {
      workspaceId,
      normalizedName,
      ...(currentCompanyId ? { NOT: { id: currentCompanyId } } : {})
    }
  });

  if (existingCompany) {
    return existingCompany;
  }

  if (currentCompanyId) {
    return transaction.company.update({
      where: { id: currentCompanyId },
      data: {
        name: companyName.trim(),
        normalizedName
      }
    });
  }

  return transaction.company.create({
    data: {
      workspaceId,
      name: companyName.trim(),
      normalizedName
    }
  });
}

function ensureTimingResult<T>(callback: () => T) {
  try {
    return callback();
  } catch (error) {
    if (error instanceof ApplicationTimingValidationError) {
      throw new ApplicationSubmissionError(
        error.fieldErrors,
        error.message
      );
    }

    throw error;
  }
}

export async function listApplications({
  workspaceId,
  includeArchived = false
}: ApplicationListOptions) {
  return prisma.application.findMany({
    where: {
      workspaceId,
      ...(includeArchived ? {} : { archivedAt: null })
    },
    include: {
      opportunity: {
        include: {
          company: true
        }
      }
    },
    orderBy: [{ archivedAt: "asc" }, { appliedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function getApplicationDetail({
  workspaceId,
  applicationId
}: ApplicationDetailOptions) {
  return prisma.application.findFirst({
    where: {
      id: applicationId,
      workspaceId
    },
    include: {
      opportunity: {
        include: {
          company: true
        }
      },
      statusHistoryEntries: {
        orderBy: [{ occurredAt: "asc" }, { recordedAt: "asc" }, { id: "asc" }]
      }
    }
  });
}

export async function listCompanyChoices(workspaceId: string) {
  return prisma.company.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      normalizedName: true
    },
    orderBy: {
      name: "asc"
    }
  });
}

export async function listOpportunityChoices(
  workspaceId: string
): Promise<OpportunityChoice[]> {
  const opportunities = await prisma.jobOpportunity.findMany({
    where: { workspaceId },
    select: {
      id: true,
      title: true,
      jobUrl: true,
      location: true,
      workArrangement: true,
      company: {
        select: {
          id: true,
          normalizedName: true,
          name: true
        }
      }
    },
    orderBy: [{ capturedAt: "desc" }, { id: "desc" }]
  });

  return opportunities.map(toOpportunityChoice);
}

export async function createApplication(
  workspaceId: string,
  input: CreateApplicationInput
) {
  const settings = await getWorkspaceSettings(workspaceId);
  const now = new Date();
  const timing = ensureTimingResult(() =>
    resolveApplicationTiming(input, settings, now)
  );

  return prisma.$transaction(async (transaction) => {
    const company = await findOrCreateCompany(
      transaction,
      workspaceId,
      input.companyName
    );

    const opportunity = await resolveOpportunityForApplication({
      transaction,
      workspaceId,
      companyId: company.id,
      title: input.role,
      jobUrl: input.jobUrl,
      source: input.source,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      salaryCurrency: input.salaryCurrency,
      location: input.location,
      workArrangement: input.workArrangement,
      appliedAt: timing.appliedAt
    });

    const application = await transaction.application.create({
      data: {
        workspaceId,
        opportunityId: opportunity.id,
        appliedAt: timing.appliedAt,
        originalAppliedAt: timing.originalAppliedAt,
        recordedAt: timing.recordedAt,
        jobSearchDate: timing.jobSearchDate,
        status: input.status,
        priority: input.priority ?? null,
        notes: input.notes
      }
    });

    await transaction.applicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: null,
        toStatus: input.status,
        occurredAt: timing.appliedAt,
        recordedAt: timing.recordedAt,
        source: "applications.create",
        reason: "Application created"
      }
    });

    await transaction.activity.create({
      data: {
        workspaceId,
        applicationId: application.id,
        companyId: company.id,
        type: ActivityType.SUBMITTED,
        occurredAt: timing.appliedAt,
        recordedAt: timing.recordedAt,
        jobSearchDate: timing.jobSearchDate,
        timeZone: timing.timeZone,
        summary: `Application submitted for ${input.role.trim()}`,
        notes: input.notes
      }
    });

    return application;
  });
}

export async function updateApplication(
  workspaceId: string,
  applicationId: string,
  input: UpdateApplicationInput
) {
  const settings = await getWorkspaceSettings(workspaceId);
  const now = new Date();
  const timing = ensureTimingResult(() =>
    resolveApplicationTiming(input, settings, now)
  );

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.application.findFirst({
      where: {
        id: applicationId,
        workspaceId
      },
      include: {
        opportunity: {
          include: {
            company: true
          }
        }
      }
    });

    if (!existing) {
      throw new Error("Application not found");
    }

    const company = await findOrCreateCompany(
      transaction,
      workspaceId,
      input.companyName,
      existing.opportunity.company.id
    );

    const opportunity = await resolveOpportunityForApplication({
      transaction,
      workspaceId,
      companyId: company.id,
      existingOpportunity: {
        id: existing.opportunity.id,
        title: existing.opportunity.title,
        jobUrl: existing.opportunity.jobUrl,
        source: existing.opportunity.source,
        salaryMin: existing.opportunity.salaryMin,
        salaryMax: existing.opportunity.salaryMax,
        salaryCurrency: existing.opportunity.salaryCurrency,
        location: existing.opportunity.location,
        workArrangement: existing.opportunity.workArrangement
      },
      title: input.role,
      jobUrl: input.jobUrl,
      source: input.source,
      salaryMin: input.salaryMin,
      salaryMax: input.salaryMax,
      salaryCurrency: input.salaryCurrency,
      location: input.location,
      workArrangement: input.workArrangement,
      appliedAt: timing.appliedAt
    });

    const updated = await transaction.application.update({
      where: {
        id: applicationId
      },
      data: {
        opportunityId: opportunity.id,
        appliedAt: timing.appliedAt,
        originalAppliedAt: existing.originalAppliedAt ?? timing.originalAppliedAt,
        recordedAt: existing.recordedAt,
        jobSearchDate: timing.jobSearchDate,
        status: input.status,
        priority: input.priority ?? null,
        notes: input.notes
      }
    });

    if (existing.status !== input.status) {
      const transitionedAt = new Date();
      await transaction.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: existing.status,
          toStatus: input.status,
          occurredAt: transitionedAt,
          recordedAt: transitionedAt,
          source: "applications.update",
          reason: "Status changed from application edit"
        }
      });

      await transaction.activity.create({
        data: {
          workspaceId,
          applicationId,
          companyId: company.id,
          type: ActivityType.STATUS_CHANGE,
          occurredAt: transitionedAt,
          recordedAt: transitionedAt,
          jobSearchDate: deriveJobSearchDateFromInstant(transitionedAt, settings),
          timeZone: settings.defaultTimeZone,
          summary: `Status changed to ${input.status.replace(/_/g, " ").toLowerCase()}`,
          notes: `Status updated from ${existing.status} to ${input.status}`
        }
      });
    }

    return updated;
  });
}

export async function archiveApplication(workspaceId: string, applicationId: string) {
  return prisma.application.updateMany({
    where: {
      id: applicationId,
      workspaceId,
      archivedAt: null
    },
    data: {
      archivedAt: new Date()
    }
  });
}

export async function restoreApplication(workspaceId: string, applicationId: string) {
  return prisma.application.updateMany({
    where: {
      id: applicationId,
      workspaceId,
      NOT: {
        archivedAt: null
      }
    },
    data: {
      archivedAt: null
    }
  });
}

export function formatApplicationDate(value: Date | null | undefined) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(value);
}

export function formatApplicationDateTime(
  value: Date | null | undefined,
  timeZone = "America/Chicago"
) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

export function formatSalaryRange(
  min: Prisma.Decimal | number | null | undefined,
  max: Prisma.Decimal | number | null | undefined,
  currency: string | null | undefined
) {
  if (min == null && max == null) {
    return "Not set";
  }

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
    maximumFractionDigits: 0
  });

  const minValue = min != null ? Number(min) : undefined;
  const maxValue = max != null ? Number(max) : undefined;

  if (minValue != null && maxValue != null) {
    return `${formatter.format(minValue)} - ${formatter.format(maxValue)}`;
  }

  if (minValue != null) {
    return `From ${formatter.format(minValue)}`;
  }

  return `Up to ${formatter.format(maxValue ?? 0)}`;
}

export function formatWorkArrangement(value: WorkArrangement | null | undefined) {
  return value ? mapWorkArrangementLabel(value) : "Not set";
}
