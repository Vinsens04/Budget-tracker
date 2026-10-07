"use client";
import { useMemo } from "react";
import { useReducedMotion } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { ChartTooltip, ComparisonLegend } from "./chart-tooltip";
import {
  categoryTotals,
  shortMoney,
  money,
  type Transaction,
} from "@/lib/finance";
export type Period = "Week" | "Month" | "Year";
export function timeline(
  transactions: Transaction[],
  period: Period,
  month: string,
) {
  const date = new Date(`${month}-01T12:00:00`);
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Array.from(
    { length: period === "Year" ? 12 : period === "Week" ? 7 : days },
    (_, i) => {
      const key =
        period === "Year"
          ? `${month.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`
          : period === "Week"
            ? (() => {
                const d = new Date();
                d.setDate(d.getDate() - 6 + i);
                return new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Jakarta",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                }).format(d);
              })()
            : `${month}-${String(i + 1).padStart(2, "0")}`;
      const tx = transactions.filter((t) =>
        period === "Year" ? t.date.startsWith(key) : t.date === key,
      );
      return {
        tooltipLabel: new Date(
          `${key}${period === "Year" ? "-01" : ""}T12:00:00`,
        ).toLocaleDateString(
          "en-GB",
          period === "Year"
            ? { month: "long", year: "numeric" }
            : { day: "numeric", month: "short", year: "numeric" },
        ),
        label:
          period === "Year"
            ? new Date(`${key}-01T12:00:00`).toLocaleDateString("en", {
                month: "short",
              })
            : period === "Week"
              ? new Date(`${key}T12:00:00`).toLocaleDateString("en", {
                  weekday: "short",
                })
              : String(i + 1),
        expense: tx
          .filter((t) => t.type === "expense")
          .reduce((n, t) => n + t.amount, 0),
        income: tx
          .filter((t) => t.type === "income")
          .reduce((n, t) => n + t.amount, 0),
      };
    },
  );
}
export function SpendingChart({
  transactions,
  period,
  month,
}: {
  transactions: Transaction[];
  period: Period;
  month: string;
}) {
  const reduced = useReducedMotion();
  const data = useMemo(
    () => timeline(transactions, period, month),
    [transactions, period, month],
  );
  return (
    <div className="area-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="spendingFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--chart-line)"
                stopOpacity={0.17}
              />
              <stop
                offset="100%"
                stopColor="var(--chart-line)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--divider)"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={30}
            tick={{ fill: "var(--secondary)", fontSize: 12 }}
            dy={8}
          />
          <YAxis
            tickFormatter={shortMoney}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--secondary)", fontSize: 12 }}
          />
          <Tooltip
            content={(props) => <ChartTooltip {...props} kind="spending" />}
            cursor={{
              stroke: "var(--chart-cursor-stroke)",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
            wrapperStyle={{ zIndex: 10, outline: "none" }}
            isAnimationActive={reduced === false}
            animationDuration={120}
            animationEasing="ease-out"
            offset={12}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="Spending"
            stroke="var(--chart-line)"
            strokeWidth={2.5}
            fill="url(#spendingFill)"
            isAnimationActive={reduced === false}
            animationDuration={450}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CategoryChart({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const reduced = useReducedMotion();
  const data = useMemo(() => categoryTotals(transactions), [transactions]);
  const total = data.reduce((n, c) => n + c.value, 0);
  return (
    <div className="donut">
      <ResponsiveContainer width="100%" height={188}>
        <PieChart>
          <Pie
            data={
              data.length
                ? data
                : [{ name: "No spending", value: 1, color: "var(--divider)" }]
            }
            dataKey="value"
            innerRadius={64}
            outerRadius={85}
            paddingAngle={data.length > 1 ? 4 : 0}
            cornerRadius={5}
            stroke="none"
            isAnimationActive={reduced === false}
            animationDuration={450}
            animationEasing="ease-out"
          >
            {(data.length ? data : [{ color: "var(--divider)" }]).map(
              (c, i) => (
                <Cell key={i} fill={c.color} />
              ),
            )}
          </Pie>
          <Tooltip
            content={(props) => (
              <ChartTooltip {...props} kind="category" total={total} />
            )}
            wrapperStyle={{ zIndex: 10, outline: "none" }}
            isAnimationActive={reduced === false}
            animationDuration={120}
            animationEasing="ease-out"
            offset={14}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-label">
        <small>Total spent</small>
        <strong>{money(total)}</strong>
      </div>
    </div>
  );
}
export function ComparisonChart({
  transactions,
  period,
  month,
}: {
  transactions: Transaction[];
  period: Period;
  month: string;
}) {
  const reduced = useReducedMotion();
  const data = useMemo(
    () => timeline(transactions, period, month),
    [transactions, period, month],
  );
  return (
    <div className="area-chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid
            vertical={false}
            stroke="var(--divider)"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="label"
            minTickGap={30}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--secondary)", fontSize: 12 }}
          />
          <YAxis
            tickFormatter={shortMoney}
            axisLine={false}
            tickLine={false}
            width={45}
            tick={{ fill: "var(--secondary)", fontSize: 12 }}
          />
          <Tooltip
            content={(props) => <ChartTooltip {...props} kind="comparison" />}
            cursor={{ fill: "var(--chart-cursor)" }}
            wrapperStyle={{ zIndex: 10, outline: "none" }}
            isAnimationActive={reduced === false}
            animationDuration={120}
            animationEasing="ease-out"
            offset={12}
          />
          <Bar
            dataKey="income"
            name="Income"
            fill="#579a69"
            radius={[4, 4, 0, 0]}
            isAnimationActive={reduced === false}
            animationDuration={450}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="expense"
            name="Expenses"
            fill="#b67550"
            radius={[4, 4, 0, 0]}
            isAnimationActive={reduced === false}
            animationDuration={450}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
      <ComparisonLegend />
    </div>
  );
}
