import { describe, expect, it, vi } from "vitest";
import { listJobWorkspaceSummaries } from "@/lib/jobs/service";

describe("jobs service", () => {
  it("keeps unlinked opportunities visible and derives deterministic current workflow state", async () => {
    const prismaClient = {
      jobOpportunity: {
        findMany: vi.fn(async () => [
          {
            id: "job-1",
            title: "Software Engineer (All Levels)",
            jobUrl: "https://www.fieldguide.io/careers/software-engineer-all-levels",
            source: "LinkedIn",
            location: "Remote",
            workArrangement: "REMOTE",
            capturedAt: new Date("2026-07-18T12:00:00.000Z"),
            company: { name: "Fieldguide" },
            applications: [],
            jobDescriptionVersions: [
              {
                id: "jd-2",
                versionNumber: 2,
                active: true,
                createdAt: new Date("2026-07-18T12:05:00.000Z"),
                capturedAt: new Date("2026-07-18T12:05:00.000Z"),
                currentForApplications: [],
                parses: [
                  {
                    id: "parse-1",
                    status: "SUCCESS_WITH_WARNINGS",
                    parserVersion: "m3.2.4",
                    createdAt: new Date("2026-07-18T12:06:00.000Z")
                  }
                ],
                requirementAnalyses: [
                  {
                    id: "analysis-1",
                    status: "CONFIRMED",
                    classifierVersion: "m3.3.2",
                    confirmedAt: new Date("2026-07-18T12:10:00.000Z"),
                    createdAt: new Date("2026-07-18T12:10:00.000Z"),
                    analysis: {
                      id: "analysis-1",
                      contractVersion: "m3.3",
                      classifierVersion: "m3.3.2",
                      parserVersion: "m3.2.4",
                      sourceChecksum: "abc",
                      reviewStatus: "CONFIRMED",
                      diagnostics: [],
                      requirements: [],
                      responsibilities: [],
                      summary: {
                        requiredCount: 1,
                        preferredCount: 1,
                        qualificationExtractionCount: 2,
                        responsibilityExtractionCount: 1,
                        downstreamReadiness: "READY"
                      }
                    }
                  }
                ],
                evidenceRetrievalRuns: [
                  {
                    id: "retrieval-1",
                    status: "SUCCESS",
                    engineVersion: "m4.1.0",
                    contractVersion: "m4.1.0",
                    summary: {
                      noCandidateCount: 0,
                      limitedCandidateCount: 0
                    },
                    createdAt: new Date("2026-07-18T12:15:00.000Z")
                  }
                ],
                evidenceScoringRuns: [
                  {
                    id: "score-1",
                    status: "SUCCESS",
                    evidenceRetrievalRunId: "retrieval-1",
                    createdAt: new Date("2026-07-18T12:20:00.000Z")
                  }
                ],
                matchReportRuns: [
                  {
                    id: "report-1",
                    status: "SUCCESS",
                    evidenceScoringRunId: "score-1",
                    summary: {
                      resumeReadinessState: "READY"
                    },
                    createdAt: new Date("2026-07-18T12:25:00.000Z")
                  }
                ],
                structuredResumeVersions: [],
                resumeCompositionVersions: [],
                resumeAuditRuns: [],
                resumeRenderingApprovals: [],
                documentVersions: []
              }
            ]
          }
        ])
      }
    } as never;

    const jobs = await listJobWorkspaceSummaries("workspace-1", {}, prismaClient);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.companyName).toBe("Fieldguide");
    expect(jobs[0]?.linkedApplication).toBeNull();
    expect(jobs[0]?.currentJobDescription?.id).toBe("jd-2");
    expect(jobs[0]?.latestSuccessfulParse?.parserVersion).toBe("m3.2.4");
    expect(jobs[0]?.latestConfirmedAnalysis?.classifierVersion).toBe("m3.3.2");
    expect(jobs[0]?.downstreamReadiness).toBe("READY");
    expect(jobs[0]?.statusLabels.retrieval).toBe("Evidence retrieved");
    expect(jobs[0]?.statusLabels.matchReport).toBe("Resume generation ready");
  });
});
