import { expect, test } from "@playwright/test";

test("loads the fixture import wizard and produces a preview", async ({ page }) => {
  await page.goto("/imports");

  await expect(
    page.getByRole("heading", { name: "Fixture-driven Excel import wizard" })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tracker" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "Preview workbook" }).click();

  await expect(page.getByText("Workbook preview prepared.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm and import" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reconciliation preview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Raw preview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reconciled rows" })).toBeVisible();
});
