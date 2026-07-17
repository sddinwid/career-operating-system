import { render, screen } from "@testing-library/react";
import ResumePlanPage from "@/app/job-descriptions/[jobDescriptionVersionId]/resume-plan/page";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/structured-resume/service", () => ({
  getStructuredResumeContext: vi.fn(async () => ({
    reusableMatchReportRun: {
      id: "match-report-1"
    },
    reusableStructuredResumeVersion: {
      id: "structured-resume-1"
    }
  })),
  parseStoredStructuredResumeVersion: vi.fn(async () => ({
    version: {
      id: "structured-resume-1",
      applicationId: "application-1",
      contractVersion: "1.0.0",
      engineVersion: "m5.1.0",
      configurationVersion: "scott-v1",
      careerProfileVersion: {
        source: {
          filename: "career_knowledge_base_fixture_v1.json"
        }
      },
      matchReportRunId: "match-report-1"
    },
    plan: {
      runId: "structured-resume-1",
      workspaceId: "workspace-1",
      careerProfileVersionId: "career-version-1",
      requirementAnalysisId: "analysis-1",
      evidenceRetrievalRunId: "retrieval-1",
      evidenceScoringRunId: "scoring-1",
      matchReportRunId: "match-report-1",
      jobDescriptionVersionId: "job-description-1",
      applicationId: "application-1",
      structuredResumeContractVersion: "1.0.0",
      resumePlanningEngineVersion: "m5.1.0",
      resumePlanningConfigurationVersion: "scott-v1",
      createdAt: "2026-07-17T12:00:00.000Z",
      inputChecksum: "resume-input-checksum",
      status: "READY_WITH_LIMITATIONS",
      diagnostics: [],
      targetConfiguration: {
        targetCompany: "Acme",
        targetRole: "Senior Platform Engineer",
        targetRoleFamily: "NODE_TYPESCRIPT_BACKEND",
        targetSeniority: "SENIOR",
        targetStackFamily: "NODE_TYPESCRIPT_BACKEND",
        workArrangement: "REMOTE",
        location: "Chicago, IL",
        targetPageCount: 2,
        maximumPageCount: 2,
        summaryEnabled: true,
        projectsSectionEnabled: true,
        educationEnabled: true,
        certificationsEnabled: false,
        experienceOrderingMode: "RELEVANCE_THEN_CHRONOLOGY",
        skillGroupOrdering: ["LANGUAGES", "BACKEND", "DATA"],
        roleSelectionLimit: 5,
        projectSelectionLimit: 3,
        bulletBudgetPerRole: 5,
        bulletBudgetPerProject: 4,
        contactInformationPolicy: { includeEmail: true },
        dateFormatPreference: "MMM YYYY",
        locationDisplayPreference: "CITY_REGION",
        roleFamilySelection: {
          selectedFamily: "NODE_TYPESCRIPT_BACKEND",
          selectionRule: "target-role-family.node-typescript.keywords",
          confidence: "HIGH",
          alternativeCandidateFamilies: ["GENERAL_BACKEND"],
          userConfirmationNeeded: false
        },
        stackRule: {
          selectedStackRuleFamily: "NODE_TYPESCRIPT_BACKEND",
          orderedTechnologyGroups: [["Node.js", "TypeScript"]],
          conditionalInclusions: [],
          deferredTechnologies: ["C#"],
          excludedTechnologies: [],
          ruleProvenance: "structured-resume.config.NODE_TYPESCRIPT_BACKEND"
        },
        headerFields: []
      },
      sectionPlans: [
        {
          sectionType: "HEADER",
          enabled: true,
          required: true,
          order: 0,
          maximumItemCount: 6,
          maximumEstimatedLines: 5,
          sourceRules: ["structured-resume.section.header"],
          eligibilityDiagnostics: [],
          locked: true,
          omissionReason: null
        }
      ],
      summaryBlueprint: {
        targetRoleLabel: "Senior Platform Engineer",
        maximumSentenceCount: 4,
        maximumWordCount: 80,
        coreEvidenceThemes: ["Backend API development"],
        priorityTechnologies: ["Node.js", "TypeScript"],
        leadershipEmphasis: false,
        domainEmphasis: false,
        architectureEmphasis: true,
        aiEmphasis: false,
        claimsProhibited: ["Clearance leadership"],
        experienceClaimsPermitted: [],
        toneRules: ["direct"],
        styleRules: ["No em dashes."],
        requiredDifferentiators: ["Platform reliability"],
        sourceEvidenceIds: ["exp_fixture"]
      },
      skillPlan: {
        groupOrder: ["LANGUAGES", "BACKEND", "DATA"],
        entries: [
          {
            canonicalSkill: "TypeScript",
            displayValue: "TypeScript",
            group: "LANGUAGES",
            priority: 1,
            requirementIds: ["req-ts"],
            supportingEvidenceIds: ["exp_fixture"],
            professionalUse: true,
            projectUse: false,
            recency: "CURRENT",
            restrictions: [],
            decision: "INCLUDE",
            decisionReason: "Supported by eligible evidence.",
            stackOrderProvenance: "stack-rule.NODE_TYPESCRIPT_BACKEND"
          }
        ]
      },
      rolePlans: [
        {
          roleId: "exp_fixture",
          employer: "Acme",
          roleTitle: "Senior Engineer",
          dates: { start: "2024-01", end: "2026-05" },
          professionalContext: true,
          targetRequirementCoverage: ["req-ts"],
          strongEvidenceCount: 1,
          goodEvidenceCount: 0,
          limitedEvidenceCount: 0,
          priorityTechnologies: ["TypeScript"],
          relevantAccomplishments: ["Improved latency."],
          relevantResponsibilities: ["Built APIs."],
          relevantMetrics: ["Latency: 37%"],
          recency: "CURRENT",
          selectionStatus: "INCLUDE",
          selectionReason: "Supports prioritized requirements.",
          maximumBulletBudget: 5,
          eligibleEvidenceIds: ["exp_fixture"],
          excludedEvidenceIds: [],
          restrictions: [],
          requiredQualificationNotes: []
        }
      ],
      projectPlans: [
        {
          projectId: "project_fixture",
          projectName: "Fixture Platform",
          context: "PERSONAL",
          requirementCoverage: ["req-ts"],
          strongestEvidence: "LIMITED",
          technologies: ["TypeScript"],
          architecture: [],
          metrics: [],
          recency: "UNKNOWN",
          selectionStatus: "CONSIDER",
          selectionReason: "Adds secondary support.",
          maximumBulletBudget: 2,
          eligibleEvidenceIds: ["project_fixture"],
          restrictions: ["PROJECT_ONLY"],
          projectOnlyWarning: "Project-only evidence should be labeled clearly if used.",
          resumeUseGuidance: "Use only with clear project labeling."
        }
      ],
      bulletEvidenceCandidates: [
        {
          evidenceId: "exp_fixture",
          parentType: "ROLE",
          parentId: "exp_fixture",
          requirementIds: ["req-ts"],
          candidateScore: 90,
          strengthBand: "STRONG",
          evidenceType: "ROLE",
          claimText: "Built APIs.",
          metric: "Latency: 37%",
          metricVerification: "VERIFIED",
          technologies: ["TypeScript"],
          context: "PROFESSIONAL",
          recency: "CURRENT",
          restrictions: [],
          includeEligibility: "PRIMARY",
          wordingConstraints: [],
          duplicationGroupId: "dup:exp_fixture",
          priority: 1,
          sourceProvenance: {
            sourceSection: "employment",
            sourceId: "exp_fixture",
            sourcePath: "employment:exp_fixture"
          }
        }
      ],
      claimsToAvoid: [
        {
          claimConcept: "Clearance leadership",
          requirementIds: ["req-clearance"],
          evidenceIds: ["project_fixture"],
          handlingCategory: "PROJECT_ONLY",
          reason: "Only project-based evidence currently supports this claim.",
          truthfulnessRule: "Do not overclaim project-only evidence.",
          affectedSections: ["PROFESSIONAL_SUMMARY"],
          alternativeSafeTreatment:
            "Keep the claim only in a clearly labeled project context."
        }
      ],
      duplicationGroups: [
        {
          duplicationGroupId: "dup:exp_fixture",
          evidenceIds: ["exp_fixture"],
          preferredPlacement: "PROFESSIONAL_EXPERIENCE",
          maximumAllowedUses: 2,
          reason: "Avoid accidental repetition."
        }
      ],
      pageBudget: {
        targetPages: 2,
        maximumPages: 2,
        estimatedPages: 1.4,
        budgetStatus: "WITHIN_TARGET",
        sectionBudgets: []
      },
      planningConfiguration: {},
      matchReportSummary: {
        matchTier: "GOOD_ALIGNMENT",
        pursuitRecommendation: "APPLY",
        resumeReadinessState: "READY_WITH_LIMITATIONS",
        alignmentIndex: 67,
        requiredRequirementCount: 3,
        preferredRequirementCount: 1,
        responsibilityCount: 1,
        strongRequiredCount: 1,
        goodRequiredCount: 1,
        limitedRequiredCount: 0,
        weakRequiredCount: 0,
        requiredNoEvidenceCount: 1,
        requiredRestrictedOnlyCount: 0,
        criticalRequiredGapCount: 0,
        materialRequiredGapCount: 1,
        professionalCoreSupportCount: 2,
        projectOnlySupportCount: 1,
        staleSupportCount: 0,
        diagnosticErrorCount: 0,
        diagnosticWarningCount: 1,
        diagnosticInfoCount: 1
      },
      summary: {
        targetCompany: "Acme",
        targetRole: "Senior Platform Engineer",
        targetRoleFamily: "NODE_TYPESCRIPT_BACKEND",
        resumeReadiness: "READY_WITH_LIMITATIONS",
        selectedStackRule: "NODE_TYPESCRIPT_BACKEND",
        enabledSections: ["HEADER"],
        selectedRoles: 1,
        selectedProjects: 0,
        eligiblePrimaryEvidenceCount: 1,
        qualifiedOnlyEvidenceCount: 0,
        excludedEvidenceCount: 0,
        priorityTechnologies: ["TypeScript"],
        claimsToAvoidCount: 1,
        estimatedPageCount: 1.4,
        budgetStatus: "WITHIN_TARGET",
        diagnosticErrorCount: 0,
        diagnosticWarningCount: 1,
        diagnosticInfoCount: 0
      }
    }
  })),
  getStructuredResumeVersionById: vi.fn(async () => ({
    id: "structured-resume-1",
    inputChecksum: "structured-input-checksum",
    careerProfileVersionId: "career-version-1",
    status: "READY",
    careerProfileVersion: {
      checksum: "career-source-checksum"
    }
  }))
}));

vi.mock("@/lib/resume-composition/service", () => ({
  getResumeCompositionContext: vi.fn(async () => ({
    compositionReady: true,
    reusableStructuredResumeVersion: {
      id: "structured-resume-1"
    },
    reusableResumeCompositionVersion: {
      id: "resume-composition-1"
    }
  }))
}));

describe("ResumePlanPage", () => {
  it("renders metadata, configuration, planning sections, and page budget without final prose", async () => {
    const page = await ResumePlanPage({
      params: Promise.resolve({ jobDescriptionVersionId: "job-description-1" }),
      searchParams: Promise.resolve({ versionId: "structured-resume-1" })
    });

    render(page);

    expect(screen.getByRole("heading", { name: "Senior Platform Engineer" })).toBeVisible();
    expect(screen.getAllByText("NODE TYPESCRIPT BACKEND").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Summary Blueprint" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Skills Plan" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Roles" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Projects" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Bullet Evidence" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Claims to Avoid" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Page Budget" })).toBeVisible();
    expect(screen.queryByText(/download docx/i)).not.toBeInTheDocument();
  });
});
