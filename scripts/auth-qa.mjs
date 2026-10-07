import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
async function readSecret() {
  if (!process.argv.includes("--stdin-secret"))
    return fs.readFileSync(".env.qa", "utf8").trim().split("=")[1];
  process.stdin.setRawMode?.(true);
  process.stdout.write("Ready for temporary QA credential on stdin.\n");
  const result = await new Promise((resolve) => {
    let input = "";
    const receive = (chunk) => {
      input += chunk.toString();
      if (/[\r\n]/.test(input)) {
        process.stdin.off("data", receive);
        process.stdin.setRawMode?.(false);
        process.stdin.pause();
        resolve(JSON.parse(input.trim()).secret);
      }
    };
    process.stdin.on("data", receive);
    process.stdin.resume();
  });
  return result;
}
const secret = await readSecret();
console.log("QA credential received; creating temporary account.");
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicClient = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = `saldo-qa-${randomUUID()}@example.com`,
  password = `Qa-${randomUUID()}-9!`;
let userId, browser;
try {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "QA Test" },
  });
  if (created.error)
    throw new Error(
      "Could not create temporary test account: " + created.error.message,
    );
  userId = created.data.user.id;
  console.log("Temporary account created; checking mobile sign-in.");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
  page.on("response", async (response) => {
    if (response.url().includes("/rpc/save_finance_workspace")) {
      const body = await response.json().catch(() => null);
      console.log(
        "Workspace save response:",
        response.status(),
        body?.code ?? "saved",
      );
    }
  });
  await page.goto("http://127.0.0.1:3000");
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await page.getByText(email, { exact: true }).waitFor();
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await nav.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Set up my space" }).click();
  await page.getByLabel("First wallet", { exact: true }).fill("Daily wallet");
  await page
    .getByLabel("Current balance · Rp", { exact: true })
    .fill("1000000");
  await page
    .getByLabel("Food & Drinks budget this month · Rp", { exact: true })
    .fill("200000");
  await page.getByRole("button", { name: "Start using Saldo" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your space is ready" })
    .waitFor();
  await nav.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Manage categories" }).click();
  await page.getByLabel("Category name", { exact: true }).fill("Education");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await page.getByRole("button", { name: "Edit Education" }).waitFor();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "Amount in Rupiah" })
    .fill("12000");
  await page
    .getByLabel("Transaction name", { exact: true })
    .fill("Persistence check");
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Transaction saved" })
    .waitFor();
  await page.reload();
  await page.getByText(email, { exact: true }).waitFor();
  await nav.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("heading", { name: "Hello, QA Test." }).waitFor();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Activity", exact: true })
    .click();
  await page
    .getByRole("button")
    .filter({ hasText: "Persistence check" })
    .first()
    .waitFor();
  console.log(
    "PASS: real email/password sign-in and transaction persistence after reload.",
  );
  const login = await publicClient.auth.signInWithPassword({ email, password });
  assert.equal(login.error, null);
  for (const theme of ["light", "dark", "green", "blue"]) {
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
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    const savedTheme = await publicClient
      .from("finance_workspaces")
      .select("state")
      .eq("user_id", userId)
      .single();
    assert.equal(savedTheme.error, null);
    assert.equal(savedTheme.data.state.settings.visualTheme, theme);
    assert.equal(
      savedTheme.data.state.settings.theme,
      theme === "light" ? "light" : "dark",
    );
  }
  await page.reload();
  await nav.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByText(email, { exact: true }).waitFor();
  assert.equal(await page.locator("html").getAttribute("data-palette"), "blue");
  assert.equal(
    await page.getByLabel("Appearance", { exact: true }).inputValue(),
    "blue",
  );
  console.log(
    "PASS: all four themes saved to the account; Blue restored after reload.",
  );
  const initial = await publicClient
    .from("finance_workspaces")
    .select("state,revision")
    .eq("user_id", userId)
    .single();
  assert.equal(initial.error, null);
  assert.equal(initial.data.state.wallets[0].name, "Daily wallet");
  assert.equal(initial.data.state.settings.onboardingComplete, true);
  assert.equal(
    initial.data.state.settings.customCategories[0].name,
    "Education",
  );
  await nav
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page
    .getByLabel("Transaction name", { exact: true })
    .fill("Conflict check");
  await page
    .getByRole("spinbutton", { name: "Amount in Rupiah" })
    .fill("23000");
  const external = {
    ...initial.data.state,
    transactions: [
      ...initial.data.state.transactions,
      {
        ...initial.data.state.transactions[0],
        id: randomUUID(),
        name: "Saved in another tab",
        amount: 9000,
      },
    ],
  };
  let releaseSave, saveIntercepted;
  const gate = new Promise((resolve) => {
    releaseSave = resolve;
  });
  const intercepted = new Promise((resolve) => {
    saveIntercepted = resolve;
  });
  await page.route("**/rest/v1/rpc/save_finance_workspace", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    saveIntercepted();
    console.log("Conflict request intercepted.");
    await gate;
    await route.continue();
  });
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await intercepted;
  const externalSave = await publicClient.rpc("save_finance_workspace", {
    new_state: external,
    expected_revision: initial.data.revision,
  });
  assert.equal(externalSave.error, null);
  console.log("External revision saved; releasing pending request.");
  releaseSave();
  await page
    .getByText(
      "Your finances changed elsewhere. The latest data is loaded; review your change and save again.",
      { exact: true },
    )
    .waitFor({ timeout: 45000 });
  await page.unroute("**/rest/v1/rpc/save_finance_workspace");
  assert.equal(
    await page.getByLabel("Transaction name", { exact: true }).inputValue(),
    "Conflict check",
  );
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const merged = await publicClient
    .from("finance_workspaces")
    .select("state")
    .eq("user_id", userId)
    .single();
  assert(
    merged.data.state.transactions.some(
      (t) => t.name === "Saved in another tab",
    ),
  );
  assert(
    merged.data.state.transactions.some((t) => t.name === "Conflict check"),
  );
  await nav
    .getByRole("button", { name: "Add transaction", exact: true })
    .click();
  await page
    .getByLabel("Transaction name", { exact: true })
    .fill("Offline check");
  await page
    .getByRole("spinbutton", { name: "Amount in Rupiah" })
    .fill("11000");
  await page.context().setOffline(true);
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await page
    .getByText(
      "You’re offline. Reconnect, then save again. Your form is still here.",
      { exact: true },
    )
    .waitFor();
  await page.context().setOffline(false);
  await page
    .getByRole("button", { name: "Save transaction", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  console.log(
    "PASS: first-use setup, custom category persistence, conflict recovery without losing other-tab changes, and offline draft recovery.",
  );
  const path = `${userId}/qa.png`;
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
    "base64",
  );
  const upload = await publicClient.storage
    .from("receipts")
    .upload(path, png, { contentType: "image/png" });
  assert.equal(upload.error, null);
  const signed = await publicClient.storage
    .from("receipts")
    .createSignedUrl(path, 60);
  assert.equal(signed.error, null);
  assert.equal((await fetch(signed.data.signedUrl)).status, 200);
  await publicClient.storage.from("receipts").remove([path]);
  console.log("PASS: private receipt upload and signed access.");
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByText("Explore Saldo with sample finances", { exact: true })
    .waitFor();
  console.log("PASS: sign-out restores isolated demo.");
} catch (e) {
  console.error("Auth verification failed:", e.message);
  if (browser) {
    for (const context of browser.contexts())
      for (const page of context.pages()) {
        console.error(
          "Visible form errors:",
          await page.locator(".form-error").allTextContents(),
        );
        console.error("Dialog count:", await page.getByRole("dialog").count());
        await page.screenshot({ path: "artifacts/auth-failure.png" });
      }
  }
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (userId) {
    const result = await admin.auth.admin.deleteUser(userId);
    if (result.error) {
      console.error("Temporary account cleanup failed");
      process.exitCode = 1;
    } else console.log("Temporary account and its finances removed.");
  }
}
