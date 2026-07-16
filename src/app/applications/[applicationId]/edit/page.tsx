import { notFound } from "next/navigation";
import { ApplicationForm } from "@/components/applications/application-form";
import { updateApplicationAction } from "@/lib/applications/actions";
import {
  detectManualJobSearchDateOverride,
  formatDateTimeLocalInput
} from "@/lib/applications/timestamps";
import {
  getApplicationDetail,
  listCompanyChoices,
  listOpportunityChoices
} from "@/lib/applications/service";
import { getWorkspaceSettings } from "@/lib/settings";
import { getDefaultWorkspace } from "@/lib/workspace";

type EditApplicationPageProps = {
  params: Promise<{ applicationId: string }>;
};

export default async function EditApplicationPage({
  params
}: EditApplicationPageProps) {
  const { applicationId } = await params;
  const workspace = await getDefaultWorkspace();
  const settings = await getWorkspaceSettings(workspace.id);
  const [application, companies, opportunities] = await Promise.all([
    getApplicationDetail({
      workspaceId: workspace.id,
      applicationId
    }),
    listCompanyChoices(workspace.id),
    listOpportunityChoices(workspace.id)
  ]);

  if (!application) {
    notFound();
  }

  return (
    <ApplicationForm
      action={updateApplicationAction.bind(null, application.id)}
      companies={companies}
      opportunities={opportunities}
      defaultValues={{
        companyName: application.opportunity.company.name,
        role: application.opportunity.title,
        appliedAtLocal: application.appliedAt
          ? formatDateTimeLocalInput(application.appliedAt, settings.defaultTimeZone)
          : "",
        manualJobSearchDate: detectManualJobSearchDateOverride({
          appliedAt: application.appliedAt,
          jobSearchDate: application.jobSearchDate,
          settings
        }),
        jobUrl: application.opportunity.jobUrl,
        source: application.opportunity.source,
        salaryMin: application.opportunity.salaryMin?.toString(),
        salaryMax: application.opportunity.salaryMax?.toString(),
        salaryCurrency: application.opportunity.salaryCurrency,
        location: application.opportunity.location,
        workArrangement: application.opportunity.workArrangement,
        priority: application.priority,
        status: application.status,
        notes: application.notes
      }}
      mode="edit"
    />
  );
}
