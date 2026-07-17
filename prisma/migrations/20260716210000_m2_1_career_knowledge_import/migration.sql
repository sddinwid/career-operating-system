-- DropIndex
DROP INDEX "CareerProfileVersion_workspaceId_active_idx";

-- AlterTable
ALTER TABLE "CareerProfileVersion" ADD COLUMN     "importerVersion" TEXT NOT NULL,
ADD COLUMN     "predecessorId" TEXT,
ADD COLUMN     "sourceId" TEXT NOT NULL,
ADD COLUMN     "sourceVersion" TEXT,
ADD COLUMN     "supersededAt" TIMESTAMP(3),
ADD COLUMN     "validationSummary" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "CareerProfileSource" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "sourceVersion" TEXT,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerProfileSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareerProfileSource_workspaceId_createdAt_idx" ON "CareerProfileSource"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CareerProfileSource_workspaceId_checksum_key" ON "CareerProfileSource"("workspaceId", "checksum");

-- CreateIndex
CREATE INDEX "CareerProfileVersion_workspaceId_active_importedAt_idx" ON "CareerProfileVersion"("workspaceId", "active", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CareerProfileVersion_sourceId_schemaVersion_importerVersion_key" ON "CareerProfileVersion"("sourceId", "schemaVersion", "importerVersion");

-- AddForeignKey
ALTER TABLE "CareerProfileVersion" ADD CONSTRAINT "CareerProfileVersion_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "CareerProfileVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerProfileVersion" ADD CONSTRAINT "CareerProfileVersion_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CareerProfileSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerProfileSource" ADD CONSTRAINT "CareerProfileSource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
