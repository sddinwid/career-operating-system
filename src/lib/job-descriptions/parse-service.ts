import {
  JobDescriptionParseStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  JOB_DESCRIPTION_PARSE_CONTRACT_VERSION,
  JOB_DESCRIPTION_PARSER_VERSION,
  type ParsedJobDescriptionContract,
  type ParserDiagnostic
} from "@/lib/job-descriptions/parser-contract";
import { parseNormalizedJobDescription } from "@/lib/job-descriptions/parser";

type TransactionClient = Prisma.TransactionClient;

export type JobDescriptionParseDetail = NonNullable<
  Awaited<ReturnType<typeof getJobDescriptionParseById>>
>;

type ParseStoredVersionOptions = {
  simulateFailureAfterCreate?: boolean;
  parserVersionOverride?: string;
  contractVersionOverride?: string;
};

function summarizeFailure(diagnostics: ParserDiagnostic[]) {
  const firstError = diagnostics.find((diagnostic) => diagnostic.severity === "ERROR");
  return firstError?.message ?? "The parser could not produce a valid structured result.";
}

function buildStatusCounts(diagnostics: ParserDiagnostic[]) {
  return diagnostics.reduce(
    (counts, diagnostic) => {
      if (diagnostic.severity === "ERROR") {
        counts.errors += 1;
      } else if (diagnostic.severity === "WARNING") {
        counts.warnings += 1;
      } else {
        counts.info += 1;
      }

      return counts;
    },
    { errors: 0, warnings: 0, info: 0 }
  );
}

async function createParseRecord(args: {
  transaction: TransactionClient;
  workspaceId: string;
  jobDescriptionVersionId: string;
  parserVersion: string;
  contractVersion: string;
  sourceChecksum: string;
  diagnostics: ParserDiagnostic[];
  result: ParsedJobDescriptionContract | null;
  status: "SUCCESS" | "SUCCESS_WITH_WARNINGS" | "FAILED";
  createdByWorkflow: string;
  simulateFailureAfterCreate?: boolean;
}) {
  const completedAt = new Date();

  const record = await args.transaction.jobDescriptionParse.create({
    data: {
      workspaceId: args.workspaceId,
      jobDescriptionVersionId: args.jobDescriptionVersionId,
      parserVersion: args.parserVersion,
      contractVersion: args.contractVersion,
      sourceChecksum: args.sourceChecksum,
      status: args.status,
      diagnostics: args.diagnostics,
      result: args.result ?? Prisma.DbNull,
      createdByWorkflow: args.createdByWorkflow,
      errorSummary: args.status === "FAILED" ? summarizeFailure(args.diagnostics) : null,
      completedAt
    }
  });

  if (args.simulateFailureAfterCreate) {
    throw new Error("Simulated failure after creating parse record.");
  }

  return record;
}

export async function getJobDescriptionParseById(
  workspaceId: string,
  parseId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.jobDescriptionParse.findFirst({
    where: {
      id: parseId,
      workspaceId
    },
    include: {
      jobDescriptionVersion: {
        include: {
          opportunity: {
            include: {
              company: true
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
          sourceApplication: {
            select: {
              id: true
            }
          }
        }
      }
    }
  });
}

export async function getLatestJobDescriptionParseForVersion(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.jobDescriptionParse.findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function getLatestSuccessfulJobDescriptionParseForVersion(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.jobDescriptionParse.findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId,
      status: {
        in: [JobDescriptionParseStatus.SUCCESS, JobDescriptionParseStatus.SUCCESS_WITH_WARNINGS]
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function parseStoredJobDescriptionVersion(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma,
  options?: ParseStoredVersionOptions
) {
  return prismaClient.$transaction(async (transaction) => {
    const version = await transaction.jobDescriptionVersion.findFirst({
      where: {
        id: jobDescriptionVersionId,
        workspaceId
      },
      include: {
        opportunity: {
          include: {
            company: true
          }
        },
        currentForApplications: {
          select: {
            id: true
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!version) {
      throw new Error("Job description version not found.");
    }

    const existingSuccessful = await getLatestSuccessfulJobDescriptionParseForVersion(
      workspaceId,
      jobDescriptionVersionId,
      transaction
    );

    if (
      existingSuccessful &&
      existingSuccessful.parserVersion ===
        (options?.parserVersionOverride ?? JOB_DESCRIPTION_PARSER_VERSION) &&
      existingSuccessful.contractVersion ===
        (options?.contractVersionOverride ?? JOB_DESCRIPTION_PARSE_CONTRACT_VERSION)
    ) {
      const hydrated = await getJobDescriptionParseById(
        workspaceId,
        existingSuccessful.id,
        transaction
      );

      if (!hydrated) {
        throw new Error("Existing parse result could not be loaded.");
      }

      return {
        parse: hydrated,
        duplicate: true
      };
    }

    const parsed = parseNormalizedJobDescription({
      jobDescriptionVersionId: version.id,
      opportunityId: version.opportunityId,
      opportunityCompanyName: version.opportunity.company.name,
      opportunityRoleTitle: version.opportunity.title,
      sourceUrl: version.sourceUrl,
      sourceChecksum: version.checksum,
      normalizedText: version.normalizedText,
      parserVersion: options?.parserVersionOverride,
      contractVersion: options?.contractVersionOverride
    });

    const created = await createParseRecord({
      transaction,
      workspaceId,
      jobDescriptionVersionId: version.id,
      parserVersion: options?.parserVersionOverride ?? JOB_DESCRIPTION_PARSER_VERSION,
      contractVersion:
        options?.contractVersionOverride ?? JOB_DESCRIPTION_PARSE_CONTRACT_VERSION,
      sourceChecksum: version.checksum,
      diagnostics: parsed.diagnostics,
      result: parsed.result,
      status: parsed.status,
      createdByWorkflow: "job-descriptions.detail.parse",
      simulateFailureAfterCreate: options?.simulateFailureAfterCreate
    });

    const hydrated = await getJobDescriptionParseById(workspaceId, created.id, transaction);
    if (!hydrated) {
      throw new Error("Parse result not found after creation.");
    }

    return {
      parse: hydrated,
      duplicate: false
    };
  });
}

export async function getJobDescriptionAnalysisContext(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
) {
  const [version, latestParse, latestSuccessfulParse] = await Promise.all([
    prismaClient.jobDescriptionVersion.findFirst({
      where: {
        id: jobDescriptionVersionId,
        workspaceId
      },
      include: {
        opportunity: {
          include: {
            company: true
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
        sourceApplication: {
          select: {
            id: true
          }
        }
      }
    }),
    getLatestJobDescriptionParseForVersion(workspaceId, jobDescriptionVersionId, prismaClient),
    getLatestSuccessfulJobDescriptionParseForVersion(
      workspaceId,
      jobDescriptionVersionId,
      prismaClient
    )
  ]);

  if (!version) {
    return null;
  }

  return {
    version,
    latestParse,
    latestSuccessfulParse,
    latestParseStatusCounts: latestParse
      ? buildStatusCounts(latestParse.diagnostics as ParserDiagnostic[])
      : null
  };
}
