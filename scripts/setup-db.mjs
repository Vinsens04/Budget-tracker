import pg from "pg";
import fs from "node:fs";
const filename = process.env.SALDO_DB_ENV || ".env.setup";
const connectionString = fs
  .readFileSync(filename, "utf8")
  .trim()
  .replace(/^DATABASE_URL=/, "");
const client = new pg.Client({
  connectionString,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync("supabase/prod-ca-2021.crt", "utf8"),
  },
  connectionTimeoutMillis: 15000,
});
try {
  await client.connect();
  await client.query("begin");
  for (const migration of [
    "supabase/migrations/001_finance.sql",
    "supabase/migrations/002_recurring.sql",
    "supabase/migrations/003_revision_conflicts.sql",
  ])
    await client.query(fs.readFileSync(migration, "utf8"));
  await client.query("commit");
  console.log("Database and private receipt storage initialized.");
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(
    "Setup failed:",
    error.code || error.name,
    error.message?.replace(connectionString, "[connection redacted]"),
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
