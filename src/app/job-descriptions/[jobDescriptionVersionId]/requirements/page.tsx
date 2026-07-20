import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getEvidenceScoringContext } from "@/lib/evidence-scoring/service";
import { retrieveCareerEvidenceAction } from "@/lib/evidence-retrieval/actions";
import { getEvidenceRetrievalContext } from "@/lib/evidence-retrieval/service";
import {
  requirementCategorySchema,
  requirementKindSchema,
  type AnalyzedRequirement,
  type AnalyzedResponsibility,
  type JobRequirementAnalysisContract
} from "@/lib/job-descriptions/requirement-analysis-contract";
import {
  parsedJobDescriptionContractSchema,
  type DetectedSection,
  type ParserDiagnostic
} from "@/lib/job-descriptions/parser-contract";
import {
  addUserRequirementAction,
  applyRequirementBulkAction,
  confirmRequirementAnalysisAction,
  createRevisedRequirementAnalysisAction,
  saveRequirementReviewAction,
  saveResponsibilityReviewAction,
  toggleRequirementExclusionAction
} from "@/lib/job-descriptions/requirement-analysis-actions";
import {
  ensureRequirementAnalysisDraft,
  getJobRequirementAnalysisById,
  getJobRequirementAnalysisContext,
  parseStoredJobRequirementAnalysis
} from "@/lib/job-descriptions/requirement-analysis-service";
import { getDefaultWorkspace } from "@/lib/workspace";

type RequirementReviewPageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type RequirementReviewDetail = NonNullable<
  Awaited<ReturnType<typeof getJobRequirementAnalysisById>>
>;

const CATEGORY_OPTIONS = requirementCategorySchema.options;
const KIND_OPTIONS = requirementKindSchema.options;

function messageFromSuccess(success?: string) {
  const messages: Record<string, string> = {
    "requirement-saved": "Requirement review changes saved.",
    "responsibility-saved": "Responsibility review changes saved.",
    "item-excluded": "Item excluded from downstream requirement use.",
    "item-restored": "Excluded item restored.",
    "user-requirement-added": "User-added requirement saved.",
    "analysis-confirmed": "Requirement analysis confirmed.",
    "analysis-revised": "A revised requirement analysis draft was created.",
    "retrieval-created": "Career evidence retrieval completed successfully.",
    "retrieval-reused":
      "The current retrieval contract and engine already had a successful result for these exact inputs, so the existing run was reused.",
    "scoring-created": "Evidence scoring completed successfully.",
    "scoring-reused":
      "The current scoring contract, engine, and configuration already had a successful result for this exact retrieval run, so the existing scoring run was reused."
  };

  if (!success) {
    return null;
  }

  return messages[success] ?? null;
}

function StatusBanner({
  success,
  error
}: {
  success?: string;
  error?: string;
}) {
  const successMessage = messageFromSuccess(success);

  if (!successMessage && !error) {
    return null;
  }

  return (
    <div className="space-y-3">
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
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

function formatApplicability(value: string) {
  return value
    .replace(/_ONLY$/g, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildSectionPath(
  sectionId: string | null,
  sectionLookup: Map<string, DetectedSection>
) {
  if (!sectionId) {
    return "Manual review";
  }

  const path: string[] = [];
  let current = sectionLookup.get(sectionId) ?? null;

  while (current) {
    path.unshift(current.canonicalHeading);
    current = current.parentSectionId ? (sectionLookup.get(current.parentSectionId) ?? null) : null;
  }

  return path.join(" > ") || "Manual review";
}

function KindChecklist({
  selected,
  editable
}: {
  selected: string[];
  editable: boolean;
}) {
  return (
    <fieldset aria-label="Requirement kinds" className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
        Requirement kinds
      </legend>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {KIND_OPTIONS.map((kind) => (
          <label key={kind} className="flex items-center gap-2 text-sm text-stone-700">
            <input
              className="h-4 w-4 rounded border-stone-300 text-stone-950 focus:ring-stone-500"
              defaultChecked={selected.includes(kind)}
              disabled={!editable}
              name="kinds"
              type="checkbox"
              value={kind}
            />
            <span>{kind.replace(/_/g, " ")}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function DiagnosticList({
  diagnostics
}: {
  diagnostics: JobRequirementAnalysisContract["diagnostics"];
}) {
  const errors = diagnostics.filter((item) => item.severity === "ERROR");
  const warnings = diagnostics.filter((item) => item.severity === "WARNING");
  const info = diagnostics.filter((item) => item.severity === "INFO");

  return (
    <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">Diagnostics</h2>
          <p className="mt-2 text-sm text-stone-600">
            Errors block confirmation. Warnings require review. Information helps explain the classifier output.
          </p>
        </div>
        <p className="text-sm font-medium text-stone-600">
          {errors.length} errors, {warnings.length} warnings, {info.length} info
        </p>
      </div>

      {diagnostics.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">No diagnostics were generated.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {diagnostics.map((diagnostic) => (
            <article
              key={`${diagnostic.code}-${diagnostic.message}`}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
              <p className="text-sm font-semibold text-stone-900">
                {diagnostic.severity} • {diagnostic.code}
              </p>
              <p className="mt-2 text-sm text-stone-700">{diagnostic.message}</p>
              <p className="mt-2 text-xs text-stone-500">
                Rule: {diagnostic.rule}
                {diagnostic.location
                  ? ` • Lines ${diagnostic.location.startLine}-${diagnostic.location.endLine}`
                  : ""}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ItemHeader({
  title,
  badge
}: {
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <p className="text-base font-semibold text-stone-900">{title}</p>
      {badge ? (
        <span className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function RequirementReviewCard({
  jobDescriptionVersionId,
  analysisId,
  requirement,
  editable,
  sectionLookup
}: {
  jobDescriptionVersionId: string;
  analysisId: string;
  requirement: AnalyzedRequirement;
  editable: boolean;
  sectionLookup: Map<string, DetectedSection>;
}) {
  const displayText = requirement.correctedDisplayText ?? requirement.originalText;
  const showOriginalText = displayText !== requirement.originalText;

  return (
    <article className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
      <ItemHeader
        badge={requirement.userAdded ? "User Added" : requirement.confidence}
        title={displayText}
      />
      {showOriginalText ? (
        <p className="mt-3 text-sm text-stone-700">{requirement.originalText}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
        <span>Category: {requirement.category}</span>
        <span>Applicability: {formatApplicability(requirement.levelApplicability)}</span>
        <span>Rule: {requirement.classificationRule}</span>
        <span>Section: {buildSectionPath(requirement.sourceSectionId, sectionLookup)}</span>
        <span>Statement: {requirement.parserStatementId ?? "User-added"}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-600">
        <span>Technologies: {requirement.technologies.join(", ") || "None"}</span>
        <span>Experience: {requirement.experienceText ?? "None"}</span>
      </div>
      {requirement.degreeRequirement || requirement.certificationRequirement || requirement.equivalencyText ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-600">
          {requirement.degreeRequirement ? (
            <span>Education: {requirement.degreeRequirement}</span>
          ) : null}
          {requirement.certificationRequirement ? (
            <span>Certification: {requirement.certificationRequirement}</span>
          ) : null}
          {requirement.equivalencyText ? (
            <span>Equivalency: {requirement.equivalencyText}</span>
          ) : null}
        </div>
      ) : null}

      {editable ? (
        <div className="mt-5 space-y-4">
          <form
            action={saveRequirementReviewAction.bind(
              null,
              jobDescriptionVersionId,
              analysisId
            )}
            className="space-y-4"
          >
            <input name="requirementId" type="hidden" value={requirement.id} />
            <label className="block text-sm font-medium text-stone-700">
              Category
              <select
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                defaultValue={requirement.category}
                name="category"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-stone-700">
              Corrected display text
              <input
                className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                defaultValue={requirement.correctedDisplayText ?? ""}
                name="correctedDisplayText"
                type="text"
              />
            </label>

            <KindChecklist editable selected={requirement.kinds} />

            <label className="block text-sm font-medium text-stone-700">
              Review note
              <textarea
                className="mt-2 min-h-24 w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                defaultValue={requirement.reviewNote ?? ""}
                name="reviewNote"
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                className="h-4 w-4 rounded border-stone-300 text-stone-950 focus:ring-stone-500"
                defaultChecked={requirement.confirmationState === "CONFIRMED"}
                name="confirmed"
                type="checkbox"
              />
              <span>Mark confirmed</span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                type="submit"
              >
                Save requirement
              </button>
            </div>
          </form>

          <form
            action={toggleRequirementExclusionAction.bind(
              null,
              jobDescriptionVersionId,
              analysisId
            )}
          >
            <input name="itemType" type="hidden" value="requirement" />
            <input name="itemId" type="hidden" value={requirement.id} />
            <input name="excluded" type="hidden" value={requirement.excluded ? "false" : "true"} />
            <button
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              type="submit"
            >
              {requirement.excluded ? "Restore requirement" : "Exclude requirement"}
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-4 text-sm text-stone-600">
          Review note: {requirement.reviewNote ?? "None"}
        </p>
      )}
    </article>
  );
}

function ResponsibilityReviewCard({
  jobDescriptionVersionId,
  analysisId,
  responsibility,
  editable,
  sectionLookup
}: {
  jobDescriptionVersionId: string;
  analysisId: string;
  responsibility: AnalyzedResponsibility;
  editable: boolean;
  sectionLookup: Map<string, DetectedSection>;
}) {
  return (
    <article className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
      <ItemHeader badge={responsibility.confidence} title={responsibility.correctedDisplayText ?? responsibility.originalText} />
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
        <span>Relevance: {responsibility.relevance}</span>
        <span>Rule: {responsibility.classificationRule}</span>
        <span>
          Section: {buildSectionPath(responsibility.parserProvenance.sourceSectionId, sectionLookup)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-600">
        <span>Technologies: {responsibility.technologies.join(", ") || "None"}</span>
      </div>

      {editable ? (
        <div className="mt-5 space-y-4">
          <form
            action={saveResponsibilityReviewAction.bind(
              null,
              jobDescriptionVersionId,
              analysisId
            )}
            className="space-y-4"
          >
            <input name="responsibilityId" type="hidden" value={responsibility.id} />
            <KindChecklist editable selected={responsibility.kinds} />
            <label className="block text-sm font-medium text-stone-700">
              Review note
              <textarea
                className="mt-2 min-h-24 w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                defaultValue={responsibility.reviewNote ?? ""}
                name="reviewNote"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                className="h-4 w-4 rounded border-stone-300 text-stone-950 focus:ring-stone-500"
                defaultChecked={responsibility.confirmationState === "CONFIRMED"}
                name="confirmed"
                type="checkbox"
              />
              <span>Mark confirmed</span>
            </label>
            <button
              className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
              type="submit"
            >
              Save responsibility
            </button>
          </form>

          <form
            action={toggleRequirementExclusionAction.bind(
              null,
              jobDescriptionVersionId,
              analysisId
            )}
          >
            <input name="itemType" type="hidden" value="responsibility" />
            <input name="itemId" type="hidden" value={responsibility.id} />
            <input
              name="excluded"
              type="hidden"
              value={responsibility.excluded ? "false" : "true"}
            />
            <button
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              type="submit"
            >
              {responsibility.excluded ? "Restore responsibility" : "Exclude responsibility"}
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-4 text-sm text-stone-600">
          Review note: {responsibility.reviewNote ?? "None"}
        </p>
      )}
    </article>
  );
}

function GroupSection({
  title,
  description,
  emptyMessage,
  children
}: {
  title: string;
  description: string;
  emptyMessage: string;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];

  return (
    <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-stone-900">{title}</h2>
      <p className="mt-2 text-sm text-stone-600">{description}</p>
      {items.length > 0 ? (
        <div className="mt-6 space-y-4">{items}</div>
      ) : (
        <p className="mt-6 text-sm text-stone-600">{emptyMessage}</p>
      )}
    </section>
  );
}

function AddRequirementForm({
  jobDescriptionVersionId,
  analysisId
}: {
  jobDescriptionVersionId: string;
  analysisId: string;
}) {
  return (
    <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-stone-900">Add missing requirement</h2>
      <p className="mt-2 text-sm text-stone-600">
        Use this when the parser missed a real requirement from the posting. The original posting remains unchanged.
      </p>
      <form
        action={addUserRequirementAction.bind(null, jobDescriptionVersionId, analysisId)}
        className="mt-6 space-y-4"
      >
        <label className="block text-sm font-medium text-stone-700">
          Requirement text
          <textarea
            className="mt-2 min-h-28 w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            name="text"
            required
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Category
          <select
            className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            defaultValue="PREFERRED"
            name="category"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <KindChecklist editable selected={[]} />
        <label className="block text-sm font-medium text-stone-700">
          Technologies
          <input
            className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            name="technologies"
            placeholder="TypeScript, AWS, PostgreSQL"
            type="text"
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Experience detail
          <input
            className="mt-2 w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            name="experienceText"
            placeholder="5+ years of TypeScript"
            type="text"
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Review note
          <textarea
            className="mt-2 min-h-24 w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            name="reviewNote"
          />
        </label>
        <button
          className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          type="submit"
        >
          Add user requirement
        </button>
      </form>
    </section>
  );
}

function getStringParam(
  value: string | string[] | undefined
) {
  return typeof value === "string" ? value : undefined;
}

export default async function RequirementReviewPage({
  params,
  searchParams
}: RequirementReviewPageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const success = getStringParam(query.success);
  const error = getStringParam(query.error);
  const requestedAnalysisId = getStringParam(query.analysisId);
  const workspace = await getDefaultWorkspace();
  const context = await getJobRequirementAnalysisContext(workspace.id, jobDescriptionVersionId);
  const retrievalContext = await getEvidenceRetrievalContext(workspace.id, jobDescriptionVersionId);
  const scoringContext = await getEvidenceScoringContext(workspace.id, jobDescriptionVersionId);

  if (!context) {
    notFound();
  }

  let selectedAnalysisRecord: RequirementReviewDetail | null = null;

  if (requestedAnalysisId) {
    selectedAnalysisRecord = await getJobRequirementAnalysisById(
      workspace.id,
      requestedAnalysisId
    );
    if (!selectedAnalysisRecord) {
      notFound();
    }
  } else if (context.latestParse) {
    const ensured = await ensureRequirementAnalysisDraft(workspace.id, jobDescriptionVersionId);
    selectedAnalysisRecord = ensured.analysis;
  }

  const applicationLinkId =
    context.version.currentForApplications[0]?.id ?? context.version.sourceApplication?.id;

  if (!context.latestParse || !selectedAnalysisRecord) {
    return (
      <div className="space-y-8">
        <StatusBanner error={error} success={success} />
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
            Requirement review unavailable
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
            Parse this job description first. Requirement classification is generated from an immutable successful parser result.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}`}
            >
              Back to Description
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const analysis = parseStoredJobRequirementAnalysis(selectedAnalysisRecord.analysis);
  const parsed = parsedJobDescriptionContractSchema.parse(
    selectedAnalysisRecord.jobDescriptionParse.result
  );
  const sectionLookup = new Map(parsed.sections.map((section) => [section.id, section]));
  const parseDiagnostics = (selectedAnalysisRecord.jobDescriptionParse.diagnostics ??
    []) as ParserDiagnostic[];
  const editable =
    analysis.reviewStatus !== "CONFIRMED" && analysis.reviewStatus !== "SUPERSEDED";
  const canRetrieveEvidence =
    analysis.reviewStatus === "CONFIRMED" &&
    retrievalContext?.downstreamReadyRequirementAnalysis?.id === analysis.id &&
    Boolean(retrievalContext.latestCareerProfileVersion);

  const requiredRequirements = analysis.requirements.filter(
    (item) => item.category === "REQUIRED" && !item.excluded
  );
  const preferredRequirements = analysis.requirements.filter(
    (item) => item.category === "PREFERRED" && !item.excluded
  );
  const contextualRequirements = analysis.requirements.filter(
    (item) => item.category === "CONTEXTUAL" && !item.excluded
  );
  const noiseRequirements = analysis.requirements.filter(
    (item) => item.category === "NOISE" && !item.excluded
  );
  const noiseResponsibilities = analysis.responsibilities.filter(
    (item) => item.relevance === "NOISE" && !item.excluded
  );
  const needsReviewRequirements = analysis.requirements.filter(
    (item) => !item.excluded && (item.confidence === "LOW" || item.confirmationState !== "CONFIRMED")
  );
  const needsReviewResponsibilities = analysis.responsibilities.filter(
    (item) => !item.excluded && (item.confidence === "LOW" || item.confirmationState !== "CONFIRMED")
  );
  const includedResponsibilities = analysis.responsibilities.filter((item) => !item.excluded);
  const excludedItems = [
    ...analysis.requirements.filter((item) => item.excluded).map((item) => ({
      id: item.id,
      type: "Requirement",
      text: item.correctedDisplayText ?? item.originalText
    })),
    ...analysis.responsibilities.filter((item) => item.excluded).map((item) => ({
      id: item.id,
      type: "Responsibility",
      text: item.correctedDisplayText ?? item.originalText
    }))
  ];

  return (
    <div className="space-y-8">
      <StatusBanner error={error} success={success} />

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Requirement review
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {context.version.opportunity.title}
            </h1>
            <p className="mt-3 text-base text-stone-600">
              {context.version.opportunity.company.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}`}
            >
              Back to Description
            </Link>
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/analysis`}
            >
              View Parsed Job Description
            </Link>
            {applicationLinkId ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/applications/${applicationLinkId}`}
              >
                Open application
              </Link>
            ) : null}
            {!editable && analysis.reviewStatus === "CONFIRMED" ? (
              retrievalContext?.reusableRun ? (
                <Link
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  href={`/job-descriptions/${jobDescriptionVersionId}/evidence?runId=${retrievalContext.reusableRun.id}`}
                >
                  View Candidate Evidence
                </Link>
              ) : null
            ) : null}
            {!editable && analysis.reviewStatus === "CONFIRMED" && scoringContext?.reusableScoringRun ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/evidence/scores?runId=${scoringContext.reusableScoringRun.id}&retrievalRunId=${scoringContext.reusableScoringRun.evidenceRetrievalRunId}`}
              >
                View Evidence Scores
              </Link>
            ) : null}
            {!editable && canRetrieveEvidence && !retrievalContext?.reusableRun ? (
              <form
                action={retrieveCareerEvidenceAction.bind(
                  null,
                  jobDescriptionVersionId,
                  `/job-descriptions/${jobDescriptionVersionId}/requirements?analysisId=${analysis.id}`
                )}
              >
                <button
                  className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                  type="submit"
                >
                  Retrieve Career Evidence
                </button>
              </form>
            ) : null}
            {!editable && analysis.reviewStatus === "CONFIRMED" ? (
              <form
                action={createRevisedRequirementAnalysisAction.bind(
                  null,
                  jobDescriptionVersionId,
                  analysis.id
                )}
              >
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Create Revised Analysis
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Review status" value={analysis.reviewStatus.replace(/_/g, " ")} />
          <SummaryCard
            label="Downstream readiness"
            value={analysis.summary.downstreamReadiness.replace(/_/g, " ")}
            detail="Controls evidence retrieval and later automation."
          />
          <SummaryCard label="Analysis version" value={selectedAnalysisRecord.classifierVersion} detail={`Contract ${analysis.contractVersion}`} />
          <SummaryCard label="Parser version" value={analysis.parserVersion} detail={`Parse ${analysis.parseId}`} />
          <SummaryCard label="Required" value={analysis.summary.requiredCount} />
          <SummaryCard label="Preferred" value={analysis.summary.preferredCount} />
          <SummaryCard label="Contextual" value={analysis.summary.contextualCount} />
          <SummaryCard label="Responsibilities" value={analysis.summary.includedResponsibilitiesCount} />
          <SummaryCard
            label="Extracted requirements"
            value={analysis.summary.qualificationExtractionCount}
            detail={`${analysis.summary.responsibilityExtractionCount} responsibilities detected`}
          />
          <SummaryCard label="Needs review" value={analysis.summary.unresolvedReviewItemsCount} detail={`${analysis.summary.lowConfidenceCount} low confidence`} />
        </div>
      </section>

      {analysis.summary.downstreamReadiness !== "READY" ? (
        <section className="rounded-3xl border border-amber-300 bg-amber-50 p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-amber-950">Downstream automation is paused</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-amber-900">
            Evidence retrieval, scoring, and later resume automation stay paused until this requirement set has enough extraction coverage for deterministic downstream use.
          </p>
        </section>
      ) : null}

      {parseDiagnostics.length > 0 ? (
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-stone-900">Parser diagnostics</h2>
              <p className="mt-2 text-sm text-stone-600">
                These messages come from the immutable parser output linked to this analysis.
              </p>
            </div>
            <p className="text-sm font-medium text-stone-600">
              {parseDiagnostics.filter((item) => item.severity === "ERROR").length} errors,{" "}
              {parseDiagnostics.filter((item) => item.severity === "WARNING").length} warnings,{" "}
              {parseDiagnostics.filter((item) => item.severity === "INFO").length} info
            </p>
          </div>
          <div className="mt-6 space-y-3">
            {parseDiagnostics.map((diagnostic) => (
              <article
                key={`${diagnostic.code}-${diagnostic.message}`}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
              >
                <p className="text-sm font-semibold text-stone-900">
                  {diagnostic.severity} • {diagnostic.code}
                </p>
                <p className="mt-2 text-sm text-stone-700">{diagnostic.message}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {editable ? (
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-stone-900">Bulk review actions</h2>
              <p className="mt-2 text-sm text-stone-600">
                Use low-risk actions to speed up confirmation without mutating the parser result.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <form action={applyRequirementBulkAction.bind(null, jobDescriptionVersionId, analysis.id)}>
                <input name="action" type="hidden" value="confirm-high-confidence" />
                <button className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950" type="submit">
                  Confirm all high-confidence items
                </button>
              </form>
              <form action={applyRequirementBulkAction.bind(null, jobDescriptionVersionId, analysis.id)}>
                <input name="action" type="hidden" value="exclude-noise" />
                <button className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950" type="submit">
                  Exclude all noise items
                </button>
              </form>
              <form action={applyRequirementBulkAction.bind(null, jobDescriptionVersionId, analysis.id)}>
                <input name="action" type="hidden" value="restore-excluded" />
                <button className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950" type="submit">
                  Restore all excluded items
                </button>
              </form>
            </div>
          </div>
        </section>
      ) : null}

      <DiagnosticList diagnostics={analysis.diagnostics} />

      <GroupSection
        description="Unresolved review work is summarized here once, while the editable records stay in their category sections below."
        emptyMessage="No items currently need review."
        title="Needs Review"
      >
        <SummaryCard
          label="Requirements needing review"
          value={needsReviewRequirements.length}
          detail={`${analysis.summary.lowConfidenceCount} low-confidence requirements or responsibilities`}
        />
        <SummaryCard
          label="Responsibilities needing review"
          value={needsReviewResponsibilities.length}
          detail="Review the category sections below to confirm or correct these records."
        />
      </GroupSection>

      <GroupSection
        description="Minimum conditions that should feed later evidence retrieval."
        emptyMessage="No required requirements are currently included."
        title="Required"
      >
        {requiredRequirements.map((item) => (
          <RequirementReviewCard
            key={item.id}
            analysisId={analysis.id}
            editable={editable}
            jobDescriptionVersionId={jobDescriptionVersionId}
            requirement={item}
            sectionLookup={sectionLookup}
          />
        ))}
      </GroupSection>

      <GroupSection
        description="Optional advantages that should remain distinct from minimum requirements."
        emptyMessage="No preferred requirements are currently included."
        title="Preferred"
      >
        {preferredRequirements.map((item) => (
          <RequirementReviewCard
            key={item.id}
            analysisId={analysis.id}
            editable={editable}
            jobDescriptionVersionId={jobDescriptionVersionId}
            requirement={item}
            sectionLookup={sectionLookup}
          />
        ))}
      </GroupSection>

      <GroupSection
        description="Context that helps describe the role without overstating it as a hard candidate requirement."
        emptyMessage="No contextual requirements are currently included."
        title="Contextual"
      >
        {contextualRequirements.map((item) => (
          <RequirementReviewCard
            key={item.id}
            analysisId={analysis.id}
            editable={editable}
            jobDescriptionVersionId={jobDescriptionVersionId}
            requirement={item}
            sectionLookup={sectionLookup}
          />
        ))}
      </GroupSection>

      <GroupSection
        description="Responsibilities remain separately identifiable and are not automatically promoted into hard requirements."
        emptyMessage="No responsibilities are currently included."
        title="Responsibilities"
      >
        {includedResponsibilities.map((item) => (
          <ResponsibilityReviewCard
            key={item.id}
            analysisId={analysis.id}
            editable={editable}
            jobDescriptionVersionId={jobDescriptionVersionId}
            responsibility={item}
            sectionLookup={sectionLookup}
          />
        ))}
      </GroupSection>

      <GroupSection
        description="Noise stays visible for traceability but should not drive later evidence retrieval."
        emptyMessage="No included noise items remain."
        title="Noise"
      >
        {noiseRequirements.map((item) => (
          <RequirementReviewCard
            key={item.id}
            analysisId={analysis.id}
            editable={editable}
            jobDescriptionVersionId={jobDescriptionVersionId}
            requirement={item}
            sectionLookup={sectionLookup}
          />
        ))}
        {noiseResponsibilities.map((item) => (
          <ResponsibilityReviewCard
            key={item.id}
            analysisId={analysis.id}
            editable={editable}
            jobDescriptionVersionId={jobDescriptionVersionId}
            responsibility={item}
            sectionLookup={sectionLookup}
          />
        ))}
      </GroupSection>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Excluded items</h2>
        <p className="mt-2 text-sm text-stone-600">
          Excluded items remain stored and inspectable, but they are omitted from the authoritative downstream set.
        </p>
        {excludedItems.length > 0 ? (
          <div className="mt-6 space-y-3">
            {excludedItems.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
              >
                <p className="text-sm font-semibold text-stone-900">{item.type}</p>
                <p className="mt-2 text-sm text-stone-700">{item.text}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-stone-600">No items are currently excluded.</p>
        )}
      </section>

      {editable ? <AddRequirementForm analysisId={analysis.id} jobDescriptionVersionId={jobDescriptionVersionId} /> : null}

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">
          {editable ? "Confirm requirement analysis" : "Confirmed analysis"}
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          This confirmed version is the authoritative reviewed requirement set consumed by the next workflow stage.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryCard label="Required" value={analysis.summary.requiredCount} />
          <SummaryCard label="Preferred" value={analysis.summary.preferredCount} />
          <SummaryCard label="Contextual" value={analysis.summary.contextualCount} />
          <SummaryCard label="Excluded" value={analysis.summary.excludedRequirementsCount + analysis.summary.excludedResponsibilitiesCount} />
          <SummaryCard label="User-added" value={analysis.summary.userAddedRequirementsCount} />
          <SummaryCard label="Overrides" value={analysis.summary.userOverridesCount} />
        </div>
        {editable ? (
          <form
            action={confirmRequirementAnalysisAction.bind(
              null,
              jobDescriptionVersionId,
              analysis.id
            )}
            className="mt-6 space-y-4"
          >
            {analysis.summary.lowConfidenceCount > 0 ? (
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  className="h-4 w-4 rounded border-stone-300 text-stone-950 focus:ring-stone-500"
                  defaultChecked={analysis.lowConfidenceAcknowledged}
                  name="acknowledgeLowConfidence"
                  type="checkbox"
                />
                <span>
                  I acknowledge the remaining low-confidence items and want to confirm this reviewed set anyway.
                </span>
              </label>
            ) : null}
            <button
              className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
              type="submit"
            >
              Confirm Requirement Analysis
            </button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-stone-600">
            This analysis is read-only. Create a revised analysis to make additional changes while preserving this confirmed version.
          </p>
        )}
      </section>
    </div>
  );
}
