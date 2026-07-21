import { promises as fs } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const FIELDGUIDE_COMPANY_NAME = "Fieldguide";
const FIELDGUIDE_ROLE_NAME = "Software Engineer (All Levels)";
const FIELDGUIDE_SOURCE_URL = "https://www.fieldguide.io/careers/software-engineer-all-levels";

function parseRgb(value: string) {
  const match = value.match(/\d+(?:\.\d+)?/g);
  if (!match || match.length < 3) {
    throw new Error(`Unable to parse RGB value: ${value}`);
  }

  return match.slice(0, 3).map((entry) => Number(entry));
}

function toLinearChannel(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: number[]) {
  const [red, green, blue] = rgb.map(toLinearChannel);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: number[], background: number[]) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

async function ensureFieldguideOpportunity(page: Page) {
  await page.goto("/jobs");
  if (
    (await page
      .getByRole("heading", { name: FIELDGUIDE_ROLE_NAME })
      .count()) > 0
  ) {
    return;
  }

  const fieldguideDescription = await fs.readFile(
    path.join(process.cwd(), "fixtures", "fieldguide-software-engineer-all-levels.txt"),
    "utf8"
  );

  await page.goto("/jobs/new");
  await page.getByRole("textbox", { name: "Company" }).fill(FIELDGUIDE_COMPANY_NAME);
  await page.getByRole("textbox", { name: "Role" }).fill(FIELDGUIDE_ROLE_NAME);
  await page.getByRole("textbox", { name: "Job URL" }).fill(FIELDGUIDE_SOURCE_URL);
  await page.getByRole("textbox", { name: "Opportunity source" }).fill("LinkedIn");
  await page.getByRole("textbox", { name: "Source URL" }).fill(FIELDGUIDE_SOURCE_URL);
  await page
    .getByRole("textbox", { name: "Source title" })
    .fill("Fieldguide Software Engineer (All Levels)");
  await page.getByRole("textbox", { name: "Publication date" }).fill("2026-07-18");
  await page.getByRole("textbox", { name: "Job description text" }).fill(fieldguideDescription);
  await page.getByRole("button", { name: "Save job description" }).click();
  await expect(page.getByText("Job description saved successfully.")).toBeVisible();
}

test("supports corrected shell navigation and Fieldguide discovery workflow", async ({ page }) => {
  test.setTimeout(60_000);
  const primaryNavigation = page.getByRole("navigation", { name: "Primary" });

  await page.goto("/");

  const primaryApplicationLink = page.getByRole("link", { name: "Open applications" }).first();
  await expect(primaryApplicationLink).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse jobs" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse documents" }).first()).toBeVisible();

  const stylesBefore = await primaryApplicationLink.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      color: style.color,
      backgroundColor: style.backgroundColor
    };
  });
  const foregroundBefore = parseRgb(stylesBefore.color);
  const backgroundBefore = parseRgb(stylesBefore.backgroundColor);
  expect(contrastRatio(foregroundBefore, backgroundBefore)).toBeGreaterThan(4.5);

  await primaryApplicationLink.click();
  await expect(page).toHaveURL(/\/applications$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);

  const stylesAfter = await primaryApplicationLink.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      color: style.color,
      backgroundColor: style.backgroundColor
    };
  });
  const foregroundAfter = parseRgb(stylesAfter.color);
  const backgroundAfter = parseRgb(stylesAfter.backgroundColor);
  expect(contrastRatio(foregroundAfter, backgroundAfter)).toBeGreaterThan(4.5);

  await ensureFieldguideOpportunity(page);
  await expect(page).toHaveURL(/\/jobs$/);

  const fieldguideCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: FIELDGUIDE_ROLE_NAME })
  }).first();
  await expect(fieldguideCard).toContainText("Fieldguide");
  await expect(fieldguideCard).toContainText(/No application linked|Application linked/);

  await Promise.all([
    page.waitForURL(/\/jobs\/[^/]+$/, { timeout: 15_000 }),
    fieldguideCard.getByRole("link", { name: "View job", exact: true }).click()
  ]);

  await page.getByRole("link", { name: "View current description" }).click();
  await expect(page).toHaveURL(/\/job-descriptions\/[^/]+$/);

  const parseButton = page.getByRole("button", { name: /Parse Job Description|Reparse with Current Parser/ });
  await expect(parseButton).toBeVisible();
  await parseButton.click();
  await expect(page.getByText(/Job description parsed successfully|existing parse was reused/i)).toBeVisible();
  await expect(page.getByText("m3.2.5")).toBeVisible();

  await page.getByRole("link", { name: /View Parsed Job Description/ }).click();
  await expect(page).toHaveURL(/\/analysis$/);
  await expect(page.getByText("m3.2.5")).toBeVisible();

  await page.getByRole("link", { name: /Review Requirements|View Confirmed Requirements/ }).click();
  await expect(page).toHaveURL(/\/requirements/);
  await expect(page.getByText("Requirement review")).toBeVisible();

  await Promise.all([
    page.waitForURL(/\/jobs$/, { timeout: 15_000 }),
    primaryNavigation.getByRole("link", { name: "Jobs" }).click()
  ]);

  await Promise.all([
    page.waitForURL(/\/documents$/, { timeout: 15_000 }),
    primaryNavigation.getByRole("link", { name: "Documents" }).click()
  ]);

  const artifactDetailLinks = page.getByRole("link", { name: "Artifact detail" });
  if ((await artifactDetailLinks.count()) > 0) {
    await expect(
      page.getByRole("link", { name: /Download (PDF|DOCX)/ }).first()
    ).toBeVisible();
    await artifactDetailLinks.first().click();
    await expect(page).toHaveURL(/\/documents\/[^/]+$/);
    await Promise.all([
      page.waitForURL(/\/jobs$/, { timeout: 15_000 }),
      primaryNavigation.getByRole("link", { name: "Jobs" }).click()
    ]);
  } else {
    await expect(
      page.getByRole("heading", { name: "No documents found" })
    ).toBeVisible();
  }

  await expect(page.getByText("Calendar")).toBeVisible();
  await expect(page.getByRole("link", { name: "Calendar" })).toHaveCount(0);

  await Promise.all([
    page.waitForURL(/\/health$/, { timeout: 15_000 }),
    page.getByRole("link", { name: "System Health" }).click()
  ]);

  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(primaryNavigation.getByRole("link", { name: "Today" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(primaryNavigation.getByRole("link", { name: "Applications" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(primaryNavigation.getByRole("link", { name: "Jobs" })).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/jobs");
  await expect(
    page.getByRole("heading", {
      name: "Browse saved opportunities and downstream workflow state"
    })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
});
