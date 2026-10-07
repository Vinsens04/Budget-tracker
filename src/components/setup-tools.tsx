"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  availableCategories,
  categoryInUse,
  updateCategory,
  uid,
  today,
  type CustomCategory,
  type FinanceState,
} from "@/lib/finance";
import { CategoryIcon, Field, Segmented } from "./ui";

type Props = {
  state: FinanceState;
  busy: boolean;
  onSave: (next: FinanceState, message: string) => Promise<void>;
};
export function CategoryManager({ state, busy, onSave }: Props) {
  const [editing, setEditing] = useState<CustomCategory | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [error, setError] = useState("");
  const reset = () => {
    setEditing(null);
    setName("");
    setError("");
  };
  return (
    <div className="form-stack">
      <p className="fine-print">
        Create categories that fit your life. Renaming a category also updates
        its transactions, budgets, and recurring payments.
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await onSave(
              updateCategory(state, { id: editing?.id ?? uid(), name, type }),
              editing ? "Category updated" : "Category created",
            );
            reset();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Segmented
          options={["expense", "income"]}
          value={type}
          onChange={setType}
        />
        <Field label="Category name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Education"
            required
            maxLength={60}
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="detail-actions">
          <button className="primary" disabled={busy}>
            <Plus size={17} />
            {editing ? "Save category" : "Add category"}
          </button>
          {editing && (
            <button className="secondary" type="button" onClick={reset}>
              Cancel edit
            </button>
          )}
        </div>
      </form>
      <div className="custom-category-list">
        {(state.settings.customCategories ?? []).map((c, i) => (
          <div className="custom-category-row" key={c.id}>
            <CategoryIcon category={c.name} index={i} />
            <div>
              <strong>{c.name}</strong>
              <small>{c.type === "income" ? "Income" : "Expense"}</small>
            </div>
            <button
              className="icon-button"
              aria-label={`Edit ${c.name}`}
              disabled={busy}
              onClick={() => {
                setEditing(c);
                setName(c.name);
                setType(c.type);
                setError("");
              }}
            >
              <Pencil size={17} />
            </button>
            <button
              className="icon-button"
              aria-label={`Delete ${c.name}`}
              disabled={busy}
              onClick={async () => {
                setError("");
                if (categoryInUse(state, c.name)) {
                  setError(
                    "This category is used by a transaction, budget, or recurring payment. Move those items to another category before deleting it.",
                  );
                  return;
                }
                try {
                  await onSave(
                    {
                      ...state,
                      settings: {
                        ...state.settings,
                        customCategories:
                          state.settings.customCategories?.filter(
                            (item) => item.id !== c.id,
                          ),
                      },
                    },
                    "Category deleted",
                  );
                  if (editing?.id === c.id) reset();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
      <p className="fine-print">
        Built-in categories are always available:{" "}
        {availableCategories(
          {
            ...state,
            transactions: [],
            settings: { ...state.settings, customCategories: [] },
          },
          type,
        ).join(", ")}
        .
      </p>
    </div>
  );
}

export function FirstSetup({ state, busy, onSave }: Props) {
  const [error, setError] = useState("");
  const wallet = state.wallets.find((w) => !w.archived);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setError("");
        const f = new FormData(e.currentTarget);
        const opening = Number(f.get("opening"));
        const limit = Number(f.get("budget"));
        if (
          !Number.isSafeInteger(opening) ||
          opening < 0 ||
          !Number.isSafeInteger(limit) ||
          limit < 0
        ) {
          setError("Enter whole rupiah amounts of zero or more.");
          return;
        }
        const id = wallet?.id ?? uid();
        try {
          await onSave(
            {
              ...state,
              wallets: wallet
                ? state.wallets.map((w) =>
                    w.id === id
                      ? { ...w, name: String(f.get("wallet")).trim(), opening }
                      : w,
                  )
                : [
                    {
                      id,
                      name: String(f.get("wallet")).trim(),
                      opening,
                      archived: false,
                    },
                  ],
              budgets:
                limit > 0
                  ? [
                      ...state.budgets,
                      {
                        id: uid(),
                        category: "Food & Drinks",
                        limit,
                        threshold: 75,
                        month: today().slice(0, 7),
                      },
                    ]
                  : state.budgets,
              settings: {
                ...state.settings,
                name: String(f.get("name")).trim(),
                defaultWallet: id,
                onboardingComplete: true,
              },
            },
            "Your space is ready",
          );
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <p className="fine-print">
        Start with your current balance. Your opening balance belongs to your
        wallet and won’t count as income.
      </p>
      <Field label="Your name">
        <input
          name="name"
          defaultValue={state.settings.name}
          required
          maxLength={60}
        />
      </Field>
      <Field label="First wallet">
        <input
          name="wallet"
          defaultValue={wallet?.name ?? "Cash"}
          required
          maxLength={60}
        />
      </Field>
      <Field label="Current balance · Rp">
        <input
          name="opening"
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          defaultValue={wallet?.opening ?? 0}
          required
        />
      </Field>
      <Field label="Food & Drinks budget this month · Rp">
        <input
          name="budget"
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          defaultValue="0"
        />
      </Field>
      <p className="fine-print">
        Optional. You can add budgets for other categories afterward.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary full" disabled={busy}>
        {busy ? "Saving…" : "Start using Saldo"}
      </button>
    </form>
  );
}
