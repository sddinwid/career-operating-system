import { JobDescriptionSourceType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  createStandaloneJobDescriptionSchema,
  saveApplicationJobDescriptionSchema
} from "@/lib/job-descriptions/schemas";

describe("job description schemas", () => {
  it("rejects empty and whitespace-only descriptions", () => {
    expect(
      saveApplicationJobDescriptionSchema.safeParse({
        descriptionText: "",
        sourceType: JobDescriptionSourceType.MANUAL_PASTE
      }).success
    ).toBe(false);

    expect(
      saveApplicationJobDescriptionSchema.safeParse({
        descriptionText: "   \n\t  ",
        sourceType: JobDescriptionSourceType.MANUAL_PASTE
      }).success
    ).toBe(false);
  });

  it("validates URL, source type, maximum size, and publication date fields", () => {
    const tooLarge = "x".repeat(200_001);

    expect(
      saveApplicationJobDescriptionSchema.safeParse({
        descriptionText: "Example",
        sourceType: JobDescriptionSourceType.MANUAL_PASTE,
        sourceUrl: "not-a-url"
      }).success
    ).toBe(false);

    expect(
      saveApplicationJobDescriptionSchema.safeParse({
        descriptionText: tooLarge,
        sourceType: JobDescriptionSourceType.MANUAL_PASTE
      }).success
    ).toBe(false);

    expect(
      createStandaloneJobDescriptionSchema.safeParse({
        companyName: "Acme",
        role: "Engineer",
        descriptionText: "Example",
        sourceType: JobDescriptionSourceType.JOB_BOARD,
        publishedAt: "2026-07-15",
        jobUrl: "https://example.com/jobs/1"
      }).success
    ).toBe(true);
  });
});
