import Link from "next/link";
import { notFound } from "next/navigation";
import {
  archiveApplicationAction,
  restoreApplicationAction
} from "@/lib/applications/actions";
import {
  formatApplicationDate,
  formatApplicationDateTime,
  formatSalaryRange,
  formatWorkArrangement,
  getApplicationDetail
} from "@/lib/applications/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type ApplicationDetailPageProps = {
  params: Promise<{ applicationId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function SuccessBanner({ success }: { success?: string }) {
  const messages: Record<string, string> = {
    created: "Application created successfully.",
    updated: "Application updated successfully.",
    restored: "Application restored."
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

export default async function ApplicationDetailPage({
  params,
  searchParams
}: ApplicationDetailPageProps) {
  const { applicationId } = await params;
  const query = (await searchParams) ?? {};
  const success = typeof query.success === "string" ? query.success : undefined;
  const workspace = await getDefaultWorkspace();
  const application = await getApplicationDetail({
    workspaceId: workspace.id,
    applicationId
  });

  if (!application) {
    notFound();
  }

  const isArchived = application.archivedAt !== null;

  return (
    <div className="space-y-8">
      <SuccessBanner success={success} />
      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Application overview
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {application.opportunity.title}
            </h1>
            <p className="mt-3 text-base text-stone-600">
              {application.opportunity.company.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/applications/${application.id}/edit`}
            >
              Edit application
            </Link>
            {isArchived ? (
              <form action={restoreApplicationAction.bind(null, application.id)}>
                <button
                  className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
                  type="submit"
                >
                  Restore
                </button>
              </form>
            ) : (
              <form action={archiveApplicationAction.bind(null, application.id)}>
                <button
                  className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  type="submit"
                >
                  Archive
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Status</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {application.status.replace(/_/g, " ")}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Applied</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {formatApplicationDateTime(application.appliedAt)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Job-search date</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {formatApplicationDate(application.jobSearchDate)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Priority</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {application.priority ?? "Not set"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Source</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {application.opportunity.source ?? "Not set"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Location</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {application.opportunity.location ?? "Not set"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Work arrangement</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {formatWorkArrangement(application.opportunity.workArrangement)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Salary</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {formatSalaryRange(
                application.opportunity.salaryMin,
                application.opportunity.salaryMax,
                application.opportunity.salaryCurrency
              )}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4 xl:col-span-2">
            <p className="text-sm font-medium text-stone-500">Notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
              {application.notes ?? "No notes yet."}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Status history</h2>
        <div className="mt-6 space-y-4">
          {application.statusHistoryEntries.length === 0 ? (
            <p className="text-sm text-stone-600">
              No status changes have been recorded yet.
            </p>
          ) : (
            application.statusHistoryEntries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
              >
                <p className="text-sm font-semibold text-stone-900">
                  {entry.fromStatus ? `${entry.fromStatus} -> ` : ""}
                  {entry.toStatus}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  Occurred {formatApplicationDateTime(entry.occurredAt)}
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Recorded {formatApplicationDateTime(entry.recordedAt)}
                </p>
                <p className="mt-2 text-sm text-stone-700">
                  {entry.reason ?? "No reason recorded"}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
