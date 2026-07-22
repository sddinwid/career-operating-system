import {
  JobDescriptionSourceType,
  JobOpportunityStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeCompanyName } from "@/lib/applications/normalization";
import { canonicalizeJobUrl } from "@/lib/applications/opportunity-shared";
import { getLatestCareerProfileVersion } from "@/lib/career/service";
import {
  countJobDescriptionWords,
  JOB_DESCRIPTION_FORMAT_VERSION,
  normalizeJobDescriptionText
} from "@/lib/job-descriptions/normalize";
import { computeJobDescriptionChecksum } from "@/lib/job-descriptions/checksum";
import type {
  CreateStandaloneJobDescriptionInput,
  SaveApplicationJobDescriptionInput
} from "@/lib/job-descriptions/schemas";

type TransactionClient = Prisma.TransactionClient;
type JobDescriptionVersionDetail = NonNullable<
  Awaited<ReturnType<typeof getJobDescriptionVersionById>>
>;

export class JobDescriptionSubmissionError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>, message: string) {
    super(message);
    this.name = "JobDescriptionSubmissionError";
    this.fieldErrors = fieldErrors;
  }
}

type PersistJobDescriptionArgs = {
  transaction: TransactionClient;
  workspaceId: string;
  opportunityId: string;
  linkApplicationId?: string;
  sourceApplicationId?: string;
  input: SaveApplicationJobDescriptionInput;
  createdByWorkflow: string;
  simulateFailureAfterSupersede?: boolean;
};

type SaveJobDescriptionResult = {
  version: JobDescriptionVersionDetail;
  duplicate: boolean;
  opportunityId: string;
  applicationId: string | null;
};

function normalizeComparableValue(value: string | null | undefined) {
  return value?.trim() || null;
}

function parseOptionalDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

async function findOrCreateCompany(
  transaction: TransactionClient,
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
      name: companyName.trim(),
      normalizedName
    }
  });
}

async function findExactUrlOpportunity(
  transaction: TransactionClient,
  workspaceId: string,
  companyId: string,
  jobUrl?: string
) {
  const canonicalJobUrl = canonicalizeJobUrl(jobUrl);
  if (!canonicalJobUrl) {
    return null;
  }

  const candidates = await transaction.jobOpportunity.findMany({
    where: {
      workspaceId,
      companyId,
      NOT: {
        jobUrl: null
      }
    },
    orderBy: {
      capturedAt: "desc"
    }
  });

  return (
    candidates.find(
      (candidate) => canonicalizeJobUrl(candidate.jobUrl) === canonicalJobUrl
    ) ?? null
  );
}

async function resolveOpportunityForJobDescriptionIntake(args: {
  transaction: TransactionClient;
  workspaceId: string;
  companyId: string;
  role: string;
  jobUrl?: string;
  source?: string;
  capturedAt: Date;
}) {
  const exactMatch = await findExactUrlOpportunity(
    args.transaction,
    args.workspaceId,
    args.companyId,
    args.jobUrl
  );

  if (exactMatch) {
    return exactMatch;
  }

  return args.transaction.jobOpportunity.create({
    data: {
      workspaceId: args.workspaceId,
      companyId: args.companyId,
      title: args.role.trim(),
      jobUrl: normalizeComparableValue(args.jobUrl),
      source: normalizeComparableValue(args.source),
      capturedAt: args.capturedAt,
      status: JobOpportunityStatus.SAVED
    }
  });
}

async function persistJobDescriptionVersion(
  args: PersistJobDescriptionArgs
): Promise<SaveJobDescriptionResult> {
  const capturedAt = new Date();
  const normalizedText = normalizeJobDescriptionText(args.input.descriptionText);
  const checksum = computeJobDescriptionChecksum(normalizedText);

  const existingVersion = await args.transaction.jobDescriptionVersion.findUnique({
    where: {
      opportunityId_checksum: {
        opportunityId: args.opportunityId,
        checksum
      }
    }
  });

  if (existingVersion) {
    if (args.linkApplicationId) {
      await args.transaction.application.update({
        where: {
          id: args.linkApplicationId
        },
        data: {
          currentJobDescriptionVersionId: existingVersion.id
        }
      });
    }

    const version = await getJobDescriptionVersionById(
      args.workspaceId,
      existingVersion.id,
      args.transaction
    );

    if (!version) {
      throw new Error("Job description version not found after duplicate match.");
    }

    return {
      version,
      duplicate: true,
      opportunityId: args.opportunityId,
      applicationId: args.linkApplicationId ?? null
    };
  }

  const activeVersion = await args.transaction.jobDescriptionVersion.findFirst({
    where: {
      workspaceId: args.workspaceId,
      opportunityId: args.opportunityId,
      active: true
    },
    orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }]
  });

  if (activeVersion) {
    await args.transaction.jobDescriptionVersion.update({
      where: {
        id: activeVersion.id
      },
      data: {
        active: false,
        supersededAt: capturedAt
      }
    });
  }

  if (args.simulateFailureAfterSupersede) {
    throw new Error("Simulated failure after superseding the active version.");
  }

  const previousLatest = await args.transaction.jobDescriptionVersion.findFirst({
    where: {
      workspaceId: args.workspaceId,
      opportunityId: args.opportunityId
    },
    orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }]
  });

  const version = await args.transaction.jobDescriptionVersion.create({
    data: {
      workspaceId: args.workspaceId,
      opportunityId: args.opportunityId,
      sourceApplicationId: args.sourceApplicationId ?? null,
      predecessorId: activeVersion?.id ?? null,
      versionNumber: (previousLatest?.versionNumber ?? 0) + 1,
      originalText: args.input.descriptionText,
      normalizedText,
      sourceUrl: normalizeComparableValue(args.input.sourceUrl),
      sourceType: args.input.sourceType,
      sourceTitle: normalizeComparableValue(args.input.sourceTitle),
      sourceFilename: normalizeComparableValue(args.input.sourceFilename),
      capturedAt,
      publishedAt: parseOptionalDate(args.input.publishedAt),
      checksum,
      formatVersion: JOB_DESCRIPTION_FORMAT_VERSION,
      createdByWorkflow: args.createdByWorkflow,
      provenance: {
        normalizationVersion: JOB_DESCRIPTION_FORMAT_VERSION,
        originalCharacterCount: args.input.descriptionText.length,
        normalizedCharacterCount: normalizedText.length,
        intakeMode: args.input.intakeMode,
        urlFetch:
          args.input.intakeMode === "url"
            ? {
                requestedUrl: args.input.fetchedRequestedUrl ?? null,
                finalUrl: args.input.fetchedFinalUrl ?? null,
                resolvedUrl: args.input.fetchedResolvedUrl ?? null,
                status: args.input.fetchedStatus ?? null,
                contentType: args.input.fetchedContentType ?? null,
                retrievedAt: args.input.fetchedRetrievedAt ?? null,
                pageTitle: args.input.fetchedPageTitle ?? null,
                extractorVersion: args.input.fetchedExtractorVersion ?? null,
                resolverVersion: args.input.fetchedResolverVersion ?? null,
                extractionChecksum: args.input.fetchedExtractionChecksum ?? null,
                diagnostics: args.input.fetchedDiagnostics ?? null
              }
            : null
      },
      active: true
    }
  });

  if (args.linkApplicationId) {
    await args.transaction.application.update({
      where: {
        id: args.linkApplicationId
      },
      data: {
        currentJobDescriptionVersionId: version.id
      }
    });
  }

  const hydratedVersion = await getJobDescriptionVersionById(
    args.workspaceId,
    version.id,
    args.transaction
  );

  if (!hydratedVersion) {
    throw new Error("Job description version not found after creation.");
  }

  return {
    version: hydratedVersion,
    duplicate: false,
    opportunityId: args.opportunityId,
    applicationId: args.linkApplicationId ?? null
  };
}

export async function saveJobDescriptionForApplication(
  workspaceId: string,
  applicationId: string,
  input: SaveApplicationJobDescriptionInput,
  prismaClient: PrismaClient = prisma,
  options?: { simulateFailureAfterSupersede?: boolean }
) {
  return prismaClient.$transaction(async (transaction) => {
    const application = await transaction.application.findFirst({
      where: {
        id: applicationId,
        workspaceId
      },
      select: {
        id: true,
        opportunityId: true
      }
    });

    if (!application) {
      throw new JobDescriptionSubmissionError(
        { descriptionText: ["Application not found."] },
        "Application not found."
      );
    }

    return persistJobDescriptionVersion({
      transaction,
      workspaceId,
      opportunityId: application.opportunityId,
      linkApplicationId: application.id,
      sourceApplicationId: application.id,
      input,
      createdByWorkflow: "applications.detail.job-description",
      simulateFailureAfterSupersede: options?.simulateFailureAfterSupersede
    });
  });
}

export async function saveJobDescriptionForOpportunity(
  workspaceId: string,
  opportunityId: string,
  input: SaveApplicationJobDescriptionInput,
  prismaClient: PrismaClient = prisma,
  options?: { simulateFailureAfterSupersede?: boolean }
) {
  return prismaClient.$transaction(async (transaction) => {
    const opportunity = await transaction.jobOpportunity.findFirst({
      where: {
        id: opportunityId,
        workspaceId
      },
      select: {
        id: true
      }
    });

    if (!opportunity) {
      throw new JobDescriptionSubmissionError(
        { descriptionText: ["Job opportunity not found."] },
        "Job opportunity not found."
      );
    }

    return persistJobDescriptionVersion({
      transaction,
      workspaceId,
      opportunityId: opportunity.id,
      input,
      createdByWorkflow: "jobs.detail.job-description",
      simulateFailureAfterSupersede: options?.simulateFailureAfterSupersede
    });
  });
}

export async function createJobDescriptionForNewOpportunity(
  workspaceId: string,
  input: CreateStandaloneJobDescriptionInput,
  prismaClient: PrismaClient = prisma,
  options?: { simulateFailureAfterSupersede?: boolean }
) {
  return prismaClient.$transaction(async (transaction) => {
    const company = await findOrCreateCompany(
      transaction,
      workspaceId,
      input.companyName
    );
    const opportunity = await resolveOpportunityForJobDescriptionIntake({
      transaction,
      workspaceId,
      companyId: company.id,
      role: input.role,
      jobUrl: input.jobUrl,
      source: input.opportunitySource,
      capturedAt: new Date()
    });

    return persistJobDescriptionVersion({
      transaction,
      workspaceId,
      opportunityId: opportunity.id,
      input,
      createdByWorkflow: "jobs.new.job-description",
      simulateFailureAfterSupersede: options?.simulateFailureAfterSupersede
    });
  });
}

export async function getJobDescriptionVersionById(
  workspaceId: string,
  versionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.jobDescriptionVersion.findFirst({
    where: {
      id: versionId,
      workspaceId
    },
    include: {
      workspace: {
        select: {
          id: true
        }
      },
      opportunity: {
        include: {
          company: true
        }
      },
      sourceApplication: {
        select: {
          id: true
        }
      },
      currentForApplications: {
        select: {
          id: true
        },
        orderBy: {
          createdAt: "asc"
        }
      },
      predecessor: {
        select: {
          id: true,
          versionNumber: true,
          active: true
        }
      },
      successors: {
        select: {
          id: true,
          versionNumber: true,
          active: true
        },
        orderBy: {
          versionNumber: "asc"
        }
      }
    }
  });
}

export async function getApplicationJobDescriptionIntakeContext(
  workspaceId: string,
  applicationId: string,
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.application.findFirst({
    where: {
      id: applicationId,
      workspaceId
    },
    include: {
      opportunity: {
        include: {
          company: true,
          jobDescriptionVersions: {
            orderBy: {
              versionNumber: "desc"
            },
            take: 1
          }
        }
      },
      currentJobDescriptionVersion: {
        select: {
          id: true,
          versionNumber: true,
          originalText: true,
          normalizedText: true,
          sourceUrl: true,
          sourceType: true,
          sourceTitle: true,
          publishedAt: true,
          active: true,
          checksum: true,
          capturedAt: true
        }
      }
    }
  });
}

export async function getJobOpportunityJobDescriptionIntakeContext(
  workspaceId: string,
  opportunityId: string,
  prismaClient: PrismaClient = prisma
) {
  return prismaClient.jobOpportunity.findFirst({
    where: {
      id: opportunityId,
      workspaceId
    },
    include: {
      company: true,
      applications: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          status: true
        }
      },
      jobDescriptionVersions: {
        where: {
          active: true
        },
        orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          originalText: true,
          normalizedText: true,
          sourceUrl: true,
          sourceType: true,
          sourceTitle: true,
          publishedAt: true,
          active: true,
          checksum: true,
          capturedAt: true
        }
      }
    }
  });
}

export async function getCareerKnowledgeIndicator(workspaceId: string) {
  const latestVersion = await getLatestCareerProfileVersion(workspaceId);

  if (!latestVersion) {
    return {
      available: false as const,
      label: "Career Knowledge unavailable"
    };
  }

  return {
    available: true as const,
    label: `Career Knowledge: Version ${latestVersion.schemaVersion} available`
  };
}

export function summarizeJobDescriptionVersion(version: {
  originalText: string;
  sourceUrl: string | null;
  sourceType: JobDescriptionSourceType;
  capturedAt: Date;
  versionNumber: number;
  active: boolean;
}) {
  return {
    sourceUrl: version.sourceUrl,
    sourceType: version.sourceType,
    capturedAt: version.capturedAt,
    versionNumber: version.versionNumber,
    active: version.active,
    characterCount: version.originalText.length,
    wordCount: countJobDescriptionWords(version.originalText)
  };
}
