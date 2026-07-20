import { randomUUID } from "node:crypto";
import {
  JobRequirementAnalysisStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  JOB_REQUIREMENT_CLASSIFIER_VERSION,
  jobRequirementAnalysisContractSchema,
  requirementKindSchema,
  type AnalyzedRequirement,
  type AnalyzedResponsibility,
  type JobRequirementAnalysisContract,
  type RequirementCategory,
  type RequirementKind
} from "@/lib/job-descriptions/requirement-analysis-contract";
import { buildInitialRequirementAnalysisDraft, recomputeRequirementAnalysis } from "@/lib/job-descriptions/requirement-classifier";
import { parsedJobDescriptionContractSchema } from "@/lib/job-descriptions/parser-contract";
import { resolveSectionHeading } from "@/lib/job-descriptions/section-aliases";

type TransactionClient = Prisma.TransactionClient;

export class RequirementAnalysisSubmissionError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>, message: string) {
    super(message);
    this.name = "RequirementAnalysisSubmissionError";
    this.fieldErrors = fieldErrors;
  }
}

export type JobRequirementAnalysisDetail = NonNullable<
  Awaited<ReturnType<typeof getJobRequirementAnalysisById>>
>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function normalizeStoredJobRequirementAnalysis(value: Prisma.JsonValue) {
  const topLevel = z.record(z.unknown()).parse(value);
  const requirements = Array.isArray(topLevel.requirements)
    ? topLevel.requirements.map((requirement) => {
        if (!isPlainObject(requirement) || hasOwn(requirement, "levelApplicability")) {
          return requirement;
        }

        return {
          ...requirement,
          // Older analyses predate applicability tracking, so preserve their prior
          // semantics by treating missing values as all-level rather than inventing
          // narrower scope.
          levelApplicability: "ALL_LEVELS"
        };
      })
    : topLevel.requirements;
  const responsibilities = Array.isArray(topLevel.responsibilities)
    ? topLevel.responsibilities
    : topLevel.responsibilities;
  const summary = isPlainObject(topLevel.summary) ? topLevel.summary : topLevel.summary;

  if (!isPlainObject(summary)) {
    return {
      ...topLevel,
      requirements
    };
  }

  const normalizedSummary = {
    ...summary
  };

  if (!hasOwn(normalizedSummary, "qualificationExtractionCount")) {
    normalizedSummary.qualificationExtractionCount = Array.isArray(requirements)
      ? requirements.filter(
          (requirement) =>
            isPlainObject(requirement) && requirement.userAdded !== true
        ).length
      : 0;
  }

  if (!hasOwn(normalizedSummary, "responsibilityExtractionCount")) {
    // Responsibility extraction count tracks all source-derived responsibility
    // records, regardless of later review exclusions.
    normalizedSummary.responsibilityExtractionCount = Array.isArray(responsibilities)
      ? responsibilities.length
      : 0;
  }

  if (!hasOwn(normalizedSummary, "downstreamReadiness")) {
    normalizedSummary.downstreamReadiness = "NEEDS_REVIEW";
  }

  return {
    ...topLevel,
    requirements,
    summary: normalizedSummary
  };
}

export function parseStoredJobRequirementAnalysis(value: Prisma.JsonValue) {
  return jobRequirementAnalysisContractSchema.parse(
    normalizeStoredJobRequirementAnalysis(value)
  );
}

function parseStoredAnalysis(value: Prisma.JsonValue) {
  return parseStoredJobRequirementAnalysis(value);
}

function inferLegacySectionListOrientation(section: Record<string, unknown>) {
  const text = typeof section.text === "string" ? section.text : "";

  return /^\s*([-*•]|\d+\.)\s+/m.test(text) ? "LIST" : "PARAGRAPH";
}

function normalizeStoredParseResult(value: Prisma.JsonValue) {
  const topLevel = z.record(z.unknown()).parse(value);
  const rawSections = Array.isArray(topLevel.sections) ? topLevel.sections : topLevel.sections;

  if (!Array.isArray(rawSections)) {
    return topLevel;
  }

  const normalizedSections = rawSections.map((section) => {
    if (!isPlainObject(section)) {
      return section;
    }

    const heading = typeof section.heading === "string" ? section.heading : "";
    const headingMatch = heading ? resolveSectionHeading(heading) : null;

    return {
      ...section,
      canonicalHeading:
        typeof section.canonicalHeading === "string" && section.canonicalHeading.length > 0
          ? section.canonicalHeading
          : ((headingMatch?.canonicalHeading ?? heading) || "Other"),
      hierarchyDepth:
        typeof section.hierarchyDepth === "number"
          ? section.hierarchyDepth
          : (headingMatch?.hierarchyDepth ?? 0),
      levelApplicability:
        typeof section.levelApplicability === "string"
          ? section.levelApplicability
          : (headingMatch?.levelApplicability ?? "UNSPECIFIED"),
      listOrientation:
        typeof section.listOrientation === "string"
          ? section.listOrientation
          : (headingMatch?.listOrientation ?? inferLegacySectionListOrientation(section)),
      __legacyParentType:
        !hasOwn(section, "parentSectionId") && headingMatch?.parentType
          ? headingMatch.parentType
          : null
    };
  });

  const idsByType = new Map<string, string[]>();
  for (const section of normalizedSections) {
    if (!isPlainObject(section)) {
      continue;
    }

    if (typeof section.type !== "string" || typeof section.id !== "string") {
      continue;
    }

    const existing = idsByType.get(section.type) ?? [];
    existing.push(section.id);
    idsByType.set(section.type, existing);
  }

  const hydratedSections = normalizedSections.map((section) => {
    if (!isPlainObject(section)) {
      return section;
    }

    const parentType = typeof section.__legacyParentType === "string" ? section.__legacyParentType : null;
    const parentIds = parentType ? idsByType.get(parentType) ?? [] : [];
    const parentSectionId =
      hasOwn(section, "parentSectionId") && (typeof section.parentSectionId === "string" || section.parentSectionId === null)
        ? section.parentSectionId
        : (parentIds[0] ?? null);

    const { __legacyParentType, ...rest } = section;

    return {
      ...rest,
      parentSectionId
    };
  });

  return {
    ...topLevel,
    sections: hydratedSections
  };
}

function parseStoredParseResult(value: Prisma.JsonValue | null) {
  if (!value) {
    throw new Error("The linked parser result is missing.");
  }

  return parsedJobDescriptionContractSchema.parse(normalizeStoredParseResult(value));
}

function toDbStatus(status: JobRequirementAnalysisContract["reviewStatus"]) {
  return JobRequirementAnalysisStatus[status];
}

function summarizeFailure(message: string) {
  return message || "The requirement analysis could not be saved.";
}

async function createAnalysisRecord(args: {
  transaction: TransactionClient;
  workspaceId: string;
  jobDescriptionVersionId: string;
  jobDescriptionParseId: string;
  predecessorId?: string | null;
  analysis: JobRequirementAnalysisContract;
  createdByWorkflow: string;
  confirmedAt?: Date | null;
  supersededAt?: Date | null;
  acknowledgement?: Prisma.InputJsonValue | typeof Prisma.DbNull;
  errorSummary?: string | null;
}) {
  return args.transaction.jobRequirementAnalysis.create({
    data: {
      id: args.analysis.id,
      workspaceId: args.workspaceId,
      jobDescriptionVersionId: args.jobDescriptionVersionId,
      jobDescriptionParseId: args.jobDescriptionParseId,
      predecessorId: args.predecessorId ?? null,
      contractVersion: args.analysis.contractVersion,
      classifierVersion: args.analysis.classifierVersion,
      sourceChecksum: args.analysis.sourceChecksum,
      parserVersion: args.analysis.parserVersion,
      status: toDbStatus(args.analysis.reviewStatus),
      analysis: args.analysis,
      diagnostics: args.analysis.diagnostics,
      createdByWorkflow: args.createdByWorkflow,
      acknowledgement: args.acknowledgement ?? Prisma.DbNull,
      errorSummary: args.errorSummary ?? null,
      confirmedAt: args.confirmedAt ?? null,
      supersededAt: args.supersededAt ?? null
    }
  });
}

export async function getJobRequirementAnalysisById(
  workspaceId: string,
  analysisId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.jobRequirementAnalysis.findFirst({
    where: {
      id: analysisId,
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
            select: { id: true },
            orderBy: { createdAt: "asc" }
          },
          sourceApplication: {
            select: { id: true }
          }
        }
      },
      jobDescriptionParse: true,
      predecessor: {
        select: {
          id: true,
          status: true
        }
      },
      successors: {
        select: {
          id: true,
          status: true
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      }
    }
  });
}

export async function getLatestJobRequirementAnalysisForVersion(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.jobRequirementAnalysis.findFirst({
    where: {
      workspaceId,
      jobDescriptionVersionId,
      status: {
        not: JobRequirementAnalysisStatus.SUPERSEDED
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

async function getLatestAnalysisForParseAndClassifier(
  workspaceId: string,
  jobDescriptionParseId: string,
  prismaClient: PrismaClient | TransactionClient,
  classifierVersion = JOB_REQUIREMENT_CLASSIFIER_VERSION
) {
  return prismaClient.jobRequirementAnalysis.findFirst({
    where: {
      workspaceId,
      jobDescriptionParseId,
      classifierVersion
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

export async function ensureRequirementAnalysisDraft(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
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
          select: { id: true },
          orderBy: { createdAt: "asc" }
        },
        sourceApplication: {
          select: { id: true }
        },
        parses: {
          where: {
            status: {
              in: ["SUCCESS", "SUCCESS_WITH_WARNINGS"]
            }
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1
        }
      }
    });

    if (!version) {
      throw new Error("Job description version not found.");
    }

    const parse = version.parses[0];
    if (!parse?.result) {
      throw new Error("A successful parser result is required before reviewing requirements.");
    }

    const existing = await getLatestAnalysisForParseAndClassifier(
      workspaceId,
      parse.id,
      transaction
    );
    if (
      existing &&
      (existing.status === JobRequirementAnalysisStatus.DRAFT ||
        existing.status === JobRequirementAnalysisStatus.NEEDS_REVIEW ||
        existing.status === JobRequirementAnalysisStatus.CONFIRMED)
    ) {
      return {
        analysis: await getJobRequirementAnalysisById(workspaceId, existing.id, transaction),
        duplicate: true,
        created: false
      };
    }

    const analysisId = randomUUID();
    const parsed = parseStoredParseResult(parse.result);
    const draft = buildInitialRequirementAnalysisDraft({
      analysisId,
      workspaceId,
      parseId: parse.id,
      parsed
    });

    await createAnalysisRecord({
      transaction,
      workspaceId,
      jobDescriptionVersionId: version.id,
      jobDescriptionParseId: parse.id,
      analysis: draft,
      createdByWorkflow: "job-descriptions.requirements.draft"
    });

    return {
      analysis: await getJobRequirementAnalysisById(workspaceId, analysisId, transaction),
      duplicate: false,
      created: true
    };
  });
}

function requireEditableStatus(analysis: JobRequirementAnalysisContract) {
  if (analysis.reviewStatus === "CONFIRMED" || analysis.reviewStatus === "SUPERSEDED") {
    throw new RequirementAnalysisSubmissionError(
      {},
      "Confirmed analyses cannot be edited in place. Create a revised analysis instead."
    );
  }
}

async function loadEditableAnalysis(
  workspaceId: string,
  analysisId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  const record = await prismaClient.jobRequirementAnalysis.findFirst({
    where: {
      id: analysisId,
      workspaceId
    },
    include: {
      jobDescriptionParse: {
        select: {
          id: true,
          result: true
        }
      }
    }
  });

  if (!record) {
    throw new Error("Requirement analysis not found.");
  }

  const analysis = parseStoredAnalysis(record.analysis);
  const parsed = parseStoredParseResult(record.jobDescriptionParse.result);
  requireEditableStatus(analysis);

  return {
    record,
    analysis,
    parsed
  };
}

async function saveEditableAnalysis(args: {
  transaction: TransactionClient;
  recordId: string;
  analysis: JobRequirementAnalysisContract;
  acknowledgement?: Prisma.InputJsonValue | typeof Prisma.DbNull;
}) {
  return args.transaction.jobRequirementAnalysis.update({
    where: {
      id: args.recordId
    },
    data: {
      status: toDbStatus(args.analysis.reviewStatus),
      analysis: args.analysis,
      diagnostics: args.analysis.diagnostics,
      acknowledgement: args.acknowledgement ?? Prisma.DbNull,
      errorSummary:
        args.analysis.reviewStatus === "FAILED"
          ? summarizeFailure("The requirement analysis draft failed validation.")
          : null
    }
  });
}

function updateRequirement(
  analysis: JobRequirementAnalysisContract,
  requirementId: string,
  updater: (requirement: AnalyzedRequirement) => AnalyzedRequirement
) {
  let found = false;
  const nextRequirements = analysis.requirements.map((requirement) =>
    requirement.id === requirementId
      ? ((found = true), updater(requirement))
      : requirement
  );
  if (!found) {
    throw new Error("Requirement not found.");
  }
  return {
    ...analysis,
    requirements: nextRequirements
  };
}

function updateResponsibility(
  analysis: JobRequirementAnalysisContract,
  responsibilityId: string,
  updater: (responsibility: AnalyzedResponsibility) => AnalyzedResponsibility
) {
  let found = false;
  const nextResponsibilities = analysis.responsibilities.map((responsibility) =>
    responsibility.id === responsibilityId
      ? ((found = true), updater(responsibility))
      : responsibility
  );
  if (!found) {
    throw new Error("Responsibility not found.");
  }
  return {
    ...analysis,
    responsibilities: nextResponsibilities
  };
}

export async function updateRequirementAnalysisRequirement(
  workspaceId: string,
  analysisId: string,
  input: {
    requirementId: string;
    category: RequirementCategory;
    kinds: RequirementKind[];
    note?: string | null;
    correctedDisplayText?: string | null;
    confirmed?: boolean;
  }
) {
  return prisma.$transaction(async (transaction) => {
    const { record, analysis, parsed } = await loadEditableAnalysis(
      workspaceId,
      analysisId,
      transaction
    );
    const next = updateRequirement(analysis, input.requirementId, (requirement) => ({
      ...requirement,
      category: input.category,
      kinds: input.kinds,
      reviewNote: input.note?.trim() || null,
      correctedDisplayText: input.correctedDisplayText?.trim() || null,
      confirmationState: input.confirmed ? "CONFIRMED" : requirement.confirmationState,
      userOverrideState: {
        ...requirement.userOverrideState,
        categoryChanged: input.category !== requirement.category || requirement.userOverrideState.categoryChanged,
        kindsChanged:
          JSON.stringify(input.kinds) !== JSON.stringify(requirement.kinds) ||
          requirement.userOverrideState.kindsChanged,
        noteChanged:
          (input.note?.trim() || null) !== requirement.reviewNote ||
          requirement.userOverrideState.noteChanged,
        displayTextChanged:
          (input.correctedDisplayText?.trim() || null) !== requirement.correctedDisplayText ||
          requirement.userOverrideState.displayTextChanged,
        confirmationChanged:
          Boolean(input.confirmed) || requirement.userOverrideState.confirmationChanged
      }
    }));
    const recomputed = recomputeRequirementAnalysis(next, parsed);
    await saveEditableAnalysis({
      transaction,
      recordId: record.id,
      analysis: recomputed
    });

    return getJobRequirementAnalysisById(workspaceId, analysisId, transaction);
  });
}

export async function updateRequirementAnalysisResponsibility(
  workspaceId: string,
  analysisId: string,
  input: {
    responsibilityId: string;
    kinds?: RequirementKind[];
    note?: string | null;
    excluded?: boolean;
    confirmed?: boolean;
  }
) {
  return prisma.$transaction(async (transaction) => {
    const { record, analysis, parsed } = await loadEditableAnalysis(
      workspaceId,
      analysisId,
      transaction
    );
    const next = updateResponsibility(analysis, input.responsibilityId, (responsibility) => ({
      ...responsibility,
      kinds: input.kinds ?? responsibility.kinds,
      excluded: input.excluded ?? responsibility.excluded,
      reviewNote: input.note?.trim() || null,
      confirmationState: input.confirmed ? "CONFIRMED" : responsibility.confirmationState,
      userOverrideState: {
        ...responsibility.userOverrideState,
        kindsChanged:
          (input.kinds
            ? JSON.stringify(input.kinds) !== JSON.stringify(responsibility.kinds)
            : false) ||
          responsibility.userOverrideState.kindsChanged,
        exclusionChanged:
          (input.excluded ?? responsibility.excluded) !== responsibility.excluded ||
          responsibility.userOverrideState.exclusionChanged,
        noteChanged:
          (input.note?.trim() || null) !== responsibility.reviewNote ||
          responsibility.userOverrideState.noteChanged,
        confirmationChanged:
          Boolean(input.confirmed) || responsibility.userOverrideState.confirmationChanged
      }
    }));
    const recomputed = recomputeRequirementAnalysis(next, parsed);
    await saveEditableAnalysis({
      transaction,
      recordId: record.id,
      analysis: recomputed
    });

    return getJobRequirementAnalysisById(workspaceId, analysisId, transaction);
  });
}

export async function excludeRequirementAnalysisItem(
  workspaceId: string,
  analysisId: string,
  input: {
    itemType: "requirement" | "responsibility";
    itemId: string;
    excluded: boolean;
  }
) {
  if (input.itemType === "requirement") {
    return prisma.$transaction(async (transaction) => {
      const { record, analysis, parsed } = await loadEditableAnalysis(
        workspaceId,
        analysisId,
        transaction
      );
      const next = updateRequirement(analysis, input.itemId, (requirement) => ({
        ...requirement,
        excluded: input.excluded,
        userOverrideState: {
          ...requirement.userOverrideState,
          exclusionChanged: true
        }
      }));
      const recomputed = recomputeRequirementAnalysis(next, parsed);
      await saveEditableAnalysis({
        transaction,
        recordId: record.id,
        analysis: recomputed
      });
      return getJobRequirementAnalysisById(workspaceId, analysisId, transaction);
    });
  }

  return updateRequirementAnalysisResponsibility(workspaceId, analysisId, {
    responsibilityId: input.itemId,
    excluded: input.excluded
  });
}

export async function addUserRequirementToAnalysis(
  workspaceId: string,
  analysisId: string,
  input: {
    text: string;
    category: RequirementCategory;
    kinds: RequirementKind[];
    technologies?: string[];
    experienceText?: string | null;
    reviewNote?: string | null;
  }
) {
  return prisma.$transaction(async (transaction) => {
    const { record, analysis, parsed } = await loadEditableAnalysis(
      workspaceId,
      analysisId,
      transaction
    );
    if (!input.text.trim()) {
      throw new RequirementAnalysisSubmissionError(
        { text: ["Requirement text is required."] },
        "Requirement text is required."
      );
    }
    if (input.kinds.length === 0) {
      throw new RequirementAnalysisSubmissionError(
        { kinds: ["Select at least one requirement kind."] },
        "Select at least one requirement kind."
      );
    }

    const userRequirement: AnalyzedRequirement = {
      id: `user-requirement-${randomUUID()}`,
      parserStatementId: null,
      originalText: input.text.trim(),
      normalizedText: input.text.trim().toLowerCase(),
      correctedDisplayText: null,
      category: input.category,
      kinds: input.kinds,
      explicitSourceLabel: null,
      levelApplicability: "ALL_LEVELS",
      sourceSectionId: null,
      sourceGroupId: null,
      sourceSectionType: null,
      sourceLocation: null,
      technologies: input.technologies?.filter(Boolean) ?? [],
      experienceText: input.experienceText?.trim() || null,
      degreeRequirement: null,
      certificationRequirement: null,
      equivalencyText: null,
      domainReferences: [],
      leadershipReferences: [],
      confidence: "HIGH",
      classificationRule: "requirements.userAdded",
      parserProvenance: {
        parseId: analysis.parseId,
        parserVersion: analysis.parserVersion,
        parserStatementId: null,
        parserResponsibilityId: null,
        sourceSectionId: null
      },
      userOverrideState: {
        categoryChanged: false,
        kindsChanged: false,
        exclusionChanged: false,
        noteChanged: Boolean(input.reviewNote?.trim()),
        displayTextChanged: false,
        confirmationChanged: false
      },
      userAdded: true,
      excluded: false,
      reviewNote: input.reviewNote?.trim() || null,
      confirmationState: "UNCONFIRMED"
    };

    const next = {
      ...analysis,
      requirements: [
        ...analysis.requirements,
        userRequirement
      ]
    };

    const recomputed = recomputeRequirementAnalysis(next, parsed);
    await saveEditableAnalysis({
      transaction,
      recordId: record.id,
      analysis: recomputed
    });
    return getJobRequirementAnalysisById(workspaceId, analysisId, transaction);
  });
}

export async function applyRequirementAnalysisBulkAction(
  workspaceId: string,
  analysisId: string,
  action: "confirm-high-confidence" | "exclude-noise" | "restore-excluded"
) {
  return prisma.$transaction(async (transaction) => {
    const { record, analysis, parsed } = await loadEditableAnalysis(
      workspaceId,
      analysisId,
      transaction
    );
    let next = analysis;

    if (action === "confirm-high-confidence") {
      next = {
        ...analysis,
        requirements: analysis.requirements.map((item) =>
          item.confidence === "HIGH" && !item.excluded
            ? {
                ...item,
                confirmationState: "CONFIRMED",
                userOverrideState: {
                  ...item.userOverrideState,
                  confirmationChanged: true
                }
              }
            : item
        ),
        responsibilities: analysis.responsibilities.map((item) =>
          item.confidence === "HIGH" && !item.excluded
            ? {
                ...item,
                confirmationState: "CONFIRMED",
                userOverrideState: {
                  ...item.userOverrideState,
                  confirmationChanged: true
                }
              }
            : item
        )
      };
    } else if (action === "exclude-noise") {
      next = {
        ...analysis,
        requirements: analysis.requirements.map((item) =>
          item.category === "NOISE"
            ? {
                ...item,
                excluded: true,
                userOverrideState: {
                  ...item.userOverrideState,
                  exclusionChanged: true
                }
              }
            : item
        ),
        responsibilities: analysis.responsibilities.map((item) =>
          item.relevance === "NOISE"
            ? {
                ...item,
                excluded: true,
                userOverrideState: {
                  ...item.userOverrideState,
                  exclusionChanged: true
                }
              }
            : item
        )
      };
    } else {
      next = {
        ...analysis,
        requirements: analysis.requirements.map((item) =>
          item.excluded
            ? {
                ...item,
                excluded: false,
                userOverrideState: {
                  ...item.userOverrideState,
                  exclusionChanged: true
                }
              }
            : item
        ),
        responsibilities: analysis.responsibilities.map((item) =>
          item.excluded
            ? {
                ...item,
                excluded: false,
                userOverrideState: {
                  ...item.userOverrideState,
                  exclusionChanged: true
                }
              }
            : item
        )
      };
    }

    const recomputed = recomputeRequirementAnalysis(next, parsed);
    await saveEditableAnalysis({
      transaction,
      recordId: record.id,
      analysis: recomputed
    });
    return getJobRequirementAnalysisById(workspaceId, analysisId, transaction);
  });
}

export async function confirmRequirementAnalysis(
  workspaceId: string,
  analysisId: string,
  acknowledgeLowConfidence: boolean
) {
  return prisma.$transaction(async (transaction) => {
    const { record, analysis, parsed } = await loadEditableAnalysis(
      workspaceId,
      analysisId,
      transaction
    );
    const ready = recomputeRequirementAnalysis(
      {
        ...analysis,
        lowConfidenceAcknowledged: acknowledgeLowConfidence || analysis.lowConfidenceAcknowledged
      },
      parsed
    );

    if (
      ready.summary.lowConfidenceCount > 0 &&
      !ready.lowConfidenceAcknowledged
    ) {
      throw new RequirementAnalysisSubmissionError(
        { acknowledgeLowConfidence: ["Acknowledge low-confidence items before confirmation."] },
        "Acknowledge low-confidence items before confirmation."
      );
    }

    if (ready.requirements.some((item) => item.userAdded && item.kinds.length === 0)) {
      throw new RequirementAnalysisSubmissionError(
        { kinds: ["User-added requirements must have at least one kind."] },
        "User-added requirements must have at least one kind."
      );
    }

    const confirmedAt = new Date();
    const confirmed = recomputeRequirementAnalysis(ready, parsed, { confirmed: true });

    if (record.predecessorId) {
      await transaction.jobRequirementAnalysis.updateMany({
        where: {
          id: record.predecessorId,
          workspaceId,
          status: JobRequirementAnalysisStatus.CONFIRMED
        },
        data: {
          status: JobRequirementAnalysisStatus.SUPERSEDED,
          supersededAt: confirmedAt
        }
      });
    }

    await transaction.jobRequirementAnalysis.update({
      where: {
        id: record.id
      },
      data: {
        status: JobRequirementAnalysisStatus.CONFIRMED,
        analysis: confirmed,
        diagnostics: confirmed.diagnostics,
        confirmedAt,
        acknowledgement: confirmed.lowConfidenceAcknowledged
          ? { lowConfidenceAcknowledgedAt: confirmedAt.toISOString() }
          : Prisma.DbNull,
        errorSummary: null
      }
    });

    return getJobRequirementAnalysisById(workspaceId, analysisId, transaction);
  });
}

export async function createRevisedRequirementAnalysis(
  workspaceId: string,
  analysisId: string
) {
  return prisma.$transaction(async (transaction) => {
    const record = await getJobRequirementAnalysisById(workspaceId, analysisId, transaction);
    if (!record) {
      throw new Error("Requirement analysis not found.");
    }
    const base = parseStoredAnalysis(record.analysis);
    if (base.reviewStatus !== "CONFIRMED") {
      throw new RequirementAnalysisSubmissionError(
        {},
        "Only confirmed analyses can be revised."
      );
    }

    const newId = randomUUID();
    const revised = recomputeRequirementAnalysis({
      ...base,
      id: newId,
      createdAt: new Date().toISOString(),
      reviewStatus: "DRAFT",
      lowConfidenceAcknowledged: false
    }, parseStoredParseResult(record.jobDescriptionParse.result));

    await createAnalysisRecord({
      transaction,
      workspaceId,
      jobDescriptionVersionId: record.jobDescriptionVersionId,
      jobDescriptionParseId: record.jobDescriptionParseId,
      predecessorId: record.id,
      analysis: revised,
      createdByWorkflow: "job-descriptions.requirements.revision"
    });

    return getJobRequirementAnalysisById(workspaceId, newId, transaction);
  });
}

export async function getJobRequirementAnalysisContext(
  workspaceId: string,
  jobDescriptionVersionId: string,
  prismaClient: PrismaClient = prisma
) {
  const [version, latestAnalysis, latestConfirmedAnalysis] = await Promise.all([
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
          select: { id: true },
          orderBy: { createdAt: "asc" }
        },
        sourceApplication: {
          select: { id: true }
        },
        parses: {
          where: {
            status: {
              in: ["SUCCESS", "SUCCESS_WITH_WARNINGS"]
            }
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1
        }
      }
    }),
    getLatestJobRequirementAnalysisForVersion(workspaceId, jobDescriptionVersionId, prismaClient),
    prismaClient.jobRequirementAnalysis.findFirst({
      where: {
        workspaceId,
        jobDescriptionVersionId,
        status: JobRequirementAnalysisStatus.CONFIRMED
      },
      orderBy: [{ confirmedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }]
    })
  ]);

  if (!version) {
    return null;
  }

  return {
    version,
    latestParse: version.parses[0] ?? null,
    latestAnalysis,
    latestConfirmedAnalysis,
    latestAnalysisContract: latestAnalysis ? parseStoredAnalysis(latestAnalysis.analysis) : null,
    latestConfirmedContract: latestConfirmedAnalysis
      ? parseStoredAnalysis(latestConfirmedAnalysis.analysis)
      : null
  };
}

export function parseRequirementKinds(values: string[]) {
  const parsed = z.array(requirementKindSchema).safeParse(values);
  if (!parsed.success) {
    throw new RequirementAnalysisSubmissionError(
      { kinds: ["Select only supported requirement kinds."] },
      "Select only supported requirement kinds."
    );
  }

  return parsed.data;
}
