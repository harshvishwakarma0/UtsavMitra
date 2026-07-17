import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { addExpense, getExpenses } from "@/firebase/events";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { computeSettlement, netForMember } from "@/lib/settlement";
import type { EventDoc, Expense, SplitEntry } from "@/types";

export default function Expenses() {
  const { eventId } = useOutletContext<{ eventId: string }>();
  const { profile } = useAuth();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("Decoration");
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const e = await getDoc(doc(db, "events", eventId));
      setEvent({ id: e.id, ...e.data() } as EventDoc);
      setExpenses(await getExpenses(eventId));
    })();
  }, [eventId]);

  const members = event?.members ?? [];

  function buildSplit(): SplitEntry[] {
    if (splitMode === "equal" && amount > 0) {
      const per = Math.round((amount / members.length) * 100) / 100;
      return members.map((m) => ({ uid: m.uid, name: m.name, amount: per, paid: false }));
    }
    return members.map((m) => ({ uid: m.uid, name: m.name, amount: customAmounts[m.uid] ?? 0, paid: false }));
  }

  async function submit() {
    if (!profile || !title.trim() || amount <= 0) return;
    await addExpense(eventId, {
      title: title.trim(),
      amount,
      category,
      paidBy: profile.uid,
      date: Date.now(),
      splitMode,
      split: buildSplit(),
    });
    setTitle("");
    setAmount(0);
    setExpenses(await getExpenses(eventId));
  }

  const settlement = computeSettlement(expenses);
  const myNet = profile ? netForMember(expenses, profile.uid) : 0;

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Expenses</h1>

      <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
        <input className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text" placeholder="What for?" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input type="number" className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text" placeholder="Amount" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        <input className="w-full rounded-lg bg-surface-2 border border-border p-2 text-text" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
        <div className="flex gap-2">
          {(["equal", "custom"] as const).map((m) => (
            <button key={m} onClick={() => setSplitMode(m)} className={`flex-1 rounded-lg border p-2 text-sm ${splitMode === m ? "border-primary text-primary" : "border-border text-text-dim"}`}>
              {m === "equal" ? "Equal split" : "Custom"}
            </button>
          ))}
        </div>
        {splitMode === "custom" && (
          <div className="space-y-1">
            {members.map((m) => (
              <div key={m.uid} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{m.name}</span>
                <input type="number" className="w-20 rounded bg-surface-2 border border-border p-1 text-text" placeholder="₹" value={customAmounts[m.uid] ?? ""} onChange={(e) => setCustomAmounts((s) => ({ ...s, [m.uid]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
        )}
        <button onClick={submit} className="w-full rounded-lg bg-primary p-2 font-semibold text-black">Add Expense</button>
      </div>

      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="mb-2 text-sm font-semibold text-primary">Settlement</div>
        {profile && <p className="text-sm">Your net: <b>{myNet >= 0 ? `owed ₹${myNet}` : `you owe ₹${-myNet}`}</b></p>}
        {settlement.map((s, i) => (
          <div key={i} className="text-sm text-text-dim">{s.from.slice(0, 6)} → {s.to.slice(0, 6)}: ₹{s.amount}</div>
        ))}
        {settlement.length === 0 && <p className="text-text-dim">All settled.</p>}
      </div>

      <div className="space-y-2">
        {expenses.map((e) => (
          <div key={e.id} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex justify-between">
              <span className="font-medium">{e.title}</span>
              <span>₹{e.amount}</span>
            </div>
            <div className="text-xs text-text-dim">{e.category}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
