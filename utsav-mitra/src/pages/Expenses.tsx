import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { addExpense, deleteExpense, getExpenses } from "@/firebase/events";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { computeSettlement, netForMember } from "@/lib/settlement";
import type { EventDoc, Expense, SplitEntry } from "@/types";

export default function Expenses() {
  const { event: contextEvent, eventId } = useOutletContext<{ event?: EventDoc; eventId: string }>();
  const { profile } = useAuth();
  const [event, setEvent] = useState<EventDoc | null>(contextEvent || null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("Decoration");
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(!contextEvent);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (contextEvent) setEvent(contextEvent);
  }, [contextEvent]);

  async function load() {
    try {
      setLoading(true);
      if (!contextEvent) {
        const e = await getDoc(doc(db, "events", eventId));
        if (e.exists()) setEvent({ id: e.id, ...e.data() } as EventDoc);
      }
      setExpenses(await getExpenses(eventId));
    } catch (e: any) {
      console.error("Failed to load expenses:", e);
      setErr("Failed to load expenses data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const members = event?.members ?? [];

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
    try {
      await addExpense(eventId, {
        title: title.trim(),
        amount,
        category: category.trim() || "General",
        paidBy: profile.uid,
        date: Date.now(),
        splitMode,
        split: splitResult.split,
      });
      setTitle("");
      setAmount(0);
      setCustomAmounts({});
      await load();
    } catch (e: any) {
      console.error("Failed to add expense:", e);
      setErr(e?.message ?? "Failed to add expense.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(expenseId: string) {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      await deleteExpense(eventId, expenseId);
      await load();
    } catch (e: any) {
      console.error("Failed to delete expense:", e);
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
        <p className="text-center text-sm text-text-dim">Loading expenses…</p>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
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
