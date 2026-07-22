import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceRequirementExplorer } from "@/components/evidence/evidence-requirement-explorer";
import type {
  EvidenceRequirementSectionView,
  EvidenceTechnicalDetailsView
} from "@/lib/evidence-retrieval/presentation-types";

function createTechnicalDetails(): EvidenceTechnicalDetailsView {
  return {
    runId: "run-1",
    careerProfileVersionId: "career-version-1",
    requirementAnalysisId: "analysis-1",
    retrievalEngineVersion: "m4.1.0",
    retrievalContractVersion: "1.0.0",
    competencyCatalogVersion: "m8.8.0",
    competencyCatalogChecksum: "catalog-checksum-1",
    competencyMappingEngineVersion: "m8.8.0",
    careerSourceChecksum: "career-checksum-1",
    requirementSourceChecksum: "requirement-checksum-1",
    inputChecksum: "input-checksum-1",
    recencyPolicyLabel: "1/3/5 year bands as of 2026-07-22"
  };
}

function createSections(): EvidenceRequirementSectionView[] {
  return [
    {
      id: "required",
      title: "Required",
      description: "Required requirements.",
      items: [
        {
          requirementId: "requirement-1",
          title: "Production PostgreSQL experience",
          categoryLabel: "Required",
          supportState: "GOOD_SUPPORT",
          supportStateLabel: "Good support",
          supportExplanation: "Relevant professional evidence aligns directly with this requirement.",
          conciseExplanation: "PostgreSQL appears in the strongest evidence for this requirement.",
          kinds: ["Technology", "Experience"],
          technologies: ["PostgreSQL", "AWS"],
          competencyLabels: ["PostgreSQL", "AWS"],
          primaryTechnologies: ["PostgreSQL", "AWS"],
          strongestEvidenceCount: 1,
          restrictedEvidenceCount: 1,
          relatedEvidenceCount: 3,
          topCandidates: [
            {
              clusterId: "cluster-1",
              title: "Senior Platform Engineer",
              summaryLabel: "Acme • Senior Platform Engineer",
              evidenceTypeLabel: "Responsibility",
              contextLabel: "Professional",
              recencyLabel: "Current",
              eligibilityLabel: "Eligible",
              claimText: "Owned PostgreSQL-backed services in AWS.",
              technologies: ["PostgreSQL", "AWS"],
              matchedTechnologies: ["PostgreSQL", "AWS"],
              competencyLabels: ["PostgreSQL", "AWS"],
              whyMatched: ["PostgreSQL and AWS match exactly."],
              restrictionLabels: [],
              restrictionCodes: [],
              provenanceLabel: "employment • employment[0].responsibilities[0]",
              primaryCandidateId: "candidate-1",
              relatedVariantCount: 0,
              score: 101
            }
          ],
          remainingCandidates: [
            {
              clusterId: "cluster-2",
              title: "AI Search Project",
              summaryLabel: "AI Search Project",
              evidenceTypeLabel: "Project",
              contextLabel: "Project",
              recencyLabel: "Unknown",
              eligibilityLabel: "Eligible With Restrictions",
              claimText: "Built project infrastructure in AWS.",
              technologies: ["AWS"],
              matchedTechnologies: ["AWS"],
              competencyLabels: ["AWS"],
              whyMatched: ["AWS overlaps with the requirement."],
              restrictionLabels: ["Project evidence"],
              restrictionCodes: ["PROJECT_ONLY"],
              provenanceLabel: "projects • projects[0]",
              primaryCandidateId: "candidate-2",
              relatedVariantCount: 1,
              score: 60
            }
          ],
          defaultVisibleCount: 1,
          diagnostics: ["A project-only fallback also exists."],
          bundleCoverage: [
            { technology: "PostgreSQL", status: "SUPPORTED" },
            { technology: "AWS", status: "RESTRICTED" }
          ],
          retrievalStatusLabel: "Candidates Found",
          gapExplanation: "Direct qualifying evidence was retrieved."
        }
      ]
    },
    {
      id: "preferred",
      title: "Preferred",
      description: "Preferred requirements.",
      items: []
    }
  ];
}

describe("EvidenceRequirementExplorer", () => {
  it("renders empty sections and handles missing technical details safely", () => {
    render(
      <EvidenceRequirementExplorer
        sections={[
          {
            id: "required",
            title: "Required",
            description: "Required requirements.",
            items: []
          }
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Requirement Coverage" })).toBeVisible();
    expect(screen.getByText("No items in this group.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Show technical details" }));

    expect(screen.getByText("Technical details are not available for this run.")).toBeVisible();
  });

  it("supports expand, collapse, show-all, and technical disclosures", () => {
    render(
      <EvidenceRequirementExplorer
        sections={createSections()}
        technicalDetails={createTechnicalDetails()}
        restrictedEvidenceBreakdown={[
          {
            code: "PROJECT_ONLY",
            label: "Project evidence",
            count: 1,
            affectedRequirementIds: ["requirement-1"],
            affectedCandidateIds: ["candidate-2"]
          }
        ]}
        careerKnowledgeOpportunities={[
          {
            requirementId: "requirement-1",
            requirementTitle: "Production PostgreSQL experience",
            competencyLabel: "AWS",
            currentEvidence: ["AI Search Project"],
            insufficiencyReason: "Only project-context evidence was retrieved.",
            suggestedReviewAction:
              "Review whether a professional production example exists and should be modeled explicitly."
          }
        ]}
      />
    );

    expect(screen.getAllByText("Production PostgreSQL experience").length).toBeGreaterThan(0);
    expect(screen.getByText("PostgreSQL: supported")).toBeVisible();
    expect(screen.getByText("AWS: restricted")).toBeVisible();
    expect(screen.queryByText("Senior Platform Engineer")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));

    expect(screen.getByText("Senior Platform Engineer")).toBeVisible();
    expect(screen.getByText("Why this matched")).toBeVisible();
    expect(screen.getByRole("button", { name: "Show all 2 candidates" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Show all 2 candidates" }));

    expect(screen.getAllByText("AI Search Project").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Project evidence").length).toBeGreaterThan(0);
    expect(screen.getByText("A project-only fallback also exists.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Show technical details" }));

    expect(screen.getByText("career-version-1")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));

    expect(screen.queryByText("Senior Platform Engineer")).not.toBeInTheDocument();
    expect(screen.queryByText("AI Search Project")).not.toBeInTheDocument();
  });
});
