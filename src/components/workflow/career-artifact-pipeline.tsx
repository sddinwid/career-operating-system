import { mutedCardClassName } from "@/lib/ui";
import type { WorkflowReadiness, WorkflowStageStatus } from "@/lib/workflow-readiness/service";
import { WorkflowActionButton } from "@/components/workflow/workflow-action-button";

type CareerArtifactPipelineProps = {
  readiness: WorkflowReadiness;
  title?: string;
  description?: string;
};

function statusClassName(status: WorkflowStageStatus) {
  switch (status) {
    case "READY":
    case "APPROVED":
    case "RENDERED":
      return "status-badge status-badge-success";
    case "FAILED":
    case "REVOKED":
      return "status-badge status-badge-danger";
    case "NEEDS_REVIEW":
    case "BLOCKED":
      return "status-badge status-badge-warning";
    default:
      return "status-badge";
  }
}

export function CareerArtifactPipeline({
  readiness,
  title = "Workflow readiness",
  description = "Follow the current immutable pipeline state without guessing the next valid step."
}: CareerArtifactPipelineProps) {
  return (
    <section className="rounded-3xl border border-stone-300 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {readiness.summaryBadges.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-stone-600"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <WorkflowActionButton action={readiness.primaryAction} emphasis="primary" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {readiness.stages.map((stage) => (
          <article key={stage.key} className={mutedCardClassName}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-stone-900">{stage.name}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{stage.description}</p>
              </div>
              <span className={statusClassName(stage.status)}>{stage.status.replace(/_/g, " ")}</span>
            </div>

            {stage.detail ? (
              <p className="mt-3 text-sm font-medium text-stone-700">{stage.detail}</p>
            ) : null}

            {stage.blockingReason ? (
              <p className="mt-3 text-sm text-amber-800">{stage.blockingReason}</p>
            ) : null}

            {(stage.nextAction || stage.viewAction) ? (
              <div className="mt-4 flex flex-wrap gap-3">
                {stage.nextAction ? (
                  <WorkflowActionButton action={stage.nextAction} emphasis="secondary" />
                ) : null}
                {stage.viewAction ? (
                  <WorkflowActionButton action={stage.viewAction} emphasis="text" />
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
