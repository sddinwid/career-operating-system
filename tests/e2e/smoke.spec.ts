import { expect, test } from "@playwright/test";

test("loads the application shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Browse active workflows across applications, jobs, and rendered documents"
    })
  ).toBeVisible();

  await expect(page.getByRole("link", { name: "Open applications" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "New application" }).first()).toBeVisible();
});
