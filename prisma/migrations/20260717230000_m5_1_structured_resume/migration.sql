-- CreateEnum
CREATE TYPE "StructuredResumeVersionStatus" AS ENUM ('PENDING', 'READY', 'READY_WITH_LIMITATIONS', 'NEEDS_REVIEW', 'FAILED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "StructuredResumeVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "careerProfileVersionId" TEXT NOT NULL,
    "requirementAnalysisId" TEXT NOT NULL,
    "evidenceRetrievalRunId" TEXT NOT NULL,
    "evidenceScoringRunId" TEXT NOT NULL,
    "matchReportRunId" TEXT NOT NULL,
    "jobDescriptionVersionId" TEXT NOT NULL,
    "applicationId" TEXT,
    "predecessorVersionId" TEXT,
    "contractVersion" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "configurationVersion" TEXT NOT NULL,
    "matchReportInputChecksum" TEXT NOT NULL,
    "careerSourceChecksum" TEXT NOT NULL,
    "inputChecksum" TEXT NOT NULL,
    "status" "StructuredResumeVersionStatus" NOT NULL DEFAULT 'PENDING',
    "plan" JSONB,
    "summary" JSONB,
    "diagnostics" JSONB,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StructuredResumeVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StructuredResumeVersion_workspaceId_createdAt_idx" ON "StructuredResumeVersion"("workspaceId", "createdAt");
CREATE INDEX "StructuredResumeVersion_careerProfileVersionId_createdAt_idx" ON "StructuredResumeVersion"("careerProfileVersionId", "createdAt");
CREATE INDEX "StructuredResumeVersion_requirementAnalysisId_createdAt_idx" ON "StructuredResumeVersion"("requirementAnalysisId", "createdAt");
CREATE INDEX "StructuredResumeVersion_evidenceRetrievalRunId_createdAt_idx" ON "StructuredResumeVersion"("evidenceRetrievalRunId", "createdAt");
CREATE INDEX "StructuredResumeVersion_evidenceScoringRunId_createdAt_idx" ON "StructuredResumeVersion"("evidenceScoringRunId", "createdAt");
CREATE INDEX "StructuredResumeVersion_matchReportRunId_createdAt_idx" ON "StructuredResumeVersion"("matchReportRunId", "createdAt");
CREATE INDEX "StructuredResumeVersion_jobDescriptionVersionId_createdAt_idx" ON "StructuredResumeVersion"("jobDescriptionVersionId", "createdAt");
CREATE INDEX "StructuredResumeVersion_applicationId_createdAt_idx" ON "StructuredResumeVersion"("applicationId", "createdAt");
CREATE INDEX "StructuredResumeVersion_workspaceId_inputChecksum_status_createdAt_idx" ON "StructuredResumeVersion"("workspaceId", "inputChecksum", "status", "createdAt");

ALTER TABLE "StructuredResumeVersion" ADD CONSTRAINT "StructuredResumeVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StructuredResumeVersion" ADD CONSTRAINT "StructuredResumeVersion_careerProfileVersionId_fkey" FOREIGN KEY ("careerProfileVersionId") REFERENCES "CareerProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StructuredResumeVersion" ADD CONSTRAINT "StructuredResumeVersion_requirementAnalysisId_fkey" FOREIGN KEY ("requirementAnalysisId") REFERENCES "JobRequirementAnalysis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StructuredResumeVersion" ADD CONSTRAINT "StructuredResumeVersion_evidenceRetrievalRunId_fkey" FOREIGN KEY ("evidenceRetrievalRunId") REFERENCES "EvidenceRetrievalRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StructuredResumeVersion" ADD CONSTRAINT "StructuredResumeVersion_evidenceScoringRunId_fkey" FOREIGN KEY ("evidenceScoringRunId") REFERENCES "EvidenceScoringRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StructuredResumeVersion" ADD CONSTRAINT "StructuredResumeVersion_matchReportRunId_fkey" FOREIGN KEY ("matchReportRunId") REFERENCES "MatchReportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StructuredResumeVersion" ADD CONSTRAINT "StructuredResumeVersion_jobDescriptionVersionId_fkey" FOREIGN KEY ("jobDescriptionVersionId") REFERENCES "JobDescriptionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StructuredResumeVersion" ADD CONSTRAINT "StructuredResumeVersion_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StructuredResumeVersion" ADD CONSTRAINT "StructuredResumeVersion_predecessorVersionId_fkey" FOREIGN KEY ("predecessorVersionId") REFERENCES "StructuredResumeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
