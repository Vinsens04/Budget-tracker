"use client";
import { useState, useRef } from "react";
import { Camera, ChevronDown, Sparkles, Check } from "lucide-react";
import {
  availableCategories,
  parseQuick,
  today,
  uid,
  type FinanceState,
  type Transaction,
} from "@/lib/finance";
import { supabase } from "@/lib/supabase";
import { Field, Segmented, Sheet, CategoryIcon } from "./ui";
export default function TransactionForm({
  state,
  initial,
  onSave,
  busy,
  userId,
}: {
  state: FinanceState;
  initial?: Transaction;
  onSave: (t: Transaction) => Promise<void>;
  busy: boolean;
  userId?: string;
}) {
  const [type, setType] = useState<Transaction["type"]>(
    initial?.type ?? "expense",
  );
  const [amount, setAmount] = useState(String(initial?.amount ?? ""));
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(
    initial?.category ?? "Food & Drinks",
  );
  const [wallet, setWallet] = useState(
    initial?.wallet ?? state.settings.defaultWallet ?? "",
  );
  const [date, setDate] = useState(initial?.date ?? today());
  const [note, setNote] = useState(initial?.note ?? "");
  const [quick, setQuick] = useState("");
  const [picker, setPicker] = useState<"category" | "wallet" | "date" | null>(
    null,
  );
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const wallets = state.wallets.filter((w) => !w.archived);
  const currentWallet = wallets.some((w) => w.id === wallet)
    ? wallet
    : (wallets[0]?.id ?? "");
  const applyQuick = () => {
    const parsed = parseQuick(quick);
    if (!parsed) {
      setError("Try a name and amount, like Starbucks 55k.");
      return;
    }
    setName(parsed.name);
    setAmount(String(parsed.amount));
    setCategory(parsed.category);
    setError("");
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (!Number.isSafeInteger(value) || value <= 0) {
      setError("Enter a positive whole Rupiah amount.");
      return;
    }
    if (!currentWallet) {
      setError("Create a wallet before adding a transaction.");
      return;
    }
    if (!name.trim()) {
      setError("Give this transaction a name.");
      return;
    }
    setSaving(true);
    let receiptPath = initial?.receipt;
    let uploaded: string | undefined;
    try {
      if (receipt) {
        if (!supabase || !userId)
          throw new Error(
            "Receipt uploads need a connected account. You can save the transaction without a receipt.",
          );
        const extension =
          receipt.type === "application/pdf"
            ? "pdf"
            : receipt.type === "image/png"
              ? "png"
              : "jpg";
        uploaded = `${userId}/${uid()}.${extension}`;
        const { error } = await supabase.storage
          .from("receipts")
          .upload(uploaded, receipt, { contentType: receipt.type });
        if (error)
          throw new Error(
            "The receipt could not be uploaded. Please try again or remove it.",
          );
        receiptPath = uploaded;
      }
      await onSave({
        id: initial?.id ?? uid(),
        type,
        amount: value,
        name: name.trim(),
        category,
        wallet: currentWallet,
        date,
        note: note.trim(),
        receipt: receiptPath,
        recurringId: initial?.recurringId,
      });
    } catch (err) {
      if (uploaded && supabase)
        await supabase.storage.from("receipts").remove([uploaded]);
      setError(
        err instanceof Error
          ? err.message
          : "This transaction could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <form className="form-stack" onSubmit={submit}>
        <Segmented
          options={["Expense", "Income"]}
          value={type === "expense" ? "Expense" : "Income"}
          onChange={(v) => {
            setType(v === "Expense" ? "expense" : "income");
            setCategory(v === "Income" ? "Salary" : "Food & Drinks");
          }}
        />
        <div className="amount-field">
          <label htmlFor="amount">Amount</label>
          <div>
            <span>Rp</span>
            <input
              id="amount"
              aria-label="Amount in Rupiah"
              inputMode="numeric"
              type="number"
              min="1"
              step="1"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
        </div>
        <div className="quick-input">
          <Sparkles size={18} />
          <input
            aria-label="Quick add"
            placeholder="Try “Starbucks 55k”"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyQuick();
              }
            }}
          />
          <button type="button" onClick={applyQuick}>
            Apply
          </button>
        </div>
        <Field label="Transaction name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What was it for?"
            maxLength={120}
            required
          />
        </Field>
        <div className="form-grid">
          <Field label="Category">
            <button
              type="button"
              className="picker-button"
              onClick={() => setPicker("category")}
            >
              {category}
              <ChevronDown size={16} />
            </button>
          </Field>
          <Field label="Wallet">
            <button
              type="button"
              className="picker-button"
              onClick={() => setPicker("wallet")}
            >
              {wallets.find((w) => w.id === currentWallet)?.name ??
                "Choose wallet"}
              <ChevronDown size={16} />
            </button>
          </Field>
        </div>
        <Field label="Date">
          <button
            type="button"
            className="picker-button"
            onClick={() => setPicker("date")}
          >
            {new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            <ChevronDown size={16} />
          </button>
        </Field>
        <Field label="Note · optional">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A little context for later"
            maxLength={1000}
          />
        </Field>
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,application/pdf"
          capture="environment"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && file.size > 5 * 1024 * 1024) {
              setError("Choose a receipt under 5 MB.");
              return;
            }
            if (
              file &&
              !["image/jpeg", "image/png", "application/pdf"].includes(
                file.type,
              )
            ) {
              setError("Choose a JPEG, PNG or PDF receipt.");
              return;
            }
            setReceipt(file ?? null);
          }}
        />
        <button
          className="receipt-button"
          type="button"
          onClick={() =>
            receipt ? setReceipt(null) : fileRef.current?.click()
          }
        >
          <Camera size={18} />
          {receipt ? `${receipt.name} · Remove` : "Attach a receipt"}
        </button>
        {receipt && (
          <p className="fine-print">
            Enter the receipt details above and check them before saving.
            Automatic scanning is coming later.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary full"
          disabled={busy || saving}
          type="submit"
        >
          <Check size={18} />
          {saving ? "Saving…" : initial ? "Save changes" : "Save transaction"}
        </button>
      </form>
      <Sheet
        open={picker !== null}
        title={
          picker === "category"
            ? "Choose category"
            : picker === "wallet"
              ? "Choose wallet"
              : "Choose date"
        }
        onClose={() => setPicker(null)}
      >
        {picker === "category" ? (
          <div className="picker-list">
            {availableCategories(state, type).map((c, i) => (
              <button
                key={c}
                onClick={() => {
                  setCategory(c);
                  setPicker(null);
                }}
              >
                <CategoryIcon category={c} index={i} />
                {c}
                {category === c && <Check size={18} />}
              </button>
            ))}
          </div>
        ) : picker === "wallet" ? (
          <div className="picker-list">
            {wallets.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setWallet(w.id);
                  setPicker(null);
                }}
              >
                {w.name}
                {w.id === currentWallet && <Check size={18} />}
              </button>
            ))}
          </div>
        ) : (
          <div className="form-stack">
            <Field label="Transaction date">
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  if (e.target.value) setDate(e.target.value);
                }}
              />
            </Field>
            <button className="primary" onClick={() => setPicker(null)}>
              Done
            </button>
          </div>
        )}
      </Sheet>
    </>
  );
}
