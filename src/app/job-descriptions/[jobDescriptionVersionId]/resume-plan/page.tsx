import Link from "next/link";
import { notFound } from "next/navigation";
import { createResumeCompositionAction } from "@/lib/resume-composition/actions";
import { getResumeCompositionContext } from "@/lib/resume-composition/service";
import { createStructuredResumePlanAction } from "@/lib/structured-resume/actions";
import {
  getStructuredResumeContext,
  parseStoredStructuredResumeVersion
} from "@/lib/structured-resume/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type ResumePlanPageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function SuccessBanner({ success }: { success?: string }) {
  const messages: Record<string, string> = {
    "plan-created": "Structured resume plan created successfully.",
    "plan-reused":
      "The current structured resume contract, engine, and configuration already had a successful result for this exact match report and career profile, so the existing plan was reused.",
    "composition-created": "Targeted resume composed successfully.",
    "composition-reused":
      "The current composition contract, engine, and configuration already had a successful result for this exact structured plan and career profile, so the existing resume content was reused."
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

export default async function ResumePlanPage({ params, searchParams }: ResumePlanPageProps) {
  const { jobDescriptionVersionId } = await params;
  const query = (await searchParams) ?? {};
  const versionId = getStringParam(query.versionId);
  const success = getStringParam(query.success);
  const workspace = await getDefaultWorkspace();
  const context = await getStructuredResumeContext(workspace.id, jobDescriptionVersionId);
  const compositionContext = await getResumeCompositionContext(workspace.id, jobDescriptionVersionId);

  if (!context) {
    notFound();
  }

  const selectedVersionId = versionId ?? context.reusableStructuredResumeVersion?.id;

  if (!selectedVersionId) {
    return (
      <div className="space-y-8">
        <SuccessBanner success={success} />
        <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
          <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
            Structured resume plan unavailable
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
            Create a successful match report with usable resume readiness before planning a
            structured resume.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/match-report`}
            >
              Back to Match Report
            </Link>
            {context.planningReady && context.reusableMatchReportRun ? (
              <form
                action={createStructuredResumePlanAction.bind(
                  null,
                  context.reusableMatchReportRun.id,
                  jobDescriptionVersionId,
                  `/job-descriptions/${jobDescriptionVersionId}/resume-plan`
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
        </section>
      </div>
    );
  }

  const { version, plan } = await parseStoredStructuredResumeVersion(workspace.id, selectedVersionId);

  return (
    <div className="space-y-8">
      <SuccessBanner success={success} />

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Structured resume plan
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {plan.targetConfiguration.targetRole}
            </h1>
            <p className="mt-3 text-base text-stone-600">
              {plan.targetConfiguration.targetCompany}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${jobDescriptionVersionId}/match-report?runId=${version.matchReportRunId}`}
            >
              Back to Match Report
            </Link>
            {version.applicationId ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/applications/${version.applicationId}`}
              >
                Open application
              </Link>
            ) : null}
            {compositionContext?.reusableResumeCompositionVersion ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/job-descriptions/${jobDescriptionVersionId}/resume?versionId=${compositionContext.reusableResumeCompositionVersion.id}`}
              >
                View Targeted Resume
              </Link>
            ) : compositionContext?.compositionReady ? (
              <form
                action={createResumeCompositionAction.bind(
                  null,
                  version.id,
                  jobDescriptionVersionId,
                  `/job-descriptions/${jobDescriptionVersionId}/resume`
                )}
              >
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Compose Targeted Resume
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Status" value={plan.status.replace(/_/g, " ")} />
          <SummaryCard
            label="Role family"
            value={plan.targetConfiguration.targetRoleFamily.replace(/_/g, " ")}
          />
          <SummaryCard
            label="Stack rule"
            value={plan.targetConfiguration.stackRule.selectedStackRuleFamily.replace(/_/g, " ")}
          />
          <SummaryCard
            label="Versions"
            value={version.engineVersion}
            detail={`Contract ${version.contractVersion} | Config ${version.configurationVersion}`}
          />
          <SummaryCard label="Selected roles" value={plan.summary.selectedRoles} />
          <SummaryCard label="Selected projects" value={plan.summary.selectedProjects} />
          <SummaryCard label="Primary evidence" value={plan.summary.eligiblePrimaryEvidenceCount} />
          <SummaryCard label="Budget" value={plan.pageBudget.budgetStatus.replace(/_/g, " ")} />
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Plan Metadata</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryCard label="Career profile" value={version.careerProfileVersion.source.filename} />
          <SummaryCard label="Match report" value={version.matchReportRunId} />
          <SummaryCard label="Created" value={new Date(plan.createdAt).toLocaleString()} />
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Target Configuration</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            label="Role family"
            value={plan.targetConfiguration.targetRoleFamily.replace(/_/g, " ")}
          />
          <SummaryCard
            label="Stack family"
            value={plan.targetConfiguration.targetStackFamily.replace(/_/g, " ")}
          />
          <SummaryCard
            label="Page target"
            value={`${plan.targetConfiguration.targetPageCount} / ${plan.targetConfiguration.maximumPageCount}`}
          />
        </div>
        <p className="mt-6 text-sm text-stone-700">
          Section order:{" "}
          {plan.sectionPlans
            .filter((section) => section.enabled)
            .map((section) => section.sectionType)
            .join(" -> ")}
        </p>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Summary Blueprint</h2>
        <div className="mt-6 space-y-3 text-sm text-stone-700">
          <p>Target role label: {plan.summaryBlueprint.targetRoleLabel}</p>
          <p>Sentence budget: {plan.summaryBlueprint.maximumSentenceCount}</p>
          <p>Word budget: {plan.summaryBlueprint.maximumWordCount}</p>
          <p>Themes: {plan.summaryBlueprint.coreEvidenceThemes.join(", ") || "None"}</p>
          <p>
            Priority technologies:{" "}
            {plan.summaryBlueprint.priorityTechnologies.join(", ") || "None"}
          </p>
          <p>Claims prohibited: {plan.summaryBlueprint.claimsProhibited.join(", ") || "None"}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Skills Plan</h2>
        <div className="mt-6 space-y-4">
          {plan.skillPlan.entries.map((entry) => (
            <article
              key={entry.canonicalSkill}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
            >
              <p className="text-base font-semibold text-stone-900">{entry.displayValue}</p>
              <p className="mt-1 text-sm text-stone-600">
                {entry.group} | {entry.decision} | {entry.recency}
              </p>
              <p className="mt-2 text-sm text-stone-700">{entry.decisionReason}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Roles</h2>
        <div className="mt-6 space-y-4">
          {plan.rolePlans.map((role) => (
            <article key={role.roleId} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <p className="text-base font-semibold text-stone-900">
                {role.roleTitle ?? role.roleId} {role.employer ? `at ${role.employer}` : ""}
              </p>
              <p className="mt-1 text-sm text-stone-600">
                {role.selectionStatus.replace(/_/g, " ")} | Bullet budget{" "}
                {role.maximumBulletBudget}
              </p>
              <p className="mt-2 text-sm text-stone-700">{role.selectionReason}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Projects</h2>
        <div className="mt-6 space-y-4">
          {plan.projectPlans.map((project) => (
            <article
              key={project.projectId}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
            >
              <p className="text-base font-semibold text-stone-900">{project.projectName}</p>
              <p className="mt-1 text-sm text-stone-600">
                {project.selectionStatus} | Bullet budget {project.maximumBulletBudget}
              </p>
              <p className="mt-2 text-sm text-stone-700">{project.resumeUseGuidance}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Bullet Evidence</h2>
        <div className="mt-6 space-y-4">
          {plan.bulletEvidenceCandidates.map((item) => (
            <article
              key={item.evidenceId}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
            >
              <p className="text-base font-semibold text-stone-900">{item.evidenceId}</p>
              <p className="mt-1 text-sm text-stone-600">
                {item.includeEligibility.replace(/_/g, " ")} | {item.context}
              </p>
              <p className="mt-2 text-sm text-stone-700">{item.claimText}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Claims to Avoid</h2>
        <div className="mt-6 space-y-4">
          {plan.claimsToAvoid.map((claim) => (
            <article
              key={claim.claimConcept}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-5"
            >
              <p className="text-base font-semibold text-stone-900">{claim.claimConcept}</p>
              <p className="mt-1 text-sm text-stone-600">{claim.handlingCategory}</p>
              <p className="mt-2 text-sm text-stone-700">{claim.reason}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Page Budget</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Estimated pages" value={plan.pageBudget.estimatedPages} />
          <SummaryCard
            label="Budget state"
            value={plan.pageBudget.budgetStatus.replace(/_/g, " ")}
          />
          <SummaryCard label="Target pages" value={plan.pageBudget.targetPages} />
          <SummaryCard label="Maximum pages" value={plan.pageBudget.maximumPages} />
        </div>
      </section>
    </div>
  );
}
