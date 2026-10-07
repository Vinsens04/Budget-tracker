import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
fs.mkdirSync("artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:3000");
  await page.getByRole("heading", { name: "Hello, Vinsens." }).waitFor();
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  console.log("Desktop loaded; adding transaction");
  await page
    .getByRole("button", { name: "Add transaction", exact: true })
    .first()
    .click();
  await page.getByRole("textbox", { name: "Quick add" }).fill("Starbucks 55k");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "Amount in Rupiah" })
      .inputValue(),
    "55000",
  );
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Transaction saved" })
    .waitFor();
  console.log("Transaction saved");
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "Transactions", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Search transactions" })
    .fill("Starbucks");
  await page
    .getByRole("button")
    .filter({ hasText: "Starbucks" })
    .first()
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("heading", { name: "No transactions here yet" })
    .waitFor();
  for (const name of ["Budgets", "Wallets", "Analytics", "Saving goals"]) {
    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("button", { name, exact: true })
      .click();
    await page.getByRole("heading", { name, exact: true, level: 1 }).waitFor();
  }
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "Wallets", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Transfer money", exact: true })
    .click();
  await page.getByLabel("Amount · Rp", { exact: true }).fill("50000");
  await page
    .getByRole("dialog", { name: "Transfer money", exact: true })
    .getByRole("button", { name: "Transfer money", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Transfer complete" })
    .waitFor();
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "Saving goals", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add contribution", exact: true })
    .first()
    .click();
  await page.getByLabel("Contribution · Rp", { exact: true }).fill("100000");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add contribution", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Contribution saved" })
    .waitFor();
  await page.getByRole("button", { name: "Open profile", exact: true }).click();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.screenshot({ path: "artifacts/dark.png", fullPage: true });
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  for (const name of [
    "Recurring transactions",
    "Financial calendar",
    "Monthly reports",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page
      .getByRole("button", { name: "Open profile", exact: true })
      .click();
  }
  await page
    .getByRole("navigation", { name: "Main navigation", exact: true })
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(250);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `overflow at ${width}`,
    );
    if (width === 390)
      await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
    await page
      .getByRole("navigation", { name: "Mobile navigation", exact: true })
      .getByRole("button", { name: "Add transaction", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Add transaction", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.keyboard.press("Escape");
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: quick entry, save/search/delete, main screens, transfer, contribution, theme, reports/calendar/recurring, and no horizontal overflow at 320/375/390/430px.",
  );
} finally {
  await browser.close();
}
