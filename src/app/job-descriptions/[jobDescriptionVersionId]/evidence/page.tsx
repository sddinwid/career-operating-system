import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { scoreRetrievedEvidenceAction } from "@/lib/evidence-scoring/actions";
import { getEvidenceScoringContext } from "@/lib/evidence-scoring/service";
import { retrieveCareerEvidenceAction } from "@/lib/evidence-retrieval/actions";
import {
  getEvidenceRetrievalContext,
  parseStoredEvidenceRetrievalRun
} from "@/lib/evidence-retrieval/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type EvidencePageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function SuccessBanner({ success }: { success?: string }) {
  const messages: Record<string, string> = {
    "retrieval-created": "Career evidence retrieval completed successfully.",
    "retrieval-reused":
      "The current retrieval contract and engine already had a successful result for these exact inputs, so the existing run was reused.",
    "scoring-created": "Evidence scoring completed successfully.",
    "scoring-reused":
      "The current scoring contract, engine, and configuration already had a successful result for this exact retrieval run, so the existing scoring run was reused."
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

export default async function EvidenceRetrievalPage({
  params,
  searchParams
}: EvidencePageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const runId = getStringParam(query.runId);
  const success = getStringParam(query.success);
  const workspace = await getDefaultWorkspace();
  const context = await getEvidenceRetrievalContext(workspace.id, jobDescriptionVersionId);
  const scoringContext = await getEvidenceScoringContext(workspace.id, jobDescriptionVersionId);

  if (!context) {
    notFound();
  }

  const selectedRunId = runId ?? context.reusableRun?.id;

  if (!selectedRunId) {
    const ready = Boolean(
      context.latestCareerProfileVersion && context.downstreamReadyRequirementAnalysis
    );

    return (
      <div className="space-y-8">
        <SuccessBanner success={success} />
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
            Candidate evidence unavailable
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
            Evidence retrieval is read-only and runs only when a confirmed requirement analysis and
            an active career profile version are available.
          </p>
          {context.latestConfirmedRequirementAnalysis &&
          context.requirementAnalysisDownstreamReadiness !== "READY" ? (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-800">
              The current confirmed requirement analysis is not ready for downstream automation yet.
              Return to requirement review to address extraction coverage before retrieving evidence.
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/requirements`}
            >
              Back to Requirements
            </Link>
            {ready ? (
              <form
                action={retrieveCareerEvidenceAction.bind(
                  null,
                  jobDescriptionVersionId,
                  `/job-descriptions/${jobDescriptionVersionId}/evidence`
                )}
              >
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Retrieve Career Evidence
                </button>
              </form>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  const { run, result } = await parseStoredEvidenceRetrievalRun(workspace.id, selectedRunId);
  const requiredItems = result.requirementResults.filter((item) => item.category === "REQUIRED");
  const preferredItems = result.requirementResults.filter((item) => item.category === "PREFERRED");
  const contextualItems = result.requirementResults.filter((item) => item.category === "CONTEXTUAL");
  const responsibilityItems = result.requirementResults.filter((item) => item.itemType === "RESPONSIBILITY");
  const noCandidateItems = result.requirementResults.filter(
    (item) => item.coverageState === "NO_CANDIDATES" || item.coverageState === "LIMITED_CANDIDATES"
  );
  const excludedItems = result.requirementResults.filter((item) => item.coverageState === "EXCLUDED");

  const renderRequirement = (item: (typeof result.requirementResults)[number]) => (
    <article key={item.requirementId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-stone-900">
            {item.correctedDisplayText ?? item.originalText}
          </p>
          <p className="mt-1 text-sm text-stone-600">
            {item.category.replace(/_/g, " ")} • {item.coverageState.replace(/_/g, " ")}
          </p>
        </div>
        <span className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">
          {item.candidateEvidence.length} candidates
        </span>
      </div>
      <p className="mt-3 text-sm text-stone-700">Kinds: {item.kinds.join(", ")}</p>
      <p className="mt-2 text-sm text-stone-700">
        Technologies: {item.technologies.join(", ") || "None"}
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
      {item.candidateEvidence.length > 0 ? (
        <div className="mt-5 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
            Candidate Evidence
          </h3>
          {item.candidateEvidence.map((candidate) => (
            <article
              key={candidate.candidateId}
              className="rounded-2xl border border-stone-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-900">{candidate.displayTitle}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    {candidate.evidenceType.replace(/_/g, " ")} • {candidate.context} • {candidate.recency}
                  </p>
                </div>
                <span className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">
                  {candidate.eligibility.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-3 text-sm text-stone-700">{candidate.claimText}</p>
              <p className="mt-2 text-xs text-stone-600">
                Retrieved because: {candidate.retrievalReasons.map((reason) => reason.explanation).join(" | ")}
              </p>
              <p className="mt-2 text-xs text-stone-600">
                Technologies: {candidate.technologies.join(", ") || "None"}
              </p>
              <p className="mt-2 text-xs text-stone-600">
                Provenance: {candidate.sourceProvenance.sourceSection} • {candidate.sourceProvenance.sourcePath}
              </p>
              {candidate.restrictions.length > 0 ? (
                <p className="mt-2 text-xs text-amber-700">
                  Restrictions: {candidate.restrictions.map((item) => item.code).join(", ")}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
      {item.excludedEvidence.length > 0 ? (
        <div className="mt-5 space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
            Restricted Candidates
          </h3>
          {item.excludedEvidence.map((candidate) => (
            <p key={candidate.candidateId} className="text-sm text-stone-600">
              {candidate.displayTitle} • {candidate.eligibility.replace(/_/g, " ")}
            </p>
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
              Candidate evidence
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
              href={`/job-descriptions/${jobDescriptionVersionId}/requirements?analysisId=${result.requirementAnalysisId}`}
            >
              Back to Requirements
            </Link>
            {run.applicationId ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/applications/${run.applicationId}`}
              >
                Open application
              </Link>
            ) : null}
            {scoringContext?.reusableScoringRun ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/evidence/scores?runId=${scoringContext.reusableScoringRun.id}&retrievalRunId=${run.id}`}
              >
                View Evidence Scores
              </Link>
            ) : null}
            {run.id ? (
              <form
                action={scoreRetrievedEvidenceAction.bind(
                  null,
                  run.id,
                  jobDescriptionVersionId,
                  `/job-descriptions/${jobDescriptionVersionId}/evidence`
                )}
              >
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Score Retrieved Evidence
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Status" value={result.status.replace(/_/g, " ")} />
          <SummaryCard
            label="Career profile"
            value={run.careerProfileVersion.sourceFilename}
            detail={run.careerProfileVersion.id}
          />
          <SummaryCard
            label="Analysis"
            value={run.requirementAnalysis.classifierVersion}
            detail={run.requirementAnalysis.id}
          />
          <SummaryCard
            label="Retrieval versions"
            value={run.engineVersion}
            detail={`Contract ${run.contractVersion}`}
          />
          <SummaryCard
            label="Scoring"
            value={
              scoringContext?.reusableScoringRun
                ? scoringContext.reusableScoringRun.configurationVersion
                : "Not scored"
            }
            detail={
              scoringContext?.reusableScoringRun
                ? `${scoringContext.reusableScoringRun.engineVersion} • Contract ${scoringContext.reusableScoringRun.contractVersion}`
                : "Run deterministic scoring from this retrieval result."
            }
          />
          <SummaryCard label="Required covered" value={result.summary.requiredWithCandidates} />
          <SummaryCard label="Preferred covered" value={result.summary.preferredWithCandidates} />
          <SummaryCard label="Gap count" value={result.summary.noCandidateCount} />
          <SummaryCard
            label="Restricted candidates"
            value={result.summary.restrictedCandidateCount}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Gap Summary</h2>
        {noCandidateItems.length > 0 ? (
          <div className="mt-6 space-y-3">
            {noCandidateItems.map((item) => (
              <article key={item.requirementId} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm font-semibold text-stone-900">
                  {item.correctedDisplayText ?? item.originalText}
                </p>
                <p className="mt-2 text-sm text-stone-600">
                  {item.coverageState.replace(/_/g, " ")} • {item.technologies.join(", ") || "No technologies"}
                </p>
                <p className="mt-2 text-xs text-stone-600">
                  Diagnostics: {item.diagnostics.map((diagnostic) => diagnostic.message).join(" | ") || "No additional diagnostics"}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-stone-600">No current coverage gaps were reported.</p>
        )}
      </section>

      <GroupSection
        title="Required"
        description="Potentially relevant evidence for required requirements."
        items={requiredItems.map(renderRequirement)}
      />
      <GroupSection
        title="Preferred"
        description="Potentially relevant evidence for preferred requirements."
        items={preferredItems.map(renderRequirement)}
      />
      <GroupSection
        title="Contextual"
        description="Potentially relevant evidence for contextual requirements."
        items={contextualItems.map(renderRequirement)}
      />
      <GroupSection
        title="Responsibilities"
        description="Potentially relevant evidence for included responsibilities."
        items={responsibilityItems.map(renderRequirement)}
      />
      <GroupSection
        title="Excluded"
        description="Traceability for items intentionally excluded from downstream matching."
        items={excludedItems.map(renderRequirement)}
      />
    </div>
  );
}
