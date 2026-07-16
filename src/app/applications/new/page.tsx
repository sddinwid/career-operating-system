import { createApplicationAction } from "@/lib/applications/actions";
import {
  listCompanyChoices,
  listOpportunityChoices
} from "@/lib/applications/service";
import { formatDateTimeLocalInput } from "@/lib/applications/timestamps";
import { getWorkspaceSettings } from "@/lib/settings";
import { getDefaultWorkspace } from "@/lib/workspace";
import { ApplicationForm } from "@/components/applications/application-form";

export default async function NewApplicationPage() {
  const workspace = await getDefaultWorkspace();
  const settings = await getWorkspaceSettings(workspace.id);
  const [companies, opportunities] = await Promise.all([
    listCompanyChoices(workspace.id),
    listOpportunityChoices(workspace.id)
  ]);

  return (
    <ApplicationForm
      action={createApplicationAction}
      companies={companies}
      opportunities={opportunities}
      defaultValues={{
        companyName: "",
        role: "",
        appliedAtLocal: formatDateTimeLocalInput(new Date(), settings.defaultTimeZone),
        salaryCurrency: "USD"
      }}
      mode="create"
    />
  );
}
