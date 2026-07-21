import { describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/cover-letter-studio/[revisionId]/route";
import { saveCoverLetterRevisionSuccessor } from "@/lib/cover-letter-revision/service";

vi.mock("@/lib/workspace", () => ({
  getDefaultWorkspace: vi.fn(async () => ({ id: "workspace-1" }))
}));

vi.mock("@/lib/cover-letter-revision/service", () => ({
  saveCoverLetterRevisionSuccessor: vi.fn(),
  CoverLetterRevisionServiceError: class CoverLetterRevisionServiceError extends Error {
    status: number;
    code: string;

    constructor(args: { message: string; status: number; code: string }) {
      super(args.message);
      this.status = args.status;
      this.code = args.code;
    }
  }
}));

const mockSaveCoverLetterRevisionSuccessor = vi.mocked(saveCoverLetterRevisionSuccessor);

function buildRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/cover-letter-studio/revision-1", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("cover-letter studio save route", () => {
  it("returns the saved revision payload", async () => {
    mockSaveCoverLetterRevisionSuccessor.mockResolvedValueOnce({
      id: "revision-1",
      inputChecksum: "checksum-1",
      updatedAt: new Date("2026-07-20T12:00:00.000Z"),
      status: "DRAFT",
      summary: {
        wordCount: 250
      }
    } as never);

    const response = await PATCH(
      buildRequest({
        updatedAt: "2026-07-20T11:59:00.000Z",
        userNotes: "Refined evidence wording.",
        content: {
          revisionId: "revision-1",
          workspaceId: "workspace-1",
          coverLetterCompositionVersionId: "composition-1",
          predecessorRevisionId: null,
          applicationId: "application-1",
          jobOpportunityId: "job-1",
          jobDescriptionVersionId: "job-description-1",
          careerProfileVersionId: "career-1",
          requirementAnalysisId: "analysis-1",
          evidenceRetrievalRunId: "retrieval-1",
          evidenceScoringRunId: "scoring-1",
          matchReportRunId: "report-1",
          resumeCompositionVersionId: null,
          resumeRevisionVersionId: null,
          coverLetterRevisionContractVersion: "1.0.0",
          coverLetterRevisionEngineVersion: "m8.2.0",
          coverLetterRevisionConfigurationVersion: "scott-v1",
          inputChecksum: "checksum-0",
          contentChecksum: "content-checksum-0",
          createdAt: "2026-07-20T11:58:00.000Z",
          updatedAt: "2026-07-20T11:59:00.000Z",
          status: "DRAFT",
          validationState: "VALID",
          candidateName: "Scott Dinwiddie",
          header: {
            email: null,
            phone: null,
            location: null,
            date: "July 20, 2026",
            company: "Acme",
            role: "Senior Engineer"
          },
          salutation: "Dear Hiring Team,",
          paragraphs: [
            {
              id: "opening",
              type: "OPENING",
              purpose: "Opening",
              text: "Base text",
              originalText: "Base text",
              currentText: "Revised text",
              wordCount: 2,
              order: 0,
              originalOrder: 0,
              supportingEvidenceIds: ["evidence-1"],
              supportingRequirementIds: ["req-1"],
              supportingMatchReportConclusionIds: ["match-1"],
              sourceCareerRecordIds: ["career-record-1"],
              sourceResumeSectionIds: ["summary"],
              acknowledgements: [],
              claims: [
                {
                  id: "claim-1",
                  type: "EXPERIENCE",
                  text: "Revised text",
                  qualified: true,
                  evidenceContext: "PROFESSIONAL",
                  restrictions: []
                }
              ],
              originalClaims: [],
              editedClaimRisk: false,
              technologies: ["TypeScript"],
              companyReferences: ["Acme"],
              roleReferences: ["Senior Engineer"],
              diagnostics: []
            }
          ],
          closing: "Sincerely, Scott",
          summary: {
            targetCompany: "Acme",
            targetRole: "Senior Engineer",
            wordCount: 250,
            paragraphCount: 1,
            companyReferenceCount: 1,
            roleReferenceCount: 1,
            technologyMentionCount: 1,
            professionalEvidenceParagraphCount: 1,
            projectEvidenceParagraphCount: 0,
            warningCount: 0,
            errorCount: 0,
            infoCount: 0,
            resumeOverlapRatio: 0.1,
            resumeSourceUsed: false,
            professionalEvidencePrioritized: true
          },
          styleSummary: {
            salutation: "Dear Hiring Team,",
            closing: "Sincerely, Scott",
            voice: "DIRECT",
            noEmDashDetected: true,
            prohibitedPhrasesDetected: [],
            firstPersonCount: 0,
            adjectiveCount: 0,
            sentenceCount: 3
          },
          lengthSummary: {
            targetMinWords: 150,
            targetMaxWords: 400,
            actualWords: 250,
            targetMinParagraphs: 3,
            targetMaxParagraphs: 5,
            actualParagraphs: 1,
            withinTargetRange: false
          },
          overallProvenance: {
            overallEvidenceIds: ["evidence-1"],
            overallRequirementIds: ["req-1"],
            overallCareerRecordIds: ["career-record-1"],
            resumeSource: null
          },
          diagnostics: []
        }
      }),
      {
        params: Promise.resolve({ revisionId: "revision-1" })
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      revisionId: "revision-1",
      inputChecksum: "checksum-1",
      status: "DRAFT"
    });
  });
});
