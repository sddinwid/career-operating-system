import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { generateMatchReportAction } from "@/lib/match-report/actions";
import { getMatchReportContext } from "@/lib/match-report/service";
import {
  getEvidenceScoringContext,
  parseStoredEvidenceScoringRun
} from "@/lib/evidence-scoring/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type EvidenceScoringPageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function SuccessBanner({ success }: { success?: string }) {
  const messages: Record<string, string> = {
    "scoring-created": "Evidence scoring completed successfully.",
    "scoring-reused":
      "The current scoring contract, engine, and configuration already had a successful result for this exact retrieval run, so the existing scoring run was reused.",
    "report-created": "Match report generated successfully.",
    "report-reused":
      "The current report contract, engine, and configuration already had a successful result for this exact scoring run, so the existing match report was reused."
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

function GroupSection({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: ReactNode[];
}) {
  return (
    <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-stone-900">{title}</h2>
      <p className="mt-2 text-sm text-stone-600">{description}</p>
      {items.length > 0 ? (
        <div className="mt-6 space-y-4">{items}</div>
      ) : (
        <p className="mt-6 text-sm text-stone-600">No items in this group.</p>
      )}
    </section>
  );
}

export default async function EvidenceScoringPage({
  params,
  searchParams
}: EvidenceScoringPageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const runId = getStringParam(query.runId);
  const success = getStringParam(query.success);
  const workspace = await getDefaultWorkspace();
  const context = await getEvidenceScoringContext(workspace.id, jobDescriptionVersionId);
  const reportContext = await getMatchReportContext(workspace.id, jobDescriptionVersionId);

  if (!context) {
    notFound();
  }

  const selectedRunId = runId ?? context.reusableScoringRun?.id;
  if (!selectedRunId) {
    return (
      <div className="space-y-8">
        <SuccessBanner success={success} />
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
            Evidence scoring unavailable
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
            Score a successful evidence retrieval run first. Scoring is deterministic, immutable,
            and read-only.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/evidence`}
            >
              Back to Candidate Evidence
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const { run, result } = await parseStoredEvidenceScoringRun(workspace.id, selectedRunId);
  const requiredItems = result.requirementScores.filter((item) => item.category === "REQUIRED");
  const preferredItems = result.requirementScores.filter((item) => item.category === "PREFERRED");
  const contextualItems = result.requirementScores.filter((item) => item.category === "CONTEXTUAL");
  const responsibilityItems = result.requirementScores.filter(
    (item) => item.category === "RESPONSIBILITY"
  );
  const noEvidenceItems = result.requirementScores.filter((item) =>
    ["NO_EVIDENCE", "WEAK_EVIDENCE"].includes(item.evidenceStrengthState)
  );
  const restrictedOnlyItems = result.requirementScores.filter(
    (item) => item.evidenceStrengthState === "RESTRICTED_ONLY"
  );

  const renderRequirement = (item: (typeof result.requirementScores)[number]) => (
    <article key={item.requirementId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-stone-900">
            {item.correctedDisplayText ?? item.originalText}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {item.category.replace(/_/g, " ")} • {item.evidenceStrengthState.replace(/_/g, " ")}
          </p>
        </div>
        <span className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">
          Highest score {item.highestCandidateScore ?? "—"}
        </span>
      </div>
      <p className="mt-3 text-sm text-stone-700">Kinds: {item.kinds.join(", ")}</p>
      <p className="mt-2 text-sm text-stone-700">
        Eligible {item.eligibleCandidateCount} • Restricted {item.restrictedCandidateCount} •
        Ineligible {item.ineligibleCandidateCount}
      </p>
      {item.diagnostics.length > 0 ? (
        <div className="mt-4 space-y-2">
          {item.diagnostics.map((diagnostic) => (
            <p key={`${item.requirementId}-${diagnostic.code}`} className="text-xs text-stone-600">
              {diagnostic.severity} • {diagnostic.message}
            </p>
          ))}
        </div>
      ) : null}
      {item.rankedCandidates.length > 0 ? (
        <div className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
            Ranked Candidate Evidence
          </h3>
          {item.rankedCandidates.map((candidate) => (
            <article
              key={candidate.candidateId}
              className="rounded-2xl border border-stone-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    {candidate.rank ? `#${candidate.rank} ` : ""}{candidate.displayTitle}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    Score {candidate.finalScore ?? "N/A"} • {candidate.strengthBand.replace(/_/g, " ")} • {candidate.context} • {candidate.recency}
                  </p>
                </div>
                <span className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">
                  {candidate.eligibility.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-3 text-sm text-stone-700">{candidate.claimText}</p>
              <p className="mt-2 text-xs text-stone-600">
                Provenance: {candidate.sourceProvenance.sourceSection} • {candidate.sourceProvenance.sourcePath}
              </p>
              {candidate.factorContributions.length > 0 ? (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                    Positive Factors
                  </p>
                  {candidate.factorContributions.map((factor) => (
                    <p key={`${candidate.candidateId}-${factor.factorCode}`} className="text-xs text-stone-700">
                      +{factor.value} {factor.label}
                    </p>
                  ))}
                </div>
              ) : null}
              {candidate.penaltyContributions.length > 0 ? (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                    Penalties
                  </p>
                  {candidate.penaltyContributions.map((penalty) => (
                    <p key={`${candidate.candidateId}-${penalty.factorCode}`} className="text-xs text-amber-700">
                      {penalty.value} {penalty.label}
                    </p>
                  ))}
                </div>
              ) : null}
              <p className="mt-3 text-xs text-stone-600">
                Retrieved because: {candidate.retrievalReasons.map((reason) => reason.explanation).join(" | ")}
              </p>
              {candidate.restrictions.length > 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  Restrictions: {candidate.restrictions.map((restriction) => restriction.code).join(", ")}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </article>
  );

  return (
    <div className="space-y-8">
      <SuccessBanner success={success} />

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Evidence scores
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
              href={`/job-descriptions/${jobDescriptionVersionId}/evidence?runId=${run.evidenceRetrievalRunId}`}
            >
              Back to Candidate Evidence
            </Link>
            {run.applicationId ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/applications/${run.applicationId}`}
              >
                Open application
              </Link>
            ) : null}
            {reportContext?.reusableMatchReportRun ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/match-report?runId=${reportContext.reusableMatchReportRun.id}&scoringRunId=${run.id}`}
              >
                View Match Report
              </Link>
            ) : (
              <form
                action={generateMatchReportAction.bind(
                  null,
                  run.id,
                  jobDescriptionVersionId,
                  `/job-descriptions/${jobDescriptionVersionId}/evidence/scores?runId=${run.id}&retrievalRunId=${run.evidenceRetrievalRunId}`
                )}
              >
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Generate Match Report
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Status" value={result.status.replace(/_/g, " ")} />
          <SummaryCard label="Scoring engine" value={run.engineVersion} detail={`Contract ${run.contractVersion}`} />
          <SummaryCard label="Configuration" value={run.configurationVersion} detail={`Retrieval run ${run.evidenceRetrievalRunId}`} />
          <SummaryCard label="Career profile" value={run.careerProfileVersion.sourceFilename} detail={run.careerProfileVersion.id} />
          <SummaryCard label="Analysis" value={run.requirementAnalysis.classifierVersion} detail={run.requirementAnalysis.id} />
          <SummaryCard label="Required strong" value={result.summary.requiredStrongEvidenceCount} />
          <SummaryCard label="Required good" value={result.summary.requiredGoodEvidenceCount} />
          <SummaryCard label="Required gaps" value={result.summary.requiredNoEvidenceCount} />
          <SummaryCard
            label="Match report"
            value={
              reportContext?.reusableMatchReportRun
                ? reportContext.reusableMatchReportRun.configurationVersion
                : "Not generated"
            }
            detail={
              reportContext?.reusableMatchReportRun
                ? `${reportContext.reusableMatchReportRun.engineVersion} • Contract ${reportContext.reusableMatchReportRun.contractVersion}`
                : "Generate a deterministic, read-only match report from this scoring run."
            }
          />
        </div>
      </section>

      <GroupSection
        title="Required"
        description="Ranked candidate evidence for required requirements."
        items={requiredItems.map(renderRequirement)}
      />
      <GroupSection
        title="Preferred"
        description="Ranked candidate evidence for preferred requirements."
        items={preferredItems.map(renderRequirement)}
      />
      <GroupSection
        title="Contextual"
        description="Ranked candidate evidence for contextual requirements."
        items={contextualItems.map(renderRequirement)}
      />
      <GroupSection
        title="Responsibilities"
        description="Ranked candidate evidence for responsibilities."
        items={responsibilityItems.map(renderRequirement)}
      />
      <GroupSection
        title="No Evidence"
        description="Requirements with weak or no usable primary evidence."
        items={noEvidenceItems.map(renderRequirement)}
      />
      <GroupSection
        title="Restricted Only"
        description="Requirements with visible but restricted-only evidence."
        items={restrictedOnlyItems.map(renderRequirement)}
      />
    </div>
  );
}
