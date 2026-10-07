import pg from "pg";
import fs from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
const userA = randomUUID(),
  userB = randomUUID();
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const state = {
  transactions: [],
  wallets: [{ id: "wallet", name: "Cash", opening: 500000, archived: false }],
  budgets: [],
  goals: [],
  recurring: [
    {
      id: "r",
      name: "Test subscription",
      amount: 1000,
      category: "Entertainment",
      wallet: "wallet",
      type: "expense",
      frequency: "monthly",
      next: date,
      active: true,
    },
  ],
  transfers: [],
  contributions: [],
  settings: {
    name: "Test",
    currency: "IDR",
    theme: "system",
    defaultWallet: "wallet",
    budgetAlerts: true,
    recurringAlerts: true,
    reportAlerts: true,
  },
};
try {
  await db.connect();
  await db.query("begin");
  await db.query("insert into auth.users(id) values($1),($2)", [userA, userB]);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [userA]);
  await db.query("set local role authenticated");
  let result = await db.query(
    "select public.save_finance_workspace($1::jsonb,0) revision",
    [JSON.stringify(state)],
  );
  assert.equal(Number(result.rows[0].revision), 1);
  await db.query("savepoint invalid");
  await assert.rejects(
    db.query("select public.save_finance_workspace($1::jsonb,0)", [
      JSON.stringify(state),
    ]),
    (error) => error.code === "23505",
  );
  await db.query("rollback to invalid");
  result = await db.query("select name from public.wallets");
  assert.equal(result.rows[0].name, "Cash");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [userB]);
  assert.equal(
    (await db.query("select * from public.finance_workspaces")).rows.length,
    0,
  );
  assert.equal((await db.query("select * from public.wallets")).rows.length, 0);
  await db.query("reset role");
  await db.query("select public.process_due_transactions()");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [userA]);
  await db.query("set local role authenticated");
  result = await db.query(
    "select state,revision from public.finance_workspaces",
  );
  assert.equal(result.rows[0].state.transactions.length, 1);
  assert.equal(Number(result.rows[0].revision), 2);
  await db.query("reset role");
  await db.query("select public.process_due_transactions()");
  await db.query("set local role authenticated");
  assert.equal(
    (await db.query("select * from public.transactions")).rows.length,
    1,
  );
  await db.query("rollback");
  console.log(
    "PASS: authenticated save, conflict detection, relational views, cross-user isolation, recurring catch-up and idempotency. All test data rolled back.",
  );
} catch (e) {
  await db.query("rollback").catch(() => {});
  console.error("Verification failed:", e.code || e.name, e.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
