import { cache } from "react";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export type AppSettings = {
  defaultTimeZone: string;
  jobSearchDayCutoff: string;
};

function coerceSettingValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

export const getWorkspaceSettings = cache(
  async (workspaceId: string): Promise<AppSettings> => {
    const settings = await prisma.userSetting.findMany({
      where: {
        workspaceId,
        key: {
          in: ["defaultTimeZone", "jobSearchDayCutoff"]
        }
      }
    });

    const defaultTimeZone =
      coerceSettingValue(
        settings.find((setting) => setting.key === "defaultTimeZone")?.value
      ) ?? env.DEFAULT_TIME_ZONE;

    const jobSearchDayCutoff =
      coerceSettingValue(
        settings.find((setting) => setting.key === "jobSearchDayCutoff")?.value
      ) ?? env.JOB_SEARCH_DAY_CUTOFF;

    return {
      defaultTimeZone,
      jobSearchDayCutoff
    };
  }
);
