import { useOutletContext, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getExpenses, getTasks, getNotices } from "@/firebase/events";
import { computeSettlement } from "@/lib/settlement";
import type { EventDoc, Expense, Task, Notice } from "@/types";

export default function Dashboard() {
  const { event: contextEvent, eventId } = useOutletContext<{ event?: EventDoc; eventId: string }>();
  const { profile } = useAuth();
  const nav = useNavigate();
  const [event, setEvent] = useState<EventDoc | null>(contextEvent || null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(!contextEvent);
  const [err, setErr] = useState("");

  const myRole = event?.members?.find((m) => m.uid === profile?.uid)?.role;
  const canSeeFinance = myRole === "owner" || myRole === "treasurer" || profile?.role === "superAdmin";
  const myTasks = tasks.filter((t) => t.assignedTo === profile?.uid && t.status !== "done");

  useEffect(() => {
    if (contextEvent) setEvent(contextEvent);
  }, [contextEvent]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [eDocs, tDocs, nDocs] = await Promise.all([
          getExpenses(eventId),
          getTasks(eventId),
          getNotices(eventId),
        ]);
        setExpenses(eDocs);
        setTasks(tDocs);
        setNotices(nDocs);
      } catch (e: any) {
        console.error("Dashboard data load error:", e);
        setErr("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const settlement = canSeeFinance ? computeSettlement(expenses) : [];

  const getMemberName = (uid: string) => event?.members?.find((m) => m.uid === uid)?.name || "Member";

  if (loading && !event) {
    return <div className="p-4 text-center text-sm text-text-dim">Loading event dashboard…</div>;
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-2xl font-bold">{event?.title || "Event Dashboard"}</h1>

      {err && <div className="rounded-lg bg-surface-2 p-3 text-sm text-danger">{err}</div>}

      {canSeeFinance && (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Budget" value={`₹${event?.totalBudget ?? 0}`} />
          <Stat label="Spent" value={`₹${spent}`} />
        </div>
      )}

      <Section title={`Tasks for you (${myTasks.length})`}>
        {myTasks.length === 0 ? (
          <p className="text-text-dim text-sm">Nothing assigned. 🎉</p>
        ) : (
          myTasks.map((t) => (
            <div key={t.id} className="rounded-lg border border-border p-2 text-sm bg-surface-2">
              {t.title}
            </div>
          ))
        )}
      </Section>

      {canSeeFinance && settlement.length > 0 && (
        <Section title="Who pays whom">
          {settlement.map((s) => (
            <div key={`${s.from}-${s.to}`} className="text-sm text-text-dim">
              {getMemberName(s.from)} → {getMemberName(s.to)}: ₹{s.amount}
            </div>
          ))}
        </Section>
      )}

      <Section title="Latest notices">
        {notices.slice(0, 3).map((n) => (
          <div key={n.id} className="border-b border-border/50 py-1.5 text-sm last:border-0">
            <span className="font-medium">{n.title}</span>
          </div>
        ))}
        {notices.length === 0 && <p className="text-text-dim text-sm">No notices yet.</p>}
      </Section>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => nav("expenses")} className="rounded-xl bg-surface-2 p-4 text-left font-medium hover:bg-surface-2/80">
          + Add Expense
        </button>
        <button onClick={() => nav("tasks")} className="rounded-xl bg-surface-2 p-4 text-left font-medium hover:bg-surface-2/80">
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
