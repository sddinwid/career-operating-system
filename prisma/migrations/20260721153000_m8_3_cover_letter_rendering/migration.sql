ALTER TABLE "DocumentVersion"
  ALTER COLUMN "resumeRenderingApprovalId" DROP NOT NULL,
  ALTER COLUMN "resumeAuditRunId" DROP NOT NULL,
  ALTER COLUMN "resumeCompositionVersionId" DROP NOT NULL,
  ADD COLUMN "coverLetterApprovalId" TEXT,
  ADD COLUMN "coverLetterAuditRunId" TEXT,
  ADD COLUMN "coverLetterCompositionVersionId" TEXT,
  ADD COLUMN "coverLetterRevisionVersionId" TEXT;

CREATE INDEX "DocumentVersion_coverLetterApprovalId_generatedAt_idx"
  ON "DocumentVersion"("coverLetterApprovalId", "generatedAt");

CREATE INDEX "DocumentVersion_coverLetterAuditRunId_generatedAt_idx"
  ON "DocumentVersion"("coverLetterAuditRunId", "generatedAt");

CREATE INDEX "DocumentVersion_coverLetterCompositionVersionId_generatedAt_idx"
  ON "DocumentVersion"("coverLetterCompositionVersionId", "generatedAt");

CREATE INDEX "DocumentVersion_coverLetterRevisionVersionId_generatedAt_idx"
  ON "DocumentVersion"("coverLetterRevisionVersionId", "generatedAt");

ALTER TABLE "DocumentVersion"
  ADD CONSTRAINT "DocumentVersion_coverLetterApprovalId_fkey"
    FOREIGN KEY ("coverLetterApprovalId") REFERENCES "CoverLetterApproval"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentVersion_coverLetterAuditRunId_fkey"
    FOREIGN KEY ("coverLetterAuditRunId") REFERENCES "CoverLetterAuditRun"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentVersion_coverLetterCompositionVersionId_fkey"
    FOREIGN KEY ("coverLetterCompositionVersionId") REFERENCES "CoverLetterCompositionVersion"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DocumentVersion_coverLetterRevisionVersionId_fkey"
    FOREIGN KEY ("coverLetterRevisionVersionId") REFERENCES "CoverLetterRevisionVersion"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
