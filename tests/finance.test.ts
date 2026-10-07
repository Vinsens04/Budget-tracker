import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseQuick,
  walletBalance,
  totals,
  validateTransfer,
  nextOccurrence,
  processRecurring,
  seedState,
  availableCategories,
  updateCategory,
  categoryTotals,
  categoryInUse,
  emptyState,
  type FinanceState,
} from "../src/lib/finance.ts";
test("quick entry handles Indonesian currency suffixes and grouping", () => {
  assert.deepEqual(parseQuick("Starbucks 55k"), {
    name: "Starbucks",
    amount: 55000,
    category: "Food & Drinks",
  });
  assert.equal(parseQuick("Grab 28rb")?.amount, 28000);
  assert.equal(parseQuick("Project 1,5jt")?.amount, 1500000);
  assert.equal(parseQuick("Coffee 55.000")?.amount, 55000);
  assert.equal(parseQuick("Invalid zero 0"), null);
  assert.equal(parseQuick("No amount"), null);
});
test("custom category renames preserve every linked record and analytics totals", () => {
  let state = seedState();
  state = updateCategory(state, {
    id: "custom",
    name: "Education",
    type: "expense",
  });
  state.transactions.push({
    ...state.transactions[0],
    id: "school",
    category: "Education",
    amount: 500000,
  });
  state.budgets.push({
    id: "school-budget",
    category: "Education",
    limit: 1000000,
    threshold: 75,
    month: "2026-10",
  });
  state.recurring.push({
    ...state.recurring[0],
    id: "school-rule",
    category: "Education",
  });
  assert(availableCategories(state, "expense").includes("Education"));
  assert(!availableCategories(state, "income").includes("Education"));
  assert(categoryInUse(state, "Education"));
  assert.throws(() =>
    updateCategory(state, { id: "custom", name: "Education", type: "income" }),
  );
  state = updateCategory(state, {
    id: "custom",
    name: "Learning",
    type: "expense",
  });
  assert.equal(
    state.transactions.find((t) => t.id === "school")?.category,
    "Learning",
  );
  assert.equal(
    state.budgets.find((b) => b.id === "school-budget")?.category,
    "Learning",
  );
  assert.equal(
    state.recurring.find((r) => r.id === "school-rule")?.category,
    "Learning",
  );
  assert.equal(
    categoryTotals(state.transactions).find((c) => c.name === "Learning")
      ?.value,
    500000,
  );
  assert.throws(() =>
    updateCategory(state, {
      id: "duplicate",
      name: "learning",
      type: "expense",
    }),
  );
  assert.throws(() =>
    updateCategory(state, { id: "duplicate", name: "Salary", type: "expense" }),
  );
});
test("new accounts have a valid default wallet and no sample income", () => {
  const state = emptyState("Friend");
  assert.equal(state.settings.defaultWallet, state.wallets[0].id);
  assert.deepEqual(totals(state.transactions), {
    income: 0,
    expense: 0,
    saved: 0,
    rate: 0,
  });
});
test("wallet transfer preserves total balance and income/expense totals", () => {
  const state = seedState();
  const from = state.wallets[0].id,
    to = state.wallets[1].id;
  const before = state.wallets.reduce(
    (sum, w) => sum + walletBalance(state, w.id),
    0,
  );
  validateTransfer(state, from, to, 100000);
  const changed: FinanceState = {
    ...state,
    transfers: [
      ...state.transfers,
      { id: "transfer", from, to, amount: 100000, date: "2026-10-07" },
    ],
  };
  assert.equal(
    changed.wallets.reduce((sum, w) => sum + walletBalance(changed, w.id), 0),
    before,
  );
  assert.deepEqual(totals(changed.transactions), totals(state.transactions));
  assert.equal(
    walletBalance(changed, from),
    walletBalance(state, from) - 100000,
  );
  assert.equal(walletBalance(changed, to), walletBalance(state, to) + 100000);
  assert.throws(() => validateTransfer(state, from, from, 100));
  assert.throws(() => validateTransfer(state, from, to, 999999999));
});
test("recurring schedule handles month ends and leap years", () => {
  assert.equal(nextOccurrence("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(nextOccurrence("2024-02-29", "yearly"), "2025-02-28");
  assert.equal(nextOccurrence("2026-12-30", "weekly"), "2027-01-06");
});
test("due recurring items are idempotent with multiple catch-up dates", () => {
  const base = seedState();
  const state = {
    ...base,
    transactions: [],
    recurring: [
      {
        id: "rule",
        name: "Subscription",
        amount: 100000,
        category: "Entertainment",
        wallet: "bca",
        type: "expense" as const,
        frequency: "monthly" as const,
        next: "2026-08-01",
        active: true,
      },
    ],
  };
  const processed = processRecurring(state, "2026-10-07");
  assert.equal(processed.transactions.length, 3);
  assert.equal(processed.recurring[0].next, "2026-11-01");
  assert.deepEqual(processRecurring(processed, "2026-10-07"), processed);
});
test("sample balances are grounded in recorded transactions", () => {
  const state = seedState();
  assert.equal(
    state.wallets.reduce((sum, w) => sum + walletBalance(state, w.id), 0),
    4250000,
  );
  assert.equal(
    totals(state.transactions.filter((t) => t.id.startsWith("sample-")))
      .expense,
    2750000,
  );
});
