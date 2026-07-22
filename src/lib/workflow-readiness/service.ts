import { DocumentFormat } from "@prisma/client";

export type WorkflowStageStatus =
  | "NOT_STARTED"
  | "AVAILABLE"
  | "IN_PROGRESS"
  | "NEEDS_REVIEW"
  | "BLOCKED"
  | "READY"
  | "APPROVED"
  | "RENDERED"
  | "FAILED"
  | "REVOKED";

export type WorkflowAction =
  | { type: "link"; label: string; href: string }
  | { type: "parse-job-description"; label: string; jobDescriptionVersionId: string; returnTo: string }
  | { type: "retrieve-evidence"; label: string; jobDescriptionVersionId: string; returnTo: string }
  | { type: "score-evidence"; label: string; evidenceRetrievalRunId: string; jobDescriptionVersionId: string; returnTo: string }
  | { type: "generate-match-report"; label: string; evidenceScoringRunId: string; jobDescriptionVersionId: string; returnTo: string }
  | { type: "create-resume-plan"; label: string; matchReportRunId: string; jobDescriptionVersionId: string; returnTo: string }
  | { type: "compose-resume"; label: string; structuredResumeVersionId: string; jobDescriptionVersionId: string; returnTo: string }
  | { type: "compose-cover-letter"; label: string; matchReportRunId: string; jobDescriptionVersionId: string; returnTo: string }
  | {
      type: "render-resume";
      label: string;
      jobDescriptionVersionId: string;
      format: DocumentFormat;
      applicationId?: string | null;
      returnTo: string;
    }
  | {
      type: "render-cover-letter";
      label: string;
      jobDescriptionVersionId: string;
      format: DocumentFormat;
      applicationId?: string | null;
      returnTo: string;
    };

export type WorkflowStage = {
  key:
    | "job-description"
    | "parse"
    | "requirement-review"
    | "evidence-retrieval"
    | "evidence-scoring"
    | "match-report"
    | "resume-plan"
    | "resume-composition"
    | "resume-audit-approval"
    | "resume-docx"
    | "resume-pdf"
    | "cover-letter-composition"
    | "cover-letter-audit-approval"
    | "cover-letter-docx"
    | "cover-letter-pdf"
    | "documents";
  name: string;
  status: WorkflowStageStatus;
  description: string;
  detail?: string;
  nextAction?: WorkflowAction;
  viewAction?: WorkflowAction;
  blockingReason?: string;
};

export type WorkflowReadiness = {
  stages: WorkflowStage[];
  primaryAction: WorkflowAction;
  summaryBadges: string[];
};

type WorkflowReadinessInput = {
  applicationId?: string | null;
  jobOpportunityId: string;
  jobOpportunityTitle: string;
  linkedApplicationId?: string | null;
  currentJobDescription?: {
    id: string;
    versionNumber: number;
  } | null;
  latestParse?: {
    id: string;
    status: string;
    parserVersion: string;
  } | null;
  latestAnalysis?: {
    id: string;
    status: string;
    classifierVersion?: string | null;
  } | null;
  latestConfirmedAnalysis?: {
    id: string;
  } | null;
  careerProfileAvailable?: boolean;
  careerProfileIssue?: string | null;
  downstreamReadiness?: string | null;
  retrievalRun?: {
    id: string;
    summary?: unknown;
  } | null;
  scoringRun?: {
    id: string;
    evidenceRetrievalRunId: string;
  } | null;
  matchReportRun?: {
    id: string;
    summary?: unknown;
  } | null;
  structuredResume?: {
    id: string;
    status: string;
  } | null;
  resumeComposition?: {
    id: string;
    status: string;
  } | null;
  resumeAudit?: {
    id: string;
    status?: string;
    result?: unknown;
  } | null;
  resumeApproval?: {
    id: string;
    renderingReadiness: string;
  } | null;
  latestResumeDocx?: {
    id: string;
  } | null;
  latestResumePdf?: {
    id: string;
  } | null;
  coverLetterComposition?: {
    id: string;
    status: string;
  } | null;
  coverLetterDraft?: {
    id: string;
  } | null;
  coverLetterFinalizedRevision?: {
    id: string;
  } | null;
  coverLetterAudit?: {
    id: string;
    renderingReadiness: string;
  } | null;
  coverLetterApproval?: {
    id: string;
    renderingReadiness: string;
  } | null;
  latestCoverLetterDocx?: {
    id: string;
  } | null;
  latestCoverLetterPdf?: {
    id: string;
  } | null;
  latestDocumentId?: string | null;
  returnTo: string;
  paths: {
    jobDescriptionIntake: string;
    jobDescriptionIntakeFromUrl: string;
    currentJobDescription?: string | null;
    parse?: string | null;
    requirements?: string | null;
    evidence?: string | null;
    scores?: string | null;
    matchReport?: string | null;
    resumePlan?: string | null;
    resume?: string | null;
    resumeAudit?: string | null;
    resumeStudio?: string | null;
    coverLetter?: string | null;
    coverLetterAudit?: string | null;
    coverLetterStudio?: string | null;
    documents?: string | null;
  };
};

function hasSuccessfulParse(status: string | null | undefined) {
  return status === "SUCCESS" || status === "SUCCESS_WITH_WARNINGS";
}

function hasRenderableResumeAudit(audit: WorkflowReadinessInput["resumeAudit"]) {
  if (!audit?.result || typeof audit.result !== "object") {
    return false;
  }

  const readiness = (audit.result as { renderingReadiness?: unknown }).renderingReadiness;
  return readiness === "READY_FOR_RENDERING" || readiness === "READY_WITH_WARNINGS";
}

function hasRenderableCoverLetterAudit(audit: WorkflowReadinessInput["coverLetterAudit"]) {
  return (
    audit?.renderingReadiness === "READY_FOR_RENDERING" ||
    audit?.renderingReadiness === "READY_WITH_WARNINGS"
  );
}

function resumeReadinessState(summary: unknown) {
  if (!summary || typeof summary !== "object") {
    return null;
  }

  const value = (summary as { resumeReadinessState?: unknown }).resumeReadinessState;
  return typeof value === "string" ? value : null;
}

function renderReadiness(result: unknown) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const value = (result as { renderingReadiness?: unknown }).renderingReadiness;
  return typeof value === "string" ? value : null;
}

function careerProfileBlockingReason(issue: string | null | undefined) {
  switch (issue) {
    case "FIXTURE_ONLY":
      return "Import or select a real Career Knowledge profile. Fixture-only profiles cannot drive normal evidence retrieval.";
    case "CURRENT_PROFILE_FIXTURE":
      return "Select a real Career Knowledge profile before retrieving evidence. Fixture profiles cannot be used for normal workflow runs.";
    case "CURRENT_PROFILE_MISSING":
      return "Select a real Career Knowledge profile before retrieving evidence.";
    default:
      return "Import a real Career Knowledge profile before retrieving evidence.";
  }
}

export function buildWorkflowReadiness(
  input: WorkflowReadinessInput
): WorkflowReadiness {
  const currentJobDescription = input.currentJobDescription ?? null;
  const parseSucceeded = hasSuccessfulParse(input.latestParse?.status);
  const analysisConfirmed = input.latestAnalysis?.status === "CONFIRMED";
  const careerProfileAvailable = input.careerProfileAvailable ?? true;
  const evidenceReady = analysisConfirmed && input.downstreamReadiness === "READY";
  const matchResumeReadiness = resumeReadinessState(input.matchReportRun?.summary);
  const canCreateResumePlan =
    Boolean(input.matchReportRun) &&
    matchResumeReadiness !== "NOT_READY" &&
    matchResumeReadiness !== null;
  const resumeAuditReadiness = renderReadiness(input.resumeAudit?.result);
  const hasResumeDocuments = Boolean(input.latestResumeDocx || input.latestResumePdf);
  const hasCoverLetterDocuments = Boolean(
    input.latestCoverLetterDocx || input.latestCoverLetterPdf
  );

  const stages: WorkflowStage[] = [];

  if (!currentJobDescription) {
    stages.push({
      key: "job-description",
      name: "Job Description",
      status: "NOT_STARTED",
      description: "No immutable job description has been saved yet.",
      nextAction: {
        type: "link",
        label: "Paste Job Description",
        href: input.paths.jobDescriptionIntake
      },
      viewAction: {
        type: "link",
        label: "Import from URL",
        href: input.paths.jobDescriptionIntakeFromUrl
      }
    });
  } else {
    stages.push({
      key: "job-description",
      name: "Job Description",
      status: "READY",
      description: "The current immutable source is available for parsing and review.",
      detail: `Version ${currentJobDescription.versionNumber}`,
      nextAction: input.paths.currentJobDescription
        ? {
            type: "link",
            label: "View Job Description",
            href: input.paths.currentJobDescription
          }
        : undefined,
      viewAction: {
        type: "link",
        label: "Update Source",
        href: input.paths.jobDescriptionIntake
      }
    });
  }

  if (!currentJobDescription) {
    stages.push({
      key: "parse",
      name: "Parse",
      status: "BLOCKED",
      description: "Parsing begins after a job description is saved.",
      blockingReason: "Save a job description first."
    });
  } else if (input.latestParse?.status === "FAILED") {
    stages.push({
      key: "parse",
      name: "Parse",
      status: "FAILED",
      description: "The latest parse failed and needs review or a rerun.",
      detail: input.latestParse.parserVersion,
      nextAction: {
        type: "parse-job-description",
        label: "Reparse Job Description",
        jobDescriptionVersionId: currentJobDescription.id,
        returnTo: input.returnTo
      },
      viewAction: input.paths.currentJobDescription
        ? {
            type: "link",
            label: "Open Source",
            href: input.paths.currentJobDescription
          }
        : undefined
    });
  } else if (!parseSucceeded) {
    stages.push({
      key: "parse",
      name: "Parse",
      status: "AVAILABLE",
      description: "The saved source is ready for deterministic parsing.",
      nextAction: {
        type: "parse-job-description",
        label: "Parse Job Description",
        jobDescriptionVersionId: currentJobDescription.id,
        returnTo: input.returnTo
      },
      viewAction: input.paths.currentJobDescription
        ? {
            type: "link",
            label: "View Job Description",
            href: input.paths.currentJobDescription
          }
        : undefined
    });
  } else {
    stages.push({
      key: "parse",
      name: "Parse",
      status: "READY",
      description: "The current source has a successful parse available.",
      detail: input.latestParse?.parserVersion ?? undefined,
      nextAction: input.paths.parse
        ? { type: "link", label: "View Parsed Analysis", href: input.paths.parse }
        : undefined,
      viewAction: {
        type: "parse-job-description",
        label: "Reparse with Current Parser",
        jobDescriptionVersionId: currentJobDescription.id,
        returnTo: input.returnTo
      }
    });
  }

  if (!currentJobDescription || !parseSucceeded) {
    stages.push({
      key: "requirement-review",
      name: "Requirement Review",
      status: "BLOCKED",
      description: "Requirement review opens after a successful parse.",
      blockingReason: "Parse the current job description first."
    });
  } else if (!input.latestAnalysis) {
    stages.push({
      key: "requirement-review",
      name: "Requirement Review",
      status: "AVAILABLE",
      description: "The parsed job description is ready for deterministic review.",
      nextAction: input.paths.requirements
        ? { type: "link", label: "Review Requirements", href: input.paths.requirements }
        : undefined
    });
  } else if (input.latestAnalysis.status === "NEEDS_REVIEW") {
    stages.push({
      key: "requirement-review",
      name: "Requirement Review",
      status: "NEEDS_REVIEW",
      description: "The latest analysis still needs confirmation before downstream work.",
      detail: input.latestAnalysis.classifierVersion ?? undefined,
      nextAction: input.paths.requirements
        ? {
            type: "link",
            label: "Continue Requirement Review",
            href: input.paths.requirements
          }
        : undefined,
      viewAction: input.paths.requirements
        ? { type: "link", label: "View Review", href: input.paths.requirements }
        : undefined
    });
  } else {
    stages.push({
      key: "requirement-review",
      name: "Requirement Review",
      status: analysisConfirmed ? "READY" : "FAILED",
      description: analysisConfirmed
        ? "A confirmed requirement analysis is available."
        : "The latest requirement analysis is not usable yet.",
      detail: input.latestAnalysis.classifierVersion ?? undefined,
      nextAction: input.paths.requirements
        ? {
            type: "link",
            label: analysisConfirmed ? "View Confirmed Requirements" : "Review Requirements",
            href: input.paths.requirements
          }
        : undefined
    });
  }

  if (!currentJobDescription || !analysisConfirmed) {
    stages.push({
      key: "evidence-retrieval",
      name: "Evidence Retrieval",
      status: "BLOCKED",
      description: "Evidence retrieval requires a confirmed requirement analysis.",
      blockingReason: "Confirm requirement review first."
    });
  } else if (!careerProfileAvailable) {
    stages.push({
      key: "evidence-retrieval",
      name: "Evidence Retrieval",
      status: "BLOCKED",
      description: "Evidence retrieval requires the current real Career Knowledge profile.",
      blockingReason: careerProfileBlockingReason(input.careerProfileIssue),
      viewAction: input.paths.requirements
        ? {
            type: "link",
            label: "Open Requirement Review",
            href: input.paths.requirements
          }
        : undefined
    });
  } else if (input.downstreamReadiness !== "READY") {
    stages.push({
      key: "evidence-retrieval",
      name: "Evidence Retrieval",
      status: "NEEDS_REVIEW",
      description: "Downstream readiness is not yet clear enough for evidence retrieval.",
      blockingReason: "Resolve requirement-review diagnostics first.",
      nextAction: input.paths.requirements
        ? {
            type: "link",
            label: "Open Requirement Review",
            href: input.paths.requirements
          }
        : undefined
    });
  } else if (!input.retrievalRun) {
    stages.push({
      key: "evidence-retrieval",
      name: "Evidence Retrieval",
      status: "AVAILABLE",
      description: "Confirmed requirements are ready for evidence lookup.",
      nextAction: {
        type: "retrieve-evidence",
        label: "Retrieve Evidence",
        jobDescriptionVersionId: currentJobDescription.id,
        returnTo: input.returnTo
      }
    });
  } else {
    stages.push({
      key: "evidence-retrieval",
      name: "Evidence Retrieval",
      status: "READY",
      description: "Candidate evidence has been retrieved for the current source.",
      nextAction: input.paths.evidence
        ? { type: "link", label: "View Evidence", href: input.paths.evidence }
        : undefined
    });
  }

  if (!input.retrievalRun || !currentJobDescription) {
    stages.push({
      key: "evidence-scoring",
      name: "Evidence Scoring",
      status: "BLOCKED",
      description: "Scoring starts after a retrieval run exists.",
      blockingReason: "Retrieve evidence first."
    });
  } else if (!input.scoringRun) {
    stages.push({
      key: "evidence-scoring",
      name: "Evidence Scoring",
      status: "AVAILABLE",
      description: "The latest retrieval run is ready for deterministic scoring.",
      nextAction: {
        type: "score-evidence",
        label: "Score Evidence",
        evidenceRetrievalRunId: input.retrievalRun.id,
        jobDescriptionVersionId: currentJobDescription.id,
        returnTo: input.returnTo
      },
      viewAction: input.paths.evidence
        ? { type: "link", label: "View Evidence", href: input.paths.evidence }
        : undefined
    });
  } else {
    stages.push({
      key: "evidence-scoring",
      name: "Evidence Scoring",
      status: "READY",
      description: "Scored evidence is available for match reporting.",
      nextAction: input.paths.scores
        ? { type: "link", label: "View Scores", href: input.paths.scores }
        : undefined
    });
  }

  if (!input.scoringRun || !currentJobDescription) {
    stages.push({
      key: "match-report",
      name: "Match Report",
      status: "BLOCKED",
      description: "A match report depends on evidence scoring.",
      blockingReason: "Score evidence first."
    });
  } else if (!input.matchReportRun) {
    stages.push({
      key: "match-report",
      name: "Match Report",
      status: "AVAILABLE",
      description: "The current scoring run is ready for explainable reporting.",
      nextAction: {
        type: "generate-match-report",
        label: "Generate Match Report",
        evidenceScoringRunId: input.scoringRun.id,
        jobDescriptionVersionId: currentJobDescription.id,
        returnTo: input.returnTo
      },
      viewAction: input.paths.scores
        ? { type: "link", label: "View Scores", href: input.paths.scores }
        : undefined
    });
  } else {
    stages.push({
      key: "match-report",
      name: "Match Report",
      status: "READY",
      description: "The current job has an explainable match report.",
      detail: matchResumeReadiness ? matchResumeReadiness.replace(/_/g, " ") : undefined,
      nextAction: input.paths.matchReport
        ? { type: "link", label: "Open Match Report", href: input.paths.matchReport }
        : undefined
    });
  }

  if (!currentJobDescription || !input.matchReportRun) {
    stages.push({
      key: "resume-plan",
      name: "Resume Plan",
      status: "BLOCKED",
      description: "Resume planning depends on a match report.",
      blockingReason: "Generate the match report first."
    });
  } else if (!canCreateResumePlan) {
    stages.push({
      key: "resume-plan",
      name: "Resume Plan",
      status: "NEEDS_REVIEW",
      description: "Resume planning is paused until the match report is ready.",
      blockingReason: "Resolve match-report readiness first.",
      nextAction: input.paths.matchReport
        ? { type: "link", label: "Open Match Report", href: input.paths.matchReport }
        : undefined
    });
  } else if (!input.structuredResume) {
    stages.push({
      key: "resume-plan",
      name: "Resume Plan",
      status: "AVAILABLE",
      description: "The current report is ready to produce a structured resume plan.",
      nextAction: {
        type: "create-resume-plan",
        label: "Create Resume Plan",
        matchReportRunId: input.matchReportRun.id,
        jobDescriptionVersionId: currentJobDescription.id,
        returnTo: input.returnTo
      }
    });
  } else {
    stages.push({
      key: "resume-plan",
      name: "Resume Plan",
      status: "READY",
      description: "A structured resume plan is available for composition.",
      nextAction: input.paths.resumePlan
        ? { type: "link", label: "View Resume Plan", href: input.paths.resumePlan }
        : undefined
    });
  }

  if (!currentJobDescription || !input.structuredResume) {
    stages.push({
      key: "resume-composition",
      name: "Resume Composition",
      status: "BLOCKED",
      description: "Resume composition depends on a structured plan.",
      blockingReason: "Create the resume plan first."
    });
  } else if (!input.resumeComposition) {
    stages.push({
      key: "resume-composition",
      name: "Resume Composition",
      status: "AVAILABLE",
      description: "The structured plan is ready to produce employer-facing resume content.",
      nextAction: {
        type: "compose-resume",
        label: "Create Resume Composition",
        structuredResumeVersionId: input.structuredResume.id,
        jobDescriptionVersionId: currentJobDescription.id,
        returnTo: input.returnTo
      },
      viewAction: input.paths.resumePlan
        ? { type: "link", label: "View Resume Plan", href: input.paths.resumePlan }
        : undefined
    });
  } else {
    stages.push({
      key: "resume-composition",
      name: "Resume Composition",
      status:
        input.resumeComposition.status === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "READY",
      description: "Resume content exists and can move into Studio review.",
      nextAction: input.paths.resume
        ? { type: "link", label: "Open Resume", href: input.paths.resume }
        : undefined
    });
  }

  if (!currentJobDescription || !input.resumeComposition) {
    stages.push({
      key: "resume-audit-approval",
      name: "Resume Audit and Approval",
      status: "BLOCKED",
      description: "Audit and approval require composed resume content.",
      blockingReason: "Create resume composition first."
    });
  } else if (input.resumeApproval) {
    stages.push({
      key: "resume-audit-approval",
      name: "Resume Audit and Approval",
      status: "APPROVED",
      description: "An active approved resume source is ready for rendering.",
      detail: input.resumeApproval.renderingReadiness.replace(/_/g, " "),
      nextAction: input.paths.resumeStudio
        ? { type: "link", label: "Open Resume Studio", href: input.paths.resumeStudio }
        : undefined,
      viewAction: input.paths.resumeAudit
        ? { type: "link", label: "View Resume Audit", href: input.paths.resumeAudit }
        : undefined
    });
  } else if (hasRenderableResumeAudit(input.resumeAudit)) {
    stages.push({
      key: "resume-audit-approval",
      name: "Resume Audit and Approval",
      status: "AVAILABLE",
      description: "The resume can move through Studio approval before rendering.",
      detail: resumeAuditReadiness?.replace(/_/g, " ") ?? undefined,
      nextAction: input.paths.resumeStudio
        ? { type: "link", label: "Open Resume Studio", href: input.paths.resumeStudio }
        : undefined,
      viewAction: input.paths.resumeAudit
        ? { type: "link", label: "View Resume Audit", href: input.paths.resumeAudit }
        : undefined
    });
  } else if (input.resumeAudit) {
    stages.push({
      key: "resume-audit-approval",
      name: "Resume Audit and Approval",
      status: resumeAuditReadiness === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "BLOCKED",
      description: "The latest resume audit still needs review before approval.",
      detail: resumeAuditReadiness?.replace(/_/g, " ") ?? undefined,
      nextAction: input.paths.resumeStudio
        ? { type: "link", label: "Open Resume Studio", href: input.paths.resumeStudio }
        : undefined,
      viewAction: input.paths.resumeAudit
        ? { type: "link", label: "View Resume Audit", href: input.paths.resumeAudit }
        : undefined
    });
  } else {
    stages.push({
      key: "resume-audit-approval",
      name: "Resume Audit and Approval",
      status: "AVAILABLE",
      description: "Open Resume Studio to edit, finalize, audit, and approve the current resume.",
      nextAction: input.paths.resumeStudio
        ? { type: "link", label: "Open Resume Studio", href: input.paths.resumeStudio }
        : undefined,
      viewAction: input.paths.resume
        ? { type: "link", label: "View Resume", href: input.paths.resume }
        : undefined
    });
  }

  stages.push({
    key: "resume-docx",
    name: "Resume DOCX",
    status: input.latestResumeDocx
      ? "RENDERED"
      : input.resumeApproval
        ? "AVAILABLE"
        : "BLOCKED",
    description: input.latestResumeDocx
      ? "A rendered resume DOCX artifact is available."
      : input.resumeApproval
        ? "The approved resume can render to DOCX."
        : "DOCX rendering requires an approved resume source.",
    nextAction: input.latestResumeDocx
      ? input.paths.documents
        ? { type: "link", label: "View Documents", href: input.paths.documents }
        : undefined
      : currentJobDescription && input.resumeApproval
        ? {
            type: "render-resume",
            label: "Render Resume DOCX",
            jobDescriptionVersionId: currentJobDescription.id,
            applicationId: input.applicationId,
            format: DocumentFormat.DOCX,
            returnTo: input.returnTo
          }
        : undefined
  });

  stages.push({
    key: "resume-pdf",
    name: "Resume PDF",
    status: input.latestResumePdf
      ? "RENDERED"
      : input.resumeApproval
        ? "AVAILABLE"
        : "BLOCKED",
    description: input.latestResumePdf
      ? "A rendered resume PDF artifact is available."
      : input.resumeApproval
        ? "The approved resume can render to PDF."
        : "PDF rendering requires an approved resume source.",
    nextAction: input.latestResumePdf
      ? input.paths.documents
        ? { type: "link", label: "View Documents", href: input.paths.documents }
        : undefined
      : currentJobDescription && input.resumeApproval
        ? {
            type: "render-resume",
            label: "Render Resume PDF",
            jobDescriptionVersionId: currentJobDescription.id,
            applicationId: input.applicationId,
            format: DocumentFormat.PDF,
            returnTo: input.returnTo
          }
        : undefined
  });

  if (!currentJobDescription || !input.matchReportRun) {
    stages.push({
      key: "cover-letter-composition",
      name: "Cover Letter Composition",
      status: "BLOCKED",
      description: "Cover-letter composition depends on a match report.",
      blockingReason: "Generate the match report first."
    });
  } else if (!input.coverLetterComposition) {
    stages.push({
      key: "cover-letter-composition",
      name: "Cover Letter Composition",
      status: "AVAILABLE",
      description: "The current report is ready for deterministic cover-letter composition.",
      nextAction: {
        type: "compose-cover-letter",
        label: "Generate Cover Letter",
        matchReportRunId: input.matchReportRun.id,
        jobDescriptionVersionId: currentJobDescription.id,
        returnTo: input.returnTo
      }
    });
  } else {
    stages.push({
      key: "cover-letter-composition",
      name: "Cover Letter Composition",
      status: "READY",
      description: "A cover-letter composition exists and can move into Studio review.",
      nextAction: input.paths.coverLetter
        ? { type: "link", label: "Open Cover Letter", href: input.paths.coverLetter }
        : undefined
    });
  }

  if (!currentJobDescription || !input.coverLetterComposition) {
    stages.push({
      key: "cover-letter-audit-approval",
      name: "Cover Letter Audit and Approval",
      status: "BLOCKED",
      description: "Audit and approval require a cover-letter composition.",
      blockingReason: "Generate the cover letter first."
    });
  } else if (input.coverLetterApproval) {
    stages.push({
      key: "cover-letter-audit-approval",
      name: "Cover Letter Audit and Approval",
      status: "APPROVED",
      description: "An active approved cover letter is ready for rendering.",
      detail: input.coverLetterApproval.renderingReadiness.replace(/_/g, " "),
      nextAction: input.paths.coverLetterStudio
        ? { type: "link", label: "Open Cover Letter Studio", href: input.paths.coverLetterStudio }
        : undefined,
      viewAction: input.paths.coverLetterAudit
        ? { type: "link", label: "View Cover Letter Audit", href: input.paths.coverLetterAudit }
        : undefined
    });
  } else if (hasRenderableCoverLetterAudit(input.coverLetterAudit)) {
    stages.push({
      key: "cover-letter-audit-approval",
      name: "Cover Letter Audit and Approval",
      status: "AVAILABLE",
      description: "The current cover letter can move through Studio approval.",
      detail: input.coverLetterAudit?.renderingReadiness.replace(/_/g, " "),
      nextAction: input.paths.coverLetterStudio
        ? { type: "link", label: "Open Cover Letter Studio", href: input.paths.coverLetterStudio }
        : undefined,
      viewAction: input.paths.coverLetterAudit
        ? { type: "link", label: "View Cover Letter Audit", href: input.paths.coverLetterAudit }
        : undefined
    });
  } else {
    stages.push({
      key: "cover-letter-audit-approval",
      name: "Cover Letter Audit and Approval",
      status:
        input.coverLetterDraft || input.coverLetterFinalizedRevision || input.coverLetterComposition
          ? "AVAILABLE"
          : "BLOCKED",
      description: "Open Cover Letter Studio to edit, audit, and approve the current draft.",
      nextAction: input.paths.coverLetterStudio
        ? { type: "link", label: "Open Cover Letter Studio", href: input.paths.coverLetterStudio }
        : undefined,
      viewAction: input.paths.coverLetter
        ? { type: "link", label: "View Cover Letter", href: input.paths.coverLetter }
        : undefined
    });
  }

  stages.push({
    key: "cover-letter-docx",
    name: "Cover Letter DOCX",
    status: input.latestCoverLetterDocx
      ? "RENDERED"
      : input.coverLetterApproval
        ? "AVAILABLE"
        : "BLOCKED",
    description: input.latestCoverLetterDocx
      ? "A rendered cover-letter DOCX artifact is available."
      : input.coverLetterApproval
        ? "The approved cover letter can render to DOCX."
        : "DOCX rendering requires an approved cover letter source.",
    nextAction: input.latestCoverLetterDocx
      ? input.paths.documents
        ? { type: "link", label: "View Documents", href: input.paths.documents }
        : undefined
      : currentJobDescription && input.coverLetterApproval
        ? {
            type: "render-cover-letter",
            label: "Render Cover Letter DOCX",
            jobDescriptionVersionId: currentJobDescription.id,
            applicationId: input.applicationId,
            format: DocumentFormat.DOCX,
            returnTo: input.returnTo
          }
        : undefined
  });

  stages.push({
    key: "cover-letter-pdf",
    name: "Cover Letter PDF",
    status: input.latestCoverLetterPdf
      ? "RENDERED"
      : input.coverLetterApproval
        ? "AVAILABLE"
        : "BLOCKED",
    description: input.latestCoverLetterPdf
      ? "A rendered cover-letter PDF artifact is available."
      : input.coverLetterApproval
        ? "The approved cover letter can render to PDF."
        : "PDF rendering requires an approved cover letter source.",
    nextAction: input.latestCoverLetterPdf
      ? input.paths.documents
        ? { type: "link", label: "View Documents", href: input.paths.documents }
        : undefined
      : currentJobDescription && input.coverLetterApproval
        ? {
            type: "render-cover-letter",
            label: "Render Cover Letter PDF",
            jobDescriptionVersionId: currentJobDescription.id,
            applicationId: input.applicationId,
            format: DocumentFormat.PDF,
            returnTo: input.returnTo
          }
        : undefined
  });

  stages.push({
    key: "documents",
    name: "Documents",
    status: hasResumeDocuments || hasCoverLetterDocuments ? "RENDERED" : "BLOCKED",
    description:
      hasResumeDocuments || hasCoverLetterDocuments
        ? "Rendered artifacts are available in the Documents workspace."
        : "The Documents workspace will populate after resume or cover-letter rendering.",
    nextAction: input.paths.documents
      ? {
          type: "link",
          label: hasResumeDocuments || hasCoverLetterDocuments ? "View Documents" : "Browse Documents",
          href: input.paths.documents
        }
      : undefined
  });

  const primaryAction =
    stages.find((stage) => stage.nextAction && stage.status !== "BLOCKED")?.nextAction ??
    ({
      type: "link",
      label: "Browse Jobs",
      href: "/jobs"
    } satisfies WorkflowAction);

  const summaryBadges = [
    currentJobDescription ? "JD saved" : "JD needed",
    parseSucceeded ? "Parsed" : "Parse pending",
    analysisConfirmed ? "Requirements confirmed" : "Requirements pending",
    input.matchReportRun ? "Match report ready" : "Match report pending",
    input.resumeApproval ? "Resume approved" : "Resume approval needed",
    input.coverLetterApproval ? "Cover letter approved" : "Cover letter approval needed"
  ];

  return {
    stages,
    primaryAction,
    summaryBadges
  };
}
