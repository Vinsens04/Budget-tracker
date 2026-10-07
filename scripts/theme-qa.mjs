import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
fs.mkdirSync("artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.setDefaultTimeout(20000);
const themes = ["light", "dark", "green", "blue"];
const expectedPalette = (theme) =>
  theme === "green" || theme === "blue" ? theme : "neutral";
async function checkLayout() {
  await page.waitForFunction(
    () =>
      document.documentElement.scrollWidth <= innerWidth &&
      [...document.querySelectorAll(".recharts-wrapper")].every(
        (el) =>
          el.getBoundingClientRect().width <=
          el.closest(".recharts-responsive-container").getBoundingClientRect()
            .width +
            1,
      ),
  );
}
try {
  await page.goto("http://127.0.0.1:3000");
  await page.getByRole("heading", { name: "Hello, Vinsens." }).waitFor();
  for (const theme of themes) {
    await page
      .getByRole("button", { name: "Change theme", exact: true })
      .click();
    const option = page.getByRole("button", {
      name: `${theme[0].toUpperCase()}${theme.slice(1)} theme`,
      exact: true,
    });
    await option.click();
    await page.waitForFunction(
      (value) => localStorage.getItem("saldo.visual-theme") === value,
      theme,
    );
    assert.equal(await option.getAttribute("aria-pressed"), "true");
    assert.equal(
      await page.locator("html").getAttribute("data-palette"),
      expectedPalette(theme),
    );
    assert.equal(
      await page.locator("html").getAttribute("data-theme"),
      theme === "dark" ? "dark" : "light",
    );
    await page.waitForTimeout(350);
    await page.screenshot({ path: `artifacts/theme-${theme}-picker.png` });
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.fonts.ready);
    await checkLayout();
    await page.screenshot({ path: `artifacts/theme-${theme}-desktop.png` });
    await page.reload();
    await page.getByRole("heading", { name: "Hello, Vinsens." }).waitFor();
    assert.equal(
      await page.locator("html").getAttribute("data-palette"),
      expectedPalette(theme),
    );
    await page
      .getByRole("button", { name: "Open profile", exact: true })
      .click();
    assert.equal(
      await page.getByLabel("Appearance", { exact: true }).inputValue(),
      theme,
    );
    await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .getByRole("button", { name: "Overview", exact: true })
      .click();
  }
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of themes) {
      await page
        .getByRole("button", { name: "Change theme", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: `${theme[0].toUpperCase()}${theme.slice(1)} theme`,
          exact: true,
        })
        .click();
      await page.waitForFunction(
        (value) => localStorage.getItem("saldo.visual-theme") === value,
        theme,
      );
      await checkLayout();
      if (width === 390) await page.waitForTimeout(350);
      if (width === 390)
        await page.screenshot({
          path: `artifacts/theme-${theme}-mobile-picker.png`,
        });
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await checkLayout();
      if (width === 390)
        await page.screenshot({ path: `artifacts/theme-${theme}-mobile.png` });
    }
  }
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Profile", exact: true })
    .click();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  await page.reload();
  await page.getByLabel("Appearance", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Appearance", { exact: true }).inputValue(),
    "dark",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: four palettes, selected state, profile switching, device persistence, responsive layout at 320/390/768px, and no page errors.",
  );
} finally {
  await browser.close();
}
