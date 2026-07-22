"use client";

import { useState } from "react";
import { buttonSecondaryClassName, cardClassName, cx, mutedCardClassName } from "@/lib/ui";
import type {
  EvidenceRequirementSectionView,
  EvidenceTechnicalDetailsView
} from "@/lib/evidence-retrieval/presentation-types";

type EvidenceRequirementExplorerProps = {
  sections?: EvidenceRequirementSectionView[];
  technicalDetails?: EvidenceTechnicalDetailsView;
};

function StatusBadge({ label, tone }: { label: string; tone: "good" | "warn" | "muted" }) {
  const className =
    tone === "good"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-stone-300 bg-stone-50 text-stone-700";

  return (
    <span className={cx("rounded-full border px-3 py-1 text-xs font-semibold", className)}>
      {label}
    </span>
  );
}

function toneForSupportState(label: string) {
  if (/strong|good/i.test(label)) {
    return "good" as const;
  }
  if (/limited|restricted|related|no qualifying/i.test(label)) {
    return "warn" as const;
  }
  return "muted" as const;
}

export function EvidenceRequirementExplorer({
  sections = [],
  technicalDetails
}: EvidenceRequirementExplorerProps) {
  const allRequirementIds = sections.flatMap((section) => section.items.map((item) => item.requirementId));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAllIds, setShowAllIds] = useState<Set<string>>(new Set());
  const [technicalExpanded, setTechnicalExpanded] = useState(false);

  const expandAll = () => setExpandedIds(new Set(allRequirementIds));
  const collapseAll = () => {
    setExpandedIds(new Set());
    setShowAllIds(new Set());
  };

  return (
    <div className="space-y-8">
      <section className={cardClassName}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-stone-900">Requirement Coverage</h2>
            <p className="mt-2 text-sm text-stone-600">
              The page defaults to compact retrieval-level support summaries. Expand a requirement
              to inspect why the strongest evidence was retrieved and where restrictions remain.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className={buttonSecondaryClassName} onClick={expandAll} type="button">
              Expand all
            </button>
            <button className={buttonSecondaryClassName} onClick={collapseAll} type="button">
              Collapse all
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={`${section.id}-heading`} className="space-y-4">
              <div>
                <h3 id={`${section.id}-heading`} className="text-xl font-semibold text-stone-900">
                  {section.title}
                </h3>
                <p className="mt-1 text-sm text-stone-600">{section.description}</p>
              </div>
              {section.items.length === 0 ? (
                <div className={mutedCardClassName}>
                  <p className="text-sm text-stone-600">No items in this group.</p>
                </div>
              ) : (
                section.items.map((item) => {
                  const expanded = expandedIds.has(item.requirementId);
                  const detailsId = `${item.requirementId}-details`;
                  const showAll = showAllIds.has(item.requirementId);
                  const visibleCandidates = showAll
                    ? [...item.topCandidates, ...item.remainingCandidates]
                    : item.topCandidates;

                  return (
                    <article key={item.requirementId} className={mutedCardClassName}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge label={item.categoryLabel} tone="muted" />
                            <StatusBadge
                              label={item.supportStateLabel}
                              tone={toneForSupportState(item.supportStateLabel)}
                            />
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-stone-900">{item.title}</h4>
                            <p className="mt-1 text-sm text-stone-600">{item.conciseExplanation}</p>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-stone-600">
                            <span>Strongest evidence: {item.strongestEvidenceCount}</span>
                            <span>Restricted evidence: {item.restrictedEvidenceCount}</span>
                            <span>Retrieval state: {item.retrievalStatusLabel}</span>
                            <span>Kinds: {item.kinds.join(", ")}</span>
                          </div>
                          {item.primaryTechnologies.length > 0 ? (
                            <p className="text-xs text-stone-600">
                              Primary technologies: {item.primaryTechnologies.join(", ")}
                            </p>
                          ) : null}
                          {item.bundleCoverage.length > 0 ? (
                            <div className="flex flex-wrap gap-2 text-xs">
                              {item.bundleCoverage.map((technology) => (
                                <StatusBadge
                                  key={`${item.requirementId}-${technology.technology}`}
                                  label={`${technology.technology}: ${technology.status.toLowerCase()}`}
                                  tone={technology.status === "SUPPORTED" ? "good" : "warn"}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <button
                          aria-controls={detailsId}
                          aria-expanded={expanded}
                          className={buttonSecondaryClassName}
                          onClick={() =>
                            setExpandedIds((current) => {
                              const next = new Set(current);
                              if (next.has(item.requirementId)) {
                                next.delete(item.requirementId);
                              } else {
                                next.add(item.requirementId);
                              }
                              return next;
                            })
                          }
                          type="button"
                        >
                          {expanded ? "Collapse details" : "Expand details"}
                        </button>
                      </div>

                      {expanded ? (
                        <div id={detailsId} className="mt-5 space-y-4">
                          <p className="text-sm text-stone-700">{item.supportExplanation}</p>

                          {visibleCandidates.length > 0 ? (
                            <div className="space-y-3">
                              {visibleCandidates.map((candidate) => (
                                <article
                                  key={candidate.clusterId}
                                  className="rounded-2xl border border-stone-200 bg-white p-4"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-stone-900">
                                        {candidate.title}
                                      </p>
                                      <p className="mt-1 text-xs text-stone-600">
                                        {candidate.summaryLabel}
                                      </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <StatusBadge label={candidate.evidenceTypeLabel} tone="muted" />
                                      <StatusBadge label={candidate.contextLabel} tone="muted" />
                                      <StatusBadge label={candidate.recencyLabel} tone="muted" />
                                      <StatusBadge
                                        label={candidate.eligibilityLabel}
                                        tone={candidate.restrictionCodes.length > 0 ? "warn" : "good"}
                                      />
                                    </div>
                                  </div>
                                  <p className="mt-3 text-sm text-stone-700">{candidate.claimText}</p>
                                  {candidate.matchedTechnologies.length > 0 ? (
                                    <p className="mt-2 text-xs text-stone-600">
                                      Matched technologies: {candidate.matchedTechnologies.join(", ")}
                                    </p>
                                  ) : null}
                                  {candidate.technologies.length > 0 ? (
                                    <p className="mt-2 text-xs text-stone-600">
                                      Technologies: {candidate.technologies.join(", ")}
                                    </p>
                                  ) : null}
                                  <div className="mt-3 space-y-1 text-xs text-stone-600">
                                    <p className="font-semibold text-stone-700">Why this matched</p>
                                    {candidate.whyMatched.map((reason, index) => (
                                      <p key={`${candidate.clusterId}-reason-${index}`}>{reason}</p>
                                    ))}
                                  </div>
                                  {candidate.restrictionLabels.length > 0 ? (
                                    <div className="mt-3 space-y-1 text-xs text-amber-800">
                                      <p className="font-semibold">Restrictions</p>
                                      {candidate.restrictionLabels.map((restriction, index) => (
                                        <p key={`${candidate.clusterId}-restriction-${index}`}>
                                          {restriction}
                                        </p>
                                      ))}
                                    </div>
                                  ) : null}
                                  <p className="mt-3 text-xs text-stone-600">
                                    Provenance: {candidate.provenanceLabel}
                                  </p>
                                  {candidate.relatedVariantCount > 0 ? (
                                    <p className="mt-2 text-xs text-stone-600">
                                      Related representations hidden: {candidate.relatedVariantCount}
                                    </p>
                                  ) : null}
                                </article>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-stone-200 bg-white p-4">
                              <p className="text-sm text-stone-600">
                                No evidence cards are available for this requirement.
                              </p>
                            </div>
                          )}

                          {item.remainingCandidates.length > 0 ? (
                            <button
                              className={buttonSecondaryClassName}
                              onClick={() =>
                                setShowAllIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(item.requirementId)) {
                                    next.delete(item.requirementId);
                                  } else {
                                    next.add(item.requirementId);
                                  }
                                  return next;
                                })
                              }
                              type="button"
                            >
                              {showAll
                                ? "Show fewer candidates"
                                : `Show all ${item.topCandidates.length + item.remainingCandidates.length} candidates`}
                            </button>
                          ) : null}

                          {item.diagnostics.length > 0 ? (
                            <div className="rounded-2xl border border-stone-200 bg-white p-4">
                              <p className="text-sm font-semibold text-stone-900">Diagnostics</p>
                              <div className="mt-2 space-y-1 text-xs text-stone-600">
                                {item.diagnostics.map((diagnostic, index) => (
                                  <p key={`${item.requirementId}-diagnostic-${index}`}>{diagnostic}</p>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
            </section>
          ))}
        </div>
      </section>

      <section className={cardClassName}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-stone-900">Technical Details</h2>
            <p className="mt-2 text-sm text-stone-600">
              Immutable identifiers and engine metadata remain available here without dominating the
              default page view.
            </p>
          </div>
          <button
            aria-controls="technical-details-panel"
            aria-expanded={technicalExpanded}
            className={buttonSecondaryClassName}
            onClick={() => setTechnicalExpanded((current) => !current)}
            type="button"
          >
            {technicalExpanded ? "Hide technical details" : "Show technical details"}
          </button>
        </div>

        {technicalExpanded && technicalDetails ? (
          <div id="technical-details-panel" className="mt-6 grid gap-3 md:grid-cols-2">
            <div className={mutedCardClassName}>
              <p className="text-sm font-medium text-stone-500">Run ID</p>
              <p className="mt-2 break-all text-sm text-stone-900">{technicalDetails.runId}</p>
            </div>
            <div className={mutedCardClassName}>
              <p className="text-sm font-medium text-stone-500">Career Profile Version ID</p>
              <p className="mt-2 break-all text-sm text-stone-900">
                {technicalDetails.careerProfileVersionId}
              </p>
            </div>
            <div className={mutedCardClassName}>
              <p className="text-sm font-medium text-stone-500">Requirement Analysis ID</p>
              <p className="mt-2 break-all text-sm text-stone-900">
                {technicalDetails.requirementAnalysisId}
              </p>
            </div>
            <div className={mutedCardClassName}>
              <p className="text-sm font-medium text-stone-500">Retrieval Versions</p>
              <p className="mt-2 text-sm text-stone-900">
                {technicalDetails.retrievalEngineVersion} • Contract{" "}
                {technicalDetails.retrievalContractVersion}
              </p>
            </div>
            <div className={mutedCardClassName}>
              <p className="text-sm font-medium text-stone-500">Career Source Checksum</p>
              <p className="mt-2 break-all text-sm text-stone-900">
                {technicalDetails.careerSourceChecksum}
              </p>
            </div>
            <div className={mutedCardClassName}>
              <p className="text-sm font-medium text-stone-500">Requirement Source Checksum</p>
              <p className="mt-2 break-all text-sm text-stone-900">
                {technicalDetails.requirementSourceChecksum}
              </p>
            </div>
            <div className={mutedCardClassName}>
              <p className="text-sm font-medium text-stone-500">Input Checksum</p>
              <p className="mt-2 break-all text-sm text-stone-900">
                {technicalDetails.inputChecksum}
              </p>
            </div>
            <div className={mutedCardClassName}>
              <p className="text-sm font-medium text-stone-500">Recency Policy</p>
              <p className="mt-2 text-sm text-stone-900">{technicalDetails.recencyPolicyLabel}</p>
            </div>
          </div>
        ) : technicalExpanded ? (
          <div id="technical-details-panel" className={mutedCardClassName}>
            <p className="text-sm text-stone-600">Technical details are not available for this run.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
