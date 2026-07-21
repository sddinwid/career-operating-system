import { describe, expect, it } from "vitest";
import { buildWorkflowReadiness } from "@/lib/workflow-readiness/service";

function createInput() {
  return {
    applicationId: "application-1",
    jobOpportunityId: "job-1",
    jobOpportunityTitle: "Senior Engineer",
    linkedApplicationId: "application-1",
    currentJobDescription: null,
    latestParse: null,
    latestAnalysis: null,
    latestConfirmedAnalysis: null,
    downstreamReadiness: null,
    retrievalRun: null,
    scoringRun: null,
    matchReportRun: null,
    structuredResume: null,
    resumeComposition: null,
    resumeAudit: null,
    resumeApproval: null,
    latestResumeDocx: null,
    latestResumePdf: null,
    coverLetterComposition: null,
    coverLetterDraft: null,
    coverLetterFinalizedRevision: null,
    coverLetterAudit: null,
    coverLetterApproval: null,
    latestCoverLetterDocx: null,
    latestCoverLetterPdf: null,
    latestDocumentId: null,
    returnTo: "/applications/application-1",
    paths: {
      jobDescriptionIntake: "/applications/application-1/job-description",
      jobDescriptionIntakeFromUrl: "/applications/application-1/job-description?sourceMode=url",
      currentJobDescription: "/job-descriptions/jd-1",
      parse: "/job-descriptions/jd-1/analysis",
      requirements: "/job-descriptions/jd-1/requirements",
      evidence: "/job-descriptions/jd-1/evidence",
      scores: "/job-descriptions/jd-1/evidence/scores",
      matchReport: "/job-descriptions/jd-1/match-report",
      resumePlan: "/job-descriptions/jd-1/resume-plan",
      resume: "/job-descriptions/jd-1/resume",
      resumeAudit: "/job-descriptions/jd-1/resume/audit",
      resumeStudio: "/job-descriptions/jd-1/resume/studio",
      coverLetter: "/job-descriptions/jd-1/cover-letter",
      coverLetterAudit: "/job-descriptions/jd-1/cover-letter/audit",
      coverLetterStudio: "/job-descriptions/jd-1/cover-letter/studio",
      documents: "/documents"
    }
  };
}

function stage(result: ReturnType<typeof buildWorkflowReadiness>, key: string) {
  const match = result.stages.find((item) => item.key === key);
  expect(match).toBeDefined();
  return match!;
}

describe("buildWorkflowReadiness", () => {
  it("starts with blocked downstream stages when no immutable job description exists", () => {
    const input = createInput();
    const snapshot = structuredClone(input);

    const readiness = buildWorkflowReadiness(input);

    expect(stage(readiness, "job-description")).toMatchObject({
      status: "NOT_STARTED",
      nextAction: { label: "Paste Job Description" },
      viewAction: { label: "Import from URL" }
    });
    expect(stage(readiness, "parse")).toMatchObject({ status: "BLOCKED" });
    expect(stage(readiness, "documents")).toMatchObject({ status: "BLOCKED" });
    expect(readiness.primaryAction).toMatchObject({ label: "Paste Job Description" });
    expect(input).toEqual(snapshot);
  });

  it("marks retrieval ready and scoring available when confirmed upstream state exists", () => {
    const readiness = buildWorkflowReadiness({
      ...createInput(),
      currentJobDescription: { id: "jd-1", versionNumber: 1 },
      latestParse: { id: "parse-1", status: "SUCCESS_WITH_WARNINGS", parserVersion: "m3.2.4" },
      latestAnalysis: { id: "analysis-1", status: "CONFIRMED", classifierVersion: "m3.3.2" },
      latestConfirmedAnalysis: { id: "analysis-1" },
      downstreamReadiness: "READY",
      retrievalRun: { id: "retrieval-1", summary: {} }
    });

    expect(stage(readiness, "job-description")).toMatchObject({
      status: "READY",
      detail: "Version 1"
    });
    expect(stage(readiness, "parse")).toMatchObject({ status: "READY" });
    expect(stage(readiness, "requirement-review")).toMatchObject({ status: "READY" });
    expect(stage(readiness, "evidence-retrieval")).toMatchObject({ status: "READY" });
    expect(stage(readiness, "evidence-scoring")).toMatchObject({
      status: "AVAILABLE",
      nextAction: { label: "Score Evidence" }
    });
    expect(stage(readiness, "match-report")).toMatchObject({ status: "BLOCKED" });
  });

  it("shows resume approval as available after a renderable audit and before any active approval", () => {
    const readiness = buildWorkflowReadiness({
      ...createInput(),
      currentJobDescription: { id: "jd-1", versionNumber: 2 },
      latestParse: { id: "parse-1", status: "SUCCESS", parserVersion: "m3.2.4" },
      latestAnalysis: { id: "analysis-1", status: "CONFIRMED", classifierVersion: "m3.3.2" },
      latestConfirmedAnalysis: { id: "analysis-1" },
      downstreamReadiness: "READY",
      retrievalRun: { id: "retrieval-1", summary: {} },
      scoringRun: { id: "score-1", evidenceRetrievalRunId: "retrieval-1" },
      matchReportRun: {
        id: "report-1",
        summary: { resumeReadinessState: "READY_WITH_LIMITATIONS" }
      },
      structuredResume: { id: "structured-1", status: "READY" },
      resumeComposition: { id: "resume-1", status: "READY" },
      resumeAudit: {
        id: "audit-1",
        result: { renderingReadiness: "READY_FOR_RENDERING" }
      }
    });

    expect(stage(readiness, "resume-plan")).toMatchObject({ status: "READY" });
    expect(stage(readiness, "resume-composition")).toMatchObject({ status: "READY" });
    expect(stage(readiness, "resume-audit-approval")).toMatchObject({
      status: "AVAILABLE",
      nextAction: { label: "Open Resume Studio" },
      viewAction: { label: "View Resume Audit" }
    });
    expect(stage(readiness, "resume-docx")).toMatchObject({ status: "BLOCKED" });
    expect(stage(readiness, "resume-pdf")).toMatchObject({ status: "BLOCKED" });
  });

  it("distinguishes format-specific rendered artifacts and documents discovery", () => {
    const readiness = buildWorkflowReadiness({
      ...createInput(),
      currentJobDescription: { id: "jd-1", versionNumber: 2 },
      latestParse: { id: "parse-1", status: "SUCCESS", parserVersion: "m3.2.4" },
      latestAnalysis: { id: "analysis-1", status: "CONFIRMED", classifierVersion: "m3.3.2" },
      latestConfirmedAnalysis: { id: "analysis-1" },
      downstreamReadiness: "READY",
      retrievalRun: { id: "retrieval-1", summary: {} },
      scoringRun: { id: "score-1", evidenceRetrievalRunId: "retrieval-1" },
      matchReportRun: {
        id: "report-1",
        summary: { resumeReadinessState: "READY_FOR_GENERATION" }
      },
      structuredResume: { id: "structured-1", status: "READY" },
      resumeComposition: { id: "resume-1", status: "READY" },
      resumeApproval: { id: "approval-1", renderingReadiness: "READY_FOR_RENDERING" },
      latestResumeDocx: { id: "docx-1" },
      latestResumePdf: null,
      coverLetterComposition: { id: "cover-1", status: "READY" },
      coverLetterApproval: { id: "cover-approval-1", renderingReadiness: "READY_FOR_RENDERING" },
      latestCoverLetterDocx: null,
      latestCoverLetterPdf: { id: "cover-pdf-1" }
    });

    expect(stage(readiness, "resume-audit-approval")).toMatchObject({ status: "APPROVED" });
    expect(stage(readiness, "resume-docx")).toMatchObject({
      status: "RENDERED",
      nextAction: { label: "View Documents" }
    });
    expect(stage(readiness, "resume-pdf")).toMatchObject({
      status: "AVAILABLE",
      nextAction: { label: "Render Resume PDF" }
    });
    expect(stage(readiness, "cover-letter-docx")).toMatchObject({
      status: "AVAILABLE",
      nextAction: { label: "Render Cover Letter DOCX" }
    });
    expect(stage(readiness, "cover-letter-pdf")).toMatchObject({
      status: "RENDERED",
      nextAction: { label: "View Documents" }
    });
    expect(stage(readiness, "documents")).toMatchObject({ status: "RENDERED" });
  });
});
