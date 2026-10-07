export type Transaction = {
  id: string;
  type: "expense" | "income";
  amount: number;
  name: string;
  category: string;
  wallet: string;
  date: string;
  note: string;
  receipt?: string;
  recurringId?: string;
};
export type Wallet = {
  id: string;
  name: string;
  opening: number;
  archived: boolean;
};
export type Budget = {
  id: string;
  category: string;
  limit: number;
  threshold: number;
  month: string;
};
export type Goal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  date: string;
};
export type Recurring = {
  id: string;
  name: string;
  amount: number;
  category: string;
  wallet: string;
  type: "expense" | "income";
  frequency: "weekly" | "monthly" | "yearly";
  next: string;
  active: boolean;
};
export type Transfer = {
  id: string;
  from: string;
  to: string;
  amount: number;
  date: string;
};
export type Contribution = {
  id: string;
  goal: string;
  amount: number;
  date: string;
};
export type Settings = {
  visualTheme?: "light" | "dark" | "green" | "blue";
  customCategories?: CustomCategory[];
  onboardingComplete?: boolean;
  name: string;
  theme: "light" | "dark" | "system";
  defaultWallet: string;
  currency: "IDR";
  budgetAlerts: boolean;
  recurringAlerts: boolean;
  reportAlerts: boolean;
};
export type CustomCategory = {
  id: string;
  name: string;
  type: "expense" | "income";
};
export function availableCategories(
  state: FinanceState,
  type?: "expense" | "income",
) {
  const builtIn = categories.filter(
    (name) =>
      !type ||
      (type === "income"
        ? ["Salary", "Freelance", "Other"].includes(name)
        : !["Salary", "Freelance"].includes(name)),
  );
  return [
    ...new Set([
      ...builtIn,
      ...(state.settings.customCategories ?? [])
        .filter((c) => !type || c.type === type)
        .map((c) => c.name),
      ...state.transactions
        .filter((t) => !type || t.type === type)
        .map((t) => t.category),
    ]),
  ];
}
export function updateCategory(
  state: FinanceState,
  category: CustomCategory,
): FinanceState {
  const name = category.name.trim();
  if (!name || name.length > 60)
    throw new Error("Use a category name between 1 and 60 characters.");
  const custom = state.settings.customCategories ?? [];
  if (
    [
      ...categories,
      ...custom.filter((c) => c.id !== category.id).map((c) => c.name),
    ].some((n) => n.toLowerCase() === name.toLowerCase())
  )
    throw new Error("A category with this name already exists.");
  const previous = custom.find((c) => c.id === category.id);
  if (
    previous &&
    previous.type !== category.type &&
    categoryInUse(state, previous.name)
  )
    throw new Error("This category is in use. Keep its transaction type.");
  const rename = (value: string) =>
    previous && value === previous.name ? name : value;
  return {
    ...state,
    transactions: state.transactions.map((t) => ({
      ...t,
      category: rename(t.category),
    })),
    budgets: state.budgets.map((b) => ({ ...b, category: rename(b.category) })),
    recurring: state.recurring.map((r) => ({
      ...r,
      category: rename(r.category),
    })),
    settings: {
      ...state.settings,
      customCategories: [
        ...custom.filter((c) => c.id !== category.id),
        { ...category, name },
      ],
    },
  };
}
export function categoryInUse(state: FinanceState, name: string) {
  return [...state.transactions, ...state.budgets, ...state.recurring].some(
    (item) => item.category === name,
  );
}
export type FinanceState = {
  transactions: Transaction[];
  wallets: Wallet[];
  budgets: Budget[];
  goals: Goal[];
  recurring: Recurring[];
  transfers: Transfer[];
  contributions: Contribution[];
  settings: Settings;
};
export const categories = [
  "Food & Drinks",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Entertainment",
  "Health",
  "Other",
  "Salary",
  "Freelance",
];
export const colors = [
  "var(--category-1)",
  "var(--category-2)",
  "var(--category-3)",
  "var(--category-4)",
  "var(--category-5)",
  "var(--category-6)",
  "var(--category-7)",
];
export const money = (value: number) =>
  `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
export const shortMoney = (value: number) =>
  value >= 1000000
    ? `${(value / 1000000).toFixed(1)}m`
    : `${Math.round(value / 1000)}k`;
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const monthOf = (date: string) => date.slice(0, 7);
export const uid = () => crypto.randomUUID();
export function walletBalance(state: FinanceState, id: string) {
  return (
    (state.wallets.find((w) => w.id === id)?.opening ?? 0) +
    state.transactions
      .filter((t) => t.wallet === id)
      .reduce(
        (sum, t) => sum + (t.type === "income" ? t.amount : -t.amount),
        0,
      ) +
    state.transfers.reduce(
      (sum, t) =>
        sum + (t.to === id ? t.amount : 0) - (t.from === id ? t.amount : 0),
      0,
    )
  );
}
export function totals(transactions: Transaction[]) {
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((n, t) => n + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((n, t) => n + t.amount, 0);
  return {
    income,
    expense,
    saved: income - expense,
    rate: income ? ((income - expense) / income) * 100 : 0,
  };
}
export function parseQuick(
  text: string,
): { name: string; amount: number; category: string } | null {
  const match = text
    .trim()
    .match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|m|jt|juta)?$/i);
  if (!match) return null;
  const suffix = match[3]?.toLowerCase();
  const base = suffix
    ? Number(match[2].replace(",", "."))
    : Number(match[2].replace(/[.,]/g, ""));
  const amount = Math.round(
    base * (["m", "jt", "juta"].includes(suffix) ? 1000000 : suffix ? 1000 : 1),
  );
  if (!(amount > 0) || !Number.isSafeInteger(amount)) return null;
  const name = match[1].trim();
  const category = /grab|gojek|fuel|bensin|taxi|train/i.test(name)
    ? "Transport"
    : /netflix|spotify|cinema/i.test(name)
      ? "Entertainment"
      : /coffee|starbucks|lunch|dinner|kopi|food|restaurant/i.test(name)
        ? "Food & Drinks"
        : "Other";
  return { name, amount, category };
}
export function nextOccurrence(
  date: string,
  frequency: Recurring["frequency"],
) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day));
  if (frequency === "weekly") result.setUTCDate(day + 7);
  else {
    const targetMonth = frequency === "monthly" ? month : month - 1;
    const targetYear = frequency === "yearly" ? year + 1 : year;
    const lastDay = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0),
    ).getUTCDate();
    result.setTime(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
  }
  return result.toISOString().slice(0, 10);
}
export function processRecurring(
  state: FinanceState,
  date: string,
): FinanceState {
  const transactions = [...state.transactions];
  const recurring = state.recurring.map((rule) => {
    if (!rule.active) return rule;
    let next = rule.next;
    let count = 0;
    while (next <= date && count < 1000) {
      const id = `recurring-${rule.id}-${next}`;
      if (!transactions.some((t) => t.id === id))
        transactions.push({
          id,
          type: rule.type,
          amount: rule.amount,
          name: rule.name,
          category: rule.category,
          wallet: rule.wallet,
          date: next,
          note: "Scheduled transaction",
          recurringId: rule.id,
        });
      next = nextOccurrence(next, rule.frequency);
      count++;
    }
    return { ...rule, next };
  });
  return { ...state, transactions, recurring };
}
export function validateTransfer(
  state: FinanceState,
  from: string,
  to: string,
  amount: number,
) {
  if (from === to) throw new Error("Choose two different wallets.");
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("Enter a positive whole Rupiah amount.");
  if (
    [from, to].some(
      (id) => !state.wallets.some((w) => w.id === id && !w.archived),
    )
  )
    throw new Error("Choose active wallets.");
  if (walletBalance(state, from) < amount)
    throw new Error("This wallet does not have enough funds.");
}
export function categoryTotals(transactions: Transaction[]) {
  return [...new Set([...categories, ...transactions.map((t) => t.category)])]
    .map((name, i) => ({
      name,
      value: transactions
        .filter((t) => t.type === "expense" && t.category === name)
        .reduce((n, t) => n + t.amount, 0),
      color: colors[i % colors.length],
    }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
}
export function seedState(): FinanceState {
  const current = today();
  const month = current.slice(0, 7);
  const previousDate = new Date(`${month}-01T00:00:00Z`);
  previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const previous = previousDate.toISOString().slice(0, 7);
  const day = Number(current.slice(8));
  const rows: [string, number, string, number][] = [
    ["Morning coffee", 35000, "Food & Drinks", day],
    ["Grab ride", 28000, "Transport", day],
    ["Weekly groceries", 365000, "Food & Drinks", Math.max(1, day - 1)],
    ["Uniqlo essentials", 480000, "Shopping", Math.max(1, day - 1)],
    ["Internet bill", 350000, "Bills & Utilities", Math.max(1, day - 2)],
    ["Dinner with friends", 450000, "Food & Drinks", Math.max(1, day - 3)],
    ["Fuel top-up", 492000, "Transport", Math.max(1, day - 3)],
    ["Netflix", 186000, "Entertainment", Math.max(1, day - 4)],
    ["Electricity", 314000, "Bills & Utilities", Math.max(1, day - 4)],
    ["Lunch break", 50000, "Food & Drinks", Math.max(1, day - 2)],
  ];
  const transactions: Transaction[] = rows.map(
    ([name, amount, category, d], i) => ({
      id: `sample-${i}`,
      type: "expense",
      name,
      amount,
      category,
      wallet: i % 3 === 0 ? "gopay" : "bca",
      date: `${month}-${String(d).padStart(2, "0")}`,
      note: "",
    }),
  );
  transactions.push({
    id: "salary",
    type: "income",
    amount: 7000000,
    name: "Monthly salary",
    category: "Salary",
    wallet: "bca",
    date: `${month}-01`,
    note: "",
  });
  transactions.push(
    {
      id: "previous-income",
      type: "income",
      amount: 3100000,
      name: "Previous month income",
      category: "Salary",
      wallet: "bca",
      date: `${previous}-01`,
      note: "",
    },
    {
      id: "previous-expense",
      type: "expense",
      amount: 3100000,
      name: "Previous month essentials",
      category: "Other",
      wallet: "bca",
      date: `${previous}-15`,
      note: "",
    },
  );
  return {
    transactions,
    wallets: [
      { id: "bca", name: "BCA", opening: 0, archived: false },
      { id: "gopay", name: "GoPay", opening: 0, archived: false },
      { id: "cash", name: "Cash", opening: 0, archived: false },
    ],
    budgets: [
      {
        id: "b1",
        category: "Food & Drinks",
        limit: 1200000,
        threshold: 75,
        month,
      },
      { id: "b2", category: "Transport", limit: 750000, threshold: 75, month },
      { id: "b3", category: "Shopping", limit: 650000, threshold: 75, month },
      {
        id: "b4",
        category: "Bills & Utilities",
        limit: 900000,
        threshold: 90,
        month,
      },
      {
        id: "b5",
        category: "Entertainment",
        limit: 500000,
        threshold: 75,
        month,
      },
    ],
    goals: [
      {
        id: "g1",
        name: "A new MacBook",
        target: 20000000,
        saved: 8500000,
        date: "2027-06-01",
      },
      {
        id: "g2",
        name: "Japan getaway",
        target: 15000000,
        saved: 4200000,
        date: "2027-04-01",
      },
    ],
    recurring: [
      {
        id: "r1",
        name: "Netflix",
        amount: 186000,
        category: "Entertainment",
        wallet: "bca",
        type: "expense",
        frequency: "monthly",
        next: nextOccurrence(`${month}-03`, "monthly"),
        active: true,
      },
      {
        id: "r2",
        name: "Monthly salary",
        amount: 7000000,
        category: "Salary",
        wallet: "bca",
        type: "income",
        frequency: "monthly",
        next: nextOccurrence(`${month}-01`, "monthly"),
        active: true,
      },
    ],
    transfers: [
      {
        id: "sample-transfer-1",
        from: "bca",
        to: "gopay",
        amount: 1307000,
        date: `${month}-01`,
      },
      {
        id: "sample-transfer-2",
        from: "bca",
        to: "cash",
        amount: 150000,
        date: `${month}-01`,
      },
    ],
    contributions: [],
    settings: {
      name: "guess",
      theme: "system",
      defaultWallet: "bca",
      currency: "IDR",
      budgetAlerts: true,
      recurringAlerts: true,
      reportAlerts: true,
    },
  };
}
export function emptyState(name: string): FinanceState {
  const walletId = uid();
  return {
    transactions: [],
    wallets: [{ id: walletId, name: "Cash", opening: 0, archived: false }],
    budgets: [],
    goals: [],
    recurring: [],
    transfers: [],
    contributions: [],
    settings: {
      name,
      theme: "system",
      defaultWallet: walletId,
      currency: "IDR",
      budgetAlerts: true,
      recurringAlerts: true,
      reportAlerts: true,
    },
  };
}
