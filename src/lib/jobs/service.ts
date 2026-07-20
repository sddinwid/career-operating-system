import {
  DocumentFormat,
  DocumentRenderStatus,
  DocumentType,
  EvidenceRetrievalRunStatus,
  EvidenceScoringRunStatus,
  JobDescriptionParseStatus,
  JobRequirementAnalysisStatus,
  MatchReportRunStatus,
  ResumeAuditRunStatus,
  ResumeCompositionVersionStatus,
  ResumeRenderingApprovalStatus,
  StructuredResumeVersionStatus,
  type PrismaClient
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseStoredJobRequirementAnalysis } from "@/lib/job-descriptions/requirement-analysis-service";

type JobListFilters = {
  search?: string;
  parseState?: "all" | "parsed" | "unparsed" | "failed";
  reviewState?: "all" | "confirmed" | "needs-review" | "unreviewed";
  readiness?: "all" | "ready" | "needs-review" | "blocked";
  applicationLink?: "all" | "linked" | "unlinked";
  sort?: "updated" | "saved";
};

function toLabel(value: string) {
  return value.replace(/_/g, " ");
}

function rankDownstreamReadiness(value: string | null) {
  switch (value) {
    case "READY":
      return 0;
    case "NEEDS_REVIEW":
      return 1;
    default:
      return 2;
  }
}

function parseRequirementSummary(
  analysis: { analysis: unknown } | null | undefined
): { downstreamReadiness: string | null } | null {
  if (!analysis) {
    return null;
  }

  if (
    typeof analysis.analysis === "object" &&
    analysis.analysis !== null &&
    "summary" in analysis.analysis &&
    typeof (analysis.analysis as { summary?: unknown }).summary === "object" &&
    (analysis.analysis as { summary?: unknown }).summary !== null &&
    "downstreamReadiness" in ((analysis.analysis as { summary: Record<string, unknown> }).summary)
  ) {
    const summary = (analysis.analysis as {
      summary: { downstreamReadiness?: unknown };
    }).summary;

    if (typeof summary.downstreamReadiness === "string") {
      return {
        downstreamReadiness: summary.downstreamReadiness
      };
    }
  }

  try {
    const parsed = parseStoredJobRequirementAnalysis(
      analysis.analysis as Parameters<typeof parseStoredJobRequirementAnalysis>[0]
    );

    return {
      downstreamReadiness: parsed.summary.downstreamReadiness
    };
  } catch {
    return {
      downstreamReadiness: "NEEDS_REVIEW"
    };
  }
}

function normalizeSearch(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function selectCurrentJobDescription<
  T extends {
    id: string;
    versionNumber: number;
    active: boolean;
    createdAt: Date;
    capturedAt: Date;
  }
>(versions: T[]) {
  return (
    versions.find((version) => version.active) ??
    versions
      .slice()
      .sort((left, right) => {
        if (right.versionNumber !== left.versionNumber) {
          return right.versionNumber - left.versionNumber;
        }

        if (right.createdAt.getTime() !== left.createdAt.getTime()) {
          return right.createdAt.getTime() - left.createdAt.getTime();
        }

        return right.id.localeCompare(left.id);
      })[0] ??
    null
  );
}

function describeRetrievalState(args: {
  retrievalRun: {
    summary: unknown;
  } | null;
  downstreamReadiness: string | null;
  hasSuccessfulParse: boolean;
}) {
  if (args.retrievalRun?.summary && typeof args.retrievalRun.summary === "object") {
    const summary = args.retrievalRun.summary as {
      noCandidateCount?: number;
      limitedCandidateCount?: number;
    };

    if ((summary.noCandidateCount ?? 0) > 0 || (summary.limitedCandidateCount ?? 0) > 0) {
      return "Retrieved with gaps";
    }

    return "Evidence retrieved";
  }

  if (args.downstreamReadiness === "READY" && args.hasSuccessfulParse) {
    return "Ready to retrieve";
  }

  if (!args.hasSuccessfulParse) {
    return "Waiting on parse";
  }

  return args.downstreamReadiness === "NEEDS_REVIEW"
    ? "Waiting on requirement review"
    : "Blocked";
}

function describeScoringState(retrievalRunId: string | null, scoringRunId: string | null) {
  if (scoringRunId) {
    return "Evidence scored";
  }

  if (retrievalRunId) {
    return "Ready to score";
  }

  return "Blocked";
}

function describeMatchReportState(scoringRunId: string | null, reportSummary: unknown) {
  if (reportSummary && typeof reportSummary === "object") {
    const summary = reportSummary as {
      criticalRequiredGapCount?: number;
      resumeReadinessState?: string;
    };

    if ((summary.criticalRequiredGapCount ?? 0) > 0) {
      return "Report shows critical gaps";
    }

    if (summary.resumeReadinessState === "READY") {
      return "Resume generation ready";
    }

    if (summary.resumeReadinessState === "READY_WITH_LIMITATIONS") {
      return "Resume ready with limits";
    }

    return "Match report generated";
  }

  return scoringRunId ? "Ready to generate" : "Blocked";
}

function describeResumePlanState(plan: { status: string } | null, reportRunId: string | null) {
  if (plan) {
    if (plan.status === "READY_WITH_LIMITATIONS") {
      return "Plan ready with limits";
    }

    return "Structured plan generated";
  }

  return reportRunId ? "Ready to plan" : "Blocked";
}

function describeResumeCompositionState(
  composition: { status: string } | null,
  planId: string | null
) {
  if (composition) {
    if (composition.status === "READY_WITH_WARNINGS") {
      return "Resume composed with warnings";
    }

    return "Resume composed";
  }

  return planId ? "Ready to compose" : "Blocked";
}

function describeResumeAuditState(
  audit: { result: unknown } | null,
  compositionId: string | null
) {
  if (audit?.result && typeof audit.result === "object") {
    const result = audit.result as {
      renderingReadiness?: string;
      errorCount?: number;
      warningCount?: number;
    };

    if (result.renderingReadiness === "READY_FOR_RENDERING") {
      return "Ready for rendering";
    }

    if (result.renderingReadiness === "READY_WITH_WARNINGS") {
      return "Ready with warnings";
    }

    if (result.renderingReadiness === "NEEDS_REVIEW") {
      return "Needs review";
    }

    if (result.renderingReadiness === "BLOCKED") {
      return "Blocked by audit";
    }

    return "Audit completed";
  }

  return compositionId ? "Ready to audit" : "Blocked";
}

function describeApprovalState(approval: { renderingReadiness: string } | null, auditId: string | null) {
  if (approval) {
    return approval.renderingReadiness === "READY_WITH_WARNINGS"
      ? "Approved with warnings"
      : "Approved for rendering";
  }

  return auditId ? "Ready for approval" : "Blocked";
}

function latestArtifactForFormat(
  versions: Array<{
    id: string;
    format: DocumentFormat;
    generatedAt: Date;
    renderStatus: DocumentRenderStatus;
  }>,
  format: DocumentFormat
) {
  return (
    versions
      .filter((version) => version.format === format)
      .sort((left, right) => right.generatedAt.getTime() - left.generatedAt.getTime())[0] ?? null
  );
}

export async function listJobWorkspaceSummaries(
  workspaceId: string,
  filters: JobListFilters = {},
  prismaClient: PrismaClient = prisma
) {
  const opportunities = await prismaClient.jobOpportunity.findMany({
    where: {
      workspaceId
    },
    orderBy: [{ capturedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      jobUrl: true,
      source: true,
      location: true,
      workArrangement: true,
      capturedAt: true,
      company: {
        select: {
          name: true
        }
      },
      applications: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          status: true,
          archivedAt: true
        }
      },
      jobDescriptionVersions: {
        orderBy: [
          { active: "desc" },
          { versionNumber: "desc" },
          { createdAt: "desc" },
          { id: "desc" }
        ],
        select: {
          id: true,
          versionNumber: true,
          active: true,
          createdAt: true,
          capturedAt: true,
          currentForApplications: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true
            }
          },
          parses: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              status: true,
              parserVersion: true,
              createdAt: true
            }
          },
          requirementAnalyses: {
            where: {
              status: {
                not: JobRequirementAnalysisStatus.SUPERSEDED
              }
            },
            orderBy: [{ confirmedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              status: true,
              classifierVersion: true,
              confirmedAt: true,
              createdAt: true,
              analysis: true
            }
          },
          evidenceRetrievalRuns: {
            where: {
              status: {
                in: [
                  EvidenceRetrievalRunStatus.SUCCESS,
                  EvidenceRetrievalRunStatus.SUCCESS_WITH_WARNINGS
                ]
              }
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              status: true,
              engineVersion: true,
              contractVersion: true,
              summary: true,
              createdAt: true
            }
          },
          evidenceScoringRuns: {
            where: {
              status: {
                in: [
                  EvidenceScoringRunStatus.SUCCESS,
                  EvidenceScoringRunStatus.SUCCESS_WITH_WARNINGS
                ]
              }
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              status: true,
              evidenceRetrievalRunId: true,
              createdAt: true
            }
          },
          matchReportRuns: {
            where: {
              status: {
                in: [MatchReportRunStatus.SUCCESS, MatchReportRunStatus.SUCCESS_WITH_WARNINGS]
              }
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              status: true,
              evidenceScoringRunId: true,
              summary: true,
              createdAt: true
            }
          },
          structuredResumeVersions: {
            where: {
              status: {
                in: [
                  StructuredResumeVersionStatus.READY,
                  StructuredResumeVersionStatus.READY_WITH_LIMITATIONS,
                  StructuredResumeVersionStatus.NEEDS_REVIEW
                ]
              }
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              status: true,
              matchReportRunId: true,
              createdAt: true
            }
          },
          resumeCompositionVersions: {
            where: {
              status: {
                in: [
                  ResumeCompositionVersionStatus.READY,
                  ResumeCompositionVersionStatus.READY_WITH_WARNINGS,
                  ResumeCompositionVersionStatus.NEEDS_REVIEW
                ]
              }
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              status: true,
              createdAt: true
            }
          },
          resumeAuditRuns: {
            where: {
              status: {
                in: [
                  ResumeAuditRunStatus.PASSED,
                  ResumeAuditRunStatus.PASSED_WITH_WARNINGS,
                  ResumeAuditRunStatus.NEEDS_REVIEW
                ]
              }
            },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              status: true,
              result: true,
              createdAt: true
            }
          },
          resumeRenderingApprovals: {
            where: {
              status: ResumeRenderingApprovalStatus.APPROVED
            },
            orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              renderingReadiness: true,
              createdAt: true
            }
          },
          documentVersions: {
            where: {
              document: {
                type: DocumentType.RESUME
              },
              renderStatus: {
                in: [DocumentRenderStatus.SUCCESS, DocumentRenderStatus.SUCCESS_WITH_WARNINGS]
              }
            },
            orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
            select: {
              id: true,
              format: true,
              generatedAt: true,
              renderStatus: true,
              originalFilename: true
            }
          }
        }
      }
    }
  });

  const normalizedSearch = normalizeSearch(filters.search);

  const rows = opportunities
    .map((opportunity) => {
      const currentJobDescription = selectCurrentJobDescription(opportunity.jobDescriptionVersions);
      const latestParse = currentJobDescription?.parses[0] ?? null;
      const latestSuccessfulParse =
        currentJobDescription?.parses.find(
          (parse) =>
            parse.status === JobDescriptionParseStatus.SUCCESS ||
            parse.status === JobDescriptionParseStatus.SUCCESS_WITH_WARNINGS
        ) ?? null;
      const latestAnalysis =
        currentJobDescription?.requirementAnalyses
          .slice()
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;
      const latestConfirmedAnalysis =
        currentJobDescription?.requirementAnalyses.find(
          (analysis) => analysis.status === JobRequirementAnalysisStatus.CONFIRMED
        ) ?? null;
      const requirementSummary = parseRequirementSummary(latestConfirmedAnalysis ?? latestAnalysis);
      const downstreamReadiness = requirementSummary?.downstreamReadiness ?? null;
      const retrievalRun = currentJobDescription?.evidenceRetrievalRuns[0] ?? null;
      const scoringRun = currentJobDescription?.evidenceScoringRuns[0] ?? null;
      const matchReportRun = currentJobDescription?.matchReportRuns[0] ?? null;
      const structuredResume = currentJobDescription?.structuredResumeVersions[0] ?? null;
      const resumeComposition = currentJobDescription?.resumeCompositionVersions[0] ?? null;
      const resumeAudit = currentJobDescription?.resumeAuditRuns[0] ?? null;
      const renderingApproval = currentJobDescription?.resumeRenderingApprovals[0] ?? null;
      const latestDocx = currentJobDescription
        ? latestArtifactForFormat(currentJobDescription.documentVersions, DocumentFormat.DOCX)
        : null;
      const latestPdf = currentJobDescription
        ? latestArtifactForFormat(currentJobDescription.documentVersions, DocumentFormat.PDF)
        : null;
      const linkedApplication = opportunity.applications[0] ?? null;
      const updatedAt = [
        currentJobDescription?.createdAt,
        latestParse?.createdAt,
        latestAnalysis?.createdAt,
        retrievalRun?.createdAt,
        scoringRun?.createdAt,
        matchReportRun?.createdAt,
        structuredResume?.createdAt,
        resumeComposition?.createdAt,
        resumeAudit?.createdAt,
        renderingApproval?.createdAt,
        latestDocx?.generatedAt,
        latestPdf?.generatedAt
      ]
        .filter((value): value is Date => value instanceof Date)
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? opportunity.capturedAt;

      return {
        id: opportunity.id,
        companyName: opportunity.company.name,
        title: opportunity.title,
        canonicalUrl: opportunity.jobUrl,
        location: opportunity.location,
        workArrangement: opportunity.workArrangement ? toLabel(opportunity.workArrangement) : null,
        linkedApplication,
        currentJobDescription: currentJobDescription
          ? {
              id: currentJobDescription.id,
              versionNumber: currentJobDescription.versionNumber,
              capturedAt: currentJobDescription.capturedAt
            }
          : null,
        latestParse,
        latestSuccessfulParse,
        latestAnalysis,
        latestConfirmedAnalysis,
        downstreamReadiness,
        retrievalRun,
        scoringRun,
        matchReportRun,
        structuredResume,
        resumeComposition,
        resumeAudit,
        renderingApproval,
        latestDocx,
        latestPdf,
        statusLabels: {
          parse: latestParse ? toLabel(latestParse.status) : "Not parsed",
          requirement: latestAnalysis ? toLabel(latestAnalysis.status) : "Not reviewed",
          readiness:
            downstreamReadiness === "READY"
              ? "Ready"
              : downstreamReadiness === "NEEDS_REVIEW"
                ? "Needs review"
                : "Blocked",
          retrieval: describeRetrievalState({
            retrievalRun,
            downstreamReadiness,
            hasSuccessfulParse: Boolean(latestSuccessfulParse)
          }),
          scoring: describeScoringState(retrievalRun?.id ?? null, scoringRun?.id ?? null),
          matchReport: describeMatchReportState(scoringRun?.id ?? null, matchReportRun?.summary ?? null),
          plan: describeResumePlanState(structuredResume, matchReportRun?.id ?? null),
          composition: describeResumeCompositionState(resumeComposition, structuredResume?.id ?? null),
          audit: describeResumeAuditState(resumeAudit, resumeComposition?.id ?? null),
          approval: describeApprovalState(renderingApproval, resumeAudit?.id ?? null)
        },
        updatedAt,
        savedAt: currentJobDescription?.capturedAt ?? opportunity.capturedAt
      };
    })
    .filter((row) => {
      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        row.companyName,
        row.title,
        row.canonicalUrl ?? "",
        row.location ?? ""
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    })
    .filter((row) => {
      switch (filters.parseState ?? "all") {
        case "parsed":
          return Boolean(row.latestSuccessfulParse);
        case "unparsed":
          return !row.latestSuccessfulParse;
        case "failed":
          return row.latestParse?.status === JobDescriptionParseStatus.FAILED;
        default:
          return true;
      }
    })
    .filter((row) => {
      switch (filters.reviewState ?? "all") {
        case "confirmed":
          return row.latestAnalysis?.status === JobRequirementAnalysisStatus.CONFIRMED;
        case "needs-review":
          return row.latestAnalysis?.status === JobRequirementAnalysisStatus.NEEDS_REVIEW;
        case "unreviewed":
          return !row.latestAnalysis;
        default:
          return true;
      }
    })
    .filter((row) => {
      switch (filters.readiness ?? "all") {
        case "ready":
          return row.downstreamReadiness === "READY";
        case "needs-review":
          return row.downstreamReadiness === "NEEDS_REVIEW";
        case "blocked":
          return row.downstreamReadiness === "BLOCKED" || row.downstreamReadiness === null;
        default:
          return true;
      }
    })
    .filter((row) => {
      switch (filters.applicationLink ?? "all") {
        case "linked":
          return Boolean(row.linkedApplication);
        case "unlinked":
          return !row.linkedApplication;
        default:
          return true;
      }
    })
    .sort((left, right) => {
      if ((filters.sort ?? "updated") === "saved") {
        if (right.savedAt.getTime() !== left.savedAt.getTime()) {
          return right.savedAt.getTime() - left.savedAt.getTime();
        }

        return left.companyName.localeCompare(right.companyName);
      }

      if (right.updatedAt.getTime() !== left.updatedAt.getTime()) {
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      }

      const readinessOrder = rankDownstreamReadiness(left.downstreamReadiness) -
        rankDownstreamReadiness(right.downstreamReadiness);

      if (readinessOrder !== 0) {
        return readinessOrder;
      }

      return left.companyName.localeCompare(right.companyName);
    });

  return rows;
}

export async function getJobWorkspaceDetail(
  workspaceId: string,
  jobOpportunityId: string,
  prismaClient: PrismaClient = prisma
) {
  const [opportunity] = await Promise.all([
    prismaClient.jobOpportunity.findFirst({
      where: {
        id: jobOpportunityId,
        workspaceId
      },
      select: {
        id: true,
        title: true,
        jobUrl: true,
        source: true,
        location: true,
        workArrangement: true,
        capturedAt: true,
        company: {
          select: {
            name: true
          }
        },
        applications: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            status: true,
            createdAt: true
          }
        },
        jobDescriptionVersions: {
          orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            versionNumber: true,
            active: true,
            capturedAt: true,
            createdAt: true,
            sourceUrl: true,
            currentForApplications: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: { id: true }
            },
            parses: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                status: true,
                parserVersion: true,
                createdAt: true
              }
            },
            requirementAnalyses: {
              where: {
                status: {
                  not: JobRequirementAnalysisStatus.SUPERSEDED
                }
              },
              orderBy: [{ confirmedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                status: true,
                classifierVersion: true,
                confirmedAt: true,
                createdAt: true,
                analysis: true
              }
            },
            evidenceRetrievalRuns: {
              where: {
                status: {
                  in: [
                    EvidenceRetrievalRunStatus.SUCCESS,
                    EvidenceRetrievalRunStatus.SUCCESS_WITH_WARNINGS
                  ]
                }
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                status: true,
                summary: true,
                createdAt: true
              }
            },
            evidenceScoringRuns: {
              where: {
                status: {
                  in: [
                    EvidenceScoringRunStatus.SUCCESS,
                    EvidenceScoringRunStatus.SUCCESS_WITH_WARNINGS
                  ]
                }
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                status: true,
                evidenceRetrievalRunId: true,
                createdAt: true
              }
            },
            matchReportRuns: {
              where: {
                status: {
                  in: [MatchReportRunStatus.SUCCESS, MatchReportRunStatus.SUCCESS_WITH_WARNINGS]
                }
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                status: true,
                evidenceScoringRunId: true,
                summary: true,
                createdAt: true
              }
            },
            structuredResumeVersions: {
              where: {
                status: {
                  in: [
                    StructuredResumeVersionStatus.READY,
                    StructuredResumeVersionStatus.READY_WITH_LIMITATIONS,
                    StructuredResumeVersionStatus.NEEDS_REVIEW
                  ]
                }
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                status: true,
                createdAt: true
              }
            },
            resumeCompositionVersions: {
              where: {
                status: {
                  in: [
                    ResumeCompositionVersionStatus.READY,
                    ResumeCompositionVersionStatus.READY_WITH_WARNINGS,
                    ResumeCompositionVersionStatus.NEEDS_REVIEW
                  ]
                }
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                status: true,
                createdAt: true
              }
            },
            resumeAuditRuns: {
              where: {
                status: {
                  in: [
                    ResumeAuditRunStatus.PASSED,
                    ResumeAuditRunStatus.PASSED_WITH_WARNINGS,
                    ResumeAuditRunStatus.NEEDS_REVIEW
                  ]
                }
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                status: true,
                result: true,
                createdAt: true
              }
            },
            resumeRenderingApprovals: {
              where: {
                status: ResumeRenderingApprovalStatus.APPROVED
              },
              orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                renderingReadiness: true,
                createdAt: true
              }
            },
            documentVersions: {
              where: {
                renderStatus: {
                  in: [DocumentRenderStatus.SUCCESS, DocumentRenderStatus.SUCCESS_WITH_WARNINGS]
                }
              },
              orderBy: [{ generatedAt: "desc" }, { id: "desc" }],
              select: {
                id: true,
                format: true,
                originalFilename: true,
                generatedAt: true,
                renderStatus: true
              }
            }
          }
        }
      }
    })
  ]);

  if (!opportunity) {
    return null;
  }

  const summary = (
    await listJobWorkspaceSummaries(workspaceId, { sort: "updated" }, prismaClient)
  ).find((row) => row.id === jobOpportunityId);

  return {
    opportunity,
    summary: summary ?? null
  };
}
