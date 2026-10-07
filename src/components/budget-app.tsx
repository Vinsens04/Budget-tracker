"use client";
import { useState, useMemo, useEffect } from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import { AnimatedAmount } from "./animated-amount";
import {
  Wallet as WalletIcon,
  LayoutDashboard,
  ArrowLeftRight,
  Plus,
  ChartNoAxesCombined,
  UserRound,
  Target,
  CalendarDays,
  Repeat,
  FileChartColumn,
  Bell,
  ChevronRight,
  ChevronLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Search,
  SlidersHorizontal,
  Download,
  Settings,
  LogOut,
  Sun,
  Moon,
  Ellipsis,
  Check,
  Trash2,
  Copy,
  Pencil,
  Landmark,
  ShieldCheck,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  type LucideIcon,
} from "lucide-react";
import { useFinance } from "@/lib/use-finance";
import {
  categories,
  availableCategories,
  categoryTotals,
  colors,
  money,
  monthOf,
  totals,
  walletBalance,
  today,
  uid,
  validateTransfer,
  type FinanceState,
  type Transaction,
  type Wallet,
  type Budget,
  type Goal,
  type Recurring,
} from "@/lib/finance";
import { supabase } from "@/lib/supabase";
import {
  CategoryIcon,
  Field,
  Progress,
  Segmented,
  Sheet,
  TransactionList,
} from "./ui";
import {
  CategoryChart,
  SpendingChart,
  ComparisonChart,
  type Period,
} from "./charts";
import TransactionForm from "./transaction-form";
import { CategoryManager, FirstSetup } from "./setup-tools";
type Page =
  | "Overview"
  | "Transactions"
  | "Budgets"
  | "Wallets"
  | "Analytics"
  | "Saving goals"
  | "Recurring"
  | "Calendar"
  | "Reports"
  | "Profile";
const navigation: { name: Page; icon: LucideIcon }[] = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Transactions", icon: ArrowLeftRight },
  { name: "Budgets", icon: WalletIcon },
  { name: "Wallets", icon: Landmark },
  { name: "Analytics", icon: ChartNoAxesCombined },
  { name: "Saving goals", icon: Target },
];
const surfaceVariants = {
  hidden: (reduced: boolean) => ({ opacity: 0, y: reduced ? 0 : 10 }),
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, bounce: 0, duration: 0.34 },
  },
};
type Editor =
  | { kind: "budget"; item?: Budget }
  | { kind: "wallet"; item?: Wallet }
  | { kind: "goal"; item?: Goal }
  | { kind: "recurring"; item?: Recurring }
  | { kind: "transfer" }
  | { kind: "contribute"; item: Goal };
const monthLabel = (month: string) =>
  new Date(month + "-01T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
function offsetMonth(month: string, offset: number) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}
function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function BudgetApp() {
  const reduced = useReducedMotion();
  const { state, user, busy, error, offline, commit, reload, configured } =
    useFinance();
  const [page, setPage] = useState<Page>("Overview");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [period, setPeriod] = useState<Period>("Month");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [auth, setAuth] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"All" | "Expense" | "Income">("All");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [walletFilter, setWalletFilter] = useState("All wallets");
  const [dateFilter, setDateFilter] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [calendarDate, setCalendarDate] = useState(today());
  const [hidden, setHidden] = useState(false);
  const [categoryManager, setCategoryManager] = useState(false);
  const [setup, setSetup] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  useEffect(() => {
    const restore = () => {
      const query = new URLSearchParams(window.location.search);
      const pages: Page[] = [
        "Overview",
        "Transactions",
        "Budgets",
        "Wallets",
        "Analytics",
        "Saving goals",
        "Recurring",
        "Calendar",
        "Reports",
        "Profile",
      ];
      const next = pages.find(
        (p) => p.toLowerCase().replaceAll(" ", "-") === query.get("view"),
      );
      setPage(next ?? "Overview");
      const value = query.get("month");
      setMonth(
        value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
          ? value
          : today().slice(0, 7),
      );
      setUrlReady(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    if (!urlReady) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", page.toLowerCase().replaceAll(" ", "-"));
    url.searchParams.set("month", month);
    window.history.replaceState(null, "", url);
  }, [page, month, urlReady]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("recovery") === "1")
      setAuth(true);
  }, []);
  const notify = (message: string) => setToast(message);
  const save = async (next: FinanceState, message: string) => {
    await commit(next, state);
    notify(message);
  };
  const monthTx = useMemo(
    () => state?.transactions.filter((t) => monthOf(t.date) === month) ?? [],
    [state, month],
  );
  if (!state)
    return (
      <div className="loading-shell">
        {error ? (
          <div className="card">
            <h2>Let’s reconnect</h2>
            <p>{error}</p>
            <button className="primary" onClick={() => void reload()}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-balance" />
            <div className="skeleton skeleton-chart" />
          </>
        )}
      </div>
    );
  const summary = totals(monthTx);
  const previous = totals(
    state.transactions.filter(
      (t) => monthOf(t.date) === offsetMonth(month, -1),
    ),
  );
  const change = previous.expense
    ? ((summary.expense - previous.expense) / previous.expense) * 100
    : null;
  const walletNames = Object.fromEntries(
    state.wallets.map((w) => [w.id, w.name]),
  );
  const balance = state.wallets.reduce(
    (n, w) => n + walletBalance(state, w.id),
    0,
  );
  const budgets = state.budgets.filter((b) => b.month === month);
  const budgetTotal = budgets.reduce((n, b) => n + b.limit, 0);
  const used = budgetTotal ? (summary.expense / budgetTotal) * 100 : 0;
  const categoryData = categoryTotals(monthTx);
  const recent = [...monthTx]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 5);
  const alerts = state.settings.budgetAlerts
    ? budgets
        .map((b) => {
          const spent = monthTx
            .filter((t) => t.type === "expense" && t.category === b.category)
            .reduce((n, t) => n + t.amount, 0);
          const percent = (spent / b.limit) * 100;
          const threshold = [100, 90, 75, 50].find(
            (x) => percent >= x && x >= b.threshold,
          );
          return threshold
            ? {
                title: `${b.category} budget`,
                text: `You've used ${Math.round(percent)}% of your ${b.category.toLowerCase()} budget.`,
              }
            : null;
        })
        .filter((a) => a !== null)
    : [];
  const upcoming = state.recurring
    .filter((r) => r.active)
    .sort((a, b) => a.next.localeCompare(b.next));
  const allAlerts = [
    ...alerts,
    ...(state.settings.recurringAlerts
      ? upcoming
          .filter(
            (r) =>
              r.next <=
              new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          )
          .map((r) => ({
            title: r.name,
            text: `${money(r.amount)} is scheduled for ${r.next}.`,
          }))
      : []),
  ];
  const select = (next: Page) => {
    if (next !== page) {
      const url = new URL(window.location.href);
      url.searchParams.set("view", next.toLowerCase().replaceAll(" ", "-"));
      url.searchParams.set("month", month);
      window.history.pushState(null, "", url);
    }
    setPage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const transactionSave = async (t: Transaction) => {
    await save(
      {
        ...state,
        transactions: editing
          ? state.transactions.map((x) => (x.id === t.id ? t : x))
          : [...state.transactions, t],
      },
      editing ? "Transaction updated" : "Transaction saved",
    );
    setAdding(false);
    setEditing(undefined);
  };
  const budgetCard = (
    <motion.section
      variants={surfaceVariants}
      custom={!!reduced}
      className="card monthly-budget"
    >
      <div className="card-heading">
        <h2>Monthly budget</h2>
        <button
          className="icon-button"
          aria-label="Manage budgets"
          onClick={() => select("Budgets")}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="budget-plan-label">THIS MONTH’S SPENDING PLAN</div>
      <div className="budget-number">
        {money(summary.expense)} <small>of {money(budgetTotal)}</small>
      </div>
      <div className="budget-meter" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            className={
              budgetTotal > 0 && i < Math.min(24, Math.round((used * 24) / 100))
                ? "used"
                : ""
            }
          />
        ))}
      </div>
      <Progress value={used} />
      <div className="budget-foot">
        <span>{Math.round(used)}% used</span>
        <span>{money(Math.max(0, budgetTotal - summary.expense))} left</span>
      </div>
      <div className="budget-status">
        <span
          className="status-dot"
          style={{ background: used >= 90 ? "#b67550" : "#579a69" }}
        />
        {budgetTotal === 0
          ? "Set a budget to start planning"
          : used > 100
            ? "A little over your plan"
            : used >= 90
              ? "You’re close to your budget"
              : used > 70
                ? "Keep an eye on spending"
                : "Comfortably within your budget"}
      </div>
    </motion.section>
  );
  const spendingCard = (
    <motion.section
      variants={surfaceVariants}
      custom={!!reduced}
      className="card spending-card"
    >
      <div className="card-heading">
        <div>
          <h2>Spending overview</h2>
          <p>Your everyday, at a glance</p>
        </div>
        <Segmented
          options={["Week", "Month", "Year"]}
          value={period}
          onChange={setPeriod}
        />
      </div>
      <div className="chart-summary">
        <strong>
          {money(
            totals(
              period === "Year"
                ? state.transactions.filter((t) =>
                    t.date.startsWith(month.slice(0, 4)),
                  )
                : period === "Week"
                  ? state.transactions.filter(
                      (t) =>
                        t.date >=
                          new Date(Date.now() - 6 * 86400000)
                            .toISOString()
                            .slice(0, 10) && t.date <= today(),
                    )
                  : monthTx,
            ).expense,
          )}
        </strong>
        {period === "Month" && change !== null && (
          <span className={change <= 0 ? "comparison positive" : "comparison"}>
            {change <= 0 ? (
              <ArrowDownLeft size={14} />
            ) : (
              <ArrowUpRight size={14} />
            )}{" "}
            {Math.abs(change).toFixed(1)}% vs. last month
          </span>
        )}
      </div>
      <SpendingChart
        transactions={state.transactions}
        period={period}
        month={month}
      />
    </motion.section>
  );
  const goalsCard = (
    <motion.section
      variants={surfaceVariants}
      custom={!!reduced}
      className="card"
    >
      <div className="card-heading">
        <h2>On the horizon</h2>
        <button className="text-button" onClick={() => select("Saving goals")}>
          View all
        </button>
      </div>
      {state.goals.length ? (
        state.goals.slice(0, 2).map((g, i) => (
          <button
            className="mini-goal"
            key={g.id}
            onClick={() => setEditor({ kind: "contribute", item: g })}
          >
            <span className="goal-icon">
              <Target size={22} />
            </span>
            <span>
              <strong>{g.name}</strong>
              <small>
                {money(g.saved)} <span>of {money(g.target)}</span>
              </small>
              <Progress
                value={(g.saved / g.target) * 100}
                color={i ? "#b5bf79" : "#2e6b50"}
              />
            </span>
            <small>{Math.round((g.saved / g.target) * 100)}%</small>
          </button>
        ))
      ) : (
        <div className="empty">
          <p>Make room for something meaningful.</p>
          <button
            className="text-button"
            onClick={() => setEditor({ kind: "goal" })}
          >
            Create a goal
          </button>
        </div>
      )}
    </motion.section>
  );
  const categoryCard = (
    <motion.section
      variants={surfaceVariants}
      custom={!!reduced}
      className="card categories-card"
    >
      <div className="card-heading">
        <h2>Where it went</h2>
        <button
          className="icon-button"
          aria-label="See category analytics"
          onClick={() => select("Analytics")}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <CategoryChart transactions={monthTx} />
      <div className="category-legend">
        {categoryData.slice(0, 4).map((c) => (
          <div key={c.name}>
            <span className="legend-dot" style={{ background: c.color }} />
            <span>{c.name}</span>
            <strong>
              {summary.expense
                ? Math.round((c.value / summary.expense) * 100)
                : 0}
              %
            </strong>
          </div>
        ))}
      </div>
      {!categoryData.length && (
        <p className="fine-print">
          Your categories will appear after your first expense.
        </p>
      )}
    </motion.section>
  );
  const insight = (
    <motion.section
      variants={surfaceVariants}
      custom={!!reduced}
      className="insight"
    >
      <span className="insight-icon">
        <Sparkles size={22} />
      </span>
      <div>
        <strong>The month, in perspective</strong>
        <p>
          {summary.income
            ? `You’ve kept ${Math.round(summary.rate)}% of your income this month. ${summary.rate >= 30 ? "A little consistency goes a long way." : "Every small step helps."}`
            : "Add your income to see how much you’re putting aside."}
        </p>
      </div>
    </motion.section>
  );
  const filtered = state.transactions
    .filter(
      (t) =>
        monthOf(t.date) === month &&
        (filter === "All" || t.type === filter.toLowerCase()) &&
        (categoryFilter === "All categories" ||
          t.category === categoryFilter) &&
        (walletFilter === "All wallets" || t.wallet === walletFilter) &&
        (!dateFilter || t.date === dateFilter) &&
        (!minAmount || t.amount >= Number(minAmount)) &&
        (!maxAmount || t.amount <= Number(maxAmount)) &&
        `${t.name} ${t.category} ${t.note}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const grouped = groupByDate(filtered);
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
    >
      <div className="app-shell">
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              select("Overview");
            }}
          >
            <span className="brand-mark">
              <WalletIcon size={23} />
            </span>
            saldo<span className="brand-period">.</span>
          </a>
          <p className="brand-caption">THE EVERYDAY MONEY JOURNAL</p>
          <div className="sidebar-label">WORKSPACE</div>
          <nav aria-label="Main navigation">
            {navigation.map(({ name, icon: Icon }) => (
              <button
                className={`nav-item ${page === name ? "active" : ""}`}
                aria-current={page === name ? "page" : undefined}
                key={name}
                onClick={() => select(name)}
              >
                <Icon size={20} strokeWidth={1.8} />
                {name}
              </button>
            ))}
          </nav>
          <div className="sidebar-label tools-label">PLAN & REFLECT</div>
          <nav aria-label="More tools">
            {(
              [
                { name: "Recurring", icon: Repeat },
                { name: "Calendar", icon: CalendarDays },
                { name: "Reports", icon: FileChartColumn },
              ] as { name: Page; icon: LucideIcon }[]
            ).map(({ name, icon: Icon }) => (
              <button
                className={`nav-item ${page === name ? "active" : ""}`}
                aria-current={page === name ? "page" : undefined}
                key={name}
                onClick={() => select(name)}
              >
                <Icon size={20} strokeWidth={1.8} />
                {name}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="privacy-note">
              <ShieldCheck size={17} />
              <span>A place for every rupiah.</span>
            </div>
            <button className="user-card" onClick={() => select("Profile")}>
              <span className="avatar">{state.settings.name.slice(0, 1)}</span>
              <span>
                <strong>{state.settings.name}</strong>
                <small>{user ? "Personal account" : "Demo account"}</small>
              </span>
              <Settings size={17} />
            </button>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumb">
              <span className="workspace-wordmark">saldo.</span>
              <span className="workspace-name">Personal ledger</span>{" "}
              <ChevronRight size={14} /> <strong>{page}</strong>
            </div>
            <div className="topbar-actions">
              <span className="demo-label">
                {user ? "Connected account" : "Demo · session only"}
              </span>
              <button
                className="icon-button notification-button"
                aria-label="Notifications"
                onClick={() => setNotifications(true)}
              >
                <Bell size={20} />
                {allAlerts.length > 0 && <span />}
              </button>
              <button
                className="avatar small-avatar"
                aria-label="Open profile"
                onClick={() => select("Profile")}
              >
                {state.settings.name.slice(0, 1)}
              </button>
            </div>
          </header>
          <motion.main
            key={page}
            initial={reduced ? false : "hidden"}
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  duration: 0.12,
                  delayChildren: 0.02,
                  staggerChildren: reduced ? 0 : 0.045,
                },
              },
            }}
          >
            <div className="page-heading">
              <div>
                {page === "Overview" ? (
                  <>
                    <p className="eyebrow">
                      <span className="ledger-dot" /> YOUR FINANCIAL JOURNAL
                    </p>
                    <h1>
                      Hello, {state.settings.name}
                      <span className="greeting-dot">.</span>
                    </h1>
                    <p>Your everyday money. The bigger picture.</p>
                  </>
                ) : (
                  <>
                    <p className="eyebrow">
                      <span className="ledger-dot" /> YOUR FINANCIAL JOURNAL
                    </p>
                    <h1>{page}</h1>
                    <p>
                      {
                        (
                          {
                            Transactions:
                              "The little things, all in one place.",
                            Budgets: "Give every Rupiah a little direction.",
                            Wallets: "All your accounts. One clear picture.",
                            Analytics:
                              "Find the patterns behind your spending.",
                            "Saving goals":
                              "Small steps toward the things you love.",
                            Recurring: "A rhythm for your regular payments.",
                            Calendar: "Your finances, day by day.",
                            Reports: "A thoughtful look at your month.",
                            Profile: "Make this space your own.",
                          } as Record<string, string>
                        )[page]
                      }
                    </p>
                  </>
                )}
              </div>
              <div className="heading-actions">
                {!["Profile", "Saving goals", "Wallets", "Recurring"].includes(
                  page,
                ) && (
                  <div className="month-control">
                    <button
                      aria-label="Previous month"
                      onClick={() => setMonth(offsetMonth(month, -1))}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span>
                      <CalendarDays size={16} />
                      {monthLabel(month)}
                    </span>
                    <button
                      aria-label="Next month"
                      onClick={() => setMonth(offsetMonth(month, 1))}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
                {page === "Overview" || page === "Transactions" ? (
                  <button
                    className="primary desktop-add"
                    onClick={() => {
                      setEditing(undefined);
                      setAdding(true);
                    }}
                  >
                    <Plus size={18} />
                    Add transaction
                  </button>
                ) : [
                    "Budgets",
                    "Wallets",
                    "Saving goals",
                    "Recurring",
                  ].includes(page) ? (
                  <button
                    className="primary"
                    onClick={() =>
                      setEditor({
                        kind:
                          page === "Budgets"
                            ? "budget"
                            : page === "Wallets"
                              ? "wallet"
                              : page === "Saving goals"
                                ? "goal"
                                : "recurring",
                      })
                    }
                  >
                    <Plus size={18} />
                    Create{" "}
                    {page === "Budgets"
                      ? "budget"
                      : page === "Wallets"
                        ? "wallet"
                        : page === "Saving goals"
                          ? "goal"
                          : "schedule"}
                  </button>
                ) : null}
              </div>
            </div>
            {offline && user && (
              <div className="connection-banner" role="status">
                You’re offline. Your loaded finances are available to view;
                reconnect before saving changes.
              </div>
            )}
            {page === "Overview" && (
              <>
                {user &&
                  !state.settings.onboardingComplete &&
                  !state.transactions.length &&
                  !state.budgets.length &&
                  !state.goals.length && (
                    <motion.section
                      variants={surfaceVariants}
                      custom={!!reduced}
                      className="card welcome-card"
                    >
                      <span className="category-icon">
                        <Sparkles size={22} />
                      </span>
                      <div>
                        <h2>A fresh start for your finances</h2>
                        <p>
                          Set your first wallet and current balance, then make
                          this space yours.
                        </p>
                      </div>
                      <button
                        className="primary"
                        onClick={() => setSetup(true)}
                      >
                        Set up my space
                      </button>
                    </motion.section>
                  )}
                <div className="summary-grid">
                  <motion.section
                    variants={surfaceVariants}
                    custom={!!reduced}
                    className="card balance-card"
                  >
                    <div className="balance-top">
                      <span className="balance-title">Total balance</span>
                      <button
                        className="icon-button"
                        aria-label={hidden ? "Show balance" : "Hide balance"}
                        onClick={() => setHidden(!hidden)}
                      >
                        {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      <span className="balance-wallets">
                        Across {state.wallets.length} wallets
                      </span>
                    </div>
                    <div className="balance-value">
                      {hidden ? (
                        "Rp •••••••"
                      ) : (
                        <AnimatedAmount value={balance} />
                      )}
                    </div>
                    <div className="wallet-pills" aria-label="Wallet balances">
                      {state.wallets
                        .filter((w) => !w.archived)
                        .slice(0, 3)
                        .map((w) => (
                          <button key={w.id} onClick={() => select("Wallets")}>
                            <span>{w.name}</span>
                            <strong>
                              {hidden
                                ? "•••••"
                                : money(walletBalance(state, w.id))}
                            </strong>
                          </button>
                        ))}
                    </div>
                    <div className="balance-bottom">
                      <div>
                        <span className="summary-icon income-icon">
                          <ArrowDownLeft size={20} />
                        </span>
                        <span>
                          <small>Income this month</small>
                          <strong>
                            {hidden ? (
                              "•••••"
                            ) : (
                              <AnimatedAmount value={summary.income} />
                            )}
                          </strong>
                        </span>
                      </div>
                      <div>
                        <span className="summary-icon expense-icon">
                          <ArrowUpRight size={20} />
                        </span>
                        <span>
                          <small>Expenses this month</small>
                          <strong>
                            {hidden ? (
                              "•••••"
                            ) : (
                              <AnimatedAmount value={summary.expense} />
                            )}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </motion.section>
                  {budgetCard}
                </div>
                <div className="dashboard-grid">
                  <div className="dashboard-main">
                    {spendingCard}
                    {insight}
                    <motion.section
                      variants={surfaceVariants}
                      custom={!!reduced}
                      className="card recent-card"
                    >
                      <div className="card-heading">
                        <h2>Recent transactions</h2>
                        <button
                          className="text-button"
                          onClick={() => select("Transactions")}
                        >
                          See all <ChevronRight size={14} />
                        </button>
                      </div>
                      <TransactionList
                        items={recent}
                        onSelect={setSelected}
                        walletNames={walletNames}
                      />
                    </motion.section>
                  </div>
                  <div className="dashboard-aside">
                    {categoryCard}
                    {goalsCard}
                    <button
                      className="report-link"
                      onClick={() => select("Reports")}
                    >
                      <span className="report-icon">
                        <FileChartColumn size={22} />
                      </span>
                      <span>
                        <strong>Close the books</strong>
                        <small>See your financial report</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </>
            )}
            {page === "Transactions" && (
              <>
                <div className="card filters-card">
                  <div className="filter-row">
                    <div className="search-input">
                      <Search size={19} />
                      <input
                        aria-label="Search transactions"
                        placeholder="Search transactions"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <Segmented
                      options={["All", "Expense", "Income"]}
                      value={filter}
                      onChange={setFilter}
                    />
                    <button
                      className={`secondary ${showFilters ? "selected" : ""}`}
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <SlidersHorizontal size={17} />
                      Filters
                    </button>
                  </div>
                  {showFilters && (
                    <div className="filter-fields">
                      <Field label="Category">
                        <select
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                          {[
                            "All categories",
                            ...availableCategories(state),
                          ].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Wallet">
                        <select
                          value={walletFilter}
                          onChange={(e) => setWalletFilter(e.target.value)}
                        >
                          <option>All wallets</option>
                          {state.wallets.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Date">
                        <input
                          type="date"
                          value={dateFilter}
                          onChange={(e) => setDateFilter(e.target.value)}
                        />
                      </Field>
                      <Field label="Min amount">
                        <input
                          type="number"
                          min="0"
                          value={minAmount}
                          onChange={(e) => setMinAmount(e.target.value)}
                        />
                      </Field>
                      <Field label="Max amount">
                        <input
                          type="number"
                          min="0"
                          value={maxAmount}
                          onChange={(e) => setMaxAmount(e.target.value)}
                        />
                      </Field>
                      <button
                        className="text-button"
                        onClick={() => {
                          setCategoryFilter("All categories");
                          setWalletFilter("All wallets");
                          setDateFilter("");
                          setMinAmount("");
                          setMaxAmount("");
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>
                <div className="card">
                  {filtered.length ? (
                    Object.entries(grouped).map(([date, items]) => (
                      <div className="date-group" key={date}>
                        <h3>
                          {date === today()
                            ? "Today"
                            : new Date(date + "T12:00:00").toLocaleDateString(
                                "en-GB",
                                {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                },
                              )}
                        </h3>
                        <TransactionList
                          items={items ?? []}
                          onSelect={setSelected}
                          walletNames={walletNames}
                        />
                      </div>
                    ))
                  ) : (
                    <TransactionList
                      items={[]}
                      onSelect={setSelected}
                      walletNames={walletNames}
                    />
                  )}
                </div>
              </>
            )}
            {page === "Budgets" && (
              <>
                {budgetCard}
                <div className="management-grid">
                  {budgets.map((b, i) => {
                    const spent = monthTx
                      .filter(
                        (t) =>
                          t.type === "expense" && t.category === b.category,
                      )
                      .reduce((n, t) => n + t.amount, 0);
                    const percent = (spent / b.limit) * 100;
                    return (
                      <motion.section
                        variants={surfaceVariants}
                        custom={!!reduced}
                        className="card budget-item"
                        key={b.id}
                      >
                        <div className="card-heading">
                          <CategoryIcon category={b.category} index={i} />
                          <button
                            className="icon-button"
                            aria-label={`Edit ${b.category} budget`}
                            onClick={() =>
                              setEditor({ kind: "budget", item: b })
                            }
                          >
                            <Ellipsis size={20} />
                          </button>
                        </div>
                        <h2>{b.category}</h2>
                        <div className="budget-number">
                          {money(spent)}
                          <small>of {money(b.limit)}</small>
                        </div>
                        <Progress value={percent} />
                        <div className="budget-foot">
                          <span>{Math.round(percent)}% used</span>
                          <span>Alert at {b.threshold}%</span>
                        </div>
                      </motion.section>
                    );
                  })}
                </div>
                {!budgets.length && (
                  <Empty
                    title="A plan for your month"
                    text="Create your first category budget to start planning."
                    onClick={() => setEditor({ kind: "budget" })}
                    label="Create budget"
                  />
                )}
              </>
            )}
            {page === "Wallets" && (
              <>
                <div className="section-toolbar">
                  <p>
                    Transfers move money between wallets without affecting
                    income or spending.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setEditor({ kind: "transfer" })}
                  >
                    <ArrowLeftRight size={18} />
                    Transfer money
                  </button>
                </div>
                <div className="management-grid">
                  {state.wallets.map((w, i) => (
                    <motion.section
                      variants={surfaceVariants}
                      custom={!!reduced}
                      className={`card wallet-card ${w.archived ? "archived" : ""}`}
                      style={{ borderTopColor: colors[i % colors.length] }}
                      key={w.id}
                    >
                      <div className="card-heading">
                        <span className="wallet-brand">
                          <Landmark size={23} />
                          {w.name}
                        </span>
                        <button
                          className="icon-button"
                          aria-label={`Edit ${w.name}`}
                          onClick={() => setEditor({ kind: "wallet", item: w })}
                        >
                          <Ellipsis size={20} />
                        </button>
                      </div>
                      <small>
                        {w.archived ? "Archived wallet" : "Current balance"}
                      </small>
                      <strong className="wallet-balance">
                        <AnimatedAmount value={walletBalance(state, w.id)} />
                      </strong>
                      <span className="fine-print">
                        {w.id === state.settings.defaultWallet
                          ? "Default wallet"
                          : w.archived
                            ? "History is retained"
                            : "Personal account"}
                      </span>
                    </motion.section>
                  ))}
                </div>
                <motion.section
                  variants={surfaceVariants}
                  custom={!!reduced}
                  className="card"
                >
                  <div className="card-heading">
                    <h2>Recent transfers</h2>
                  </div>
                  {state.transfers.length ? (
                    [...state.transfers].reverse().map((t) => (
                      <div className="transfer-row" key={t.id}>
                        <ArrowLeftRight size={20} />
                        <span>
                          {walletNames[t.from]} → {walletNames[t.to]}
                          <small>{t.date}</small>
                        </span>
                        <strong>{money(t.amount)}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="fine-print">
                      Your transfers will appear here.
                    </p>
                  )}
                </motion.section>
              </>
            )}
            {page === "Analytics" && (
              <>
                <div className="stats-grid">
                  <Stat
                    label="Total spending"
                    value={money(summary.expense)}
                    icon={ArrowUpRight}
                  />
                  <Stat
                    label="Average per day"
                    value={money(summary.expense / daysInView(month))}
                    icon={CalendarDays}
                  />
                  <Stat
                    label="Savings rate"
                    value={`${summary.rate.toFixed(1)}%`}
                    icon={Target}
                  />
                  <Stat
                    label="Biggest category"
                    value={categoryData[0]?.name ?? "No spending yet"}
                    icon={ShoppingIcon}
                  />
                </div>
                <div className="analytics-grid">
                  {spendingCard}
                  {categoryCard}
                  <motion.section
                    variants={surfaceVariants}
                    custom={!!reduced}
                    className="card"
                  >
                    <div className="card-heading">
                      <h2>Income & expenses</h2>
                    </div>
                    <ComparisonChart
                      transactions={state.transactions}
                      month={month}
                      period={period}
                    />
                  </motion.section>
                  <motion.section
                    variants={surfaceVariants}
                    custom={!!reduced}
                    className="card"
                  >
                    <div className="card-heading">
                      <h2>A closer look</h2>
                    </div>
                    {categoryData.map((c, i) => (
                      <div className="category-detail" key={c.name}>
                        <CategoryIcon category={c.name} index={i} />
                        <span>
                          <strong>{c.name}</strong>
                          <small>
                            {Math.round(
                              (c.value / (summary.expense || 1)) * 100,
                            )}
                            % of your spending
                          </small>
                        </span>
                        <strong>{money(c.value)}</strong>
                      </div>
                    ))}
                  </motion.section>
                </div>
                {insight}
                {month === today().slice(0, 7) && summary.expense > 0 && (
                  <motion.section
                    variants={surfaceVariants}
                    custom={!!reduced}
                    className="insight"
                  >
                    <CalendarDays size={22} />
                    <div>
                      <strong>Your current spending pace</strong>
                      <p>
                        You’re averaging{" "}
                        {money(summary.expense / daysInView(month))} a day. At
                        that pace, this month may reach{" "}
                        {money(
                          (summary.expense / daysInView(month)) *
                            new Date(
                              Number(month.slice(0, 4)),
                              Number(month.slice(5)),
                              0,
                            ).getDate(),
                        )}
                        . This is an estimate based on spending so far.
                      </p>
                    </div>
                  </motion.section>
                )}
              </>
            )}
            {page === "Saving goals" && (
              <>
                <div className="management-grid">
                  {state.goals.map((g, i) => (
                    <motion.section
                      variants={surfaceVariants}
                      custom={!!reduced}
                      className="card goal-card"
                      key={g.id}
                    >
                      <div className="card-heading">
                        <span className="goal-icon">
                          <Target size={26} />
                        </span>
                        <button
                          className="icon-button"
                          aria-label={`Edit ${g.name}`}
                          onClick={() => setEditor({ kind: "goal", item: g })}
                        >
                          <Ellipsis size={20} />
                        </button>
                      </div>
                      <h2>{g.name}</h2>
                      <div className="wallet-balance">
                        <AnimatedAmount value={g.saved} />
                      </div>
                      <p className="fine-print">of {money(g.target)}</p>
                      <Progress
                        value={(g.saved / g.target) * 100}
                        color={colors[i % colors.length]}
                      />
                      <div className="budget-foot">
                        <span>
                          {Math.round((g.saved / g.target) * 100)}% saved
                        </span>
                        <span>
                          By{" "}
                          {new Date(g.date + "T12:00:00").toLocaleDateString(
                            "en",
                            { month: "short", year: "numeric" },
                          )}
                        </span>
                      </div>
                      <button
                        className="secondary full"
                        onClick={() =>
                          setEditor({ kind: "contribute", item: g })
                        }
                      >
                        <Plus size={17} />
                        Add contribution
                      </button>
                    </motion.section>
                  ))}
                </div>
                {!state.goals.length && (
                  <Empty
                    title="What are you saving for?"
                    text="Set a goal and celebrate your progress, one step at a time."
                    label="Create a goal"
                    onClick={() => setEditor({ kind: "goal" })}
                  />
                )}
                <p className="fine-print">
                  Goals track money you’ve set aside. Contributions don’t move
                  money between wallets.
                </p>
              </>
            )}
            {page === "Recurring" && (
              <>
                <div className="card">
                  {state.recurring.map((r) => (
                    <div className="recurring-row" key={r.id}>
                      <CategoryIcon category={r.category} />
                      <span className="transaction-copy">
                        <strong>{r.name}</strong>
                        <small>
                          {r.frequency} ·{" "}
                          {r.active ? `Next ${r.next}` : "Paused"}
                        </small>
                      </span>
                      <strong>{money(r.amount)}</strong>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${r.name}`}
                        onClick={() =>
                          setEditor({ kind: "recurring", item: r })
                        }
                      >
                        <Ellipsis size={20} />
                      </button>
                    </div>
                  ))}
                  {!state.recurring.length && (
                    <p className="fine-print">
                      Create a schedule for your regular payments.
                    </p>
                  )}
                </div>
                <div className="insight">
                  <Repeat size={22} />
                  <p>
                    Your saved schedules run automatically, even when the app is
                    closed. Upcoming payments appear here and in your calendar.
                  </p>
                </div>
              </>
            )}
            {page === "Calendar" && (
              <div className="calendar-layout">
                <motion.section
                  variants={surfaceVariants}
                  custom={!!reduced}
                  className="card calendar"
                >
                  <div className="calendar-weekdays">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (d) => (
                        <span key={d}>{d}</span>
                      ),
                    )}
                  </div>
                  <div className="calendar-grid">
                    {Array.from(
                      {
                        length:
                          (new Date(month + "-01T12:00:00").getDay() + 6) % 7,
                      },
                      (_, i) => (
                        <span key={`pad-${i}`} />
                      ),
                    )}
                    {Array.from(
                      {
                        length: new Date(
                          Number(month.slice(0, 4)),
                          Number(month.slice(5)),
                          0,
                        ).getDate(),
                      },
                      (_, i) => {
                        const date = `${month}-${String(i + 1).padStart(2, "0")}`;
                        const hasTx = monthTx.some((t) => t.date === date);
                        return (
                          <button
                            key={date}
                            className={calendarDate === date ? "selected" : ""}
                            onClick={() => setCalendarDate(date)}
                          >
                            <span>{i + 1}</span>
                            {hasTx && <i />}
                          </button>
                        );
                      },
                    )}
                  </div>
                </motion.section>
                <motion.section
                  variants={surfaceVariants}
                  custom={!!reduced}
                  className="card"
                >
                  <div className="card-heading">
                    <h2>
                      {new Date(calendarDate + "T12:00:00").toLocaleDateString(
                        "en-GB",
                        { day: "numeric", month: "long" },
                      )}
                    </h2>
                  </div>
                  <TransactionList
                    items={state.transactions.filter(
                      (t) => t.date === calendarDate,
                    )}
                    onSelect={setSelected}
                    walletNames={walletNames}
                  />
                  <div className="calendar-total">
                    <span>Total spent</span>
                    <strong>
                      {money(
                        totals(
                          state.transactions.filter(
                            (t) => t.date === calendarDate,
                          ),
                        ).expense,
                      )}
                    </strong>
                  </div>
                </motion.section>
              </div>
            )}
            {page === "Reports" && (
              <>
                <motion.section
                  variants={surfaceVariants}
                  custom={!!reduced}
                  className="card report-card"
                >
                  <div className="card-heading">
                    <div>
                      <span className="eyebrow">YOUR MONTHLY STORY</span>
                      <h2>{monthLabel(month)}</h2>
                    </div>
                    <button
                      className="secondary"
                      onClick={() =>
                        download(
                          `saldo-report-${month}.csv`,
                          reportCSV(state, month),
                          "text/csv;charset=utf-8",
                        )
                      }
                    >
                      <Download size={17} />
                      Export report
                    </button>
                  </div>
                  <div className="report-numbers">
                    <Stat
                      label="Income"
                      value={money(summary.income)}
                      icon={ArrowDownLeft}
                    />
                    <Stat
                      label="Expenses"
                      value={money(summary.expense)}
                      icon={ArrowUpRight}
                    />
                    <Stat
                      label="Net savings"
                      value={money(summary.saved)}
                      icon={Target}
                    />
                  </div>
                  <div className="report-metrics">
                    <div>
                      <span>Savings rate</span>
                      <strong>{summary.rate.toFixed(1)}%</strong>
                    </div>
                    <div>
                      <span>Largest spending category</span>
                      <strong>{categoryData[0]?.name ?? "—"}</strong>
                    </div>
                    <div>
                      <span>Highest spending day</span>
                      <strong>{highestDay(monthTx) ?? "—"}</strong>
                    </div>
                    <div>
                      <span>Average daily spending</span>
                      <strong>
                        {money(summary.expense / daysInView(month))}
                      </strong>
                    </div>
                    <div>
                      <span>Budget performance</span>
                      <strong>
                        {budgetTotal
                          ? `${Math.round(used)}% used`
                          : "No budget set"}
                      </strong>
                    </div>
                    <div>
                      <span>Compared with last month</span>
                      <strong>
                        {change === null
                          ? "No previous spending"
                          : `${Math.abs(change).toFixed(1)}% ${change > 0 ? "more" : "less"}`}
                      </strong>
                    </div>
                  </div>
                </motion.section>
                {spendingCard}
                {insight}
              </>
            )}
            {page === "Profile" && (
              <>
                <motion.section
                  variants={surfaceVariants}
                  custom={!!reduced}
                  className="card profile-card"
                >
                  <div className="profile-intro">
                    <span className="avatar large-avatar">
                      {state.settings.name.slice(0, 1)}
                    </span>
                    <div>
                      <h2>{state.settings.name}</h2>
                      <p>
                        {user?.email ?? "Explore Saldo with sample finances"}
                      </p>
                    </div>
                    {!user && (
                      <button className="primary" onClick={() => setAuth(true)}>
                        Sign in
                      </button>
                    )}
                  </div>
                  <form
                    className="form-stack"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      try {
                        await save(
                          {
                            ...state,
                            settings: {
                              ...state.settings,
                              name: String(form.get("name")),
                              defaultWallet: String(form.get("wallet")),
                              theme: String(
                                form.get("theme"),
                              ) as FinanceState["settings"]["theme"],
                              budgetAlerts: form.has("budgetAlerts"),
                              recurringAlerts: form.has("recurringAlerts"),
                              reportAlerts: form.has("reportAlerts"),
                            },
                          },
                          "Settings saved",
                        );
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    <div className="form-grid">
                      <Field label="Your name">
                        <input
                          name="name"
                          defaultValue={state.settings.name}
                          required
                          maxLength={60}
                        />
                      </Field>
                      <Field label="Currency">
                        <select name="currency" disabled>
                          <option>Indonesian Rupiah · IDR</option>
                        </select>
                      </Field>
                      <Field label="Default wallet">
                        <select
                          name="wallet"
                          defaultValue={state.settings.defaultWallet}
                        >
                          {state.wallets
                            .filter((w) => !w.archived)
                            .map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Appearance">
                        <select
                          name="theme"
                          defaultValue={state.settings.theme}
                        >
                          <option value="system">Follow system</option>
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                        </select>
                      </Field>
                    </div>
                    <h3>Notifications</h3>
                    {(
                      [
                        "budgetAlerts",
                        "recurringAlerts",
                        "reportAlerts",
                      ] as const
                    ).map((key, i) => (
                      <label className="switch-row" key={key}>
                        <span>
                          {
                            [
                              "Budget alerts",
                              "Recurring payment reminders",
                              "Monthly report",
                            ][i]
                          }
                        </span>
                        <input
                          type="checkbox"
                          className="switch"
                          name={key}
                          defaultChecked={state.settings[key]}
                        />
                      </label>
                    ))}
                    <button className="primary" disabled={busy}>
                      Save settings
                    </button>
                  </form>
                </motion.section>
                <motion.section
                  variants={surfaceVariants}
                  custom={!!reduced}
                  className="card settings-tools"
                >
                  <button onClick={() => setCategoryManager(true)}>
                    <SlidersHorizontal size={20} />
                    Manage categories
                    <ChevronRight size={18} />
                  </button>
                  <button onClick={() => select("Budgets")}>
                    <WalletIcon size={20} />
                    Monthly budgets
                    <ChevronRight size={18} />
                  </button>
                  <button onClick={() => select("Wallets")}>
                    <Landmark size={20} />
                    Manage wallets
                    <ChevronRight size={18} />
                  </button>
                  <button onClick={() => select("Saving goals")}>
                    <Target size={20} />
                    Saving goals
                    <ChevronRight size={18} />
                  </button>
                  <button onClick={() => select("Recurring")}>
                    <Repeat size={20} />
                    Recurring transactions
                    <ChevronRight size={18} />
                  </button>
                  <button onClick={() => select("Calendar")}>
                    <CalendarDays size={20} />
                    Financial calendar
                    <ChevronRight size={18} />
                  </button>
                  <button onClick={() => select("Reports")}>
                    <FileChartColumn size={20} />
                    Monthly reports
                    <ChevronRight size={18} />
                  </button>
                  <button
                    onClick={() =>
                      download(
                        "saldo-finances.json",
                        JSON.stringify(state, null, 2),
                      )
                    }
                  >
                    <Download size={20} />
                    Export all data
                    <ChevronRight size={18} />
                  </button>
                  {user && (
                    <button
                      onClick={async () => {
                        const result = await supabase?.auth.signOut();
                        if (result?.error)
                          notify("Could not sign out. Please try again.");
                        else notify("Signed out");
                      }}
                    >
                      <LogOut size={20} />
                      Sign out
                      <ChevronRight size={18} />
                    </button>
                  )}
                </motion.section>
              </>
            )}
            <footer className="app-footer">
              <span className="footer-mark">
                <WalletIcon size={14} />
                saldo.
              </span>
              <span>Good habits. A little more breathing room.</span>
            </footer>
          </motion.main>
        </div>
        <nav className="bottom-nav" aria-label="Mobile navigation">
          {(
            [
              { name: "Overview", label: "Home", icon: LayoutDashboard },
              { name: "Transactions", label: "Activity", icon: ArrowLeftRight },
              { name: "Add", label: "Add", icon: Plus },
              {
                name: "Analytics",
                label: "Analytics",
                icon: ChartNoAxesCombined,
              },
              { name: "Profile", label: "Profile", icon: UserRound },
            ] as { name: string; label: string; icon: LucideIcon }[]
          ).map(({ name, label, icon: Icon }) => (
            <button
              key={name}
              aria-label={name === "Add" ? "Add transaction" : label}
              className={`${name === "Add" ? "add-nav" : ""} ${page === name ? "active" : ""}`}
              onClick={() =>
                name === "Add"
                  ? (setEditing(undefined), setAdding(true))
                  : select(name as Page)
              }
            >
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <Sheet
          open={adding}
          title={editing ? "Edit transaction" : "Add transaction"}
          onClose={() => {
            if (!busy) {
              setAdding(false);
              setEditing(undefined);
            }
          }}
        >
          {adding && (
            <TransactionForm
              state={state}
              initial={editing}
              onSave={transactionSave}
              busy={busy}
              userId={user?.id}
            />
          )}
        </Sheet>
        <Sheet
          open={selected !== null}
          title="Transaction details"
          onClose={() => setSelected(null)}
        >
          {selected && (
            <div className="form-stack">
              <CategoryIcon category={selected.category} />
              <h2 className="detail-amount">
                {selected.type === "income" ? "+" : "−"}{" "}
                {money(selected.amount)}
              </h2>
              <h3>{selected.name}</h3>
              <div className="detail-list">
                <div>
                  <span>Category</span>
                  <strong>{selected.category}</strong>
                </div>
                <div>
                  <span>Wallet</span>
                  <strong>{walletNames[selected.wallet]}</strong>
                </div>
                <div>
                  <span>Date</span>
                  <strong>{selected.date}</strong>
                </div>
                {selected.note && <p>{selected.note}</p>}
                {selected.receipt && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      const result = await supabase?.storage
                        .from("receipts")
                        .createSignedUrl(selected.receipt!, 60);
                      if (result?.data)
                        window.open(
                          result.data.signedUrl,
                          "_blank",
                          "noopener,noreferrer",
                        );
                      else notify("This receipt could not be opened.");
                    }}
                  >
                    View receipt
                  </button>
                )}
              </div>
              <div className="detail-actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setEditing(selected);
                    setSelected(null);
                    setAdding(true);
                  }}
                >
                  <Pencil size={17} />
                  Edit
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await save(
                        {
                          ...state,
                          transactions: [
                            ...state.transactions,
                            { ...selected, id: uid(), recurringId: undefined },
                          ],
                        },
                        "Transaction duplicated",
                      );
                      setSelected(null);
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  <Copy size={17} />
                  Duplicate
                </button>
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await save(
                        {
                          ...state,
                          transactions: state.transactions.filter(
                            (t) => t.id !== selected.id,
                          ),
                        },
                        "Transaction deleted",
                      );
                      setSelected(null);
                    } catch (e) {
                      notify((e as Error).message);
                    }
                  }}
                >
                  <Trash2 size={17} />
                  Delete
                </button>
              </div>
            </div>
          )}
        </Sheet>
        <Sheet
          open={editor !== null}
          title={editorTitle(editor)}
          onClose={() => {
            if (!busy) setEditor(null);
          }}
        >
          {editor && (
            <EntityForm
              key={`${editor.kind}-${"item" in editor ? editor.item?.id : ""}`}
              editor={editor}
              state={state}
              month={month}
              busy={busy}
              onSave={async (next, message) => {
                await save(next, message);
                setEditor(null);
              }}
            />
          )}
        </Sheet>
        <Sheet
          open={auth}
          title="Your own space"
          onClose={() => setAuth(false)}
        >
          {auth && (
            <AuthForm configured={configured} onDone={() => setAuth(false)} />
          )}
        </Sheet>
        <Sheet
          open={categoryManager}
          title="Your categories"
          onClose={() => {
            if (!busy) setCategoryManager(false);
          }}
        >
          {categoryManager && (
            <CategoryManager state={state} busy={busy} onSave={save} />
          )}
        </Sheet>
        <Sheet
          open={setup}
          title="Make yourself at home"
          onClose={() => {
            if (!busy) setSetup(false);
          }}
        >
          {setup && (
            <FirstSetup
              state={state}
              busy={busy}
              onSave={async (next, message) => {
                await save(next, message);
                setSetup(false);
              }}
            />
          )}
        </Sheet>
        <Sheet
          open={notifications}
          title="A little heads-up"
          onClose={() => setNotifications(false)}
        >
          {allAlerts.length ? (
            allAlerts.map((a, i) => (
              <div className="notification-row" key={i}>
                <Bell size={20} />
                <div>
                  <strong>{a.title}</strong>
                  <p>{a.text}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">
              <Check size={28} />
              <h3>You’re all caught up</h3>
              <p>Budget alerts and upcoming payments will appear here.</p>
            </div>
          )}
          {state.settings.reportAlerts && (
            <button
              className="report-link"
              onClick={() => {
                setNotifications(false);
                select("Reports");
              }}
            >
              Your monthly report
              <ChevronRight size={18} />
            </button>
          )}
        </Sheet>
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast}
              className="toast"
              role="status"
              style={{ x: "-50%" }}
              initial={{
                opacity: 0,
                y: reduced ? 0 : 12,
                scale: reduced ? 1 : 0.97,
              }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: reduced ? 0 : 8,
                scale: reduced ? 1 : 0.98,
              }}
            >
              <Check size={18} />
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
        {error && state && (
          <div className="toast error-toast" role="alert">
            {error}
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
const ShoppingIcon = WalletIcon;
function Empty({
  title,
  text,
  label,
  onClick,
}: {
  title: string;
  text: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="card empty">
      <Target size={32} />
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary" onClick={onClick}>
        {label}
      </button>
    </div>
  );
}
function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="card stat">
      <span>
        <Icon size={19} />
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
function daysInView(month: string) {
  const current = today();
  return month === monthOf(current)
    ? Number(current.slice(8))
    : new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
}
function groupByDate(tx: Transaction[]) {
  return tx.reduce<Record<string, Transaction[]>>((groups, t) => {
    (groups[t.date] ??= []).push(t);
    return groups;
  }, {});
}
function highestDay(tx: Transaction[]) {
  const dates = groupByDate(tx.filter((t) => t.type === "expense"));
  const max = Object.entries(dates).sort(
    (a, b) =>
      (b[1] ?? []).reduce((n, t) => n + t.amount, 0) -
      (a[1] ?? []).reduce((n, t) => n + t.amount, 0),
  )[0];
  return max
    ? new Date(max[0] + "T12:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : null;
}
function reportCSV(state: FinanceState, month: string) {
  const tx = state.transactions.filter((t) => monthOf(t.date) === month);
  const s = totals(tx);
  const budget = state.budgets
    .filter((b) => b.month === month)
    .reduce((n, b) => n + b.limit, 0);
  return [
    ["Month", month],
    ["Income", s.income],
    ["Expenses", s.expense],
    ["Net savings", s.saved],
    ["Savings rate", s.rate.toFixed(1) + "%"],
    ["Largest category", categoryTotals(tx)[0]?.name ?? "None"],
    ["Highest spending day", highestDay(tx) ?? "None"],
    ["Average daily spending", Math.round(s.expense / daysInView(month))],
    ["Budget limit", budget],
    [
      "Budget used",
      budget ? `${((s.expense / budget) * 100).toFixed(1)}%` : "No budget",
    ],
    [
      "Previous month spending",
      totals(
        state.transactions.filter(
          (t) => monthOf(t.date) === offsetMonth(month, -1),
        ),
      ).expense,
    ],
  ]
    .map((row) =>
      row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
}
function editorTitle(editor: Editor | null) {
  if (!editor) return "";
  if (editor.kind === "transfer") return "Transfer money";
  if (editor.kind === "contribute") return "Add contribution";
  return `${editor.item ? "Edit" : "Create"} ${editor.kind === "recurring" ? "schedule" : editor.kind}`;
}
function EntityForm({
  editor,
  state,
  month,
  busy,
  onSave,
}: {
  editor: Editor;
  state: FinanceState;
  month: string;
  busy: boolean;
  onSave: (state: FinanceState, message: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const activeWallets = state.wallets.filter((w) => !w.archived);
  const item = "item" in editor ? editor.item : undefined;
  const run = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const text = (key: string) => String(f.get(key) ?? "");
    const amount = (key: string, zero = false) => {
      const n = Number(f.get(key));
      if (!Number.isSafeInteger(n) || (zero ? n < 0 : n <= 0))
        throw new Error("Enter a valid whole Rupiah amount.");
      return n;
    };
    try {
      let next = { ...state };
      let message = "Changes saved";
      if (editor.kind === "budget") {
        const limit = amount("limit");
        const category = text("category");
        if (
          state.budgets.some(
            (b) =>
              b.month === month &&
              b.category === category &&
              b.id !== editor.item?.id,
          )
        )
          throw new Error("This category already has a budget for this month.");
        const b: Budget = {
          id: item?.id ?? uid(),
          category,
          limit,
          threshold: Number(text("threshold")),
          month,
        };
        next = {
          ...state,
          budgets: editor.item
            ? state.budgets.map((x) => (x.id === b.id ? b : x))
            : [...state.budgets, b],
        };
        message = "Budget saved";
      }
      if (editor.kind === "wallet") {
        const name = text("name").trim();
        if (!name) throw new Error("Enter a wallet name.");
        const opening = Number(text("opening"));
        if (!Number.isSafeInteger(opening))
          throw new Error("Enter a whole Rupiah balance.");
        const w: Wallet = {
          id: item?.id ?? uid(),
          name,
          opening,
          archived: f.has("archived"),
        };
        if (
          w.archived &&
          state.recurring.some((r) => r.wallet === w.id && r.active)
        )
          throw new Error(
            "Pause recurring transactions using this wallet before archiving it.",
          );
        if (
          w.archived &&
          state.wallets.filter((x) => !x.archived && x.id !== w.id).length === 0
        )
          throw new Error("Keep at least one active wallet.");
        next = {
          ...state,
          wallets: editor.item
            ? state.wallets.map((x) => (x.id === w.id ? w : x))
            : [...state.wallets, w],
          settings: {
            ...state.settings,
            defaultWallet:
              state.settings.defaultWallet === w.id && w.archived
                ? (state.wallets.find((x) => !x.archived && x.id !== w.id)
                    ?.id ?? "")
                : state.settings.defaultWallet || w.id,
          },
        };
        message = "Wallet saved";
      }
      if (editor.kind === "goal") {
        const g: Goal = {
          id: item?.id ?? uid(),
          name: text("name").trim(),
          target: amount("target"),
          saved: amount("saved", true),
          date: text("date"),
        };
        if (!g.name || !g.date) throw new Error("Add a name and target date.");
        next = {
          ...state,
          goals: editor.item
            ? state.goals.map((x) => (x.id === g.id ? g : x))
            : [...state.goals, g],
        };
        message = "Goal saved";
      }
      if (editor.kind === "contribute") {
        const value = amount("amount");
        next = {
          ...state,
          goals: state.goals.map((g) =>
            g.id === editor.item.id ? { ...g, saved: g.saved + value } : g,
          ),
          contributions: [
            ...state.contributions,
            { id: uid(), goal: editor.item.id, amount: value, date: today() },
          ],
        };
        message = "A step closer. Contribution saved";
      }
      if (editor.kind === "transfer") {
        const from = text("from"),
          to = text("to"),
          value = amount("amount");
        validateTransfer(state, from, to, value);
        next = {
          ...state,
          transfers: [
            ...state.transfers,
            { id: uid(), from, to, amount: value, date: today() },
          ],
        };
        message = "Transfer complete";
      }
      if (editor.kind === "recurring") {
        if (!activeWallets.length)
          throw new Error("Create an active wallet first.");
        const r: Recurring = {
          id: item?.id ?? uid(),
          name: text("name").trim(),
          amount: amount("amount"),
          category: text("category"),
          wallet: text("wallet"),
          type: text("type") as Recurring["type"],
          frequency: text("frequency") as Recurring["frequency"],
          next: text("next"),
          active: f.has("active"),
        };
        if (!r.name || !r.next) throw new Error("Add a name and start date.");
        next = {
          ...state,
          recurring: editor.item
            ? state.recurring.map((x) => (x.id === r.id ? r : x))
            : [...state.recurring, r],
        };
        message = "Schedule saved";
      }
      await onSave(next, message);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const remove = async () => {
    try {
      if (editor.kind === "budget")
        await onSave(
          {
            ...state,
            budgets: state.budgets.filter((x) => x.id !== editor.item?.id),
          },
          "Budget removed",
        );
      if (editor.kind === "goal")
        await onSave(
          {
            ...state,
            goals: state.goals.filter((x) => x.id !== editor.item?.id),
            contributions: state.contributions.filter(
              (x) => x.goal !== editor.item?.id,
            ),
          },
          "Goal removed",
        );
      if (editor.kind === "recurring")
        await onSave(
          {
            ...state,
            recurring: state.recurring.filter((x) => x.id !== editor.item?.id),
          },
          "Schedule removed",
        );
    } catch (err) {
      setError((err as Error).message);
    }
  };
  return (
    <form className="form-stack" onSubmit={run}>
      {editor.kind === "budget" && (
        <>
          <Field label="Category">
            <select
              name="category"
              defaultValue={editor.item?.category ?? "Food & Drinks"}
            >
              {availableCategories(state, "expense").map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Monthly limit · Rp">
            <input
              name="limit"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              defaultValue={editor.item?.limit}
              required
            />
          </Field>
          <Field label="Alert threshold">
            <select
              name="threshold"
              defaultValue={editor.item?.threshold ?? 75}
            >
              {[50, 75, 90, 100].map((n) => (
                <option value={n} key={n}>
                  {n}%
                </option>
              ))}
            </select>
          </Field>
          <p className="fine-print">For {monthLabel(month)}</p>
        </>
      )}
      {editor.kind === "wallet" && (
        <>
          <Field label="Wallet name">
            <input
              name="name"
              defaultValue={editor.item?.name}
              placeholder="e.g. BCA, Cash, GoPay"
              maxLength={60}
              required
            />
          </Field>
          <Field label="Opening balance · Rp">
            <input
              name="opening"
              type="number"
              step="1"
              defaultValue={editor.item?.opening ?? 0}
              required
            />
          </Field>
          <p className="fine-print">
            Your current balance is the opening balance plus all recorded
            activity.
          </p>
          {editor.item && (
            <label className="switch-row">
              <span>Archive wallet</span>
              <input
                className="switch"
                type="checkbox"
                name="archived"
                defaultChecked={editor.item.archived}
              />
            </label>
          )}
        </>
      )}
      {editor.kind === "goal" && (
        <>
          <Field label="Goal name">
            <input
              name="name"
              defaultValue={editor.item?.name}
              placeholder="Something worth saving for"
              required
              maxLength={120}
            />
          </Field>
          <Field label="Target amount · Rp">
            <input
              name="target"
              type="number"
              min="1"
              step="1"
              defaultValue={editor.item?.target}
              required
            />
          </Field>
          <Field label="Already saved · Rp">
            <input
              name="saved"
              type="number"
              min="0"
              step="1"
              defaultValue={editor.item?.saved ?? 0}
              required
            />
          </Field>
          <Field label="Target date">
            <input
              name="date"
              type="date"
              defaultValue={editor.item?.date}
              required
            />
          </Field>
        </>
      )}
      {editor.kind === "contribute" && (
        <>
          <h3>{editor.item.name}</h3>
          <p className="fine-print">
            {money(editor.item.saved)} of {money(editor.item.target)} saved
          </p>
          <Field label="Contribution · Rp">
            <input
              name="amount"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              required
              autoFocus
            />
          </Field>
          <p className="fine-print">
            This records savings progress. It doesn’t change your wallet
            balances.
          </p>
        </>
      )}
      {editor.kind === "transfer" && (
        <>
          <Field label="From wallet">
            <select name="from">
              {activeWallets.map((w) => (
                <option value={w.id} key={w.id}>
                  {w.name} ·{" "}
                  <AnimatedAmount value={walletBalance(state, w.id)} />
                </option>
              ))}
            </select>
          </Field>
          <Field label="To wallet">
            <select name="to" defaultValue={activeWallets[1]?.id}>
              {activeWallets.map((w) => (
                <option value={w.id} key={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Amount · Rp">
            <input name="amount" type="number" min="1" step="1" required />
          </Field>
        </>
      )}
      {editor.kind === "recurring" && (
        <>
          <Field label="Name">
            <input
              name="name"
              defaultValue={editor.item?.name}
              required
              maxLength={120}
            />
          </Field>
          <div className="form-grid">
            <Field label="Amount · Rp">
              <input
                name="amount"
                type="number"
                min="1"
                step="1"
                defaultValue={editor.item?.amount}
                required
              />
            </Field>
            <Field label="Type">
              <select name="type" defaultValue={editor.item?.type ?? "expense"}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Category">
              <select name="category" defaultValue={editor.item?.category}>
                {availableCategories(state).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Wallet">
              <select
                name="wallet"
                defaultValue={
                  editor.item?.wallet ?? state.settings.defaultWallet
                }
              >
                {activeWallets.map((w) => (
                  <option value={w.id} key={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Frequency">
            <select
              name="frequency"
              defaultValue={editor.item?.frequency ?? "monthly"}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </Field>
          <Field label="Next transaction date">
            <input
              name="next"
              type="date"
              defaultValue={editor.item?.next ?? today()}
              required
            />
          </Field>
          <label className="switch-row">
            <span>Schedule active</span>
            <input
              className="switch"
              type="checkbox"
              name="active"
              defaultChecked={editor.item?.active ?? true}
            />
          </label>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary full" disabled={busy} type="submit">
        {busy
          ? "Saving…"
          : editor.kind === "transfer"
            ? "Transfer money"
            : editor.kind === "contribute"
              ? "Add contribution"
              : "Save changes"}
      </button>
      {item && editor.kind !== "wallet" && editor.kind !== "contribute" && (
        <button
          className="danger-button"
          type="button"
          disabled={busy}
          onClick={() => void remove()}
        >
          <Trash2 size={17} />
          Remove {editor.kind === "recurring" ? "schedule" : editor.kind}
        </button>
      )}
    </form>
  );
}
function AuthForm({
  configured,
  onDone,
}: {
  configured: boolean;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<
    "Sign in" | "Register" | "Reset password" | "New password"
  >("Sign in");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (
      window.location.hash.includes("type=recovery") ||
      new URLSearchParams(window.location.search).get("recovery") === "1"
    )
      setMode("New password");
  }, []);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? ""),
      password = String(f.get("password") ?? "");
    try {
      const result =
        mode === "Sign in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : mode === "Register"
            ? await supabase.auth.signUp({
                email,
                password,
                options: {
                  data: { full_name: String(f.get("name")) },
                  emailRedirectTo: window.location.origin,
                },
              })
            : mode === "New password"
              ? await supabase.auth.updateUser({ password })
              : await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: window.location.origin + "/?recovery=1",
                });
      if (result.error) throw result.error;
      if (mode === "Reset password") {
        setMessage("Check your email for a password reset link.");
      } else if (
        mode === "Register" &&
        "data" in result &&
        "session" in result.data &&
        !result.data.session
      ) {
        setMessage("Check your email to confirm your account, then sign in.");
      } else {
        if (mode === "New password") {
          const url = new URL(window.location.href);
          url.searchParams.delete("recovery");
          url.hash = "";
          window.history.replaceState(null, "", url);
        }
        onDone();
      }
    } catch {
      setMessage(
        mode === "Sign in"
          ? "We couldn’t sign you in. Check your email and password."
          : "This request could not be completed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!configured)
    return (
      <div className="empty">
        <ShieldCheck size={32} />
        <h3>Your account is almost ready</h3>
        <p>
          Connect the app to Supabase to sign in and securely save your
          finances. You can explore the demo in the meantime.
        </p>
      </div>
    );
  return (
    <form className="form-stack" onSubmit={submit}>
      <p className="fine-print">
        Your personal finances stay separate from the demo.
      </p>
      <Segmented
        options={["Sign in", "Register"]}
        value={mode === "Register" ? "Register" : "Sign in"}
        onChange={setMode}
      />
      {mode === "Register" && (
        <Field label="Your name">
          <input name="name" autoComplete="name" required maxLength={60} />
        </Field>
      )}
      {mode !== "New password" && (
        <Field label="Email">
          <input name="email" type="email" autoComplete="email" required />
        </Field>
      )}
      {mode !== "Reset password" && (
        <Field label="Password">
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete={
              mode === "Sign in" ? "current-password" : "new-password"
            }
            required
          />
        </Field>
      )}
      {message && (
        <p className="form-error" role="status">
          {message}
        </p>
      )}
      <button className="primary full" disabled={busy}>
        {busy ? "Please wait…" : mode}
      </button>
      {mode === "Sign in" && (
        <button
          className="text-button"
          type="button"
          onClick={() => setMode("Reset password")}
        >
          Forgot password?
        </button>
      )}
      {process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === "true" && (
        <>
          <div className="auth-divider">
            <span>or</span>
          </div>
          <button
            type="button"
            className="secondary full"
            disabled={busy}
            onClick={async () => {
              if (!supabase) return;
              setBusy(true);
              const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.origin },
              });
              if (error) {
                setMessage(
                  "Google sign-in is temporarily unavailable. Please use your email instead.",
                );
                setBusy(false);
              }
            }}
          >
            <span className="google-mark">G</span>Continue with Google
          </button>
        </>
      )}
    </form>
  );
}
