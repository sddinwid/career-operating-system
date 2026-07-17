import { describe, expect, it } from "vitest";
import { buildStructuredResumePlan } from "@/lib/structured-resume/engine";
import type { StructuredResumePlanningInput } from "@/lib/structured-resume/contract";

function buildInput(
  overrides: Partial<StructuredResumePlanningInput> = {}
): StructuredResumePlanningInput {
  return {
    runId: "resume-plan-1",
    workspaceId: "workspace-1",
    matchReportRunId: "match-report-1",
    careerProfileVersionId: "career-version-1",
    careerProfileSourceChecksum: "career-source-checksum-1",
    targetCompany: "Acme",
    targetRole: "Senior Backend Engineer",
    workArrangement: "REMOTE",
    location: "Chicago, IL",
    createdAt: "2026-07-17T12:00:00.000Z",
    inputChecksum: "resume-plan-input-checksum-1",
    careerProfileContent: {
      schemaVersion: "1.0.0",
      sourceSchemaVersion: "3.0.0",
      candidate: {
        id: "candidate_fixture",
        displayName: "Fixture Candidate",
        contacts: {
          email: "fixture@example.com",
          phone: "555-0100",
          linkedinUrl: "linkedin.com/in/fixture-candidate",
          githubUrl: "github.com/fixture-candidate"
        },
        location: "Chicago, IL",
        targetRoles: ["Backend Engineer"],
        targetRolePositioning: { default: "Senior Backend Engineer" },
        careerThemes: ["backend systems", "platform engineering"],
        workPreferences: null,
        writingPreferences: null,
        knownUnknowns: [],
        recordKind: "SOURCE_FACT",
        confirmationState: "SOURCE_PROVIDED",
        provenance: {
          sourceSection: "candidateProfile",
          sourceId: "candidate_fixture",
          sourcePath: "candidateProfile"
        }
      },
      generationRules: {
        globalRules: [],
        stackOrderingRules: [],
        experienceClaimRules: {
          maxYearsPerSkill: 8,
          maxYearsBeyondJobRequirement: 5,
          disallowContinuousClaimsForIntermittentUse: true,
          preferProfessionalEvidenceWhenEqual: true,
          preferRecentEvidence: true,
          preferVerifiedMetrics: true,
          disallowKeywordStuffing: true,
          requireQualificationForStaleSkills: true,
          disallowEmDashInGeneratedWriting: true
        },
        coverLetterRules: null,
        recruiterOptimizationRules: null,
        jobDescriptionParsingRules: null,
        jobMatchingRules: null,
        outputGenerationWorkflow: null
      },
      employment: [
        {
          id: "exp_fixture",
          employer: "Fixture Corp",
          roleTitle: "Software Engineer",
          startDate: { raw: "2022-01", normalized: "2022-01", precision: "MONTH" },
          endDate: { raw: "2024-06", normalized: "2024-06", precision: "MONTH" },
          employmentType: null,
          location: null,
          workArrangement: null,
          domainTags: ["internal platforms"],
          themes: ["backend", "apis"],
          responsibilities: ["Built backend services."],
          accomplishments: ["Improved throughput by 20 percent."],
          technologies: ["Python", "PostgreSQL"],
          metrics: [
            {
              description: "Improved throughput",
              value: "20%",
              verificationState: "VERIFIED"
            }
          ],
          facts: ["Built backend services for internal tools."],
          leadershipScope: null,
          recordKind: "SOURCE_FACT",
          confirmationState: "SOURCE_PROVIDED",
          provenance: {
            sourceSection: "professionalExperience",
            sourceId: "exp_fixture",
            sourcePath: "professionalExperience[0]"
          }
        }
      ],
      projects: [
        {
          id: "project_fixture",
          name: "Fixture Platform",
          purpose: null,
          status: null,
          role: null,
          context: "PERSONAL",
          dates: { startDate: null, endDate: null },
          architecture: ["Provider abstraction"],
          technologies: ["Python", "Docker"],
          responsibilities: ["Automated platform workflows."],
          accomplishments: ["Built internal tooling."],
          metrics: [],
          tradeoffs: [],
          links: [],
          domainTags: ["platform"],
          preferredFor: ["Backend Engineer"],
          recordKind: "SOURCE_FACT",
          confirmationState: "PROJECT_VERIFIED",
          provenance: {
            sourceSection: "projects",
            sourceId: "project_fixture",
            sourcePath: "projects[0]"
          }
        }
      ],
      skills: [
        {
          id: "skill_python",
          name: "Python",
          category: "language",
          professionalUse: true,
          projectUse: true,
          firstUse: null,
          lastUse: null,
          recency: "CURRENT",
          confidence: "HIGH",
          evidenceReferences: ["exp_fixture", "project_fixture"],
          notes: null,
          recordKind: "SOURCE_FACT",
          confirmationState: "SOURCE_PROVIDED",
          provenance: {
            sourceSection: "skills",
            sourceId: "skill_python",
            sourcePath: "skills[0]"
          }
        },
        {
          id: "skill_postgresql",
          name: "PostgreSQL",
          category: "database",
          professionalUse: true,
          projectUse: false,
          firstUse: null,
          lastUse: null,
          recency: "CURRENT",
          confidence: "HIGH",
          evidenceReferences: ["exp_fixture"],
          notes: null,
          recordKind: "SOURCE_FACT",
          confirmationState: "SOURCE_PROVIDED",
          provenance: {
            sourceSection: "skills",
            sourceId: "skill_postgresql",
            sourcePath: "skills[1]"
          }
        }
      ],
      education: [],
      certifications: [],
      evidence: [],
      interviewStories: []
    },
    matchReportResult: {
      runId: "match-report-1",
      workspaceId: "workspace-1",
      evidenceScoringRunId: "score-1",
      evidenceRetrievalRunId: "retrieval-1",
      scoringInputChecksum: "score-checksum",
      careerProfileVersionId: "career-version-1",
      requirementAnalysisId: "analysis-1",
      jobDescriptionVersionId: "job-1",
      applicationId: "application-1",
      matchReportContractVersion: "1.0.0",
      matchReportEngineVersion: "m4.3.0",
      matchReportConfigurationVersion: "scott-v1",
      scoringContractVersion: "1.0.0",
      scoringEngineVersion: "m4.2.0",
      inputChecksum: "report-input-checksum",
      createdAt: "2026-07-17T11:00:00.000Z",
      status: "SUCCESS_WITH_WARNINGS",
      scoringStatus: "SUCCESS_WITH_WARNINGS",
      diagnostics: [],
      summary: {
        matchTier: "GOOD_ALIGNMENT",
        pursuitRecommendation: "APPLY",
        resumeReadinessState: "READY_WITH_LIMITATIONS",
        alignmentIndex: 71,
        requiredRequirementCount: 2,
        preferredRequirementCount: 1,
        responsibilityCount: 0,
        strongRequiredCount: 1,
        goodRequiredCount: 1,
        limitedRequiredCount: 0,
        weakRequiredCount: 0,
        requiredNoEvidenceCount: 0,
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
      reportConfiguration: {},
      requirementConclusions: [
        {
          requirementId: "req-python",
          requirementText: "5+ years of Python",
          category: "REQUIRED",
          kinds: ["TECHNOLOGY", "EXPERIENCE"],
          evidenceStrengthState: "STRONG_EVIDENCE",
          highestCandidateScore: 95,
          highestCandidateStrengthBand: "STRONG",
          topCandidateIds: ["exp_fixture"],
          professionalEvidenceCount: 1,
          projectEvidenceCount: 0,
          restrictedEvidenceCount: 0,
          gapTypes: ["NONE"],
          criticality: "NONE",
          conclusionCode: "CORE_STRENGTH",
          explanation: "Strong evidence supports this requirement.",
          resumeUseGuidance: "Safe to prioritize this in targeted resume composition.",
          provenance: {
            scoringRequirementId: "req-python",
            evidenceScoringRunId: "score-1"
          }
        }
      ],
      strengths: [
        {
          strengthId: "strength:req-python:python",
          requirementIds: ["req-python"],
          strengthCategory: "Python",
          explanation: "Strong evidence supports this requirement.",
          supportingEvidenceIds: ["exp_fixture"],
          evidenceContext: "PROFESSIONAL",
          technologies: ["Python", "PostgreSQL"],
          confidence: "HIGH",
          resumeRelevance: "PRIMARY"
        }
      ],
      risksAndGaps: [],
      resumeGuidance: {
        priorityEvidenceThemes: [
          {
            themeId: "theme:python",
            label: "Backend API development",
            supportingRequirementIds: ["req-python"],
            supportingEvidenceIds: ["exp_fixture"],
            strength: "STRONG",
            professionalSupportCount: 1,
            projectSupportCount: 0
          }
        ],
        priorityTechnologies: [
          {
            technology: "Python",
            requirementImportance: 1,
            evidenceStrengthState: "STRONG_EVIDENCE",
            professionalEvidenceCount: 1,
            recency: "CURRENT",
            guidance: "INCLUDE"
          },
          {
            technology: "PostgreSQL",
            requirementImportance: 1,
            evidenceStrengthState: "GOOD_EVIDENCE",
            professionalEvidenceCount: 1,
            recency: "CURRENT",
            guidance: "INCLUDE"
          }
        ],
        rolesToEmphasize: [
          {
            roleId: "exp_fixture",
            employer: "Fixture Corp",
            roleTitle: "Software Engineer",
            supportedRequirementIds: ["req-python"],
            strongEvidenceCount: 1,
            relevantTechnologies: ["Python", "PostgreSQL"],
            relevantAccomplishments: ["Improved throughput by 20 percent."],
            emphasisReason:
              "Professional evidence supports the prioritized backend requirements."
          }
        ],
        projectsToConsider: [
          {
            projectId: "project_fixture",
            supportedRequirementIds: ["req-python"],
            strongestRelevance: "LIMITED",
            technologies: ["Python", "Docker"],
            projectOnlyWarning:
              "Project-only evidence should be labeled clearly if used."
          }
        ],
        claimsToAvoid: [
          {
            concept: "Docker leadership",
            reason: "Only project-based evidence currently supports this requirement.",
            missingOrRestrictedEvidenceIds: ["project_fixture"],
            truthfulnessRule:
              "Do not overclaim project-only evidence as current professional support.",
            handling: "PROJECT_ONLY"
          }
        ]
      }
    },
    ...overrides
  };
}

describe("structured resume engine", () => {
  it("builds a deterministic structured plan without final prose", () => {
    const result = buildStructuredResumePlan(buildInput());

    expect(result.targetConfiguration.targetRoleFamily).toBe("PYTHON_BACKEND");
    expect(result.targetConfiguration.stackRule.selectedStackRuleFamily).toBe("PYTHON_BACKEND");
    expect(result.summary.resumeReadiness).toBe("READY_WITH_LIMITATIONS");
    expect(result.skillPlan.entries.some((entry) => entry.decision === "INCLUDE")).toBe(true);
    expect(result.rolePlans.some((role) => role.selectionStatus === "INCLUDE")).toBe(true);
    expect(result.projectPlans.some((project) => project.selectionStatus !== "EXCLUDE")).toBe(true);
    expect(result.claimsToAvoid[0]?.handlingCategory).toBe("PROJECT_ONLY");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("download");
  });

  it("switches to the microsoft family when .net evidence dominates", () => {
    const base = buildInput();
    const result = buildStructuredResumePlan({
      ...base,
      targetRole: "Senior .NET Engineer",
      matchReportResult: {
        ...base.matchReportResult,
        resumeGuidance: {
          ...base.matchReportResult.resumeGuidance,
          priorityTechnologies: [
            {
              technology: "C#",
              requirementImportance: 1,
              evidenceStrengthState: "STRONG_EVIDENCE",
              professionalEvidenceCount: 1,
              recency: "CURRENT",
              guidance: "INCLUDE"
            }
          ]
        }
      }
    });

    expect(result.targetConfiguration.targetRoleFamily).toBe("MICROSOFT_DOTNET");
    expect(result.targetConfiguration.stackRule.selectedStackRuleFamily).toBe(
      "MICROSOFT_DOTNET"
    );
  });
});
