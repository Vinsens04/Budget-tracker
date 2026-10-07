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
const secret = fs.readFileSync(".env.qa", "utf8").trim().split("=")[1];
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
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15000);
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
