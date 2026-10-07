"use client";
import { useEffect, useRef, useId, cloneElement, isValidElement } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  X,
  Coffee,
  Car,
  ShoppingBag,
  House,
  Play,
  Heart,
  Ellipsis,
  Briefcase,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import { colors, type Transaction, money } from "@/lib/finance";
export const categoryIcons: Record<string, LucideIcon> = {
  "Food & Drinks": Coffee,
  Transport: Car,
  Shopping: ShoppingBag,
  "Bills & Utilities": House,
  Entertainment: Play,
  Health: Heart,
  Other: Ellipsis,
  Salary: Landmark,
  Freelance: Briefcase,
};
export function CategoryIcon({
  category,
  index = 0,
}: {
  category: string;
  index?: number;
}) {
  const Icon = categoryIcons[category] ?? Ellipsis;
  return (
    <span
      className="category-icon"
      style={{
        color: colors[index % colors.length],
        background: `${colors[index % colors.length]}15`,
      }}
    >
      <Icon size={20} strokeWidth={1.8} />
    </span>
  );
}
export function Progress({ value, color }: { value: number; color?: string }) {
  const reduced = useReducedMotion();
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(Math.min(100, Math.max(0, value)))}
      aria-valuetext={`${Math.round(value)}% used`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Budget used"
    >
      <motion.span
        initial={reduced ? false : { scaleX: 0 }}
        animate={{ scaleX: Math.max(0, Math.min(100, value)) / 100 }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 150, damping: 25, mass: 0.65 }
        }
        style={{
          width: "100%",
          transformOrigin: "left center",
          background:
            color ??
            (value >= 90 ? "#ff3b30" : value > 70 ? "#ff9500" : "#007aff"),
        }}
      />
    </div>
  );
}
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  const group = useId();
  const reduced = useReducedMotion();
  return (
    <LayoutGroup id={group}>
      <div className="segmented">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            className={value === option ? "selected" : ""}
            onClick={() => onChange(option)}
          >
            {value === option && (
              <motion.span
                className="segmented-pill"
                layoutId="selection"
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 450, damping: 38 }
                }
              />
            )}
            <span className="segmented-label">{option}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}
export function TransactionList({
  items,
  onSelect,
  walletNames,
}: {
  items: Transaction[];
  onSelect: (t: Transaction) => void;
  walletNames: Record<string, string>;
}) {
  const reduced = useReducedMotion();
  return items.length ? (
    <div className="transaction-list">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((t) => (
          <motion.button
            key={t.id}
            layout={reduced ? false : "position"}
            initial={{ opacity: 0, y: reduced ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -4 }}
            transition={{ type: "spring", bounce: 0, duration: 0.26 }}
            className="transaction"
            onClick={() => onSelect(t)}
          >
            <CategoryIcon
              category={t.category}
              index={
                t.type === "income"
                  ? 5
                  : Object.keys(categoryIcons).indexOf(t.category)
              }
            />
            <span className="transaction-copy">
              <strong>{t.name}</strong>
              <small>
                {t.category} <span className="dot">·</span>{" "}
                {walletNames[t.wallet]}
              </small>
            </span>
            <span className="transaction-amount">
              <strong className={t.type === "income" ? "positive" : ""}>
                {t.type === "income" ? "+" : "−"} {money(t.amount)}
              </strong>
              <small>
                {new Date(t.date + "T12:00:00").toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </small>
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  ) : (
    <div className="empty">
      <Coffee size={28} />
      <h3>No transactions here yet</h3>
      <p>Add a transaction to start seeing the bigger picture.</p>
    </div>
  );
}
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() =>
      ref.current?.querySelector<HTMLElement>("input,button,select")?.focus(),
    );
    const handle = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button,input,select,textarea,a[href]",
          ) ?? [],
        ).filter((el) => !el.hasAttribute("disabled"));
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="sheet-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={ref}
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduced ? { opacity: 0 } : { y: 70, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: 70, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-grabber" />
            <div className="sheet-header">
              <h2>{title}</h2>
              <button
                className="icon-button"
                aria-label="Close dialog"
                onClick={onClose}
              >
                <X size={20} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {isValidElement(children)
        ? cloneElement(
            children as React.ReactElement<{ "aria-label"?: string }>,
            { "aria-label": label },
          )
        : children}
    </label>
  );
}
