import Link from "next/link";
import {
  parseJobDescriptionAction
} from "@/lib/job-descriptions/parse-actions";
import { retrieveCareerEvidenceAction } from "@/lib/evidence-retrieval/actions";
import { scoreRetrievedEvidenceAction } from "@/lib/evidence-scoring/actions";
import { generateMatchReportAction } from "@/lib/match-report/actions";
import { createStructuredResumePlanAction } from "@/lib/structured-resume/actions";
import { createResumeCompositionAction } from "@/lib/resume-composition/actions";
import { createCoverLetterCompositionAction } from "@/lib/cover-letter-composition/actions";
import { renderApprovedResumeDocumentAction } from "@/lib/document-rendering/actions";
import { renderApprovedCoverLetterDocumentAction } from "@/lib/cover-letter-rendering/actions";
import { buttonPrimaryClassName, buttonSecondaryClassName, textActionClassName } from "@/lib/ui";
import type { WorkflowAction } from "@/lib/workflow-readiness/service";

type WorkflowActionButtonProps = {
  action: WorkflowAction;
  emphasis?: "primary" | "secondary" | "text";
};

function classNameForEmphasis(emphasis: WorkflowActionButtonProps["emphasis"]) {
  switch (emphasis) {
    case "primary":
      return buttonPrimaryClassName;
    case "text":
      return textActionClassName;
    default:
      return buttonSecondaryClassName;
  }
}

export function WorkflowActionButton({
  action,
  emphasis = "secondary"
}: WorkflowActionButtonProps) {
  const className = classNameForEmphasis(emphasis);

  if (action.type === "link") {
    return (
      <Link className={className} href={action.href}>
        {action.label}
      </Link>
    );
  }

  if (action.type === "parse-job-description") {
    return (
      <form action={parseJobDescriptionAction.bind(null, action.jobDescriptionVersionId, action.returnTo)}>
        <button className={className} type="submit">
          {action.label}
        </button>
      </form>
    );
  }

  if (action.type === "retrieve-evidence") {
    return (
      <form action={retrieveCareerEvidenceAction.bind(null, action.jobDescriptionVersionId, action.returnTo)}>
        <button className={className} type="submit">
          {action.label}
        </button>
      </form>
    );
  }

  if (action.type === "score-evidence") {
    return (
      <form
        action={scoreRetrievedEvidenceAction.bind(
          null,
          action.evidenceRetrievalRunId,
          action.jobDescriptionVersionId,
          action.returnTo
        )}
      >
        <button className={className} type="submit">
          {action.label}
        </button>
      </form>
    );
  }

  if (action.type === "generate-match-report") {
    return (
      <form
        action={generateMatchReportAction.bind(
          null,
          action.evidenceScoringRunId,
          action.jobDescriptionVersionId,
          action.returnTo
        )}
      >
        <button className={className} type="submit">
          {action.label}
        </button>
      </form>
    );
  }

  if (action.type === "create-resume-plan") {
    return (
      <form
        action={createStructuredResumePlanAction.bind(
          null,
          action.matchReportRunId,
          action.jobDescriptionVersionId,
          action.returnTo
        )}
      >
        <button className={className} type="submit">
          {action.label}
        </button>
      </form>
    );
  }

  if (action.type === "compose-resume") {
    return (
      <form
        action={createResumeCompositionAction.bind(
          null,
          action.structuredResumeVersionId,
          action.jobDescriptionVersionId,
          action.returnTo
        )}
      >
        <button className={className} type="submit">
          {action.label}
        </button>
      </form>
    );
  }

  if (action.type === "compose-cover-letter") {
    return (
      <form
        action={createCoverLetterCompositionAction.bind(
          null,
          action.matchReportRunId,
          action.jobDescriptionVersionId,
          action.returnTo
        )}
      >
        <button className={className} type="submit">
          {action.label}
        </button>
      </form>
    );
  }

  if (action.type === "render-resume") {
    return (
      <form
        action={renderApprovedResumeDocumentAction.bind(
          null,
          action.jobDescriptionVersionId,
          action.format,
          action.applicationId,
          action.returnTo
        )}
      >
        <button className={className} type="submit">
          {action.label}
        </button>
      </form>
    );
  }

  return (
    <form
      action={renderApprovedCoverLetterDocumentAction.bind(
        null,
        action.jobDescriptionVersionId,
        action.format,
        action.applicationId,
        action.returnTo
      )}
    >
      <button className={className} type="submit">
        {action.label}
      </button>
    </form>
  );
}
