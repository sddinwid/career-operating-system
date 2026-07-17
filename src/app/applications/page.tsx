import Link from "next/link";
import {
  ApplicationsGrid
} from "@/components/applications/applications-grid";
import { buildApplicationGridRow } from "@/lib/applications/grid";
import { getApplicationsGridPreferences } from "@/lib/applications/grid-view-service";
import { listApplications } from "@/lib/applications/service";
import { getWorkspaceSettings } from "@/lib/settings";
import { getDefaultWorkspace } from "@/lib/workspace";

type ApplicationsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplicationsPage({
  searchParams
}: ApplicationsPageProps) {
  const workspace = await getDefaultWorkspace();
  const params = (await searchParams) ?? {};
  const success =
    typeof params.success === "string" ? params.success : undefined;
  const [applications, settings, gridPreferencesResult] = await Promise.all([
    listApplications({
      workspaceId: workspace.id,
      includeArchived: true
    }),
    getWorkspaceSettings(workspace.id),
    getApplicationsGridPreferences(workspace.id)
  ]);
  const rows = applications.map((application) =>
    buildApplicationGridRow(application, settings)
  );

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
            Applications
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
            Track active applications without the spreadsheet overhead
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-stone-600">
            Capture the minimum details fast, then return later to enrich the job,
            salary, source, and status history.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            href="/jobs/new"
          >
            Capture Job Description
          </Link>
          <Link
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
            href="/imports"
          >
            Import Excel
          </Link>
          <Link
            className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            href="/applications/new"
          >
            Add application
          </Link>
        </div>
      </section>

      <ApplicationsGrid
        applications={rows}
        initialPreferences={gridPreferencesResult.preferences}
        initialPreferencesWarning={gridPreferencesResult.warning}
        success={success}
      />
    </div>
  );
}
