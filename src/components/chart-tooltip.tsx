"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays } from "lucide-react";
import type { TooltipContentProps } from "recharts";
import { money } from "@/lib/finance";
import { categoryIcons } from "./ui";

/** Shared visual treatment for all chart inspection, in both appearances. */
export function ChartTooltip({
  active,
  payload,
  label,
  kind,
  total = 0,
}: TooltipContentProps & {
  kind: "category" | "spending" | "comparison";
  total?: number;
}) {
  const reduced = useReducedMotion();
  const entries =
    payload?.filter(
      (entry) => entry.value != null && Number.isFinite(Number(entry.value)),
    ) ?? [];
  if (!active || !entries.length || (kind === "category" && total === 0))
    return null;
  const first = entries[0];
  const title = String(first.payload?.tooltipLabel ?? label ?? "Spending");
  const name = String(first.name ?? first.payload?.name ?? "Other");
  const color = first.payload?.color ?? first.color ?? first.fill ?? "#2e6b50";
  const percentage =
    total > 0 ? Math.round((Number(first.value) / total) * 100) : 0;
  const Icon = categoryIcons[name] ?? ArrowUpRight;
  return (
    <motion.div
      className={`chart-tooltip chart-tooltip-${kind}`}
      role="tooltip"
      initial={{ opacity: 0, scale: reduced ? 1 : 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduced ? 0 : 0.12, ease: "easeOut" }}
    >
      {kind === "category" ? (
        <>
          <div className="chart-tooltip-category-heading">
            <span
              className="chart-tooltip-icon"
              style={{ color, background: `${color}18` }}
            >
              <Icon size={17} strokeWidth={1.8} />
            </span>
            <strong>{name}</strong>
            <span className="chart-tooltip-share">{percentage}%</span>
          </div>
          <div className="chart-tooltip-amount">
            {money(Number(first.value))}
          </div>
          <p className="chart-tooltip-caption">of your spending this month</p>
          <div className="chart-tooltip-track">
            <span style={{ width: `${percentage}%`, background: color }} />
          </div>
        </>
      ) : (
        <>
          <div className="chart-tooltip-date">
            <CalendarDays size={14} />
            <span>{title}</span>
          </div>
          <div className="chart-tooltip-rows">
            {entries
              .sort(
                (a, b) =>
                  Number(b.dataKey === "income") -
                  Number(a.dataKey === "income"),
              )
              .map((entry, i) => {
                const income = entry.dataKey === "income";
                const RowIcon = income ? ArrowDownLeft : ArrowUpRight;
                return (
                  <div
                    className="chart-tooltip-row"
                    key={String(entry.dataKey ?? i)}
                  >
                    <span
                      className={`chart-tooltip-icon ${income ? "tooltip-income" : "tooltip-expense"}`}
                    >
                      <RowIcon size={16} />
                    </span>
                    <span className="chart-tooltip-row-name">
                      {String(entry.name ?? (income ? "Income" : "Spending"))}
                    </span>
                    <strong>{money(Number(entry.value))}</strong>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </motion.div>
  );
}

export function ComparisonLegend() {
  return (
    <div className="comparison-legend">
      <span>
        <i className="legend-income" />
        Income
      </span>
      <span>
        <i className="legend-expense" />
        Expenses
      </span>
    </div>
  );
}
