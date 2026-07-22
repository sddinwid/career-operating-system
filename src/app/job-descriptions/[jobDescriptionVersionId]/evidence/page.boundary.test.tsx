import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EvidenceRequirementSectionView,
  EvidenceTechnicalDetailsView
} from "@/lib/evidence-retrieval/presentation-types";

const explorerSpy = vi.fn<
  (props: {
    sections?: EvidenceRequirementSectionView[];
    technicalDetails?: EvidenceTechnicalDetailsView;
  }) => ReactNode
>();

vi.mock("@/components/evidence/evidence-requirement-explorer", () => ({
  EvidenceRequirementExplorer: (props: {
    sections?: EvidenceRequirementSectionView[];
    technicalDetails?: EvidenceTechnicalDetailsView;
  }) => {
    explorerSpy(props);
    return <div data-testid="evidence-explorer-boundary" />;
  }
}));

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/evidence-retrieval/service", () => ({
  getEvidenceRetrievalContext: vi.fn(async () => ({
    jobDescriptionVersion: {
      opportunity: {
        title: "Senior Platform Engineer",
        company: {
          name: "Acme"
        }
      }
    },
    latestCareerProfileVersion: {
      id: "career-version-1"
    },
    careerProfileSelectionIssue: null,
    latestConfirmedRequirementAnalysis: {
      id: "analysis-1"
    },
    reusableRun: {
      id: "run-1"
    }
  })),
  parseStoredEvidenceRetrievalRun: vi.fn(async () => ({
    run: {
      id: "run-1",
      applicationId: "application-1",
      careerProfileVersionId: "career-version-1",
      careerProfileVersion: {
        importedAt: new Date("2026-07-17T12:00:00.000Z"),
        source: {
          filename: "career_knowledge_base_fixture_v1.json",
          sourceVersion: "3.0.0",
          purpose: "FIXTURE"
        }
      }
    },
    result: {
      runId: "run-1",
      workspaceId: "workspace-1",
      careerProfileVersionId: "career-version-1",
      requirementAnalysisId: "analysis-1",
      jobDescriptionVersionId: "job-description-1",
      applicationId: "application-1",
      retrievalContractVersion: "1.0.0",
      retrievalEngineVersion: "m4.1.0",
      careerSourceChecksum: "career-checksum-1",
      requirementSourceChecksum: "requirement-checksum-1",
      inputChecksum: "input-checksum-1",
      createdAt: "2026-07-17T12:00:00.000Z",
      status: "SUCCESS",
      diagnostics: [],
      summary: {
        totalRequirements: 1,
        includedRequirements: 1,
        excludedRequirements: 0,
        requiredWithCandidates: 1,
        preferredWithCandidates: 0,
        contextualWithCandidates: 0,
        responsibilitiesWithCandidates: 0,
        noCandidateCount: 0,
        limitedCandidateCount: 0,
        restrictedCandidateCount: 0,
        professionalCandidateCount: 1,
        projectCandidateCount: 0,
        educationCandidateCount: 0,
        certificationCandidateCount: 0,
        diagnosticErrorCount: 0,
        diagnosticWarningCount: 0,
        diagnosticInfoCount: 0
      },
      requirementResults: [
        {
          requirementId: "requirement-1",
          itemType: "REQUIREMENT",
          category: "REQUIRED",
          reviewStatus: "CONFIRMED",
          kinds: ["TECHNOLOGY"],
          originalText: "PostgreSQL experience",
          correctedDisplayText: null,
          technologies: ["PostgreSQL"],
          experienceText: null,
          sourceProvenance: {
            sourceSectionId: "section-1",
            parserStatementId: "statement-1",
            parserResponsibilityId: null
          },
          retrievalStatus: "ELIGIBLE",
          candidateEvidence: [],
          excludedEvidence: [],
          diagnostics: [],
          coverageState: "NO_CANDIDATES"
        }
      ],
      recencyPolicy: {
        currentYears: 1,
        recentYears: 3,
        olderYears: 5,
        evaluatedAt: "2026-07-17"
      }
    }
  }))
}));

vi.mock("@/lib/evidence-scoring/service", () => ({
  getEvidenceScoringContext: vi.fn(async () => ({
    reusableScoringRun: null
  }))
}));

describe("EvidenceRetrievalPage boundary", () => {
  beforeEach(() => {
    explorerSpy.mockClear();
  });

  it("passes serializable sections and technical details to the client explorer", async () => {
    const pageModule = await import("@/app/job-descriptions/[jobDescriptionVersionId]/evidence/page");
    const page = await pageModule.default({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({ runId: "run-1" })
    });

    render(page);

    expect(screen.getByTestId("evidence-explorer-boundary")).toBeVisible();
    expect(explorerSpy).toHaveBeenCalledTimes(1);

    const props = explorerSpy.mock.calls[0]?.[0];
    const serialized = JSON.parse(JSON.stringify(props));

    expect(serialized).toEqual(props);
    expect(serialized.sections).toEqual([
      {
        id: "required",
        title: "Required",
        description:
          "Highest-priority required requirements, ranked with the strongest evidence first.",
        items: serialized.sections[0].items
      },
      {
        id: "preferred",
        title: "Preferred",
        description:
          "Preferred requirements with direct, related, or restricted support called out explicitly.",
        items: []
      },
      {
        id: "contextual",
        title: "Contextual",
        description: "Contextual expectations and guidance from the reviewed requirement set.",
        items: []
      },
      {
        id: "responsibilities",
        title: "Responsibilities",
        description: "Responsibility statements and the strongest retrieved evidence for each one.",
        items: []
      },
      {
        id: "excluded",
        title: "Excluded",
        description: "Traceability for items intentionally kept out of downstream retrieval.",
        items: []
      }
    ]);
    expect(serialized.technicalDetails.runId).toBe("run-1");
  });
});
