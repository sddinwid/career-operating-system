import { render, screen } from "@testing-library/react";
import RequirementReviewPage from "@/app/job-descriptions/[jobDescriptionVersionId]/requirements/page";

const mockEnsureRequirementAnalysisDraft = vi.fn();
const mockGetJobRequirementAnalysisContext = vi.fn();
const mockGetJobRequirementAnalysisById = vi.fn();

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/job-descriptions/requirement-analysis-service", () => ({
  ensureRequirementAnalysisDraft: (...args: unknown[]) =>
    mockEnsureRequirementAnalysisDraft(...args),
  getJobRequirementAnalysisContext: (...args: unknown[]) =>
    mockGetJobRequirementAnalysisContext(...args),
  getJobRequirementAnalysisById: (...args: unknown[]) =>
    mockGetJobRequirementAnalysisById(...args)
}));

vi.mock("@/lib/evidence-retrieval/service", () => ({
  getEvidenceRetrievalContext: vi.fn(async () => ({
    latestCareerProfileVersion: {
      id: "career-version-1"
    },
    latestConfirmedRequirementAnalysis: null,
    reusableRun: null
  }))
}));

vi.mock("@/lib/evidence-scoring/service", () => ({
  getEvidenceScoringContext: vi.fn(async () => ({
    reusableScoringRun: null
  }))
}));

const baseAnalysis = {
  id: "analysis-1",
  workspaceId: "workspace-1",
  jobDescriptionVersionId: "job-description-1",
  parseId: "parse-1",
  contractVersion: "1.0.0",
  classifierVersion: "m3.3.0",
  createdAt: "2026-07-16T12:00:00.000Z",
  reviewStatus: "NEEDS_REVIEW",
  sourceChecksum: "checksum-1",
  parserVersion: "m3.2.0",
  lowConfidenceAcknowledged: false,
  requirements: [
    {
      id: "requirement-required",
      parserStatementId: "statement-1",
      originalText: "5+ years of TypeScript required",
      normalizedText: "5+ years of typescript required",
      correctedDisplayText: null,
      category: "REQUIRED",
      kinds: ["TECHNOLOGY", "EXPERIENCE"],
      explicitSourceLabel: "REQUIRED",
      sourceSectionId: "section-required",
      sourceSectionType: "REQUIRED_QUALIFICATIONS",
      sourceLocation: { startLine: 5, endLine: 5 },
      technologies: ["TypeScript"],
      experienceText: "5+ years of TypeScript",
      degreeRequirement: null,
      certificationRequirement: null,
      domainReferences: [],
      leadershipReferences: [],
      confidence: "HIGH",
      classificationRule: "requirements.classify.explicit.required",
      parserProvenance: {
        parseId: "parse-1",
        parserVersion: "m3.2.0",
        parserStatementId: "statement-1",
        parserResponsibilityId: null,
        sourceSectionId: "section-required"
      },
      userOverrideState: {
        categoryChanged: false,
        kindsChanged: false,
        exclusionChanged: false,
        noteChanged: false,
        displayTextChanged: false,
        confirmationChanged: false
      },
      userAdded: false,
      excluded: false,
      reviewNote: null,
      confirmationState: "UNCONFIRMED"
    },
    {
      id: "requirement-contextual",
      parserStatementId: "statement-2",
      originalText: "PostgreSQL in production systems",
      normalizedText: "postgresql in production systems",
      correctedDisplayText: null,
      category: "CONTEXTUAL",
      kinds: ["TECHNOLOGY", "DATA"],
      explicitSourceLabel: "UNSPECIFIED",
      sourceSectionId: "section-skills",
      sourceSectionType: "SKILLS",
      sourceLocation: { startLine: 9, endLine: 9 },
      technologies: ["PostgreSQL"],
      experienceText: null,
      degreeRequirement: null,
      certificationRequirement: null,
      domainReferences: [],
      leadershipReferences: [],
      confidence: "LOW",
      classificationRule: "requirements.classify.section.skills.contextual",
      parserProvenance: {
        parseId: "parse-1",
        parserVersion: "m3.2.0",
        parserStatementId: "statement-2",
        parserResponsibilityId: null,
        sourceSectionId: "section-skills"
      },
      userOverrideState: {
        categoryChanged: false,
        kindsChanged: false,
        exclusionChanged: false,
        noteChanged: false,
        displayTextChanged: false,
        confirmationChanged: false
      },
      userAdded: false,
      excluded: false,
      reviewNote: null,
      confirmationState: "UNCONFIRMED"
    }
  ],
  responsibilities: [
    {
      id: "responsibility-1",
      parserResponsibilityId: "responsibility-1",
      originalText: "Build resilient APIs",
      normalizedText: "build resilient apis",
      correctedDisplayText: null,
      relevance: "INCLUDED",
      kinds: ["RESPONSIBILITY", "TECHNOLOGY"],
      technologies: ["TypeScript"],
      sourceLocation: { startLine: 2, endLine: 2 },
      confidence: "HIGH",
      classificationRule: "responsibilities.classify.included",
      parserProvenance: {
        parseId: "parse-1",
        parserVersion: "m3.2.0",
        parserStatementId: null,
        parserResponsibilityId: "responsibility-1",
        sourceSectionId: "section-responsibilities"
      },
      userOverrideState: {
        categoryChanged: false,
        kindsChanged: false,
        exclusionChanged: false,
        noteChanged: false,
        displayTextChanged: false,
        confirmationChanged: false
      },
      excluded: false,
      reviewNote: null,
      confirmationState: "UNCONFIRMED"
    }
  ],
  summary: {
    requiredCount: 1,
    preferredCount: 0,
    contextualCount: 1,
    noiseCount: 0,
    includedResponsibilitiesCount: 1,
    excludedResponsibilitiesCount: 0,
    technologiesCount: 2,
    experienceRequirementsCount: 1,
    educationRequirementsCount: 0,
    certificationRequirementsCount: 0,
    leadershipRequirementsCount: 0,
    domainRequirementsCount: 0,
    userOverridesCount: 0,
    userAddedRequirementsCount: 0,
    unresolvedReviewItemsCount: 3,
    lowConfidenceCount: 1,
    excludedRequirementsCount: 0
  },
  diagnostics: [
    {
      code: "LOW_CONFIDENCE_CLASSIFICATION",
      severity: "WARNING",
      message: "Low-confidence requirement classification: PostgreSQL in production systems",
      rule: "requirements.diagnostics.lowConfidence",
      location: { startLine: 9, endLine: 9 },
      relatedItemIds: ["requirement-contextual"]
    }
  ]
} as const;

function buildContext() {
  return {
    version: {
      id: "job-description-1",
      opportunity: {
        title: "Senior Platform Engineer",
        company: {
          name: "Acme"
        }
      },
      currentForApplications: [{ id: "application-1" }],
      sourceApplication: { id: "application-1" }
    },
    latestParse: {
      id: "parse-1"
    },
    latestAnalysis: {
      id: "analysis-1",
      status: "NEEDS_REVIEW"
    },
    latestConfirmedAnalysis: null,
    latestAnalysisContract: baseAnalysis,
    latestConfirmedContract: null
  };
}

describe("RequirementReviewPage", () => {
  beforeEach(() => {
    mockGetJobRequirementAnalysisContext.mockResolvedValue(buildContext());
    mockEnsureRequirementAnalysisDraft.mockResolvedValue({
      analysis: {
        id: "analysis-1",
        classifierVersion: "m3.3.0",
        analysis: baseAnalysis,
        status: "NEEDS_REVIEW",
        jobDescriptionVersion: buildContext().version,
        jobDescriptionParse: {
          id: "parse-1",
          result: {}
        }
      }
    });
    mockGetJobRequirementAnalysisById.mockResolvedValue(null);
  });

  it("renders grouped requirement review content for an editable draft", async () => {
    const page = await RequirementReviewPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({})
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Senior Platform Engineer" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Needs Review" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Required" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Responsibilities" })).toBeVisible();
    expect(screen.getByText("Low-confidence requirement classification: PostgreSQL in production systems")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirm Requirement Analysis" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Add user requirement" })).toBeVisible();
  });

  it("renders a read-only confirmed analysis view", async () => {
    const confirmedAnalysis = {
      ...baseAnalysis,
      reviewStatus: "CONFIRMED",
      lowConfidenceAcknowledged: true
    };
    mockGetJobRequirementAnalysisContext.mockResolvedValue({
      ...buildContext(),
      latestConfirmedAnalysis: { id: "analysis-1" }
    });
    mockGetJobRequirementAnalysisById.mockResolvedValue({
      id: "analysis-1",
      classifierVersion: "m3.3.0",
      analysis: confirmedAnalysis,
      status: "CONFIRMED",
      jobDescriptionVersion: buildContext().version,
      jobDescriptionParse: {
        id: "parse-1",
        result: {}
      }
    });

    const page = await RequirementReviewPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({ analysisId: "analysis-1" })
    });

    render(page);

    expect(screen.getByText("This analysis is read-only. Create a revised analysis to make additional changes while preserving this confirmed version.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create Revised Analysis" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "View Evidence Scores" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save requirement" })).not.toBeInTheDocument();
  });
});
