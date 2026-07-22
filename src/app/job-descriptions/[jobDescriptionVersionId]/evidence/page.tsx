import Link from "next/link";
import { notFound } from "next/navigation";
import { scoreRetrievedEvidenceAction } from "@/lib/evidence-scoring/actions";
import { getEvidenceScoringContext } from "@/lib/evidence-scoring/service";
import { retrieveCareerEvidenceAction } from "@/lib/evidence-retrieval/actions";
import { buildEvidenceRetrievalPageViewModel } from "@/lib/evidence-retrieval/presentation";
import {
  getEvidenceRetrievalContext,
  parseStoredEvidenceRetrievalRun
} from "@/lib/evidence-retrieval/service";
import { getDefaultWorkspace } from "@/lib/workspace";
import { EvidenceRequirementExplorer } from "@/components/evidence/evidence-requirement-explorer";

type EvidencePageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function careerProfileStatusMessage(issue: string | null | undefined) {
  switch (issue) {
    case "FIXTURE_ONLY":
      return "Only fixture Career Knowledge is available right now. Import or select a real Career Knowledge profile before retrieving evidence.";
    case "CURRENT_PROFILE_FIXTURE":
      return "The current Career Knowledge selection points to fixture data. Select the real Career Knowledge profile before retrieving evidence.";
    case "CURRENT_PROFILE_MISSING":
      return "Select a current real Career Knowledge profile before retrieving evidence.";
    default:
      return "Import a real Career Knowledge profile before retrieving evidence.";
  }
}

function formatPurpose(purpose: string) {
  return purpose.replace(/_/g, " ");
}

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

function OverviewSection({
  title,
  emptyText,
  items
}: {
  title: string;
  emptyText: string;
  items: Array<{ label: string; detail: string }>;
}) {
  return (
    <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-stone-900">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-stone-600">{emptyText}</p>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item) => (
            <article key={`${title}-${item.label}`} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-semibold text-stone-900">{item.label}</p>
              <p className="mt-2 text-sm text-stone-600">{item.detail}</p>
            </article>
          ))}
        </div>
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
            the active real Career Knowledge profile are available.
          </p>
          {!context.latestCareerProfileVersion ? (
            <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-800">
              {careerProfileStatusMessage(context.careerProfileSelectionIssue)}
            </p>
          ) : null}
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
              Back to Requirement Review
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
  const currentScoringRun =
    scoringContext?.reusableScoringRun?.evidenceRetrievalRunId === run.id
      ? scoringContext.reusableScoringRun
      : null;
  const isFixtureRun = run.careerProfileVersion.source.purpose === "FIXTURE";
  const allowFixtureScoring = process.env.ALLOW_FIXTURE_CAREER_PROFILE_SELECTION === "1";
  const isActiveUserProfile = context.latestCareerProfileVersion?.id === run.careerProfileVersionId;
  const pageModel = buildEvidenceRetrievalPageViewModel(result);
  const sections = [
    {
      id: "required",
      title: "Required",
      description: "Highest-priority required requirements, ranked with the strongest evidence first.",
      items: pageModel.required
    },
    {
      id: "preferred",
      title: "Preferred",
      description: "Preferred requirements with direct, related, or restricted support called out explicitly.",
      items: pageModel.preferred
    },
    {
      id: "contextual",
      title: "Contextual",
      description: "Contextual expectations and guidance from the reviewed requirement set.",
      items: pageModel.contextual
    },
    {
      id: "responsibilities",
      title: "Responsibilities",
      description: "Responsibility statements and the strongest retrieved evidence for each one.",
      items: pageModel.responsibilities
    },
    {
      id: "excluded",
      title: "Excluded",
      description: "Traceability for items intentionally kept out of downstream retrieval.",
      items: pageModel.excluded
    }
  ];

  const nextAction = currentScoringRun
    ? "Review the scored evidence and decide whether the current support is strong enough for this role."
    : isFixtureRun && !allowFixtureScoring
      ? "This historical fixture-backed run remains viewable, but it should not drive a real application decision."
      : "Score the retrieved evidence next to confirm which candidates are strongest and which gaps remain material.";

  return (
    <div className="space-y-8">
      <SuccessBanner success={success} />

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Evidence retrieval report
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
              {context.jobDescriptionVersion.opportunity.title}
            </h1>
            <p className="text-base text-stone-600">
              {context.jobDescriptionVersion.opportunity.company.name}
            </p>
            <p className="max-w-3xl text-sm leading-6 text-stone-600">
              This retrieval page is a decision-oriented inspection layer over the immutable evidence
              run. It summarizes what is strongly supported, what is partial or restricted, and
              what still looks like a genuine gap before scoring.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/requirements?analysisId=${result.requirementAnalysisId}`}
            >
              Back to Requirement Review
            </Link>
            {run.applicationId ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/applications/${run.applicationId}`}
              >
                Open application
              </Link>
            ) : null}
            {currentScoringRun ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/evidence/scores?runId=${currentScoringRun.id}&retrievalRunId=${run.id}`}
              >
                View Evidence Scores
              </Link>
            ) : null}
            {run.id && (!isFixtureRun || allowFixtureScoring) ? (
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

        {isFixtureRun ? (
          <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This retrieval used fixture Career Knowledge and should not be used for a real application decision.
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Retrieval status" value={result.status.replace(/_/g, " ")} />
          <SummaryCard
            label="Career Knowledge source"
            value={run.careerProfileVersion.source.filename}
            detail={`Imported ${run.careerProfileVersion.importedAt.toLocaleDateString("en-US")}`}
          />
          <SummaryCard
            label="Source version"
            value={
              run.careerProfileVersion.source.sourceVersion ??
              run.careerProfileVersion.sourceVersion ??
              "Unknown"
            }
            detail={`Profile purpose ${formatPurpose(run.careerProfileVersion.source.purpose)}`}
          />
          <SummaryCard
            label="Current profile"
            value={isActiveUserProfile ? "Yes" : "No"}
            detail={isActiveUserProfile ? "Matches the current workspace selection." : "Historical profile snapshot."}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-900">Primary next action</p>
          <p className="mt-2 text-sm text-stone-700">{nextAction}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Evidence Summary</h2>
        <p className="mt-2 text-sm text-stone-600">
          These are retrieval-level support states, not scoring conclusions. They summarize direct
          evidence, partial bundle support, restrictions, and genuine gaps without introducing a
          single percentage score.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Required total" value={pageModel.summary.totalRequired} />
          <SummaryCard label="Required strong support" value={pageModel.summary.strongRequired} />
          <SummaryCard label="Required good support" value={pageModel.summary.goodRequired} />
          <SummaryCard label="Required limited support" value={pageModel.summary.limitedRequired} />
          <SummaryCard
            label="Required restricted only"
            value={pageModel.summary.restrictedOnlyRequired}
          />
          <SummaryCard label="Required unmatched" value={pageModel.summary.unmatchedRequired} />
          <SummaryCard label="Preferred supported" value={pageModel.summary.supportedPreferred} />
          <SummaryCard label="Preferred partial" value={pageModel.summary.partialPreferred} />
          <SummaryCard label="Preferred unmatched" value={pageModel.summary.unmatchedPreferred} />
          <SummaryCard
            label="Responsibility coverage"
            value={pageModel.summary.responsibilityCoverageCount}
          />
          <SummaryCard
            label="Restricted candidates"
            value={pageModel.summary.restrictedCandidateCount}
          />
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <OverviewSection
          title="Strongest Supported Areas"
          emptyText="No strong or good support areas were identified yet."
          items={pageModel.strongestAreas}
        />
        <OverviewSection
          title="Largest Evidence Gaps"
          emptyText="No major retrieval gaps are currently called out."
          items={pageModel.largestGaps}
        />
      </div>

      <EvidenceRequirementExplorer sections={sections} technicalDetails={pageModel.technicalDetails} />
    </div>
  );
}
