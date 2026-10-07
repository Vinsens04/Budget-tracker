import pg from "pg";
import fs from "node:fs";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const { connectionString } = JSON.parse(input);
const migration = process.argv[2];
if (!/^supabase\/migrations\/\d{3}_[a-z_]+\.sql$/.test(migration ?? ""))
  throw new Error("Specify a workspace migration file.");
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
  await client.query(fs.readFileSync(migration, "utf8"));
  await client.query("commit");
  console.log("Applied:", migration);
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error("Migration failed:", e.code ?? e.name);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
