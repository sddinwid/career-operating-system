import { describe, expect, it } from "vitest";
import type { CanonicalCareerKnowledgeContract } from "@/lib/career/contracts";
import type { ResumeAuditInput } from "@/lib/resume-audit/contract";
import { buildResumeAudit } from "@/lib/resume-audit/engine";

function buildCareerProfile(): CanonicalCareerKnowledgeContract {
  return {
    schemaVersion: "1.0.0",
    sourceSchemaVersion: "fixture",
    candidate: {
      id: "candidate-1",
      displayName: "Fixture Candidate",
      contacts: {
        email: "fixture@example.com",
        phone: "555-0100",
        linkedinUrl: "linkedin.com/in/fixture",
        githubUrl: "github.com/fixture"
      },
      location: "Chicago, IL",
      targetRoles: ["Backend Engineer"],
      targetRolePositioning: { default: "Backend Engineer" },
      careerThemes: ["platform"],
      workPreferences: null,
      writingPreferences: null,
      knownUnknowns: [],
      recordKind: "SOURCE_FACT",
      confirmationState: "SOURCE_PROVIDED",
      provenance: {
        sourceSection: "candidateProfile",
        sourceId: "candidate-1",
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
        id: "role-1",
        employer: "Acme",
        roleTitle: "Senior Engineer",
        startDate: { raw: "2024-01", normalized: "2024-01", precision: "MONTH" },
        endDate: { raw: "2026-05", normalized: "2026-05", precision: "MONTH" },
        employmentType: null,
        location: "Chicago, IL",
        workArrangement: "REMOTE",
        domainTags: [],
        themes: [],
        responsibilities: ["Built platform APIs"],
        accomplishments: ["Improved throughput by 20 percent"],
        technologies: ["TypeScript", "PostgreSQL"],
        metrics: [
          {
            description: "Improved throughput",
            value: "20%",
            verificationState: "VERIFIED"
          }
        ],
        facts: [],
        leadershipScope: null,
        recordKind: "SOURCE_FACT",
        confirmationState: "SOURCE_PROVIDED",
        provenance: {
          sourceSection: "professionalExperience",
          sourceId: "role-1",
          sourcePath: "professionalExperience[0]"
        }
      }
    ],
    projects: [],
    skills: [
      {
        id: "skill-1",
        name: "TypeScript",
        category: "LANGUAGE",
        professionalUse: true,
        projectUse: true,
        firstUse: null,
        lastUse: null,
        recency: "CURRENT",
        confidence: "HIGH",
        evidenceReferences: ["role-1"],
        notes: null,
        recordKind: "SOURCE_FACT",
        confirmationState: "SOURCE_PROVIDED",
        provenance: {
          sourceSection: "skills",
          sourceId: "skill-1",
          sourcePath: "skills[0]"
        }
      }
    ],
    education: [
      {
        id: "edu-1",
        institution: "Example University",
        degree: "B.S.",
        field: "Computer Science",
        completionDate: { raw: "2018", normalized: "2018", precision: "YEAR" },
        status: "COMPLETED",
        recordKind: "SOURCE_FACT",
        confirmationState: "SOURCE_PROVIDED",
        provenance: {
          sourceSection: "education",
          sourceId: "edu-1",
          sourcePath: "education[0]"
        }
      }
    ],
    certifications: [],
    evidence: [],
    interviewStories: []
  };
}

function buildAuditInput(): ResumeAuditInput {
  return {
    runId: "audit-1",
    workspaceId: "workspace-1",
    resumeCompositionVersionId: "resume-composition-1",
    resumeRevisionVersionId: null,
    resumeCompositionInputChecksum: "composition-checksum-1",
    createdAt: "2026-07-17T12:00:00.000Z",
    inputChecksum: "audit-input-checksum-1",
    matchReportClaimsToAvoid: [],
    maximumRequestedExperienceYears: 5,
    resumeComposition: {
      runId: "resume-composition-1",
      workspaceId: "workspace-1",
      structuredResumeVersionId: "structured-1",
      careerProfileVersionId: "career-1",
      requirementAnalysisId: "analysis-1",
      matchReportRunId: "report-1",
      jobDescriptionVersionId: "job-1",
      applicationId: "application-1",
      resumeCompositionContractVersion: "1.0.0",
      resumeCompositionEngineVersion: "m5.2.0",
      resumeCompositionConfigurationVersion: "scott-v1",
      createdAt: "2026-07-17T11:00:00.000Z",
      inputChecksum: "composition-checksum-1",
      status: "READY",
      targetCompany: "Acme",
      targetRole: "Senior Platform Engineer",
      targetRoleFamily: "NODE_TYPESCRIPT_BACKEND",
      stackFamily: "NODE_TYPESCRIPT_BACKEND",
      pageTarget: 2,
      diagnostics: [],
      header: [
        {
          field: "EMAIL",
          label: "EMAIL",
          value: "fixture@example.com",
          included: true,
          reason: "contact",
          provenance: {
            statementId: "header:email",
            sourceEvidenceIds: ["candidate-1"],
            sourceCareerRecordIds: ["candidate-1"],
            requirementIds: [],
            templateId: "header.direct-source",
            transformations: [],
            metricReferences: [],
            technologies: [],
            restrictions: [],
            recordKinds: ["SOURCE_FACT"],
            confirmationStates: ["SOURCE_PROVIDED"],
            truthfulnessClassification: "VERIFIED_SOURCE",
            claimsToAvoidChecked: []
          }
        }
      ],
      professionalSummary: {
        sentences: [
          {
            statementId: "summary:1",
            text: "Platform engineer focused on TypeScript APIs and PostgreSQL services.",
            templateId: "summary.role",
            provenance: {
              statementId: "summary:1",
              sourceEvidenceIds: ["role-1"],
              sourceCareerRecordIds: ["role-1"],
              requirementIds: ["req-1"],
              templateId: "summary.role",
              transformations: [],
              metricReferences: [],
              technologies: ["TypeScript", "PostgreSQL"],
              restrictions: [],
              recordKinds: ["SOURCE_FACT"],
              confirmationStates: ["SOURCE_PROVIDED"],
              truthfulnessClassification: "VERIFIED_COMPOSITE",
              claimsToAvoidChecked: []
            }
          }
        ],
        text: "Platform engineer focused on TypeScript APIs and PostgreSQL services.",
        sentenceCount: 1,
        wordCount: 9,
        warnings: []
      },
      skillsGroups: [
        {
          groupId: "BACKEND",
          groupLabel: "Backend",
          order: 0,
          estimatedLineCount: 1,
          skills: [
            {
              canonicalValue: "TypeScript",
              displayValue: "TypeScript",
              supportingEvidenceIds: ["role-1"],
              requirementIds: ["req-1"],
              professionalUse: true,
              projectUse: true,
              recency: "CURRENT",
              qualificationText: null,
              inclusionReason: "core skill",
              provenance: {
                statementId: "skill:typescript",
                sourceEvidenceIds: ["role-1"],
                sourceCareerRecordIds: ["skill-1"],
                requirementIds: ["req-1"],
                templateId: "skills.direct-display",
                transformations: [],
                metricReferences: [],
                technologies: ["TypeScript"],
                restrictions: [],
                recordKinds: ["SOURCE_FACT"],
                confirmationStates: ["SOURCE_PROVIDED"],
                truthfulnessClassification: "VERIFIED_COMPOSITE",
                claimsToAvoidChecked: []
              }
            }
          ]
        }
      ],
      professionalExperience: [
        {
          roleId: "role-1",
          employer: "Acme",
          roleTitle: "Senior Engineer",
          location: "Chicago, IL",
          startDate: "2024-01",
          endDate: "2026-05",
          workArrangement: "REMOTE",
          employmentType: null,
          technologies: ["TypeScript", "PostgreSQL"],
          sectionPosition: 0,
          estimatedLineCount: 3,
          bullets: [
            {
              statementId: "bullet-1",
              text: "Improved throughput by 20 percent for TypeScript APIs.",
              templateId: "role-bullet.1",
              estimatedLineCount: 1,
              provenance: {
                statementId: "bullet-1",
                sourceEvidenceIds: ["role-1"],
                sourceCareerRecordIds: ["role-1"],
                requirementIds: ["req-1"],
                templateId: "role-bullet.1",
                transformations: [],
                metricReferences: [],
                technologies: ["TypeScript"],
                restrictions: [],
                recordKinds: ["SOURCE_FACT"],
                confirmationStates: ["SOURCE_PROVIDED"],
                truthfulnessClassification: "VERIFIED_SOURCE",
                claimsToAvoidChecked: []
              }
            }
          ],
          provenance: {
            statementId: "role-header:role-1",
            sourceEvidenceIds: ["role-1"],
            sourceCareerRecordIds: ["role-1"],
            requirementIds: ["req-1"],
            templateId: "role-header",
            transformations: [],
            metricReferences: [],
            technologies: [],
            restrictions: [],
            recordKinds: ["SOURCE_FACT"],
            confirmationStates: ["SOURCE_PROVIDED"],
            truthfulnessClassification: "VERIFIED_SOURCE",
            claimsToAvoidChecked: []
          }
        }
      ],
      selectedProjects: [],
      education: [
        {
          educationId: "edu-1",
          institution: "Example University",
          degree: "B.S.",
          field: "Computer Science",
          completionDate: "2018",
          status: "COMPLETED",
          provenance: {
            statementId: "education:edu-1",
            sourceEvidenceIds: ["edu-1"],
            sourceCareerRecordIds: ["edu-1"],
            requirementIds: [],
            templateId: "education.direct-source",
            transformations: [],
            metricReferences: [],
            technologies: [],
            restrictions: [],
            recordKinds: ["SOURCE_FACT"],
            confirmationStates: ["SOURCE_PROVIDED"],
            truthfulnessClassification: "VERIFIED_SOURCE",
            claimsToAvoidChecked: []
          }
        }
      ],
      certifications: [],
      finalSectionOrder: ["HEADER", "PROFESSIONAL_SUMMARY", "CORE_SKILLS", "PROFESSIONAL_EXPERIENCE", "EDUCATION"],
      sectionEstimates: [],
      summary: {
        targetCompany: "Acme",
        targetRole: "Senior Platform Engineer",
        targetRoleFamily: "NODE_TYPESCRIPT_BACKEND",
        stackFamily: "NODE_TYPESCRIPT_BACKEND",
        sectionCount: 5,
        summaryWordCount: 9,
        skillCount: 1,
        includedRoleCount: 1,
        includedProjectCount: 0,
        bulletCount: 1,
        verifiedSourceStatementCount: 3,
        verifiedCompositeStatementCount: 2,
        qualifiedStatementCount: 0,
        prohibitedStatementCount: 0,
        estimatedLineCount: 12,
        estimatedPageCount: 1.2,
        pageBudgetStatus: "WITHIN_TARGET",
        diagnosticErrorCount: 0,
        diagnosticWarningCount: 0,
        diagnosticInfoCount: 0
      }
    }
  };
}

describe("buildResumeAudit", () => {
  it("returns ready-with-warnings for an otherwise valid composition", () => {
    const result = buildResumeAudit({
      input: buildAuditInput(),
      careerProfile: buildCareerProfile(),
      structuredResumePlan: {} as never,
      matchReport: {
        resumeGuidance: {
          priorityTechnologies: [{ technology: "TypeScript", guidance: "INCLUDE" }]
        }
      } as never
    });

    expect(result.status).toBe("PASSED_WITH_WARNINGS");
    expect(result.renderingReadiness).toBe("READY_WITH_WARNINGS");
    expect(result.summary.errorCount).toBe(0);
    expect(result.summary.warningCount).toBeGreaterThan(0);
  });

  it("accepts direct-source GitHub header values during source-fidelity checks", () => {
    const input = buildAuditInput();
    input.resumeComposition.header = [
      {
        field: "GITHUB",
        label: "GITHUB",
        value: "github.com/fixture",
        included: true,
        reason: "contact",
        provenance: {
          statementId: "header:github",
          sourceEvidenceIds: ["candidate-1"],
          sourceCareerRecordIds: ["candidate-1"],
          requirementIds: [],
          templateId: "header.direct-source",
          transformations: [],
          metricReferences: [],
          technologies: [],
          restrictions: [],
          recordKinds: ["SOURCE_FACT"],
          confirmationStates: ["SOURCE_PROVIDED"],
          truthfulnessClassification: "VERIFIED_SOURCE",
          claimsToAvoidChecked: []
        }
      }
    ];

    const result = buildResumeAudit({
      input,
      careerProfile: buildCareerProfile(),
      structuredResumePlan: {} as never,
      matchReport: {
        resumeGuidance: {
          priorityTechnologies: [{ technology: "TypeScript", guidance: "INCLUDE" }]
        }
      } as never
    });

    expect(result.findings.some((finding) => finding.ruleId === "source-fidelity.mismatch")).toBe(
      false
    );
  });

  it("blocks rendering when a statement is missing provenance", () => {
    const input = buildAuditInput();
    input.resumeComposition.professionalExperience[0]!.bullets[0]!.provenance.sourceEvidenceIds = [];
    input.resumeComposition.professionalExperience[0]!.bullets[0]!.provenance.sourceCareerRecordIds = [];

    const result = buildResumeAudit({
      input,
      careerProfile: buildCareerProfile(),
      structuredResumePlan: {} as never,
      matchReport: {
        resumeGuidance: {
          priorityTechnologies: [{ technology: "TypeScript", guidance: "INCLUDE" }]
        }
      } as never
    });

    expect(result.status).toBe("FAILED");
    expect(result.renderingReadiness).toBe("BLOCKED");
    expect(result.findings.some((finding) => finding.ruleId === "provenance.missing-source")).toBe(true);
  });
});
