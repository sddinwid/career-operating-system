import path from "node:path";
import { CareerProfilePurpose, PrismaClient } from "@prisma/client";
import { importCareerKnowledge } from "@/lib/career/service";

const prisma = new PrismaClient();

export async function seedWorkspace(
  prismaClient: PrismaClient,
  options: {
    workspaceId?: string;
    workspaceName?: string;
  } = {}
) {
  const workspaceId = options.workspaceId ?? "local-workspace";
  const workspaceName = options.workspaceName ?? "Local Career Workspace";
  const workspace = await prismaClient.workspace.upsert({
    where: { id: workspaceId },
    update: {
      name: workspaceName
    },
    create: {
      id: workspaceId,
      name: workspaceName,
      userSettings: {
        create: [
          {
            key: "defaultTimeZone",
            value: "America/Chicago"
          },
          {
            key: "jobSearchDayCutoff",
            value: "03:00"
          }
        ]
      }
    },
    include: {
      userSettings: true
    }
  });

  const desiredSettings = [
    { key: "defaultTimeZone", value: "America/Chicago" },
    { key: "jobSearchDayCutoff", value: "03:00" }
  ];

  for (const setting of desiredSettings) {
    await prismaClient.userSetting.upsert({
      where: {
        workspaceId_key: {
          workspaceId: workspace.id,
          key: setting.key
        }
      },
      update: {
        value: setting.value
      },
      create: {
        workspaceId: workspace.id,
        key: setting.key,
        value: setting.value
      }
    });
  }

  await importCareerKnowledge({
    filePath: path.resolve(
      "reference",
      "Scott_Dinwiddie_Career_Knowledge_Base_MongoDB_v3.json"
    ),
    prismaClient,
    workspaceId: workspace.id,
    purpose: CareerProfilePurpose.USER,
    setAsCurrent: true
  });

  return workspace;
}

export async function main() {
  await seedWorkspace(prisma);
}

if (process.argv[1]?.endsWith(path.join("prisma", "seed.ts"))) {
  main()
    .catch((error) => {
      console.error("Seed failed", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
