import Link from "next/link";
import { notFound } from "next/navigation";
import { getDefaultWorkspace } from "@/lib/workspace";
import {
  parsedJobDescriptionContractSchema,
  type ExtractedFieldAgreement,
  type ParserDiagnostic
} from "@/lib/job-descriptions/parser-contract";
import { getJobDescriptionAnalysisContext } from "@/lib/job-descriptions/parse-service";
import { getJobRequirementAnalysisContext } from "@/lib/job-descriptions/requirement-analysis-service";

type JobDescriptionAnalysisPageProps = {
  params: Promise<{ jobDescriptionVersionId: string }>;
};

function formatList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "None";
}

function formatAgreement(value: ExtractedFieldAgreement | undefined) {
  return value ? value.replace(/_/g, " ") : "Not compared";
}

function formatApplicability(value: string) {
  return value
    .replace(/_ONLY$/g, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatExperienceRequirement(
  minimumYears: number,
  maximumYears: number | null,
  plusIndicator: boolean,
  associatedSkill: string | null
) {
  const yearsLabel = `${minimumYears}${maximumYears ? `-${maximumYears}` : ""}${plusIndicator ? "+" : ""} years`;

  if (associatedSkill?.toLowerCase() === "software development") {
    return `${yearsLabel} software development experience`;
  }

  return associatedSkill ? `${yearsLabel} with ${associatedSkill}` : yearsLabel;
}

export default async function JobDescriptionAnalysisPage({
  params
}: JobDescriptionAnalysisPageProps) {
  const { jobDescriptionVersionId } = await params;
  const workspace = await getDefaultWorkspace();
  const context = await getJobDescriptionAnalysisContext(workspace.id, jobDescriptionVersionId);
  const requirementContext = await getJobRequirementAnalysisContext(
    workspace.id,
    jobDescriptionVersionId
  );

  if (!context || !context.latestSuccessfulParse?.result) {
    notFound();
  }

  const result = parsedJobDescriptionContractSchema.parse(context.latestSuccessfulParse.result);
  const latestParse = context.latestSuccessfulParse;
  const applicationLinkId =
    context.version.currentForApplications[0]?.id ?? context.version.sourceApplication?.id;

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-stone-500">
              Parsed analysis
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
              {context.version.opportunity.title}
            </h1>
            <p className="mt-3 text-base text-stone-600">
              {context.version.opportunity.company.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={`/job-descriptions/${context.version.id}`}
            >
              Back to Description
            </Link>
            <Link
              className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              href={
                requirementContext?.latestConfirmedAnalysis
                  ? `/job-descriptions/${context.version.id}/requirements?analysisId=${requirementContext.latestConfirmedAnalysis.id}`
                  : `/job-descriptions/${context.version.id}/requirements`
              }
            >
              {requirementContext?.latestConfirmedAnalysis
                ? "View Confirmed Requirements"
                : "Review Requirements"}
            </Link>
            {applicationLinkId ? (
              <Link
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
                href={`/applications/${applicationLinkId}`}
              >
                Open application
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Parse status</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {latestParse.status.replace(/_/g, " ")}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Parser version</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.parserVersion}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Contract version</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.contractVersion}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Diagnostics</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {context.latestParseStatusCounts
                ? `${context.latestParseStatusCounts.errors} errors, ${context.latestParseStatusCounts.warnings} warnings, ${context.latestParseStatusCounts.info} info`
                : "No diagnostics"}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Role metadata</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Parsed company</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.roleMetadata.companyName?.value ?? "Not detected"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {formatAgreement(result.roleMetadata.companyName?.agreementWithOpportunity)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Parsed role</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.roleMetadata.roleTitle?.value ?? "Not detected"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {formatAgreement(result.roleMetadata.roleTitle?.agreementWithOpportunity)}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Work arrangement</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.roleMetadata.workArrangement?.value ?? "Not detected"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Employment type</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.roleMetadata.employmentType?.value ?? "Not detected"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Seniority</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.roleMetadata.seniority?.value ?? "Not detected"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Location</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.roleMetadata.location?.value ?? "Not detected"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Secondary location</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.roleMetadata.secondaryLocation?.value ?? "Not detected"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Department</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.roleMetadata.department?.value ?? "Not detected"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Requisition ID</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.roleMetadata.requisitionId?.value ?? "Not detected"}
            </p>
          </article>
          <article className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Posted</p>
            <p className="mt-2 text-lg font-semibold text-stone-900">
              {result.roleMetadata.postedText?.value ?? "Not detected"}
            </p>
          </article>
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Compensation</h2>
        <p className="mt-4 text-sm text-stone-700">
          {result.compensation.compensationText ?? "No explicit compensation detected."}
        </p>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Detected sections</h2>
        <div className="mt-6 space-y-3">
          {result.sections.map((section) => (
            <article
              key={section.id}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
              <p className="text-sm font-semibold text-stone-900">{section.heading}</p>
              <p className="mt-1 text-sm text-stone-600">
                {section.canonicalHeading} • {section.type.replace(/_/g, " ")}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Depth {section.hierarchyDepth} • Applicability {formatApplicability(section.levelApplicability)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Responsibilities</h2>
        <div className="mt-6 space-y-3">
          {result.responsibilities.length > 0 ? (
            result.responsibilities.map((responsibility) => (
              <article
                key={responsibility.id}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
              >
                <p className="text-sm text-stone-900">{responsibility.text}</p>
                <p className="mt-2 text-xs text-stone-600">
                  Action verbs: {formatList(responsibility.actionVerbs)}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-stone-600">No responsibilities detected.</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Qualifications</h2>
        <div className="mt-6 space-y-3">
          {result.qualifications.length > 0 ? (
            result.qualifications.map((qualification) => (
              <article
                key={qualification.id}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
              >
                <p className="text-sm font-semibold text-stone-900">
                  {qualification.explicitLabel.replace(/_/g, " ")}
                </p>
                <p className="mt-2 text-sm text-stone-700">{qualification.originalText}</p>
                <p className="mt-2 text-xs text-stone-600">
                  Applicability: {formatApplicability(qualification.levelApplicability)}
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-stone-600">No qualifications detected.</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Technologies</h2>
        <div className="mt-6 space-y-3">
          {result.technologies.length > 0 ? (
            result.technologies.map((technology) => (
              <article
                key={technology.id}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
              >
                <p className="text-sm font-semibold text-stone-900">
                  {technology.canonicalName}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {technology.category.replace(/_/g, " ")} • {technology.mentionCount} mentions
                </p>
              </article>
            ))
          ) : (
            <p className="text-sm text-stone-600">No technologies detected.</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Experience, education, and certifications</h2>
        <div className="mt-6 space-y-3">
          {result.experienceRequirements.map((requirement) => (
            <article
              key={requirement.id}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
              <p className="text-sm text-stone-900">
                {formatExperienceRequirement(
                  requirement.minimumYears,
                  requirement.maximumYears,
                  requirement.plusIndicator,
                  requirement.associatedSkill
                )}
              </p>
            </article>
          ))}
          {result.educationRequirements.map((education) => (
            <article
              key={education.id}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
              <p className="text-sm text-stone-900">
                {education.degreeLevel ?? education.equivalentExperience ?? "Education requirement"}
              </p>
            </article>
          ))}
          {result.certificationRequirements.map((certification) => (
            <article
              key={certification.id}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
              <p className="text-sm text-stone-900">
                {certification.name}
                {certification.preferred ? " (preferred)" : ""}
              </p>
            </article>
          ))}
          {result.experienceRequirements.length === 0 &&
          result.educationRequirements.length === 0 &&
          result.certificationRequirements.length === 0 ? (
            <p className="text-sm text-stone-600">
              No explicit years-of-experience, education, or certifications detected.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-stone-300 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-stone-900">Benefits and diagnostics</h2>
        <div className="mt-6 space-y-3">
          {result.benefits.map((benefit) => (
            <article
              key={benefit.id}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
            >
              <p className="text-sm text-stone-900">{benefit.name}</p>
            </article>
          ))}
          {Array.isArray(latestParse.diagnostics)
            ? (latestParse.diagnostics as ParserDiagnostic[]).map((diagnostic) => (
                <article
                  key={`${diagnostic.code}-${diagnostic.message}`}
                  className="rounded-2xl border border-stone-200 bg-stone-50 p-4"
                >
                  <p className="text-sm font-semibold text-stone-900">
                    {diagnostic.severity}
                  </p>
                  <p className="mt-2 text-sm text-stone-700">{diagnostic.message}</p>
                </article>
              ))
            : null}
          {result.benefits.length === 0 && (!Array.isArray(latestParse.diagnostics) || latestParse.diagnostics.length === 0) ? (
            <p className="text-sm text-stone-600">No benefits or diagnostics to show.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
