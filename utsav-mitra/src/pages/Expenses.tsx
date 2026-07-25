import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { withTimeout } from "@/firebase/timeout";
import { computeSettlement, netForMember } from "@/lib/settlement";
import type { EventDoc, Expense, SplitEntry } from "@/types";

export default function Expenses() {
  const { event: contextEvent, eventId } = useOutletContext<{ event?: EventDoc; eventId: string }>();
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("Decoration");
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setLoading(true);
    setErr("");
    return onSnapshot(
      query(collection(db, "events", eventId, "expenses"), orderBy("date", "desc")),
      (snap) => {
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense));
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load expenses:", error);
        setErr("Failed to load expenses data.");
        setLoading(false);
      }
    );
  }, [eventId]);

  const members = contextEvent?.members ?? [];

  function buildSplit(): { split: SplitEntry[]; valid: boolean; message?: string } {
    if (members.length === 0) return { split: [], valid: true };

    if (splitMode === "equal") {
      const base = Math.floor((amount / members.length) * 100) / 100;
      const totalAllocated = base * members.length;
      const remainder = Math.round((amount - totalAllocated) * 100) / 100;

      const split = members.map((m, idx) => ({
        uid: m.uid,
        name: m.name,
        amount: idx === 0 ? Math.round((base + remainder) * 100) / 100 : base,
        paid: false,
      }));
      return { split, valid: true };
    } else {
      const split = members.map((m) => ({
        uid: m.uid,
        name: m.name,
        amount: customAmounts[m.uid] ?? 0,
        paid: false,
      }));
      const customSum = Math.round(split.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
      if (Math.abs(customSum - amount) > 0.01) {
        return {
          split,
          valid: false,
          message: `Custom split total (₹${customSum}) must equal total amount (₹${amount}).`,
        };
      }
      return { split, valid: true };
    }
  }

  async function submit() {
    if (!profile || !title.trim() || amount <= 0) {
      setErr("Please enter a valid title and amount.");
      return;
    }
    const splitResult = buildSplit();
    if (!splitResult.valid) {
      setErr(splitResult.message || "Invalid split amounts.");
      return;
    }

    setBusy(true);
    setErr("");
    const expenseRef = doc(collection(db, "events", eventId, "expenses"));
    const newExpense: Expense = {
      id: expenseRef.id,
      title: title.trim(),
      amount,
      category: category.trim() || "General",
      paidBy: profile.uid,
      date: Date.now(),
      splitMode,
      split: splitResult.split,
    };
    setExpenses((previous) => [newExpense, ...previous]);
    try {
      const { id: _id, ...expenseData } = newExpense;
      await withTimeout(setDoc(expenseRef, expenseData), 10_000);
      setTitle("");
      setAmount(0);
      setCustomAmounts({});
    } catch (e: any) {
      console.error("Failed to add expense:", e);
      setExpenses((previous) => previous.filter((expense) => expense.id !== newExpense.id));
      setErr(e?.message ?? "Failed to add expense.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(expenseId: string) {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    const deletedIndex = expenses.findIndex((expense) => expense.id === expenseId);
    const deletedExpense = expenses[deletedIndex];
    if (!deletedExpense) return;
    setExpenses((previous) => previous.filter((expense) => expense.id !== expenseId));
    try {
      await withTimeout(deleteDoc(doc(db, "events", eventId, "expenses", expenseId)), 10_000);
    } catch (e: any) {
      console.error("Failed to delete expense:", e);
      setExpenses((previous) => {
        if (previous.some((expense) => expense.id === deletedExpense.id)) return previous;
        const next = [...previous];
        next.splice(deletedIndex, 0, deletedExpense);
        return next;
      });
      setErr("Failed to delete expense.");
    }
  }

  const settlement = computeSettlement(expenses);
  const myNet = profile ? netForMember(expenses, profile.uid) : 0;
  const getMemberName = (uid: string) => members.find((m) => m.uid === uid)?.name || "Unknown";

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Expenses</h1>

      {err && <div className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{err}</div>}

      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <input
          className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text"
          placeholder="What for?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text"
          placeholder="Amount"
          value={amount || ""}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <input
          className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <div className="flex gap-2">
          {(["equal", "custom"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setSplitMode(m)}
              className={`flex-1 rounded-lg border p-2 text-sm ${
                splitMode === m ? "border-primary text-primary" : "border-border text-text-dim"
              }`}
            >
              {m === "equal" ? "Equal split" : "Custom"}
            </button>
          ))}
        </div>
        {splitMode === "custom" && (
          <div className="space-y-1">
            {members.map((m) => (
              <div key={m.uid} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{m.name}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-20 rounded bg-surface-2 border border-border p-1 text-text"
                  placeholder="₹"
                  value={customAmounts[m.uid] ?? ""}
                  onChange={(e) =>
                    setCustomAmounts((s) => ({ ...s, [m.uid]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}
          </div>
        )}
        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-lg bg-primary p-2 font-semibold text-black disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add Expense"}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="mb-2 text-sm font-semibold text-primary">Settlement</div>
        {profile && (
          <p className="text-sm">
            Your net: <b>{myNet >= 0 ? `owed ₹${myNet}` : `you owe ₹${-myNet}`}</b>
          </p>
        )}
        {settlement.map((s) => (
          <div key={`${s.from}-${s.to}`} className="text-sm text-text-dim">
            {getMemberName(s.from)} → {getMemberName(s.to)}: ₹{s.amount}
          </div>
        ))}
        {settlement.length === 0 && <p className="text-text-dim">All settled.</p>}
      </div>

      {loading && expenses.length === 0 ? (
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="animate-fade-in flex items-center justify-between rounded-xl border border-border bg-surface p-3">
              <div>
                <div className="font-medium">{e.title}</div>
                <div className="text-xs text-text-dim">
                  {e.category} · Paid by {getMemberName(e.paidBy)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">₹{e.amount}</span>
                <button
                  onClick={() => handleDelete(e.id)}
                  className="rounded-lg bg-surface-2 p-1 text-xs text-danger hover:bg-danger/10"
                  title="Delete Expense"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {expenses.length === 0 && <p className="text-center text-text-dim">No expenses recorded yet.</p>}
        </div>
      )}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}
