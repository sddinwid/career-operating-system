import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { id: "local-workspace" },
    update: {
      name: "Local Career Workspace"
    },
    create: {
      id: "local-workspace",
      name: "Local Career Workspace",
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
    await prisma.userSetting.upsert({
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
}

main()
  .catch((error) => {
    console.error("Seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
