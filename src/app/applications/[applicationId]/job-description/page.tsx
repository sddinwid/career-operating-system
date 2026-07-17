import { JobDescriptionSourceType } from "@prisma/client";
import { notFound } from "next/navigation";
import { JobDescriptionForm } from "@/components/job-descriptions/job-description-form";
import { saveApplicationJobDescriptionAction } from "@/lib/job-descriptions/actions";
import {
  getApplicationJobDescriptionIntakeContext,
  getCareerKnowledgeIndicator
} from "@/lib/job-descriptions/service";
import { formatApplicationDate } from "@/lib/applications/formatters";
import { getDefaultWorkspace } from "@/lib/workspace";

type ApplicationJobDescriptionPageProps = {
  params: Promise<{ applicationId: string }>;
};

export default async function ApplicationJobDescriptionPage({
  params
}: ApplicationJobDescriptionPageProps) {
  const { applicationId } = await params;
  const workspace = await getDefaultWorkspace();
  const [context, indicator] = await Promise.all([
    getApplicationJobDescriptionIntakeContext(workspace.id, applicationId),
    getCareerKnowledgeIndicator(workspace.id)
  ]);

  if (!context) {
    notFound();
  }

  const existingVersion = context.currentJobDescriptionVersion;

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
        action={saveApplicationJobDescriptionAction.bind(null, applicationId)}
        cancelHref={`/applications/${applicationId}`}
        careerKnowledgeLabel={indicator.label}
        defaultValues={{
          companyName: context.opportunity.company.name,
          role: context.opportunity.title,
          descriptionText: existingVersion?.originalText ?? "",
          sourceUrl: existingVersion?.sourceUrl ?? context.opportunity.jobUrl ?? "",
          sourceType: existingVersion?.sourceType ?? JobDescriptionSourceType.MANUAL_PASTE,
          sourceTitle: existingVersion?.sourceTitle ?? "",
          publishedAt: existingVersion?.publishedAt
            ? existingVersion.publishedAt.toISOString().slice(0, 10)
            : ""
        }}
        existingJobUrl={context.opportunity.jobUrl}
        mode="application"
        pageTitle={existingVersion ? "Replace job description" : "Add job description"}
        pageDescription="Save the exact posting text for this application without changing status history, application timestamps, or career-profile versions."
      />
    </div>
  );
}
