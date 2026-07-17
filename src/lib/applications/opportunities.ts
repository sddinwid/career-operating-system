import {
  JobOpportunityStatus,
  type Prisma,
  type WorkArrangement
} from "@prisma/client";
import {
  canonicalizeJobUrl,
  type OpportunityChoice
} from "@/lib/applications/opportunity-shared";

type OpportunityCandidate = {
  id: string;
  title: string;
  jobUrl: string | null;
  location: string | null;
  workArrangement: WorkArrangement | null;
  company: {
    id: string;
    normalizedName: string;
    name: string;
  };
};

type ResolveOpportunityArgs = {
  transaction: Prisma.TransactionClient;
  workspaceId: string;
  companyId: string;
  title: string;
  jobUrl?: string;
  source?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  location?: string;
  workArrangement?: WorkArrangement;
  appliedAt: Date;
  existingOpportunity?: {
    id: string;
    companyId: string;
    title: string;
    jobUrl: string | null;
    source: string | null;
    salaryMin: Prisma.Decimal | null;
    salaryMax: Prisma.Decimal | null;
    salaryCurrency: string | null;
    location: string | null;
    workArrangement: WorkArrangement | null;
  };
};

function normalizeComparableValue(value: string | null | undefined) {
  return value?.trim() || null;
}

function numericValue(value: Prisma.Decimal | number | null | undefined) {
  return value == null ? null : Number(value);
}

function opportunityMatchesDesiredState(
  existing: NonNullable<ResolveOpportunityArgs["existingOpportunity"]>,
  desired: ResolveOpportunityArgs
) {
  return (
    existing.companyId === desired.companyId &&
    existing.title === desired.title.trim() &&
    (canonicalizeJobUrl(existing.jobUrl) ?? null) ===
      (canonicalizeJobUrl(desired.jobUrl) ?? null) &&
    normalizeComparableValue(existing.source) ===
      normalizeComparableValue(desired.source) &&
    numericValue(existing.salaryMin) === (desired.salaryMin ?? null) &&
    numericValue(existing.salaryMax) === (desired.salaryMax ?? null) &&
    normalizeComparableValue(existing.salaryCurrency) ===
      normalizeComparableValue(desired.salaryCurrency) &&
    normalizeComparableValue(existing.location) ===
      normalizeComparableValue(desired.location) &&
    (existing.workArrangement ?? null) === (desired.workArrangement ?? null)
  );
}

async function findExactUrlOpportunity(
  transaction: Prisma.TransactionClient,
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

export async function resolveOpportunityForApplication(
  args: ResolveOpportunityArgs
) {
  const exactUrlMatch = await findExactUrlOpportunity(
    args.transaction,
    args.workspaceId,
    args.companyId,
    args.jobUrl
  );

  if (exactUrlMatch) {
    if (args.existingOpportunity && exactUrlMatch.id === args.existingOpportunity.id) {
      return args.transaction.jobOpportunity.update({
        where: { id: exactUrlMatch.id },
        data: {
          companyId: args.companyId,
          title: args.title.trim(),
          jobUrl: normalizeComparableValue(args.jobUrl),
          source: normalizeComparableValue(args.source),
          salaryMin: args.salaryMin,
          salaryMax: args.salaryMax,
          salaryCurrency: normalizeComparableValue(args.salaryCurrency),
          location: normalizeComparableValue(args.location),
          workArrangement: args.workArrangement,
          status: JobOpportunityStatus.APPLIED,
          capturedAt: args.appliedAt
        }
      });
    }

    return exactUrlMatch;
  }

  if (args.existingOpportunity) {
    if (opportunityMatchesDesiredState(args.existingOpportunity, args)) {
      return args.existingOpportunity;
    }

    const applicationCount = await args.transaction.application.count({
      where: {
        opportunityId: args.existingOpportunity.id
      }
    });

    if (applicationCount <= 1) {
      return args.transaction.jobOpportunity.update({
        where: { id: args.existingOpportunity.id },
        data: {
          companyId: args.companyId,
          title: args.title.trim(),
          jobUrl: normalizeComparableValue(args.jobUrl),
          source: normalizeComparableValue(args.source),
          salaryMin: args.salaryMin,
          salaryMax: args.salaryMax,
          salaryCurrency: normalizeComparableValue(args.salaryCurrency),
          location: normalizeComparableValue(args.location),
          workArrangement: args.workArrangement,
          status: JobOpportunityStatus.APPLIED,
          capturedAt: args.appliedAt
        }
      });
    }
  }

  return args.transaction.jobOpportunity.create({
    data: {
      workspaceId: args.workspaceId,
      companyId: args.companyId,
      title: args.title.trim(),
      jobUrl: normalizeComparableValue(args.jobUrl),
      source: normalizeComparableValue(args.source),
      salaryMin: args.salaryMin,
      salaryMax: args.salaryMax,
      salaryCurrency: normalizeComparableValue(args.salaryCurrency),
      location: normalizeComparableValue(args.location),
      workArrangement: args.workArrangement,
      status: JobOpportunityStatus.APPLIED,
      capturedAt: args.appliedAt
    }
  });
}

export function toOpportunityChoice(candidate: OpportunityCandidate): OpportunityChoice {
  return {
    ...candidate,
    canonicalJobUrl: canonicalizeJobUrl(candidate.jobUrl)
  };
}
