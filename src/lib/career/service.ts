import { promises as fs } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";
import {
  CAREER_CONTRACT_VERSION,
  CAREER_IMPORTER_VERSION,
  type CanonicalCareerKnowledgeContract
} from "@/lib/career/contracts";
import { normalizeCareerKnowledgeSource } from "@/lib/career/normalize";
import { computeSha256 } from "@/lib/career/utils";
import {
  mergeValidationSummaries,
  validateCanonicalCareerKnowledgeContract,
  validateCareerKnowledgeSource,
  type CareerValidationSummary
} from "@/lib/career/validation";
import { prisma } from "@/lib/prisma";

type ImportMode = "dry-run" | "commit";
type TransactionClient = Prisma.TransactionClient;

type CareerImportCounts = {
  employers: number;
  roles: number;
  projects: number;
  skills: number;
  evidenceRecords: number;
  educationRecords: number;
  certifications: number;
  generationRules: number;
};

export type CareerImportReport = {
  sourceFilename: string;
  sourcePath: string;
  checksum: string;
  sourceVersion: string | null;
  contractVersion: string;
  importerVersion: string;
  workspaceId: string;
  mode: ImportMode;
  duplicateImport: boolean;
  counts: CareerImportCounts;
  validation: CareerValidationSummary;
  sourceRecordId: string | null;
  versionId: string | null;
  reusedSourceRecordId: string | null;
  reusedVersionId: string | null;
  candidateFiles: string[];
};

type ImportOptions = {
  filePath: string;
  dryRun?: boolean;
  prismaClient?: PrismaClient;
  workspaceId?: string;
  simulateFailureAfterSourceCreate?: boolean;
};

type LoadedCareerSource = {
  sourcePath: string;
  sourceFilename: string;
  fileType: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  rawPayload: Record<string, unknown>;
  serializedPayload: string;
};

function countContractEntities(contract: CanonicalCareerKnowledgeContract): CareerImportCounts {
  return {
    employers: new Set(contract.employment.map((entry) => entry.employer.toLowerCase())).size,
    roles: contract.employment.length,
    projects: contract.projects.length,
    skills: contract.skills.length,
    evidenceRecords: contract.evidence.length,
    educationRecords: contract.education.length,
    certifications: contract.certifications.length,
    generationRules:
      contract.generationRules.globalRules.length +
      contract.generationRules.stackOrderingRules.length
  };
}

async function readCareerSource(filePath: string): Promise<LoadedCareerSource> {
  const sourcePath = path.resolve(filePath);
  const fileContent = await fs.readFile(sourcePath, "utf8");
  const rawPayload = JSON.parse(fileContent) as Record<string, unknown>;
  const stats = await fs.stat(sourcePath);

  return {
    sourcePath,
    sourceFilename: path.basename(sourcePath),
    fileType: path.extname(sourcePath).toLowerCase() || ".json",
    mimeType: "application/json",
    sizeBytes: stats.size,
    checksum: computeSha256(fileContent),
    rawPayload,
    serializedPayload: fileContent
  };
}

function findSourceVersion(rawPayload: Record<string, unknown>) {
  const meta = rawPayload._meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return null;
  }

  const schemaVersion = (meta as Record<string, unknown>).schemaVersion;
  return typeof schemaVersion === "string" ? schemaVersion : null;
}

export async function locateCareerKnowledgeCandidates() {
  const candidates = [
    path.resolve("reference/Scott_Dinwiddie_Career_Knowledge_Base_MongoDB_v3.json"),
    path.resolve("reference/Scott_Dinwiddie_Career_Knowledge_Base_Schema_v3.json"),
    path.resolve("reference/Scott_Dinwiddie_Career_Knowledge_Base_v3_README.md")
  ];

  return candidates;
}

export async function getLatestCareerProfileVersion(workspaceId: string, prismaClient = prisma) {
  return prismaClient.careerProfileVersion.findFirst({
    where: {
      workspaceId,
      active: true
    },
    include: {
      source: {
        select: {
          id: true,
          filename: true,
          checksum: true,
          sourceVersion: true,
          createdAt: true,
          sizeBytes: true,
          fileType: true,
          mimeType: true
        }
      }
    },
    orderBy: [{ importedAt: "desc" }]
  });
}

export async function getCareerProfileVersionById(
  workspaceId: string,
  versionId: string,
  prismaClient: PrismaClient | TransactionClient = prisma
) {
  return prismaClient.careerProfileVersion.findFirst({
    where: {
      id: versionId,
      workspaceId
    },
    include: {
      source: {
        select: {
          id: true,
          filename: true,
          checksum: true,
          sourceVersion: true,
          createdAt: true,
          sizeBytes: true,
          fileType: true,
          mimeType: true
        }
      },
      predecessor: {
        select: {
          id: true,
          importedAt: true
        }
      }
    }
  });
}

export async function importCareerKnowledge(
  options: ImportOptions
): Promise<CareerImportReport> {
  const prismaClient = options.prismaClient ?? prisma;
  const workspace = options.workspaceId
    ? await prismaClient.workspace.findUniqueOrThrow({
        where: { id: options.workspaceId }
      })
    : await prismaClient.workspace.findFirstOrThrow({
        orderBy: { createdAt: "asc" }
      });
  const loaded = await readCareerSource(options.filePath);
  const sourceValidation = validateCareerKnowledgeSource(loaded.rawPayload);

  if (!sourceValidation.success || !sourceValidation.data) {
    return {
      sourceFilename: loaded.sourceFilename,
      sourcePath: loaded.sourcePath,
      checksum: loaded.checksum,
      sourceVersion: findSourceVersion(loaded.rawPayload),
      contractVersion: CAREER_CONTRACT_VERSION,
      importerVersion: CAREER_IMPORTER_VERSION,
      workspaceId: workspace.id,
      mode: options.dryRun ? "dry-run" : "commit",
      duplicateImport: false,
      counts: {
        employers: 0,
        roles: 0,
        projects: 0,
        skills: 0,
        evidenceRecords: 0,
        educationRecords: 0,
        certifications: 0,
        generationRules: 0
      },
      validation: sourceValidation.summary,
      sourceRecordId: null,
      versionId: null,
      reusedSourceRecordId: null,
      reusedVersionId: null,
      candidateFiles: await locateCareerKnowledgeCandidates()
    };
  }

  const contract = normalizeCareerKnowledgeSource(sourceValidation.data);
  const contractValidation = validateCanonicalCareerKnowledgeContract(contract);
  const validation = mergeValidationSummaries(
    sourceValidation.summary,
    contractValidation.summary
  );
  const counts = countContractEntities(contract);
  const sourceVersion = findSourceVersion(loaded.rawPayload);

  const existingSource = await prismaClient.careerProfileSource.findUnique({
    where: {
      workspaceId_checksum: {
        workspaceId: workspace.id,
        checksum: loaded.checksum
      }
    }
  });

  const existingVersion = await prismaClient.careerProfileVersion.findFirst({
    where: {
      workspaceId: workspace.id,
      checksum: loaded.checksum,
      schemaVersion: CAREER_CONTRACT_VERSION,
      importerVersion: CAREER_IMPORTER_VERSION
    }
  });

  if (options.dryRun || validation.errorCount > 0) {
    return {
      sourceFilename: loaded.sourceFilename,
      sourcePath: loaded.sourcePath,
      checksum: loaded.checksum,
      sourceVersion,
      contractVersion: CAREER_CONTRACT_VERSION,
      importerVersion: CAREER_IMPORTER_VERSION,
      workspaceId: workspace.id,
      mode: options.dryRun ? "dry-run" : "commit",
      duplicateImport: Boolean(existingVersion),
      counts,
      validation,
      sourceRecordId: null,
      versionId: null,
      reusedSourceRecordId: existingSource?.id ?? null,
      reusedVersionId: existingVersion?.id ?? null,
      candidateFiles: await locateCareerKnowledgeCandidates()
    };
  }

  if (existingVersion) {
    return {
      sourceFilename: loaded.sourceFilename,
      sourcePath: loaded.sourcePath,
      checksum: loaded.checksum,
      sourceVersion,
      contractVersion: CAREER_CONTRACT_VERSION,
      importerVersion: CAREER_IMPORTER_VERSION,
      workspaceId: workspace.id,
      mode: "commit",
      duplicateImport: true,
      counts,
      validation,
      sourceRecordId: existingSource?.id ?? null,
      versionId: existingVersion.id,
      reusedSourceRecordId: existingSource?.id ?? null,
      reusedVersionId: existingVersion.id,
      candidateFiles: await locateCareerKnowledgeCandidates()
    };
  }

  await fs.mkdir(path.resolve(env.LOCAL_DATA_DIR, "career-profile-imports"), {
    recursive: true
  });

  const committed = await prismaClient.$transaction(async (transaction) => {
    const sourceRecord =
      existingSource ??
      (await transaction.careerProfileSource.create({
        data: {
          workspaceId: workspace.id,
          filename: loaded.sourceFilename,
          fileType: loaded.fileType,
          mimeType: loaded.mimeType,
          sizeBytes: loaded.sizeBytes,
          checksum: loaded.checksum,
          sourceVersion,
          rawPayload: loaded.rawPayload as Prisma.InputJsonValue
        }
      }));

    if (options.simulateFailureAfterSourceCreate) {
      throw new Error("Simulated career import failure after source creation.");
    }

    const previousActive = await transaction.careerProfileVersion.findFirst({
      where: {
        workspaceId: workspace.id,
        active: true
      },
      orderBy: [{ importedAt: "desc" }]
    });

    if (previousActive) {
      await transaction.careerProfileVersion.update({
        where: { id: previousActive.id },
        data: {
          active: false,
          supersededAt: new Date()
        }
      });
    }

    const version = await transaction.careerProfileVersion.create({
      data: {
        workspaceId: workspace.id,
        sourceId: sourceRecord.id,
        predecessorId: previousActive?.id ?? null,
        schemaVersion: CAREER_CONTRACT_VERSION,
        importerVersion: CAREER_IMPORTER_VERSION,
        sourceFilename: loaded.sourceFilename,
        sourceVersion,
        content: contract as Prisma.InputJsonValue,
        validationSummary: validation as Prisma.InputJsonValue,
        checksum: loaded.checksum,
        active: true
      }
    });

    return {
      sourceRecordId: sourceRecord.id,
      versionId: version.id
    };
  });

  return {
    sourceFilename: loaded.sourceFilename,
    sourcePath: loaded.sourcePath,
    checksum: loaded.checksum,
    sourceVersion,
    contractVersion: CAREER_CONTRACT_VERSION,
    importerVersion: CAREER_IMPORTER_VERSION,
    workspaceId: workspace.id,
    mode: "commit",
    duplicateImport: false,
    counts,
    validation,
    sourceRecordId: committed.sourceRecordId,
    versionId: committed.versionId,
    reusedSourceRecordId: existingSource?.id ?? null,
    reusedVersionId: null,
    candidateFiles: await locateCareerKnowledgeCandidates()
  };
}

export function formatCareerImportReport(report: CareerImportReport) {
  const modeLabel = report.mode === "dry-run" ? "DRY RUN" : "COMMIT";

  return [
    `Career knowledge import: ${modeLabel}`,
    `Source file: ${report.sourceFilename}`,
    `Checksum: ${report.checksum}`,
    `Source version: ${report.sourceVersion ?? "unknown"}`,
    `Contract version: ${report.contractVersion}`,
    `Importer version: ${report.importerVersion}`,
    `Workspace: ${report.workspaceId}`,
    `Duplicate import: ${report.duplicateImport ? "yes" : "no"}`,
    `Counts: employers=${report.counts.employers}, roles=${report.counts.roles}, projects=${report.counts.projects}, skills=${report.counts.skills}, evidence=${report.counts.evidenceRecords}, education=${report.counts.educationRecords}, certifications=${report.counts.certifications}, rules=${report.counts.generationRules}`,
    `Validation: errors=${report.validation.errorCount}, warnings=${report.validation.warningCount}, info=${report.validation.informationCount}`,
    `Source record: ${report.sourceRecordId ?? report.reusedSourceRecordId ?? "none"}`,
    `Version: ${report.versionId ?? report.reusedVersionId ?? "none"}`
  ].join("\n");
}
