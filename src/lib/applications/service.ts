import {
  ActivityType,
  ApplicationStatus,
  Prisma,
  WorkArrangement
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  formatApplicationDate,
  formatApplicationDateTime,
  formatSalaryRange,
  formatWorkArrangement
} from "@/lib/applications/formatters";
import { normalizeCompanyName } from "@/lib/applications/normalization";
import type { OpportunityChoice } from "@/lib/applications/opportunity-shared";
import {
  ApplicationTimingValidationError,
  detectManualJobSearchDateOverride,
  deriveJobSearchDateFromInstant,
  formatDateTimeLocalInput,
  resolveApplicationTiming
} from "@/lib/applications/timestamps";
import {
  resolveOpportunityForApplication,
  toOpportunityChoice
} from "@/lib/applications/opportunities";
import {
  CreateApplicationInput,
  UpdateApplicationInput,
  updateApplicationSchema
} from "@/lib/applications/schemas";
import type { EditableApplicationGridField } from "@/lib/applications/grid-schemas";
import {
  buildApplicationGridRow,
  type ApplicationGridRow
} from "@/lib/applications/grid";
import { getWorkspaceSettings } from "@/lib/settings";

type ApplicationListOptions = {
  workspaceId: string;
  includeArchived?: boolean;
};

type ApplicationDetailOptions = {
  workspaceId: string;
  applicationId: string;
};

type UpdateApplicationGridFieldInput = {
  applicationId: string;
  field: EditableApplicationGridField;
  value: string | null;
};

export class ApplicationSubmissionError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>, message: string) {
    super(message);
    this.name = "ApplicationSubmissionError";
    this.fieldErrors = fieldErrors;
  }
}

function normalizeFieldErrors(
  fieldErrors: Record<string, string[] | undefined>
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0
    )
  );
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
      },
      activities: {
        where: {
          type: ActivityType.SUBMITTED
        },
        orderBy: {
          occurredAt: "asc"
        },
        take: 1,
        select: {
          metadata: true
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
          company: true,
          _count: {
            select: {
              jobDescriptionVersions: true
            }
          }
        }
      },
      currentJobDescriptionVersion: {
        select: {
          id: true,
          versionNumber: true,
          originalText: true,
          sourceUrl: true,
          sourceType: true,
          capturedAt: true,
          active: true,
          checksum: true,
          parses: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              id: true,
              status: true,
              parserVersion: true,
              createdAt: true
            }
          }
        }
      },
      statusHistoryEntries: {
        orderBy: [{ occurredAt: "asc" }, { recordedAt: "asc" }, { id: "asc" }]
      }
    }
  });
}

async function getApplicationForGrid(
  workspaceId: string,
  applicationId: string
) {
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
      activities: {
        where: {
          type: ActivityType.SUBMITTED
        },
        orderBy: {
          occurredAt: "asc"
        },
        take: 1,
        select: {
          metadata: true
        }
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

function parseSalaryInput(
  input: string | null
): Pick<UpdateApplicationInput, "salaryMin" | "salaryMax" | "salaryCurrency"> {
  const trimmed = input?.trim() ?? "";
  if (!trimmed) {
    return {
      salaryMin: undefined,
      salaryMax: undefined,
      salaryCurrency: undefined
    };
  }

  const currencyMatch = trimmed.match(/\b([A-Za-z]{3})$/);
  const currency = currencyMatch?.[1]?.toUpperCase();
  const withoutCurrency = currency
    ? trimmed.slice(0, trimmed.length - currency.length).trim()
    : trimmed;
  const normalized = withoutCurrency.toLowerCase();
  const numbers = withoutCurrency.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];

  if (numbers.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new ApplicationSubmissionError(
      { salaryMin: ["Enter a valid salary value."], salaryMax: ["Enter a valid salary value."] },
      "Enter a valid salary value."
    );
  }

  if (normalized.startsWith("up to ")) {
    if (numbers.length !== 1) {
      throw new ApplicationSubmissionError(
        { salaryMax: ["Use one maximum salary value."] },
        "Use one maximum salary value."
      );
    }

    return {
      salaryMin: undefined,
      salaryMax: numbers[0],
      salaryCurrency: currency
    };
  }

  if (normalized.startsWith("from ")) {
    if (numbers.length !== 1) {
      throw new ApplicationSubmissionError(
        { salaryMin: ["Use one minimum salary value."] },
        "Use one minimum salary value."
      );
    }

    return {
      salaryMin: numbers[0],
      salaryMax: undefined,
      salaryCurrency: currency
    };
  }

  if (numbers.length === 1) {
    return {
      salaryMin: numbers[0],
      salaryMax: undefined,
      salaryCurrency: currency
    };
  }

  if (numbers.length === 2) {
    return {
      salaryMin: numbers[0],
      salaryMax: numbers[1],
      salaryCurrency: currency
    };
  }

  throw new ApplicationSubmissionError(
    { salaryMin: ["Enter salary as a number, range, or 'up to' value."] },
    "Enter salary as a number, range, or 'up to' value."
  );
}

function toUpdateApplicationInput(args: {
  application: NonNullable<Awaited<ReturnType<typeof getApplicationDetail>>>;
  settings: Awaited<ReturnType<typeof getWorkspaceSettings>>;
}) {
  return {
    companyName: args.application.opportunity.company.name,
    role: args.application.opportunity.title,
    appliedAtLocal: args.application.appliedAt
      ? formatDateTimeLocalInput(
          args.application.appliedAt,
          args.settings.defaultTimeZone
        )
      : "",
    manualJobSearchDate: detectManualJobSearchDateOverride({
      appliedAt: args.application.appliedAt,
      jobSearchDate: args.application.jobSearchDate,
      settings: args.settings
    }),
    jobUrl: args.application.opportunity.jobUrl ?? undefined,
    source: args.application.opportunity.source ?? undefined,
    salaryMin: args.application.opportunity.salaryMin != null
      ? Number(args.application.opportunity.salaryMin)
      : undefined,
    salaryMax: args.application.opportunity.salaryMax != null
      ? Number(args.application.opportunity.salaryMax)
      : undefined,
    salaryCurrency: args.application.opportunity.salaryCurrency ?? undefined,
    location: args.application.opportunity.location ?? undefined,
    workArrangement: args.application.opportunity.workArrangement ?? undefined,
    priority: args.application.priority ?? undefined,
    status: args.application.status,
    notes: args.application.notes ?? undefined
  } satisfies UpdateApplicationInput;
}

function normalizeAppliedAtLocalInput(
  value: string | null
) {
  const trimmed = value?.trim() ?? "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T12:00`;
  }

  return trimmed;
}

export async function updateApplicationGridField(
  workspaceId: string,
  input: UpdateApplicationGridFieldInput
): Promise<ApplicationGridRow> {
  const settings = await getWorkspaceSettings(workspaceId);
  const application = await getApplicationDetail({
    workspaceId,
    applicationId: input.applicationId
  });

  if (!application) {
    throw new Error("Application not found");
  }

  const nextInput = toUpdateApplicationInput({
    application,
    settings
  });

  switch (input.field) {
    case "status":
      nextInput.status = (input.value?.trim() || nextInput.status) as ApplicationStatus;
      break;
    case "priority":
      nextInput.priority = (input.value?.trim() || undefined) as UpdateApplicationInput["priority"];
      break;
    case "source":
      nextInput.source = input.value?.trim() || undefined;
      break;
    case "location":
      nextInput.location = input.value?.trim() || undefined;
      break;
    case "workArrangement":
      nextInput.workArrangement = (input.value?.trim() || undefined) as UpdateApplicationInput["workArrangement"];
      break;
    case "company":
      nextInput.companyName = input.value?.trim() || "";
      break;
    case "role":
      nextInput.role = input.value?.trim() || "";
      break;
    case "jobSearchDate":
      nextInput.manualJobSearchDate = input.value?.trim() || undefined;
      break;
    case "appliedAt":
      nextInput.appliedAtLocal = normalizeAppliedAtLocalInput(input.value);
      break;
    case "salary": {
      const parsedSalary = parseSalaryInput(input.value);
      nextInput.salaryMin = parsedSalary.salaryMin;
      nextInput.salaryMax = parsedSalary.salaryMax;
      nextInput.salaryCurrency =
        parsedSalary.salaryCurrency ?? nextInput.salaryCurrency;
      break;
    }
    default:
      return buildApplicationGridRow(
        (await getApplicationForGrid(workspaceId, input.applicationId))!,
        settings
      );
  }

  const parsed = updateApplicationSchema.safeParse(nextInput);
  if (!parsed.success) {
    throw new ApplicationSubmissionError(
      normalizeFieldErrors(parsed.error.flatten().fieldErrors),
      "Please fix the edited value and try again."
    );
  }

  await updateApplication(workspaceId, input.applicationId, parsed.data);

  const updated = await getApplicationForGrid(workspaceId, input.applicationId);
  if (!updated) {
    throw new Error("Application not found after update.");
  }

  return buildApplicationGridRow(updated, settings);
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
        companyId: existing.opportunity.company.id,
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

export {
  formatApplicationDate,
  formatApplicationDateTime,
  formatSalaryRange,
  formatWorkArrangement
};
