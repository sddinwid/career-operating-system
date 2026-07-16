import Link from "next/link";
import { Application, Company, JobOpportunity } from "@prisma/client";
import {
  archiveApplicationAction,
  restoreApplicationAction
} from "@/lib/applications/actions";
import { formatApplicationDate } from "@/lib/applications/service";

type ApplicationListItem = Application & {
  opportunity: JobOpportunity & {
    company: Company;
  };
};

type ApplicationListProps = {
  applications: ApplicationListItem[];
  includeArchived: boolean;
  success?: string;
};

function SuccessBanner({ success }: { success?: string }) {
  if (!success) {
    return null;
  }

  const messages: Record<string, string> = {
    archived: "Application archived. Archived records are hidden by default.",
    restored: "Application restored.",
    created: "Application saved.",
    updated: "Application updated."
  };

  const message = messages[success];
  if (!message) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      {message}
    </div>
  );
}

export function ApplicationList({
  applications,
  includeArchived,
  success
}: ApplicationListProps) {
  if (applications.length === 0) {
    return (
      <div className="space-y-6">
        <SuccessBanner success={success} />
        <section className="rounded-3xl border border-dashed border-stone-300 bg-white px-8 py-12 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-stone-900">
            No applications yet
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-stone-600">
            Start with the company, role, and date. You can capture the rest later
            without losing the original application record.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
              href="/applications/new"
            >
              Add application
            </Link>
            {includeArchived ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href="/applications"
              >
                Hide archived
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SuccessBanner success={success} />
      <div className="grid gap-4">
        {applications.map((application) => {
          const isArchived = application.archivedAt !== null;

          return (
            <article
              key={application.id}
              className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-stone-600">
                      {application.status.replace(/_/g, " ")}
                    </span>
                    {isArchived ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                        Archived
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-2xl font-semibold text-stone-900">
                    <Link href={`/applications/${application.id}`}>
                      {application.opportunity.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-stone-600">
                    {application.opportunity.company.name} - Applied{" "}
                    {formatApplicationDate(application.appliedAt)}
                  </p>
                  <p className="text-sm text-stone-500">
                    {application.opportunity.location ?? "Location not set"} -{" "}
                    {application.opportunity.source ?? "Source not set"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    href={`/applications/${application.id}`}
                  >
                    View details
                  </Link>
                  <Link
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                    href={`/applications/${application.id}/edit`}
                  >
                    Edit
                  </Link>
                  {isArchived ? (
                    <form action={restoreApplicationAction.bind(null, application.id)}>
                      <button
                        className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
                        type="submit"
                      >
                        Restore
                      </button>
                    </form>
                  ) : (
                    <form action={archiveApplicationAction.bind(null, application.id)}>
                      <button
                        className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                        type="submit"
                      >
                        Archive
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
