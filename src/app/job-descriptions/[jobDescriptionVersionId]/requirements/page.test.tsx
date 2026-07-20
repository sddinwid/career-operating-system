import { render, screen } from "@testing-library/react";
import RequirementReviewPage from "@/app/job-descriptions/[jobDescriptionVersionId]/requirements/page";

const mockEnsureRequirementAnalysisDraft = vi.fn();
const mockGetJobRequirementAnalysisContext = vi.fn();
const mockGetJobRequirementAnalysisById = vi.fn();
const mockParseStoredJobRequirementAnalysis = vi.fn();

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/job-descriptions/requirement-analysis-service", () => ({
  ensureRequirementAnalysisDraft: (...args: unknown[]) =>
    mockEnsureRequirementAnalysisDraft(...args),
  getJobRequirementAnalysisContext: (...args: unknown[]) =>
    mockGetJobRequirementAnalysisContext(...args),
  getJobRequirementAnalysisById: (...args: unknown[]) =>
    mockGetJobRequirementAnalysisById(...args),
  parseStoredJobRequirementAnalysis: (...args: unknown[]) =>
    mockParseStoredJobRequirementAnalysis(...args)
}));

vi.mock("@/lib/evidence-retrieval/service", () => ({
  getEvidenceRetrievalContext: vi.fn(async () => ({
    latestCareerProfileVersion: {
      id: "career-version-1"
    },
    latestConfirmedRequirementAnalysis: null,
    downstreamReadyRequirementAnalysis: null,
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
  classifierVersion: "m3.3.1",
  createdAt: "2026-07-16T12:00:00.000Z",
  reviewStatus: "NEEDS_REVIEW",
  sourceChecksum: "checksum-1",
  parserVersion: "m3.2.1",
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
      levelApplicability: "ALL_LEVELS",
      sourceGroupId: null,
      sourceSectionId: "section-required",
      sourceSectionType: "REQUIRED_QUALIFICATIONS",
      sourceLocation: { startLine: 5, endLine: 5 },
      technologies: ["TypeScript"],
      experienceText: "5+ years of TypeScript",
      degreeRequirement: null,
      certificationRequirement: null,
      equivalencyText: null,
      domainReferences: [],
      leadershipReferences: [],
      confidence: "HIGH",
      classificationRule: "requirements.classify.explicit.required",
      parserProvenance: {
        parseId: "parse-1",
        parserVersion: "m3.2.1",
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
      levelApplicability: "ALL_LEVELS",
      sourceGroupId: null,
      sourceSectionId: "section-skills",
      sourceSectionType: "SKILLS",
      sourceLocation: { startLine: 9, endLine: 9 },
      technologies: ["PostgreSQL"],
      experienceText: null,
      degreeRequirement: null,
      certificationRequirement: null,
      equivalencyText: null,
      domainReferences: [],
      leadershipReferences: [],
      confidence: "LOW",
      classificationRule: "requirements.classify.section.skills.contextual",
      parserProvenance: {
        parseId: "parse-1",
        parserVersion: "m3.2.1",
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
        parserVersion: "m3.2.1",
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
    excludedRequirementsCount: 0,
    qualificationExtractionCount: 2,
    responsibilityExtractionCount: 1,
    downstreamReadiness: "NEEDS_REVIEW"
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

const baseParsedResult = {
  contractVersion: "1.0.0",
  parserVersion: "m3.2.4",
  parsedAt: "2026-07-18T12:00:00.000Z",
  jobDescriptionVersionId: "job-description-1",
  opportunityId: "opportunity-1",
  companyName: "Acme",
  roleTitle: "Senior Platform Engineer",
  sourceUrl: "https://company.example/jobs/1",
  sourceChecksum: "checksum-1",
  sections: [
    {
      id: "section-responsibilities",
      heading: "What You'll Do",
      canonicalHeading: "What You'll Do",
      type: "RESPONSIBILITIES",
      parentSectionId: null,
      hierarchyDepth: 0,
      levelApplicability: "ALL_LEVELS",
      listOrientation: "LIST",
      startLine: 1,
      endLine: 3,
      text: "Build resilient APIs",
      confidence: "HIGH",
      detectionRule: "section.heading.alias"
    },
    {
      id: "section-required",
      heading: "Technical Craft",
      canonicalHeading: "Technical Craft",
      type: "TECHNICAL_CRAFT",
      parentSectionId: "section-core",
      hierarchyDepth: 1,
      levelApplicability: "ALL_LEVELS",
      listOrientation: "LIST",
      startLine: 4,
      endLine: 6,
      text: "5+ years of TypeScript required",
      confidence: "HIGH",
      detectionRule: "section.heading.alias"
    },
    {
      id: "section-skills",
      heading: "Our Values",
      canonicalHeading: "Our Values",
      type: "COMPANY_VALUES",
      parentSectionId: null,
      hierarchyDepth: 0,
      levelApplicability: "ALL_LEVELS",
      listOrientation: "LIST",
      startLine: 7,
      endLine: 9,
      text: "PostgreSQL in production systems",
      confidence: "HIGH",
      detectionRule: "section.heading.alias"
    },
    {
      id: "section-core",
      heading: "Core Competencies (All Levels)",
      canonicalHeading: "Core Competencies",
      type: "CORE_COMPETENCIES",
      parentSectionId: null,
      hierarchyDepth: 0,
      levelApplicability: "ALL_LEVELS",
      listOrientation: "PARAGRAPH",
      startLine: 3,
      endLine: 3,
      text: "",
      confidence: "HIGH",
      detectionRule: "section.heading.alias"
    }
  ],
  roleMetadata: {
    companyName: null,
    roleTitle: null,
    seniority: null,
    employmentType: null,
    requisitionId: null,
    postedText: null,
    workArrangement: null,
    location: null,
    secondaryLocation: null,
    department: null,
    travelRequirement: null,
    clearanceRequirement: null,
    visaWorkAuthorization: null
  },
  compensation: {
    minimumSalary: null,
    maximumSalary: null,
    currency: null,
    payPeriod: null,
    compensationText: null,
    bonus: null,
    equity: null,
    commission: null,
    compensationType: null,
    locationDependentRange: false
  },
  responsibilities: [],
  qualifications: [],
  technologies: [],
  experienceRequirements: [],
  educationRequirements: [],
  certificationRequirements: [],
  benefits: []
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
    mockParseStoredJobRequirementAnalysis.mockImplementation((value: unknown) => value);
    mockEnsureRequirementAnalysisDraft.mockResolvedValue({
      analysis: {
        id: "analysis-1",
        classifierVersion: "m3.3.1",
        analysis: baseAnalysis,
        status: "NEEDS_REVIEW",
        jobDescriptionVersion: buildContext().version,
        jobDescriptionParse: {
          id: "parse-1",
          result: baseParsedResult
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
    expect(screen.getAllByText("Applicability: ALL LEVELS")).toHaveLength(2);
    expect(screen.getByText("Section: Core Competencies > Technical Craft")).toBeVisible();
    expect(screen.getAllByText("5+ years of TypeScript required")).toHaveLength(1);
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
      classifierVersion: "m3.3.1",
      analysis: confirmedAnalysis,
      status: "CONFIRMED",
      jobDescriptionVersion: buildContext().version,
      jobDescriptionParse: {
        id: "parse-1",
        result: baseParsedResult
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

  it("renders education, certification, and equivalency metadata without compensation requirement cards", async () => {
    const analysisWithMetadata = {
      ...baseAnalysis,
      requirements: [
        {
          ...baseAnalysis.requirements[0],
          id: "requirement-education",
          parserStatementId: "statement-education",
          originalText: "Bachelors or Masters Degree in computer science or related field",
          normalizedText: "bachelors or masters degree in computer science or related field",
          correctedDisplayText: "Bachelor's or Master's degree in Computer Science or related field",
          kinds: ["EDUCATION"],
          technologies: [],
          experienceText: null,
          degreeRequirement: "Bachelors or Masters Degree in computer science or related field",
          certificationRequirement: null,
          equivalencyText: "Equivalent education/experience accepted",
          sourceGroupId: "group-education-experience"
        },
        {
          ...baseAnalysis.requirements[1],
          id: "requirement-certification",
          parserStatementId: "statement-certification",
          originalText: "AWS Certified Cloud Practitioner certification or equivalent",
          normalizedText: "aws certified cloud practitioner certification or equivalent",
          correctedDisplayText: "AWS Certified Cloud Practitioner or equivalent",
          category: "PREFERRED",
          kinds: ["TECHNOLOGY", "CERTIFICATION", "CLOUD"],
          explicitSourceLabel: "PREFERRED",
          technologies: ["AWS"],
          certificationRequirement: "AWS Certified Cloud Practitioner certification or equivalent",
          equivalencyText: "Or equivalent accepted",
          sourceGroupId: "group-tooling-certification"
        }
      ],
      summary: {
        ...baseAnalysis.summary,
        requiredCount: 1,
        preferredCount: 1,
        contextualCount: 0,
        qualificationExtractionCount: 2
      },
      diagnostics: []
    };

    mockEnsureRequirementAnalysisDraft.mockResolvedValue({
      analysis: {
        id: "analysis-1",
        classifierVersion: "m3.3.3",
        analysis: analysisWithMetadata,
        status: "NEEDS_REVIEW",
        jobDescriptionVersion: buildContext().version,
        jobDescriptionParse: {
          id: "parse-1",
          result: baseParsedResult
        }
      }
    });

    const page = await RequirementReviewPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({})
    });

    render(page);

    expect(
      screen.getByText("Bachelor's or Master's degree in Computer Science or related field")
    ).toBeVisible();
    expect(
      screen.getByText(
        "Education: Bachelors or Masters Degree in computer science or related field"
      )
    ).toBeVisible();
    expect(
      screen.getByText("Equivalency: Equivalent education/experience accepted")
    ).toBeVisible();
    expect(
      screen.getByText("Certification: AWS Certified Cloud Practitioner certification or equivalent")
    ).toBeVisible();
    expect(screen.getByText("Equivalency: Or equivalent accepted")).toBeVisible();
    expect(screen.queryByText(/Pay Range:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/actual offer may vary/i)).not.toBeInTheDocument();
  });

  it("renders a legacy persisted analysis after compatibility normalization", async () => {
    const legacyAnalysis = {
      ...baseAnalysis,
      requirements: baseAnalysis.requirements.map(({ levelApplicability, ...requirement }) => requirement),
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
      }
    };

    mockGetJobRequirementAnalysisById.mockResolvedValue({
      id: "analysis-legacy",
      classifierVersion: "m3.3.0",
      analysis: legacyAnalysis,
      status: "CONFIRMED",
      jobDescriptionVersion: buildContext().version,
      jobDescriptionParse: {
        id: "parse-1",
        result: baseParsedResult,
        diagnostics: []
      }
    });
    mockParseStoredJobRequirementAnalysis.mockReturnValue({
      ...baseAnalysis,
      reviewStatus: "CONFIRMED"
    });

    const page = await RequirementReviewPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({ analysisId: "analysis-legacy" })
    });

    render(page);

    expect(screen.getByText("Downstream automation is paused")).toBeVisible();
    expect(screen.getByText("NEEDS REVIEW")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create Revised Analysis" })).toBeVisible();
  });
});
