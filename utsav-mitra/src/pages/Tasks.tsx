import { useOutletContext } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { addTask, getTasks, updateTask } from "@/firebase/events";
import type { Task, TaskStatus, TaskPriority } from "@/types";

const columns: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "in-progress", label: "In Progress" },
  { status: "done", label: "Done" },
];

const priColor: Record<TaskPriority, string> = {
  low: "bg-surface-2",
  medium: "bg-primary-dim",
  high: "bg-danger",
};

export default function Tasks() {
  const { eventId } = useOutletContext<{ eventId: string }>();
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");

  async function load() {
    setTasks(await getTasks(eventId));
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function add() {
    if (!profile || !title.trim()) return;
    await addTask(eventId, {
      title: title.trim(),
      status: "pending",
      priority,
      assignedTo: profile.uid,
      createdAt: Date.now(),
    });
    setTitle("");
    load();
  }

  async function setStatus(t: Task, status: TaskStatus) {
    await updateTask(eventId, t.id, { status });
    load();
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-bold">Tasks</h1>

      <div className="flex gap-2 rounded-xl border border-border bg-surface p-2">
        <input className="flex-1 rounded-lg bg-surface-2 border border-border p-2 text-text" placeholder="New task" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="rounded-lg bg-surface-2 border border-border p-2 text-text" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
          <option value="low">Low</option>
          <option value="medium">Med</option>
          <option value="high">High</option>
        </select>
        <button onClick={add} className="rounded-lg bg-primary px-3 font-semibold text-black">+</button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {columns.map((col) => (
          <div key={col.status} className="space-y-2">
            <div className="text-center text-sm font-semibold text-text-dim">{col.label}</div>
            {tasks.filter((t) => t.status === col.status).map((t) => (
              <div key={t.id} className="rounded-lg border border-border bg-surface p-2">
                <div className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 rounded-full ${priColor[t.priority]}`} />
                  <span className="flex-1 text-sm">{t.title}</span>
                </div>
                <select
                  className="mt-2 w-full rounded bg-surface-2 border border-border p-1 text-xs text-text"
                  value={t.status}
                  onChange={(e) => setStatus(t, e.target.value as TaskStatus)}
                >
                  {columns.map((c) => (
                    <option key={c.status} value={c.status}>{c.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
