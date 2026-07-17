import { useOutletContext, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { getExpenses, getTasks, getNotices } from "@/firebase/events";
import { computeSettlement } from "@/lib/settlement";
import type { EventDoc, Expense, Task, Notice } from "@/types";

export default function Dashboard() {
  const { eventId } = useOutletContext<{ eventId: string }>();
  const { profile } = useAuth();
  const nav = useNavigate();
  const [event, setEvent] = useState<EventDoc | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);

  const myRole = event?.members.find((m) => m.uid === profile?.uid)?.role;
  const canSeeFinance = myRole === "owner" || myRole === "treasurer" || profile?.role === "superAdmin";
  const myTasks = tasks.filter((t) => t.assignedTo === profile?.uid && t.status !== "done");

  useEffect(() => {
    (async () => {
      const e = await getDoc(doc(db, "events", eventId));
      setEvent({ id: e.id, ...e.data() } as EventDoc);
      setExpenses(await getExpenses(eventId));
      setTasks(await getTasks(eventId));
      setNotices(await getNotices(eventId));
    })();
  }, [eventId]);

  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const settlement = canSeeFinance ? computeSettlement(expenses) : [];

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-2xl font-bold">{event?.title}</h1>

      {canSeeFinance && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Budget" value={`₹${event?.totalBudget ?? 0}`} />
          <Stat label="Spent" value={`₹${spent}`} />
        </div>
      )}

      <Section title={`Tasks for you (${myTasks.length})`}>
        {myTasks.length === 0 ? (
          <p className="text-text-dim">Nothing assigned. 🎉</p>
        ) : (
          myTasks.map((t) => (
            <div key={t.id} className="rounded-lg border border-border p-2 text-sm">
              {t.title}
            </div>
          ))
        )}
      </Section>

      {canSeeFinance && settlement.length > 0 && (
        <Section title="Who pays whom">
          {settlement.map((s, i) => (
            <div key={i} className="text-sm text-text-dim">
              {s.from.slice(0, 6)} → {s.to.slice(0, 6)}: ₹{s.amount}
            </div>
          ))}
        </Section>
      )}

      <Section title="Latest notices">
        {notices.slice(0, 3).map((n) => (
          <div key={n.id} className="border-b border-border py-1 text-sm">
            <span className="font-medium">{n.title}</span>
          </div>
        ))}
        {notices.length === 0 && <p className="text-text-dim">No notices yet.</p>}
      </Section>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => nav("expenses")} className="rounded-xl bg-surface-2 p-4 text-left">
          + Add Expense
        </button>
        <button onClick={() => nav("tasks")} className="rounded-xl bg-surface-2 p-4 text-left">
          + Add Task
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-xs text-text-dim">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-2 text-sm font-semibold text-primary">{title}</div>
      {children}
    </div>
  );
}
