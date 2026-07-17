import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { createStructuredResumePlanAction } from "@/lib/structured-resume/actions";
import { getStructuredResumeContext } from "@/lib/structured-resume/service";
import { parseStoredMatchReportRun, getMatchReportContext } from "@/lib/match-report/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type MatchReportPageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function SuccessBanner({ success }: { success?: string }) {
  const messages: Record<string, string> = {
    "report-created": "Match report generated successfully.",
    "report-reused":
      "The current report contract, engine, and configuration already had a successful result for this exact scoring run, so the existing match report was reused.",
    "plan-created": "Structured resume plan created successfully.",
    "plan-reused":
      "The current structured resume contract, engine, and configuration already had a successful result for this exact match report and career profile, so the existing plan was reused."
  };

  if (!success || !messages[success]) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      {messages[success]}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-stone-900">{value}</p>
      {detail ? <p className="mt-1 text-sm text-stone-600">{detail}</p> : null}
    </article>
  );
}

function Section({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-stone-900">{title}</h2>
      <p className="mt-2 text-sm text-stone-600">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default async function MatchReportPage({ params, searchParams }: MatchReportPageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const runId = getStringParam(query.runId);
  const success = getStringParam(query.success);
  const workspace = await getDefaultWorkspace();
  const context = await getMatchReportContext(workspace.id, jobDescriptionVersionId);
  const resumePlanContext = await getStructuredResumeContext(workspace.id, jobDescriptionVersionId);

  if (!context) {
    notFound();
  }

  const selectedRunId = runId ?? context.reusableMatchReportRun?.id;
  if (!selectedRunId) {
    return (
      <div className="space-y-8">
        <SuccessBanner success={success} />
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
            Match report unavailable
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
            Generate a successful evidence scoring run first. Match reports are deterministic,
            immutable, and read-only.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/evidence/scores`}
            >
              Back to Evidence Scores
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const { run, result } = await parseStoredMatchReportRun(workspace.id, selectedRunId);
  const requiredGaps = result.risksAndGaps.filter((risk) =>
    risk.requirementIds.some((requirementId) =>
      result.requirementConclusions.some(
        (item) => item.requirementId === requirementId && item.category === "REQUIRED"
      )
    )
  );
  const nonRequiredGaps = result.risksAndGaps.filter((risk) =>
    risk.requirementIds.every((requirementId) =>
      result.requirementConclusions.some(
        (item) => item.requirementId === requirementId && item.category !== "REQUIRED"
      )
    )
  );

  return (
    <div className="space-y-8">
      <SuccessBanner success={success} />

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Explainable match report
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {context.jobDescriptionVersion.opportunity.title}
            </h1>
            <p className="mt-3 text-base text-stone-600">
              {context.jobDescriptionVersion.opportunity.company.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/evidence/scores?runId=${run.evidenceScoringRunId}`}
            >
              Back to Evidence Scores
            </Link>
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/requirements?analysisId=${run.requirementAnalysisId}`}
            >
              Requirement Analysis
            </Link>
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/evidence?runId=${run.evidenceRetrievalRunId}`}
            >
              Candidate Evidence
            </Link>
            {run.applicationId ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/applications/${run.applicationId}`}
              >
                Open application
              </Link>
            ) : null}
            {resumePlanContext?.reusableStructuredResumeVersion ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/resume-plan?versionId=${resumePlanContext.reusableStructuredResumeVersion.id}&matchReportRunId=${run.id}`}
              >
                View Structured Resume Plan
              </Link>
            ) : resumePlanContext?.planningReady ? (
              <form
                action={createStructuredResumePlanAction.bind(
                  null,
                  run.id,
                  jobDescriptionVersionId,
                  `/job-descriptions/${jobDescriptionVersionId}/match-report?runId=${run.id}`
                )}
              >
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Create Structured Resume Plan
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Match tier" value={result.summary.matchTier.replace(/_/g, " ")} />
          <SummaryCard
            label="Pursuit recommendation"
            value={result.summary.pursuitRecommendation.replace(/_/g, " ")}
          />
          <SummaryCard
            label="Resume readiness"
            value={result.summary.resumeReadinessState.replace(/_/g, " ")}
          />
          <SummaryCard
            label="Report versions"
            value={run.engineVersion}
            detail={`Contract ${run.contractVersion} • Config ${run.configurationVersion}`}
          />
          <SummaryCard label="Strong required" value={result.summary.strongRequiredCount} />
          <SummaryCard label="Good required" value={result.summary.goodRequiredCount} />
          <SummaryCard label="Critical gaps" value={result.summary.criticalRequiredGapCount} />
          <SummaryCard label="Material gaps" value={result.summary.materialRequiredGapCount} />
        </div>

        <p className="mt-6 text-sm text-stone-600">
          This report is an evidence-alignment review, not a hiring probability or interview
          prediction.
        </p>
      </section>

      <Section
        title="Decision Summary"
        description="Deterministic report outputs for pursuit and truthful resume readiness."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryCard label="Required total" value={result.summary.requiredRequirementCount} />
          <SummaryCard label="Preferred total" value={result.summary.preferredRequirementCount} />
          <SummaryCard label="Responsibilities" value={result.summary.responsibilityCount} />
          <SummaryCard label="Required no evidence" value={result.summary.requiredNoEvidenceCount} />
          <SummaryCard
            label="Required restricted only"
            value={result.summary.requiredRestrictedOnlyCount}
          />
          <SummaryCard
            label="Alignment index"
            value={result.summary.alignmentIndex ?? "N/A"}
            detail="Internal evidence-alignment index only."
          />
        </div>
      </Section>

      <Section
        title="Strongest Alignment Areas"
        description="Top deterministic strengths selected from scored requirements."
      >
        <div className="space-y-4">
          {result.strengths.length > 0 ? (
            result.strengths.map((strength) => (
              <article
                key={strength.strengthId}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-stone-900">{strength.strengthCategory}</p>
                    <p className="mt-1 text-sm text-stone-600">{strength.explanation}</p>
                  </div>
                  <span className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">
                    {strength.evidenceContext}
                  </span>
                </div>
                <p className="mt-3 text-sm text-stone-700">
                  Technologies: {strength.technologies.join(", ") || "None"}
                </p>
                <p className="mt-2 text-sm text-stone-700">
                  Evidence IDs: {strength.supportingEvidenceIds.join(", ")}
                </p>
                <p className="mt-2 text-xs text-stone-600">
                  Requirements: {strength.requirementIds.join(", ")} • Confidence {strength.confidence}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-stone-600">No grouped strengths were available.</p>
          )}
        </div>
      </Section>

      <Section
        title="Required Gaps"
        description="Required limitations are separated so optional gaps do not dominate the report."
      >
        <div className="space-y-4">
          {requiredGaps.length > 0 ? (
            requiredGaps.map((risk) => (
              <article key={risk.riskId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <p className="text-base font-semibold text-stone-900">{risk.explanation}</p>
                <p className="mt-2 text-sm text-stone-700">
                  Gap type: {risk.gapType.replace(/_/g, " ")} • Severity: {risk.severity}
                </p>
                <p className="mt-2 text-sm text-stone-700">
                  Resume guidance: {risk.resumeWarning}
                </p>
                <p className="mt-2 text-xs text-stone-600">
                  Restricted evidence: {risk.availableRestrictedEvidence.join(", ") || "None"} •
                  Project evidence: {risk.availableProjectEvidence.join(", ") || "None"} • Stale
                  evidence: {risk.availableStaleEvidence.join(", ") || "None"}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-stone-600">No required gaps were detected in this report.</p>
          )}
        </div>
      </Section>

      <Section
        title="Preferred and Contextual Gaps"
        description="Secondary limitations remain visible without overshadowing required evidence."
      >
        <div className="space-y-4">
          {nonRequiredGaps.length > 0 ? (
            nonRequiredGaps.map((risk) => (
              <article key={risk.riskId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                <p className="text-base font-semibold text-stone-900">{risk.explanation}</p>
                <p className="mt-2 text-sm text-stone-700">
                  Gap type: {risk.gapType.replace(/_/g, " ")} • Severity: {risk.severity}
                </p>
                <p className="mt-2 text-sm text-stone-700">{risk.resumeWarning}</p>
              </article>
            ))
          ) : (
            <p className="text-sm text-stone-600">No preferred or contextual gaps were detected.</p>
          )}
        </div>
      </Section>

      <Section
        title="Resume Guidance"
        description="Structured guidance only. This page does not generate resume prose."
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
              Prioritize
            </h3>
            <div className="mt-4 space-y-3">
              {result.resumeGuidance.priorityEvidenceThemes.map((theme) => (
                <p key={theme.themeId} className="text-sm text-stone-700">
                  {theme.label} • {theme.strength} • Evidence {theme.supportingEvidenceIds.join(", ")}
                </p>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
              Technologies
            </h3>
            <div className="mt-4 space-y-3">
              {result.resumeGuidance.priorityTechnologies.map((item) => (
                <p key={item.technology} className="text-sm text-stone-700">
                  {item.technology} • {item.guidance} • {item.recency}
                </p>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
              Roles to Emphasize
            </h3>
            <div className="mt-4 space-y-3">
              {result.resumeGuidance.rolesToEmphasize.map((role) => (
                <p key={role.roleId} className="text-sm text-stone-700">
                  {(role.roleTitle ?? role.employer ?? role.roleId)} • {role.emphasisReason}
                </p>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
              Claims to Avoid
            </h3>
            <div className="mt-4 space-y-3">
              {result.resumeGuidance.claimsToAvoid.map((claim) => (
                <p key={claim.concept} className="text-sm text-stone-700">
                  {claim.concept} • {claim.handling} • {claim.reason}
                </p>
              ))}
            </div>
          </article>
        </div>
      </Section>

      <Section
        title="Evidence Traceability"
        description="Every conclusion stays anchored to reviewed requirements and scored evidence."
      >
        <div className="space-y-4">
          {result.requirementConclusions.map((conclusion) => (
            <article
              key={conclusion.requirementId}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
            >
              <p className="text-base font-semibold text-stone-900">{conclusion.requirementText}</p>
              <p className="mt-2 text-sm text-stone-700">
                {conclusion.evidenceStrengthState.replace(/_/g, " ")} • {conclusion.conclusionCode.replace(/_/g, " ")}
              </p>
              <p className="mt-2 text-sm text-stone-700">{conclusion.explanation}</p>
              <p className="mt-2 text-xs text-stone-600">
                Top evidence: {conclusion.topCandidateIds.join(", ") || "None"} • Requirement ID:{" "}
                {conclusion.requirementId}
              </p>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );
}
