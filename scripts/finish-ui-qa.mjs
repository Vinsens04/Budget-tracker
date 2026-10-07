import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3000/?view=profile&month=2026-09");
  await page
    .getByRole("heading", { name: "Profile", exact: true, level: 1 })
    .waitFor();
  await page.getByRole("button", { name: "Manage categories" }).click();
  await page.getByLabel("Category name", { exact: true }).fill("Education");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByRole("button", { name: "Edit Education" }).waitFor();
  await page.getByLabel("Category name", { exact: true }).fill("education");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page
    .getByText("A category with this name already exists.", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  const nav = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await nav.getByRole("button", { name: "Transactions", exact: true }).click();
  assert(new URL(page.url()).searchParams.get("view") === "transactions");
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .first()
    .click();
  await page.getByLabel("Transaction name", { exact: true }).fill("Course fee");
  await page
    .getByRole("spinbutton", { name: "Amount in Rupiah" })
    .fill("500000");
  await page.getByLabel("Category", { exact: true }).click();
  await page
    .getByRole("dialog", { name: "Choose category" })
    .getByRole("button", { name: "Education", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.goBack();
  await page
    .getByRole("heading", { name: "Profile", exact: true, level: 1 })
    .waitFor();
  await page.getByRole("button", { name: "Manage categories" }).click();
  await page.getByRole("button", { name: "Delete Education" }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "This category is used" })
    .waitFor();
  await page.getByRole("button", { name: "Edit Education" }).click();
  await page.getByLabel("Category name", { exact: true }).fill("Learning");
  await page
    .getByRole("button", { name: "Save category", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit Learning" }).waitFor();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await nav.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await page.getByText("Learning", { exact: true }).first().waitFor();
  assert.equal(new URL(page.url()).searchParams.get("month"), "2026-10");
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => (document.documentElement.dataset.theme = value),
      theme,
    );
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page
        .getByRole("navigation", { name: "Mobile navigation" })
        .getByRole("button", { name: "Profile", exact: true })
        .click();
      await page.getByRole("button", { name: "Manage categories" }).click();
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('[role="dialog"]')).every(
          (el) => getComputedStyle(el).opacity === "1",
        ),
      );
      await page.screenshot({
        path: `artifacts/categories-${theme}-${width}.png`,
      });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: custom category create/duplicate validation/use/rename/delete protection, analytics integration, bookmarked navigation, Back, and light/dark mobile layout.",
  );
} finally {
  await browser.close();
}
