import { JobDescriptionSourceType } from "@prisma/client";
import { JobDescriptionForm } from "@/components/job-descriptions/job-description-form";
import { createStandaloneJobDescriptionAction } from "@/lib/job-descriptions/actions";
import { getCareerKnowledgeIndicator } from "@/lib/job-descriptions/service";
import { getDefaultWorkspace } from "@/lib/workspace";

export default async function NewJobDescriptionPage() {
  const workspace = await getDefaultWorkspace();
  const indicator = await getCareerKnowledgeIndicator(workspace.id);

  return (
    <JobDescriptionForm
      action={createStandaloneJobDescriptionAction}
      cancelHref="/applications"
      careerKnowledgeLabel={indicator.label}
      defaultValues={{
        companyName: "",
        role: "",
        jobUrl: "",
        opportunitySource: "",
        descriptionText: "",
        sourceUrl: "",
        sourceType: JobDescriptionSourceType.MANUAL_PASTE,
        sourceTitle: "",
        publishedAt: ""
      }}
      initialSourceMode="paste"
      mode="new-opportunity"
      pageTitle="Capture a new job description"
      pageDescription="Save a pasted posting as a versioned job-description record, with company and role preserved for the linked opportunity."
    />
  );
}
