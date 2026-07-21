import { JobDescriptionSourceType } from "@prisma/client";
import { notFound } from "next/navigation";
import { JobDescriptionForm } from "@/components/job-descriptions/job-description-form";
import { saveOpportunityJobDescriptionAction } from "@/lib/job-descriptions/actions";
import {
  getCareerKnowledgeIndicator,
  getJobOpportunityJobDescriptionIntakeContext
} from "@/lib/job-descriptions/service";
import { formatApplicationDate } from "@/lib/applications/formatters";
import { getDefaultWorkspace } from "@/lib/workspace";

type JobOpportunityJobDescriptionPageProps = {
  params: Promise<{ jobOpportunityId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function JobOpportunityJobDescriptionPage({
  params,
  searchParams
}: JobOpportunityJobDescriptionPageProps) {
  const { jobOpportunityId } = await params;
  const query = (await searchParams) ?? {};
  const workspace = await getDefaultWorkspace();
  const [context, indicator] = await Promise.all([
    getJobOpportunityJobDescriptionIntakeContext(workspace.id, jobOpportunityId),
    getCareerKnowledgeIndicator(workspace.id)
  ]);

  if (!context) {
    notFound();
  }

  const existingVersion = context.jobDescriptionVersions[0] ?? null;
  const initialSourceMode = query.sourceMode === "url" ? "url" : "paste";

  return (
    <div className="space-y-8">
      {existingVersion ? (
        <section className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
            Current linked version
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Version</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {existingVersion.versionNumber}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">State</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {existingVersion.active ? "Active" : "Superseded"}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Captured</p>
              <p className="mt-2 text-lg font-semibold text-stone-900">
                {formatApplicationDate(existingVersion.capturedAt)}
              </p>
            </article>
            <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <p className="text-sm font-medium text-stone-500">Source URL</p>
              <p className="mt-2 break-all text-sm text-stone-700">
                {existingVersion.sourceUrl ?? "Not set"}
              </p>
            </article>
          </div>
        </section>
      ) : null}

      <JobDescriptionForm
        action={saveOpportunityJobDescriptionAction.bind(null, jobOpportunityId)}
        cancelHref={`/jobs/${jobOpportunityId}`}
        careerKnowledgeLabel={indicator.label}
        currentNormalizedText={existingVersion?.normalizedText ?? null}
        defaultValues={{
          companyName: context.company.name,
          role: context.title,
          descriptionText: existingVersion?.originalText ?? "",
          sourceUrl: existingVersion?.sourceUrl ?? context.jobUrl ?? "",
          sourceType: existingVersion?.sourceType ?? JobDescriptionSourceType.MANUAL_PASTE,
          sourceTitle: existingVersion?.sourceTitle ?? "",
          publishedAt: existingVersion?.publishedAt
            ? existingVersion.publishedAt.toISOString().slice(0, 10)
            : ""
        }}
        existingJobUrl={context.jobUrl}
        initialSourceMode={initialSourceMode}
        mode="application"
        pageTitle={existingVersion ? "Replace job description" : "Add job description"}
        pageDescription="Save the exact posting text for this opportunity without creating or mutating an application record."
      />
    </div>
  );
}
