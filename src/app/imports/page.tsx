import { ImportWizard } from "@/components/imports/import-wizard";
import {
  getFixtureImportTemplate,
  getImportJobDetail
} from "@/lib/imports/service";
import { getDefaultWorkspace } from "@/lib/workspace";

type ImportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ImportsPage({ searchParams }: ImportsPageProps) {
  const workspace = await getDefaultWorkspace();
  const params = (await searchParams) ?? {};
  const jobId = typeof params.jobId === "string" ? params.jobId : undefined;
  const rowFilter = typeof params.filter === "string" ? params.filter : "all";
  const success = typeof params.success === "string" ? params.success : undefined;

  const inspection = getFixtureImportTemplate();
  const job = jobId ? await getImportJobDetail(workspace.id, jobId) : null;
  const selectedMapping =
    (job?.mapping as Record<string, string> | null | undefined) ??
    inspection.inferredMapping;

  return (
    <ImportWizard
      inspection={inspection}
      job={job}
      rowFilter={rowFilter}
      selectedMapping={selectedMapping}
      success={success}
    />
  );
}
