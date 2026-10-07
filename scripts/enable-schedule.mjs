import pg from "pg";
import fs from "node:fs";
const connectionString = fs
  .readFileSync(".env.setup", "utf8")
  .trim()
  .replace(/^DATABASE_URL=/, "");
const db = new pg.Client({
  connectionString,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync("supabase/prod-ca-2021.crt", "utf8"),
  },
  connectionTimeoutMillis: 15000,
});
try {
  await db.connect();
  await db.query(
    "create extension if not exists pg_cron with schema pg_catalog",
  );
  const existing = await db.query(
    "select jobid from cron.job where jobname='saldo-recurring-hourly'",
  );
  if (!existing.rows.length)
    await db.query(
      "select cron.schedule('saldo-recurring-hourly','5 * * * *','select public.process_due_transactions()')",
    );
  console.log("Recurring transactions scheduled hourly.");
} catch (e) {
  console.error("Schedule setup failed:", e.code, e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
